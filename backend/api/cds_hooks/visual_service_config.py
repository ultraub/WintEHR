"""
Visual Service Configuration Model

Stores visual builder service configurations in the database.
Provides persistence and retrieval for visually-built CDS services.

Educational notes:
- Demonstrates JSON column usage for flexible schema storage
- Shows relationship between visual config and generated code
- Integrates with existing CDS hooks infrastructure
"""

from sqlalchemy import Column, String, JSON, DateTime, Boolean, Text, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum
import uuid

Base = declarative_base()


class ServiceStatus(str, Enum):
    """Service lifecycle status"""
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class ServiceType(str, Enum):
    """Visual service types matching frontend"""
    CONDITION_BASED = "condition-based"
    MEDICATION_BASED = "medication-based"
    LAB_VALUE_BASED = "lab-value-based"
    PREVENTIVE_CARE = "preventive-care"
    RISK_ASSESSMENT = "risk-assessment"
    WORKFLOW_AUTOMATION = "workflow-automation"


class VisualServiceConfig(Base):
    """
    Database model for visual service configurations

    Educational aspects:
    - Uses JSON columns for flexible schema storage
    - Tracks creation/modification metadata
    - Supports versioning and templates
    - Links to generated Python code
    """
    __tablename__ = "cds_visual_service_configs"

    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Service identification
    service_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    version = Column(String(50), default="1.0.0")

    # Service type and classification
    service_type = Column(SQLEnum(ServiceType), nullable=False, index=True)
    category = Column(String(100), nullable=True)
    template_id = Column(String(100), nullable=True, index=True)

    # CDS Hook configuration
    hook_type = Column(String(100), nullable=False, index=True)  # patient-view, medication-prescribe, etc.

    # Visual configuration (JSON columns)
    conditions = Column(JSON, nullable=False)  # Nested condition structure
    card = Column(JSON, nullable=False)  # Card design configuration
    display_config = Column(JSON, nullable=False)  # Display behavior settings
    prefetch = Column(JSON, nullable=True)  # FHIR prefetch templates

    # Generated code
    generated_code = Column(Text, nullable=True)  # Python code for the service
    code_hash = Column(String(64), nullable=True)  # Hash of generated code for change detection

    # Status and lifecycle
    status = Column(SQLEnum(ServiceStatus), default=ServiceStatus.DRAFT, index=True)
    is_active = Column(Boolean, default=False, index=True)

    # Metadata
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Deployment tracking
    deployed_at = Column(DateTime, nullable=True)
    deployed_by = Column(String(100), nullable=True)
    last_executed_at = Column(DateTime, nullable=True)
    execution_count = Column(JSON, default=dict)  # {"total": 0, "by_date": {}}

    # Analytics and performance
    analytics = Column(JSON, default=dict)  # Execution metrics, card acceptance rates, etc.

    def __repr__(self):
        return f"<VisualServiceConfig(id={self.id}, service_id={self.service_id}, status={self.status})>"


# Pydantic models for API validation

class ConditionBlock(BaseModel):
    """Single condition in the visual builder"""
    type: str = "condition"
    dataSource: str
    operator: str
    value: Any
    catalogSelection: Optional[Dict[str, Any]] = None


class ConditionGroup(BaseModel):
    """Group of conditions with logical operator"""
    type: str = "group"
    operator: str  # AND, OR, NOT
    conditions: List[Any]  # Can contain ConditionBlock or nested ConditionGroup


class CardAction(BaseModel):
    """Action within a card suggestion"""
    type: str  # create, update, delete
    description: str
    resource: Optional[Dict[str, Any]] = None
    resourceId: Optional[str] = None


class CardSuggestion(BaseModel):
    """Suggestion in a CDS card"""
    label: str
    isRecommended: bool = False
    actions: List[CardAction] = []


class CardLink(BaseModel):
    """Link in a CDS card"""
    label: str
    url: str
    type: str = "absolute"  # absolute or smart
    appContext: Optional[str] = None


class CardSource(BaseModel):
    """Source attribution for a card"""
    label: str
    url: Optional[str] = None
    icon: Optional[str] = None


class CardConfiguration(BaseModel):
    """Complete card design configuration"""
    summary: str
    detail: str
    indicator: str  # info, warning, critical
    source: CardSource
    suggestions: List[CardSuggestion] = []
    links: List[CardLink] = []


class DisplayConfiguration(BaseModel):
    """EMR-side display behavior configuration"""
    presentationMode: str
    acknowledgmentRequired: bool = False
    reasonRequired: bool = False
    overrideReasons: List[Dict[str, str]] = []
    allowSnooze: bool = False
    snoozeDurations: List[int] = []
    autoHide: bool = False
    hideDelay: int = 5000
    maxAlerts: int = 5
    position: Optional[str] = None
    allowInteraction: bool = True
    backdrop: str = "dismissible"


class VisualServiceConfigCreate(BaseModel):
    """Request model for creating a visual service configuration"""
    service_id: str = Field(..., description="Unique service identifier")
    name: str = Field(..., description="Human-readable service name")
    description: Optional[str] = Field(None, description="Service description")
    service_type: ServiceType = Field(..., description="Type of service")
    category: Optional[str] = Field(None, description="Service category")
    template_id: Optional[str] = Field(None, description="Template this was based on")
    hook_type: str = Field(..., description="CDS Hook type")

    conditions: List[ConditionGroup] = Field(..., description="Service conditions")
    card: CardConfiguration = Field(..., description="Card configuration")
    display_config: DisplayConfiguration = Field(..., description="Display configuration")
    prefetch: Optional[Dict[str, str]] = Field(None, description="FHIR prefetch templates")

    created_by: str = Field(..., description="User who created this")


