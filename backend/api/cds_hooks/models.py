"""
CDS Hooks Data Models
Implements CDS Hooks 2.0 specification data models
"""

from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum


class HookType(str, Enum):
    """Standard CDS Hook types - CDS Hooks 2.0"""
    # Standard hooks in CDS Hooks 2.0
    PATIENT_VIEW = "patient-view"
    MEDICATION_PRESCRIBE = "medication-prescribe"
    ORDER_SIGN = "order-sign"
    ORDER_SELECT = "order-select"
    ENCOUNTER_START = "encounter-start"
    ENCOUNTER_DISCHARGE = "encounter-discharge"
    ALLERGYINTOLERANCE_CREATE = "allergyintolerance-create"
    APPOINTMENT_BOOK = "appointment-book"
    MEDICATION_REFILL = "medication-refill"
    ORDER_DISPATCH = "order-dispatch"
    PROBLEM_LIST_ITEM_CREATE = "problem-list-item-create"


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


class PrefetchFailureMode(str, Enum):
    """Prefetch failure mode - CDS Hooks 2.0 (HAPI FHIR v8.2.0+)

    Determines behavior when prefetch query fails:
    - FAIL: Return error, service cannot execute
    - OMIT: Omit failed prefetch, continue with available data
    - OPERATION_OUTCOME: Include OperationOutcome resource for failed prefetch
    """
    FAIL = "fail"
    OMIT = "omit"
    OPERATION_OUTCOME = "operation-outcome"


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


class OrderSignContext(BaseModel):
    """Context for order-sign hook"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    draftOrders: List[Dict[str, Any]] = Field([], description="Draft order resources")


class OrderSelectContext(BaseModel):
    """Context for order-select hook"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    selections: List[str] = Field([], description="Selected order references")
    draftOrders: Optional[List[Dict[str, Any]]] = Field(None, description="Draft order resources")


class EncounterStartContext(BaseModel):
    """Context for encounter-start hook"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: str = Field(..., description="FHIR Encounter ID")


class EncounterDischargeContext(BaseModel):
    """Context for encounter-discharge hook"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: str = Field(..., description="FHIR Encounter ID")


class MedicationPrescribeContext(BaseModel):
    """Context for medication-prescribe hook"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    medications: List[Dict[str, Any]] = Field(..., description="Draft MedicationRequest resources")


class AllergyIntoleranceCreateContext(BaseModel):
    """Context for allergyintolerance-create hook (CDS Hooks 2.0)"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    allergyIntolerance: Dict[str, Any] = Field(..., description="Draft AllergyIntolerance resource")


class AppointmentBookContext(BaseModel):
    """Context for appointment-book hook (CDS Hooks 2.0)"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    appointments: List[Dict[str, Any]] = Field(..., description="Draft Appointment resources")


class MedicationRefillContext(BaseModel):
    """Context for medication-refill hook (CDS Hooks 2.0)"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    medications: List[Dict[str, Any]] = Field(..., description="Medication resources for refill")


