from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.config import settings
from app.database import AsyncSessionLocal, Base, engine
from app.models import *  # Ensure all models are registered
from app.services.seed_service import seed_initial_demo_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed demo data if database is new
    async with AsyncSessionLocal() as session:
        await seed_initial_demo_data(session)

    yield

app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    version="1.0.0",
    description="Production-grade Lead Generation, Contact Discovery & Cold Outreach Email API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development & Next.js local proxies
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
    }

@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "documentation": "/docs",
        "status": "online",
    }
