from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class ExtractionStartRequest(BaseModel):
    urls: List[str]
    max_pages_per_domain: Optional[int] = Field(default=5, ge=1, le=15)
    max_contacts_per_domain: Optional[int] = Field(default=3, ge=1, le=10)
    target_department: Optional[str] = None
    target_country: Optional[str] = None
    add_to_list_id: Optional[str] = None

class ExtractionResultItem(BaseModel):
    id: str
    discovered_url: str
    email: str
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    validation_status: Optional[str] = "unchecked"
    lead_id: Optional[str] = None
    created_at: datetime

class ExtractionJobResponse(BaseModel):
    id: str
    workspace_id: str
    target_urls: List[str]
    status: str
    total_domains: int
    processed_domains: int
    pages_crawled: int
    contacts_found: int
    current_domain: Optional[str] = None
    max_pages_per_domain: int
    max_contacts_per_domain: int
    target_department: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    results: Optional[List[ExtractionResultItem]] = None
