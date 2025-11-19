"""
CDS Studio API Router

Main router for CDS Management Studio providing endpoints for:
- Service registry and configuration viewing
- Service creation and management
- Service testing
- Metrics and monitoring
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db_session

from .models import (
    ServiceListResponse,
    ServiceConfiguration,
    ConfigurationView,
    CreateBuiltInServiceRequest,
    CreateExternalServiceRequest,
    TestServiceRequest,
    TestServiceResponse,
    ServiceMetrics,
    VersionHistoryResponse,
    RollbackRequest,
    ServiceStatus,
    ServiceOrigin,
    HookType
)
from .service import CDSStudioService
from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cds-studio", tags=["cds-studio"])


# Dependency injection
async def get_studio_service(db: AsyncSession = Depends(get_db_session)) -> CDSStudioService:
    """Get CDS Studio service instance with database session"""
    return CDSStudioService(db)


# ============================================================================
# Service Registry Endpoints
# ============================================================================

@router.get("/services", response_model=ServiceListResponse)
async def list_services(
    hook_type: Optional[HookType] = Query(None, description="Filter by hook type"),
    origin: Optional[ServiceOrigin] = Query(None, description="Filter by origin"),
    status: Optional[ServiceStatus] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by name or ID"),
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Get list of all CDS services with filtering.

    Returns services from HAPI FHIR (via PlanDefinition search) with
    aggregated metadata and metrics.
    """
    try:
        return await studio_service.list_services(
            hook_type=hook_type,
            origin=origin,
            status=status,
            search=search
        )
    except Exception as e:
        logger.error(f"Failed to list services: {e}")
        raise HTTPException(500, f"Failed to list services: {str(e)}")


@router.get("/services/{service_id}/config", response_model=ServiceConfiguration)
async def get_service_configuration(
    service_id: str,
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Get complete configuration for a service.

    Returns service metadata, PlanDefinition JSON, prefetch templates,
    and code (for built-in services).
    """
    try:
        config = await studio_service.get_service_configuration(service_id)
        if not config:
            raise HTTPException(404, f"Service {service_id} not found")
        return config
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get service configuration: {e}")
        raise HTTPException(500, f"Failed to get configuration: {str(e)}")


@router.get("/services/{service_id}/config/view", response_model=ConfigurationView)
async def get_configuration_view(
    service_id: str,
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Get split view of service configuration (JSON + human-readable breakdown).

    This endpoint provides the data for the Configuration tab in the UI,
    showing both the raw PlanDefinition JSON and a structured explanation.
    """
    try:
        view = await studio_service.get_configuration_breakdown(service_id)
        if not view:
            raise HTTPException(404, f"Service {service_id} not found")
        return view
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get configuration view: {e}")
        raise HTTPException(500, f"Failed to get configuration view: {str(e)}")


# ============================================================================
# Service Creation Endpoints
# ============================================================================

@router.post("/services/built-in", status_code=201)
async def create_built_in_service(
    request: CreateBuiltInServiceRequest,
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Create a new built-in CDS service.

    Creates:
    1. Database record with source code
    2. PlanDefinition in HAPI FHIR with built-in extensions
    3. Version record
    """
    try:
        result = await studio_service.create_built_in_service(request)
        return {
            "success": True,
            "service_id": result["service_id"],
            "plan_definition_id": result["plan_definition_id"],
            "version": result["version"],
            "message": "Built-in service created successfully"
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Failed to create built-in service: {e}")
        raise HTTPException(500, f"Failed to create service: {str(e)}")


@router.post("/services/external", status_code=201)
async def create_external_service(
    request: CreateExternalServiceRequest,
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Register an external CDS service.

    Creates:
    1. Database record (links to credential if provided)
    2. PlanDefinition in HAPI FHIR with external extensions
    """
    try:
        result = await studio_service.create_external_service(request)
        return {
            "success": True,
            "service_id": result["service_id"],
            "plan_definition_id": result["plan_definition_id"],
            "message": "External service registered successfully"
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Failed to register external service: {e}")
        raise HTTPException(500, f"Failed to register service: {str(e)}")


# ============================================================================
# Service Testing Endpoints
# ============================================================================

@router.post("/services/{service_id}/test", response_model=TestServiceResponse)
async def test_service(
    service_id: str,
    request: TestServiceRequest,
    studio_service: CDSStudioService = Depends(get_studio_service),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Test a CDS service with synthetic patient data.

    Executes the service in sandbox mode (doesn't affect production metrics)
    and returns cards, execution time, logs, and any errors.
    """
    try:
        result = await studio_service.test_service(service_id, request, db)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test service: {e}")
        raise HTTPException(500, f"Failed to test service: {str(e)}")


# ============================================================================
# Service Metrics Endpoints
# ============================================================================

@router.get("/services/{service_id}/metrics", response_model=ServiceMetrics)
async def get_service_metrics(
    service_id: str,
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Get performance metrics for a service.

    Returns execution counts, success rates, response times, and card metrics.
    """
    try:
        metrics = await studio_service.get_service_metrics(service_id)
        if not metrics:
            raise HTTPException(404, f"Service {service_id} not found")
        return metrics
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get service metrics: {e}")
        raise HTTPException(500, f"Failed to get metrics: {str(e)}")


# ============================================================================
# Service Management Endpoints
# ============================================================================

@router.put("/services/{service_id}/status")
async def update_service_status(
    service_id: str,
    status: ServiceStatus,
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Update service status (activate/deactivate).

    Updates PlanDefinition status in HAPI FHIR.
    """
    try:
        await studio_service.update_service_status(service_id, status)
        return {
            "success": True,
            "service_id": service_id,
            "status": status,
            "message": f"Service status updated to {status}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update service status: {e}")
        raise HTTPException(500, f"Failed to update status: {str(e)}")


@router.delete("/services/{service_id}")
async def delete_service(
    service_id: str,
    hard_delete: bool = Query(False, description="Permanently delete (vs soft delete)"),
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Delete a CDS service.

    Soft delete (default): Marks as deleted in database
    Hard delete: Removes from database and HAPI FHIR
    """
    try:
        await studio_service.delete_service(service_id, hard_delete=hard_delete)
        return {
            "success": True,
            "service_id": service_id,
            "message": f"Service {'deleted' if hard_delete else 'deactivated'} successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete service: {e}")
        raise HTTPException(500, f"Failed to delete service: {str(e)}")


# ============================================================================
# Version Management Endpoints
# ============================================================================

@router.get("/services/{service_id}/versions", response_model=VersionHistoryResponse)
async def get_version_history(
    service_id: str,
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Get version history for a service.

    Returns all versions with timestamps and notes.
    """
    try:
        history = await studio_service.get_version_history(service_id)
        if not history:
            raise HTTPException(404, f"Service {service_id} not found")
        return history
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get version history: {e}")
        raise HTTPException(500, f"Failed to get version history: {str(e)}")


@router.post("/services/{service_id}/rollback")
async def rollback_service(
    service_id: str,
    request: RollbackRequest,
    studio_service: CDSStudioService = Depends(get_studio_service)
):
    """
    Rollback service to a previous version.

    Creates a new version that is a copy of the target version.
    """
    try:
        result = await studio_service.rollback_service(service_id, request)
        return {
            "success": True,
            "service_id": service_id,
            "new_version": result["new_version"],
            "message": f"Rolled back to version {request.target_version}"
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to rollback service: {e}")
        raise HTTPException(500, f"Failed to rollback: {str(e)}")
