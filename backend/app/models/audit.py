from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from app.database import Base, generate_uuid, utc_now

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False) # 'extraction_start', 'campaign_launch', 'smtp_test', etc.
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    ip_address = Column(String(50), nullable=True)
    details = Column(Text, default="{}") # JSON details
    created_at = Column(DateTime, default=utc_now, index=True)
