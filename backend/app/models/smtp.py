from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base, generate_uuid, utc_now

class SMTPAccount(Base):
    __tablename__ = "smtp_accounts"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_type = Column(String(50), default="custom") # 'gmail', 'outlook', 'ses', 'brevo', 'custom'
    name = Column(String(200), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, default=587)
    encryption = Column(String(20), default="tls") # 'tls' (STARTTLS), 'ssl', 'none'
    username = Column(String(255), nullable=False)
    encrypted_password = Column(Text, nullable=False)
    
    from_name = Column(String(200), nullable=False)
    from_email = Column(String(255), nullable=False)
    reply_to = Column(String(255), nullable=True)
    
    is_default = Column(Boolean, default=False)
    daily_limit = Column(Integer, default=500)
    sent_today = Column(Integer, default=0)
    
    last_tested_at = Column(DateTime, nullable=True)
    test_status = Column(String(50), default="untested") # 'untested', 'success', 'failed'
    last_error = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    campaigns = relationship("Campaign", back_populates="smtp_account")
