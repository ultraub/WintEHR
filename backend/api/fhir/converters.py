"""
FHIR Resource Converters
Converts between database models and FHIR resources
"""

from datetime import datetime
from typing import Dict, Any, Optional
from models.synthea_models import Patient, Encounter, Observation, Condition, Medication, Provider, Organization, Location


def patient_to_fhir(patient: Patient) -> Dict[str, Any]:
    """Convert Patient model to FHIR Patient resource"""
    resource = {
        "resourceType": "Patient",
        "id": str(patient.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "identifier": [],
        "active": True,
        "name": [
            {
                "use": "official",
                "family": patient.last_name,
                "given": [patient.first_name] if patient.first_name else []
            }
        ],
        "gender": "male" if patient.gender == "M" else "female" if patient.gender == "F" else "unknown",
        "birthDate": patient.date_of_birth.isoformat() if patient.date_of_birth else None
    }
    
    # Add identifiers
    if patient.ssn:
        resource["identifier"].append({
            "system": "http://hl7.org/fhir/sid/us-ssn",
            "value": patient.ssn
        })
    
    # Add contact info
    resource["telecom"] = []
    if patient.phone:
        resource["telecom"].append({
            "system": "phone",
            "value": patient.phone,
            "use": "home"
        })
    if patient.email:
        resource["telecom"].append({
            "system": "email",
            "value": patient.email
        })
    
    # Add address
    if patient.address:
        resource["address"] = [{
            "use": "home",
            "line": [patient.address],
            "city": patient.city,
            "state": patient.state,
            "postalCode": patient.zip_code
        }]
    
    return resource


def encounter_to_fhir(encounter: Encounter) -> Dict[str, Any]:
    """Convert Encounter model to FHIR Encounter resource"""
    # Map database encounter_class to FHIR class codes
    class_mapping = {
        "AMB": "AMB",
        "ambulatory": "AMB",
        "EMER": "EMER",
        "emergency": "EMER",
        "IMP": "IMP",
        "inpatient": "IMP",
        "ACUTE": "ACUTE",
        "NONAC": "NONAC",
        "OBSENC": "OBSENC",
        "PRENC": "PRENC",
        "SS": "SS",
        "VR": "VR"
    }
    
    encounter_class = class_mapping.get(encounter.encounter_class, encounter.encounter_class or "AMB")
    
    resource = {
        "resourceType": "Encounter",
        "id": str(encounter.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": encounter.status or "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": encounter_class,
            "display": encounter_class
        },
        "type": [
            {
                "text": encounter.encounter_type
            }
        ],
        "subject": {
            "reference": f"Patient/{encounter.patient_id}"
        },
        "period": {
            "start": encounter.encounter_date.isoformat() + "Z" if encounter.encounter_date else None
        }
    }
    
    # Add participant if provider exists
    if encounter.provider_id:
        resource["participant"] = [{
            "type": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                    "code": "PPRF",
                    "display": "primary performer"
                }]
            }],
            "individual": {
                "reference": f"Practitioner/{encounter.provider_id}"
            }
        }]
    
    # Add reason for visit
    if encounter.chief_complaint:
        resource["reasonCode"] = [{
            "text": encounter.chief_complaint
        }]
    
    # Add discharge disposition if available
    if hasattr(encounter, 'discharge_disposition') and encounter.discharge_disposition:
        resource["hospitalization"] = {
            "dischargeDisposition": {
                "text": encounter.discharge_disposition
            }
        }
    
    return resource


