"""
FHIR Person Resource Converter
Converts between database models and FHIR Person resources
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from models.synthea_models import Provider
from models.session import UserSession


def provider_to_person(provider: Provider) -> Dict[str, Any]:
    """Convert Provider model to FHIR Person resource
    
    The Person resource is used to represent the person behind a Practitioner,
    Patient, or other role. It's useful for managing identity and authentication.
    """
    resource = {
        "resourceType": "Person",
        "id": str(provider.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "profile": ["http://hl7.org/fhir/StructureDefinition/Person"]
        },
        "active": provider.active if hasattr(provider, 'active') else True,
        "name": [
            {
                "use": "official",
                "family": provider.last_name,
                "given": [provider.first_name] if provider.first_name else [],
                "prefix": [provider.prefix] if hasattr(provider, 'prefix') and provider.prefix else []
            }
        ]
    }
    
    # Add identifiers
    resource["identifier"] = []
    
    # Add NPI as identifier
    if provider.npi:
        resource["identifier"].append({
            "use": "official",
            "system": "http://hl7.org/fhir/sid/us-npi",
            "value": provider.npi
        })
    
    # Add Synthea ID as identifier
    if provider.synthea_id:
        resource["identifier"].append({
            "use": "secondary",
            "system": "http://synthea.mitre.org/identifier",
            "value": provider.synthea_id
        })
    
    # Add EMR user ID as identifier for authentication
    resource["identifier"].append({
        "use": "usual",
        "system": "http://wintehr.local/identifier/user",
        "value": str(provider.id)
    })
    
    # Add gender if available
    if hasattr(provider, 'gender') and provider.gender:
        if provider.gender.upper() in ['M', 'MALE']:
            resource["gender"] = "male"
        elif provider.gender.upper() in ['F', 'FEMALE']:
            resource["gender"] = "female"
        else:
            resource["gender"] = "other"
    
    # Add telecom
    resource["telecom"] = []
    if provider.phone:
        resource["telecom"].append({
            "system": "phone",
            "value": provider.phone,
            "use": "work"
        })
    if provider.email:
        resource["telecom"].append({
            "system": "email",
            "value": provider.email,
            "use": "work"
        })
    
    # Add address
    if provider.address:
        resource["address"] = [{
            "use": "work",
            "line": [provider.address],
            "city": provider.city,
            "state": provider.state,
            "postalCode": provider.zip_code
        }]
    
    # Link to Practitioner resource
    resource["link"] = [{
        "target": {
            "reference": f"Practitioner/{provider.id}",
            "display": f"{provider.first_name} {provider.last_name}"
        },
        "assurance": "level3"  # High confidence link
    }]
    
    # Add managing organization if available
    if provider.organization_id:
        resource["managingOrganization"] = {
            "reference": f"Organization/{provider.organization_id}"
        }
    
    return resource


def create_person_from_user_data(
    user_id: str,
    email: str,
    first_name: str,
    last_name: str,
    role: str = "practitioner",
    organization_id: Optional[str] = None,
    identifiers: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """Create a FHIR Person resource from user registration data
    
    This is used when creating new users who don't yet have a Provider record.
    """
    resource = {
        "resourceType": "Person",
        "id": user_id,
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "profile": ["http://hl7.org/fhir/StructureDefinition/Person"]
        },
        "active": True,
        "name": [
            {
                "use": "official",
                "family": last_name,
                "given": [first_name]
            }
        ],
        "telecom": [
            {
                "system": "email",
                "value": email,
                "use": "work"
            }
        ]
    }
    
    # Add identifiers
    resource["identifier"] = [
        {
            "use": "usual",
            "system": "http://wintehr.local/identifier/user",
            "value": user_id
        }
    ]
    
    # Add any additional identifiers provided
    if identifiers:
        resource["identifier"].extend(identifiers)
    
    # Add managing organization if provided
    if organization_id:
        resource["managingOrganization"] = {
            "reference": f"Organization/{organization_id}"
        }
    
    # Add extension for user role
    resource["extension"] = [{
        "url": "http://wintehr.local/fhir/StructureDefinition/user-role",
        "valueString": role
    }]
    
    return resource


def add_authentication_extensions(person_resource: Dict[str, Any], session: Optional[UserSession] = None) -> Dict[str, Any]:
    """Add authentication-related extensions to a Person resource
    
    This includes session information and authentication metadata.
    """
    if not person_resource.get("extension"):
        person_resource["extension"] = []
    
    # Add last login time
    if session and session.created_at:
        person_resource["extension"].append({
            "url": "http://wintehr.local/fhir/StructureDefinition/last-login",
            "valueDateTime": session.created_at.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        })
    
    # Add session expiry if active session
    if session and session.expires_at:
        person_resource["extension"].append({
            "url": "http://wintehr.local/fhir/StructureDefinition/session-expires",
            "valueDateTime": session.expires_at.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        })
    
    # Add authentication status
    person_resource["extension"].append({
        "url": "http://wintehr.local/fhir/StructureDefinition/authentication-status",
        "valueBoolean": session is not None and session.is_active
    })
    
    return person_resource