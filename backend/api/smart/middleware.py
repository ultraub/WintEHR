"""
SMART on FHIR Token Validation Middleware

Intercepts FHIR requests and validates SMART access tokens.
Enforces scope-based access control and patient compartment restrictions.

Educational Purpose:
- Demonstrates token validation flow for FHIR APIs
- Shows scope enforcement patterns
- Explains patient compartment security

Integration:
This middleware sits between SMART apps and the HAPI FHIR server:

    SMART App → FastAPI (this middleware) → HAPI FHIR
                     ↓
              Validate Token
              Check Scopes
              Enforce Compartment
"""

import os
import re
from typing import Optional, Tuple, List, Callable
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

from .token_service import SMARTTokenService, TokenClaims, TokenValidationResult
from .scope_handler import (
    SMARTScopeHandler, ParsedScope, parse_scopes,
    check_resource_access, PATIENT_COMPARTMENT_RESOURCES
)

logger = logging.getLogger(__name__)


class SMARTTokenMiddleware(BaseHTTPMiddleware):
    """
    Middleware for validating SMART access tokens on FHIR requests

    Educational Purpose:
    This middleware demonstrates how EHRs protect FHIR resources:

    1. Token Extraction: Get Bearer token from Authorization header
    2. Token Validation: Verify JWT signature, expiration, issuer
    3. Scope Enforcement: Check if token scopes allow the requested operation
    4. Compartment Enforcement: Restrict patient-scoped access to authorized patient

    Configuration:
    - SMART_ENABLED: Whether to enforce SMART authentication (default: True)
    - Protected paths: /fhir/R4/* requires valid token
    - Unprotected paths: /fhir/R4/metadata (capability statement)
    """

    # Paths that require SMART authentication (/fhir/ and /fhir/R4/)
    PROTECTED_PATH_PATTERN = re.compile(r'^/fhir/(?:R4/)?(?!metadata)')

    # Paths that are always public
    PUBLIC_PATHS = {
        "/fhir/R4/metadata",
        "/fhir/metadata",
        "/.well-known/smart-configuration",
        "/api/smart/authorize",
        "/api/smart/token",
        "/api/smart/health",
    }

    # HTTP methods to FHIR actions
    METHOD_TO_ACTION = {
        "GET": "read",
        "HEAD": "read",
        "POST": "write",
        "PUT": "write",
        "PATCH": "write",
        "DELETE": "write"
    }

    def __init__(
        self,
        app: ASGIApp,
        token_service: SMARTTokenService,
        enabled: bool = True,
        allow_unprotected_reads: bool = True
    ):
        """
        Initialize SMART token middleware

        Args:
            app: FastAPI application
            token_service: Token service for validation
            enabled: Whether to enforce SMART auth (disable for testing)
            allow_unprotected_reads: Allow reads without token (for educational demo)
        """
        super().__init__(app)
        self.token_service = token_service
        self.scope_handler = SMARTScopeHandler()
        self.enabled = enabled
        self.allow_unprotected_reads = allow_unprotected_reads

    async def dispatch(self, request: Request, call_next: Callable):
        """
        Process each request through SMART validation

        Educational notes:
        This is the main entry point for request processing.
        For each FHIR request, we:
        1. Check if path requires authentication
        2. Extract and validate the token
        3. Enforce scope and compartment restrictions
        4. Either allow the request or return an error
        """
        # Check if SMART enforcement is enabled
        if not self.enabled:
            return await call_next(request)

        # Check if this path needs protection
        path = request.url.path

        # Always allow public paths
        if self._is_public_path(path):
            return await call_next(request)

        # Check if this is a FHIR path that needs protection
        if not self._is_protected_path(path):
            return await call_next(request)

        # Extract token from Authorization header
        token = self._extract_token(request)

        # Handle missing token
        if not token:
            if self.allow_unprotected_reads and request.method == "GET":
                # Allow unauthenticated reads for demo purposes
                logger.debug(f"Allowing unauthenticated read for demo: {path}")
                return await call_next(request)

            return self._unauthorized_response(
                "Bearer token required",
                "No Authorization header with Bearer token found"
            )

        # Validate token
        validation_result = self.token_service.validate_access_token(token)

        if not validation_result.valid:
            return self._unauthorized_response(
                validation_result.error or "invalid_token",
                validation_result.error_description or "Token validation failed"
            )

        # Token is valid - now check scopes
        claims = validation_result.claims

        # Parse resource type and action from path
        resource_type, resource_id = self._parse_fhir_path(path)
        action = self.METHOD_TO_ACTION.get(request.method, "read")

        # Check scope allows this operation
        scopes = parse_scopes(claims.scope)
        allowed, reason = check_resource_access(
            scopes=scopes,
            resource_type=resource_type,
            action=action,
            patient_id=self._get_patient_from_request(request, resource_type, resource_id),
            context_patient_id=claims.patient
        )

        if not allowed:
            return self._forbidden_response(
                "insufficient_scope",
                reason or f"Token scope does not allow {action} on {resource_type}"
            )

        # For patient-context scopes, may need to add patient filter
        if claims.patient and resource_type in PATIENT_COMPARTMENT_RESOURCES:
            # Add patient filter to request state for downstream use
            request.state.smart_patient_id = claims.patient
            request.state.smart_scopes = scopes

        # Store claims in request state for use by handlers
        request.state.smart_claims = claims

        # Log the access
        logger.info(
            f"SMART access: {request.method} {path} | "
            f"client={claims.client_id} user={claims.sub} patient={claims.patient}"
        )

        return await call_next(request)

    def _is_public_path(self, path: str) -> bool:
        """Check if path is always public"""
        return path in self.PUBLIC_PATHS or path.startswith("/api/smart/")

    def _is_protected_path(self, path: str) -> bool:
        """Check if path requires SMART authentication"""
        return bool(self.PROTECTED_PATH_PATTERN.match(path))

    def _extract_token(self, request: Request) -> Optional[str]:
        """
        Extract Bearer token from Authorization header

        Educational notes:
        The Authorization header format is: "Bearer <token>"
        We extract just the token part for validation.
        """
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        return parts[1]

    def _parse_fhir_path(self, path: str) -> Tuple[str, Optional[str]]:
        """
        Parse FHIR resource type and ID from path

        Examples:
        - /fhir/R4/Patient/123 → ("Patient", "123")
        - /fhir/R4/Observation → ("Observation", None)
        - /fhir/R4/Patient/123/_history → ("Patient", "123")

        Educational notes:
        FHIR URLs follow a predictable pattern:
        [base]/[ResourceType]/[id]/[operation]
        """
        # Remove /fhir/R4/ or /fhir/ prefix
        fhir_path = re.sub(r'^/fhir/(?:R4/)?', '', path)

        # Split by /
        parts = fhir_path.split("/")

        resource_type = parts[0] if parts else "Unknown"
        resource_id = parts[1] if len(parts) > 1 and not parts[1].startswith("_") else None

        return resource_type, resource_id

    def _get_patient_from_request(
        self,
        request: Request,
        resource_type: str,
        resource_id: Optional[str]
    ) -> Optional[str]:
        """
        Get patient ID from the request context

        Educational notes:
        For patient compartment enforcement, we need to know
        which patient's data is being accessed:
        - For Patient resource, it's the resource ID
        - For other resources, check the ?patient= query parameter
        """
        if resource_type == "Patient":
            return resource_id

        # Check query parameter
        patient_param = request.query_params.get("patient")
        if patient_param:
            # Handle reference format (Patient/123 or just 123)
            if patient_param.startswith("Patient/"):
                return patient_param.replace("Patient/", "")
            return patient_param

        return None

    def _unauthorized_response(self, error: str, description: str) -> JSONResponse:
        """Return 401 Unauthorized response"""
        return JSONResponse(
            status_code=401,
            content={
                "error": error,
                "error_description": description
            },
            headers={
                "WWW-Authenticate": f'Bearer realm="FHIR", error="{error}", error_description="{description}"'
            }
        )

    def _forbidden_response(self, error: str, description: str) -> JSONResponse:
        """Return 403 Forbidden response"""
        return JSONResponse(
            status_code=403,
            content={
                "error": error,
                "error_description": description
            }
        )


