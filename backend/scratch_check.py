import httpx
import json

client = httpx.Client(base_url="http://127.0.0.1:8000")
res = client.post("/api/v1/auth/login", json={"email": "demo@leadflow.ai", "password": "DemoPassword123!"})
print("STATUS:", res.status_code)
data = res.json()
print("TOKEN PRESENT:", bool(data.get("access_token")))
print("USER:", data.get("user", {}).get("full_name"))
print("WORKSPACE:", data.get("user", {}).get("workspace_name"))

# Check metrics
headers = {"Authorization": f"Bearer {data['access_token']}"}
m = client.get("/api/v1/dashboard/metrics", headers=headers).json()
print("DASHBOARD METRICS:", m)
