"""
CDS Studio Data Models

Pydantic models for CDS Studio API requests and responses.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, validator
from enum import Enum

# Import HookType from canonical source (CDS Hooks models)
from api.cds_hooks.models import HookType


class ServiceOrigin(str, Enum):
    """Source of CDS service"""
    BUILT_IN = "built-in"
    EXTERNAL = "external"
    CUSTOM = "custom"
    VISUAL_BUILDER = "visual-builder"


class ServiceStatus(str, Enum):
    """Service status"""
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILING = "failing"


# ============================================================================
# Service Models
# ============================================================================

class ServiceMetadata(BaseModel):
    """Basic service metadata"""
    service_id: str = Field(..., description="Unique service identifier")
    title: str = Field(..., description="Human-readable service title")
    description: Optional[str] = Field(None, description="Service description")
    hook_type: HookType = Field(..., description="CDS Hooks hook type")
    origin: ServiceOrigin = Field(..., description="Service source")
    status: ServiceStatus = Field(ServiceStatus.DRAFT, description="Current status")
    version: str = Field("1.0.0", description="Service version")

    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None


class ServiceConfiguration(BaseModel):
    """Complete service configuration"""
    metadata: ServiceMetadata

    # Configuration
    prefetch_template: Optional[Dict[str, str]] = Field(
        None,
        description="FHIR prefetch queries"
    )
    python_class_path: Optional[str] = Field(
        None,
        description="Python class path for built-in services"
    )
    source_code: Optional[str] = Field(
        None,
        description="Python source code for built-in services"
    )

    # FHIR integration
    plan_definition_id: Optional[str] = Field(
        None,
        description="HAPI FHIR PlanDefinition ID"
    )
    plan_definition: Optional[Dict[str, Any]] = Field(
        None,
        description="Complete PlanDefinition resource"
    )


class ServiceBreakdown(BaseModel):
    """Human-readable breakdown of service configuration"""
    service_origin: str
    service_origin_explanation: str
    hook_type: str
    hook_type_description: str
    execution_method: str
    execution_details: str
    prefetch_summary: Optional[str] = None
    extensions: List[Dict[str, Any]] = []


class ConfigurationView(BaseModel):
    """Split view of service configuration (JSON + breakdown)"""
    plan_definition_json: Dict[str, Any]
    breakdown: ServiceBreakdown


# ============================================================================
# Service Creation
# ============================================================================

class CreateBuiltInServiceRequest(BaseModel):
    """Request to create built-in CDS service"""
    service_id: str
    hook_type: HookType
    title: str
    description: Optional[str] = None
    source_code: str = Field(..., description="Python service class code")
    prefetch_template: Optional[Dict[str, str]] = None
    status: ServiceStatus = ServiceStatus.DRAFT
    version_notes: Optional[str] = None


class CreateExternalServiceRequest(BaseModel):
    """Request to register external CDS service"""
    service_id: str
    hook_type: HookType
    title: str
    description: Optional[str] = None
    url: str = Field(..., description="Full service URL from discovery")
    base_url: Optional[str] = Field(None, description="Base URL (auto-derived from url if not provided)")
    credential_id: Optional[int] = Field(
        None,
        description="ID of credential to use (or None for no auth)"
    )
    prefetch_template: Optional[Dict[str, str]] = None
    status: Optional[str] = Field("draft", description="Service status")
    version_notes: Optional[str] = Field(None, description="Version or import notes")

    @validator('base_url', always=True)
    def derive_base_url(cls, v, values):
        """
        Automatically derive base_url from url if not provided

        Example:
            url: "https://sandbox-services.cds-hooks.org/patient-greeting"
            base_url: "https://sandbox-services.cds-hooks.org" (auto-derived)
        """
        if v is None and 'url' in values:
            from urllib.parse import urlparse
            parsed = urlparse(values['url'])
            return f"{parsed.scheme}://{parsed.netloc}"
        return v


# ============================================================================
# Service Testing
# ============================================================================

class TestServiceRequest(BaseModel):
    """Request to test a CDS service"""
    patient_id: str = Field(..., description="FHIR Patient ID")
    user_id: Optional[str] = Field(None, description="FHIR Practitioner ID")
    encounter_id: Optional[str] = Field(None, description="FHIR Encounter ID")
    context_override: Optional[Dict[str, Any]] = Field(
        None,
        description="Override hook context"
    )
    prefetch_override: Optional[Dict[str, Any]] = Field(
        None,
        description="Override prefetch data"
    )


class TestServiceResponse(BaseModel):
    """Response from testing a service"""
    success: bool
    execution_time_ms: int
    cards: List[Dict[str, Any]] = []
    prefetch_data: Optional[Dict[str, Any]] = None
    logs: List[str] = []
    errors: List[str] = []


# ============================================================================
# Service Metrics
# ============================================================================

class ServiceMetrics(BaseModel):
    """Performance metrics for a service"""
    service_id: str
    total_executions: int = 0
    executions_24h: int = 0
    success_rate: float = 0.0
    avg_response_time_ms: int = 0
    p95_response_time_ms: int = 0
    p99_response_time_ms: int = 0

    # Card metrics
    cards_shown: int = 0
    cards_accepted: int = 0
    cards_overridden: int = 0
    cards_ignored: int = 0

    # Status
    status: ServiceStatus = ServiceStatus.ACTIVE
    consecutive_failures: int = 0
    last_executed: Optional[datetime] = None
    last_error: Optional[str] = None


# ============================================================================
# Service List Response
# ============================================================================

class ServiceListItem(BaseModel):
    """Service item in list view"""
    id: int
    service_id: str
    title: str
    hook_type: HookType
    origin: ServiceOrigin
    status: ServiceStatus
    version: str
    last_executed: Optional[datetime] = None
    execution_count_24h: int = 0
    success_rate: float = 0.0


class ServiceListResponse(BaseModel):
    """Response for service list endpoint"""
    services: List[ServiceListItem]
    total: int
    filters_applied: Dict[str, Any] = {}


# ============================================================================
# Versioning
# ============================================================================

class ServiceVersion(BaseModel):
    """Service version information"""
    version: str
    version_notes: Optional[str] = None
    created_at: datetime
    created_by: Optional[str] = None
    is_current: bool = False


class VersionHistoryResponse(BaseModel):
    """Service version history"""
    service_id: str
    current_version: str
    versions: List[ServiceVersion]


class RollbackRequest(BaseModel):
    """Request to rollback to a previous version"""
    target_version: str
    rollback_notes: Optional[str] = None
