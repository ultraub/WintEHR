"""
CDS Hooks HTTP surface — thin stubs over CDSHooksService.

Implements the CDS Hooks 2.0 specification endpoints (discovery at
GET /cds-services, execution at POST /cds-services/{id}, feedback,
analytics) plus the service-CRUD management API. Business logic lives in
service.py (docs/ARCHITECTURE_DEBT.md opportunity #5); each handler
parses the request via Depends and delegates.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends

from .models import (
    CDSHookRequest,
    CDSHookResponse,
    CDSServicesResponse,
    FeedbackRequest,
    HookConfiguration,
)
from .service import CDSHooksService, get_cds_hooks_service

router = APIRouter(prefix="/api", tags=["CDS Hooks"])

# Sub-routers mounted onto the CDS surface (unchanged by the #5 split)
from .actions import router as action_router
from .audit import router as audit_router

router.include_router(action_router, prefix="", tags=["CDS Actions"])
router.include_router(audit_router, prefix="", tags=["CDS Audit"])


# CDS Hooks Discovery Endpoint
@router.get("/cds-services", response_model=CDSServicesResponse)
async def discover_services(
    service_origin: Optional[str] = None,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """CDS Hooks discovery endpoint - v3.0 architecture"""
    return await service.discover_services(service_origin=service_origin)


# CDS Service Execution Endpoint
@router.post("/cds-services/{service_id}", response_model=CDSHookResponse)
async def execute_service(
    service_id: str,
    request: CDSHookRequest,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Execute a specific CDS service - v3.0 architecture"""
    return await service.execute_service(service_id=service_id, request=request)


# CDS Service Feedback Endpoint
@router.post("/cds-services/{service_id}/feedback")
async def provide_feedback(
    service_id: str,
    feedback: FeedbackRequest,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Provide feedback on CDS service recommendations - CDS Hooks v2.0 compliant"""
    return await service.provide_feedback(service_id=service_id, feedback=feedback)


# CDS Analytics Endpoint
@router.get("/cds-services/{service_id}/analytics")
async def get_feedback_analytics(
    service_id: str,
    days: int = 30,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Get analytics for a specific CDS service"""
    return await service.get_feedback_analytics(service_id=service_id, days=days)


# Global Analytics Endpoint
@router.get("/cds-services/analytics/summary")
async def get_global_analytics(
    days: int = 30,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Get analytics summary for all CDS services"""
    return await service.get_global_analytics(days=days)


# Prefetch Analysis Endpoint
@router.get("/cds-services/{service_id}/prefetch-analysis")
async def analyze_prefetch_patterns(
    service_id: str,
    days: int = 30,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Analyze prefetch patterns for optimization"""
    return await service.analyze_prefetch_patterns(service_id=service_id, days=days)


# Debug / Diagnostic Endpoint
@router.get("/cds-debug/{service_id}")
async def diagnose_service(
    service_id: str,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Read-only triage for a CDS service that isn't producing cards."""
    return await service.diagnose_service(service_id=service_id)


# Service Management Endpoints (for CRUD operations)
@router.get("/services", response_model=List[HookConfiguration])
async def list_services(
    hook_type: Optional[str] = None,
    enabled_only: bool = True,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """List all CDS services."""
    return await service.list_services(hook_type=hook_type, enabled_only=enabled_only)

# Alias endpoint for CDS Builder compatibility
@router.get("/cds-services/services", response_model=List[HookConfiguration])
async def list_services_alias(
    hook_type: Optional[str] = None,
    enabled_only: bool = True,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """List all CDS services (alias for /services endpoint for CDS Builder compatibility)"""
    return await service.list_services(hook_type=hook_type, enabled_only=enabled_only)


@router.post("/services", response_model=HookConfiguration)
async def create_service(
    hook_config: HookConfiguration,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Create a new CDS service"""
    return await service.create_service(hook_config=hook_config)

# Alias endpoint for CDS Builder compatibility
@router.post("/cds-services/services", response_model=HookConfiguration)
async def create_service_alias(
    hook_config: HookConfiguration,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Create a new CDS service (alias for CDS Builder compatibility)"""
    return await service.create_service(hook_config=hook_config)

# Service Management Endpoints (specific routes before parameterized routes)
@router.get("/services/backup")
async def backup_services(
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Create a backup of all service configurations"""
    return await service.backup_services()

@router.post("/services/restore")
async def restore_services(
    backup_data: Dict[str, Any],
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Restore services from backup data"""
    return await service.restore_services(backup_data=backup_data)

@router.post("/services/sync-samples")
async def sync_sample_services(
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Sync sample services to database"""
    return await service.sync_sample_services()

@router.get("/services/{service_id}", response_model=HookConfiguration)
async def get_service(
    service_id: str,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Get a specific CDS service"""
    return await service.get_service(service_id=service_id)

# Alias endpoint for CDS Builder compatibility
@router.get("/cds-services/services/{service_id}", response_model=HookConfiguration)
async def get_service_alias(
    service_id: str,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Get a specific CDS service (alias for CDS Builder compatibility)"""
    return await service.get_service(service_id=service_id)

@router.put("/services/{service_id}", response_model=HookConfiguration)
async def update_service(
    service_id: str,
    hook_config: HookConfiguration,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Update a CDS service"""
    return await service.update_service(service_id=service_id, hook_config=hook_config)

# Alias endpoint for CDS Builder compatibility  
@router.put("/cds-services/services/{service_id}", response_model=HookConfiguration)
async def update_service_alias(
    service_id: str,
    hook_config: HookConfiguration,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Update a CDS service (alias for CDS Builder compatibility)"""
    return await service.update_service(service_id=service_id, hook_config=hook_config)

@router.delete("/services/{service_id}")
async def delete_service(
    service_id: str,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Delete a CDS service"""
    return await service.delete_service(service_id=service_id)


# Additional hook management endpoints
@router.patch("/services/{service_id}/toggle")
async def toggle_service(
    service_id: str,
    enabled: bool,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Enable or disable a CDS service"""
    return await service.toggle_service(service_id=service_id, enabled=enabled)


# Service Registry Management Endpoints (below)

# Service Registry Management Endpoints
@router.get("/registry/services")
async def list_registry_services(
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """List all services registered in the service registry"""
    return await service.list_registry_services()


@router.get("/registry/services/{service_id}")
async def get_registry_service(
    service_id: str,
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """Get details of a specific service from the registry"""
    return await service.get_registry_service(service_id=service_id)


# Health check endpoint
@router.get("/cds-hooks/health")
async def health_check(
    service: CDSHooksService = Depends(get_cds_hooks_service),
):
    """CDS subsystem health/diagnostics (DB hooks, registry counts)."""
    return await service.health_check()
