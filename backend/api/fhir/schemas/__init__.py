"""
FHIR Schemas Module

Contains FHIR R4 schema definitions and utilities.
"""

from .definitions import (
    FHIR_R4_SCHEMAS,
    get_schema,
    get_all_resource_types,
)

__all__ = [
    "FHIR_R4_SCHEMAS",
    "get_schema",
    "get_all_resource_types",
]
