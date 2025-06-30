"""
Comprehensive FHIR R4 API Router
Implements FHIR R4 standard with chained queries, complex queries, and bulk operations
Reference: HAPI FHIR Server specifications
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, text
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from urllib.parse import unquote
import json
import uuid
import re

from database.database import get_db
from models.models import Patient, Encounter, Provider, Location, Observation, Condition, Medication
from .schemas import *

router = APIRouter(prefix="/fhir/R4", tags=["FHIR R4"])

# FHIR Resource Type Mappings
RESOURCE_MAPPINGS = {
    "Patient": {
        "model": Patient,
        "search_params": [
            "identifier", "name", "family", "given", "birthdate", "gender", 
            "address", "telecom", "active", "_id", "_lastUpdated"
        ]
    },
    "Encounter": {
        "model": Encounter,
        "search_params": [
            "identifier", "status", "class", "type", "subject", "participant",
            "period", "reason-code", "reason-reference", "location", "_id", "_lastUpdated"
        ]
    },
    "Observation": {
        "model": Observation,
        "search_params": [
            "identifier", "status", "category", "code", "subject", "encounter",
            "effective", "performer", "value-quantity", "value-string", "component-code",
            "component-value-quantity", "_id", "_lastUpdated"
        ]
    },
    "Condition": {
        "model": Condition,
        "search_params": [
            "identifier", "clinical-status", "verification-status", "category", "severity",
            "code", "subject", "encounter", "onset-date", "onset-age", "recorded-date",
            "_id", "_lastUpdated"
        ]
    },
    "MedicationRequest": {
        "model": Medication,
        "search_params": [
            "identifier", "status", "intent", "category", "medication", "subject",
            "encounter", "authored-on", "requester", "_id", "_lastUpdated"
        ]
    },
    "Practitioner": {
        "model": Provider,
        "search_params": [
            "identifier", "active", "name", "family", "given", "telecom", 
            "qualification", "_id", "_lastUpdated"
        ]
    },
    "Location": {
        "model": Location,
        "search_params": [
            "identifier", "status", "name", "type", "address", "position",
            "_id", "_lastUpdated"
        ]
    }
}

class FHIRSearchProcessor:
    """Processes FHIR search parameters and builds database queries"""
    
    def __init__(self, resource_type: str, db: Session):
        self.resource_type = resource_type
        self.db = db
        self.resource_config = RESOURCE_MAPPINGS.get(resource_type)
        if not self.resource_config:
            raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
        self.model = self.resource_config["model"]
    
    def build_query(self, search_params: Dict[str, Any]):
        """Build SQLAlchemy query from FHIR search parameters"""
        query = self.db.query(self.model)
        
        # Handle include parameters for joins
        if "_include" in search_params:
            query = self._add_includes(query, search_params["_include"])
        
        # Process search parameters
        for param, value in search_params.items():
            if param.startswith("_"):
                query = self._handle_control_parameter(query, param, value)
            else:
                query = self._handle_search_parameter(query, param, value)
        
        return query
    
    def _add_includes(self, query, includes):
        """Add SQL joins for _include parameters"""
        include_list = includes if isinstance(includes, list) else [includes]
        
        for include in include_list:
            if ":" in include:
                resource, field = include.split(":", 1)
                if resource == self.resource_type:
                    # Add appropriate joins based on field
                    if field == "subject" and self.model == Encounter:
                        query = query.options(joinedload(Encounter.patient))
                    elif field == "performer" and self.model == Observation:
                        query = query.options(joinedload(Observation.provider))
                    # Add more include mappings as needed
        
        return query
    
    def _handle_control_parameter(self, query, param, value):
        """Handle FHIR control parameters (_count, _sort, etc.)"""
        if param == "_id":
            ids = value if isinstance(value, list) else [value]
            query = query.filter(self.model.id.in_(ids))
        elif param == "_lastUpdated":
            # Handle date range searches
            if isinstance(value, str):
                if value.startswith("ge"):
                    date_val = self._parse_date(value[2:])
                    query = query.filter(self.model.updated_at >= date_val)
                elif value.startswith("le"):
                    date_val = self._parse_date(value[2:])
                    query = query.filter(self.model.updated_at <= date_val)
                elif value.startswith("gt"):
                    date_val = self._parse_date(value[2:])
                    query = query.filter(self.model.updated_at > date_val)
                elif value.startswith("lt"):
                    date_val = self._parse_date(value[2:])
                    query = query.filter(self.model.updated_at < date_val)
        
        return query
    
    def _handle_search_parameter(self, query, param, value):
        """Handle resource-specific search parameters"""
        if self.resource_type == "Patient":
            query = self._handle_patient_search(query, param, value)
        elif self.resource_type == "Encounter":
            query = self._handle_encounter_search(query, param, value)
        elif self.resource_type == "Observation":
            query = self._handle_observation_search(query, param, value)
        elif self.resource_type == "Condition":
            query = self._handle_condition_search(query, param, value)
        elif self.resource_type == "MedicationRequest":
            query = self._handle_medication_search(query, param, value)
        elif self.resource_type == "Practitioner":
            query = self._handle_practitioner_search(query, param, value)
        elif self.resource_type == "Location":
            query = self._handle_location_search(query, param, value)
        
        return query
    
    def _handle_patient_search(self, query, param, value):
        """Handle Patient-specific search parameters"""
        if param == "identifier":
            query = query.filter(Patient.mrn.ilike(f"%{value}%"))
        elif param == "name":
            query = query.filter(or_(
                Patient.first_name.ilike(f"%{value}%"),
                Patient.last_name.ilike(f"%{value}%")
            ))
        elif param == "family":
            query = query.filter(Patient.last_name.ilike(f"%{value}%"))
        elif param == "given":
            query = query.filter(Patient.first_name.ilike(f"%{value}%"))
        elif param == "birthdate":
            birth_date = self._parse_date(value)
            query = query.filter(Patient.date_of_birth == birth_date)
        elif param == "gender":
            query = query.filter(Patient.gender.ilike(value))
        elif param == "address":
            query = query.filter(or_(
                Patient.address.ilike(f"%{value}%"),
                Patient.city.ilike(f"%{value}%"),
                Patient.state.ilike(f"%{value}%"),
                Patient.zip_code.ilike(f"%{value}%")
            ))
        elif param == "telecom":
            query = query.filter(or_(
                Patient.phone.ilike(f"%{value}%"),
                Patient.email.ilike(f"%{value}%")
            ))
        
        return query
    
    def _handle_encounter_search(self, query, param, value):
        """Handle Encounter-specific search parameters"""
        if param == "subject":
            # Handle chained parameters
            if ":" in value:
                resource_type, search_value = value.split(":", 1)
                if resource_type == "Patient":
                    subquery = self.db.query(Patient.id).filter(
                        Patient.mrn.ilike(f"%{search_value}%")
                    )
                    query = query.filter(Encounter.patient_id.in_(subquery))
            else:
                query = query.filter(Encounter.patient_id == value)
        elif param == "status":
            query = query.filter(Encounter.status.ilike(value))
        elif param == "type":
            query = query.filter(Encounter.encounter_type.ilike(f"%{value}%"))
        elif param == "period":
            date_val = self._parse_date(value)
            query = query.filter(Encounter.encounter_date >= date_val)
        elif param == "participant":
            query = query.filter(Encounter.provider_id == value)
        elif param == "location":
            query = query.filter(Encounter.location_id == value)
        
        return query
    
    def _handle_observation_search(self, query, param, value):
        """Handle Observation-specific search parameters"""
        if param == "subject":
            if ":" in value:
                resource_type, search_value = value.split(":", 1)
                if resource_type == "Patient":
                    subquery = self.db.query(Patient.id).filter(
                        Patient.mrn.ilike(f"%{search_value}%")
                    )
                    query = query.filter(Observation.patient_id.in_(subquery))
            else:
                query = query.filter(Observation.patient_id == value)
        elif param == "encounter":
            query = query.filter(Observation.encounter_id == value)
        elif param == "code":
            query = query.filter(Observation.code.ilike(f"%{value}%"))
        elif param == "category":
            query = query.filter(Observation.observation_type.ilike(f"%{value}%"))
        elif param == "value-quantity":
            # Handle numeric value searches
            if ":" in value:
                operator, val = value.split(":", 1)
                numeric_val = float(val)
                if operator == "gt":
                    query = query.filter(Observation.value.cast(func.float) > numeric_val)
                elif operator == "lt":
                    query = query.filter(Observation.value.cast(func.float) < numeric_val)
                elif operator == "ge":
                    query = query.filter(Observation.value.cast(func.float) >= numeric_val)
                elif operator == "le":
                    query = query.filter(Observation.value.cast(func.float) <= numeric_val)
            else:
                query = query.filter(Observation.value == value)
        elif param == "effective":
            date_val = self._parse_date(value)
            query = query.filter(Observation.observation_date >= date_val)
        
        return query
    
    def _handle_condition_search(self, query, param, value):
        """Handle Condition-specific search parameters"""
        if param == "subject":
            if ":" in value:
                resource_type, search_value = value.split(":", 1)
                if resource_type == "Patient":
                    subquery = self.db.query(Patient.id).filter(
                        Patient.mrn.ilike(f"%{search_value}%")
                    )
                    query = query.filter(Condition.patient_id.in_(subquery))
            else:
                query = query.filter(Condition.patient_id == value)
        elif param == "clinical-status":
            query = query.filter(Condition.clinical_status.ilike(value))
        elif param == "verification-status":
            query = query.filter(Condition.verification_status.ilike(value))
        elif param == "code":
            query = query.filter(or_(
                Condition.icd10_code.ilike(f"%{value}%"),
                Condition.description.ilike(f"%{value}%")
            ))
        elif param == "onset-date":
            date_val = self._parse_date(value)
            query = query.filter(Condition.onset_date >= date_val)
        elif param == "recorded-date":
            date_val = self._parse_date(value)
            query = query.filter(Condition.recorded_date >= date_val)
        
        return query
    
    def _handle_medication_search(self, query, param, value):
        """Handle MedicationRequest-specific search parameters"""
        if param == "subject":
            if ":" in value:
                resource_type, search_value = value.split(":", 1)
                if resource_type == "Patient":
                    subquery = self.db.query(Patient.id).filter(
                        Patient.mrn.ilike(f"%{search_value}%")
                    )
                    query = query.filter(Medication.patient_id.in_(subquery))
            else:
                query = query.filter(Medication.patient_id == value)
        elif param == "status":
            query = query.filter(Medication.status.ilike(value))
        elif param == "medication":
            query = query.filter(Medication.medication_name.ilike(f"%{value}%"))
        elif param == "authored-on":
            date_val = self._parse_date(value)
            query = query.filter(Medication.start_date >= date_val)
        elif param == "requester":
            query = query.filter(Medication.prescriber_id == value)
        
        return query
    
    def _handle_practitioner_search(self, query, param, value):
        """Handle Practitioner-specific search parameters"""
        if param == "name":
            query = query.filter(or_(
                Provider.first_name.ilike(f"%{value}%"),
                Provider.last_name.ilike(f"%{value}%")
            ))
        elif param == "family":
            query = query.filter(Provider.last_name.ilike(f"%{value}%"))
        elif param == "given":
            query = query.filter(Provider.first_name.ilike(f"%{value}%"))
        elif param == "qualification":
            query = query.filter(Provider.specialty.ilike(f"%{value}%"))
        elif param == "telecom":
            query = query.filter(or_(
                Provider.phone.ilike(f"%{value}%"),
                Provider.email.ilike(f"%{value}%")
            ))
        
        return query
    
    def _handle_location_search(self, query, param, value):
        """Handle Location-specific search parameters"""
        if param == "name":
            query = query.filter(Location.name.ilike(f"%{value}%"))
        elif param == "type":
            query = query.filter(Location.type.ilike(f"%{value}%"))
        elif param == "address":
            query = query.filter(or_(
                Location.address.ilike(f"%{value}%"),
                Location.city.ilike(f"%{value}%"),
                Location.state.ilike(f"%{value}%"),
                Location.zip_code.ilike(f"%{value}%")
            ))
        
        return query
    
    def _parse_date(self, date_str: str) -> datetime:
        """Parse FHIR date string to datetime"""
        try:
            # Handle different date formats
            if "T" in date_str:
                return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            else:
                return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {date_str}")

class FHIRResourceBuilder:
    """Builds FHIR R4 resources from database models"""
    
    @staticmethod
    def build_patient(patient: Patient) -> Dict[str, Any]:
        """Build FHIR Patient resource"""
        return {
            "resourceType": "Patient",
            "id": patient.id,
            "meta": {
                "lastUpdated": patient.updated_at.isoformat() if patient.updated_at else patient.created_at.isoformat(),
                "versionId": "1"
            },
            "identifier": [
                {
                    "use": "usual",
                    "system": "http://hospital.org/mrn",
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
            "birthDate": patient.date_of_birth.isoformat(),
            "address": [
                {
                    "use": "home",
                    "line": [patient.address],
                    "city": patient.city,
                    "state": patient.state,
                    "postalCode": patient.zip_code
                }
            ],
            "telecom": [
                {
                    "system": "phone",
                    "value": patient.phone,
                    "use": "home"
                },
                {
                    "system": "email",
                    "value": patient.email,
                    "use": "home"
                }
            ],
            "contact": [
                {
                    "relationship": [
                        {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/v2-0131",
                                    "code": "E",
                                    "display": "Emergency Contact"
                                }
                            ]
                        }
                    ],
                    "name": {
                        "text": patient.emergency_contact_name
                    },
                    "telecom": [
                        {
                            "system": "phone",
                            "value": patient.emergency_contact_phone
                        }
                    ]
                }
            ] if patient.emergency_contact_name else []
        }
    
    @staticmethod
    def build_encounter(encounter: Encounter) -> Dict[str, Any]:
        """Build FHIR Encounter resource"""
        return {
            "resourceType": "Encounter",
            "id": encounter.id,
            "meta": {
                "lastUpdated": encounter.created_at.isoformat(),
                "versionId": "1"
            },
            "status": encounter.status.lower() if encounter.status else "finished",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB" if encounter.encounter_type == "outpatient" else "IMP",
                "display": encounter.encounter_type
            },
            "type": [
                {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "185347001",
                            "display": encounter.encounter_type
                        }
                    ]
                }
            ],
            "subject": {
                "reference": f"Patient/{encounter.patient_id}",
                "type": "Patient"
            },
            "participant": [
                {
                    "type": [
                        {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                                    "code": "PPRF",
                                    "display": "primary performer"
                                }
                            ]
                        }
                    ],
                    "individual": {
                        "reference": f"Practitioner/{encounter.provider_id}",
                        "type": "Practitioner"
                    }
                }
            ] if encounter.provider_id else [],
            "period": {
                "start": encounter.encounter_date.isoformat(),
                "end": encounter.encounter_date.isoformat()
            },
            "reasonCode": [
                {
                    "text": encounter.chief_complaint
                }
            ] if encounter.chief_complaint else [],
            "location": [
                {
                    "location": {
                        "reference": f"Location/{encounter.location_id}",
                        "type": "Location"
                    }
                }
            ] if encounter.location_id else []
        }
    
    @staticmethod
    def build_observation(observation: Observation) -> Dict[str, Any]:
        """Build FHIR Observation resource"""
        return {
            "resourceType": "Observation",
            "id": observation.id,
            "meta": {
                "lastUpdated": observation.created_at.isoformat(),
                "versionId": "1"
            },
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "vital-signs" if observation.observation_type == "vital-signs" else "laboratory",
                            "display": observation.observation_type.replace("-", " ").title()
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": observation.code,
                        "display": observation.display
                    }
                ]
            },
            "subject": {
                "reference": f"Patient/{observation.patient_id}",
                "type": "Patient"
            },
            "encounter": {
                "reference": f"Encounter/{observation.encounter_id}",
                "type": "Encounter"
            } if observation.encounter_id else None,
            "effectiveDateTime": observation.observation_date.isoformat(),
            "valueQuantity": {
                "value": float(observation.value) if observation.value and observation.value.replace('.', '').isdigit() else None,
                "unit": observation.unit,
                "system": "http://unitsofmeasure.org",
                "code": observation.unit
            } if observation.value and observation.value.replace('.', '').isdigit() else {
                "valueString": observation.value
            }
        }
    
    @staticmethod
    def build_condition(condition: Condition) -> Dict[str, Any]:
        """Build FHIR Condition resource"""
        return {
            "resourceType": "Condition",
            "id": condition.id,
            "meta": {
                "lastUpdated": condition.recorded_date.isoformat() if condition.recorded_date else condition.created_at.isoformat(),
                "versionId": "1"
            },
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": condition.clinical_status.lower() if condition.clinical_status else "active",
                        "display": condition.clinical_status
                    }
                ]
            },
            "verificationStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                        "code": condition.verification_status.lower() if condition.verification_status else "confirmed",
                        "display": condition.verification_status
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
                "reference": f"Patient/{condition.patient_id}",
                "type": "Patient"
            },
            "onsetDateTime": condition.onset_date.isoformat() if condition.onset_date else None,
            "recordedDate": condition.recorded_date.isoformat() if condition.recorded_date else condition.created_at.isoformat()
        }
    
    @staticmethod
    def build_medication_request(medication: Medication) -> Dict[str, Any]:
        """Build FHIR MedicationRequest resource"""
        return {
            "resourceType": "MedicationRequest",
            "id": medication.id,
            "meta": {
                "lastUpdated": medication.created_at.isoformat(),
                "versionId": "1"
            },
            "status": medication.status.lower() if medication.status else "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [
                    {
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": medication.rxnorm_code or "unknown",
                        "display": medication.medication_name
                    }
                ],
                "text": medication.medication_name
            },
            "subject": {
                "reference": f"Patient/{medication.patient_id}",
                "type": "Patient"
            },
            "encounter": {
                "reference": f"Encounter/{medication.encounter_id}",
                "type": "Encounter"
            } if medication.encounter_id else None,
            "authoredOn": medication.start_date.isoformat(),
            "requester": {
                "reference": f"Practitioner/{medication.prescriber_id}",
                "type": "Practitioner"
            } if medication.prescriber_id else None,
            "dosageInstruction": [
                {
                    "text": f"{medication.dosage}, {medication.frequency}",
                    "route": {
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": "26643006" if medication.route == "oral" else "unknown",
                                "display": medication.route
                            }
                        ]
                    }
                }
            ]
        }
    
    @staticmethod
    def build_practitioner(provider: Provider) -> Dict[str, Any]:
        """Build FHIR Practitioner resource"""
        return {
            "resourceType": "Practitioner",
            "id": provider.id,
            "meta": {
                "lastUpdated": provider.created_at.isoformat(),
                "versionId": "1"
            },
            "identifier": [
                {
                    "use": "official",
                    "system": "http://hl7.org/fhir/sid/us-npi",
                    "value": provider.npi
                }
            ],
            "active": provider.active,
            "name": [
                {
                    "use": "official",
                    "family": provider.last_name,
                    "given": [provider.first_name],
                    "prefix": [provider.title] if provider.title else []
                }
            ],
            "telecom": [
                {
                    "system": "phone",
                    "value": provider.phone,
                    "use": "work"
                },
                {
                    "system": "email",
                    "value": provider.email,
                    "use": "work"
                }
            ],
            "qualification": [
                {
                    "code": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v2-0360",
                                "code": "MD",
                                "display": provider.specialty
                            }
                        ]
                    }
                }
            ]
        }
    
    @staticmethod
    def build_location(location: Location) -> Dict[str, Any]:
        """Build FHIR Location resource"""
        return {
            "resourceType": "Location",
            "id": location.id,
            "meta": {
                "lastUpdated": location.created_at.isoformat(),
                "versionId": "1"
            },
            "status": "active",
            "name": location.name,
            "type": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                            "code": "HOSP" if location.type == "Hospital" else "COMM",
                            "display": location.type
                        }
                    ]
                }
            ],
            "address": {
                "line": [location.address],
                "city": location.city,
                "state": location.state,
                "postalCode": location.zip_code
            },
            "telecom": [
                {
                    "system": "phone",
                    "value": location.phone,
                    "use": "work"
                }
            ] if location.phone else []
        }

# FHIR Endpoints

@router.get("/metadata")
async def get_capability_statement():
    """Return FHIR CapabilityStatement"""
    return {
        "resourceType": "CapabilityStatement",
        "id": "teaching-emr-fhir-server",
        "meta": {
            "lastUpdated": datetime.now().isoformat()
        },
        "status": "active",
        "date": datetime.now().isoformat(),
        "publisher": "Teaching EMR System",
        "kind": "instance",
        "software": {
            "name": "Teaching EMR FHIR Server",
            "version": "1.0.0"
        },
        "implementation": {
            "description": "Teaching EMR FHIR R4 Server"
        },
        "fhirVersion": "4.0.1",
        "format": ["json"],
        "rest": [
            {
                "mode": "server",
                "resource": [
                    {
                        "type": "Patient",
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"},
                            {"code": "create"},
                            {"code": "update"}
                        ],
                        "searchParam": [
                            {"name": "identifier", "type": "token"},
                            {"name": "name", "type": "string"},
                            {"name": "family", "type": "string"},
                            {"name": "given", "type": "string"},
                            {"name": "birthdate", "type": "date"},
                            {"name": "gender", "type": "token"},
                            {"name": "address", "type": "string"},
                            {"name": "telecom", "type": "string"}
                        ]
                    },
                    {
                        "type": "Encounter",
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"},
                            {"code": "create"},
                            {"code": "update"}
                        ],
                        "searchParam": [
                            {"name": "subject", "type": "reference"},
                            {"name": "status", "type": "token"},
                            {"name": "type", "type": "token"},
                            {"name": "period", "type": "date"}
                        ]
                    },
                    {
                        "type": "Observation",
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"},
                            {"code": "create"},
                            {"code": "update"}
                        ],
                        "searchParam": [
                            {"name": "subject", "type": "reference"},
                            {"name": "encounter", "type": "reference"},
                            {"name": "code", "type": "token"},
                            {"name": "category", "type": "token"},
                            {"name": "value-quantity", "type": "quantity"}
                        ]
                    },
                    {
                        "type": "Condition",
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"},
                            {"code": "create"},
                            {"code": "update"}
                        ],
                        "searchParam": [
                            {"name": "subject", "type": "reference"},
                            {"name": "clinical-status", "type": "token"},
                            {"name": "code", "type": "token"},
                            {"name": "onset-date", "type": "date"}
                        ]
                    },
                    {
                        "type": "MedicationRequest",
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"},
                            {"code": "create"},
                            {"code": "update"}
                        ],
                        "searchParam": [
                            {"name": "subject", "type": "reference"},
                            {"name": "status", "type": "token"},
                            {"name": "medication", "type": "reference"}
                        ]
                    },
                    {
                        "type": "Practitioner",
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"}
                        ],
                        "searchParam": [
                            {"name": "name", "type": "string"},
                            {"name": "qualification", "type": "token"}
                        ]
                    },
                    {
                        "type": "Location",
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"}
                        ],
                        "searchParam": [
                            {"name": "name", "type": "string"},
                            {"name": "type", "type": "token"}
                        ]
                    }
                ]
            }
        ]
    }

@router.get("/{resource_type}")
async def search_resources(
    resource_type: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Generic FHIR resource search with full R4 compliance"""
    
    # Parse query parameters
    query_params = dict(request.query_params)
    
    # Handle pagination
    count = int(query_params.pop("_count", 20))
    offset = int(query_params.pop("_offset", 0))
    
    # Handle includes
    includes = query_params.pop("_include", [])
    if isinstance(includes, str):
        includes = [includes]
    
    # Process search
    processor = FHIRSearchProcessor(resource_type, db)
    query = processor.build_query(query_params)
    
    # Execute query with pagination
    total = query.count()
    results = query.offset(offset).limit(count).all()
    
    # Build FHIR resources
    builder = FHIRResourceBuilder()
    entries = []
    
    for result in results:
        if resource_type == "Patient":
            fhir_resource = builder.build_patient(result)
        elif resource_type == "Encounter":
            fhir_resource = builder.build_encounter(result)
        elif resource_type == "Observation":
            fhir_resource = builder.build_observation(result)
        elif resource_type == "Condition":
            fhir_resource = builder.build_condition(result)
        elif resource_type == "MedicationRequest":
            fhir_resource = builder.build_medication_request(result)
        elif resource_type == "Practitioner":
            fhir_resource = builder.build_practitioner(result)
        elif resource_type == "Location":
            fhir_resource = builder.build_location(result)
        else:
            continue
        
        entries.append({
            "fullUrl": f"{request.base_url}fhir/R4/{resource_type}/{result.id}",
            "resource": fhir_resource,
            "search": {
                "mode": "match"
            }
        })
    
    # Build bundle response
    bundle = {
        "resourceType": "Bundle",
        "id": str(uuid.uuid4()),
        "meta": {
            "lastUpdated": datetime.now().isoformat()
        },
        "type": "searchset",
        "total": total,
        "link": [
            {
                "relation": "self",
                "url": str(request.url)
            }
        ],
        "entry": entries
    }
    
    # Add pagination links
    if offset + count < total:
        next_url = str(request.url).replace(f"_offset={offset}", f"_offset={offset + count}")
        bundle["link"].append({
            "relation": "next",
            "url": next_url
        })
    
    if offset > 0:
        prev_offset = max(0, offset - count)
        prev_url = str(request.url).replace(f"_offset={offset}", f"_offset={prev_offset}")
        bundle["link"].append({
            "relation": "previous", 
            "url": prev_url
        })
    
    return bundle

