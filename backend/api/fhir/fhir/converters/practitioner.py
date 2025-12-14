"""
FHIR Practitioner Resource Converters

Provides conversion utilities for Practitioner and PractitionerRole resources.
"""

from typing import Dict, Any, List, Optional


def create_practitioner_role(
    practitioner_id: str,
    organization_id: Optional[str] = None,
    roles: Optional[List[str]] = None,
    specialties: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Create a FHIR PractitionerRole resource.

    Args:
        practitioner_id: ID of the Practitioner
        organization_id: Optional ID of the Organization
        roles: Optional list of role codes
        specialties: Optional list of specialty names

    Returns:
        FHIR PractitionerRole resource dict
    """
    practitioner_role = {
        "resourceType": "PractitionerRole",
        "id": f"{practitioner_id}-role",
        "active": True,
        "practitioner": {
            "reference": f"Practitioner/{practitioner_id}"
        }
    }

    # Add organization if provided
    if organization_id:
        practitioner_role["organization"] = {
            "reference": f"Organization/{organization_id}"
        }

    # Add roles if provided
    if roles:
        practitioner_role["code"] = [
            {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/practitioner-role",
                    "code": role,
                    "display": role.replace("-", " ").title()
                }],
                "text": role.replace("-", " ").title()
            }
            for role in roles
        ]

    # Add specialties if provided
    if specialties:
        practitioner_role["specialty"] = [
            {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "display": specialty
                }],
                "text": specialty
            }
            for specialty in specialties
            if specialty
        ]

    return practitioner_role


__all__ = [
    "create_practitioner_role",
]
