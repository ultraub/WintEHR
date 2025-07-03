"""
Teaching EMR System - Main Application
A lightweight EMR for educational purposes with FHIR and CDS Hooks support
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Import new FHIR router
from fhir_api.router import fhir_router

# Import new EMR router
from emr_api.router import emr_router

# Import Clinical Canvas router
from clinical_canvas.router import router as clinical_canvas_router

# Import legacy routers (to be migrated)
# TODO: Migrate these to use FHIR APIs
# from api.cds_hooks import cds_hooks_router
# from api.app import app_router
# from api.quality import quality_router
# from api.cql_api import router as cql_router
# from api.clinical.documentation import notes_router
# from api.clinical.orders import orders_router
# from api.clinical.inbox import inbox_router
# from api.clinical.tasks import tasks_router
# from api.clinical.catalogs import catalog_router
# from api.app.routers import allergies
# from api.app import diagnosis_codes, clinical_data, actual_patient_data
# from api import auth
# from api.imaging import router as imaging_router
# from api.dicomweb import router as dicomweb_router

# Import database components
from database import init_db, close_db

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
    allow_origins=["*"],  # Allow all origins for now (restrict in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize resources on startup."""
    await init_db()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    await close_db()

# Include routers
# from api.health import router as health_router
# app.include_router(health_router, prefix="/api", tags=["Health Check"])
app.include_router(fhir_router, tags=["FHIR R4"])  # Already has /fhir/R4 prefix
app.include_router(emr_router, tags=["EMR Extensions"])  # Already has /api/emr prefix
app.include_router(clinical_canvas_router, tags=["Clinical Canvas"])  # Already has /api/clinical-canvas prefix

# Add compatibility route for frontend auth endpoints
from emr_api.auth import router as auth_router_compat
app.include_router(auth_router_compat, prefix="/api/auth", tags=["Authentication"])
# Legacy routers - commented out for FHIR-native implementation
# TODO: Migrate these to use FHIR APIs
# app.include_router(cds_hooks_router.router, prefix="/cds-hooks", tags=["CDS Hooks"])
# app.include_router(app_router.router, prefix="/api", tags=["Application API"])
# app.include_router(quality_router.router, prefix="/api", tags=["Quality Measures"])
# app.include_router(cql_router, tags=["CQL Engine"])
# 
# # Include clinical routers
# app.include_router(notes_router.router, prefix="/api", tags=["Clinical Notes"])
# app.include_router(orders_router.router, prefix="/api", tags=["Clinical Orders"])
# app.include_router(inbox_router.router, prefix="/api", tags=["Clinical Inbox"])
# app.include_router(tasks_router.router, prefix="/api", tags=["Clinical Tasks"])
# app.include_router(catalog_router.router, prefix="/api/catalogs", tags=["Clinical Catalogs"])
# app.include_router(allergies.router, prefix="/api", tags=["Allergies"])
# app.include_router(diagnosis_codes.router, prefix="/api", tags=["Diagnosis Codes"])
# app.include_router(clinical_data.router, prefix="/api", tags=["Clinical Data"])
# app.include_router(actual_patient_data.router, prefix="/api", tags=["Actual Patient Data"])
# app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
# app.include_router(imaging_router, prefix="/api/imaging", tags=["Medical Imaging"])
# app.include_router(dicomweb_router, prefix="/api/dicomweb", tags=["DICOMweb"])

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Teaching EMR System",
        "version": "1.0.0",
        "endpoints": {
            "fhir": "/fhir/R4",
            "cds_hooks": "/cds-hooks",
            "api": "/api",
            "docs": "/docs"
        }
    }

# Health check endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/health")
async def api_health_check():
    return {"status": "healthy", "service": "MedGenEMR FHIR API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)