"""
FHIR Resource Converters

Provides conversion utilities for transforming internal models to FHIR R4 resources.
"""

from typing import Dict, Any, Optional
from datetime import datetime


def create_reference(
    resource_type: str,
    resource_id: str,
    display: Optional[str] = None
) -> Dict[str, str]:
    """
    Create a FHIR Reference object.

    Args:
        resource_type: The FHIR resource type (e.g., "Patient", "Practitioner")
        resource_id: The resource ID
        display: Optional display text for the reference

    Returns:
        FHIR Reference dict
    """
    reference = {
        "reference": f"{resource_type}/{resource_id}"
    }
    if display:
        reference["display"] = display
    return reference


def practitioner_to_fhir(
    provider,
    include_person_link: bool = False,
    session=None
) -> Dict[str, Any]:
    """
    Convert a Provider model to a FHIR Practitioner resource.

    Args:
        provider: Provider model instance
        include_person_link: Whether to include link to Person resource
        session: Optional session for additional context

    Returns:
        FHIR Practitioner resource dict
    """
    practitioner = {
        "resourceType": "Practitioner",
        "id": str(provider.id),
        "active": True,
        "name": [{
            "use": "official",
            "family": getattr(provider, 'last_name', '') or '',
            "given": [getattr(provider, 'first_name', '') or '']
        }]
    }

    # Add specialty if available
    specialty = getattr(provider, 'specialty', None)
    if specialty:
        practitioner["qualification"] = [{
            "code": {
                "text": specialty
            }
        }]

    # Add NPI identifier if available
    npi = getattr(provider, 'npi', None)
    if npi:
        practitioner["identifier"] = [{
            "system": "http://hl7.org/fhir/sid/us-npi",
            "value": npi
        }]

    # Add link to Person resource if requested
    if include_person_link:
        practitioner["link"] = [{
            "target": create_reference("Person", str(provider.id)),
            "assurance": "level4"
        }]

    return practitioner


__all__ = [
    "create_reference",
    "practitioner_to_fhir",
]
