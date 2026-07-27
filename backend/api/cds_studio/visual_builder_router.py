"""
Visual CDS Builder HTTP surface — thin stubs over VisualBuilderService.

REST endpoints for creating, managing, testing, and deploying
visually-built CDS services. Business logic lives in
visual_builder_service.py (docs/ARCHITECTURE_DEBT.md opportunity #5);
each handler parses the request via Depends and delegates.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from api.auth.models import User
from api.auth.service import get_current_user_or_demo
from api.cds_hooks.cql_bridge import CQLBridge, get_cql_bridge
from api.cds_hooks.external_service_models import (
    ExternalServiceRegistration,
    ExternalServiceResponse,
)
from api.cds_hooks.service_code_generator import ServiceCodeGenerator

from .visual_service_config import (
    ServiceAnalytics,
    ServiceStatus,
    ServiceType,
    ServiceDeploymentRequest,
    ServiceTestRequest,
    ServiceTestResponse,
    VisualServiceConfigCreate,
    VisualServiceConfigResponse,
    VisualServiceConfigUpdate,
)
from .visual_builder_service import (
    VisualBuilderService,
    get_code_generator,
    get_visual_builder_service,
    _CQLDataReqRequest,
    _CQLDataReqResponse,
    _CQLValidateRequest,
    _CQLValidateResponse,
    _FHIRPreviewResponse,
)

router = APIRouter(prefix="/api/cds-visual-builder", tags=["CDS Visual Builder"])


# Visual Service CRUD Endpoints

@router.post("/services", response_model=VisualServiceConfigResponse, status_code=201)
async def create_visual_service(
    config: VisualServiceConfigCreate,
    current_user: User = Depends(get_current_user_or_demo),
    generator: ServiceCodeGenerator = Depends(get_code_generator),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Create a new visual CDS service configuration"""
    return await service.create_visual_service(config=config, current_user=current_user, generator=generator)


@router.get("/services", response_model=List[VisualServiceConfigResponse])
async def list_visual_services(
    status: Optional[ServiceStatus] = Query(None, description="Filter by status"),
    service_type: Optional[ServiceType] = Query(None, description="Filter by service type"),
    search: Optional[str] = Query(None, description="Search in name or description"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of records"),
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """List visual CDS service configurations with filtering"""
    return await service.list_visual_services(status=status, service_type=service_type, search=search, is_active=is_active, skip=skip, limit=limit, current_user=current_user)


@router.get("/services/{service_id}", response_model=VisualServiceConfigResponse)
async def get_visual_service(
    service_id: str,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Get a specific visual CDS service configuration"""
    return await service.get_visual_service(service_id=service_id, current_user=current_user)


@router.get("/services/{service_id}/full-edit-state")
async def get_full_edit_state(
    service_id: str,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Return everything the wizard needs to re-load a deployed service."""
    return await service.get_full_edit_state(service_id=service_id, current_user=current_user)


@router.put("/services/{service_id}", response_model=VisualServiceConfigResponse)
async def update_visual_service(
    service_id: str,
    update: VisualServiceConfigUpdate,
    current_user: User = Depends(get_current_user_or_demo),
    generator: ServiceCodeGenerator = Depends(get_code_generator),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Update a visual CDS service configuration"""
    return await service.update_visual_service(service_id=service_id, update=update, current_user=current_user, generator=generator)


@router.delete("/services/{service_id}", status_code=204)
async def delete_visual_service(
    service_id: str,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Delete a visual CDS service configuration"""
    return await service.delete_visual_service(service_id=service_id, current_user=current_user)


# Code Generation and Preview

@router.get("/services/{service_id}/code")
async def get_generated_code(
    service_id: str,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Get the generated Python code for a visual service"""
    return await service.get_generated_code(service_id=service_id, current_user=current_user)


@router.post("/services/{service_id}/regenerate-code")
async def regenerate_service_code(
    service_id: str,
    current_user: User = Depends(get_current_user_or_demo),
    generator: ServiceCodeGenerator = Depends(get_code_generator),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Force regeneration of service code"""
    return await service.regenerate_service_code(service_id=service_id, current_user=current_user, generator=generator)


# Service Testing

@router.post("/services/{service_id}/test", response_model=ServiceTestResponse)
async def test_visual_service(
    service_id: str,
    test_request: ServiceTestRequest,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Test a visual service with synthetic patient data"""
    return await service.test_visual_service(service_id=service_id, test_request=test_request, current_user=current_user)


# Service Deployment

@router.post("/services/{service_id}/deploy")
async def deploy_visual_service(
    service_id: str,
    deployment: ServiceDeploymentRequest,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Deploy a visual service to production"""
    return await service.deploy_visual_service(service_id=service_id, deployment=deployment, current_user=current_user)


@router.post("/services/{service_id}/deactivate")
async def deactivate_visual_service(
    service_id: str,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Deactivate a deployed visual service"""
    return await service.deactivate_visual_service(service_id=service_id, current_user=current_user)


# Analytics and Monitoring

@router.get("/services/{service_id}/analytics", response_model=ServiceAnalytics)
async def get_service_analytics(
    service_id: str,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Get analytics for a visual service"""
    return await service.get_service_analytics(service_id=service_id, current_user=current_user)


# External Service Registration

@router.post("/external-services/register", response_model=ExternalServiceResponse)
async def register_external_service(
    registration: ExternalServiceRegistration,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Register an external CDS Hooks service discovered from a remote server"""
    return await service.register_external_service(registration=registration, current_user=current_user)


# =============================================================================
# CQL Authoring Endpoints (Phase 1 of student CQL feature)
# =============================================================================
# Three small endpoints used by the CQL editor in CDS Studio:
#  - /cql/validate          → live syntax + reference validation via HAPI's $cql
#  - /cql/data-requirements → derive prefetch templates from CQL via $data-requirements
#  - /services/{id}/fhir-preview → show generated Library + PlanDefinition JSON


@router.post("/cql/validate", response_model=_CQLValidateResponse)
async def validate_cql_text(
    body: _CQLValidateRequest,
    bridge: CQLBridge = Depends(get_cql_bridge),
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Run student CQL through HAPI's `$cql` to surface compile/runtime errors."""
    return await service.validate_cql_text(body=body, bridge=bridge, current_user=current_user)


@router.post("/cql/data-requirements", response_model=_CQLDataReqResponse)
async def derive_prefetch_from_cql(
    body: _CQLDataReqRequest,
    bridge: CQLBridge = Depends(get_cql_bridge),
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Upload student CQL as an ephemeral library, ask HAPI for its data needs,"""
    return await service.derive_prefetch_from_cql(body=body, bridge=bridge, current_user=current_user)


@router.get("/services/{service_id}/fhir-preview", response_model=_FHIRPreviewResponse)
async def get_service_fhir_preview(
    service_id: str,
    current_user: User = Depends(get_current_user_or_demo),
    service: VisualBuilderService = Depends(get_visual_builder_service),
):
    """Show what the generated FHIR Library + PlanDefinition look like."""
    return await service.get_service_fhir_preview(service_id=service_id, current_user=current_user)
