from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    variables: Optional[List[str]] = Field(default_factory=lambda: ["first_name", "company", "job_title"])

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    variables: Optional[List[str]] = None

class EmailTemplateResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    variables: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    lead_list_id: str
    smtp_account_id: str
    template_id: Optional[str] = None
    subject: str
    body_html: str
    body_text: Optional[str] = None
    sender_name: str
    sender_email: EmailStr
    reply_to: Optional[EmailStr] = None
    daily_limit: Optional[int] = 200
    hourly_rate_limit: Optional[int] = 50

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    lead_list_id: Optional[str] = None
    smtp_account_id: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    sender_name: Optional[str] = None
    sender_email: Optional[EmailStr] = None
    reply_to: Optional[EmailStr] = None
    daily_limit: Optional[int] = None
    hourly_rate_limit: Optional[int] = None

class CampaignRecipientResponse(BaseModel):
    id: str
    campaign_id: str
    lead_id: str
    email: str
    name: Optional[str] = None
    company: Optional[str] = None
    status: str
    skip_reason: Optional[str] = None
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None

class CampaignResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    lead_list_id: Optional[str] = None
    lead_list_name: Optional[str] = None
    smtp_account_id: Optional[str] = None
    smtp_account_name: Optional[str] = None
    template_id: Optional[str] = None
    subject: str
    body_html: str
    body_text: Optional[str] = None
    sender_name: str
    sender_email: str
    reply_to: Optional[str] = None
    status: str
    daily_limit: int
    hourly_rate_limit: int
    total_recipients: int
    sent_count: int
    delivered_count: int
    bounced_count: int
    reply_count: int
    unsubscribe_count: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class CampaignAuditPreview(BaseModel):
    total_in_list: int
    valid_recipients: int
    suppressed_count: int
    invalid_validation_count: int
    unsubscribed_count: int
    ready_to_send_count: int
    estimated_duration_minutes: int

class CampaignPreviewEmailRequest(BaseModel):
    subject: str
    body_html: str
    lead_id: Optional[str] = None
    sample_data: Optional[Dict[str, str]] = None
