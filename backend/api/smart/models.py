"""
SMART on FHIR Pydantic Models

Request/response models for SMART authorization server endpoints.
Based on SMART App Launch Implementation Guide v2.1.0
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, HttpUrl, validator
from datetime import datetime
from enum import Enum


class GrantType(str, Enum):
    """OAuth2 grant types supported"""
    AUTHORIZATION_CODE = "authorization_code"
    REFRESH_TOKEN = "refresh_token"


class ResponseType(str, Enum):
    """OAuth2 response types supported"""
    CODE = "code"


class LaunchType(str, Enum):
    """SMART launch types"""
    EHR_LAUNCH = "ehr_launch"
    STANDALONE = "standalone"


# ============================================================
# SMART Configuration (Discovery)
# ============================================================

class SMARTConfiguration(BaseModel):
    """
    SMART configuration for /.well-known/smart-configuration endpoint

    Per SMART App Launch v2.1.0 specification
    """
    issuer: str = Field(..., description="Authorization server issuer URL")
    authorization_endpoint: str = Field(..., description="OAuth2 authorization endpoint")
    token_endpoint: str = Field(..., description="OAuth2 token endpoint")

    # Supported features
    token_endpoint_auth_methods_supported: List[str] = Field(
        default=["client_secret_basic", "client_secret_post", "none"],
        description="Token endpoint authentication methods"
    )
    registration_endpoint: Optional[str] = Field(None, description="Dynamic client registration")

    scopes_supported: List[str] = Field(
        default=[
            "openid", "fhirUser", "profile", "offline_access", "online_access",
            "launch", "launch/patient", "launch/encounter",
            "patient/*.read", "patient/*.write",
            "user/*.read", "user/*.write"
        ],
        description="Supported SMART scopes"
    )

    response_types_supported: List[str] = Field(
        default=["code"],
        description="OAuth2 response types"
    )

    capabilities: List[str] = Field(
        default=[
            "launch-ehr",
            "launch-standalone",
            "client-public",
            "client-confidential-symmetric",
            "context-ehr-patient",
            "context-ehr-encounter",
            "context-standalone-patient",
            "permission-patient",
            "permission-user",
            "sso-openid-connect"
        ],
        description="SMART capabilities"
    )

    code_challenge_methods_supported: List[str] = Field(
        default=["S256"],
        description="PKCE code challenge methods"
    )


# ============================================================
# Authorization Request/Response
# ============================================================

class AuthorizationRequest(BaseModel):
    """OAuth2 authorization request parameters"""
    response_type: ResponseType = Field(..., description="Must be 'code'")
    client_id: str = Field(..., description="Registered app client ID")
    redirect_uri: str = Field(..., description="Registered redirect URI")
    scope: str = Field(..., description="Space-separated SMART scopes")
    state: str = Field(..., description="CSRF protection state")
    aud: str = Field(..., description="FHIR server base URL")

    # Optional PKCE
    code_challenge: Optional[str] = Field(None, description="PKCE code challenge")
    code_challenge_method: Optional[Literal["S256"]] = Field(None, description="PKCE method")

    # EHR launch parameter
    launch: Optional[str] = Field(None, description="EHR launch token")


class AuthorizationResponse(BaseModel):
    """Authorization response (redirect query params)"""
    code: str = Field(..., description="Authorization code")
    state: str = Field(..., description="Original state parameter")


class AuthorizationError(BaseModel):
    """OAuth2 authorization error"""
    error: str = Field(..., description="Error code")
    error_description: Optional[str] = Field(None, description="Human-readable description")
    state: Optional[str] = Field(None, description="Original state")


# ============================================================
# Token Request/Response
# ============================================================

class TokenRequest(BaseModel):
    """OAuth2 token request"""
    grant_type: GrantType = Field(..., description="Grant type")

    # Authorization code grant
    code: Optional[str] = Field(None, description="Authorization code")
    redirect_uri: Optional[str] = Field(None, description="Must match original request")

    # Client authentication
    client_id: str = Field(..., description="Client ID")
    client_secret: Optional[str] = Field(None, description="Client secret for confidential clients")

    # PKCE
    code_verifier: Optional[str] = Field(None, description="PKCE code verifier")

    # Refresh token grant
    refresh_token: Optional[str] = Field(None, description="Refresh token")


class TokenResponse(BaseModel):
    """
    SMART token response

    Includes standard OAuth2 fields plus SMART-specific context
    """
    access_token: str = Field(..., description="JWT access token")
    token_type: Literal["Bearer"] = Field(default="Bearer")
    expires_in: int = Field(..., description="Token lifetime in seconds")
    scope: str = Field(..., description="Granted scopes")

    # Optional refresh token (if offline_access granted)
    refresh_token: Optional[str] = Field(None, description="Refresh token")

    # SMART context
    patient: Optional[str] = Field(None, description="Patient ID in context")
    encounter: Optional[str] = Field(None, description="Encounter ID in context")

    # SMART extras
    need_patient_banner: bool = Field(default=True, description="Whether app needs patient banner")
    smart_style_url: Optional[str] = Field(None, description="EHR styling URL")

    # OpenID Connect
    id_token: Optional[str] = Field(None, description="ID token if openid scope granted")


class TokenError(BaseModel):
    """OAuth2 token error"""
    error: str = Field(..., description="Error code")
    error_description: Optional[str] = Field(None)


# ============================================================
# Launch Context
# ============================================================

class LaunchRequest(BaseModel):
    """Request to create an EHR launch context"""
    app_client_id: str = Field(..., description="Target app client ID")
    patient_id: str = Field(..., description="Patient ID for context")
    encounter_id: Optional[str] = Field(None, description="Optional encounter ID")
    intent: Optional[str] = Field(None, description="Optional launch intent")
    user_id: Optional[str] = Field(None, description="Launching user ID")


class LaunchResponse(BaseModel):
    """EHR launch response"""
    launch_token: str = Field(..., description="Encoded launch token")
    launch_url: str = Field(..., description="Full launch URL with parameters")
    expires_in: int = Field(default=300, description="Launch token lifetime (seconds)")


# ============================================================
# App Registration (extends external_services models)
# ============================================================

class SMARTAppRegistration(BaseModel):
    """Enhanced SMART app registration"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None

    # OAuth2 configuration
    client_id: Optional[str] = Field(None, description="Auto-generated if not provided")
    client_type: Literal["public", "confidential"] = Field(default="public")
    redirect_uris: List[str] = Field(..., min_items=1)
    scopes: List[str] = Field(..., min_items=1)

    # SMART configuration
    launch_uri: Optional[str] = Field(None, description="App launch URL")
    logo_uri: Optional[str] = Field(None, description="App logo URL")

    # Contact info
    tos_uri: Optional[str] = None
    policy_uri: Optional[str] = None
    contacts: Optional[List[str]] = None


