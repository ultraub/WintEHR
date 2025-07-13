"""
CDS Hooks Data Models
Implements CDS Hooks 1.0 specification data models
"""

from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class HookType(str, Enum):
    """Standard CDS Hook types"""
    PATIENT_VIEW = "patient-view"
    MEDICATION_PRESCRIBE = "medication-prescribe"
    ORDER_SIGN = "order-sign"
    ORDER_SELECT = "order-select"
    ENCOUNTER_START = "encounter-start"
    ENCOUNTER_DISCHARGE = "encounter-discharge"


class IndicatorType(str, Enum):
    """Card indicator types"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ActionType(str, Enum):
    """Action types for CDS cards"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class SelectionBehavior(str, Enum):
    """Selection behavior for suggestions"""
    AT_MOST_ONE = "at-most-one"
    ANY = "any"


class LinkType(str, Enum):
    """Link types"""
    ABSOLUTE = "absolute"
    SMART = "smart"


# Request Models
class PatientViewContext(BaseModel):
    """Context for patient-view hook"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")


class MedicationPrescribeContext(BaseModel):
    """Context for medication-prescribe hook"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    medications: List[Dict[str, Any]] = Field([], description="Draft medication resources")


class OrderSignContext(BaseModel):
    """Context for order-sign hook"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    draftOrders: List[Dict[str, Any]] = Field([], description="Draft order resources")


class FHIRAuthorization(BaseModel):
    """FHIR authorization information"""
    access_token: str = Field(..., description="OAuth2 access token")
    token_type: str = Field("Bearer", description="Token type")
    expires_in: Optional[int] = Field(None, description="Token expiration in seconds")
    scope: str = Field(..., description="OAuth2 scope")


class CDSHookRequest(BaseModel):
    """CDS Hook request format"""
    hook: HookType = Field(..., description="Hook type")
    hookInstance: str = Field(..., description="Unique hook instance ID")
    context: Dict[str, Any] = Field(..., description="Hook context")
    fhirServer: Optional[str] = Field(None, description="FHIR server base URL")
    fhirAuthorization: Optional[FHIRAuthorization] = Field(None, description="FHIR authorization")
    prefetch: Optional[Dict[str, Any]] = Field(None, description="Prefetched FHIR resources")


# Response Models
class Source(BaseModel):
    """Source information for cards"""
    label: str = Field(..., description="Human-readable name")
    url: Optional[str] = Field(None, description="Source URL")
    icon: Optional[str] = Field(None, description="Icon URL")
    topic: Optional[str] = Field(None, description="Topic code")


class Link(BaseModel):
    """Link in a card"""
    label: str = Field(..., description="Link text")
    url: str = Field(..., description="Link URL")
    type: LinkType = Field(LinkType.ABSOLUTE, description="Link type")
    appContext: Optional[str] = Field(None, description="Application context")


class Action(BaseModel):
    """Action within a suggestion"""
    type: ActionType = Field(..., description="Action type")
    description: Optional[str] = Field(None, description="Action description")
    resource: Optional[Dict[str, Any]] = Field(None, description="FHIR resource")


class Suggestion(BaseModel):
    """Suggestion within a card"""
    label: str = Field(..., description="Suggestion label")
    uuid: Optional[str] = Field(None, description="Suggestion UUID")
    actions: Optional[List[Action]] = Field(None, description="Actions to perform")
    create: Optional[List[Dict[str, Any]]] = Field(None, description="Resources to create")
    update: Optional[List[Dict[str, Any]]] = Field(None, description="Resources to update")
    delete: Optional[List[Dict[str, Any]]] = Field(None, description="Resources to delete")


class Card(BaseModel):
    """CDS Hook card"""
    summary: str = Field(..., max_length=140, description="Brief summary")
    indicator: IndicatorType = Field(..., description="Urgency indicator")
    source: Source = Field(..., description="Source information")
    detail: Optional[str] = Field(None, description="Detailed information (markdown)")
    suggestions: Optional[List[Suggestion]] = Field(None, description="Suggested actions")
    links: Optional[List[Link]] = Field(None, description="External links")
    selectionBehavior: Optional[SelectionBehavior] = Field(None, description="Selection behavior")
    uuid: Optional[str] = Field(None, description="Card UUID")


class CDSHookResponse(BaseModel):
    """CDS Hook response format"""
    cards: List[Card] = Field([], description="Decision support cards")
    systemActions: Optional[List[Action]] = Field(None, description="System actions")


# Discovery Models
class Prefetch(BaseModel):
    """Prefetch template"""
    pass  # This is a flexible object - can contain any FHIR queries


class CDSService(BaseModel):
    """CDS Service definition"""
    hook: HookType = Field(..., description="Hook type")
    title: Optional[str] = Field(None, description="Human-readable title")
    description: str = Field(..., description="Service description")
    id: str = Field(..., description="Service identifier")
    prefetch: Optional[Dict[str, str]] = Field(None, description="Prefetch templates")
    usageRequirements: Optional[str] = Field(None, description="Usage requirements")


class CDSServicesResponse(BaseModel):
    """CDS Services discovery response"""
    services: List[CDSService] = Field(..., description="Available services")


# Feedback Models
class FeedbackOutcome(str, Enum):
    """Feedback outcome types"""
    ACCEPTED = "accepted"
    OVERRIDDEN = "overridden"
    IGNORED = "ignored"


class OverrideReason(BaseModel):
    """Override reason"""
    reason: Dict[str, str] = Field(..., description="Coded reason")


class AcceptedSuggestion(BaseModel):
    """Accepted suggestion"""
    id: str = Field(..., description="Suggestion ID")


class FeedbackItem(BaseModel):
    """Individual feedback item"""
    card: str = Field(..., description="Card UUID")
    outcome: FeedbackOutcome = Field(..., description="Outcome")
    acceptedSuggestions: Optional[List[AcceptedSuggestion]] = Field(None, description="Accepted suggestions")
    overrideReasons: Optional[List[OverrideReason]] = Field(None, description="Override reasons")


class FeedbackRequest(BaseModel):
    """Feedback request"""
    feedback: List[FeedbackItem] = Field(..., description="Feedback items")


# Hook Configuration Models (for internal use)
class HookCondition(BaseModel):
    """Hook condition"""
    type: str = Field(..., description="Condition type")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Condition parameters")


class HookAction(BaseModel):
    """Hook action"""
    type: str = Field(..., description="Action type")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Action parameters")


class HookConfiguration(BaseModel):
    """Hook configuration (internal)"""
    id: str = Field(..., description="Hook ID")
    hook: HookType = Field(..., description="Hook type")
    title: Optional[str] = Field(None, description="Hook title")
    description: str = Field(..., description="Hook description")
    enabled: bool = Field(True, description="Hook enabled")
    conditions: List[HookCondition] = Field(default_factory=list, description="Hook conditions")
    actions: List[HookAction] = Field(default_factory=list, description="Hook actions")
    prefetch: Optional[Dict[str, str]] = Field(None, description="Prefetch templates")
    usageRequirements: Optional[str] = Field(None, description="Usage requirements")
    displayBehavior: Optional[Dict[str, Any]] = Field(None, description="Display behavior configuration")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Update timestamp")