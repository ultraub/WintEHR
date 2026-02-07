"""
SMART on FHIR Authorization Server

Core OAuth2 authorization server implementing SMART App Launch.
Based on SMART App Launch Implementation Guide v2.1.0

Educational Purpose:
- Demonstrates OAuth2 authorization code flow
- Shows PKCE (Proof Key for Code Exchange) implementation
- Provides EHR launch and standalone launch patterns
- Tracks flow steps for educational visualization

Flow Types:
1. EHR Launch: App launched from within EHR with patient context
2. Standalone Launch: App launched independently, may pick patient

Authorization Flow Steps:
1. App redirects to /authorize with parameters
2. User authenticates and consents
3. Server redirects back with authorization code
4. App exchanges code for tokens at /token
5. App accesses FHIR resources with access token
"""

import secrets
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from enum import Enum
import logging
from urllib.parse import urlencode, urlparse

from .models import (
    AuthorizationRequest, AuthorizationResponse, AuthorizationError,
    TokenRequest, TokenResponse, TokenError,
    LaunchRequest, LaunchResponse,
    FlowStep, FlowSession, LaunchType, GrantType,
    SMARTConfiguration, ConsentDisplay,
    get_scope_info
)
from .token_service import SMARTTokenService, TokenType
from .scope_handler import (
    SMARTScopeHandler, parse_scopes, validate_scopes, ParsedScope
)

logger = logging.getLogger(__name__)


class AuthorizationErrorCode(str, Enum):
    """OAuth2 error codes"""
    INVALID_REQUEST = "invalid_request"
    UNAUTHORIZED_CLIENT = "unauthorized_client"
    ACCESS_DENIED = "access_denied"
    UNSUPPORTED_RESPONSE_TYPE = "unsupported_response_type"
    INVALID_SCOPE = "invalid_scope"
    SERVER_ERROR = "server_error"
    INVALID_GRANT = "invalid_grant"
    INVALID_CLIENT = "invalid_client"


@dataclass
class RegisteredApp:
    """
    Registered SMART application

    Educational notes:
    Before apps can use OAuth2, they must be registered with:
    - client_id: Unique identifier for the app
    - redirect_uris: Allowed redirect URLs (security measure)
    - scopes: What data access the app can request
    - client_type: public (no secret) or confidential (has secret)
    """
    client_id: str
    name: str
    redirect_uris: List[str]
    scopes: List[str]
    client_type: str = "public"  # public or confidential
    client_secret: Optional[str] = None
    launch_uri: Optional[str] = None
    logo_uri: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


@dataclass
class AuthorizationSession:
    """
    In-progress authorization session

    Educational notes:
    This tracks the state of an authorization flow:
    - Before user consents (pending)
    - After user consents but before code exchange (authorized)
    - After code is exchanged (completed)

    The session stores PKCE challenge for verification at token exchange.
    """
    session_id: str
    client_id: str
    redirect_uri: str
    scope: str
    state: str
    response_type: str

    # PKCE
    code_challenge: Optional[str] = None
    code_challenge_method: Optional[str] = None

    # Context
    patient_id: Optional[str] = None
    encounter_id: Optional[str] = None
    user_id: Optional[str] = None
    launch_token: Optional[str] = None

    # Authorization code
    authorization_code: Optional[str] = None
    code_expires_at: Optional[datetime] = None

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    authorized_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Educational flow tracking
    flow_steps: List[FlowStep] = field(default_factory=list)


@dataclass
class LaunchContext:
    """
    EHR launch context

    Educational notes:
    When launching from an EHR, context is passed via opaque token:
    - patient_id: The patient the user is viewing
    - encounter_id: Current encounter (if any)
    - user_id: The user launching the app
    - intent: What the app should do (e.g., 'reconcile-medications')
    """
    launch_id: str
    app_client_id: str
    patient_id: str
    encounter_id: Optional[str] = None
    user_id: Optional[str] = None
    intent: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(minutes=5))


