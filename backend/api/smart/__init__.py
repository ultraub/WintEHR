"""
SMART on FHIR Authorization Module

Provides OAuth2-based SMART on FHIR authorization server for WintEHR.
This module enables third-party SMART apps to securely access FHIR resources
with proper scope-based authorization.

Educational Purpose:
- Demonstrates SMART on FHIR authorization flows (EHR launch, standalone launch)
- Shows OAuth2 implementation patterns for healthcare applications
- Provides transparent token handling for learning purposes

Components:
- router.py: OAuth2 endpoints (authorize, token, discovery)
- authorization_server.py: Core OAuth2 logic
- token_service.py: JWT access token management
- scope_handler.py: SMART scope parsing and enforcement
- middleware.py: Token validation for FHIR proxy
- models.py: Pydantic request/response models
"""

from .router import router

__all__ = ["router"]
