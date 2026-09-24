import pytest
from httpx import ASGITransport, AsyncClient
from app.database import engine, Base
from app.main import app

@pytest.mark.asyncio
async def test_full_api_workflow():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

        # 2. Register user
        import uuid
        unique_email = f"test_{uuid.uuid4().hex[:8]}@leadflow.ai"
        reg_payload = {
            "email": unique_email,
            "password": "Password123!",
            "full_name": "Test User",
            "workspace_name": "Test Workspace",
        }
        reg_resp = await client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_resp.status_code == 200
        auth_data = reg_resp.json()
        token = auth_data["access_token"]
        assert token
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Get /me
        me_resp = await client.get("/api/v1/auth/me", headers=headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == unique_email

        # 4. Get dashboard metrics
        metrics_resp = await client.get("/api/v1/dashboard/metrics", headers=headers)
        assert metrics_resp.status_code == 200
        metrics = metrics_resp.json()
        assert "total_leads" in metrics
        assert "valid_emails" in metrics

        # 5. Create a lead list
        list_resp = await client.post(
            "/api/v1/leads/lists",
            json={"name": "Test Target List", "description": "For automated tests"},
            headers=headers,
        )
        assert list_resp.status_code == 200
        lead_list = list_resp.json()
        list_id = lead_list["id"]

        # 6. Create a lead and assign to list
        lead_resp = await client.post(
            "/api/v1/leads",
            json={
                "email": "sarah.connor@example.com",
                "first_name": "Sarah",
                "last_name": "Connor",
                "company": "Tech Corp",
                "job_title": "CTO",
                "lead_list_ids": [list_id],
            },
            headers=headers,
        )
        assert lead_resp.status_code == 200
        lead = lead_resp.json()
        lead_id = lead["id"]
        assert lead["email"] == "sarah.connor@example.com"

        # 7. Create SMTP account and verify password is encrypted and never returned
        smtp_resp = await client.post(
            "/api/v1/smtp/accounts",
            json={
                "name": "Integration Test Gateway",
                "host": "smtp.testserver.com",
                "port": 587,
                "encryption": "tls",
                "username": "tester@testserver.com",
                "password": "SuperSecretPassword123!",
                "from_name": "Test Sender",
                "from_email": "tester@testserver.com",
                "is_default": True,
            },
            headers=headers,
        )
        assert smtp_resp.status_code == 200
        smtp_acc = smtp_resp.json()
        smtp_id = smtp_acc["id"]
        assert "password" not in smtp_acc
        assert "encrypted_password" not in smtp_acc
        assert smtp_acc["has_password"] is True

        # 8. Add suppression entry
        supp_resp = await client.post(
            "/api/v1/suppression",
            json={"email": "blocked@example.com", "reason": "manual"},
            headers=headers,
        )
        assert supp_resp.status_code == 200
        assert supp_resp.json()["email"] == "blocked@example.com"

        # 9. Create Campaign
        camp_resp = await client.post(
            "/api/v1/campaigns",
            json={
                "name": "Q4 Outreach Campaign",
                "lead_list_id": list_id,
                "smtp_account_id": smtp_id,
                "subject": "Hello {{first_name}} from LeadFlow",
                "body_html": "<p>Hi {{first_name}}, love what {{company}} is building.</p>",
                "sender_name": "Test Sender",
                "sender_email": "tester@testserver.com",
            },
            headers=headers,
        )
        assert camp_resp.status_code == 200
        campaign = camp_resp.json()
        camp_id = campaign["id"]

        # 10. Audit Campaign
        audit_resp = await client.post(f"/api/v1/campaigns/{camp_id}/audit", headers=headers)
        assert audit_resp.status_code == 200
        audit = audit_resp.json()
        assert audit["total_in_list"] == 1
        assert audit["ready_to_send_count"] == 1

        # 11. Preview email personalization
        prev_resp = await client.post(
            "/api/v1/campaigns/preview-email",
            json={
                "subject": "Greetings {{first_name}}!",
                "body_html": "<p>Hello {{first_name}} at {{company}}</p>",
                "lead_id": lead_id,
            },
            headers=headers,
        )
        assert prev_resp.status_code == 200
        prev_data = prev_resp.json()
        assert prev_data["rendered_subject"] == "Greetings Sarah!"
        assert "Hello Sarah at Tech Corp" in prev_data["rendered_body"]
