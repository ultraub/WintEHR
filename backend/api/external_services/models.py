"""
External Services Data Models

Pydantic models for external FHIR service registration and management.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, HttpUrl, validator
from datetime import datetime
from enum import Enum


class ServiceType(str, Enum):
    """Types of external services"""
    CDS_HOOKS = "cds_hooks"
    SMART_APP = "smart_app"
    SUBSCRIPTION = "subscription"
    CQL_LIBRARY = "cql_library"


class ServiceStatus(str, Enum):
    """Service registration status"""
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    ERROR = "error"


class HealthStatus(str, Enum):
    """Service health status"""
    UNKNOWN = "unknown"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class AuthType(str, Enum):
    """Authentication types for external services"""
    NONE = "none"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    HMAC = "hmac"


# Base Service Models

class ExternalServiceBase(BaseModel):
    """Base model for external service"""
    name: str = Field(..., min_length=1, max_length=255, description="Service name")
    description: Optional[str] = Field(None, description="Service description")
    service_type: ServiceType = Field(..., description="Type of service")
    base_url: Optional[HttpUrl] = Field(None, description="Service base URL")
    auth_type: AuthType = Field(AuthType.NONE, description="Authentication method")
    tags: Optional[List[str]] = Field(default_factory=list, description="Service tags")
    version: Optional[str] = Field(None, description="Service version")


class ExternalServiceCreate(ExternalServiceBase):
    """Model for creating external service"""
    fhir_resource_type: Optional[str] = Field(None, description="FHIR resource type (PlanDefinition, Library, etc.)")
    credentials: Optional[Dict[str, Any]] = Field(None, description="Authentication credentials (will be encrypted)")
    owner_user_id: Optional[str] = Field(None, description="User who registered the service")


class ExternalServiceUpdate(BaseModel):
    """Model for updating external service"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    base_url: Optional[HttpUrl] = None
    status: Optional[ServiceStatus] = None
    auth_type: Optional[AuthType] = None
    credentials: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    version: Optional[str] = None


class ExternalServiceResponse(ExternalServiceBase):
    """Model for external service response"""
    id: str
    fhir_resource_type: Optional[str]
    fhir_resource_id: Optional[str]
    status: ServiceStatus
    health_status: HealthStatus
    last_health_check: Optional[datetime]
    owner_user_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    last_used_at: Optional[datetime]

    class Config:
        from_attributes = True


# CDS Hooks specific models

class CDSHookConfig(BaseModel):
    """CDS Hooks service configuration"""
    hook_type: str = Field(..., description="Hook type (patient-view, medication-prescribe, etc.)")
    hook_service_id: str = Field(..., description="Unique service ID")
    title: Optional[str] = Field(None, description="Human-readable title")
    description: Optional[str] = Field(None, description="Service description")
    prefetch_template: Optional[Dict[str, str]] = Field(default_factory=dict, description="FHIR prefetch queries")
    usage_requirements: Optional[str] = Field(None, description="Usage requirements")


class CDSHooksServiceCreate(ExternalServiceCreate):
    """Create CDS Hooks service"""
    service_type: ServiceType = Field(ServiceType.CDS_HOOKS, const=True)
    discovery_endpoint: Optional[HttpUrl] = Field(None, description="CDS discovery endpoint")
    cds_config: CDSHookConfig = Field(..., description="CDS Hooks configuration")


class CDSHooksServiceResponse(ExternalServiceResponse):
    """CDS Hooks service response"""
    discovery_endpoint: Optional[str]
    cds_config: CDSHookConfig


# Multi-Hook Registration Models

class BatchCDSHooksServiceCreate(ExternalServiceCreate):
    """
    Create CDS Hooks service with multiple hooks (batch registration)

    Enables one service to respond to multiple hook types.
    Each hook creates a separate PlanDefinition in HAPI FHIR.

    Example: A medication safety service that responds to both
    medication-prescribe and order-sign hooks.
    """
    service_type: ServiceType = Field(ServiceType.CDS_HOOKS, const=True)
    discovery_endpoint: Optional[HttpUrl] = Field(None, description="CDS discovery endpoint")
    cds_configs: List[CDSHookConfig] = Field(
        ...,
        min_items=1,
        description="Multiple CDS Hooks configurations for different hook types"
    )

    @validator('cds_configs')
    def validate_unique_hook_types(cls, v):
        """Ensure hook types are unique within the service"""
        hook_types = [config.hook_type for config in v]
        if len(hook_types) != len(set(hook_types)):
            raise ValueError("Hook types must be unique within a service")
        return v


class IncrementalHookAdd(BaseModel):
    """
    Add hook to existing CDS Hooks service (incremental registration)

    Allows adding additional hook types to an already-registered service
    without modifying existing hooks.
    """
    cds_config: CDSHookConfig = Field(..., description="New hook configuration to add")

    @validator('cds_config')
    def validate_hook_config(cls, v):
        """Ensure hook configuration is valid"""
        if not v.hook_type:
            raise ValueError("Hook type is required")
        if not v.hook_service_id:
            raise ValueError("Hook service ID is required")
        return v


