"""
FHIR Module - Consolidated FHIR-related functionality

This module contains:
- proxy.py: HAPI FHIR proxy router
- context.py: FHIR context handling
- jwt.py: FHIR JWT utilities
- search_values.py: Search value handling
- routers/: FHIR API routers (schema, capability, relationships)
- schemas/: FHIR schema definitions
"""

from .proxy import router as proxy_router
from .context import (
    FHIRContext,
    get_fhir_context,
)

__all__ = [
    "proxy_router",
    "FHIRContext",
    "get_fhir_context",
]
