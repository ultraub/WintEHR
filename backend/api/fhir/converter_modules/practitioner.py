"""
Enhanced FHIR Practitioner Resource Converter with Authentication Support
Converts between database models and FHIR Practitioner resources
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from models.synthea_models import Provider
from models.session import UserSession


def provider_to_practitioner(
    provider: Provider, 
    include_person_link: bool = True,
    session: Optional[UserSession] = None
) -> Dict[str, Any]:
    """Convert Provider model to FHIR Practitioner resource with authentication support"""
    resource = {
        "resourceType": "Practitioner",
        "id": str(provider.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "profile": ["http://hl7.org/fhir/StructureDefinition/Practitioner"]
        },
        "active": provider.active if hasattr(provider, 'active') else True,
        "name": [
            {
                "use": "official",
                "family": provider.last_name,
                "given": [provider.first_name] if provider.first_name else [],
                "prefix": [provider.prefix] if hasattr(provider, 'prefix') and provider.prefix else [],
                "suffix": [provider.suffix] if hasattr(provider, 'suffix') and provider.suffix else []
            }
        ]
    }
    
    # Add identifiers
    resource["identifier"] = []
    
    # NPI (National Provider Identifier)
    if provider.npi:
        resource["identifier"].append({
            "use": "official",
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                    "code": "NPI",
                    "display": "National provider identifier"
                }]
            },
            "system": "http://hl7.org/fhir/sid/us-npi",
            "value": provider.npi
        })
    
    # Synthea ID
    if provider.synthea_id:
        resource["identifier"].append({
            "use": "secondary",
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                    "code": "MR",
                    "display": "Medical record number"
                }]
            },
            "system": "http://synthea.mitre.org/identifier",
            "value": provider.synthea_id
        })
    
    # EMR User ID (for authentication)
    resource["identifier"].append({
        "use": "usual",
        "type": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                "code": "EI",
                "display": "Employee number"
            }]
        },
        "system": "http://medgenemr.local/identifier/practitioner",
        "value": str(provider.id)
    })
    
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
            "use": "work",
            "rank": 1  # Primary contact method
        })
    
    # Add address
    if provider.address:
        resource["address"] = [{
            "use": "work",
            "type": "both",
            "line": [provider.address],
            "city": provider.city,
            "state": provider.state,
            "postalCode": provider.zip_code
        }]
    
    # Add gender
    if hasattr(provider, 'gender') and provider.gender:
        if provider.gender.upper() in ['M', 'MALE']:
            resource["gender"] = "male"
        elif provider.gender.upper() in ['F', 'FEMALE']:
            resource["gender"] = "female"
        else:
            resource["gender"] = "other"
    
    # Add qualifications
    if provider.specialty:
        resource["qualification"] = [{
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "display": provider.specialty
                }],
                "text": provider.specialty
            },
            "issuer": {
                "display": "Medical Board"  # Default issuer
            }
        }]
    
    # Add communication languages (default to English)
    resource["communication"] = [{
        "coding": [{
            "system": "urn:ietf:bcp:47",
            "code": "en",
            "display": "English"
        }]
    }]
    
    # Add extensions
    resource["extension"] = []
    
    # Link to Person resource if requested
    if include_person_link:
        resource["extension"].append({
            "url": "http://hl7.org/fhir/StructureDefinition/practitioner-person",
            "valueReference": {
                "reference": f"Person/{provider.id}",
                "display": f"{provider.first_name} {provider.last_name}"
            }
        })
    
    # Add organization affiliation
    if provider.organization_id:
        resource["extension"].append({
            "url": "http://medgenemr.local/fhir/StructureDefinition/primary-organization",
            "valueReference": {
                "reference": f"Organization/{provider.organization_id}"
            }
        })
    
    # Add authentication extensions if session provided
    if session:
        resource["extension"].append({
            "url": "http://medgenemr.local/fhir/StructureDefinition/last-authenticated",
            "valueDateTime": session.last_activity.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z" if session.last_activity else None
        })
        
        resource["extension"].append({
            "url": "http://medgenemr.local/fhir/StructureDefinition/authentication-active",
            "valueBoolean": session.is_active
        })
    
    return resource


def create_practitioner_role(
    practitioner_id: str,
    organization_id: str,
    roles: List[str],
    specialties: List[str] = None,
    locations: List[str] = None,
    healthcare_services: List[str] = None
) -> Dict[str, Any]:
    """Create a FHIR PractitionerRole resource
    
    This defines the roles a practitioner has within an organization.
    """
    resource = {
        "resourceType": "PractitionerRole",
        "id": f"{practitioner_id}-{organization_id}",
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        },
        "active": True,
        "practitioner": {
            "reference": f"Practitioner/{practitioner_id}"
        },
        "organization": {
            "reference": f"Organization/{organization_id}"
        },
        "code": []
    }
    
    # Add roles
    for role in roles:
        role_mapping = {
            "doctor": ("223366009", "Healthcare professional"),
            "nurse": ("224535009", "Registered nurse"),
            "admin": ("224531000", "Senior manager"),
            "receptionist": ("159561009", "Receptionist"),
            "technician": ("159282002", "Healthcare technician")
        }
        
        if role.lower() in role_mapping:
            code, display = role_mapping[role.lower()]
            resource["code"].append({
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": code,
                    "display": display
                }]
            })
        else:
            resource["code"].append({
                "text": role
            })
    
    # Add specialties
    if specialties:
        resource["specialty"] = []
        for specialty in specialties:
            resource["specialty"].append({
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "display": specialty
                }],
                "text": specialty
            })
    
    # Add locations
    if locations:
        resource["location"] = []
        for location_id in locations:
            resource["location"].append({
                "reference": f"Location/{location_id}"
            })
    
    # Add healthcare services
    if healthcare_services:
        resource["healthcareService"] = []
        for service_id in healthcare_services:
            resource["healthcareService"].append({
                "reference": f"HealthcareService/{service_id}"
            })
    
    # Add availability information
    resource["availableTime"] = [{
        "daysOfWeek": ["mon", "tue", "wed", "thu", "fri"],
        "availableStartTime": "09:00:00",
        "availableEndTime": "17:00:00"
    }]
    
    return resource


def add_practitioner_credentials(
    practitioner_resource: Dict[str, Any],
    credentials: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Add credential information to a Practitioner resource
    
    credentials: List of dicts with keys:
        - type: credential type (MD, DO, RN, etc.)
        - number: credential number
        - issuer: issuing organization
        - issued_date: date issued
        - expiry_date: expiration date (optional)
    """
    if not practitioner_resource.get("qualification"):
        practitioner_resource["qualification"] = []
    
    for cred in credentials:
        qualification = {
            "identifier": [{
                "system": f"http://medgenemr.local/credential/{cred['type']}",
                "value": cred['number']
            }],
            "code": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0360",
                    "code": cred['type'],
                    "display": cred['type']
                }]
            },
            "issuer": {
                "display": cred['issuer']
            },
            "period": {
                "start": cred['issued_date']
            }
        }
        
        if cred.get('expiry_date'):
            qualification["period"]["end"] = cred['expiry_date']
        
        practitioner_resource["qualification"].append(qualification)
    
    return practitioner_resource