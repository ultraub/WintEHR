"""
FHIR Person Resource Converters

Provides conversion utilities for Person resources.
"""

from typing import Dict, Any, Optional
from datetime import datetime


def provider_to_person(provider) -> Dict[str, Any]:
    """
    Convert a Provider model to a FHIR Person resource.

    Args:
        provider: Provider model instance

    Returns:
        FHIR Person resource dict
    """
    person = {
        "resourceType": "Person",
        "id": str(provider.id),
        "active": True,
        "name": [{
            "use": "official",
            "family": getattr(provider, 'last_name', '') or '',
            "given": [getattr(provider, 'first_name', '') or '']
        }]
    }

    # Add email if available
    email = getattr(provider, 'email', None)
    if email:
        person["telecom"] = [{
            "system": "email",
            "value": email,
            "use": "work"
        }]

    return person


def add_authentication_extensions(
    person: Dict[str, Any],
    session
) -> Dict[str, Any]:
    """
    Add authentication-related extensions to a Person resource.

    Args:
        person: FHIR Person resource dict
        session: User session with authentication info

    Returns:
        Updated Person resource with extensions
    """
    if session is None:
        return person

    extensions = []

    # Add session expiration if available
    expires_at = getattr(session, 'expires_at', None)
    if expires_at:
        extensions.append({
            "url": "http://wintehr.local/fhir/StructureDefinition/session-expires",
            "valueDateTime": expires_at.isoformat() + "Z" if isinstance(expires_at, datetime) else str(expires_at)
        })

    # Add last activity if available
    last_activity = getattr(session, 'last_activity', None)
    if last_activity:
        extensions.append({
            "url": "http://wintehr.local/fhir/StructureDefinition/last-activity",
            "valueDateTime": last_activity.isoformat() + "Z" if isinstance(last_activity, datetime) else str(last_activity)
        })

    if extensions:
        person["extension"] = extensions

    return person


__all__ = [
    "provider_to_person",
    "add_authentication_extensions",
]
