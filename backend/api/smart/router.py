"""
SMART on FHIR Router

FastAPI endpoints for SMART App Launch authorization.
Based on SMART App Launch Implementation Guide v2.1.0

Endpoints:
- GET /.well-known/smart-configuration - SMART discovery
- GET /api/smart/authorize - Authorization endpoint
- POST /api/smart/token - Token endpoint
- POST /api/smart/launch - Create EHR launch context
- GET /api/smart/consent/{session_id} - Consent screen data
- POST /api/smart/consent/{session_id}/approve - Approve authorization
- POST /api/smart/consent/{session_id}/deny - Deny authorization
- GET /api/smart/flow/{session_id} - Educational flow tracking
- GET /api/smart/apps - List registered apps
- GET /api/smart/token-info - Token inspection (educational)

Educational Purpose:
These endpoints demonstrate the complete OAuth2 authorization code flow
with SMART on FHIR extensions. Each endpoint includes educational notes
in the response for learning purposes.
"""

import os
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Form
from fastapi.responses import RedirectResponse, JSONResponse
from typing import Optional, List
import logging

from .models import (
    SMARTConfiguration, AuthorizationRequest, AuthorizationResponse, AuthorizationError,
    TokenRequest, TokenResponse, TokenError,
    LaunchRequest, LaunchResponse,
    FlowSession, ConsentDisplay, ConsentRequest,
    SMARTAppInfo, ResponseType, GrantType
)
from .authorization_server import SMARTAuthorizationServer
from .token_service import SMARTTokenService, create_token_service

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(tags=["SMART on FHIR"])

# Configuration from environment (with educational defaults)
BASE_URL = os.getenv("SMART_BASE_URL", os.getenv("BACKEND_BASE_URL", "http://localhost:8000"))
FHIR_URL = os.getenv("HAPI_FHIR_URL", "http://localhost:8888/fhir")
JWT_SECRET = os.getenv("JWT_SECRET", "smart-dev-secret-key-change-in-production")

# Initialize services
_token_service: Optional[SMARTTokenService] = None
_auth_server: Optional[SMARTAuthorizationServer] = None


def get_token_service() -> SMARTTokenService:
    """Get or create token service singleton"""
    global _token_service
    if _token_service is None:
        _token_service = create_token_service(
            base_url=BASE_URL,
            fhir_url=FHIR_URL,
            secret_key=JWT_SECRET
        )
    return _token_service


def get_auth_server() -> SMARTAuthorizationServer:
    """Get or create authorization server singleton"""
    global _auth_server
    if _auth_server is None:
        _auth_server = SMARTAuthorizationServer(
            base_url=BASE_URL,
            fhir_url=FHIR_URL,
            token_service=get_token_service()
        )
    return _auth_server


# =============================================================================
# Discovery Endpoint
# =============================================================================

