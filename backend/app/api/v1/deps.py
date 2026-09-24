from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import User, Workspace, WorkspaceMember

security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )
    return user

async def get_current_workspace(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Workspace:
    # First check if user owns a workspace
    result = await db.execute(select(Workspace).where(Workspace.owner_id == user.id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        # Check membership
        member_res = await db.execute(
            select(WorkspaceMember).where(WorkspaceMember.user_id == user.id)
        )
        membership = member_res.scalar_one_or_none()
        if membership:
            ws_res = await db.execute(select(Workspace).where(Workspace.id == membership.workspace_id))
            workspace = ws_res.scalar_one_or_none()
    if not workspace:
        # Create a default workspace for this user if somehow missing
        workspace = Workspace(
            name=f"{user.full_name or 'My'} Workspace",
            owner_id=user.id,
            plan="starter",
            monthly_email_quota=2500,
        )
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)
    return workspace
