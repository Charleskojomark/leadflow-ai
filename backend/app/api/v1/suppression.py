from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user, get_current_workspace
from app.database import get_db, utc_now
from app.models.suppression import SuppressionEntry
from app.models.user import User, Workspace

router = APIRouter()

class SuppressionCreate(BaseModel):
    email: EmailStr
    reason: Optional[str] = "manual"
    notes: Optional[str] = None

class SuppressionResponse(BaseModel):
    id: str
    workspace_id: str
    email: str
    reason: str
    notes: Optional[str] = None
    created_at: datetime

@router.get("", response_model=List[SuppressionResponse])
async def list_suppression(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(SuppressionEntry).where(SuppressionEntry.workspace_id == workspace.id)
    if search:
        q = q.where(SuppressionEntry.email.ilike(f"%{search}%"))
    q = q.order_by(SuppressionEntry.created_at.desc()).offset(skip).limit(limit)
    entries = (await db.execute(q)).scalars().all()
    return [
        {
            "id": e.id,
            "workspace_id": e.workspace_id,
            "email": e.email,
            "reason": e.reason,
            "notes": e.notes,
            "created_at": e.created_at,
        }
        for e in entries
    ]

@router.post("", response_model=SuppressionResponse)
async def add_suppression(
    entry_in: SuppressionCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    norm_email = entry_in.email.lower().strip()
    existing = await db.execute(
        select(SuppressionEntry).where(
            SuppressionEntry.workspace_id == workspace.id,
            SuppressionEntry.email == norm_email,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email is already suppressed")

    entry = SuppressionEntry(
        workspace_id=workspace.id,
        email=norm_email,
        reason=entry_in.reason or "manual",
        notes=entry_in.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {
        "id": entry.id,
        "workspace_id": entry.workspace_id,
        "email": entry.email,
        "reason": entry.reason,
        "notes": entry.notes,
        "created_at": entry.created_at,
    }

@router.delete("/{entry_id}")
async def remove_suppression(
    entry_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(SuppressionEntry).where(SuppressionEntry.id == entry_id, SuppressionEntry.workspace_id == workspace.id)
    entry = (await db.execute(q)).scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Suppression entry not found")
    await db.delete(entry)
    await db.commit()
    return {"message": "Suppression entry removed"}
