from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user, get_current_workspace
from app.core.encryption import decrypt_credential, encrypt_credential
from app.database import get_db, utc_now
from app.models.smtp import SMTPAccount
from app.models.user import User, Workspace
from app.schemas.smtp import (
    SMTPAccountCreate,
    SMTPAccountResponse,
    SMTPAccountUpdate,
    SMTPSendTestEmailRequest,
    SMTPTestConnectionRequest,
)
from app.services.smtp_service import smtp_service

router = APIRouter()

def smtp_to_response(acc: SMTPAccount) -> dict:
    return {
        "id": acc.id,
        "workspace_id": acc.workspace_id,
        "provider_type": acc.provider_type,
        "name": acc.name,
        "host": acc.host,
        "port": acc.port,
        "encryption": acc.encryption,
        "username": acc.username,
        "from_name": acc.from_name,
        "from_email": acc.from_email,
        "reply_to": acc.reply_to,
        "is_default": acc.is_default,
        "daily_limit": acc.daily_limit,
        "sent_today": acc.sent_today,
        "last_tested_at": acc.last_tested_at,
        "test_status": acc.test_status,
        "last_error": acc.last_error,
        "created_at": acc.created_at,
        "updated_at": acc.updated_at,
        "has_password": bool(acc.encrypted_password),
    }

@router.get("/accounts", response_model=List[SMTPAccountResponse])
async def list_smtp_accounts(
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(SMTPAccount).where(SMTPAccount.workspace_id == workspace.id).order_by(SMTPAccount.created_at.desc())
    accounts = (await db.execute(q)).scalars().all()
    return [smtp_to_response(a) for a in accounts]

@router.post("/accounts", response_model=SMTPAccountResponse)
async def create_smtp_account(
    acc_in: SMTPAccountCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    # If is_default is true, unset other defaults
    if acc_in.is_default:
        existing_defaults = await db.execute(
            select(SMTPAccount).where(SMTPAccount.workspace_id == workspace.id, SMTPAccount.is_default == True)
        )
        for a in existing_defaults.scalars().all():
            a.is_default = False

    acc = SMTPAccount(
        workspace_id=workspace.id,
        provider_type=acc_in.provider_type,
        name=acc_in.name,
        host=acc_in.host,
        port=acc_in.port,
        encryption=acc_in.encryption,
        username=acc_in.username,
        encrypted_password=encrypt_credential(acc_in.password),
        from_name=acc_in.from_name,
        from_email=acc_in.from_email,
        reply_to=acc_in.reply_to or acc_in.from_email,
        is_default=acc_in.is_default,
        daily_limit=acc_in.daily_limit,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return smtp_to_response(acc)

@router.put("/accounts/{account_id}", response_model=SMTPAccountResponse)
async def update_smtp_account(
    account_id: str,
    acc_in: SMTPAccountUpdate,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(SMTPAccount).where(SMTPAccount.id == account_id, SMTPAccount.workspace_id == workspace.id)
    acc = (await db.execute(q)).scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="SMTP account not found")

    if acc_in.is_default:
        existing_defaults = await db.execute(
            select(SMTPAccount).where(
                SMTPAccount.workspace_id == workspace.id,
                SMTPAccount.id != account_id,
                SMTPAccount.is_default == True,
            )
        )
        for a in existing_defaults.scalars().all():
            a.is_default = False

    for field, val in acc_in.model_dump(exclude_unset=True).items():
        if field == "password":
            if val:
                acc.encrypted_password = encrypt_credential(val)
        else:
            setattr(acc, field, val)

    acc.updated_at = utc_now()
    await db.commit()
    await db.refresh(acc)
    return smtp_to_response(acc)

@router.delete("/accounts/{account_id}")
async def delete_smtp_account(
    account_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    q = select(SMTPAccount).where(SMTPAccount.id == account_id, SMTPAccount.workspace_id == workspace.id)
    acc = (await db.execute(q)).scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="SMTP account not found")
    await db.delete(acc)
    await db.commit()
    return {"message": "SMTP account deleted successfully"}

@router.post("/test-connection")
async def test_smtp_connection(
    req: SMTPTestConnectionRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    host = req.host
    port = req.port
    encryption = req.encryption
    username = req.username
    password = req.password

    account = None
    if req.smtp_account_id:
        q = select(SMTPAccount).where(SMTPAccount.id == req.smtp_account_id, SMTPAccount.workspace_id == workspace.id)
        account = (await db.execute(q)).scalar_one_or_none()
        if account:
            host = host or account.host
            port = port or account.port
            encryption = encryption or account.encryption
            username = username or account.username
            if not password:
                password = account.encrypted_password

    is_already_encrypted = bool(req.smtp_account_id and not req.password)
    success, msg, diag = smtp_service.test_connection(
        host=host,
        port=port,
        encryption=encryption,
        username=username,
        password_or_encrypted=password or "",
        is_already_encrypted=is_already_encrypted,
    )

    if account:
        account.last_tested_at = utc_now()
        account.test_status = "success" if success else "failed"
        account.last_error = None if success else msg
        await db.commit()

    return {
        "success": success,
        "message": msg,
        "diagnostics": diag,
    }

@router.post("/send-test-email")
async def send_test_email(
    req: SMTPSendTestEmailRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
):
    account = None
    if req.smtp_account_id:
        q = select(SMTPAccount).where(SMTPAccount.id == req.smtp_account_id, SMTPAccount.workspace_id == workspace.id)
        account = (await db.execute(q)).scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="SMTP account not found")

    host = req.host or (account.host if account else "")
    port = req.port or (account.port if account else 587)
    encryption = req.encryption or (account.encryption if account else "tls")
    username = req.username or (account.username if account else "")
    password = req.password or (account.encrypted_password if account else "")
    from_name = req.from_name or (account.from_name if account else "LeadFlow AI")
    from_email = req.from_email or (account.from_email if account else username)

    if not host or not username or not password or not from_email:
        raise HTTPException(status_code=400, detail="Missing required SMTP configuration parameters")

    is_already_encrypted = bool(account and not req.password)

    test_html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #28334D;border-radius:8px;background:#151C32;color:#F8FAFC;">
        <h2 style="color:#7C5CFC;margin-top:0;">LeadFlow AI Test Delivery</h2>
        <p>This is a verification email sent from your connected SMTP account (<strong>{host}</strong>).</p>
        <p>If you are seeing this message, your SMTP credentials and TLS encryption handshake are operational.</p>
        <hr style="border:0;border-top:1px solid #28334D;margin:20px 0;"/>
        <p style="font-size:12px;color:#94A3B8;">Timestamp: {datetime.now(timezone.utc).isoformat()}</p>
    </div>
    """

    success, msg, code = smtp_service.send_email(
        host=host,
        port=port,
        encryption=encryption,
        username=username,
        password_or_encrypted=password,
        from_name=from_name,
        from_email=from_email,
        to_email=req.recipient_email,
        subject="[LeadFlow AI] SMTP Connection Test Message",
        body_html=test_html,
        is_already_encrypted=is_already_encrypted,
    )

    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to send test email: {msg}")

    return {
        "success": True,
        "message": f"Test email successfully sent to {req.recipient_email}",
        "code": code,
    }
