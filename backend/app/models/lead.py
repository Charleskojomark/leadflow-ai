from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base, generate_uuid, utc_now

class Lead(Base):
    __tablename__ = "leads"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    normalized_email = Column(String(255), nullable=False, index=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    full_name = Column(String(200), nullable=True)
    company = Column(String(200), nullable=True)
    job_title = Column(String(200), nullable=True)
    department = Column(String(100), nullable=True)
    website = Column(String(500), nullable=True)
    industry = Column(String(150), nullable=True)
    country = Column(String(100), nullable=True)
    source = Column(String(50), default="extraction") # 'extraction', 'csv_import', 'manual', 'api'
    source_url = Column(String(1000), nullable=True)
    tags = Column(Text, default="[]") # JSON-serialized list of strings
    
    # Validation status
    # unchecked, valid_format, domain_valid, mx_valid, risky, invalid, unknown
    validation_status = Column(String(50), default="unchecked", index=True)
    validation_details = Column(Text, default="{}") # JSON details: mx_records, error, checked_at
    last_validated_at = Column(DateTime, nullable=True)
    
    # Outreach status
    # uncontacted, queued, contacted, opened, replied, bounced, unsubscribed
    outreach_status = Column(String(50), default="uncontacted", index=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    # Relationship to list memberships
    list_memberships = relationship("LeadListMember", back_populates="lead", cascade="all, delete-orphan")
    campaign_recipients = relationship("CampaignRecipient", back_populates="lead", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint("workspace_id", "normalized_email", name="uq_lead_workspace_email"),
        Index("ix_lead_workspace_validation", "workspace_id", "validation_status"),
        Index("ix_lead_workspace_outreach", "workspace_id", "outreach_status"),
    )

class LeadList(Base):
    __tablename__ = "lead_lists"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    members = relationship("LeadListMember", back_populates="lead_list", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="lead_list")

class LeadListMember(Base):
    __tablename__ = "lead_list_members"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    lead_list_id = Column(String(36), ForeignKey("lead_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    added_at = Column(DateTime, default=utc_now)
    
    lead_list = relationship("LeadList", back_populates="members")
    lead = relationship("Lead", back_populates="list_memberships")
    
    __table_args__ = (
        UniqueConstraint("lead_list_id", "lead_id", name="uq_lead_list_member"),
    )
