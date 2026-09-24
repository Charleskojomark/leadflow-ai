import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user, get_current_workspace
from app.database import get_db, utc_now
from app.models.campaign import Campaign, CampaignRecipient, EmailEvent, EmailTemplate
from app.models.lead import Lead, LeadList
from app.models.smtp import SMTPAccount
from app.models.user import User, Workspace
from app.schemas.campaign import (
    CampaignAuditPreview,
    CampaignCreate,
    CampaignPreviewEmailRequest,
    CampaignRecipientResponse,
    CampaignResponse,
    CampaignUpdate,
    EmailTemplateCreate,
    EmailTemplateResponse,
    EmailTemplateUpdate,
)
from app.services.campaign_service import campaign_service

router = APIRouter()

# ----------------- EMAIL TEMPLATES -----------------

@router.get("/templates", response_model=List[EmailTemplateResponse])
async def list_templates(
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(EmailTemplate).where(EmailTemplate.workspace_id == workspace.id).order_by(EmailTemplate.created_at.desc())
    templates = (await db.execute(q)).scalars().all()
    resp = []
    for t in templates:
        vars_list = []
        try:
            vars_list = json.loads(t.variables) if t.variables else []
        except Exception:
            vars_list = []
        resp.append({
            "id": t.id,
            "workspace_id": t.workspace_id,
            "name": t.name,
            "subject": t.subject,
            "body_html": t.body_html,
            "body_text": t.body_text,
            "variables": vars_list,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
        })
    return resp

@router.post("/templates", response_model=EmailTemplateResponse)
async def create_template(
    t_in: EmailTemplateCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    tmpl = EmailTemplate(
        workspace_id=workspace.id,
        name=t_in.name,
        subject=t_in.subject,
        body_html=t_in.body_html,
        body_text=t_in.body_text,
        variables=json.dumps(t_in.variables or ["first_name", "company", "job_title"]),
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return {
        "id": tmpl.id,
        "workspace_id": tmpl.workspace_id,
        "name": tmpl.name,
        "subject": tmpl.subject,
        "body_html": tmpl.body_html,
        "body_text": tmpl.body_text,
        "variables": t_in.variables or [],
        "created_at": tmpl.created_at,
        "updated_at": tmpl.updated_at,
    }

@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(EmailTemplate).where(EmailTemplate.id == template_id, EmailTemplate.workspace_id == workspace.id)
    tmpl = (await db.execute(q)).scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tmpl)
    await db.commit()
    return {"message": "Template deleted successfully"}

# ----------------- CAMPAIGNS -----------------

def campaign_to_response(c: Campaign, list_name: Optional[str] = None, smtp_name: Optional[str] = None) -> dict:
    return {
        "id": c.id,
        "workspace_id": c.workspace_id,
        "name": c.name,
        "description": c.description,
        "lead_list_id": c.lead_list_id,
        "lead_list_name": list_name or (c.lead_list.name if c.lead_list else None),
        "smtp_account_id": c.smtp_account_id,
        "smtp_account_name": smtp_name or (c.smtp_account.name if c.smtp_account else None),
        "template_id": c.template_id,
        "subject": c.subject,
        "body_html": c.body_html,
        "body_text": c.body_text,
        "sender_name": c.sender_name,
        "sender_email": c.sender_email,
        "reply_to": c.reply_to,
        "status": c.status,
        "daily_limit": c.daily_limit,
        "hourly_rate_limit": c.hourly_rate_limit,
        "total_recipients": c.total_recipients,
        "sent_count": c.sent_count,
        "delivered_count": c.delivered_count,
        "bounced_count": c.bounced_count,
        "reply_count": c.reply_count,
        "unsubscribe_count": c.unsubscribe_count,
        "started_at": c.started_at,
        "completed_at": c.completed_at,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }

@router.get("", response_model=List[CampaignResponse])
async def list_campaigns(
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(
            Campaign,
            LeadList.name.label("list_name"),
            SMTPAccount.name.label("smtp_name"),
        )
        .outerjoin(LeadList, LeadList.id == Campaign.lead_list_id)
        .outerjoin(SMTPAccount, SMTPAccount.id == Campaign.smtp_account_id)
        .where(Campaign.workspace_id == workspace.id)
        .order_by(Campaign.created_at.desc())
    )
    rows = (await db.execute(q)).all()
    return [campaign_to_response(c, list_name, smtp_name) for c, list_name, smtp_name in rows]

@router.post("", response_model=CampaignResponse)
async def create_campaign(
    c_in: CampaignCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    # Verify list and smtp account
    list_q = select(LeadList).where(LeadList.id == c_in.lead_list_id, LeadList.workspace_id == workspace.id)
    lead_list = (await db.execute(list_q)).scalar_one_or_none()
    if not lead_list:
        raise HTTPException(status_code=400, detail="Invalid lead list selected")

    smtp_q = select(SMTPAccount).where(SMTPAccount.id == c_in.smtp_account_id, SMTPAccount.workspace_id == workspace.id)
    smtp_acc = (await db.execute(smtp_q)).scalar_one_or_none()
    if not smtp_acc:
        raise HTTPException(status_code=400, detail="Invalid SMTP account selected")

    campaign = Campaign(
        workspace_id=workspace.id,
        name=c_in.name,
        description=c_in.description,
        lead_list_id=c_in.lead_list_id,
        smtp_account_id=c_in.smtp_account_id,
        template_id=c_in.template_id,
        subject=c_in.subject,
        body_html=c_in.body_html,
        body_text=c_in.body_text,
        sender_name=c_in.sender_name,
        sender_email=c_in.sender_email,
        reply_to=c_in.reply_to or c_in.sender_email,
        status="draft",
        daily_limit=c_in.daily_limit or 200,
        hourly_rate_limit=c_in.hourly_rate_limit or 50,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign_to_response(campaign, lead_list.name, smtp_acc.name)

@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(
            Campaign,
            LeadList.name.label("list_name"),
            SMTPAccount.name.label("smtp_name"),
        )
        .outerjoin(LeadList, LeadList.id == Campaign.lead_list_id)
        .outerjoin(SMTPAccount, SMTPAccount.id == Campaign.smtp_account_id)
        .where(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id)
    )
    res = (await db.execute(q)).one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c, list_name, smtp_name = res
    return campaign_to_response(c, list_name, smtp_name)

@router.get("/{campaign_id}/recipients", response_model=List[CampaignRecipientResponse])
async def get_campaign_recipients(
    campaign_id: str,
    skip: int = 0,
    limit: int = 50,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(CampaignRecipient, Lead)
        .join(Lead, Lead.id == CampaignRecipient.lead_id)
        .where(CampaignRecipient.campaign_id == campaign_id)
        .offset(skip)
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    resp = []
    for cr, lead in rows:
        resp.append({
            "id": cr.id,
            "campaign_id": cr.campaign_id,
            "lead_id": cr.lead_id,
            "email": lead.email,
            "name": lead.full_name or f"{lead.first_name or ''} {lead.last_name or ''}".strip() or None,
            "company": lead.company,
            "status": cr.status,
            "skip_reason": cr.skip_reason,
            "sent_at": cr.sent_at,
            "error_message": cr.error_message,
        })
    return resp

@router.post("/{campaign_id}/audit", response_model=CampaignAuditPreview)
async def audit_campaign(
    campaign_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Campaign).where(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c or not c.lead_list_id:
        raise HTTPException(status_code=404, detail="Campaign or lead list not found")

    audit = await campaign_service.audit_campaign_recipients(db, workspace.id, c.lead_list_id)
    return audit

@router.post("/{campaign_id}/launch")
async def launch_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Campaign).where(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Check that SMTP account exists
    smtp_q = select(SMTPAccount).where(SMTPAccount.id == c.smtp_account_id)
    smtp_acc = (await db.execute(smtp_q)).scalar_one_or_none()
    if not smtp_acc:
        raise HTTPException(status_code=400, detail="Campaign requires an active SMTP account")

    # Prepare recipient records
    count = await campaign_service.prepare_recipients(db, c)
    if count == 0 and c.total_recipients == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid, eligible recipients found in this list. Contacts may be suppressed, unsubscribed, or invalid.",
        )

    c.status = "sending"
    c.started_at = utc_now()
    await db.commit()

    # Launch background sending
    background_tasks.add_task(campaign_service.execute_campaign_batch, c.id)

    return {"message": f"Campaign successfully launched with {count} recipients queued", "campaign_id": c.id}

@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Campaign).where(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c.status = "paused"
    await db.commit()
    return {"message": "Campaign paused"}

@router.post("/{campaign_id}/resume")
async def resume_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Campaign).where(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c.status = "sending"
    await db.commit()
    background_tasks.add_task(campaign_service.execute_campaign_batch, c.id)
    return {"message": "Campaign resumed"}

@router.post("/{campaign_id}/cancel")
async def cancel_campaign(
    campaign_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Campaign).where(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c.status = "cancelled"
    c.completed_at = utc_now()
    await db.commit()
    return {"message": "Campaign cancelled"}

@router.post("/{campaign_id}/duplicate", response_model=CampaignResponse)
async def duplicate_campaign(
    campaign_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(Campaign).where(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    new_c = Campaign(
        workspace_id=workspace.id,
        name=f"Copy of {c.name}",
        description=c.description,
        lead_list_id=c.lead_list_id,
        smtp_account_id=c.smtp_account_id,
        template_id=c.template_id,
        subject=c.subject,
        body_html=c.body_html,
        body_text=c.body_text,
        sender_name=c.sender_name,
        sender_email=c.sender_email,
        reply_to=c.reply_to,
        status="draft",
        daily_limit=c.daily_limit,
        hourly_rate_limit=c.hourly_rate_limit,
    )
    db.add(new_c)
    await db.commit()
    await db.refresh(new_c)
    return campaign_to_response(new_c)

@router.post("/preview-email")
async def preview_email(
    req: CampaignPreviewEmailRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    lead = None
    if req.lead_id:
        q = select(Lead).where(Lead.id == req.lead_id, Lead.workspace_id == workspace.id)
        lead = (await db.execute(q)).scalar_one_or_none()

    if not lead:
        # Mock lead for preview
        lead = Lead(
            first_name=req.sample_data.get("first_name", "Sarah") if req.sample_data else "Sarah",
            last_name=req.sample_data.get("last_name", "Connor") if req.sample_data else "Connor",
            company=req.sample_data.get("company", "Cyberdyne Systems") if req.sample_data else "Cyberdyne Systems",
            job_title=req.sample_data.get("job_title", "Director of IT") if req.sample_data else "Director of IT",
            email="sarah.connor@example.com",
        )

    rendered_subject = campaign_service.personalize_text(req.subject, lead, "https://app.leadflow.ai/unsubscribe/preview-token")
    rendered_body = campaign_service.personalize_text(req.body_html, lead, "https://app.leadflow.ai/unsubscribe/preview-token")

    return {
        "rendered_subject": rendered_subject,
        "rendered_body": rendered_body,
        "recipient_email": lead.email,
        "first_name": lead.first_name,
        "company": lead.company,
    }
