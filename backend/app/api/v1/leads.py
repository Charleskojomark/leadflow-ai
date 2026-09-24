import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user, get_current_workspace
from app.database import get_db, utc_now
from app.models.lead import Lead, LeadList, LeadListMember
from app.models.user import User, Workspace
from app.schemas.lead import (
    BulkAssignListRequest,
    BulkDeleteRequest,
    BulkTagRequest,
    LeadCreate,
    LeadListCreate,
    LeadListResponse,
    LeadListUpdate,
    LeadResponse,
    LeadUpdate,
)
from app.services.validation_service import validation_service

router = APIRouter()

def sanitize_csv_cell(val: Any) -> str:
    """Protects against CSV Formula Injection (CWE-1236)."""
    if val is None:
        return ""
    s = str(val).strip()
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s

def lead_to_response(lead: Lead, list_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    tags = []
    try:
        tags = json.loads(lead.tags) if lead.tags else []
    except Exception:
        tags = []

    val_details = {}
    try:
        val_details = json.loads(lead.validation_details) if lead.validation_details else {}
    except Exception:
        val_details = {}

    return {
        "id": lead.id,
        "workspace_id": lead.workspace_id,
        "email": lead.email,
        "normalized_email": lead.normalized_email,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "full_name": lead.full_name or f"{lead.first_name or ''} {lead.last_name or ''}".strip() or None,
        "company": lead.company,
        "job_title": lead.job_title,
        "department": lead.department,
        "website": lead.website,
        "industry": lead.industry,
        "country": lead.country,
        "source": lead.source,
        "source_url": lead.source_url,
        "tags": tags,
        "validation_status": lead.validation_status,
        "validation_details": val_details,
        "last_validated_at": lead.last_validated_at,
        "outreach_status": lead.outreach_status,
        "notes": lead.notes,
        "created_at": lead.created_at,
        "updated_at": lead.updated_at,
        "list_ids": list_ids or [],
    }

# ----------------- LEAD LISTS -----------------

@router.get("/lists", response_model=List[LeadListResponse])
async def get_lead_lists(
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(
            LeadList,
            func.count(LeadListMember.id).label("member_count"),
        )
        .outerjoin(LeadListMember, LeadListMember.lead_list_id == LeadList.id)
        .where(LeadList.workspace_id == workspace.id)
        .group_by(LeadList.id)
        .order_by(LeadList.created_at.desc())
    )
    rows = (await db.execute(q)).all()
    results = []
    for l_obj, count in rows:
        results.append({
            "id": l_obj.id,
            "workspace_id": l_obj.workspace_id,
            "name": l_obj.name,
            "description": l_obj.description,
            "member_count": count or 0,
            "created_at": l_obj.created_at,
            "updated_at": l_obj.updated_at,
        })
    return results

@router.post("/lists", response_model=LeadListResponse)
async def create_lead_list(
    list_in: LeadListCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    lead_list = LeadList(
        workspace_id=workspace.id,
        name=list_in.name,
        description=list_in.description,
    )
    db.add(lead_list)
    await db.commit()
    await db.refresh(lead_list)
    return {
        "id": lead_list.id,
        "workspace_id": lead_list.workspace_id,
        "name": lead_list.name,
        "description": lead_list.description,
        "member_count": 0,
        "created_at": lead_list.created_at,
        "updated_at": lead_list.updated_at,
    }

@router.delete("/lists/{list_id}")
async def delete_lead_list(
    list_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(LeadList).where(LeadList.id == list_id, LeadList.workspace_id == workspace.id)
    lead_list = (await db.execute(q)).scalar_one_or_none()
    if not lead_list:
        raise HTTPException(status_code=404, detail="Lead list not found")
    await db.delete(lead_list)
    await db.commit()
    return {"message": "Lead list deleted successfully"}

# ----------------- LEADS CRUD -----------------

@router.get("", response_model=List[LeadResponse])
async def list_leads(
    search: Optional[str] = None,
    validation_status: Optional[str] = None,
    outreach_status: Optional[str] = None,
    list_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    query = select(Lead).where(Lead.workspace_id == workspace.id)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                Lead.email.ilike(search_filter),
                Lead.first_name.ilike(search_filter),
                Lead.last_name.ilike(search_filter),
                Lead.company.ilike(search_filter),
                Lead.job_title.ilike(search_filter),
            )
        )

    if validation_status:
        query = query.where(Lead.validation_status == validation_status)

    if outreach_status:
        query = query.where(Lead.outreach_status == outreach_status)

    if list_id:
        query = query.join(LeadListMember, LeadListMember.lead_id == Lead.id).where(
            LeadListMember.lead_list_id == list_id
        )

    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    leads = (await db.execute(query)).scalars().all()

    # Fetch list memberships in batch
    lead_ids = [l.id for l in leads]
    membership_map: Dict[str, List[str]] = {lid: [] for lid in lead_ids}
    if lead_ids:
        mem_q = select(LeadListMember.lead_id, LeadListMember.lead_list_id).where(
            LeadListMember.lead_id.in_(lead_ids)
        )
        for lid, list_id_val in (await db.execute(mem_q)).all():
            membership_map[lid].append(list_id_val)

    return [lead_to_response(l, membership_map.get(l.id, [])) for l in leads]

@router.post("", response_model=LeadResponse)
async def create_lead(
    lead_in: LeadCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    norm_email = lead_in.email.lower().strip()

    # Deduplicate within workspace
    existing_q = select(Lead).where(
        Lead.workspace_id == workspace.id,
        Lead.normalized_email == norm_email,
    )
    existing = (await db.execute(existing_q)).scalar_one_or_none()
    if existing:
        # Update existing lead instead of erroring
        if lead_in.company:
            existing.company = lead_in.company
        if lead_in.job_title:
            existing.job_title = lead_in.job_title
        if lead_in.first_name:
            existing.first_name = lead_in.first_name
        if lead_in.last_name:
            existing.last_name = lead_in.last_name
        await db.commit()
        await db.refresh(existing)
        return lead_to_response(existing)

    lead = Lead(
        workspace_id=workspace.id,
        email=lead_in.email.strip(),
        normalized_email=norm_email,
        first_name=lead_in.first_name,
        last_name=lead_in.last_name,
        full_name=lead_in.full_name or f"{lead_in.first_name or ''} {lead_in.last_name or ''}".strip() or None,
        company=lead_in.company,
        job_title=lead_in.job_title,
        department=lead_in.department,
        website=lead_in.website,
        industry=lead_in.industry,
        country=lead_in.country,
        source=lead_in.source or "manual",
        source_url=lead_in.source_url,
        tags=json.dumps(lead_in.tags or []),
        notes=lead_in.notes,
        validation_status="unchecked",
        outreach_status="uncontacted",
    )
    db.add(lead)
    await db.flush()

    # Add to list memberships if provided
    if lead_in.lead_list_ids:
        for lid in lead_in.lead_list_ids:
            db.add(LeadListMember(lead_list_id=lid, lead_id=lead.id))

    await db.commit()
    await db.refresh(lead)
    return lead_to_response(lead, lead_in.lead_list_ids)

@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).where(Lead.id == lead_id, Lead.workspace_id == workspace.id)
    lead = (await db.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    mem_q = select(LeadListMember.lead_list_id).where(LeadListMember.lead_id == lead.id)
    list_ids = (await db.execute(mem_q)).scalars().all()
    return lead_to_response(lead, list(list_ids))

@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: str,
    lead_in: LeadUpdate,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).where(Lead.id == lead_id, Lead.workspace_id == workspace.id)
    lead = (await db.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    for field, val in lead_in.model_dump(exclude_unset=True).items():
        if field == "tags" and val is not None:
            lead.tags = json.dumps(val)
        else:
            setattr(lead, field, val)

    lead.updated_at = utc_now()
    await db.commit()
    await db.refresh(lead)
    return lead_to_response(lead)

@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).where(Lead.id == lead_id, Lead.workspace_id == workspace.id)
    lead = (await db.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.delete(lead)
    await db.commit()
    return {"message": "Lead deleted successfully"}

# ----------------- VALIDATION -----------------

@router.post("/validate/{lead_id}", response_model=LeadResponse)
async def validate_lead(
    lead_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).where(Lead.id == lead_id, Lead.workspace_id == workspace.id)
    lead = (await db.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    status_code, details = validation_service.validate_single_email(lead.email)
    lead.validation_status = status_code
    lead.validation_details = json.dumps(details)
    lead.last_validated_at = utc_now()
    await db.commit()
    await db.refresh(lead)
    return lead_to_response(lead)

@router.post("/bulk-validate")
async def bulk_validate_leads(
    req: BulkDeleteRequest, # reusing model with list of ids
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).where(Lead.id.in_(req.lead_ids), Lead.workspace_id == workspace.id)
    leads = (await db.execute(q)).scalars().all()
    count = 0
    for lead in leads:
        status_code, details = validation_service.validate_single_email(lead.email)
        lead.validation_status = status_code
        lead.validation_details = json.dumps(details)
        lead.last_validated_at = utc_now()
        count += 1
    await db.commit()
    return {"validated_count": count}

# ----------------- BULK OPERATIONS -----------------

@router.post("/bulk-assign-list")
async def bulk_assign_list(
    req: BulkAssignListRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    for lid in req.lead_ids:
        # Check if already member
        chk = await db.execute(
            select(LeadListMember).where(
                LeadListMember.lead_list_id == req.lead_list_id,
                LeadListMember.lead_id == lid,
            )
        )
        if not chk.scalar_one_or_none():
            db.add(LeadListMember(lead_list_id=req.lead_list_id, lead_id=lid))
    await db.commit()
    return {"message": f"Assigned {len(req.lead_ids)} leads to list"}

@router.post("/bulk-tag")
async def bulk_tag(
    req: BulkTagRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).where(Lead.id.in_(req.lead_ids), Lead.workspace_id == workspace.id)
    leads = (await db.execute(q)).scalars().all()
    for lead in leads:
        tags = []
        try:
            tags = json.loads(lead.tags) if lead.tags else []
        except Exception:
            tags = []
        if req.action == "add" and req.tag not in tags:
            tags.append(req.tag)
        elif req.action == "remove" and req.tag in tags:
            tags.remove(req.tag)
        lead.tags = json.dumps(tags)
    await db.commit()
    return {"message": f"Updated tags for {len(leads)} leads"}

@router.post("/bulk-delete")
async def bulk_delete(
    req: BulkDeleteRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).where(Lead.id.in_(req.lead_ids), Lead.workspace_id == workspace.id)
    leads = (await db.execute(q)).scalars().all()
    count = len(leads)
    for lead in leads:
        await db.delete(lead)
    await db.commit()
    return {"deleted_count": count}

# ----------------- CSV IMPORT & EXPORT -----------------

@router.post("/import-csv")
async def import_csv_leads(
    file: UploadFile = File(...),
    list_id: Optional[str] = Query(None),
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    contents = await file.read()
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = contents.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file appears to be empty or has no header")

    # Column mapping heuristic
    headers = {h.lower().strip(): h for h in reader.fieldnames}
    email_col = next((headers[h] for h in headers if "email" in h), None)
    if not email_col:
        raise HTTPException(status_code=400, detail="CSV must contain an 'email' column")

    fn_col = next((headers[h] for h in headers if h in ["first_name", "first name", "firstname", "first"]), None)
    ln_col = next((headers[h] for h in headers if h in ["last_name", "last name", "lastname", "last"]), None)
    name_col = next((headers[h] for h in headers if h in ["name", "full_name", "full name"]), None)
    company_col = next((headers[h] for h in headers if "company" in h or "organization" in h), None)
    title_col = next((headers[h] for h in headers if "title" in h or "role" in h or "position" in h), None)
    web_col = next((headers[h] for h in headers if "website" in h or "url" in h), None)

    imported = 0
    updated = 0

    for row in reader:
        raw_email = row.get(email_col, "").strip()
        if not raw_email or "@" not in raw_email:
            continue

        norm_email = raw_email.lower()
        first_name = row.get(fn_col, "").strip() if fn_col else None
        last_name = row.get(ln_col, "").strip() if ln_col else None
        full_name = row.get(name_col, "").strip() if name_col else None
        company = row.get(company_col, "").strip() if company_col else None
        job_title = row.get(title_col, "").strip() if title_col else None
        website = row.get(web_col, "").strip() if web_col else None

        # Check existing lead
        chk = await db.execute(
            select(Lead).where(
                Lead.workspace_id == workspace.id,
                Lead.normalized_email == norm_email,
            )
        )
        existing = chk.scalar_one_or_none()
        if existing:
            if company and not existing.company:
                existing.company = company
            if job_title and not existing.job_title:
                existing.job_title = job_title
            target_lead_id = existing.id
            updated += 1
        else:
            lead = Lead(
                workspace_id=workspace.id,
                email=raw_email,
                normalized_email=norm_email,
                first_name=first_name,
                last_name=last_name,
                full_name=full_name or f"{first_name or ''} {last_name or ''}".strip() or None,
                company=company,
                job_title=job_title,
                website=website,
                source="csv_import",
                validation_status="unchecked",
                outreach_status="uncontacted",
            )
            db.add(lead)
            await db.flush()
            target_lead_id = lead.id
            imported += 1

        if list_id:
            mem_chk = await db.execute(
                select(LeadListMember).where(
                    LeadListMember.lead_list_id == list_id,
                    LeadListMember.lead_id == target_lead_id,
                )
            )
            if not mem_chk.scalar_one_or_none():
                db.add(LeadListMember(lead_list_id=list_id, lead_id=target_lead_id))

    await db.commit()
    return {"imported": imported, "updated": updated}

@router.get("/export-csv")
async def export_csv_leads(
    list_id: Optional[str] = None,
    validation_status: Optional[str] = None,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    query = select(Lead).where(Lead.workspace_id == workspace.id)
    if list_id:
        query = query.join(LeadListMember, LeadListMember.lead_id == Lead.id).where(
            LeadListMember.lead_list_id == list_id
        )
    if validation_status:
        query = query.where(Lead.validation_status == validation_status)

    leads = (await db.execute(query)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Email",
        "First Name",
        "Last Name",
        "Company",
        "Job Title",
        "Website",
        "Validation Status",
        "Outreach Status",
        "Source",
        "Source URL",
        "Created At",
    ])

    for l in leads:
        writer.writerow([
            sanitize_csv_cell(l.email),
            sanitize_csv_cell(l.first_name),
            sanitize_csv_cell(l.last_name),
            sanitize_csv_cell(l.company),
            sanitize_csv_cell(l.job_title),
            sanitize_csv_cell(l.website),
            sanitize_csv_cell(l.validation_status),
            sanitize_csv_cell(l.outreach_status),
            sanitize_csv_cell(l.source),
            sanitize_csv_cell(l.source_url),
            sanitize_csv_cell(l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else ""),
        ])

    csv_data = output.getvalue()
    filename = f"leadflow_leads_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
