import asyncio
import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user, get_current_workspace
from app.database import AsyncSessionLocal, get_db, utc_now
from app.models.extraction import ExtractionJob, ExtractionResult
from app.models.lead import Lead, LeadListMember
from app.models.user import User, Workspace
from app.schemas.extraction import ExtractionJobResponse, ExtractionResultItem, ExtractionStartRequest
from app.services.extraction_service import ExtractionEngine

router = APIRouter()

# In-memory tracking of active job tasks to support cancellation
active_crawls = {}

async def run_extraction_background(job_id: str, workspace_id: str, add_to_list_id: Optional[str] = None):
    async with AsyncSessionLocal() as db:
        q = select(ExtractionJob).where(ExtractionJob.id == job_id)
        job = (await db.execute(q)).scalar_one_or_none()
        if not job:
            return

        urls: List[str] = []
        try:
            urls = json.loads(job.target_urls)
        except Exception:
            urls = [job.target_urls]

        job.status = "running"
        job.started_at = utc_now()
        await db.commit()

        engine = ExtractionEngine(
            max_pages_per_domain=job.max_pages_per_domain,
            max_contacts_per_domain=job.max_contacts_per_domain,
            target_department=job.target_department,
        )

        for target_url in urls:
            # Check if job was cancelled
            curr_job = (await db.execute(select(ExtractionJob).where(ExtractionJob.id == job_id))).scalar_one_or_none()
            if curr_job and curr_job.status == "cancelled":
                break

            job.current_domain = target_url
            await db.commit()

            try:
                def on_progress(p_data):
                    # Local progress callback if needed
                    pass

                contacts = await engine.crawl_domain(target_url, progress_callback=on_progress)
                job.pages_crawled += engine.max_pages
                job.processed_domains += 1

                for c in contacts:
                    # Save or update lead
                    norm_email = c.email.lower()
                    lead_q = select(Lead).where(
                        Lead.workspace_id == workspace_id,
                        Lead.normalized_email == norm_email,
                    )
                    lead = (await db.execute(lead_q)).scalar_one_or_none()
                    if not lead:
                        lead = Lead(
                            workspace_id=workspace_id,
                            email=c.email,
                            normalized_email=norm_email,
                            first_name=c.name.split()[0] if c.name else None,
                            last_name=c.name.split()[-1] if c.name and len(c.name.split()) > 1 else None,
                            full_name=c.name,
                            company=c.company,
                            job_title=c.job_title,
                            department=c.department,
                            source="extraction",
                            source_url=c.source_url,
                            validation_status="unchecked",
                            outreach_status="uncontacted",
                        )
                        db.add(lead)
                        await db.flush()

                        if add_to_list_id:
                            db.add(LeadListMember(lead_list_id=add_to_list_id, lead_id=lead.id))

                    # Save extraction result item
                    ext_res = ExtractionResult(
                        job_id=job.id,
                        lead_id=lead.id if lead else None,
                        discovered_url=c.source_url,
                        email=c.email,
                        name=c.name,
                        title=c.job_title,
                        company=c.company,
                        raw_data=json.dumps(c.to_dict()),
                    )
                    db.add(ext_res)
                    job.contacts_found += 1

                await db.commit()

            except Exception as e:
                # Log error on this domain and continue
                job.error_message = f"Error crawling {target_url}: {str(e)}"
                job.processed_domains += 1
                await db.commit()

        # Mark job finished
        job.current_domain = None
        if job.status != "cancelled":
            job.status = "completed"
        job.completed_at = utc_now()
        await db.commit()

