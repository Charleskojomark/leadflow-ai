from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user, get_current_workspace
from app.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.database import get_db
from app.models.user import User, Workspace, WorkspaceMember
from app.schemas.auth import Token, UserLogin, UserRegister, UserResponse

router = APIRouter()

@router.post("/register", response_model=Token)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check existing email
    existing = await db.execute(select(User).where(User.email == user_in.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists",
        )

    # Create user
    user = User(
        email=user_in.email.lower(),
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name or user_in.email.split("@")[0].capitalize(),
        role="user",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # Create workspace
    workspace_name = user_in.workspace_name or f"{user.full_name}'s Workspace"
    workspace = Workspace(
        name=workspace_name,
        owner_id=user.id,
        plan="starter",
        monthly_email_quota=2500,
        emails_sent_this_month=0,
    )
    db.add(workspace)
    await db.flush()

    # Add workspace member record
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role="owner",
    )
    db.add(member)
    await db.commit()

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "workspace_id": workspace.id,
            "workspace_name": workspace.name,
            "plan": workspace.plan,
            "monthly_quota": workspace.monthly_email_quota,
            "emails_sent_month": workspace.emails_sent_this_month,
        },
    }

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == credentials.email.lower()))
    user = res.scalar_one_or_none()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Fetch workspace
    ws_res = await db.execute(select(Workspace).where(Workspace.owner_id == user.id))
    workspace = ws_res.scalar_one_or_none()
    if not workspace:
        mem_res = await db.execute(select(WorkspaceMember).where(WorkspaceMember.user_id == user.id))
        mem = mem_res.scalar_one_or_none()
        if mem:
            ws_res = await db.execute(select(Workspace).where(Workspace.id == mem.workspace_id))
            workspace = ws_res.scalar_one_or_none()

    workspace_id = workspace.id if workspace else ""
    workspace_name = workspace.name if workspace else "Default Workspace"
    plan = workspace.plan if workspace else "starter"
    quota = workspace.monthly_email_quota if workspace else 2500
    sent = workspace.emails_sent_this_month if workspace else 0

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "workspace_id": workspace_id,
            "workspace_name": workspace_name,
            "plan": plan,
            "monthly_quota": quota,
            "emails_sent_month": sent,
        },
    }

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "workspace_id": workspace.id,
        "workspace_name": workspace.name,
        "plan": workspace.plan,
        "monthly_quota": workspace.monthly_email_quota,
        "emails_sent_month": workspace.emails_sent_this_month,
    }
