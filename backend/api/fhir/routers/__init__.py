"""
FHIR Routers Module

Contains API routers for FHIR-related endpoints:
- schema.py: FHIR schema endpoints
- capability.py: FHIR capability statement endpoints
- relationships.py: FHIR resource relationship endpoints
"""

from .schema import router as schema_router
from .capability import router as capability_router
from .relationships import relationships_router

__all__ = [
    "schema_router",
    "capability_router",
    "relationships_router",
]
