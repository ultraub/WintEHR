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
    
    # 1. Core FHIR APIs - HAPI FHIR Proxy
    # Proxy forwards /fhir/R4/* requests to HAPI FHIR JPA Server at http://hapi-fhir:8080
    try:
        from api.fhir.proxy import router as hapi_fhir_proxy

        app.include_router(hapi_fhir_proxy, tags=["FHIR R4 (HAPI Proxy)"])
        logger.info("✓ HAPI FHIR proxy router registered")

        # Keep FHIR relationship and search value routers (may still be useful)
        from api.fhir.routers.relationships import relationships_router
        from api.fhir.search_values import router as search_values_router

        app.include_router(relationships_router, prefix="/api", tags=["FHIR Relationships"])
        app.include_router(search_values_router, prefix="/api", tags=["FHIR Search Values"])
        logger.info("✓ FHIR utility routers registered")
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
        from api.clinical.orders.orders_router import router as clinical_orders_router
        from api.clinical.pharmacy.pharmacy_router import router as pharmacy_router
        from api.clinical.results.results_router import router as clinical_results_router
        from api.clinical.tasks.router import router as clinical_tasks_router
        from api.clinical.alerts.router import router as clinical_alerts_router
        from api.clinical.inbox.router import router as clinical_inbox_router
        from api.clinical.cds_clinical_data import router as cds_clinical_data_router
        from api.clinical.dynamic_catalog_router import router as dynamic_catalog_router
        from api.clinical.medication_lists_router import router as medication_lists_router
        from api.clinical.drug_safety_router import router as drug_safety_router
        from api.clinical.documentation.notes_router import router as clinical_notes_router

        app.include_router(catalogs_router, tags=["Clinical Catalogs"])
        app.include_router(dynamic_catalog_router, tags=["Dynamic Catalog (Legacy)"])
        app.include_router(clinical_orders_router, prefix="/api", tags=["Clinical Orders (CPOE)"])
        app.include_router(pharmacy_router, tags=["Pharmacy Workflows"])
        app.include_router(clinical_results_router, tags=["Clinical Results"])
        app.include_router(medication_lists_router, tags=["Medication Lists"])
        app.include_router(drug_safety_router, prefix="/api/clinical", tags=["Drug Safety"])
        app.include_router(clinical_notes_router, tags=["Clinical Documentation"])
        app.include_router(clinical_tasks_router, tags=["Clinical Tasks"])
        app.include_router(clinical_alerts_router, tags=["Clinical Alerts"])
        app.include_router(clinical_inbox_router, tags=["Clinical Inbox"])
        app.include_router(cds_clinical_data_router, tags=["CDS Clinical Data"])
        logger.info("✓ Clinical workflow routers registered")
    except Exception as e:
        logger.error(f"Failed to register clinical routers: {e}")
    
    # 4. Clinical Canvas (AI-powered UI generation)
    try:
        from clinical_canvas.router import router as clinical_canvas_router

        app.include_router(clinical_canvas_router, tags=["Clinical Canvas"])
        logger.info("✓ Clinical Canvas router registered")
    except Exception as e:
        logger.error(f"Failed to register Clinical Canvas router: {e}")
    
    # 5. Integration Services
    try:
        from api.cds_hooks.cds_hooks_router import router as cds_hooks_router
        from api.cds_studio.visual_builder_router import router as visual_builder_router
        from api.ui_composer import router as ui_composer_router
        from api.websocket.websocket_router import router as websocket_router
        from api.websocket.monitoring import router as websocket_monitoring_router
        from api.fhir.routers.schema import router as fhir_schema_router
        from api.fhir.routers.capability import router as fhir_capability_schema_router
        from api.external_services.router import router as external_services_router
        from api.cds_studio.router import router as cds_studio_router

        app.include_router(cds_hooks_router, prefix="/api", tags=["CDS Hooks"])
        app.include_router(visual_builder_router, tags=["CDS Visual Builder"])
        app.include_router(ui_composer_router, tags=["UI Composer"])
        app.include_router(websocket_router, prefix="/api", tags=["WebSocket"])
        app.include_router(websocket_monitoring_router, tags=["WebSocket Monitoring"])
        app.include_router(fhir_schema_router, tags=["FHIR Schemas"])
        app.include_router(fhir_capability_schema_router, tags=["FHIR Schemas V2"])
        app.include_router(external_services_router, tags=["External Services"])
        app.include_router(cds_studio_router, tags=["CDS Management Studio"])


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
    
    # 8. Provider Directory
    try:
        from api.clinical.provider_directory_router import router as provider_directory_router

        app.include_router(provider_directory_router, tags=["Provider Directory"])
        logger.info("✓ Provider directory router registered")
    except Exception as e:
        logger.error(f"Failed to register provider router: {e}")
    
    # 9. Monitoring & Performance
    try:
        from api.system.monitoring import monitoring_router
        app.include_router(monitoring_router, tags=["Monitoring"])
        logger.info("✓ Monitoring router registered")
    except Exception as e:
        logger.error(f"Failed to register monitoring router: {e}")
    
    # 10. Debug Tools (development only)
    try:
        import os
        if os.getenv("DEBUG", "false").lower() == "true":
            from api.system.debug_router import debug_router
            app.include_router(debug_router, tags=["Debug"])
            logger.info("✓ Debug router registered (DEBUG mode)")
    except Exception as e:
        logger.error(f"Failed to register debug router: {e}")
    
    logger.info("Router registration complete")