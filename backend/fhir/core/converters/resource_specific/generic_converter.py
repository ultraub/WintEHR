"""
Generic FHIR Resource Converter for JSONB-stored Resources
"""

from typing import Dict, Any
from fhir.models.resource import FHIRResource


def generic_resource_to_fhir(resource: FHIRResource) -> Dict[str, Any]:
    """Convert a generic FHIRResource (JSONB) to FHIR format"""
    if isinstance(resource, FHIRResource):
        # Return the JSONB data directly - it's already in FHIR format
        return resource.resource
    else:
        # If it's not a FHIRResource, it might be raw JSONB data
        return resource