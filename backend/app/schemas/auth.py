from typing import Optional
from pydantic import BaseModel, EmailStr

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    workspace_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    workspace_id: str
    workspace_name: str
    plan: str
    monthly_quota: int
    emails_sent_month: int

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