class VisualServiceConfigUpdate(BaseModel):
    """Request model for updating a visual service configuration"""
    name: Optional[str] = None
    description: Optional[str] = None
    service_type: Optional[ServiceType] = None
    category: Optional[str] = None
    hook_type: Optional[str] = None

    conditions: Optional[List[ConditionGroup]] = None
    card: Optional[CardConfiguration] = None
    display_config: Optional[DisplayConfiguration] = None
    prefetch: Optional[Dict[str, str]] = None

    status: Optional[ServiceStatus] = None
    is_active: Optional[bool] = None

    updated_by: str = Field(..., description="User making this update")


class VisualServiceConfigResponse(BaseModel):
    """Response model for visual service configuration"""
    id: str
    service_id: str
    name: str
    description: Optional[str]
    version: str
    service_type: ServiceType
    category: Optional[str]
    template_id: Optional[str]
    hook_type: str

    conditions: List[Dict[str, Any]]
    card: Dict[str, Any]
    display_config: Dict[str, Any]
    prefetch: Optional[Dict[str, str]]

    generated_code: Optional[str]
    code_hash: Optional[str]

    status: ServiceStatus
    is_active: bool

    created_by: str
    created_at: datetime
    updated_by: Optional[str]
    updated_at: datetime

    deployed_at: Optional[datetime]
    deployed_by: Optional[str]
    last_executed_at: Optional[datetime]
    execution_count: Dict[str, Any]
    analytics: Dict[str, Any]

    class Config:
        orm_mode = True


class ServiceDeploymentRequest(BaseModel):
    """Request to deploy a visual service to production"""
    service_id: str
    deployed_by: str
    notes: Optional[str] = None


class ServiceTestRequest(BaseModel):
    """Request to test a service with synthetic data"""
    service_id: str
    patient_id: str
    context: Optional[Dict[str, Any]] = None


class ServiceTestResponse(BaseModel):
    """Response from service testing"""
    service_id: str
    patient_id: str
    executed: bool
    cards: List[Dict[str, Any]]
    execution_time_ms: float
    errors: List[str] = []
    warnings: List[str] = []


class ServiceAnalytics(BaseModel):
    """Analytics for a visual service"""
    service_id: str
    total_executions: int
    cards_shown: int
    cards_accepted: int
    cards_dismissed: int
    acceptance_rate: float
    average_execution_time_ms: float
    execution_by_date: Dict[str, int]
    top_override_reasons: List[Dict[str, Any]]


# Helper functions for working with visual configs

def create_default_prefetch(service_type: ServiceType, hook_type: str) -> Dict[str, str]:
    """
    Generate default FHIR prefetch templates based on service type

    Educational notes:
    - Different service types need different FHIR resources
    - Prefetch optimizes CDS service performance
    - Templates use CDS Hooks variable substitution
    """
    base_prefetch = {
        "patient": "Patient/{{context.patientId}}"
    }

    if service_type == ServiceType.CONDITION_BASED:
        base_prefetch.update({
            "conditions": "Condition?patient={{context.patientId}}&clinical-status=active",
            "encounters": "Encounter?patient={{context.patientId}}&_count=10&_sort=-date"
        })

    elif service_type == ServiceType.MEDICATION_BASED:
        base_prefetch.update({
            "medications": "MedicationRequest?patient={{context.patientId}}&status=active",
            "allergies": "AllergyIntolerance?patient={{context.patientId}}&clinical-status=active"
        })

    elif service_type == ServiceType.LAB_VALUE_BASED:
        base_prefetch.update({
            "observations": "Observation?patient={{context.patientId}}&category=laboratory&_count=20&_sort=-date"
        })

    elif service_type == ServiceType.PREVENTIVE_CARE:
        base_prefetch.update({
            "observations": "Observation?patient={{context.patientId}}&_count=50&_sort=-date",
            "procedures": "Procedure?patient={{context.patientId}}&_count=20&_sort=-date"
        })

    return base_prefetch


def generate_service_id(name: str) -> str:
    """
    Generate a service ID from a name

    Educational notes:
    - Service IDs must be URL-safe
    - Should be human-readable for debugging
    - Must be unique within the system
    """
    import re
    # Convert to lowercase, replace spaces/special chars with hyphens
    service_id = name.lower()
    service_id = re.sub(r'[^a-z0-9-]', '-', service_id)
    service_id = re.sub(r'-+', '-', service_id).strip('-')
    return service_id


def validate_condition_structure(conditions: List[Dict[str, Any]]) -> tuple[bool, List[str]]:
    """
    Validate condition structure for completeness

    Returns: (is_valid, error_messages)
    """
    errors = []

    if not conditions or len(conditions) == 0:
        errors.append("At least one condition group is required")
        return False, errors

    # Check root group
    root = conditions[0]
    if root.get("type") != "group":
        errors.append("Root must be a condition group")

    # Validate nested structure (recursive validation would go here)
    def validate_group(group, path="root"):
        if not group.get("operator"):
            errors.append(f"{path}: Missing logical operator")

        for idx, condition in enumerate(group.get("conditions", [])):
            condition_path = f"{path}.{idx}"

            if condition.get("type") == "group":
                validate_group(condition, condition_path)
            elif condition.get("type") == "condition":
                if not condition.get("dataSource"):
                    errors.append(f"{condition_path}: Missing data source")
                if not condition.get("operator"):
                    errors.append(f"{condition_path}: Missing operator")
            else:
                errors.append(f"{condition_path}: Unknown condition type")

    validate_group(root)

    return len(errors) == 0, errors