@router.post("/start", response_model=ExtractionJobResponse)
async def start_extraction(
    req: ExtractionStartRequest,
    background_tasks: BackgroundTasks,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    if not req.urls:
        raise HTTPException(status_code=400, detail="At least one website URL is required")

    job = ExtractionJob(
        workspace_id=workspace.id,
        target_urls=json.dumps(req.urls),
        status="queued",
        total_domains=len(req.urls),
        max_pages_per_domain=req.max_pages_per_domain or 5,
        max_contacts_per_domain=req.max_contacts_per_domain or 3,
        target_department=req.target_department,
        target_country=req.target_country,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Launch in background
    background_tasks.add_task(
        run_extraction_background,
        job.id,
        workspace.id,
        req.add_to_list_id,
    )

    return {
        "id": job.id,
        "workspace_id": job.workspace_id,
        "target_urls": req.urls,
        "status": job.status,
        "total_domains": job.total_domains,
        "processed_domains": 0,
        "pages_crawled": 0,
        "contacts_found": 0,
        "current_domain": None,
        "max_pages_per_domain": job.max_pages_per_domain,
        "max_contacts_per_domain": job.max_contacts_per_domain,
        "target_department": job.target_department,
        "error_message": None,
        "started_at": None,
        "completed_at": None,
        "created_at": job.created_at,
        "results": [],
    }

@router.get("/jobs", response_model=List[ExtractionJobResponse])
async def list_extraction_jobs(
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(ExtractionJob)
        .where(ExtractionJob.workspace_id == workspace.id)
        .order_by(ExtractionJob.created_at.desc())
        .limit(20)
    )
    jobs = (await db.execute(q)).scalars().all()

    resp = []
    for j in jobs:
        try:
            urls = json.loads(j.target_urls)
        except Exception:
            urls = [j.target_urls]
        resp.append({
            "id": j.id,
            "workspace_id": j.workspace_id,
            "target_urls": urls,
            "status": j.status,
            "total_domains": j.total_domains,
            "processed_domains": j.processed_domains,
            "pages_crawled": j.pages_crawled,
            "contacts_found": j.contacts_found,
            "current_domain": j.current_domain,
            "max_pages_per_domain": j.max_pages_per_domain,
            "max_contacts_per_domain": j.max_contacts_per_domain,
            "target_department": j.target_department,
            "error_message": j.error_message,
            "started_at": j.started_at,
            "completed_at": j.completed_at,
            "created_at": j.created_at,
            "results": [],
        })
    return resp

@router.get("/jobs/{job_id}", response_model=ExtractionJobResponse)
async def get_extraction_job(
    job_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(ExtractionJob).where(ExtractionJob.id == job_id, ExtractionJob.workspace_id == workspace.id)
    job = (await db.execute(q)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Extraction job not found")

    try:
        urls = json.loads(job.target_urls)
    except Exception:
        urls = [job.target_urls]

    # Fetch results
    res_q = (
        select(ExtractionResult, Lead.validation_status)
        .outerjoin(Lead, Lead.id == ExtractionResult.lead_id)
        .where(ExtractionResult.job_id == job.id)
        .order_by(ExtractionResult.created_at.desc())
    )
    results_rows = (await db.execute(res_q)).all()
    results_items = [
        ExtractionResultItem(
            id=r.id,
            discovered_url=r.discovered_url,
            email=r.email,
            name=r.name,
            title=r.title,
            company=r.company,
            validation_status=val_status or "unchecked",
            lead_id=r.lead_id,
            created_at=r.created_at,
        )
        for r, val_status in results_rows
    ]

    return {
        "id": job.id,
        "workspace_id": job.workspace_id,
        "target_urls": urls,
        "status": job.status,
        "total_domains": job.total_domains,
        "processed_domains": job.processed_domains,
        "pages_crawled": job.pages_crawled,
        "contacts_found": job.contacts_found,
        "current_domain": job.current_domain,
        "max_pages_per_domain": job.max_pages_per_domain,
        "max_contacts_per_domain": job.max_contacts_per_domain,
        "target_department": job.target_department,
        "error_message": job.error_message,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "created_at": job.created_at,
        "results": results_items,
    }

@router.post("/jobs/{job_id}/cancel")
async def cancel_extraction_job(
    job_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(ExtractionJob).where(ExtractionJob.id == job_id, ExtractionJob.workspace_id == workspace.id)
    job = (await db.execute(q)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Extraction job not found")

    job.status = "cancelled"
    job.completed_at = utc_now()
    await db.commit()
    return {"message": "Job cancelled successfully"}
