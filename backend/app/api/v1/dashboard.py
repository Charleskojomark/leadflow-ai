from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user, get_current_workspace
from app.database import get_db
from app.models.campaign import Campaign, EmailEvent
from app.models.extraction import ExtractionJob
from app.models.lead import Lead
from app.models.smtp import SMTPAccount
from app.models.user import User, Workspace
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    CampaignPerformanceItem,
    DashboardMetricsResponse,
    DeliveryTrendItem,
    LeadSourceItem,
    RecentActivityItem,
    ValidationBreakdownItem,
)

router = APIRouter()

@router.get("/metrics", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    ws_id = workspace.id

    # 1. Total leads
    total_leads_q = select(func.count(Lead.id)).where(Lead.workspace_id == ws_id)
    total_leads = (await db.execute(total_leads_q)).scalar_one() or 0

    # 2. Valid emails
    valid_emails_q = select(func.count(Lead.id)).where(
        Lead.workspace_id == ws_id,
        Lead.validation_status.in_(["mx_valid", "domain_valid", "valid_format"]),
    )
    valid_emails = (await db.execute(valid_emails_q)).scalar_one() or 0

    # 3. Campaigns count & delivery stats
    camp_q = select(
        func.count(Campaign.id),
        func.coalesce(func.sum(Campaign.sent_count), 0),
        func.coalesce(func.sum(Campaign.delivered_count), 0),
        func.coalesce(func.sum(Campaign.bounced_count), 0),
    ).where(Campaign.workspace_id == ws_id)
    c_res = (await db.execute(camp_q)).one()
    campaigns_sent = c_res[0] or 0
    total_sent = c_res[1] or 0
    emails_delivered = c_res[2] or 0
    bounced_count = c_res[3] or 0

    bounce_rate = round((bounced_count / max(1, total_sent)) * 100, 1) if total_sent > 0 else 0.0

    # 4. Active campaigns
    active_q = select(func.count(Campaign.id)).where(
        Campaign.workspace_id == ws_id,
        Campaign.status == "sending",
    )
    active_campaigns = (await db.execute(active_q)).scalar_one() or 0

    return {
        "total_leads": total_leads,
        "valid_emails": valid_emails,
        "campaigns_sent": campaigns_sent,
        "emails_delivered": emails_delivered,
        "bounce_rate": bounce_rate,
        "active_campaigns": active_campaigns,
    }

@router.get("/analytics", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    days: int = Query(default=30, ge=7, le=90),
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    ws_id = workspace.id
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    # 1. Core metrics
    metrics_data = await get_dashboard_metrics(workspace=workspace, db=db)

    # 2. Delivery trend over past N days
    # Generate day intervals
    trend_map = {}
    for d in range(min(days, 14)): # Return up to 14 date points for neat chart
        day_date = (now - timedelta(days=d)).strftime("%b %d")
        trend_map[day_date] = {"sent": 0, "delivered": 0, "bounced": 0, "unsubscribed": 0}

    # Fetch email events within window
    events_q = select(EmailEvent).where(
        EmailEvent.workspace_id == ws_id,
        EmailEvent.timestamp >= cutoff,
    )
    events = (await db.execute(events_q)).scalars().all()
    for ev in events:
        day_str = ev.timestamp.strftime("%b %d")
        if day_str in trend_map:
            if ev.event_type == "sent":
                trend_map[day_str]["sent"] += 1
            elif ev.event_type == "delivered":
                trend_map[day_str]["delivered"] += 1
            elif "bounce" in ev.event_type:
                trend_map[day_str]["bounced"] += 1
            elif ev.event_type == "unsubscribe":
                trend_map[day_str]["unsubscribed"] += 1

    delivery_trends = [
        DeliveryTrendItem(date=d, **counts)
        for d, counts in reversed(list(trend_map.items()))
    ]

    # 3. Lead acquisition by source
    source_q = (
        select(Lead.source, func.count(Lead.id))
        .where(Lead.workspace_id == ws_id)
        .group_by(Lead.source)
    )
    source_rows = (await db.execute(source_q)).all()
    leads_by_source = [
        LeadSourceItem(
            source=(s or "manual").replace("_", " ").title(),
            count=cnt,
        )
        for s, cnt in source_rows
    ]

    # 4. Lead validation breakdown
    val_q = (
        select(Lead.validation_status, func.count(Lead.id))
        .where(Lead.workspace_id == ws_id)
        .group_by(Lead.validation_status)
    )
    val_rows = (await db.execute(val_q)).all()
    status_label_map = {
        "mx_valid": "MX Valid (High)",
        "domain_valid": "Domain Valid",
        "valid_format": "Syntax Valid",
        "risky": "Risky / Role Account",
        "invalid": "Invalid / Undeliverable",
        "unchecked": "Unchecked",
        "unknown": "Unknown Status",
    }
    validation_breakdown = [
        ValidationBreakdownItem(
            status=st,
            label=status_label_map.get(st, st.replace("_", " ").title()),
            count=cnt,
        )
        for st, cnt in val_rows
    ]

    # 5. Campaign performance list
    camps_q = select(Campaign).where(Campaign.workspace_id == ws_id).order_by(Campaign.created_at.desc()).limit(10)
    campaigns = (await db.execute(camps_q)).scalars().all()
    campaign_performances = [
        CampaignPerformanceItem(
            id=c.id,
            name=c.name,
            status=c.status,
            total=c.total_recipients,
            sent=c.sent_count,
            delivered=c.delivered_count,
            bounced=c.bounced_count,
            replied=c.reply_count,
            delivery_rate=round((c.delivered_count / max(1, c.sent_count)) * 100, 1) if c.sent_count > 0 else 0.0,
        )
        for c in campaigns
    ]

    # 6. Recent activity stream
    recent_activity: List[RecentActivityItem] = []

    # Recent extractions
    job_q = select(ExtractionJob).where(ExtractionJob.workspace_id == ws_id).order_by(ExtractionJob.created_at.desc()).limit(3)
    recent_jobs = (await db.execute(job_q)).scalars().all()
    for j in recent_jobs:
        recent_activity.append(
            RecentActivityItem(
                id=j.id,
                type="extraction",
                title=f"Extraction Job {j.status.capitalize()}",
                description=f"Discovered {j.contacts_found} contacts across {j.processed_domains} domains",
                timestamp=j.created_at,
                status=j.status,
            )
        )

    # Recent campaigns
    for c in campaigns[:3]:
        recent_activity.append(
            RecentActivityItem(
                id=c.id,
                type="campaign",
                title=f"Campaign '{c.name}'",
                description=f"Status: {c.status} ({c.delivered_count}/{c.total_recipients} delivered)",
                timestamp=c.updated_at or c.created_at,
                status=c.status,
            )
        )

    # Recent SMTP test
    smtp_q = select(SMTPAccount).where(SMTPAccount.workspace_id == ws_id, SMTPAccount.last_tested_at.is_not(None)).order_by(SMTPAccount.last_tested_at.desc()).limit(1)
    smtp_acc = (await db.execute(smtp_q)).scalar_one_or_none()
    if smtp_acc and smtp_acc.last_tested_at:
        recent_activity.append(
            RecentActivityItem(
                id=smtp_acc.id,
                type="smtp",
                title=f"SMTP Gateway Check: {smtp_acc.name}",
                description=f"Diagnostic result: {smtp_acc.test_status.upper()}",
                timestamp=smtp_acc.last_tested_at,
                status=smtp_acc.test_status,
            )
        )

    recent_activity.sort(key=lambda x: x.timestamp, reverse=True)

    return {
        "metrics": metrics_data,
        "delivery_trends": delivery_trends,
        "leads_by_source": leads_by_source,
        "validation_breakdown": validation_breakdown,
        "campaign_performances": campaign_performances,
        "recent_activity": recent_activity[:10],
    }