def observation_to_fhir(observation: Observation) -> Dict[str, Any]:
    """Convert Observation model to FHIR Observation resource"""
    resource = {
        "resourceType": "Observation",
        "id": str(observation.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": observation.status or "final",
        "category": [],
        "code": {
            "coding": []
        },
        "subject": {
            "reference": f"Patient/{observation.patient_id}"
        },
        "effectiveDateTime": observation.observation_date.isoformat() + "Z" if observation.observation_date else None
    }
    
    # Add category based on observation_type
    if observation.observation_type == "laboratory":
        resource["category"].append({
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "laboratory",
                "display": "Laboratory"
            }]
        })
    elif observation.observation_type == "vital-signs":
        resource["category"].append({
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs"
            }]
        })
    
    # Add LOINC code
    if observation.loinc_code:
        resource["code"]["coding"].append({
            "system": "http://loinc.org",
            "code": observation.loinc_code,
            "display": observation.display
        })
    
    # Add value
    if observation.value_quantity is not None:
        resource["valueQuantity"] = {
            "value": observation.value_quantity,
            "unit": observation.value_unit or "",
            "system": "http://unitsofmeasure.org",
            "code": observation.value_unit or ""
        }
    elif observation.value:
        resource["valueString"] = observation.value
    
    # Add encounter reference if available
    if observation.encounter_id:
        resource["encounter"] = {
            "reference": f"Encounter/{observation.encounter_id}"
        }
    
    # Add reference ranges
    if observation.reference_range_low is not None or observation.reference_range_high is not None:
        reference_range = {}
        if observation.reference_range_low is not None:
            reference_range["low"] = {
                "value": observation.reference_range_low,
                "unit": observation.value_unit or "",
                "system": "http://unitsofmeasure.org",
                "code": observation.value_unit or ""
            }
        if observation.reference_range_high is not None:
            reference_range["high"] = {
                "value": observation.reference_range_high,
                "unit": observation.value_unit or "",
                "system": "http://unitsofmeasure.org",
                "code": observation.value_unit or ""
            }
        resource["referenceRange"] = [reference_range]
    
    # Add interpretation
    if observation.interpretation:
        interpretation_map = {
            "normal": "N",
            "high": "H",
            "low": "L",
            "critical": "HH"  # Critical high
        }
        code = interpretation_map.get(observation.interpretation, "N")
        resource["interpretation"] = [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                "code": code,
                "display": observation.interpretation.title()
            }]
        }]
    
    # Add components if present (for blood pressure, etc.)
    if hasattr(observation, 'systolic_bp') and observation.systolic_bp is not None:
        resource["component"] = [
            {
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8480-6",
                        "display": "Systolic blood pressure"
                    }]
                },
                "valueQuantity": {
                    "value": observation.systolic_bp,
                    "unit": "mmHg",
                    "system": "http://unitsofmeasure.org",
                    "code": "mm[Hg]"
                }
            },
            {
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8462-4",
                        "display": "Diastolic blood pressure"
                    }]
                },
                "valueQuantity": {
                    "value": observation.diastolic_bp,
                    "unit": "mmHg",
                    "system": "http://unitsofmeasure.org",
                    "code": "mm[Hg]"
                }
            }
        ]
    
    return resource


def condition_to_fhir(condition: Condition) -> Dict[str, Any]:
    """Convert Condition model to FHIR Condition resource"""
    resource = {
        "resourceType": "Condition",
        "id": str(condition.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "clinicalStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code": condition.clinical_status or "active",
                "display": condition.clinical_status or "Active"
            }]
        },
        "verificationStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code": condition.verification_status or "confirmed",
                "display": condition.verification_status or "Confirmed"
            }]
        },
        "code": {
            "coding": [],
            "text": condition.description
        },
        "subject": {
            "reference": f"Patient/{condition.patient_id}"
        }
    }
    
    # Add ICD-10 code
    if condition.icd10_code:
        resource["code"]["coding"].append({
            "system": "http://hl7.org/fhir/sid/icd-10",
            "code": condition.icd10_code,
            "display": condition.description
        })
    
    # Add SNOMED code if available
    if hasattr(condition, 'snomed_code') and condition.snomed_code:
        resource["code"]["coding"].append({
            "system": "http://snomed.info/sct",
            "code": condition.snomed_code,
            "display": condition.description
        })
    
    # Add onset date
    if condition.onset_date:
        resource["onsetDateTime"] = condition.onset_date.isoformat()
    
    # Add abatement date if resolved
    if hasattr(condition, 'abatement_date') and condition.abatement_date:
        resource["abatementDateTime"] = condition.abatement_date.isoformat()
    
    # Add encounter reference if available
    if condition.encounter_id:
        resource["encounter"] = {
            "reference": f"Encounter/{condition.encounter_id}"
        }
    
    return resource


def medication_request_to_fhir(medication: Medication) -> Dict[str, Any]:
    """Convert Medication model to FHIR MedicationRequest resource"""
    resource = {
        "resourceType": "MedicationRequest",
        "id": str(medication.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": medication.status or "active",
        "intent": "order",
        "medicationCodeableConcept": {
            "coding": [{
                "display": medication.medication_name
            }],
            "text": medication.medication_name
        },
        "subject": {
            "reference": f"Patient/{medication.patient_id}"
        },
        "authoredOn": medication.start_date.isoformat() if medication.start_date else None
    }
    
    # Add requester if prescriber exists
    if medication.prescriber_id:
        resource["requester"] = {
            "reference": f"Practitioner/{medication.prescriber_id}"
        }
    
    # Add dosage instructions
    dosage_instruction = {}
    
    if medication.dosage:
        dosage_instruction["text"] = f"{medication.dosage} {medication.frequency}"
        dosage_instruction["doseAndRate"] = [{
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/dose-rate-type",
                    "code": "ordered",
                    "display": "Ordered"
                }]
            },
            "doseQuantity": {
                "value": medication.dosage.split()[0] if medication.dosage and medication.dosage.split()[0].replace('.', '').isdigit() else None,
                "unit": medication.dosage.split()[1] if medication.dosage and len(medication.dosage.split()) > 1 else "unit"
            }
        }]
    
    if medication.frequency:
        dosage_instruction["timing"] = {
            "repeat": {
                "frequency": 1,
                "period": 1,
                "periodUnit": "d"
            },
            "code": {
                "text": medication.frequency
            }
        }
    
    if medication.route:
        dosage_instruction["route"] = {
            "coding": [{
                "display": medication.route
            }],
            "text": medication.route
        }
    
    if dosage_instruction:
        resource["dosageInstruction"] = [dosage_instruction]
    
    # Add encounter reference if available
    if medication.encounter_id:
        resource["encounter"] = {
            "reference": f"Encounter/{medication.encounter_id}"
        }
    
    # Add dispense request if quantity specified
    if hasattr(medication, 'quantity') and medication.quantity:
        resource["dispenseRequest"] = {
            "quantity": {
                "value": medication.quantity
            }
        }
    
    # Add reason for medication if available
    if hasattr(medication, 'reason') and medication.reason:
        resource["reasonCode"] = [{
            "text": medication.reason
        }]
    
    return resource


