from fastapi import APIRouter
from app.api.v1 import auth, dashboard, extraction, leads, public, smtp, campaigns, suppression

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard & Analytics"])
api_router.include_router(leads.router, prefix="/leads", tags=["Leads & Lists"])
api_router.include_router(extraction.router, prefix="/extraction", tags=["Lead Discovery"])
api_router.include_router(smtp.router, prefix="/smtp", tags=["SMTP Integration"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns & Templates"])
api_router.include_router(suppression.router, prefix="/suppression", tags=["Suppression List"])
api_router.include_router(public.router, prefix="/public", tags=["Public Compliance"])
