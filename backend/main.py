"""
Teaching EMR System - Main Application
A lightweight EMR for educational purposes with FHIR and CDS Hooks support
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from api.fhir import fhir_router
from api.cds_hooks import cds_hooks_router
from api.app import app_router
from api.quality import quality_router
from api.clinical.documentation import notes_router
from api.clinical.orders import orders_router
from api.clinical.inbox import inbox_router
from api.clinical.tasks import tasks_router
from api.clinical.catalogs import catalog_router
from api.app.routers import allergies
from api import auth
from database.database import engine, Base
# Import all models so they get registered with Base
from models.session import UserSession, PatientProviderAssignment

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Teaching EMR System",
    description="A modern EMR system for teaching clinical workflows, FHIR, and CDS Hooks",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from api.health import router as health_router
app.include_router(health_router, prefix="/api", tags=["Health Check"])
app.include_router(fhir_router.router, prefix="/fhir", tags=["FHIR R4"])
app.include_router(cds_hooks_router.router, prefix="/cds-hooks", tags=["CDS Hooks"])
app.include_router(app_router.router, prefix="/api", tags=["Application API"])
app.include_router(quality_router.router, prefix="/api", tags=["Quality Measures"])

# Include clinical routers
app.include_router(notes_router.router, prefix="/api", tags=["Clinical Notes"])
app.include_router(orders_router.router, prefix="/api", tags=["Clinical Orders"])
app.include_router(inbox_router.router, prefix="/api", tags=["Clinical Inbox"])
app.include_router(tasks_router.router, prefix="/api", tags=["Clinical Tasks"])
app.include_router(catalog_router.router, prefix="/api/catalogs", tags=["Clinical Catalogs"])
app.include_router(allergies.router, prefix="/api", tags=["Allergies"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Teaching EMR System",
        "version": "1.0.0",
        "endpoints": {
            "fhir": "/fhir",
            "cds_hooks": "/cds-hooks",
            "api": "/api",
            "docs": "/docs"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)