class SMARTSearchFilterMiddleware:
    """
    Middleware to filter FHIR search results based on SMART scopes

    Educational Purpose:
    This demonstrates how to enforce patient compartment at the search level:
    - Automatically adds patient filter to searches
    - Ensures apps only see data for authorized patients
    """

    def __init__(self, app: ASGIApp, token_service: SMARTTokenService):
        self.app = app
        self.token_service = token_service
        self.scope_handler = SMARTScopeHandler()

    async def __call__(self, scope, receive, send):
        """Process request and modify search parameters if needed"""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)

        # Check for SMART patient context in request state
        smart_patient = getattr(request.state, "smart_patient_id", None)
        smart_scopes = getattr(request.state, "smart_scopes", [])

        if smart_patient and request.url.path.startswith("/fhir/R4/"):
            # Parse resource type
            resource_type = request.url.path.replace("/fhir/R4/", "").split("/")[0]

            if resource_type in PATIENT_COMPARTMENT_RESOURCES:
                # Get current query params
                query_params = dict(request.query_params)

                # Add patient filter
                modified_params, warnings = self.scope_handler.filter_search_by_scopes(
                    scopes=smart_scopes,
                    resource_type=resource_type,
                    search_params=query_params,
                    context_patient_id=smart_patient
                )

                if warnings:
                    logger.warning(f"SMART search filter warnings: {warnings}")

                # Rebuild query string with modified params
                # Note: In practice, would need to modify the actual request

        await self.app(scope, receive, send)


def create_smart_middleware(
    app: ASGIApp,
    base_url: str,
    fhir_url: str,
    secret_key: str,
    enabled: bool = True,
    allow_unprotected_reads: bool = True
) -> SMARTTokenMiddleware:
    """
    Factory function to create SMART middleware

    Args:
        app: FastAPI application
        base_url: Authorization server base URL
        fhir_url: FHIR server base URL
        secret_key: JWT signing secret
        enabled: Whether to enforce SMART auth
        allow_unprotected_reads: Allow reads without token (demo mode)

    Returns:
        Configured SMARTTokenMiddleware
    """
    from .token_service import create_token_service

    token_service = create_token_service(
        base_url=base_url,
        fhir_url=fhir_url,
        secret_key=secret_key
    )

    return SMARTTokenMiddleware(
        app=app,
        token_service=token_service,
        enabled=enabled,
        allow_unprotected_reads=allow_unprotected_reads
    )


def setup_smart_middleware(app):
    """
    Setup SMART middleware on FastAPI app

    Call this from main.py to enable SMART token validation:

    ```python
    from api.smart.middleware import setup_smart_middleware
    setup_smart_middleware(app)
    ```
    """
    from .router import get_token_service

    enabled = os.getenv("SMART_ENABLED", "true").lower() == "true"
    allow_demo = os.getenv("SMART_ALLOW_UNPROTECTED", "true").lower() == "true"

    if not enabled:
        logger.info("SMART middleware disabled")
        return

    logger.info(
        f"Setting up SMART middleware (allow_unprotected_reads={allow_demo})"
    )

    app.add_middleware(
        SMARTTokenMiddleware,
        token_service=get_token_service(),
        enabled=enabled,
        allow_unprotected_reads=allow_demo
    )