@router.get(
    "/.well-known/smart-configuration",
    response_model=SMARTConfiguration,
    summary="SMART Configuration Discovery",
    description="""
    Returns the SMART configuration for this authorization server.

    **Educational Notes:**
    - Apps call this endpoint first to discover server capabilities
    - Tells apps where to send authorization and token requests
    - Lists supported scopes and features
    - Required by SMART App Launch specification

    **Spec Reference:** SMART App Launch IG §2.0.3
    """
)
async def get_smart_configuration(
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """Return SMART configuration for discovery"""
    return auth_server.get_smart_configuration()


# =============================================================================
# Authorization Endpoint
# =============================================================================

@router.get(
    "/api/smart/authorize",
    summary="OAuth2 Authorization Endpoint",
    description="""
    Start the OAuth2 authorization flow.

    **Educational Notes:**
    - Apps redirect users here to request authorization
    - Parameters follow OAuth2 spec with SMART extensions
    - PKCE (code_challenge) required for public clients
    - Returns redirect to consent screen or back to app with code

    **Flow:**
    1. App redirects user to this endpoint
    2. Server validates request parameters
    3. Server shows consent screen to user
    4. After consent, redirects back to app with authorization code

    **Spec Reference:** RFC 6749 §4.1, SMART App Launch IG §2.0.4
    """,
    responses={
        302: {"description": "Redirect to consent screen or error"},
        400: {"description": "Invalid request parameters"}
    }
)
async def authorize(
    response_type: str = Query(..., description="Must be 'code'"),
    client_id: str = Query(..., description="Registered application client ID"),
    redirect_uri: str = Query(..., description="Callback URL (must be registered)"),
    scope: str = Query(..., description="Space-separated SMART scopes"),
    state: str = Query(..., description="CSRF protection, returned in callback"),
    aud: str = Query(..., description="FHIR server base URL"),
    code_challenge: Optional[str] = Query(None, description="PKCE challenge (required for public clients)"),
    code_challenge_method: Optional[str] = Query(None, description="Must be 'S256' if using PKCE"),
    launch: Optional[str] = Query(None, description="EHR launch token"),
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """
    OAuth2 authorization endpoint

    Educational notes:
    This endpoint receives the initial authorization request from a SMART app.
    It validates the request and creates an authorization session.
    In a full implementation, this would redirect to a login/consent page.
    """
    try:
        # Build authorization request
        request = AuthorizationRequest(
            response_type=ResponseType(response_type),
            client_id=client_id,
            redirect_uri=redirect_uri,
            scope=scope,
            state=state,
            aud=aud,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            launch=launch
        )

        # Start authorization flow
        session_id, error = auth_server.start_authorization(request, launch)

        if error:
            # Redirect back to app with error
            error_redirect = f"{redirect_uri}?error={error.error}&error_description={error.error_description}&state={state}"
            return RedirectResponse(url=error_redirect, status_code=302)

        # In a real implementation, redirect to consent screen
        # For now, redirect to our consent endpoint
        consent_url = f"{BASE_URL}/api/smart/consent/{session_id}"
        return RedirectResponse(url=consent_url, status_code=302)

    except ValueError as e:
        logger.error(f"Authorization request error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/api/smart/consent/{session_id}",
    response_model=ConsentDisplay,
    summary="Get Consent Screen Data",
    description="""
    Get information to display on the consent screen.

    **Educational Notes:**
    - Returns app information and requested scopes in human-readable format
    - Frontend uses this to build the consent UI
    - Shows patient context if EHR launch
    """
)
async def get_consent_screen(
    session_id: str,
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """Get consent screen display data"""
    consent = auth_server.get_consent_display(session_id)
    if not consent:
        raise HTTPException(status_code=404, detail="Authorization session not found")
    return consent


@router.post(
    "/api/smart/consent/{session_id}/approve",
    summary="Approve Authorization",
    description="""
    User approves the authorization request.

    **Educational Notes:**
    - Called when user clicks "Authorize" on consent screen
    - Generates authorization code
    - Returns redirect URL with code for the app
    """
)
async def approve_consent(
    session_id: str,
    user_id: str = Form("demo"),  # In real app, from authenticated session
    patient_id: Optional[str] = Form(None),  # For standalone launch patient selection
    granted_scopes: Optional[str] = Form(None),  # Comma-separated if user modifies
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """Approve authorization and get redirect URL"""
    scopes_list = granted_scopes.split(",") if granted_scopes else None

    redirect_url, error = auth_server.approve_authorization(
        session_id=session_id,
        user_id=user_id,
        granted_scopes=scopes_list,
        patient_id=patient_id
    )

    if error:
        raise HTTPException(status_code=400, detail=error.error_description)

    return {"redirect_url": redirect_url}


@router.post(
    "/api/smart/consent/{session_id}/deny",
    summary="Deny Authorization",
    description="User denies the authorization request."
)
async def deny_consent(
    session_id: str,
    reason: str = Form("User denied access"),
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """Deny authorization and get redirect URL"""
    redirect_url = auth_server.deny_authorization(session_id, reason)
    if not redirect_url:
        raise HTTPException(status_code=404, detail="Authorization session not found")
    return {"redirect_url": redirect_url}


# =============================================================================
# Token Endpoint
# =============================================================================

@router.post(
    "/api/smart/token",
    response_model=TokenResponse,
    responses={
        400: {"model": TokenError, "description": "Token error"}
    },
    summary="OAuth2 Token Endpoint",
    description="""
    Exchange authorization code for tokens.

    **Educational Notes:**
    - Apps call this after receiving authorization code
    - PKCE code_verifier must match the code_challenge from /authorize
    - Returns access_token (JWT) and optionally refresh_token
    - SMART context (patient, encounter) included in response

    **Grant Types:**
    - `authorization_code`: Exchange code for tokens
    - `refresh_token`: Get new access token using refresh token

    **Spec Reference:** RFC 6749 §4.1.3, SMART App Launch IG §2.0.5
    """
)
async def token(
    grant_type: str = Form(..., description="Grant type (authorization_code or refresh_token)"),
    code: Optional[str] = Form(None, description="Authorization code (for authorization_code grant)"),
    redirect_uri: Optional[str] = Form(None, description="Must match /authorize request"),
    client_id: str = Form(..., description="Client ID"),
    client_secret: Optional[str] = Form(None, description="Client secret (for confidential clients)"),
    code_verifier: Optional[str] = Form(None, description="PKCE verifier"),
    refresh_token: Optional[str] = Form(None, description="Refresh token (for refresh_token grant)"),
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """
    Token endpoint for OAuth2 token exchange

    Educational notes:
    This is where the app exchanges the authorization code for tokens.
    PKCE verification happens here - the server confirms the app that
    started the flow is the same one completing it.
    """
    try:
        request = TokenRequest(
            grant_type=GrantType(grant_type),
            code=code,
            redirect_uri=redirect_uri,
            client_id=client_id,
            client_secret=client_secret,
            code_verifier=code_verifier,
            refresh_token=refresh_token
        )

        response, error = auth_server.exchange_code_for_tokens(request)

        if error:
            return JSONResponse(
                status_code=400,
                content={"error": error.error, "error_description": error.error_description}
            )

        return response

    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_request", "error_description": str(e)}
        )


# =============================================================================
# Launch Endpoint
# =============================================================================

@router.post(
    "/api/smart/launch",
    response_model=LaunchResponse,
    summary="Create EHR Launch Context",
    description="""
    Create a launch context for EHR-initiated app launch.

    **Educational Notes:**
    - Called by EHR when user clicks to launch an app
    - Creates opaque launch token with patient/encounter context
    - Returns URL to redirect user to (app's launch_uri)
    - App receives launch token and includes it in /authorize request

    **Why This Pattern?**
    - Keeps patient IDs out of browser URLs/history
    - Launch token is short-lived (5 minutes)
    - Only works for the intended app (validated at /authorize)
    """
)
async def create_launch(
    request: LaunchRequest,
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """Create EHR launch context and return launch URL"""
    try:
        return auth_server.create_launch_context(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Educational Endpoints
# =============================================================================

@router.get(
    "/api/smart/flow/{session_id}",
    response_model=FlowSession,
    summary="Get Authorization Flow Details",
    description="""
    Get detailed information about an authorization flow.

    **Educational Purpose:**
    - Shows each step of the OAuth2 flow
    - Includes educational notes explaining what happened
    - Shows request/response data (sanitized)
    - Used by the OAuth Flow Visualizer in the UI
    """
)
async def get_flow_session(
    session_id: str,
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """Get authorization flow session for educational display"""
    session = auth_server.get_flow_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Flow session not found")
    return session


@router.get(
    "/api/smart/apps",
    response_model=List[SMARTAppInfo],
    summary="List Registered SMART Apps",
    description="""
    Get list of all registered SMART applications.

    **Educational Notes:**
    - Shows apps that can be launched from this EHR
    - Each app has configured scopes and launch URI
    - Apps must be registered before they can authorize
    """
)
async def list_apps(
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """List all registered SMART apps"""
    apps = auth_server.get_all_apps()
    return [
        SMARTAppInfo(
            client_id=app.client_id,
            name=app.name,
            description=app.description,
            logo_uri=app.logo_uri,
            scopes=app.scopes,
            launch_uri=app.launch_uri,
            is_active=app.is_active
        )
        for app in apps
    ]


@router.get(
    "/api/smart/apps/{client_id}",
    response_model=SMARTAppInfo,
    summary="Get SMART App Details"
)
async def get_app(
    client_id: str,
    auth_server: SMARTAuthorizationServer = Depends(get_auth_server)
):
    """Get details for a specific SMART app"""
    app = auth_server.get_app(client_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    return SMARTAppInfo(
        client_id=app.client_id,
        name=app.name,
        description=app.description,
        logo_uri=app.logo_uri,
        scopes=app.scopes,
        launch_uri=app.launch_uri,
        is_active=app.is_active
    )


@router.get(
    "/api/smart/token-info",
    summary="Inspect Access Token (Educational)",
    description="""
    Decode and display information about an access token.

    **Educational Purpose:**
    - Shows JWT structure (header, payload)
    - Displays token claims and their meanings
    - Shows expiration and scope information
    - NOT for production use - tokens should be treated as opaque
    """
)
async def get_token_info(
    token: str = Query(..., description="The access token to inspect"),
    token_service: SMARTTokenService = Depends(get_token_service)
):
    """Inspect an access token for educational purposes"""
    info = token_service.get_token_info(token)
    if not info:
        raise HTTPException(status_code=400, detail="Could not decode token")

    # Add educational context
    info["educational_notes"] = {
        "iss": "Issuer - the authorization server that created this token",
        "sub": "Subject - the user who authorized the app",
        "aud": "Audience - the FHIR server this token is valid for",
        "exp": "Expiration - Unix timestamp when token expires",
        "iat": "Issued At - Unix timestamp when token was created",
        "client_id": "The application that requested this token",
        "scope": "What resources/actions this token allows",
        "patient": "Patient ID in context (for patient-scoped access)",
        "fhirUser": "FHIR resource URL for the authorizing user"
    }

    return info


@router.post(
    "/api/smart/revoke",
    summary="Revoke Token",
    description="Revoke an access or refresh token."
)
async def revoke_token(
    token: str = Form(..., description="Token to revoke"),
    token_type_hint: str = Form("access_token", description="Token type (access_token or refresh_token)"),
    token_service: SMARTTokenService = Depends(get_token_service)
):
    """Revoke a token"""
    from .token_service import TokenType

    token_type = TokenType.REFRESH if token_type_hint == "refresh_token" else TokenType.ACCESS
    success = token_service.revoke_token(token, token_type)

    return {"revoked": success}


# =============================================================================
# Health Check
# =============================================================================

@router.get(
    "/api/smart/health",
    summary="SMART Authorization Health Check"
)
async def health_check():
    """Health check for SMART authorization server"""
    return {
        "status": "healthy",
        "service": "SMART Authorization Server",
        "version": "1.0.0",
        "spec": "SMART App Launch IG v2.1.0"
    }