class BatchCDSHooksServiceResponse(ExternalServiceResponse):
    """Response for batch-registered CDS Hooks service"""
    discovery_endpoint: Optional[str]
    cds_configs: List[CDSHookConfig]
    hook_count: int = Field(..., description="Number of registered hooks")


# SMART App specific models

class SMARTAppConfig(BaseModel):
    """SMART on FHIR application configuration"""
    client_id: str = Field(..., description="OAuth 2.0 client ID")
    redirect_uris: List[HttpUrl] = Field(..., description="Allowed redirect URIs")
    scopes: List[str] = Field(..., description="Requested FHIR scopes")
    launch_uri: Optional[HttpUrl] = Field(None, description="App launch URI")
    logo_uri: Optional[HttpUrl] = Field(None, description="App logo URI")


class SMARTAppCreate(ExternalServiceCreate):
    """Create SMART app registration"""
    service_type: ServiceType = Field(ServiceType.SMART_APP, const=True)
    smart_config: SMARTAppConfig = Field(..., description="SMART app configuration")
    client_secret: Optional[str] = Field(None, description="OAuth client secret (will be encrypted)")


class SMARTAppResponse(ExternalServiceResponse):
    """SMART app response"""
    smart_config: SMARTAppConfig


# Subscription specific models

class ChannelType(str, Enum):
    """Subscription channel types"""
    REST_HOOK = "rest-hook"
    WEBSOCKET = "websocket"
    EMAIL = "email"
    SMS = "sms"


class PayloadType(str, Enum):
    """Subscription payload types"""
    EMPTY = "empty"
    ID_ONLY = "id-only"
    FULL_RESOURCE = "full-resource"


class SubscriptionConfig(BaseModel):
    """FHIR Subscription configuration"""
    subscription_topic: str = Field(..., description="SubscriptionTopic canonical URL")
    criteria: Optional[str] = Field(None, description="FHIR search criteria")
    channel_type: ChannelType = Field(ChannelType.REST_HOOK, description="Channel type")
    payload_type: PayloadType = Field(PayloadType.ID_ONLY, description="Payload type")
    webhook_url: HttpUrl = Field(..., description="Webhook notification URL")


class SubscriptionCreate(ExternalServiceCreate):
    """Create FHIR Subscription"""
    service_type: ServiceType = Field(ServiceType.SUBSCRIPTION, const=True)
    subscription_config: SubscriptionConfig = Field(..., description="Subscription configuration")
    hmac_secret: Optional[str] = Field(None, description="HMAC secret for webhook signatures")


class SubscriptionResponse(ExternalServiceResponse):
    """Subscription response"""
    subscription_config: SubscriptionConfig


# CQL Library specific models

class CQLLibraryCreate(ExternalServiceCreate):
    """Create CQL Library service"""
    service_type: ServiceType = Field(ServiceType.CQL_LIBRARY, const=True)
    fhir_resource_type: str = Field("Library", const=True)
    library_url: HttpUrl = Field(..., description="Library canonical URL")
    cql_content: Optional[str] = Field(None, description="CQL content (base64 encoded)")


# Service execution models

class ServiceExecutionLog(BaseModel):
    """Service execution log entry"""
    id: str
    service_id: str
    execution_type: str
    execution_time: datetime
    response_time_ms: Optional[int]
    success: bool
    error_message: Optional[str]
    http_status_code: Optional[int]
    patient_id: Optional[str]
    user_id: Optional[str]

    class Config:
        from_attributes = True


class ServiceAnalytics(BaseModel):
    """Service analytics summary"""
    service_id: str
    metric_date: datetime
    total_executions: int
    successful_executions: int
    failed_executions: int
    avg_response_time_ms: Optional[float]
    min_response_time_ms: Optional[int]
    max_response_time_ms: Optional[int]
    p95_response_time_ms: Optional[int]
    timeout_count: int
    error_4xx_count: int
    error_5xx_count: int

    class Config:
        from_attributes = True


# Health check models

class HealthCheckResult(BaseModel):
    """Health check result"""
    service_id: str
    status: HealthStatus
    response_time_ms: Optional[int]
    timestamp: datetime
    error_message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


# List/Filter models

class ServiceListFilter(BaseModel):
    """Filters for listing services"""
    service_type: Optional[ServiceType] = None
    status: Optional[ServiceStatus] = None
    health_status: Optional[HealthStatus] = None
    tags: Optional[List[str]] = None
    search: Optional[str] = Field(None, description="Search by name or description")


class PaginatedServiceList(BaseModel):
    """Paginated list of services"""
    items: List[ExternalServiceResponse]
    total: int
    page: int
    page_size: int
    pages: int
