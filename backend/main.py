"""
Teaching EMR System - Main Application
A lightweight EMR for educational purposes with FHIR and CDS Hooks support
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Import FHIR router (consolidated with all Phase 1-3 features)
from fhir_api.router import fhir_router

# Import new EMR router
from emr_api.router import emr_router

# Import Clinical Canvas router
from clinical_canvas.router import router as clinical_canvas_router

# Import WebSocket router
from api.websocket.websocket_router import router as websocket_router

# Import FHIR content negotiation middleware
from fhir_api.content_negotiation import content_negotiation_middleware

# Import legacy routers (to be migrated)
# TODO: Migrate these to use FHIR APIs
# Import auth router
from api import auth

# Import routers needed for CDS hooks
# from api.app import actual_patient_data  # TODO: Create this module

# Import CDS Hooks router
from api.cds_hooks import cds_hooks_router

# Import UI Composer router
from api.ui_composer import router as ui_composer_router
# from api.app import app_router
# from api.quality import quality_router
# from api.cql_api import router as cql_router
# from api.clinical.documentation import notes_router
# from api.clinical.orders import orders_router
# from api.clinical.inbox import inbox_router
# from api.clinical.tasks import tasks_router
# from api.clinical.catalogs import catalog_router
# from api.app.routers import allergies
# from api.app import diagnosis_codes, clinical_data
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

# Add FHIR content negotiation middleware
@app.middleware("http")
async def add_content_negotiation(request, call_next):
    return await content_negotiation_middleware(request, call_next)

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

# Add multi-version FHIR router
from api.fhir.version_router import router as version_router
app.include_router(version_router, tags=["FHIR Multi-Version"])

# Add content negotiation endpoints
from api.fhir.version_router import version_aware_router
app.include_router(version_aware_router.router, tags=["FHIR Content Negotiation"])
app.include_router(emr_router, tags=["EMR Extensions"])  # Already has /api/emr prefix
app.include_router(clinical_canvas_router, tags=["Clinical Canvas"])  # Already has /api/clinical-canvas prefix

# Add compatibility routes for frontend
from emr_api.auth import router as auth_router_compat
app.include_router(auth_router_compat, prefix="/api/auth", tags=["Authentication"])

# Add FHIR-based authentication
from api.fhir_auth import router as fhir_auth_router
app.include_router(fhir_auth_router, tags=["FHIR Authentication"])

# Add authentication migration support
from api.auth_migration import router as auth_migration_router
app.include_router(auth_migration_router, tags=["Authentication Migration"])

# Add WebSocket support
app.include_router(websocket_router, prefix="/api", tags=["WebSocket"])

# Add new API routers for missing functionality
from routers.catalogs import router as catalogs_router
from routers.catalog_extraction import router as catalog_extraction_router
from routers.clinical_tasks import router as clinical_tasks_router
from routers.clinical_alerts import router as clinical_alerts_router
from routers.quality_measures import router as quality_measures_router
from routers.imaging_studies import router as imaging_studies_router

app.include_router(catalogs_router, tags=["Clinical Catalogs"])
app.include_router(catalog_extraction_router, tags=["Catalog Extraction"])
app.include_router(clinical_tasks_router, tags=["Clinical Tasks"])
app.include_router(clinical_alerts_router, tags=["Clinical Alerts"])
app.include_router(quality_measures_router, tags=["Quality Measures"])
app.include_router(imaging_studies_router, tags=["Imaging Studies"])

# Legacy API compatibility layers removed - frontend now uses FHIR APIs directly
# Legacy routers - commented out for FHIR-native implementation
# Include CDS Hooks router
from api.cds_hooks.cds_hooks_router import router as cds_hooks_router
app.include_router(cds_hooks_router, prefix="/cds-hooks", tags=["CDS Hooks"])

# Include UI Composer router
app.include_router(ui_composer_router, tags=["UI Composer"])

# Include Notifications router
from api.notifications import router as notifications_router
app.include_router(notifications_router, prefix="/fhir/R4", tags=["Notifications"])
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
# Include auth routers (both legacy and enhanced)
app.include_router(auth.router, prefix="/api/auth/legacy", tags=["Legacy Authentication"])

# Include enhanced auth with optional JWT
from api.auth_enhanced import router as auth_enhanced_router
app.include_router(auth_enhanced_router, tags=["Enhanced Authentication"])

# Include patient data API for CDS Hooks
from api.patient_data import router as patient_data_router
app.include_router(patient_data_router, prefix="/api", tags=["Patient Data"])

# Include pharmacy workflow API
from api.clinical.pharmacy.pharmacy_router import router as pharmacy_router
app.include_router(pharmacy_router, tags=["Pharmacy Workflows"])

# Include DICOM service API
from api.dicom.dicom_service import router as dicom_router
app.include_router(dicom_router, tags=["DICOM Services"])

# Include CDS Clinical Data API
from api.clinical.cds_clinical_data import router as cds_clinical_router
app.include_router(cds_clinical_router, tags=["CDS Clinical Data"])

# Include Dynamic Catalog API
from api.clinical.dynamic_catalog_router import router as dynamic_catalog_router
app.include_router(dynamic_catalog_router, tags=["Dynamic Clinical Catalogs"])

# Include Catalog Search API
from api.clinical.catalog_search import router as catalog_search_router
app.include_router(catalog_search_router, prefix="/api/clinical", tags=["Clinical Catalog Search"])

# Include debug router (temporary)
from api.debug_router import debug_router
app.include_router(debug_router, tags=["Debug"])

# TODO: Migrate these to use FHIR APIs
# app.include_router(allergies.router, prefix="/api", tags=["Allergies"])
# app.include_router(diagnosis_codes.router, prefix="/api", tags=["Diagnosis Codes"])
# app.include_router(clinical_data.router, prefix="/api", tags=["Clinical Data"])
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
    return {"status": "healthy", "service": "WintEHR FHIR API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)