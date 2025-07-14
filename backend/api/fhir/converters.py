"""
FHIR Resource Converters
Converts between database models and FHIR resources
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from models.synthea_models import Patient, Encounter, Observation, Provider, Organization, Location, Device, DiagnosticReport, ImagingStudy
from models.fhir_resource import FHIRResource, Condition, AllergyIntolerance as Allergy, Immunization, Procedure, CarePlan
from models.clinical.orders import MedicationOrder as Medication
from models.clinical.appointments import Appointment, AppointmentParticipant
from .converter_modules.appointment import appointment_to_fhir, fhir_to_appointment
from .converter_modules.audit_event import audit_log_to_fhir, create_audit_event
from .converter_modules.person import provider_to_person, create_person_from_user_data, add_authentication_extensions
from .converter_modules.practitioner import provider_to_practitioner, create_practitioner_role, add_practitioner_credentials
from .converter_modules.extended_converters import (
    document_reference_to_fhir, medication_to_fhir, medication_administration_to_fhir,
    care_team_to_fhir, practitioner_role_to_fhir, coverage_to_fhir,
    claim_to_fhir, explanation_of_benefit_to_fhir, supply_delivery_to_fhir,
    provenance_to_fhir
)
from .converter_modules.service_request_dict import service_request_to_fhir_dict


# Import helper functions
from .converter_modules.helpers import create_reference, create_codeable_concept, create_identifier


def patient_to_fhir(patient: Patient) -> Dict[str, Any]:
    """Convert Patient model to FHIR Patient resource"""
    resource = {
        "resourceType": "Patient",
        "id": str(patient.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
        },
        "identifier": [],
        "active": patient.is_active if hasattr(patient, 'is_active') else True,
        "name": [
            {
                "use": "official",
                "family": patient.last_name,
                "given": [patient.first_name] if patient.first_name else []
            }
        ],
        "gender": patient.gender if patient.gender in ["male", "female", "other", "unknown"] else "unknown",
        "birthDate": patient.date_of_birth.isoformat() if patient.date_of_birth else None
    }
    
    # Handle deceased status
    if hasattr(patient, 'date_of_death') and patient.date_of_death:
        resource["deceasedDateTime"] = patient.date_of_death.isoformat()
    else:
        resource["deceasedBoolean"] = False
    
    # Add identifiers using helper
    if patient.ssn:
        resource["identifier"].append(
            create_identifier("http://hl7.org/fhir/sid/us-ssn", patient.ssn, "official")
        )
    
    if hasattr(patient, 'mrn') and patient.mrn:
        resource["identifier"].append(
            create_identifier("http://hospital.example.org/mrn", patient.mrn, "usual")
        )
    
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
        "subject": create_reference("Patient", encounter.patient_id),
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
        "subject": create_reference("Patient", observation.patient_id),
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
        resource["code"] = create_codeable_concept(
            system="http://loinc.org",
            code=observation.loinc_code,
            display=observation.display,
            text=observation.display
        )
    
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
    
    # Add performer reference if available
    if observation.provider_id:
        resource["performer"] = [{
            "reference": f"Practitioner/{observation.provider_id}"
        }]
    
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


def practitioner_to_fhir(provider: Provider, include_person_link: bool = False, session = None) -> Dict[str, Any]:
    """Convert Provider model to FHIR Practitioner resource
    
    This is a wrapper around the enhanced practitioner converter for backward compatibility.
    """
    return provider_to_practitioner(provider, include_person_link=include_person_link, session=session)


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

def allergy_intolerance_to_fhir(allergy: Allergy) -> Dict[str, Any]:
    """Convert Allergy model to FHIR AllergyIntolerance resource"""
    resource = {
        "resourceType": "AllergyIntolerance",
        "id": str(allergy.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "clinicalStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                "code": allergy.clinical_status or "active",
                "display": (allergy.clinical_status or "active").title()
            }]
        },
        "verificationStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", 
                "code": allergy.verification_status or "confirmed",
                "display": (allergy.verification_status or "confirmed").title()
            }]
        },
        "type": allergy.allergy_type or "allergy",
        "category": [allergy.category] if allergy.category else ["environment"],
        "criticality": allergy.severity or "low",
        "code": {
            "coding": [],
            "text": allergy.description
        },
        "patient": create_reference("Patient", allergy.patient_id)
    }
    
    # Add SNOMED code if available
    if allergy.snomed_code:
        resource["code"]["coding"].append({
            "system": "http://snomed.info/sct",
            "code": allergy.snomed_code,
            "display": allergy.description
        })
    
    # Add onset date
    if allergy.onset_date:
        resource["onsetDateTime"] = allergy.onset_date.isoformat()
    
    # Add resolution date if resolved
    if allergy.resolution_date:
        resource["lastOccurrence"] = allergy.resolution_date.isoformat()
        
    # Add encounter reference if available
    if allergy.encounter_id:
        resource["encounter"] = create_reference("Encounter", allergy.encounter_id)
    
    # Add reaction information
    if allergy.reaction:
        resource["reaction"] = [{
            "manifestation": [{
                "text": allergy.reaction
            }],
            "severity": allergy.severity or "mild"
        }]
    
    return resource


def immunization_to_fhir(immunization: Immunization) -> Dict[str, Any]:
    """Convert Immunization model to FHIR Immunization resource"""
    resource = {
        "resourceType": "Immunization",
        "id": str(immunization.id),
        "meta": {
            "versionId": "1", 
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": immunization.status or "completed",
        "vaccineCode": {
            "coding": [],
            "text": immunization.description
        },
        "patient": create_reference("Patient", immunization.patient_id),
        "occurrenceDateTime": immunization.immunization_date.isoformat() if immunization.immunization_date else None,
        "primarySource": True
    }
    
    # Add CVX code if available
    if immunization.cvx_code:
        resource["vaccineCode"]["coding"].append({
            "system": "http://hl7.org/fhir/sid/cvx",
            "code": immunization.cvx_code,
            "display": immunization.description
        })
    
    # Add dose quantity
    if immunization.dose_quantity:
        resource["doseQuantity"] = {
            "value": immunization.dose_quantity,
            "unit": "mL",
            "system": "http://unitsofmeasure.org",
            "code": "mL"
        }
    
    # Add encounter reference if available
    if immunization.encounter_id:
        resource["encounter"] = create_reference("Encounter", immunization.encounter_id)
    
    return resource


def procedure_to_fhir(procedure: Procedure) -> Dict[str, Any]:
    """Convert Procedure model to FHIR Procedure resource"""
    resource = {
        "resourceType": "Procedure", 
        "id": str(procedure.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": procedure.status or "completed",
        "code": {
            "coding": [],
            "text": procedure.description
        },
        "subject": create_reference("Patient", procedure.patient_id),
        "performedDateTime": procedure.procedure_date.isoformat() if procedure.procedure_date else None
    }
    
    # Add SNOMED code if available
    if procedure.snomed_code:
        resource["code"]["coding"].append({
            "system": "http://snomed.info/sct", 
            "code": procedure.snomed_code,
            "display": procedure.description
        })
    
    # Add reason for procedure
    if procedure.reason_code or procedure.reason_description:
        resource["reasonCode"] = [{
            "coding": [],
            "text": procedure.reason_description or procedure.reason_code
        }]
        if procedure.reason_code:
            resource["reasonCode"][0]["coding"].append({
                "code": procedure.reason_code,
                "display": procedure.reason_description
            })
    
    # Add outcome
    if procedure.outcome:
        resource["outcome"] = {
            "text": procedure.outcome
        }
    
    # Add encounter reference if available  
    if procedure.encounter_id:
        resource["encounter"] = create_reference("Encounter", procedure.encounter_id)
    
    return resource


def care_plan_to_fhir(care_plan: CarePlan) -> Dict[str, Any]:
    """Convert CarePlan model to FHIR CarePlan resource"""
    resource = {
        "resourceType": "CarePlan",
        "id": str(care_plan.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": care_plan.status or "active",
        "intent": care_plan.intent or "plan",
        "title": care_plan.description,
        "description": care_plan.description,
        "subject": create_reference("Patient", care_plan.patient_id),
        "period": {
            "start": care_plan.start_date.isoformat() if care_plan.start_date else None,
            "end": care_plan.end_date.isoformat() if care_plan.end_date else None
        }
    }
    
    # Add category
    if care_plan.snomed_code:
        resource["category"] = [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": care_plan.snomed_code,
                "display": care_plan.description
            }],
            "text": care_plan.description
        }]
    
    # Add addresses (reason for care plan)
    if care_plan.reason_code or care_plan.reason_description:
        resource["addresses"] = [{
            "coding": [],
            "text": care_plan.reason_description or care_plan.reason_code
        }]
        if care_plan.reason_code:
            resource["addresses"][0]["coding"].append({
                "code": care_plan.reason_code,
                "display": care_plan.reason_description
            })
    
    # Add activities if available
    if care_plan.activities:
        resource["activity"] = care_plan.activities
    
    # Add encounter reference if available
    if care_plan.encounter_id:
        resource["encounter"] = create_reference("Encounter", care_plan.encounter_id)
    
    return resource


def device_to_fhir(device: Device) -> Dict[str, Any]:
    """Convert Device model to FHIR Device resource"""
    resource = {
        "resourceType": "Device",
        "id": str(device.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": device.status or "active",
        "deviceName": [{
            "name": device.description,
            "type": "other"
        }],
        "patient": create_reference("Patient", device.patient_id)
    }
    
    # Add device type
    if device.snomed_code:
        resource["type"] = {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": device.snomed_code,
                "display": device.description
            }],
            "text": device.description
        }
    
    # Add UDI if available
    if device.udi:
        resource["udiCarrier"] = [{
            "deviceIdentifier": device.udi,
            "carrierHRF": device.udi
        }]
    
    return resource


def diagnostic_report_to_fhir(diagnostic_report: DiagnosticReport) -> Dict[str, Any]:
    """Convert DiagnosticReport model to FHIR DiagnosticReport resource"""
    resource = {
        "resourceType": "DiagnosticReport",
        "id": str(diagnostic_report.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": diagnostic_report.status or "final",
        "subject": create_reference("Patient", diagnostic_report.patient_id),
        "effectiveDateTime": diagnostic_report.report_date.isoformat() if diagnostic_report.report_date else None
    }
    
    # Add code
    if diagnostic_report.loinc_code:
        resource["code"] = {
            "coding": [{
                "system": "http://loinc.org",
                "code": diagnostic_report.loinc_code,
                "display": diagnostic_report.description
            }],
            "text": diagnostic_report.description
        }
    else:
        resource["code"] = {
            "text": diagnostic_report.description
        }
    
    # Add encounter reference if available
    if diagnostic_report.encounter_id:
        resource["encounter"] = create_reference("Encounter", diagnostic_report.encounter_id)
    
    # Add result observations if available
    if diagnostic_report.result_observations:
        resource["result"] = []
        for obs_id in diagnostic_report.result_observations:
            resource["result"].append(create_reference("Observation", obs_id))
    
    return resource


def imaging_study_to_fhir(imaging_study: ImagingStudy) -> Dict[str, Any]:
    """Convert ImagingStudy model to FHIR ImagingStudy resource"""
    resource = {
        "resourceType": "ImagingStudy",
        "id": str(imaging_study.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        },
        "status": imaging_study.status or "available",
        "subject": create_reference("Patient", imaging_study.patient_id),
        "started": imaging_study.study_date.isoformat() if imaging_study.study_date else None,
        "numberOfSeries": imaging_study.number_of_series or 1,
        "numberOfInstances": imaging_study.number_of_instances or 1
    }
    
    # Add modality
    if imaging_study.modality:
        resource["modality"] = [{
            "system": "http://dicom.nema.org/resources/ontology/DCM",
            "code": imaging_study.modality,
            "display": imaging_study.modality
        }]
    
    # Add procedure code
    if imaging_study.snomed_code:
        resource["procedureCode"] = [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": imaging_study.snomed_code,
                "display": imaging_study.description
            }],
            "text": imaging_study.description
        }]
    
    # Add series information
    resource["series"] = [{
        "uid": f"1.2.3.{imaging_study.id}",
        "number": 1,
        "modality": {
            "system": "http://dicom.nema.org/resources/ontology/DCM",
            "code": imaging_study.modality or "CT",
            "display": imaging_study.modality or "CT"
        },
        "description": imaging_study.description,
        "numberOfInstances": imaging_study.number_of_instances or 1,
        "bodySite": {
            "text": imaging_study.body_part
        } if imaging_study.body_part else None
    }]
    
    return resource

def service_request_to_fhir(service_request) -> Dict[str, Any]:
    """Convert ServiceRequest model to FHIR ServiceRequest resource"""
    return service_request_to_fhir_dict(service_request)
