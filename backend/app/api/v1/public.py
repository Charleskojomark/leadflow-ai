import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, utc_now
from app.models.campaign import Campaign, CampaignRecipient, EmailEvent
from app.models.lead import Lead
from app.models.suppression import SuppressionEntry

router = APIRouter()

@router.get("/unsubscribe/{token}", response_class=HTMLResponse)
@router.post("/unsubscribe/{token}")
async def handle_unsubscribe(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(CampaignRecipient, Campaign, Lead)
        .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
        .join(Lead, Lead.id == CampaignRecipient.lead_id)
        .where(CampaignRecipient.unsubscribe_token == token)
    )
    res = (await db.execute(q)).one_or_none()
    if not res:
        return HTMLResponse(
            content="""
            <html>
                <body style="font-family:sans-serif;background:#0B1020;color:#F8FAFC;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                    <div style="background:#151C32;padding:32px;border:1px solid #28334D;border-radius:12px;max-width:440px;text-align:center;">
                        <h2 style="color:#F87171;margin-top:0;">Invalid or Expired Link</h2>
                        <p style="color:#94A3B8;">The unsubscribe link appears to be invalid or has expired.</p>
                    </div>
                </body>
            </html>
            """,
            status_code=400,
        )

    recipient, campaign, lead = res
    now = utc_now()

    # 1. Update recipient status
    recipient.status = "unsubscribed"

    # 2. Update lead status
    lead.outreach_status = "unsubscribed"

    # 3. Add to suppression table if not already there
    supp_q = select(SuppressionEntry).where(
        SuppressionEntry.workspace_id == campaign.workspace_id,
        SuppressionEntry.email == lead.normalized_email,
    )
    if not (await db.execute(supp_q)).scalar_one_or_none():
        db.add(SuppressionEntry(
            workspace_id=campaign.workspace_id,
            email=lead.normalized_email,
            reason="unsubscribe",
            source_campaign_id=campaign.id,
            notes=f"One-click unsubscribe from campaign: {campaign.name}",
        ))

    # 4. Record event
    db.add(EmailEvent(
        workspace_id=campaign.workspace_id,
        campaign_id=campaign.id,
        campaign_recipient_id=recipient.id,
        lead_id=lead.id,
        event_type="unsubscribe",
        event_data=json.dumps({"token": token, "email": lead.email}),
        timestamp=now,
    ))

    campaign.unsubscribe_count += 1
    await db.commit()

    return HTMLResponse(
        content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Unsubscribed — LeadFlow AI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background-color: #0B1020;
                    color: #F8FAFC;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 20px;
                    box-sizing: border-box;
                }}
                .card {{
                    background-color: #151C32;
                    border: 1px solid #28334D;
                    border-radius: 12px;
                    padding: 36px 32px;
                    max-width: 480px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }}
                .badge {{
                    display: inline-block;
                    background: rgba(45, 212, 191, 0.15);
                    color: #2DD4BF;
                    border: 1px solid rgba(45, 212, 191, 0.3);
                    border-radius: 20px;
                    padding: 4px 14px;
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 16px;
                }}
                h1 {{
                    font-size: 22px;
                    margin: 0 0 12px 0;
                    color: #F8FAFC;
                }}
                p {{
                    color: #94A3B8;
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 0 0 20px 0;
                }}
                .email-highlight {{
                    background: #1C2540;
                    padding: 8px 14px;
                    border-radius: 6px;
                    color: #7C5CFC;
                    font-family: monospace;
                    display: inline-block;
                }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="badge">Unsubscribed Successfully</div>
                <h1>You have been removed</h1>
                <p>We've updated our records and added your email to the global suppression list. You will not receive any further automated outreach emails from this sender.</p>
                <div class="email-highlight">{lead.email}</div>
            </div>
        </body>
        </html>
        """
    )
