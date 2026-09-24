from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base, generate_uuid, utc_now

class ExtractionJob(Base):
    __tablename__ = "extraction_jobs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    # JSON list of URLs or single URL submitted
    target_urls = Column(Text, nullable=False)
    # queued, running, completed, failed, cancelled
    status = Column(String(50), default="queued", index=True)
    
    total_domains = Column(Integer, default=1)
    processed_domains = Column(Integer, default=0)
    pages_crawled = Column(Integer, default=0)
    contacts_found = Column(Integer, default=0)
    current_domain = Column(String(255), nullable=True)
    
    max_pages_per_domain = Column(Integer, default=5)
    max_contacts_per_domain = Column(Integer, default=3)
    target_department = Column(String(100), nullable=True)
    target_country = Column(String(100), nullable=True)
    
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    results = relationship("ExtractionResult", back_populates="job", cascade="all, delete-orphan")

class ExtractionResult(Base):
    __tablename__ = "extraction_results"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("extraction_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    discovered_url = Column(String(1000), nullable=False)
    email = Column(String(255), nullable=False)
    name = Column(String(200), nullable=True)
    title = Column(String(200), nullable=True)
    company = Column(String(200), nullable=True)
    raw_data = Column(Text, default="{}") # JSON metadata
    created_at = Column(DateTime, default=utc_now)
    
    job = relationship("ExtractionJob", back_populates="results")
    lead = relationship("Lead")
