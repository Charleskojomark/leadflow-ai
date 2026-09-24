from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base, generate_uuid, utc_now

class EmailTemplate(Base):
    __tablename__ = "email_templates"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    subject = Column(String(500), nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text, nullable=True)
    variables = Column(Text, default="[]") # JSON list of supported tokens e.g. ["first_name", "company"]
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    campaigns = relationship("Campaign", back_populates="template")

class Campaign(Base):
    __tablename__ = "campaigns"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    lead_list_id = Column(String(36), ForeignKey("lead_lists.id", ondelete="SET NULL"), nullable=True, index=True)
    smtp_account_id = Column(String(36), ForeignKey("smtp_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    template_id = Column(String(36), ForeignKey("email_templates.id", ondelete="SET NULL"), nullable=True)
    
    subject = Column(String(500), nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text, nullable=True)
    sender_name = Column(String(200), nullable=False)
    sender_email = Column(String(255), nullable=False)
    reply_to = Column(String(255), nullable=True)
    
    # Status: draft, scheduled, sending, paused, completed, cancelled, failed
    status = Column(String(50), default="draft", index=True)
    daily_limit = Column(Integer, default=200)
    hourly_rate_limit = Column(Integer, default=50)
    
    total_recipients = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    bounced_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    unsubscribe_count = Column(Integer, default=0)
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    lead_list = relationship("LeadList", back_populates="campaigns")
    smtp_account = relationship("SMTPAccount", back_populates="campaigns")
    template = relationship("EmailTemplate", back_populates="campaigns")
    recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")
    events = relationship("EmailEvent", back_populates="campaign", cascade="all, delete-orphan")

class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Status: queued, sending, sent, delivered, bounced, failed, skipped, unsubscribed
    status = Column(String(50), default="queued", index=True)
    skip_reason = Column(String(255), nullable=True)
    
    personalized_subject = Column(String(500), nullable=True)
    personalized_body = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    delivery_status_code = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    
    # Idempotency and one-click unsubscribe token
    idempotency_key = Column(String(100), unique=True, index=True, nullable=False, default=generate_uuid)
    unsubscribe_token = Column(String(64), unique=True, index=True, nullable=False, default=generate_uuid)
    
    campaign = relationship("Campaign", back_populates="recipients")
    lead = relationship("Lead", back_populates="campaign_recipients")
    events = relationship("EmailEvent", back_populates="recipient", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint("campaign_id", "lead_id", name="uq_campaign_lead"),
    )

class EmailEvent(Base):
    __tablename__ = "email_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_recipient_id = Column(String(36), ForeignKey("campaign_recipients.id", ondelete="CASCADE"), nullable=True, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # sent, delivered, bounce_hard, bounce_soft, open, click, reply, unsubscribe
    event_type = Column(String(50), nullable=False, index=True)
    event_data = Column(Text, default="{}") # JSON details
    timestamp = Column(DateTime, default=utc_now, index=True)
    
    campaign = relationship("Campaign", back_populates="events")
    recipient = relationship("CampaignRecipient", back_populates="events")
