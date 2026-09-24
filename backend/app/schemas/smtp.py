from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class SMTPAccountCreate(BaseModel):
    name: str
    provider_type: str = "custom" # 'gmail', 'outlook', 'ses', 'brevo', 'custom'
    host: str
    port: int = 587
    encryption: str = "tls" # 'tls', 'ssl', 'none'
    username: str
    password: str
    from_name: str
    from_email: EmailStr
    reply_to: Optional[EmailStr] = None
    is_default: bool = False
    daily_limit: int = 500

class SMTPAccountUpdate(BaseModel):
    name: Optional[str] = None
    provider_type: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    encryption: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None # Optional: only updated if provided
    from_name: Optional[str] = None
    from_email: Optional[EmailStr] = None
    reply_to: Optional[EmailStr] = None
    is_default: Optional[bool] = None
    daily_limit: Optional[int] = None

class SMTPAccountResponse(BaseModel):
    id: str
    workspace_id: str
    provider_type: str
    name: str
    host: str
    port: int
    encryption: str
    username: str
    from_name: str
    from_email: str
    reply_to: Optional[str] = None
    is_default: bool
    daily_limit: int
    sent_today: int
    last_tested_at: Optional[datetime] = None
    test_status: str
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    has_password: bool = True

class SMTPTestConnectionRequest(BaseModel):
    host: str
    port: int
    encryption: str
    username: str
    password: Optional[str] = None
    smtp_account_id: Optional[str] = None

class SMTPSendTestEmailRequest(BaseModel):
    recipient_email: EmailStr
    smtp_account_id: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    encryption: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    from_name: Optional[str] = None
    from_email: Optional[EmailStr] = None
