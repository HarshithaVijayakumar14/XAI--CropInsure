import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from backend.app.config import settings
from backend.app.database.session import engine, Base
import backend.app.database.models # ensure models are registered
from backend.app.api import health, dashboard, claims, datasets, models, assessments, reviews, reports, auth, farmer, officer, regional, external_data

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Explainable AI Decision Support System for Transparent Crop-Insurance Claim Assessment (XAI-CropInsure)",
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc"
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root doc redirects so both /docs and /api/docs work seamlessly
@app.get("/docs", include_in_schema=False)
def redirect_docs():
    return RedirectResponse(url=f"{settings.API_PREFIX}/docs")

@app.get("/redoc", include_in_schema=False)
def redirect_redoc():
    return RedirectResponse(url=f"{settings.API_PREFIX}/redoc")

@app.get("/openapi.json", include_in_schema=False)
def redirect_openapi():
    return RedirectResponse(url=f"{settings.API_PREFIX}/openapi.json")

# Include Routers
app.include_router(auth.router, prefix=f"{settings.API_PREFIX}/auth", tags=["Authentication & User Profiles"])
app.include_router(farmer.router, prefix=f"{settings.API_PREFIX}/farmer", tags=["Farmer Scoped Interface"])
app.include_router(officer.router, prefix=f"{settings.API_PREFIX}/officer", tags=["Officer Scoped Interface"])
app.include_router(regional.router, prefix=f"{settings.API_PREFIX}/regional", tags=["Sarvam Regional Language & Voice"])
app.include_router(health.router, prefix=settings.API_PREFIX, tags=["Health"])
app.include_router(dashboard.router, prefix=settings.API_PREFIX, tags=["Dashboard"])
app.include_router(claims.router, prefix=settings.API_PREFIX, tags=["Claims"])
app.include_router(datasets.router, prefix=settings.API_PREFIX, tags=["Datasets"])
app.include_router(models.router, prefix=settings.API_PREFIX, tags=["Models"])
app.include_router(assessments.router, prefix=settings.API_PREFIX, tags=["Assessments & Explainability"])
app.include_router(reviews.router, prefix=settings.API_PREFIX, tags=["Human Review & Audit"])
app.include_router(reports.router, prefix=settings.API_PREFIX, tags=["Reports"])
app.include_router(external_data.router, prefix=settings.API_PREFIX, tags=["External Agricultural Data"])

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "message": "Welcome to XAI-CropInsure API",
        "docs_url": f"{settings.API_PREFIX}/docs",
        "health_check": f"{settings.API_PREFIX}/health"
    }