class OrderDispatchContext(BaseModel):
    """Context for order-dispatch hook (CDS Hooks 2.0)"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    order: Dict[str, Any] = Field(..., description="Order being dispatched")


class ProblemListItemCreateContext(BaseModel):
    """Context for problem-list-item-create hook (CDS Hooks 2.0)"""
    patientId: str = Field(..., description="FHIR Patient ID")
    userId: str = Field(..., description="FHIR Practitioner ID")
    encounterId: Optional[str] = Field(None, description="FHIR Encounter ID")
    condition: Dict[str, Any] = Field(..., description="Draft Condition resource")


class FHIRAuthorization(BaseModel):
    """FHIR authorization information"""
    access_token: str = Field(..., description="OAuth2 access token")
    token_type: str = Field("Bearer", description="Token type")
    expires_in: Optional[int] = Field(None, description="Token expiration in seconds")
    scope: str = Field(..., description="OAuth2 scope")


class CDSHookRequest(BaseModel):
    """CDS Hook request format - CDS Hooks 2.0"""
    hook: HookType = Field(..., description="Hook type")
    hookInstance: str = Field(..., description="Unique hook instance ID (UUID)")
    context: Dict[str, Any] = Field(..., description="Hook context")
    fhirServer: Optional[str] = Field(None, description="FHIR server base URL (must use HTTPS)")
    fhirAuthorization: Optional[FHIRAuthorization] = Field(None, description="FHIR authorization")
    prefetch: Optional[Dict[str, Any]] = Field(None, description="Prefetched FHIR resources")
    
    @validator('fhirServer')
    def validate_https(cls, v):
        """CDS Hooks 2.0 requires HTTPS for fhirServer"""
        if v and not v.startswith('https://'):
            raise ValueError('fhirServer must use HTTPS scheme in CDS Hooks 2.0')
        return v
    
    @validator('hookInstance')
    def validate_hook_instance(cls, v):
        """Validate hookInstance is a valid UUID format"""
        import uuid
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError('hookInstance must be a valid UUID')
        return v


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


class OverrideReason(BaseModel):
    """Override reason for CDS Hooks 2.0"""
    code: str = Field(..., description="Code for override reason")
    system: Optional[str] = Field(None, description="Code system")
    display: Optional[str] = Field(None, description="Human-readable display")


class Card(BaseModel):
    """CDS Hook card - CDS Hooks 2.0"""
    uuid: str = Field(..., description="Card UUID (required in 2.0)")
    summary: str = Field(..., max_length=140, description="Brief summary")
    indicator: IndicatorType = Field(..., description="Urgency indicator")
    source: Source = Field(..., description="Source information")
    detail: Optional[str] = Field(None, description="Detailed information (markdown)")
    suggestions: Optional[List[Suggestion]] = Field(None, description="Suggested actions")
    links: Optional[List[Link]] = Field(None, description="External links")
    selectionBehavior: Optional[SelectionBehavior] = Field(None, description="Selection behavior")
    overrideReasons: Optional[List[OverrideReason]] = Field(None, description="Reasons for overriding (CDS Hooks 2.0)")
    
    @validator('uuid')
    def validate_uuid(cls, v):
        """Validate UUID format"""
        import uuid
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError('Card uuid must be a valid UUID')
        return v


class SystemAction(BaseModel):
    """System action for auto-applying changes - CDS Hooks 2.0"""
    type: str = Field(..., description="Action type (create, update, delete)")
    resource: Dict[str, Any] = Field(..., description="FHIR resource to apply")


class CDSHookResponse(BaseModel):
    """CDS Hook response format - CDS Hooks 2.0"""
    cards: List[Card] = Field([], description="Decision support cards")
    systemActions: Optional[List[SystemAction]] = Field(None, description="System actions to auto-apply")


# Discovery Models
class PrefetchItem(BaseModel):
    """Prefetch item with optional failureMode - CDS Hooks 2.0"""
    query: str = Field(..., description="FHIR query template")
    failureMode: Optional[PrefetchFailureMode] = Field(
        PrefetchFailureMode.OMIT,
        description="Behavior when prefetch fails (CDS Hooks 2.0, HAPI FHIR v8.2.0+)"
    )


class Prefetch(BaseModel):
    """Prefetch configuration - supports both simple templates and CDS Hooks 2.0 format"""
    pass  # This is a flexible object - can contain any FHIR queries


class CDSService(BaseModel):
    """CDS Service definition - CDS Hooks 2.0 compliant"""
    hook: HookType = Field(..., description="Hook type")
    title: Optional[str] = Field(None, description="Human-readable title")
    description: str = Field(..., description="Service description")
    id: str = Field(..., description="Service identifier")
    prefetch: Optional[Dict[str, Union[str, PrefetchItem]]] = Field(
        None,
        description="Prefetch templates (string or PrefetchItem with failureMode)"
    )
    usageRequirements: Optional[str] = Field(None, description="Usage requirements")


class CDSServicesResponse(BaseModel):
    """CDS Services discovery response"""
    services: List[CDSService] = Field(..., description="Available services")


# Feedback Models - CDS Hooks 2.0
class FeedbackOutcome(str, Enum):
    """Feedback outcome types"""
    ACCEPTED = "accepted"
    OVERRIDDEN = "overridden"


class FeedbackOverrideReason(BaseModel):
    """Override reason in feedback - CDS Hooks 2.0"""
    key: str = Field(..., description="Reason identifier provided by service")
    userComment: Optional[str] = Field(None, description="Optional free text field")


class AcceptedSuggestion(BaseModel):
    """Accepted suggestion in feedback"""
    id: str = Field(..., description="Suggestion UUID")


class FeedbackItem(BaseModel):
    """Individual feedback item - CDS Hooks 2.0"""
    card: str = Field(..., description="Card UUID")
    outcome: FeedbackOutcome = Field(..., description="Outcome (accepted or overridden)")
    outcomeTimestamp: datetime = Field(..., description="ISO timestamp in UTC")
    acceptedSuggestions: Optional[List[AcceptedSuggestion]] = Field(None, description="Accepted suggestions (when outcome is accepted)")
    overrideReason: Optional[FeedbackOverrideReason] = Field(None, description="Override reason (when outcome is overridden)")
    
    @validator('acceptedSuggestions')
    def validate_accepted_suggestions(cls, v, values):
        """Accepted suggestions only valid when outcome is accepted"""
        if v and values.get('outcome') != FeedbackOutcome.ACCEPTED:
            raise ValueError('acceptedSuggestions can only be provided when outcome is accepted')
        return v
    
    @validator('overrideReason')
    def validate_override_reason(cls, v, values):
        """Override reason only valid when outcome is overridden"""
        if v and values.get('outcome') != FeedbackOutcome.OVERRIDDEN:
            raise ValueError('overrideReason can only be provided when outcome is overridden')
        return v


class FeedbackRequest(BaseModel):
    """Feedback request - CDS Hooks 2.0"""
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