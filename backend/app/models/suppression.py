from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from app.database import Base, generate_uuid, utc_now

class SuppressionEntry(Base):
    __tablename__ = "suppression_entries"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    reason = Column(String(50), default="manual") # 'unsubscribe', 'hard_bounce', 'complaint', 'manual'
    source_campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    __table_args__ = (
        UniqueConstraint("workspace_id", "email", name="uq_suppression_workspace_email"),
        Index("ix_suppression_lookup", "workspace_id", "email"),
    )
