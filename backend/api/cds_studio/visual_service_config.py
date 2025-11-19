"""
Visual Service Configuration Model

Stores visual builder service configurations in the database.
Provides persistence and retrieval for visually-built CDS services.

Educational notes:
- Demonstrates JSON column usage for flexible schema storage
- Shows relationship between visual config and generated code
- Integrates with existing CDS hooks infrastructure
"""

from sqlalchemy import Column, String, JSON, DateTime, Boolean, Text, Enum as SQLEnum, Integer
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
    """
    Visual service types matching frontend

    Note: This enum is for documentation only. The actual database field
    is VARCHAR(100) and accepts any string value for flexibility.
    """
    CONDITION_BASED = "condition-based"
    MEDICATION_BASED = "medication-based"
    LAB_VALUE_BASED = "lab-value-based"
    PREVENTIVE_CARE = "preventive-care"
    RISK_ASSESSMENT = "risk-assessment"
    WORKFLOW_AUTOMATION = "workflow-automation"
    GENERAL = "general"


class VisualServiceConfig(Base):
    """
    Database model for visual service configurations

    Educational aspects:
    - Uses JSONB columns for flexible schema storage
    - Tracks creation/modification metadata
    - Supports versioning and templates
    - Links to generated Python code

    IMPORTANT: Maps to cds_visual_builder.service_configs table
    Created by postgres-init/06_cds_visual_builder.sql migration
    """
    __tablename__ = "service_configs"
    __table_args__ = {'schema': 'cds_visual_builder'}

    # Primary key - SERIAL in database (auto-incrementing integer)
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Service identification
    service_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(500), nullable=False)  # DB has VARCHAR(500)
    description = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)  # DB has INTEGER, not VARCHAR

    # Service type and classification
    service_type = Column(String(100), nullable=False, index=True)  # DB uses VARCHAR, not ENUM
    category = Column(String(100), nullable=True)
    # Note: template_id column does NOT exist in database schema - removed

    # CDS Hook configuration
    hook_type = Column(String(100), nullable=False, index=True)

    # Visual configuration (JSONB columns) - COLUMN NAME MAPPINGS
    conditions = Column(JSON, nullable=False, server_default='[]')  # Nested condition structure
    card_config = Column(JSON, nullable=False, name='card_config')  # DB column: card_config
    display_config = Column(JSON, nullable=False, server_default='{}')  # Display behavior settings
    prefetch_config = Column(JSON, nullable=True, server_default='{}', name='prefetch_config')  # DB column: prefetch_config

    # Generated code
    generated_code = Column(Text, nullable=True)
    code_hash = Column(String(64), nullable=True)

    # Status and lifecycle - DB uses VARCHAR(50), not ENUM
    status = Column(String(50), nullable=False, server_default='DRAFT', index=True)

    # Note: is_active column does NOT exist in database - removed from model

    # Metadata
    created_by = Column(String(255), nullable=True)  # DB has VARCHAR(255), nullable
    created_at = Column(DateTime(timezone=True), server_default='now()', nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default='now()', nullable=True)

    # Deployment tracking
    last_deployed_at = Column(DateTime(timezone=True), nullable=True, name='last_deployed_at')  # DB column name

    # Soft delete support (from DB schema)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(String(255), nullable=True)

    # Note: deployed_by, last_executed_at, execution_count, analytics columns do NOT exist in database
    # These were in the Python model but not in the SQL migration - removed

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
    name: str = Field(..., description="Human-readable service name", max_length=500)
    description: Optional[str] = Field(None, description="Service description")
    service_type: str = Field(..., description="Type of service", max_length=100)  # Changed from enum to str
    category: Optional[str] = Field(None, description="Service category", max_length=100)
    # Note: template_id removed - not in database schema
    hook_type: str = Field(..., description="CDS Hook type", max_length=100)

    conditions: List[ConditionGroup] = Field(..., description="Service conditions")
    card_config: CardConfiguration = Field(..., description="Card configuration", alias="card")  # Renamed to match DB
    display_config: DisplayConfiguration = Field(..., description="Display configuration")
    prefetch_config: Optional[Dict[str, str]] = Field(None, description="FHIR prefetch templates", alias="prefetch")  # Renamed to match DB

    created_by: Optional[str] = Field(None, description="User who created this", max_length=255)  # Made optional

    class Config:
        populate_by_name = True  # Allow both card and card_config as field names


class VisualServiceConfigUpdate(BaseModel):
    """Request model for updating a visual service configuration"""
    name: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    service_type: Optional[str] = Field(None, max_length=100)  # Changed from enum to str
    category: Optional[str] = Field(None, max_length=100)
    hook_type: Optional[str] = Field(None, max_length=100)

    conditions: Optional[List[ConditionGroup]] = None
    card_config: Optional[CardConfiguration] = Field(None, alias="card")  # Renamed to match DB
    display_config: Optional[DisplayConfiguration] = None
    prefetch_config: Optional[Dict[str, str]] = Field(None, alias="prefetch")  # Renamed to match DB

    status: Optional[str] = Field(None, max_length=50)  # Changed from enum to str

    # Removed is_active and updated_by fields (not in DB)

    class Config:
        populate_by_name = True  # Allow both card and card_config as field names


class VisualServiceConfigResponse(BaseModel):
    """Response model for visual service configuration"""
    id: int  # Changed from str to int (SERIAL primary key)
    service_id: str
    name: str
    description: Optional[str]
    version: int  # Changed from str to int
    service_type: str  # Changed from ServiceType enum to str (DB uses VARCHAR)
    category: Optional[str]
    # Note: template_id removed - not in database schema
    hook_type: str

    conditions: List[Dict[str, Any]]
    card_config: Dict[str, Any]  # Matches DB column name
    display_config: Dict[str, Any]
    prefetch_config: Optional[Dict[str, str]]  # Matches DB column name

    generated_code: Optional[str]
    code_hash: Optional[str]

    status: str  # Changed from ServiceStatus enum to str (DB uses VARCHAR)

    created_by: Optional[str]  # Made optional (nullable in DB)
    created_at: Optional[datetime]  # Made optional
    updated_at: Optional[datetime]  # Made optional

    last_deployed_at: Optional[datetime]  # Renamed from deployed_at

    # Soft delete fields from DB
    deleted_at: Optional[datetime]
    deleted_by: Optional[str]

    # Removed fields that don't exist in database:
    # - is_active
    # - updated_by
    # - deployed_by
    # - last_executed_at
    # - execution_count
    # - analytics

    class Config:
        orm_mode = True


class ServiceDeploymentRequest(BaseModel):
    """Request to deploy a visual service to production

    Note: service_id comes from URL path parameter, not request body
    """
    deployed_by: Optional[str] = "current-user"
    notes: Optional[str] = None


class ServiceTestRequest(BaseModel):
    """Request to test a service with synthetic data

    Note: service_id comes from URL path parameter, not request body
    """
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
