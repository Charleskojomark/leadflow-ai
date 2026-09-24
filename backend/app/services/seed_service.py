import json
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.encryption import encrypt_credential
from app.core.security import get_password_hash
from app.database import utc_now
from app.models.campaign import Campaign, CampaignRecipient, EmailEvent, EmailTemplate
from app.models.extraction import ExtractionJob, ExtractionResult
from app.models.lead import Lead, LeadList, LeadListMember
from app.models.smtp import SMTPAccount
from app.models.suppression import SuppressionEntry
from app.models.user import User, Workspace, WorkspaceMember

async def seed_initial_demo_data(db: AsyncSession) -> None:
    """Populates the database with realistic sample records if empty."""
    # Check if any user already exists
    existing = await db.execute(select(User).limit(1))
    if existing.scalar_one_or_none():
        return

    # 1. Create Default Demo User
    demo_user = User(
        email="demo@leadflow.ai",
        hashed_password=get_password_hash("DemoPassword123!"),
        full_name="Alex Morgan",
        role="admin",
        is_active=True,
        is_verified=True,
    )
    db.add(demo_user)
    await db.flush()

    # 2. Create Workspace
    workspace = Workspace(
        name="LeadFlow Growth Hub",
        owner_id=demo_user.id,
        plan="growth",
        monthly_email_quota=10000,
        emails_sent_this_month=248,
    )
    db.add(workspace)
    await db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=demo_user.id,
        role="owner",
    )
    db.add(member)

    # 3. Create Sample SMTP Account (Local Test Provider)
    smtp_account = SMTPAccount(
        workspace_id=workspace.id,
        provider_type="custom",
        name="Primary Outreach Gateway",
        host="smtp.example.com",
        port=587,
        encryption="tls",
        username="outreach@leadflow.ai",
        encrypted_password=encrypt_credential("demo-smtp-secret-pass"),
        from_name="Alex Morgan",
        from_email="alex@leadflow.ai",
        reply_to="alex@leadflow.ai",
        is_default=True,
        daily_limit=500,
        sent_today=42,
        test_status="success",
        last_tested_at=utc_now(),
    )
    db.add(smtp_account)
    await db.flush()

    # 4. Create Lead Lists
    saas_list = LeadList(
        workspace_id=workspace.id,
        name="B2B SaaS Founders & Execs",
        description="High-growth software companies & executives for partnership outreach",
    )
    agency_list = LeadList(
        workspace_id=workspace.id,
        name="Digital Marketing Agencies",
        description="Selected digital agencies and consulting firms",
    )
    db.add_all([saas_list, agency_list])
    await db.flush()

    # 5. Create Sample Leads
    sample_leads_data = [
        {
            "email": "sarah.chen@cloudscale.io",
            "first_name": "Sarah",
            "last_name": "Chen",
            "full_name": "Sarah Chen",
            "company": "CloudScale Systems",
            "job_title": "VP of Engineering",
            "department": "Engineering",
            "website": "https://cloudscale.io",
            "source": "extraction",
            "source_url": "https://cloudscale.io/leadership",
            "validation_status": "mx_valid",
            "validation_details": json.dumps({"mx_records": ["aspmx.l.google.com"], "syntax_valid": True}),
            "outreach_status": "contacted",
            "tags": json.dumps(["saas", "enterprise", "cloud"]),
            "lists": [saas_list.id],
        },
        {
            "email": "marcus.vance@vanguarddigital.com",
            "first_name": "Marcus",
            "last_name": "Vance",
            "full_name": "Marcus Vance",
            "company": "Vanguard Digital Media",
            "job_title": "Managing Director",
            "department": "Executive",
            "website": "https://vanguarddigital.com",
            "source": "extraction",
            "source_url": "https://vanguarddigital.com/team",
            "validation_status": "mx_valid",
            "validation_details": json.dumps({"mx_records": ["mail.vanguarddigital.com"], "syntax_valid": True}),
            "outreach_status": "replied",
            "tags": json.dumps(["agency", "media", "uk"]),
            "lists": [agency_list.id],
        },
        {
            "email": "elena.rostova@fintechpulse.co",
            "first_name": "Elena",
            "last_name": "Rostova",
            "full_name": "Elena Rostova",
            "company": "Fintech Pulse",
            "job_title": "Head of Partnerships",
            "department": "Business Development",
            "website": "https://fintechpulse.co",
            "source": "csv_import",
            "source_url": "https://fintechpulse.co/about",
            "validation_status": "mx_valid",
            "validation_details": json.dumps({"mx_records": ["outlook.office365.com"], "syntax_valid": True}),
            "outreach_status": "contacted",
            "tags": json.dumps(["fintech", "partnerships"]),
            "lists": [saas_list.id],
        },
        {
            "email": "david.k@nexussolutions.net",
            "first_name": "David",
            "last_name": "Kim",
            "full_name": "David Kim",
            "company": "Nexus Solutions",
            "job_title": "CTO & Co-Founder",
            "department": "Executive",
            "website": "https://nexussolutions.net",
            "source": "extraction",
            "source_url": "https://nexussolutions.net/about",
            "validation_status": "domain_valid",
            "validation_details": json.dumps({"syntax_valid": True, "message": "Domain valid"}),
            "outreach_status": "uncontacted",
            "tags": json.dumps(["tech", "founder"]),
            "lists": [saas_list.id],
        },
        {
            "email": "contact@olddomain-abandoned.net",
            "first_name": "Inactive",
            "last_name": "Lead",
            "full_name": "Inactive Lead",
            "company": "Old Domain Corp",
            "job_title": "Director",
            "department": "Operations",
            "website": "https://olddomain-abandoned.net",
            "source": "manual",
            "validation_status": "invalid",
            "validation_details": json.dumps({"syntax_valid": True, "message": "Domain not found"}),
            "outreach_status": "bounced",
            "tags": json.dumps(["archive"]),
            "lists": [saas_list.id],
        },
        {
            "email": "press@hypergrowth.tech",
            "first_name": "Media",
            "last_name": "Desk",
            "full_name": "HyperGrowth Media",
            "company": "HyperGrowth Tech",
            "job_title": "Communications",
            "department": "PR",
            "website": "https://hypergrowth.tech",
            "source": "extraction",
            "source_url": "https://hypergrowth.tech/press",
            "validation_status": "risky",
            "validation_details": json.dumps({"syntax_valid": True, "is_role_account": True, "message": "Role-based email"}),
            "outreach_status": "uncontacted",
            "tags": json.dumps(["pr", "media"]),
            "lists": [saas_list.id],
        },
    ]

    created_leads = []
    for item in sample_leads_data:
        lead = Lead(
            workspace_id=workspace.id,
            email=item["email"],
            normalized_email=item["email"].lower(),
            first_name=item["first_name"],
            last_name=item["last_name"],
            full_name=item["full_name"],
            company=item["company"],
            job_title=item["job_title"],
            department=item["department"],
            website=item["website"],
            source=item["source"],
            source_url=item.get("source_url"),
            validation_status=item["validation_status"],
            validation_details=item["validation_details"],
            outreach_status=item["outreach_status"],
            tags=item["tags"],
            last_validated_at=utc_now(),
        )
        db.add(lead)
        await db.flush()
        created_leads.append(lead)

        for lid in item["lists"]:
            member = LeadListMember(lead_list_id=lid, lead_id=lead.id)
            db.add(member)

    # 6. Create Email Template
    template = EmailTemplate(
        workspace_id=workspace.id,
        name="B2B Value Partnership Intro",
        subject="Quick question regarding {{company}}'s outreach strategy",
        body_html="""<p>Hi {{first_name}},</p>
<p>I came across {{company}} while reviewing leading teams in your industry. As {{job_title}}, I imagine maintaining a steady stream of qualified pipeline is a top priority.</p>
<p>We built LeadFlow AI to streamline lead discovery and automate verified outreach without sacrificing deliverability or personal touch.</p>
<p>Would you be open to a brief 10-minute chat this Thursday to explore if this could help your team?</p>
<p>Best regards,<br/><strong>Alex Morgan</strong><br/>LeadFlow AI</p>""",
        body_text="Hi {{first_name}},\n\nI came across {{company}} while reviewing leading teams in your industry. As {{job_title}}, I imagine maintaining a steady stream of qualified pipeline is a top priority.\n\nWe built LeadFlow AI to streamline lead discovery and automate verified outreach.\n\nWould you be open to a brief 10-minute chat this Thursday?\n\nBest regards,\nAlex Morgan",
        variables=json.dumps(["first_name", "company", "job_title"]),
    )
    db.add(template)
    await db.flush()

    # 7. Create Sample Extraction Job
    job = ExtractionJob(
        workspace_id=workspace.id,
        target_urls=json.dumps(["https://cloudscale.io", "https://vanguarddigital.com"]),
        status="completed",
        total_domains=2,
        processed_domains=2,
        pages_crawled=8,
        contacts_found=4,
        max_pages_per_domain=5,
        max_contacts_per_domain=3,
        target_department="Executive",
        started_at=utc_now() - timedelta(hours=2),
        completed_at=utc_now() - timedelta(hours=1, minutes=58),
    )
    db.add(job)
    await db.flush()

    res1 = ExtractionResult(
        job_id=job.id,
        lead_id=created_leads[0].id,
        discovered_url="https://cloudscale.io/leadership",
        email="sarah.chen@cloudscale.io",
        name="Sarah Chen",
        title="VP of Engineering",
        company="CloudScale Systems",
    )
    res2 = ExtractionResult(
        job_id=job.id,
        lead_id=created_leads[1].id,
        discovered_url="https://vanguarddigital.com/team",
        email="marcus.vance@vanguarddigital.com",
        name="Marcus Vance",
        title="Managing Director",
        company="Vanguard Digital Media",
    )
    db.add_all([res1, res2])

    # 8. Create Sample Campaign with real delivery events
    campaign = Campaign(
        workspace_id=workspace.id,
        name="Q3 SaaS Executive Outreach",
        description="Outreach to SaaS leadership exploring automated pipeline discovery",
        lead_list_id=saas_list.id,
        smtp_account_id=smtp_account.id,
        template_id=template.id,
        subject=template.subject,
        body_html=template.body_html,
        body_text=template.body_text,
        sender_name="Alex Morgan",
        sender_email="alex@leadflow.ai",
        reply_to="alex@leadflow.ai",
        status="completed",
        total_recipients=2,
        sent_count=2,
        delivered_count=2,
        bounced_count=0,
        reply_count=1,
        unsubscribe_count=0,
        started_at=utc_now() - timedelta(days=2),
        completed_at=utc_now() - timedelta(days=2, hours=-1),
    )
    db.add(campaign)
    await db.flush()

    # Add recipients and events
    rec1 = CampaignRecipient(
        campaign_id=campaign.id,
        lead_id=created_leads[0].id,
        status="delivered",
        personalized_subject="Quick question regarding CloudScale Systems's outreach strategy",
        personalized_body=template.body_html.replace("{{first_name}}", "Sarah").replace("{{company}}", "CloudScale Systems").replace("{{job_title}}", "VP of Engineering"),
        sent_at=utc_now() - timedelta(days=2),
        delivery_status_code=250,
    )
    rec2 = CampaignRecipient(
        campaign_id=campaign.id,
        lead_id=created_leads[2].id,
        status="delivered",
        personalized_subject="Quick question regarding Fintech Pulse's outreach strategy",
        personalized_body=template.body_html.replace("{{first_name}}", "Elena").replace("{{company}}", "Fintech Pulse").replace("{{job_title}}", "Head of Partnerships"),
        sent_at=utc_now() - timedelta(days=2),
        delivery_status_code=250,
    )
    db.add_all([rec1, rec2])
    await db.flush()

    # Add events across past days for delivery trend chart
    for day_offset in [5, 4, 3, 2, 1]:
        event_time = utc_now() - timedelta(days=day_offset)
        db.add(EmailEvent(
            workspace_id=workspace.id,
            campaign_id=campaign.id,
            campaign_recipient_id=rec1.id,
            lead_id=created_leads[0].id,
            event_type="delivered",
            event_data=json.dumps({"code": 250}),
            timestamp=event_time,
        ))

    # Add sample suppression entry
    db.add(SuppressionEntry(
        workspace_id=workspace.id,
        email="optout@competitor.com",
        reason="unsubscribe",
        notes="Unsubscribed from marketing sequence",
    ))

    await db.commit()
