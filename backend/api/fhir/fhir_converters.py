"""Converters between database models and FHIR resources"""

from datetime import datetime, date
from typing import Dict, Any

from models.models import Patient, Encounter, Observation, Condition, Medication, Provider, Location

def patient_to_fhir(patient: Patient) -> Dict[str, Any]:
    """Convert database Patient to FHIR Patient resource"""
    fhir_patient = {
        "resourceType": "Patient",
        "id": patient.id,
        "identifier": [
            {
                "use": "usual",
                "type": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                            "code": "MR",
                            "display": "Medical record number"
                        }
                    ]
                },
                "value": patient.mrn
            }
        ],
        "active": True,
        "name": [
            {
                "use": "official",
                "family": patient.last_name,
                "given": [patient.first_name]
            }
        ],
        "gender": patient.gender.lower() if patient.gender else "unknown",
        "birthDate": patient.date_of_birth.isoformat() if patient.date_of_birth else None
    }
    
    # Add address
    if patient.address:
        fhir_patient["address"] = [
            {
                "use": "home",
                "line": [patient.address],
                "city": patient.city,
                "state": patient.state,
                "postalCode": patient.zip_code,
                "country": "US"
            }
        ]
    
    # Add telecom
    telecom = []
    if patient.phone:
        telecom.append({
            "system": "phone",
            "value": patient.phone,
            "use": "home"
        })
    if patient.email:
        telecom.append({
            "system": "email",
            "value": patient.email,
            "use": "home"
        })
    if telecom:
        fhir_patient["telecom"] = telecom
    
    return fhir_patient

def encounter_to_fhir(encounter: Encounter) -> Dict[str, Any]:
    """Convert database Encounter to FHIR Encounter resource"""
    fhir_encounter = {
        "resourceType": "Encounter",
        "id": encounter.id,
        "status": encounter.status or "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": map_encounter_class(encounter.encounter_type),
            "display": encounter.encounter_type
        },
        "type": [
            {
                "text": encounter.encounter_type
            }
        ],
        "subject": {
            "reference": f"Patient/{encounter.patient_id}"
        }
    }
    
    # Add period
    if encounter.encounter_date:
        fhir_encounter["period"] = {
            "start": encounter.encounter_date.isoformat()
        }
    
    # Add participant (provider)
    if encounter.provider_id:
        fhir_encounter["participant"] = [
            {
                "type": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                                "code": "ATND",
                                "display": "attender"
                            }
                        ]
                    }
                ],
                "individual": {
                    "reference": f"Practitioner/{encounter.provider_id}"
                }
            }
        ]
    
    # Add location
    if encounter.location_id:
        fhir_encounter["location"] = [
            {
                "location": {
                    "reference": f"Location/{encounter.location_id}"
                }
            }
        ]
    
    # Add reason (chief complaint)
    if encounter.chief_complaint:
        fhir_encounter["reasonCode"] = [
            {
                "text": encounter.chief_complaint
            }
        ]
    
    return fhir_encounter

def observation_to_fhir(observation: Observation) -> Dict[str, Any]:
    """Convert database Observation to FHIR Observation resource"""
    fhir_observation = {
        "resourceType": "Observation",
        "id": observation.id,
        "status": "final",
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": observation.loinc_code or observation.code,
                    "display": observation.display
                }
            ]
        },
        "subject": {
            "reference": f"Patient/{observation.patient_id}"
        }
    }
    
    # Add category
    category_map = {
        "vital-signs": "vital-signs",
        "laboratory": "laboratory",
        "imaging": "imaging",
        "procedure": "procedure"
    }
    
    if observation.observation_type in category_map:
        fhir_observation["category"] = [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": category_map[observation.observation_type],
                        "display": observation.observation_type
                    }
                ]
            }
        ]
    
    # Add encounter reference
    if observation.encounter_id:
        fhir_observation["encounter"] = {
            "reference": f"Encounter/{observation.encounter_id}"
        }
    
    # Add effective date
    if observation.observation_date:
        fhir_observation["effectiveDateTime"] = observation.observation_date.isoformat()
    
    # Add value - try value_quantity first, then value
    value = observation.value_quantity if observation.value_quantity is not None else observation.value
    if value is not None:
        fhir_observation["valueQuantity"] = {
            "value": value,
            "unit": observation.value_unit,
            "system": "http://unitsofmeasure.org",
            "code": observation.value_unit
        }
    
    # Add interpretation
    if observation.interpretation:
        interpretation_map = {
            "Normal": "N",
            "High": "H",
            "Low": "L",
            "Critical": "HH"
        }
        code = interpretation_map.get(observation.interpretation, "N")
        fhir_observation["interpretation"] = [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                        "code": code,
                        "display": observation.interpretation
                    }
                ]
            }
        ]
    
    # Add reference range
    if observation.reference_range_low is not None or observation.reference_range_high is not None:
        reference_range = {}
        if observation.reference_range_low is not None:
            reference_range["low"] = {
                "value": observation.reference_range_low,
                "unit": observation.unit
            }
        if observation.reference_range_high is not None:
            reference_range["high"] = {
                "value": observation.reference_range_high,
                "unit": observation.unit
            }
        fhir_observation["referenceRange"] = [reference_range]
    
    return fhir_observation

