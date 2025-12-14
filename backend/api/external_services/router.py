"""
External Services API Router

FastAPI endpoints for external FHIR service registration and management.
Supports CDS Hooks, SMART on FHIR, Subscriptions, and CQL Libraries.

Educational Focus:
- External service lifecycle management (register, update, deregister)
- FHIR resource creation in HAPI (PlanDefinition, Subscription, Library)
- Service health monitoring and analytics
- Secure credential management
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from database import get_db_session
from api.auth.service import get_current_user
from api.auth.models import User
from api.services.audit_service import AuditService, AuditEventType

from .service import ExternalServiceRegistry
from .models import (
    # Service creation models
    ExternalServiceCreate,
    CDSHooksServiceCreate,
    SMARTAppCreate,
    SubscriptionCreate,
    CQLLibraryCreate,

    # Multi-hook registration models
    BatchCDSHooksServiceCreate,
    IncrementalHookAdd,
    BatchCDSHooksServiceResponse,

    # Service response models
    ExternalServiceResponse,
    CDSHooksServiceResponse,
    SMARTAppResponse,
    SubscriptionResponse,

    # Management models
    ExternalServiceUpdate,
    ServiceListFilter,
    PaginatedServiceList,
    HealthCheckResult,
    ServiceExecutionLog,
    ServiceAnalytics,

    # Enums
    ServiceType,
    ServiceStatus,
    HealthStatus
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/external-services", tags=["External Services"])


# Dependency injection
async def get_service_registry(
    db: AsyncSession = Depends(get_db_session)
) -> ExternalServiceRegistry:
    """Get external service registry instance"""
    return ExternalServiceRegistry(db)


async def get_audit_service(
    db: AsyncSession = Depends(get_db_session)
) -> AuditService:
    """Get audit service instance"""
    return AuditService(db)


# ============================================================================
# Service Registration Endpoints
# ============================================================================

@router.post(
    "/register",
    response_model=ExternalServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register External Service",
    description="""
    Register a new external FHIR service with WintEHR.

    Creates both:
    1. Database record for lifecycle management
    2. Corresponding FHIR resource in HAPI (PlanDefinition, Subscription, etc.)

    Supported service types:
    - **CDS Hooks**: Clinical decision support services (use CDSHooksServiceCreate)
    - **SMART Apps**: SMART on FHIR applications (use SMARTAppCreate)
    - **Subscriptions**: FHIR webhook subscriptions (use SubscriptionCreate)
    - **CQL Libraries**: Clinical Quality Language libraries (use CQLLibraryCreate)
    """
)
async def register_service(
    service_data: ExternalServiceCreate,
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
) -> ExternalServiceResponse:
    """Register new external service"""
    try:
        logger.info(f"Registering external service: {service_data.name} (type: {service_data.service_type})")

        # Register service (creates DB record + FHIR resource)
        service_id, fhir_resource_id = await registry.register_service(
            service_data,
            user_id=current_user.id
        )

        # Log registration for audit trail
        await audit.log_event(
            event_type=AuditEventType.EXTERNAL_SERVICE_REGISTERED,
            user_id=current_user.id,
            resource_type="ExternalService",
            resource_id=service_id,
            details={
                "service_name": service_data.name,
                "service_type": service_data.service_type,
                "fhir_resource_id": fhir_resource_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

        # Get full service details
        service = await registry.get_service(service_id)

        logger.info(f"Successfully registered service {service_id}")
        return service

    except ValueError as e:
        logger.error(f"Validation error registering service: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error registering external service: {e}")
        raise HTTPException(status_code=500, detail="Failed to register external service")


@router.post(
    "/register/cds-hooks",
    response_model=CDSHooksServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register CDS Hooks Service"
)
async def register_cds_hooks_service(
    service_data: CDSHooksServiceCreate,
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
):
    """Register CDS Hooks service (creates PlanDefinition in HAPI)"""
    return await register_service(service_data, registry, audit, current_user)


@router.post(
    "/register/smart-app",
    response_model=SMARTAppResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register SMART on FHIR Application"
)
async def register_smart_app(
    service_data: SMARTAppCreate,
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
):
    """Register SMART on FHIR application"""
    return await register_service(service_data, registry, audit, current_user)


@router.post(
    "/register/subscription",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register FHIR Subscription"
)
async def register_subscription(
    service_data: SubscriptionCreate,
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
):
    """Register FHIR subscription webhook (creates Subscription in HAPI)"""
    return await register_service(service_data, registry, audit, current_user)


@router.post(
    "/register/cql-library",
    response_model=ExternalServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register CQL Library"
)
async def register_cql_library(
    service_data: CQLLibraryCreate,
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
):
    """Register CQL library service (creates Library in HAPI)"""
    return await register_service(service_data, registry, audit, current_user)


# ============================================================================
# Multi-Hook Registration Endpoints
# ============================================================================

@router.post(
    "/register/cds-hooks/batch",
    response_model=BatchCDSHooksServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Batch Register CDS Hooks Service",
    description="""
    Register a CDS Hooks service with multiple hook types in a single request.

    This endpoint allows one service to respond to multiple hook types.
    Each hook creates a separate PlanDefinition in HAPI FHIR but shares
    the same service endpoint and authentication.

    **Example Use Cases:**
    - Medication safety service responding to both medication-prescribe and order-sign
    - Patient risk assessment service for patient-view and encounter-start
    - Multi-context clinical decision support

    **Benefits:**
    - Single database record for service lifecycle
    - Shared authentication configuration
    - Unified analytics across all hooks
    - Simplified service management
    """
)
async def register_cds_hooks_batch(
    service_data: BatchCDSHooksServiceCreate,
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
) -> BatchCDSHooksServiceResponse:
    """Register CDS Hooks service with multiple hook types"""
    try:
        logger.info(f"Batch registering CDS service: {service_data.name} with {len(service_data.cds_configs)} hooks")

        # Register service with multiple hooks
        service_id, hook_ids = await registry.register_batch_cds_service(
            service_data,
            user_id=current_user.id
        )

        # Log registration for audit trail
        await audit.log_event(
            event_type=AuditEventType.EXTERNAL_SERVICE_REGISTERED,
            user_id=current_user.id,
            resource_type="ExternalService",
            resource_id=service_id,
            details={
                "service_name": service_data.name,
                "service_type": "cds_hooks",
                "hook_types": [config.hook_type for config in service_data.cds_configs],
                "hook_count": len(service_data.cds_configs),
                "hapi_plan_definition_ids": hook_ids,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

        # Get full service details
        service = await registry.get_batch_cds_service(service_id)

        logger.info(f"Successfully registered batch service {service_id} with {len(hook_ids)} hooks")
        return service

    except ValueError as e:
        logger.error(f"Validation error in batch registration: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in batch CDS registration: {e}")
        raise HTTPException(status_code=500, detail="Failed to register batch CDS service")


@router.post(
    "/{service_id}/hooks",
    response_model=CDSHooksServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add Hook to Existing Service",
    description="""
    Add an additional hook type to an already-registered CDS Hooks service.

    This endpoint enables incremental hook registration, allowing you to
    extend a service's capabilities without modifying existing hooks.

    **Example Use Cases:**
    - Add order-select hook to existing medication-prescribe service
    - Extend patient-view service with encounter-discharge hook
    - Incrementally build multi-hook services during development

    **Benefits:**
    - No disruption to existing hooks
    - Preserves service configuration and credentials
    - Maintains execution history and analytics
    - Supports iterative service development
    """
)
async def add_hook_to_service(
    service_id: str = Path(..., description="Existing service ID"),
    hook_data: IncrementalHookAdd = ...,
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
) -> CDSHooksServiceResponse:
    """Add new hook to existing CDS service"""
    try:
        logger.info(f"Adding hook {hook_data.cds_config.hook_type} to service {service_id}")

        # Verify service exists and is CDS Hooks type
        service = await registry.get_service(service_id)
        if not service:
            raise HTTPException(status_code=404, detail=f"Service {service_id} not found")

        if service.service_type != ServiceType.CDS_HOOKS:
            raise HTTPException(
                status_code=400,
                detail=f"Service {service_id} is not a CDS Hooks service (type: {service.service_type})"
            )

        # Add hook to service
        plan_definition_id = await registry.add_hook_to_service(
            service_id,
            hook_data.cds_config,
            user_id=current_user.id
        )

        # Log addition for audit trail
        await audit.log_event(
            event_type=AuditEventType.EXTERNAL_SERVICE_UPDATED,
            user_id=current_user.id,
            resource_type="ExternalService",
            resource_id=service_id,
            details={
                "action": "add_hook",
                "hook_type": hook_data.cds_config.hook_type,
                "hook_service_id": hook_data.cds_config.hook_service_id,
                "plan_definition_id": plan_definition_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

        # Get updated service details
        updated_service = await registry.get_cds_service(service_id, hook_data.cds_config.hook_service_id)

        logger.info(f"Successfully added hook to service {service_id}")
        return updated_service

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error adding hook: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding hook to service: {e}")
        raise HTTPException(status_code=500, detail="Failed to add hook to service")


@router.get(
    "/{service_id}/hooks",
    response_model=List[CDSHooksServiceResponse],
    summary="List Service Hooks",
    description="List all hooks registered for a CDS Hooks service"
)
async def list_service_hooks(
    service_id: str = Path(..., description="Service ID"),
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    current_user: User = Depends(get_current_user)
) -> List[CDSHooksServiceResponse]:
    """List all hooks for a CDS service"""
    try:
        # Get all hooks for service
        hooks = await registry.list_service_hooks(service_id)

        if not hooks:
            raise HTTPException(status_code=404, detail=f"No hooks found for service {service_id}")

        return hooks

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing service hooks: {e}")
        raise HTTPException(status_code=500, detail="Failed to list service hooks")


# ============================================================================
# Service Query Endpoints
# ============================================================================

@router.get(
    "",
    response_model=PaginatedServiceList,
    summary="List External Services",
    description="List all registered external services with filtering and pagination"
)
async def list_services(
    service_type: Optional[ServiceType] = Query(None, description="Filter by service type"),
    status: Optional[ServiceStatus] = Query(None, description="Filter by status"),
    health_status: Optional[HealthStatus] = Query(None, description="Filter by health status"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    search: Optional[str] = Query(None, description="Search by name or description"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Results per page"),
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    current_user: User = Depends(get_current_user)
) -> PaginatedServiceList:
    """List registered external services with filtering"""
    try:
        # Build filter
        filters = ServiceListFilter(
            service_type=service_type,
            status=status,
            health_status=health_status,
            tags=tags,
            search=search
        )

        # Get services with pagination
        services, total = await registry.list_services(
            filters=filters,
            page=page,
            page_size=page_size
        )

        return PaginatedServiceList(
            items=services,
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size
        )

    except Exception as e:
        logger.error(f"Error listing external services: {e}")
        raise HTTPException(status_code=500, detail="Failed to list external services")


@router.get(
    "/{service_id}",
    response_model=ExternalServiceResponse,
    summary="Get Service Details",
    description="Get detailed information about a specific external service"
)
async def get_service(
    service_id: str = Path(..., description="Service ID"),
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    current_user: User = Depends(get_current_user)
) -> ExternalServiceResponse:
    """Get external service details"""
    try:
        service = await registry.get_service(service_id)

        if not service:
            raise HTTPException(status_code=404, detail=f"Service {service_id} not found")

        return service

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get service details")


# ============================================================================
# Service Management Endpoints
# ============================================================================

@router.put(
    "/{service_id}",
    response_model=ExternalServiceResponse,
    summary="Update Service",
    description="Update external service configuration"
)
async def update_service(
    service_id: str = Path(..., description="Service ID"),
    update_data: ExternalServiceUpdate = None,
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
) -> ExternalServiceResponse:
    """Update external service"""
    try:
        # Update service
        success = await registry.update_service(service_id, update_data)

        if not success:
            raise HTTPException(status_code=404, detail=f"Service {service_id} not found")

        # Log update for audit trail
        await audit.log_event(
            event_type=AuditEventType.EXTERNAL_SERVICE_UPDATED,
            user_id=current_user.id,
            resource_type="ExternalService",
            resource_id=service_id,
            details={
                "updated_fields": update_data.dict(exclude_unset=True),
                "timestamp": datetime.utcnow().isoformat()
            }
        )

        # Return updated service
        return await registry.get_service(service_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update service")


@router.delete(
    "/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deregister Service",
    description="Deregister and delete external service (removes from both DB and HAPI)"
)
async def delete_service(
    service_id: str = Path(..., description="Service ID"),
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    audit: AuditService = Depends(get_audit_service),
    current_user: User = Depends(get_current_user)
):
    """Delete external service"""
    try:
        # Get service details before deletion (for audit log)
        service = await registry.get_service(service_id)
        if not service:
            raise HTTPException(status_code=404, detail=f"Service {service_id} not found")

        # Delete service (removes from DB and HAPI)
        success = await registry.delete_service(service_id)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete service")

        # Log deletion for audit trail
        await audit.log_event(
            event_type=AuditEventType.EXTERNAL_SERVICE_DELETED,
            user_id=current_user.id,
            resource_type="ExternalService",
            resource_id=service_id,
            details={
                "service_name": service.name,
                "service_type": service.service_type,
                "fhir_resource_id": service.fhir_resource_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete service")


# ============================================================================
# Service Health & Monitoring Endpoints
# ============================================================================

@router.post(
    "/{service_id}/health-check",
    response_model=HealthCheckResult,
    summary="Health Check",
    description="Perform health check on external service"
)
async def health_check(
    service_id: str = Path(..., description="Service ID"),
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    current_user: User = Depends(get_current_user)
) -> HealthCheckResult:
    """Execute health check on external service"""
    try:
        result = await registry.health_check(service_id)

        if not result:
            raise HTTPException(status_code=404, detail=f"Service {service_id} not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing health check on service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")


@router.get(
    "/{service_id}/executions",
    response_model=List[ServiceExecutionLog],
    summary="Get Execution Logs",
    description="Get execution history for external service"
)
async def get_execution_logs(
    service_id: str = Path(..., description="Service ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum results"),
    success_only: Optional[bool] = Query(None, description="Filter by success status"),
    since: Optional[datetime] = Query(None, description="Filter by time (ISO 8601)"),
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    current_user: User = Depends(get_current_user)
) -> List[ServiceExecutionLog]:
    """Get service execution logs"""
    try:
        logs = await registry.get_execution_logs(
            service_id=service_id,
            limit=limit,
            success_only=success_only,
            since=since
        )

        return logs

    except Exception as e:
        logger.error(f"Error getting execution logs for service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get execution logs")


@router.get(
    "/{service_id}/analytics",
    response_model=List[ServiceAnalytics],
    summary="Get Service Analytics",
    description="Get aggregated analytics for external service"
)
async def get_service_analytics(
    service_id: str = Path(..., description="Service ID"),
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    current_user: User = Depends(get_current_user)
) -> List[ServiceAnalytics]:
    """Get service analytics summary"""
    try:
        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days)

        analytics = await registry.get_analytics(
            service_id=service_id,
            start_date=start_date,
            end_date=end_date
        )

        return analytics

    except Exception as e:
        logger.error(f"Error getting analytics for service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get service analytics")


# ============================================================================
# Batch Operations
# ============================================================================

@router.post(
    "/health-check-all",
    response_model=List[HealthCheckResult],
    summary="Health Check All Services",
    description="Perform health checks on all active external services"
)
async def health_check_all(
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    current_user: User = Depends(get_current_user)
) -> List[HealthCheckResult]:
    """Execute health checks on all active services"""
    try:
        # Get all active services
        filters = ServiceListFilter(status=ServiceStatus.ACTIVE)
        services, _ = await registry.list_services(filters=filters)

        # Perform health checks
        results = []
        for service in services:
            try:
                result = await registry.health_check(service.id)
                results.append(result)
            except Exception as e:
                logger.error(f"Health check failed for service {service.id}: {e}")
                results.append(
                    HealthCheckResult(
                        service_id=service.id,
                        status=HealthStatus.UNHEALTHY,
                        timestamp=datetime.utcnow(),
                        error_message=str(e)
                    )
                )

        return results

    except Exception as e:
        logger.error(f"Error performing batch health checks: {e}")
        raise HTTPException(status_code=500, detail="Batch health check failed")


# ============================================================================
# Discovery & Metadata
# ============================================================================

@router.get(
    "/discovery/cds-services",
    response_model=Dict[str, Any],
    summary="CDS Hooks Discovery",
    description="CDS Hooks 1.0 discovery endpoint for all registered CDS services"
)
async def cds_hooks_discovery(
    registry: ExternalServiceRegistry = Depends(get_service_registry)
) -> Dict[str, Any]:
    """
    CDS Hooks discovery endpoint

    Returns all registered CDS Hooks services in CDS Hooks 1.0 discovery format.
    This endpoint can be used by EHR systems to discover available CDS services.
    """
    try:
        # Get all active CDS Hooks services
        filters = ServiceListFilter(
            service_type=ServiceType.CDS_HOOKS,
            status=ServiceStatus.ACTIVE
        )
        services, _ = await registry.list_services(filters=filters)

        # Format as CDS Hooks discovery response
        cds_services = []
        for service in services:
            if hasattr(service, 'cds_config'):
                cds_services.append({
                    "id": service.cds_config.hook_service_id,
                    "hook": service.cds_config.hook_type,
                    "title": service.cds_config.title or service.name,
                    "description": service.cds_config.description or service.description,
                    "prefetch": service.cds_config.prefetch_template or {},
                    "usageRequirements": service.cds_config.usage_requirements
                })

        return {
            "services": cds_services
        }

    except Exception as e:
        logger.error(f"Error in CDS Hooks discovery: {e}")
        raise HTTPException(status_code=500, detail="Discovery endpoint failed")


@router.get(
    "/stats",
    response_model=Dict[str, Any],
    summary="System Statistics",
    description="Get statistics about registered external services"
)
async def get_system_stats(
    registry: ExternalServiceRegistry = Depends(get_service_registry),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get external services system statistics"""
    try:
        # Get all services
        all_services, total = await registry.list_services()

        # Calculate statistics
        stats = {
            "total_services": total,
            "by_type": {},
            "by_status": {},
            "by_health": {},
            "recent_executions": 0,
            "avg_response_time_ms": 0
        }

        # Count by type, status, health
        for service in all_services:
            # By type
            service_type = service.service_type.value
            stats["by_type"][service_type] = stats["by_type"].get(service_type, 0) + 1

            # By status
            status = service.status.value
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1

            # By health
            health = service.health_status.value
            stats["by_health"][health] = stats["by_health"].get(health, 0) + 1

        return stats

    except Exception as e:
        logger.error(f"Error getting system stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system statistics")
