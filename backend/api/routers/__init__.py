"""
Centralized Router Registration

Organizes all API routers into logical groups and provides
a single function to register them all with the FastAPI app.
"""

from fastapi import FastAPI
import logging

logger = logging.getLogger(__name__)


def register_all_routers(app: FastAPI) -> None:
    """
    Register all routers with the FastAPI application.
    
    Routers are organized into logical groups:
    - Core FHIR APIs
    - Clinical Workflows
    - Administrative Functions
    - Integration Services
    """
    
    # 1. Core FHIR APIs
    try:
        from fhir.api.router import fhir_router
        
        app.include_router(fhir_router, tags=["FHIR R4"])
        logger.info("✓ FHIR routers registered")
    except Exception as e:
        logger.error(f"Failed to register FHIR routers: {e}")
    
    # 2. Authentication & Authorization
    try:
        from api.auth import router as auth_router
        app.include_router(auth_router, tags=["Authentication"])
        logger.info("✓ Authentication router registered")
    except Exception as e:
        logger.error(f"Failed to register auth router: {e}")
    
    # 3. Clinical Workflows
    try:
        from api.catalogs import router as catalogs_router
        from api.clinical.pharmacy.pharmacy_router import router as pharmacy_router
        from api.clinical.tasks.router import router as clinical_tasks_router
        from api.clinical.alerts.router import router as clinical_alerts_router
        from api.clinical.inbox.router import router as clinical_inbox_router
        from api.clinical.cds_clinical_data import router as cds_clinical_data_router
        from api.clinical.dynamic_catalog_router import router as dynamic_catalog_router
        
        app.include_router(catalogs_router, tags=["Clinical Catalogs"])
        app.include_router(dynamic_catalog_router, tags=["Dynamic Catalog (Legacy)"])
        app.include_router(pharmacy_router, tags=["Pharmacy Workflows"])
        app.include_router(clinical_tasks_router, tags=["Clinical Tasks"])
        app.include_router(clinical_alerts_router, tags=["Clinical Alerts"])
        app.include_router(clinical_inbox_router, tags=["Clinical Inbox"])
        app.include_router(cds_clinical_data_router, tags=["CDS Clinical Data"])
        logger.info("✓ Clinical workflow routers registered")
    except Exception as e:
        logger.error(f"Failed to register clinical routers: {e}")
    
    # 4. EMR Extensions
    try:
        from emr_api.router import emr_router
        from clinical_canvas.router import router as clinical_canvas_router
        
        app.include_router(emr_router, tags=["EMR Extensions"])
        app.include_router(clinical_canvas_router, tags=["Clinical Canvas"])
        logger.info("✓ EMR extension routers registered")
    except Exception as e:
        logger.error(f"Failed to register EMR routers: {e}")
    
    # 5. Integration Services
    try:
        from api.cds_hooks.cds_hooks_router import router as cds_hooks_router
        from api.ui_composer import router as ui_composer_router
        from api.websocket.websocket_router import router as websocket_router
        from api.fhir_schema_router import router as fhir_schema_router
        from api.fhir_capability_schema_router import router as fhir_capability_schema_router
        
        app.include_router(cds_hooks_router, prefix="/cds-hooks", tags=["CDS Hooks"])
        app.include_router(ui_composer_router, tags=["UI Composer"])
        app.include_router(websocket_router, prefix="/api", tags=["WebSocket"])
        app.include_router(fhir_schema_router, tags=["FHIR Schemas"])
        app.include_router(fhir_capability_schema_router, tags=["FHIR Schemas V2"])
        logger.info("✓ Integration service routers registered")
    except Exception as e:
        logger.error(f"Failed to register integration routers: {e}")
    
    # 6. Quality & Analytics
    try:
        from api.quality.router import router as quality_measures_router
        from api.analytics.router import router as analytics_router
        
        app.include_router(quality_measures_router, tags=["Quality Measures"])
        app.include_router(analytics_router, tags=["Analytics"])
        logger.info("✓ Quality & Analytics routers registered")
    except Exception as e:
        logger.error(f"Failed to register quality/analytics routers: {e}")
    
    # 7. Imaging & DICOM Services
    try:
        from api.dicom.dicom_service import router as dicom_router
        from api.imaging.router import router as imaging_studies_router
        
        app.include_router(dicom_router, tags=["DICOM Services"])
        app.include_router(imaging_studies_router, tags=["Imaging Studies"])
        logger.info("✓ Imaging routers registered")
    except Exception as e:
        logger.error(f"Failed to register imaging routers: {e}")
    
    # 8. Patient Data & Provider Directory
    try:
        from api.patient_data import router as patient_data_router
        from api.clinical.provider_directory_router import router as provider_directory_router
        
        app.include_router(patient_data_router, prefix="/api", tags=["Patient Data"])
        app.include_router(provider_directory_router, tags=["Provider Directory"])
        logger.info("✓ Patient data & provider directory routers registered")
    except Exception as e:
        logger.error(f"Failed to register patient data/provider routers: {e}")
    
    # 9. Debug Tools (development only)
    try:
        import os
        if os.getenv("DEBUG", "false").lower() == "true":
            from api.debug_router import debug_router
            app.include_router(debug_router, tags=["Debug"])
            logger.info("✓ Debug router registered (DEBUG mode)")
    except Exception as e:
        logger.error(f"Failed to register debug router: {e}")
    
    logger.info("Router registration complete")