def practitioner_to_fhir(provider: Provider) -> Dict[str, Any]:
    """Convert Provider model to FHIR Practitioner resource"""
    resource = {
        "resourceType": "Practitioner",
        "id": str(provider.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "active": True,
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
    if provider.npi:
        resource["identifier"].append({
            "system": "http://hl7.org/fhir/sid/us-npi",
            "value": provider.npi
        })
    
    # Add qualifications
    if provider.specialty:
        resource["qualification"] = [{
            "code": {
                "text": provider.specialty
            }
        }]
    
    # Add gender if available
    if hasattr(provider, 'gender') and provider.gender:
        resource["gender"] = "male" if provider.gender == "M" else "female" if provider.gender == "F" else "unknown"
    
    # Add telecom if available
    resource["telecom"] = []
    if hasattr(provider, 'phone') and provider.phone:
        resource["telecom"].append({
            "system": "phone",
            "value": provider.phone,
            "use": "work"
        })
    if hasattr(provider, 'email') and provider.email:
        resource["telecom"].append({
            "system": "email",
            "value": provider.email,
            "use": "work"
        })
    
    # Add address if available
    if hasattr(provider, 'address') and provider.address:
        resource["address"] = [{
            "use": "work",
            "line": [provider.address],
            "city": provider.city if hasattr(provider, 'city') else None,
            "state": provider.state if hasattr(provider, 'state') else None,
            "postalCode": provider.zip_code if hasattr(provider, 'zip_code') else None
        }]
    
    return resource


def organization_to_fhir(organization: Organization) -> Dict[str, Any]:
    """Convert Organization model to FHIR Organization resource"""
    resource = {
        "resourceType": "Organization",
        "id": str(organization.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "active": True,
        "name": organization.name
    }
    
    # Add type if available
    if hasattr(organization, 'type') and organization.type:
        resource["type"] = [{
            "text": organization.type
        }]
    
    # Add identifiers
    resource["identifier"] = []
    if hasattr(organization, 'tax_id') and organization.tax_id:
        resource["identifier"].append({
            "system": "urn:oid:2.16.840.1.113883.4.4",
            "value": organization.tax_id
        })
    
    # Add telecom
    resource["telecom"] = []
    if organization.phone:
        resource["telecom"].append({
            "system": "phone",
            "value": organization.phone,
            "use": "work"
        })
    
    # Add address
    if organization.address:
        resource["address"] = [{
            "use": "work",
            "line": [organization.address],
            "city": organization.city,
            "state": organization.state,
            "postalCode": organization.zip_code
        }]
    
    return resource


def location_to_fhir(location: Location) -> Dict[str, Any]:
    """Convert Location model to FHIR Location resource"""
    resource = {
        "resourceType": "Location",
        "id": str(location.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": "active",
        "name": location.name,
        "mode": "instance"
    }
    
    # Add type if available
    if hasattr(location, 'type') and location.type:
        resource["type"] = [{
            "text": location.type
        }]
    
    # Add telecom
    if location.phone:
        resource["telecom"] = [{
            "system": "phone",
            "value": location.phone,
            "use": "work"
        }]
    
    # Add address
    if location.address:
        resource["address"] = {
            "use": "work",
            "line": [location.address],
            "city": location.city,
            "state": location.state,
            "postalCode": location.zip_code
        }
    
    # Add position if lat/lon available
    if hasattr(location, 'latitude') and hasattr(location, 'longitude') and location.latitude and location.longitude:
        resource["position"] = {
            "longitude": location.longitude,
            "latitude": location.latitude
        }
    
    # Add managing organization if available
    if hasattr(location, 'organization_id') and location.organization_id:
        resource["managingOrganization"] = {
            "reference": f"Organization/{location.organization_id}"
        }
    
    return resource