class SMARTAuthorizationServer:
    """
    SMART on FHIR Authorization Server

    Educational Purpose:
    This server implements the OAuth2 authorization code flow with
    SMART on FHIR extensions. It demonstrates:

    1. Authorization Endpoint (/authorize)
       - Validates request parameters
       - Creates authorization session
       - Redirects to consent screen
       - Issues authorization code after consent

    2. Token Endpoint (/token)
       - Validates authorization code
       - Verifies PKCE
       - Issues access token and refresh token
       - Returns SMART context (patient, encounter)

    3. Launch Endpoint (/launch)
       - Creates EHR launch context
       - Generates launch token
       - Returns launch URL for app
    """

    # Authorization code lifetime (short for security)
    CODE_LIFETIME = timedelta(minutes=10)

    def __init__(
        self,
        base_url: str,
        fhir_url: str,
        token_service: SMARTTokenService
    ):
        """
        Initialize authorization server

        Args:
            base_url: Base URL for authorization endpoints
            fhir_url: FHIR server base URL
            token_service: Token service for JWT management
        """
        self.base_url = base_url.rstrip('/')
        self.fhir_url = fhir_url.rstrip('/')
        self.token_service = token_service
        self.scope_handler = SMARTScopeHandler()

        # In-memory storage (use database in production)
        self._registered_apps: Dict[str, RegisteredApp] = {}
        self._sessions: Dict[str, AuthorizationSession] = {}
        self._launch_contexts: Dict[str, LaunchContext] = {}

        # Register demo apps for educational use
        self._register_demo_apps()

    def _register_demo_apps(self):
        """Register demo SMART apps for testing"""
        # Growth Chart App
        self.register_app(RegisteredApp(
            client_id="growth-chart-app",
            name="Growth Chart",
            redirect_uris=["http://localhost:9000/", "http://localhost:9000/callback"],
            scopes=[
                "launch", "launch/patient",
                "patient/Patient.read",
                "patient/Observation.read",
                "openid", "fhirUser"
            ],
            description="Pediatric growth chart visualization",
            logo_uri="/static/smart-apps/growth-chart.png"
        ))

        # Demo Patient Viewer
        self.register_app(RegisteredApp(
            client_id="demo-patient-viewer",
            name="Patient Summary Viewer",
            redirect_uris=["http://localhost:3001/callback", "http://localhost:3000/smart-callback"],
            scopes=[
                "launch", "launch/patient",
                "patient/Patient.read",
                "patient/Observation.read",
                "patient/Condition.read",
                "patient/MedicationRequest.read",
                "patient/AllergyIntolerance.read",
                "openid", "fhirUser"
            ],
            description="View patient clinical summary",
            logo_uri="/static/smart-apps/patient-viewer.png"
        ))

    def get_smart_configuration(self) -> SMARTConfiguration:
        """
        Generate SMART configuration for discovery endpoint

        Educational notes:
        The /.well-known/smart-configuration endpoint tells apps:
        - Where to send authorization requests
        - What scopes are supported
        - What capabilities the server has
        - What authentication methods are supported
        """
        return SMARTConfiguration(
            issuer=self.base_url,
            authorization_endpoint=f"{self.base_url}/api/smart/authorize",
            token_endpoint=f"{self.base_url}/api/smart/token",
            scopes_supported=[
                "openid", "fhirUser", "profile", "offline_access", "online_access",
                "launch", "launch/patient", "launch/encounter",
                "patient/Patient.read", "patient/Patient.write",
                "patient/Observation.read", "patient/Observation.write",
                "patient/Condition.read", "patient/Condition.write",
                "patient/MedicationRequest.read", "patient/MedicationRequest.write",
                "patient/AllergyIntolerance.read",
                "patient/Procedure.read",
                "patient/DiagnosticReport.read",
                "patient/CarePlan.read",
                "patient/*.read", "patient/*.write",
                "user/*.read", "user/*.write"
            ],
            capabilities=[
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
            code_challenge_methods_supported=["S256"]
        )

    def register_app(self, app: RegisteredApp) -> None:
        """Register a SMART application"""
        self._registered_apps[app.client_id] = app
        logger.info(f"Registered SMART app: {app.name} ({app.client_id})")

    def get_app(self, client_id: str) -> Optional[RegisteredApp]:
        """Get registered app by client ID"""
        return self._registered_apps.get(client_id)

    def get_all_apps(self) -> List[RegisteredApp]:
        """Get all registered apps"""
        return list(self._registered_apps.values())

    # =========================================================================
    # Authorization Endpoint
    # =========================================================================

    def start_authorization(
        self,
        request: AuthorizationRequest,
        launch_token: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[AuthorizationError]]:
        """
        Start an authorization flow

        Educational notes:
        This is called when a SMART app redirects to /authorize.
        We validate the request and create a session for the flow.

        Steps:
        1. Validate client_id (is this a registered app?)
        2. Validate redirect_uri (is it in the allowed list?)
        3. Validate response_type (must be 'code')
        4. Validate scopes (are they allowed for this app?)
        5. Create authorization session
        6. Return session ID for consent flow

        Args:
            request: AuthorizationRequest with OAuth2 parameters
            launch_token: EHR launch token (if EHR launch)

        Returns:
            Tuple of (session_id, error) - one will be None
        """
        # Validate client
        app = self.get_app(request.client_id)
        if not app:
            return None, AuthorizationError(
                error=AuthorizationErrorCode.UNAUTHORIZED_CLIENT,
                error_description="Unknown client_id",
                state=request.state
            )

        if not app.is_active:
            return None, AuthorizationError(
                error=AuthorizationErrorCode.UNAUTHORIZED_CLIENT,
                error_description="Client is not active",
                state=request.state
            )

        # Validate redirect URI
        if request.redirect_uri not in app.redirect_uris:
            return None, AuthorizationError(
                error=AuthorizationErrorCode.INVALID_REQUEST,
                error_description="redirect_uri not registered for this client",
                state=request.state
            )

        # Validate response type
        if request.response_type.value != "code":
            return None, AuthorizationError(
                error=AuthorizationErrorCode.UNSUPPORTED_RESPONSE_TYPE,
                error_description="Only 'code' response type is supported",
                state=request.state
            )

        # Validate scopes
        scope_result = validate_scopes(request.scope, app.scopes)
        if not scope_result.valid:
            return None, AuthorizationError(
                error=AuthorizationErrorCode.INVALID_SCOPE,
                error_description=f"Invalid scopes: {', '.join(scope_result.rejected_scopes)}",
                state=request.state
            )

        # Validate PKCE (required for public clients)
        if app.client_type == "public":
            if not request.code_challenge:
                return None, AuthorizationError(
                    error=AuthorizationErrorCode.INVALID_REQUEST,
                    error_description="PKCE code_challenge required for public clients",
                    state=request.state
                )
            if request.code_challenge_method != "S256":
                return None, AuthorizationError(
                    error=AuthorizationErrorCode.INVALID_REQUEST,
                    error_description="Only S256 code_challenge_method is supported",
                    state=request.state
                )

        # Decode launch context if present
        patient_id = None
        encounter_id = None
        user_id = None

        if launch_token:
            launch_context = self._launch_contexts.get(launch_token)
            if launch_context:
                if datetime.utcnow() > launch_context.expires_at:
                    return None, AuthorizationError(
                        error=AuthorizationErrorCode.INVALID_REQUEST,
                        error_description="Launch token has expired",
                        state=request.state
                    )
                patient_id = launch_context.patient_id
                encounter_id = launch_context.encounter_id
                user_id = launch_context.user_id

        # Create authorization session
        session_id = secrets.token_urlsafe(32)
        session = AuthorizationSession(
            session_id=session_id,
            client_id=request.client_id,
            redirect_uri=request.redirect_uri,
            scope=request.scope,
            state=request.state,
            response_type=request.response_type.value,
            code_challenge=request.code_challenge,
            code_challenge_method=request.code_challenge_method,
            patient_id=patient_id,
            encounter_id=encounter_id,
            user_id=user_id,
            launch_token=launch_token
        )

        # Track flow step for education
        session.flow_steps.append(FlowStep(
            step=1,
            name="Authorization Request Received",
            timestamp=datetime.utcnow(),
            details={
                "client_id": request.client_id,
                "requested_scopes": request.scope.split(),
                "has_pkce": bool(request.code_challenge),
                "launch_type": "ehr_launch" if launch_token else "standalone"
            },
            educational_note=(
                "The app redirected the user here with OAuth2 parameters. "
                "We validate the request and prepare for user consent."
            ),
            request={
                "response_type": request.response_type.value,
                "client_id": request.client_id,
                "redirect_uri": request.redirect_uri,
                "scope": request.scope,
                "state": request.state,
                "code_challenge": request.code_challenge,
                "code_challenge_method": request.code_challenge_method
            }
        ))

        self._sessions[session_id] = session
        logger.info(f"Started authorization session {session_id} for client {request.client_id}")

        return session_id, None

    def get_consent_display(self, session_id: str) -> Optional[ConsentDisplay]:
        """
        Get information to display on consent screen

        Educational notes:
        The consent screen shows users:
        - What app is requesting access
        - What data access is being requested (in human-readable terms)
        - Patient context (if applicable)
        """
        session = self._sessions.get(session_id)
        if not session:
            return None

        app = self.get_app(session.client_id)
        if not app:
            return None

        # Parse and describe scopes
        parsed_scopes = parse_scopes(session.scope)
        scope_descriptions = self.scope_handler.get_readable_scope_descriptions(parsed_scopes)

        return ConsentDisplay(
            app_name=app.name,
            app_description=app.description,
            app_logo=app.logo_uri,
            requested_scopes=scope_descriptions,
            patient_name=None,  # Would look up from FHIR if patient_id set
            patient_id=session.patient_id
        )

    def approve_authorization(
        self,
        session_id: str,
        user_id: str,
        granted_scopes: Optional[List[str]] = None,
        patient_id: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[AuthorizationError]]:
        """
        User approves authorization request

        Educational notes:
        After user consents on the consent screen:
        1. Generate authorization code
        2. Store it in session with expiration
        3. Return redirect URL with code

        Args:
            session_id: Authorization session ID
            user_id: User who approved
            granted_scopes: Scopes user approved (can be subset of requested)
            patient_id: Patient selected (for standalone launch)

        Returns:
            Tuple of (redirect_url_with_code, error)
        """
        session = self._sessions.get(session_id)
        if not session:
            return None, AuthorizationError(
                error=AuthorizationErrorCode.INVALID_REQUEST,
                error_description="Authorization session not found"
            )

        # Update session with user's choices
        session.user_id = user_id
        session.authorized_at = datetime.utcnow()

        # If user granted subset of scopes, update
        if granted_scopes:
            session.scope = " ".join(granted_scopes)

        # If standalone launch with patient selection
        if patient_id:
            session.patient_id = patient_id

        # Generate authorization code
        code = secrets.token_urlsafe(32)
        session.authorization_code = code
        session.code_expires_at = datetime.utcnow() + self.CODE_LIFETIME

        # Track flow step
        session.flow_steps.append(FlowStep(
            step=2,
            name="User Consent Granted",
            timestamp=datetime.utcnow(),
            details={
                "user_id": user_id,
                "granted_scopes": session.scope.split(),
                "patient_id": session.patient_id
            },
            educational_note=(
                "User reviewed the requested permissions and approved. "
                "An authorization code is generated and sent back to the app."
            )
        ))

        # Build redirect URL
        redirect_params = {
            "code": code,
            "state": session.state
        }
        redirect_url = f"{session.redirect_uri}?{urlencode(redirect_params)}"

        logger.info(f"Authorization approved for session {session_id}, code issued")

        return redirect_url, None

    def deny_authorization(
        self,
        session_id: str,
        reason: str = "User denied access"
    ) -> Optional[str]:
        """
        User denies authorization request

        Returns redirect URL with error
        """
        session = self._sessions.get(session_id)
        if not session:
            return None

        # Track flow step
        session.flow_steps.append(FlowStep(
            step=2,
            name="User Denied Access",
            timestamp=datetime.utcnow(),
            details={"reason": reason},
            educational_note="User chose not to grant access to the application."
        ))

        # Build error redirect
        error_params = {
            "error": AuthorizationErrorCode.ACCESS_DENIED.value,
            "error_description": reason,
            "state": session.state
        }
        redirect_url = f"{session.redirect_uri}?{urlencode(error_params)}"

        # Clean up session
        del self._sessions[session_id]

        return redirect_url

    # =========================================================================
    # Token Endpoint
    # =========================================================================

    def exchange_code_for_tokens(
        self,
        request: TokenRequest
    ) -> Tuple[Optional[TokenResponse], Optional[TokenError]]:
        """
        Exchange authorization code for tokens

        Educational notes:
        This is the token endpoint where:
        1. App sends the authorization code
        2. Server validates code and PKCE verifier
        3. Server issues access token (and optionally refresh token)
        4. Server returns SMART context (patient, encounter)

        PKCE Verification:
        - App sent code_challenge at /authorize (SHA256 hash of verifier)
        - App now sends code_verifier
        - We hash the verifier and compare to stored challenge
        - This proves the same app that started the flow is completing it

        Args:
            request: TokenRequest with code and credentials

        Returns:
            Tuple of (TokenResponse, TokenError) - one will be None
        """
        # Handle authorization code grant
        if request.grant_type == GrantType.AUTHORIZATION_CODE:
            return self._handle_authorization_code_grant(request)

        # Handle refresh token grant
        elif request.grant_type == GrantType.REFRESH_TOKEN:
            return self._handle_refresh_token_grant(request)

        else:
            return None, TokenError(
                error="unsupported_grant_type",
                error_description="Only authorization_code and refresh_token grants are supported"
            )

    def _handle_authorization_code_grant(
        self,
        request: TokenRequest
    ) -> Tuple[Optional[TokenResponse], Optional[TokenError]]:
        """Handle authorization_code grant type"""

        if not request.code:
            return None, TokenError(
                error=AuthorizationErrorCode.INVALID_REQUEST.value,
                error_description="Authorization code required"
            )

        # Find session by code
        session = None
        for s in self._sessions.values():
            if s.authorization_code == request.code:
                session = s
                break

        if not session:
            return None, TokenError(
                error=AuthorizationErrorCode.INVALID_GRANT.value,
                error_description="Authorization code not found or expired"
            )

        # Validate code hasn't expired
        if session.code_expires_at and datetime.utcnow() > session.code_expires_at:
            return None, TokenError(
                error=AuthorizationErrorCode.INVALID_GRANT.value,
                error_description="Authorization code has expired"
            )

        # Validate client
        if session.client_id != request.client_id:
            return None, TokenError(
                error=AuthorizationErrorCode.INVALID_CLIENT.value,
                error_description="Client ID does not match authorization"
            )

        # Validate redirect URI matches
        if session.redirect_uri != request.redirect_uri:
            return None, TokenError(
                error=AuthorizationErrorCode.INVALID_GRANT.value,
                error_description="Redirect URI does not match authorization"
            )

        # Verify PKCE
        if session.code_challenge:
            if not request.code_verifier:
                return None, TokenError(
                    error=AuthorizationErrorCode.INVALID_GRANT.value,
                    error_description="PKCE code_verifier required"
                )

            # Calculate challenge from verifier
            calculated_challenge = self._calculate_code_challenge(request.code_verifier)
            if calculated_challenge != session.code_challenge:
                return None, TokenError(
                    error=AuthorizationErrorCode.INVALID_GRANT.value,
                    error_description="PKCE verification failed"
                )

        # Track flow step
        session.flow_steps.append(FlowStep(
            step=3,
            name="Token Exchange",
            timestamp=datetime.utcnow(),
            details={
                "grant_type": request.grant_type.value,
                "pkce_verified": bool(session.code_challenge)
            },
            educational_note=(
                "The app exchanged the authorization code for tokens. "
                "PKCE was verified to ensure the same app that started "
                "the flow is completing it."
            ),
            request={
                "grant_type": request.grant_type.value,
                "code": f"{request.code[:10]}...",  # Truncate for display
                "redirect_uri": request.redirect_uri,
                "client_id": request.client_id,
                "code_verifier": "***" if request.code_verifier else None
            }
        ))

        # Generate tokens
        parsed_scopes = parse_scopes(session.scope)

        # Determine fhirUser based on user type
        fhir_user = None
        if "fhirUser" in session.scope or "openid" in session.scope:
            # Would look up actual FHIR resource for user
            fhir_user = f"{self.fhir_url}/Practitioner/{session.user_id}"

        access_token, expires_in = self.token_service.generate_access_token(
            user_id=session.user_id or "anonymous",
            client_id=session.client_id,
            scope=session.scope,
            patient_id=session.patient_id,
            encounter_id=session.encounter_id,
            fhir_user=fhir_user
        )

        # Generate refresh token if offline_access scope granted
        refresh_token = None
        if "offline_access" in session.scope:
            refresh_token = self.token_service.generate_refresh_token(
                user_id=session.user_id or "anonymous",
                client_id=session.client_id,
                scope=session.scope,
                patient_id=session.patient_id,
                session_id=session.session_id
            )

        # Generate ID token if openid scope granted
        id_token = None
        if "openid" in session.scope:
            id_token = self.token_service.generate_id_token(
                user_id=session.user_id or "anonymous",
                client_id=session.client_id,
                fhir_user=fhir_user
            )

        # Build response
        response = TokenResponse(
            access_token=access_token,
            token_type="Bearer",
            expires_in=expires_in,
            scope=session.scope,
            refresh_token=refresh_token,
            patient=session.patient_id,
            encounter=session.encounter_id,
            id_token=id_token,
            need_patient_banner=True,
            smart_style_url=f"{self.base_url}/static/smart-style.json"
        )

        # Track completion
        session.completed_at = datetime.utcnow()
        session.flow_steps.append(FlowStep(
            step=4,
            name="Tokens Issued",
            timestamp=datetime.utcnow(),
            details={
                "has_access_token": True,
                "has_refresh_token": bool(refresh_token),
                "has_id_token": bool(id_token),
                "patient_context": session.patient_id,
                "encounter_context": session.encounter_id
            },
            educational_note=(
                "Access token issued! The app can now access FHIR resources "
                "within the granted scopes. The token includes patient context "
                "so the app knows which patient's data to display."
            ),
            response={
                "access_token": f"{access_token[:20]}...",
                "token_type": "Bearer",
                "expires_in": expires_in,
                "scope": session.scope,
                "patient": session.patient_id,
                "encounter": session.encounter_id
            }
        ))

        # Invalidate the code (one-time use)
        session.authorization_code = None

        logger.info(
            f"Tokens issued for session {session.session_id}, "
            f"client {session.client_id}, patient {session.patient_id}"
        )

        return response, None

    def _handle_refresh_token_grant(
        self,
        request: TokenRequest
    ) -> Tuple[Optional[TokenResponse], Optional[TokenError]]:
        """Handle refresh_token grant type"""

        if not request.refresh_token:
            return None, TokenError(
                error=AuthorizationErrorCode.INVALID_REQUEST.value,
                error_description="Refresh token required"
            )

        # Use token service to refresh
        access_token, new_refresh, expires_in, error = self.token_service.refresh_access_token(
            refresh_token=request.refresh_token,
            client_id=request.client_id
        )

        if error:
            return None, TokenError(
                error=AuthorizationErrorCode.INVALID_GRANT.value,
                error_description=error
            )

        # Get metadata from refresh token validation
        valid, metadata, _ = self.token_service.validate_refresh_token(
            request.refresh_token, request.client_id
        )

        response = TokenResponse(
            access_token=access_token,
            token_type="Bearer",
            expires_in=expires_in,
            scope=metadata.get("scope", ""),
            refresh_token=new_refresh,
            patient=metadata.get("patient_id")
        )

        logger.info(f"Token refreshed for client {request.client_id}")

        return response, None

    def _calculate_code_challenge(self, verifier: str) -> str:
        """
        Calculate PKCE code challenge from verifier

        Educational notes:
        PKCE (Proof Key for Code Exchange) prevents authorization code interception:
        1. App generates random code_verifier
        2. App calculates code_challenge = BASE64URL(SHA256(code_verifier))
        3. App sends code_challenge at /authorize
        4. App sends code_verifier at /token
        5. Server verifies: SHA256(code_verifier) == stored code_challenge
        """
        digest = hashlib.sha256(verifier.encode('ascii')).digest()
        challenge = base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')
        return challenge

    # =========================================================================
    # Launch Endpoint
    # =========================================================================

    def create_launch_context(self, request: LaunchRequest) -> LaunchResponse:
        """
        Create EHR launch context

        Educational notes:
        When launching an app from within the EHR:
        1. EHR calls this endpoint with patient/encounter context
        2. Server creates opaque launch token
        3. EHR redirects to app's launch_uri with launch token
        4. App includes launch token in /authorize request
        5. Server decodes context and includes in token

        This allows the app to receive patient context without
        the EHR exposing patient IDs in URLs visible to users.

        Args:
            request: LaunchRequest with context information

        Returns:
            LaunchResponse with launch URL
        """
        # Validate app exists
        app = self.get_app(request.app_client_id)
        if not app:
            raise ValueError(f"Unknown client_id: {request.app_client_id}")

        if not app.launch_uri:
            raise ValueError(f"App {request.app_client_id} has no launch_uri configured")

        # Create launch context
        launch_id = secrets.token_urlsafe(32)
        context = LaunchContext(
            launch_id=launch_id,
            app_client_id=request.app_client_id,
            patient_id=request.patient_id,
            encounter_id=request.encounter_id,
            user_id=request.user_id,
            intent=request.intent
        )

        self._launch_contexts[launch_id] = context

        # Build launch URL
        launch_params = {
            "launch": launch_id,
            "iss": self.fhir_url
        }
        launch_url = f"{app.launch_uri}?{urlencode(launch_params)}"

        logger.info(
            f"Created launch context {launch_id} for app {request.app_client_id}, "
            f"patient {request.patient_id}"
        )

        return LaunchResponse(
            launch_token=launch_id,
            launch_url=launch_url,
            expires_in=300  # 5 minutes
        )

    # =========================================================================
    # Educational Flow Tracking
    # =========================================================================

    def get_flow_session(self, session_id: str) -> Optional[FlowSession]:
        """
        Get authorization flow session for educational display

        Returns complete flow with all steps for visualization
        """
        session = self._sessions.get(session_id)
        if not session:
            return None

        app = self.get_app(session.client_id)

        return FlowSession(
            session_id=session_id,
            app_name=app.name if app else session.client_id,
            flow_type=LaunchType.EHR_LAUNCH if session.launch_token else LaunchType.STANDALONE,
            steps=session.flow_steps,
            current_step=len(session.flow_steps),
            completed=session.completed_at is not None,
            started_at=session.created_at,
            completed_at=session.completed_at
        )

    def cleanup_expired_sessions(self) -> int:
        """Clean up expired authorization sessions"""
        now = datetime.utcnow()
        expired_time = now - timedelta(hours=1)

        expired = [
            session_id for session_id, session in self._sessions.items()
            if session.created_at < expired_time
        ]

        for session_id in expired:
            del self._sessions[session_id]

        # Also clean up expired launch contexts
        expired_launches = [
            launch_id for launch_id, context in self._launch_contexts.items()
            if context.expires_at < now
        ]

        for launch_id in expired_launches:
            del self._launch_contexts[launch_id]

        if expired or expired_launches:
            logger.info(
                f"Cleaned up {len(expired)} sessions and {len(expired_launches)} launch contexts"
            )

        return len(expired) + len(expired_launches)