class SMARTAppInfo(BaseModel):
    """SMART app information for display"""
    client_id: str
    name: str
    description: Optional[str]
    logo_uri: Optional[str]
    scopes: List[str]
    launch_uri: Optional[str]
    is_active: bool = True


# ============================================================
# Consent
# ============================================================

class ConsentRequest(BaseModel):
    """User consent for app authorization"""
    session_id: str = Field(..., description="Authorization session ID")
    approved: bool = Field(..., description="Whether user approved")
    granted_scopes: Optional[List[str]] = Field(None, description="Scopes user approved")


class ConsentDisplay(BaseModel):
    """Information to display on consent screen"""
    app_name: str
    app_description: Optional[str]
    app_logo: Optional[str]
    requested_scopes: List[Dict[str, str]]  # {scope, display, description}
    patient_name: Optional[str]
    patient_id: Optional[str]


# ============================================================
# Educational Flow Tracking
# ============================================================

class FlowStep(BaseModel):
    """Single step in authorization flow (for educational display)"""
    step: int
    name: str
    timestamp: datetime
    details: Dict[str, Any] = Field(default_factory=dict)
    educational_note: Optional[str] = None
    request: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None


class FlowSession(BaseModel):
    """Complete authorization flow session"""
    session_id: str
    app_name: str
    flow_type: LaunchType
    steps: List[FlowStep] = Field(default_factory=list)
    current_step: int = 0
    completed: bool = False
    started_at: datetime
    completed_at: Optional[datetime] = None


# ============================================================
# Scope Information
# ============================================================

class ScopeInfo(BaseModel):
    """Human-readable scope information"""
    scope: str
    display: str
    description: str
    resource_types: List[str] = Field(default_factory=list)
    actions: List[str] = Field(default_factory=list)