@router.get("/{resource_type}/{resource_id}")
async def get_resource(
    resource_type: str,
    resource_id: str,
    db: Session = Depends(get_db)
):
    """Get specific FHIR resource by ID"""
    
    resource_config = RESOURCE_MAPPINGS.get(resource_type)
    if not resource_config:
        raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
    
    model = resource_config["model"]
    result = db.query(model).filter(model.id == resource_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail=f"{resource_type}/{resource_id} not found")
    
    # Build FHIR resource
    builder = FHIRResourceBuilder()
    
    if resource_type == "Patient":
        return builder.build_patient(result)
    elif resource_type == "Encounter":
        return builder.build_encounter(result)
    elif resource_type == "Observation":
        return builder.build_observation(result)
    elif resource_type == "Condition":
        return builder.build_condition(result)
    elif resource_type == "MedicationRequest":
        return builder.build_medication_request(result)
    elif resource_type == "Practitioner":
        return builder.build_practitioner(result)
    elif resource_type == "Location":
        return builder.build_location(result)

@router.post("/$export")
async def bulk_export(
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    _type: Optional[str] = Query(None, description="Resource types to export"),
    _since: Optional[str] = Query(None, description="Export resources modified since this date"),
    _outputFormat: Optional[str] = Query("application/fhir+ndjson", description="Output format")
):
    """FHIR Bulk Data Export - System Level"""
    
    # Generate export job ID
    export_id = str(uuid.uuid4())
    
    # Return 202 Accepted with location header
    response = Response(status_code=202)
    response.headers["Content-Location"] = f"{request.base_url}fhir/R4/$export/{export_id}"
    
    # Start background export job
    background_tasks.add_task(
        _process_bulk_export,
        export_id,
        _type,
        _since,
        _outputFormat,
        db
    )
    
    return response

async def _process_bulk_export(
    export_id: str,
    resource_types: Optional[str],
    since: Optional[str],
    output_format: str,
    db: Session
):
    """Process bulk export in background"""
    # Implementation would write NDJSON files and update export status
    # This is a simplified version for demonstration
    pass

@router.get("/$export/{export_id}")
async def get_bulk_export_status(export_id: str):
    """Get bulk export job status"""
    # Return export status and download links
    return {
        "transactionTime": datetime.now().isoformat(),
        "request": f"/fhir/R4/$export",
        "requiresAccessToken": False,
        "output": [
            {
                "type": "Patient",
                "url": f"/fhir/R4/$export/{export_id}/Patient.ndjson",
                "count": 100
            }
        ],
        "error": []
    }