def condition_to_fhir(condition: Condition) -> Dict[str, Any]:
    """Convert database Condition to FHIR Condition resource"""
    fhir_condition = {
        "resourceType": "Condition",
        "id": condition.id,
        "clinicalStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": condition.clinical_status or "active",
                    "display": condition.clinical_status or "Active"
                }
            ]
        },
        "verificationStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": condition.verification_status or "confirmed",
                    "display": condition.verification_status or "Confirmed"
                }
            ]
        },
        "code": {
            "coding": [
                {
                    "system": "http://hl7.org/fhir/sid/icd-10-cm",
                    "code": condition.icd10_code,
                    "display": condition.description
                }
            ]
        },
        "subject": {
            "reference": f"Patient/{condition.patient_id}"
        }
    }
    
    # Add onset date
    if condition.onset_date:
        fhir_condition["onsetDateTime"] = condition.onset_date.isoformat()
    
    # Add recorded date
    if condition.recorded_date:
        fhir_condition["recordedDate"] = condition.recorded_date.isoformat()
    
    return fhir_condition

def medication_to_fhir(medication: Medication) -> Dict[str, Any]:
    """Convert database Medication to FHIR MedicationRequest resource"""
    fhir_medication = {
        "resourceType": "MedicationRequest",
        "id": medication.id,
        "status": medication.status or "active",
        "intent": "order",
        "medicationCodeableConcept": {
            "coding": [
                {
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": medication.rxnorm_code,
                    "display": medication.medication_name
                }
            ] if medication.rxnorm_code else [],
            "text": medication.medication_name
        },
        "subject": {
            "reference": f"Patient/{medication.patient_id}"
        }
    }
    
    # Add encounter reference
    if medication.encounter_id:
        fhir_medication["encounter"] = {
            "reference": f"Encounter/{medication.encounter_id}"
        }
    
    # Add authored on date
    if medication.start_date:
        fhir_medication["authoredOn"] = medication.start_date.isoformat()
    
    # Add requester (prescriber)
    if medication.prescriber_id:
        fhir_medication["requester"] = {
            "reference": f"Practitioner/{medication.prescriber_id}"
        }
    
    # Add dosage instruction
    dosage_instruction = {
        "text": f"{medication.dosage} {medication.route} {medication.frequency}"
    }
    
    if medication.route:
        dosage_instruction["route"] = {
            "text": medication.route
        }
    
    if medication.dosage:
        dosage_parts = medication.dosage.split()
        if dosage_parts:
            dosage_instruction["doseAndRate"] = [
                {
                    "doseQuantity": {
                        "value": float(dosage_parts[0]) if dosage_parts[0].replace('.', '').isdigit() else 1,
                        "unit": dosage_parts[1] if len(dosage_parts) > 1 else "unit"
                    }
                }
            ]
    
    fhir_medication["dosageInstruction"] = [dosage_instruction]
    
    return fhir_medication

def provider_to_fhir(provider: Provider) -> Dict[str, Any]:
    """Convert database Provider to FHIR Practitioner resource"""
    fhir_practitioner = {
        "resourceType": "Practitioner",
        "id": provider.id,
        "identifier": [
            {
                "use": "official",
                "type": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                            "code": "NPI",
                            "display": "National provider identifier"
                        }
                    ]
                },
                "value": provider.npi
            }
        ] if provider.npi else [],
        "active": provider.active,
        "name": [
            {
                "use": "official",
                "family": provider.last_name,
                "given": [provider.first_name],
                "prefix": [provider.title] if provider.title else []
            }
        ]
    }
    
    # Add telecom
    telecom = []
    if provider.phone:
        telecom.append({
            "system": "phone",
            "value": provider.phone,
            "use": "work"
        })
    if provider.email:
        telecom.append({
            "system": "email",
            "value": provider.email,
            "use": "work"
        })
    if telecom:
        fhir_practitioner["telecom"] = telecom
    
    # Add qualification (specialty)
    if provider.specialty:
        fhir_practitioner["qualification"] = [
            {
                "code": {
                    "text": provider.specialty
                }
            }
        ]
    
    return fhir_practitioner

def location_to_fhir(location: Location) -> Dict[str, Any]:
    """Convert database Location to FHIR Location resource"""
    fhir_location = {
        "resourceType": "Location",
        "id": location.id,
        "status": "active",
        "name": location.name,
        "type": [
            {
                "text": location.type
            }
        ] if location.type else []
    }
    
    # Add address
    if location.address:
        fhir_location["address"] = {
            "use": "work",
            "line": [location.address],
            "city": location.city,
            "state": location.state,
            "postalCode": location.zip_code,
            "country": "US"
        }
    
    # Add telecom
    if location.phone:
        fhir_location["telecom"] = [
            {
                "system": "phone",
                "value": location.phone,
                "use": "work"
            }
        ]
    
    return fhir_location

def map_encounter_class(encounter_type: str) -> str:
    """Map encounter type to FHIR encounter class code"""
    mapping = {
        "outpatient": "AMB",
        "inpatient": "IMP",
        "emergency": "EMER",
        "home": "HH",
        "virtual": "VR",
        "observation": "OBSENC"
    }
    return mapping.get(encounter_type.lower(), "AMB")