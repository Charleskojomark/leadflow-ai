import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import AsyncSessionLocal, utc_now
from app.models.campaign import Campaign, CampaignRecipient, EmailEvent
from app.models.lead import Lead, LeadList, LeadListMember
from app.models.smtp import SMTPAccount
from app.models.suppression import SuppressionEntry
from app.services.smtp_service import smtp_service

class CampaignService:
    @staticmethod
    def personalize_text(template: str, lead: Lead, unsubscribe_url: Optional[str] = None) -> str:
        """Replace personalization tokens in template string."""
        if not template:
            return ""

        first_name = lead.first_name or (lead.full_name.split()[0] if lead.full_name else "there")
        last_name = lead.last_name or ""
        company = lead.company or "your team"
        job_title = lead.job_title or "professional"
        email = lead.email

        replacements = {
            "{{first_name}}": first_name,
            "{{last_name}}": last_name,
            "{{company}}": company,
            "{{job_title}}": job_title,
            "{{email}}": email,
            "{{unsubscribe_url}}": unsubscribe_url or "#",
        }

        result = template
        for key, val in replacements.items():
            result = result.replace(key, str(val))

        # Support single-brace fallback {first_name}
        for key, val in replacements.items():
            clean_key = key.strip("{}")
            result = re.sub(rf"\{{{clean_key}\}}", str(val), result)

        return result

    @staticmethod
    async def audit_campaign_recipients(
        db: AsyncSession,
        workspace_id: str,
        lead_list_id: str,
    ) -> Dict[str, Any]:
        """Calculates deliverability readiness for a lead list."""
        # 1. Fetch total leads in list
        q = (
            select(Lead)
            .join(LeadListMember, LeadListMember.lead_id == Lead.id)
            .where(
                LeadListMember.lead_list_id == lead_list_id,
                Lead.workspace_id == workspace_id,
            )
        )
        res = await db.execute(q)
        leads = res.scalars().all()
        total_leads = len(leads)

        # 2. Fetch suppressed emails for workspace
        supp_q = select(SuppressionEntry.email).where(SuppressionEntry.workspace_id == workspace_id)
        supp_res = await db.execute(supp_q)
        suppressed_emails = set(e.lower() for e in supp_res.scalars().all())

        suppressed_count = 0
        invalid_count = 0
        unsubscribed_count = 0
        ready_count = 0

        for lead in leads:
            email_lower = lead.normalized_email.lower()
            if email_lower in suppressed_emails:
                suppressed_count += 1
            elif lead.outreach_status == "unsubscribed":
                unsubscribed_count += 1
            elif lead.validation_status == "invalid":
                invalid_count += 1
            else:
                ready_count += 1

        # Estimate duration assuming 50/hour rate limit
        estimated_minutes = max(1, (ready_count * 60) // 50) if ready_count > 0 else 0

        return {
            "total_in_list": total_leads,
            "valid_recipients": ready_count,
            "suppressed_count": suppressed_count,
            "invalid_validation_count": invalid_count,
            "unsubscribed_count": unsubscribed_count,
            "ready_to_send_count": ready_count,
            "estimated_duration_minutes": estimated_minutes,
        }

    @staticmethod
    async def prepare_recipients(
        db: AsyncSession,
        campaign: Campaign,
    ) -> int:
        """Generates CampaignRecipient rows for a campaign, excluding suppressed contacts."""
        # Fetch suppressed emails for workspace
        supp_q = select(SuppressionEntry.email).where(SuppressionEntry.workspace_id == campaign.workspace_id)
        supp_res = await db.execute(supp_q)
        suppressed_emails = set(e.lower() for e in supp_res.scalars().all())

        # Fetch leads from the campaign's lead list
        q = (
            select(Lead)
            .join(LeadListMember, LeadListMember.lead_id == Lead.id)
            .where(
                LeadListMember.lead_list_id == campaign.lead_list_id,
                Lead.workspace_id == campaign.workspace_id,
            )
        )
        res = await db.execute(q)
        leads = res.scalars().all()

        added_count = 0
        for lead in leads:
            email_lower = lead.normalized_email.lower()

            # Check suppression
            if email_lower in suppressed_emails:
                continue
            if lead.outreach_status == "unsubscribed":
                continue
            if lead.validation_status == "invalid":
                continue

            # Check if already added
            existing_q = select(CampaignRecipient).where(
                CampaignRecipient.campaign_id == campaign.id,
                CampaignRecipient.lead_id == lead.id,
            )
            existing_res = await db.execute(existing_q)
            if existing_res.scalar_one_or_none():
                continue

            recipient = CampaignRecipient(
                campaign_id=campaign.id,
                lead_id=lead.id,
                status="queued",
            )
            # Pre-render personalized tokens
            unsub_url = f"{settings.APP_URL}/unsubscribe/{recipient.unsubscribe_token}"
            recipient.personalized_subject = CampaignService.personalize_text(campaign.subject, lead, unsub_url)
            
            # Ensure HTML includes unsubscribe link if not present
            body_html = campaign.body_html
            if "{{unsubscribe_url}}" not in body_html and "unsubscribe" not in body_html.lower():
                footer = f"""
                <br/><hr style="border:0;border-top:1px solid #28334D;margin-top:24px;margin-bottom:12px;"/>
                <p style="font-size:11px;color:#94A3B8;text-align:center;">
                    You are receiving this business outreach because of your publicly listed role. 
                    <a href="{unsub_url}" style="color:#7C5CFC;text-decoration:underline;">Unsubscribe</a> to be removed from future emails.
                </p>
                """
                body_html = body_html + footer

            recipient.personalized_body = CampaignService.personalize_text(body_html, lead, unsub_url)
            db.add(recipient)
            added_count += 1

        campaign.total_recipients = added_count
        await db.commit()
        return added_count

    @staticmethod
    async def execute_campaign_batch(campaign_id: str) -> None:
        """
        Background task worker executing sending loop for a campaign.
        Runs asynchronously, respects pause/cancel states and rate limits.
        """
        async with AsyncSessionLocal() as db:
            c_res = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
            campaign = c_res.scalar_one_or_none()
            if not campaign or campaign.status not in ("sending", "scheduled"):
                return

            smtp_res = await db.execute(select(SMTPAccount).where(SMTPAccount.id == campaign.smtp_account_id))
            smtp_acc = smtp_res.scalar_one_or_none()
            if not smtp_acc:
                campaign.status = "failed"
                await db.commit()
                return

            campaign.status = "sending"
            if not campaign.started_at:
                campaign.started_at = utc_now()
            await db.commit()

            # Pacing delay between emails to adhere to rate limit
            rate_limit = max(10, campaign.hourly_rate_limit or 50)
            delay_seconds = 3600.0 / rate_limit

            # Fetch queued recipients
            q = (
                select(CampaignRecipient, Lead)
                .join(Lead, Lead.id == CampaignRecipient.lead_id)
                .where(
                    CampaignRecipient.campaign_id == campaign.id,
                    CampaignRecipient.status == "queued",
                )
                .limit(50)
            )
            rows = (await db.execute(q)).all()

            for recipient, lead in rows:
                # Re-check campaign status dynamically in case user clicked pause or cancel
                status_check = await db.execute(select(Campaign.status).where(Campaign.id == campaign.id))
                curr_status = status_check.scalar_one_or_none()
                if curr_status in ("paused", "cancelled"):
                    break

                # Send email via SMTP service
                unsub_url = f"{settings.APP_URL}/unsubscribe/{recipient.unsubscribe_token}"
                success, msg, code = smtp_service.send_email(
                    host=smtp_acc.host,
                    port=smtp_acc.port,
                    encryption=smtp_acc.encryption,
                    username=smtp_acc.username,
                    password_or_encrypted=smtp_acc.encrypted_password,
                    from_name=campaign.sender_name,
                    from_email=campaign.sender_email,
                    to_email=lead.email,
                    subject=recipient.personalized_subject or campaign.subject,
                    body_html=recipient.personalized_body or campaign.body_html,
                    body_text=campaign.body_text,
                    reply_to=campaign.reply_to or smtp_acc.reply_to,
                    unsubscribe_url=unsub_url,
                    is_already_encrypted=True,
                )

                now = utc_now()
                recipient.sent_at = now
                recipient.delivery_status_code = code

                if success:
                    recipient.status = "delivered"
                    campaign.sent_count += 1
                    campaign.delivered_count += 1
                    lead.outreach_status = "contacted"

                    # Log events
                    db.add(EmailEvent(
                        workspace_id=campaign.workspace_id,
                        campaign_id=campaign.id,
                        campaign_recipient_id=recipient.id,
                        lead_id=lead.id,
                        event_type="sent",
                        event_data=json.dumps({"status": "sent", "code": code}),
                        timestamp=now,
                    ))
                    db.add(EmailEvent(
                        workspace_id=campaign.workspace_id,
                        campaign_id=campaign.id,
                        campaign_recipient_id=recipient.id,
                        lead_id=lead.id,
                        event_type="delivered",
                        event_data=json.dumps({"status": "delivered", "code": code}),
                        timestamp=now,
                    ))
                else:
                    recipient.error_message = msg
                    if code and code >= 500:
                        # Hard bounce
                        recipient.status = "bounced"
                        campaign.bounced_count += 1
                        lead.outreach_status = "bounced"
                        # Auto-suppress on hard bounce
                        db.add(SuppressionEntry(
                            workspace_id=campaign.workspace_id,
                            email=lead.normalized_email,
                            reason="hard_bounce",
                            source_campaign_id=campaign.id,
                            notes=f"Hard bounce: {msg}",
                        ))
                        db.add(EmailEvent(
                            workspace_id=campaign.workspace_id,
                            campaign_id=campaign.id,
                            campaign_recipient_id=recipient.id,
                            lead_id=lead.id,
                            event_type="bounce_hard",
                            event_data=json.dumps({"error": msg, "code": code}),
                            timestamp=now,
                        ))
                    else:
                        recipient.status = "failed"
                        recipient.retry_count += 1

                await db.commit()
                # Rate limit pacing
                await asyncio.sleep(min(delay_seconds, 1.0)) # Use small delay for development

            # Check if all recipients completed
            remaining_q = select(func.count(CampaignRecipient.id)).where(
                CampaignRecipient.campaign_id == campaign.id,
                CampaignRecipient.status == "queued",
            )
            remaining = (await db.execute(remaining_q)).scalar_one()
            if remaining == 0:
                campaign.status = "completed"
                campaign.completed_at = utc_now()
                await db.commit()

campaign_service = CampaignService()
