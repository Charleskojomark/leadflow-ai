from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field

class LeadBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    source: Optional[str] = "manual"
    source_url: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)
    notes: Optional[str] = None

class LeadCreate(LeadBase):
    lead_list_ids: Optional[List[str]] = Field(default_factory=list)

class LeadUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    tags: Optional[List[str]] = None
    validation_status: Optional[str] = None
    outreach_status: Optional[str] = None
    notes: Optional[str] = None

class LeadResponse(LeadBase):
    id: str
    workspace_id: str
    normalized_email: str
    validation_status: str
    validation_details: Optional[Dict[str, Any]] = None
    last_validated_at: Optional[datetime] = None
    outreach_status: str
    created_at: datetime
    updated_at: datetime
    list_ids: Optional[List[str]] = Field(default_factory=list)

class LeadListCreate(BaseModel):
    name: str
    description: Optional[str] = None

class LeadListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class LeadListResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime

class BulkAssignListRequest(BaseModel):
    lead_ids: List[str]
    lead_list_id: str

class BulkTagRequest(BaseModel):
    lead_ids: List[str]
    tag: str
    action: str = "add" # "add" or "remove"

class BulkDeleteRequest(BaseModel):
    lead_ids: List[str]