# Standard SMART scopes with descriptions
SMART_SCOPE_DESCRIPTIONS: Dict[str, ScopeInfo] = {
    "openid": ScopeInfo(
        scope="openid",
        display="OpenID Connect",
        description="Access your user identity",
        resource_types=[],
        actions=["identify"]
    ),
    "fhirUser": ScopeInfo(
        scope="fhirUser",
        display="FHIR User",
        description="Access your FHIR user resource",
        resource_types=["Practitioner", "Patient"],
        actions=["read"]
    ),
    "profile": ScopeInfo(
        scope="profile",
        display="Profile",
        description="Access your profile information",
        resource_types=[],
        actions=["read"]
    ),
    "launch": ScopeInfo(
        scope="launch",
        display="EHR Launch",
        description="Launch from within the EHR with context",
        resource_types=[],
        actions=["launch"]
    ),
    "launch/patient": ScopeInfo(
        scope="launch/patient",
        display="Standalone Patient Selection",
        description="Select a patient when launching standalone",
        resource_types=["Patient"],
        actions=["select"]
    ),
    "offline_access": ScopeInfo(
        scope="offline_access",
        display="Offline Access",
        description="Maintain access when you're not actively using the app",
        resource_types=[],
        actions=["refresh"]
    ),
    "patient/Patient.read": ScopeInfo(
        scope="patient/Patient.read",
        display="Read Demographics",
        description="Read your name, birth date, and contact information",
        resource_types=["Patient"],
        actions=["read"]
    ),
    "patient/Observation.read": ScopeInfo(
        scope="patient/Observation.read",
        display="Read Lab Results & Vitals",
        description="Read your lab values, vital signs, and other measurements",
        resource_types=["Observation"],
        actions=["read"]
    ),
    "patient/Condition.read": ScopeInfo(
        scope="patient/Condition.read",
        display="Read Conditions",
        description="Read your diagnoses and health conditions",
        resource_types=["Condition"],
        actions=["read"]
    ),
    "patient/MedicationRequest.read": ScopeInfo(
        scope="patient/MedicationRequest.read",
        display="Read Medications",
        description="Read your current and past medications",
        resource_types=["MedicationRequest"],
        actions=["read"]
    ),
    "patient/AllergyIntolerance.read": ScopeInfo(
        scope="patient/AllergyIntolerance.read",
        display="Read Allergies",
        description="Read your allergies and intolerances",
        resource_types=["AllergyIntolerance"],
        actions=["read"]
    ),
    "patient/*.read": ScopeInfo(
        scope="patient/*.read",
        display="Read All Patient Data",
        description="Read all your health information",
        resource_types=["*"],
        actions=["read"]
    ),
    "patient/*.write": ScopeInfo(
        scope="patient/*.write",
        display="Write All Patient Data",
        description="Create and modify your health information",
        resource_types=["*"],
        actions=["write", "create", "update", "delete"]
    ),
    "user/*.read": ScopeInfo(
        scope="user/*.read",
        display="Read Accessible Data",
        description="Read data for patients you have access to",
        resource_types=["*"],
        actions=["read"]
    ),
    "user/*.write": ScopeInfo(
        scope="user/*.write",
        display="Write Accessible Data",
        description="Modify data for patients you have access to",
        resource_types=["*"],
        actions=["write", "create", "update", "delete"]
    ),
}


def get_scope_info(scope: str) -> ScopeInfo:
    """Get human-readable info for a scope"""
    if scope in SMART_SCOPE_DESCRIPTIONS:
        return SMART_SCOPE_DESCRIPTIONS[scope]

    # Parse dynamic scope (e.g., patient/Observation.read)
    if "/" in scope:
        parts = scope.split("/")
        if len(parts) == 2:
            context, resource_action = parts
            if "." in resource_action:
                resource, action = resource_action.rsplit(".", 1)
                return ScopeInfo(
                    scope=scope,
                    display=f"{action.capitalize()} {resource}",
                    description=f"{action.capitalize()} {resource} resources in {context} context",
                    resource_types=[resource],
                    actions=[action]
                )

    return ScopeInfo(
        scope=scope,
        display=scope,
        description=f"Access: {scope}",
        resource_types=[],
        actions=[]
    )
