"""
FHIR Test Data Factory

A comprehensive test data generation module for FHIR resources that creates:
- Controlled, deterministic test datasets
- Complete reference graphs between resources
- Edge cases and boundary conditions
- Coverage for all search parameter types
- Both urn:uuid and Type/id reference formats
"""

import uuid
import random
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
import json


class ReferenceFormat(Enum):
    """Reference format types"""
    STANDARD = "standard"  # Type/id
    URN_UUID = "urn_uuid"  # urn:uuid:id
    URL = "url"           # http://example.com/Type/id


@dataclass
class ResourceReference:
    """Represents a reference between resources"""
    source_type: str
    source_id: str
    target_type: str
    target_id: str
    reference_field: str
    reference_format: ReferenceFormat = ReferenceFormat.STANDARD


@dataclass
class TestDataSet:
    """Container for a complete test dataset"""
    resources: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    references: List[ResourceReference] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_resource(self, resource_type: str, resource: Dict[str, Any]):
        """Add a resource to the dataset"""
        if resource_type not in self.resources:
            self.resources[resource_type] = []
        self.resources[resource_type].append(resource)
    
    def get_resources(self, resource_type: str) -> List[Dict[str, Any]]:
        """Get all resources of a specific type"""
        return self.resources.get(resource_type, [])
    
    def to_bundle(self, bundle_type: str = "transaction") -> Dict[str, Any]:
        """Convert dataset to a FHIR Bundle"""
        entries = []
        for resource_type, resources in self.resources.items():
            for resource in resources:
                entry = {
                    "fullUrl": f"urn:uuid:{resource['id']}",
                    "resource": resource,
                    "request": {
                        "method": "POST",
                        "url": resource_type
                    }
                }
                entries.append(entry)
        
        return {
            "resourceType": "Bundle",
            "type": bundle_type,
            "entry": entries
        }


class FHIRTestDataFactory:
    """
    Factory for generating comprehensive FHIR test data
    """
    
    def __init__(self, seed: Optional[int] = None):
        """Initialize factory with optional seed for reproducibility"""
        if seed:
            random.seed(seed)
        self.resource_counter = {}
        self.name_pool = self._create_name_pool()
        self.code_systems = self._create_code_systems()
    
    def _create_name_pool(self) -> Dict[str, List[str]]:
        """Create pools of names for consistent testing"""
        return {
            "given_male": ["John", "James", "Robert", "Michael", "William", "David", "Richard", "Joseph"],
            "given_female": ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica"],
            "family": ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"],
            "prefixes": ["Dr.", "Mr.", "Mrs.", "Ms.", "Prof."],
            "suffixes": ["Jr.", "Sr.", "III", "MD", "PhD"]
        }
    
    def _create_code_systems(self) -> Dict[str, List[Dict[str, Any]]]:
        """Create common code systems for testing"""
        return {
            "conditions": [
                {"system": "http://snomed.info/sct", "code": "38341003", "display": "Hypertension"},
                {"system": "http://snomed.info/sct", "code": "44054006", "display": "Diabetes mellitus type 2"},
                {"system": "http://snomed.info/sct", "code": "55822004", "display": "Hyperlipidemia"},
                {"system": "http://snomed.info/sct", "code": "49727002", "display": "Cough"},
                {"system": "http://snomed.info/sct", "code": "25064002", "display": "Headache"},
            ],
            "medications": [
                {"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "387458008", "display": "Aspirin 100mg"},
                {"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "310798", "display": "Lisinopril 10mg"},
                {"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "860975", "display": "Metformin 500mg"},
                {"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "617312", "display": "Atorvastatin 20mg"},
            ],
            "observations": [
                {"system": "http://loinc.org", "code": "8480-6", "display": "Systolic blood pressure"},
                {"system": "http://loinc.org", "code": "8462-4", "display": "Diastolic blood pressure"},
                {"system": "http://loinc.org", "code": "8867-4", "display": "Heart rate"},
                {"system": "http://loinc.org", "code": "2339-0", "display": "Glucose"},
                {"system": "http://loinc.org", "code": "2571-8", "display": "Triglycerides"},
            ],
            "procedure_codes": [
                {"system": "http://snomed.info/sct", "code": "73761001", "display": "Colonoscopy"},
                {"system": "http://snomed.info/sct", "code": "104326007", "display": "Mammography"},
                {"system": "http://snomed.info/sct", "code": "71388002", "display": "Procedure"},
            ]
        }
    
    def _generate_id(self, resource_type: str) -> str:
        """Generate a deterministic ID for a resource"""
        if resource_type not in self.resource_counter:
            self.resource_counter[resource_type] = 0
        self.resource_counter[resource_type] += 1
        return f"{resource_type.lower()}-{self.resource_counter[resource_type]:04d}"
    
    def _generate_uuid(self) -> str:
        """Generate a UUID"""
        return str(uuid.uuid4())
    
    def _format_reference(self, target_type: str, target_id: str, 
                         reference_format: ReferenceFormat = ReferenceFormat.STANDARD) -> str:
        """Format a reference based on the specified format"""
        if reference_format == ReferenceFormat.URN_UUID:
            return f"urn:uuid:{target_id}"
        elif reference_format == ReferenceFormat.URL:
            return f"http://example.com/{target_type}/{target_id}"
        else:  # STANDARD
            return f"{target_type}/{target_id}"
    
    def _random_date(self, start_year: int = 1950, end_year: int = 2023) -> str:
        """Generate a random date"""
        start_date = date(start_year, 1, 1)
        end_date = date(end_year, 12, 31)
        random_days = random.randint(0, (end_date - start_date).days)
        return (start_date + timedelta(days=random_days)).isoformat()
    
    def _random_datetime(self, days_ago_max: int = 365) -> str:
        """Generate a random datetime within the specified range"""
        base = datetime.utcnow()
        random_days = random.randint(0, days_ago_max)
        random_seconds = random.randint(0, 86400)
        result = base - timedelta(days=random_days, seconds=random_seconds)
        return result.isoformat() + "Z"
    
    def create_practitioner(self, 
                          given_name: Optional[str] = None,
                          family_name: Optional[str] = None,
                          prefix: Optional[str] = None,
                          identifier_value: Optional[str] = None) -> Dict[str, Any]:
        """Create a Practitioner resource"""
        practitioner_id = self._generate_id("Practitioner")
        
        if not given_name:
            given_name = random.choice(self.name_pool["given_male"] + self.name_pool["given_female"])
        if not family_name:
            family_name = random.choice(self.name_pool["family"])
        if not prefix:
            prefix = random.choice(["Dr.", ""])
        if not identifier_value:
            identifier_value = f"NPI-{practitioner_id}"
        
        return {
            "resourceType": "Practitioner",
            "id": practitioner_id,
            "identifier": [{
                "system": "http://hl7.org/fhir/sid/us-npi",
                "value": identifier_value
            }],
            "name": [{
                "family": family_name,
                "given": [given_name],
                "prefix": [prefix] if prefix else []
            }],
            "active": True
        }
    
    def create_organization(self,
                          name: Optional[str] = None,
                          identifier_value: Optional[str] = None,
                          part_of: Optional[Tuple[str, str, ReferenceFormat]] = None) -> Dict[str, Any]:
        """Create an Organization resource"""
        org_id = self._generate_id("Organization")
        
        if not name:
            name = f"Test Hospital {org_id}"
        if not identifier_value:
            identifier_value = f"ORG-{org_id}"
        
        org = {
            "resourceType": "Organization",
            "id": org_id,
            "identifier": [{
                "system": "http://example.org/organizations",
                "value": identifier_value
            }],
            "name": name,
            "active": True
        }
        
        if part_of:
            target_type, target_id, ref_format = part_of
            org["partOf"] = {
                "reference": self._format_reference(target_type, target_id, ref_format)
            }
        
        return org
    
    def create_patient(self,
                      given_name: Optional[str] = None,
                      family_name: Optional[str] = None,
                      gender: Optional[str] = None,
                      birth_date: Optional[str] = None,
                      general_practitioner: Optional[Tuple[str, str, ReferenceFormat]] = None,
                      managing_organization: Optional[Tuple[str, str, ReferenceFormat]] = None,
                      deceased: bool = False) -> Dict[str, Any]:
        """Create a Patient resource with optional references"""
        patient_id = self._generate_id("Patient")
        
        if not gender:
            gender = random.choice(["male", "female"])
        
        if not given_name:
            name_pool = self.name_pool["given_male"] if gender == "male" else self.name_pool["given_female"]
            given_name = random.choice(name_pool)
        
        if not family_name:
            family_name = random.choice(self.name_pool["family"])
        
        if not birth_date:
            birth_date = self._random_date(1930, 2020)
        
        patient = {
            "resourceType": "Patient",
            "id": patient_id,
            "identifier": [{
                "system": "http://example.org/mrn",
                "value": f"MRN-{patient_id}"
            }],
            "name": [{
                "family": family_name,
                "given": [given_name]
            }],
            "gender": gender,
            "birthDate": birth_date,
            "active": True
        }
        
        if general_practitioner:
            target_type, target_id, ref_format = general_practitioner
            patient["generalPractitioner"] = [{
                "reference": self._format_reference(target_type, target_id, ref_format)
            }]
        
        if managing_organization:
            target_type, target_id, ref_format = managing_organization
            patient["managingOrganization"] = {
                "reference": self._format_reference(target_type, target_id, ref_format)
            }
        
        if deceased:
            patient["deceasedBoolean"] = True
        
        return patient
    
    def create_observation(self,
                         patient_ref: Tuple[str, str, ReferenceFormat],
                         code: Optional[Dict[str, Any]] = None,
                         value: Optional[Any] = None,
                         performer_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                         encounter_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                         effective_datetime: Optional[str] = None,
                         status: str = "final") -> Dict[str, Any]:
        """Create an Observation resource"""
        obs_id = self._generate_id("Observation")
        
        if not code:
            code = random.choice(self.code_systems["observations"])
        
        if not effective_datetime:
            effective_datetime = self._random_datetime(30)
        
        # Generate appropriate value based on observation type
        if not value:
            if code["code"] in ["8480-6", "8462-4"]:  # Blood pressure
                value = {"value": random.randint(80, 180), "unit": "mmHg"}
            elif code["code"] == "8867-4":  # Heart rate
                value = {"value": random.randint(60, 100), "unit": "beats/minute"}
            elif code["code"] == "2339-0":  # Glucose
                value = {"value": random.randint(70, 200), "unit": "mg/dL"}
            else:
                value = {"value": random.randint(50, 150), "unit": "mg/dL"}
        
        patient_type, patient_id, patient_ref_format = patient_ref
        
        observation = {
            "resourceType": "Observation",
            "id": obs_id,
            "status": status,
            "code": {
                "coding": [code]
            },
            "subject": {
                "reference": self._format_reference(patient_type, patient_id, patient_ref_format)
            },
            "effectiveDateTime": effective_datetime,
            "valueQuantity": value
        }
        
        if performer_ref:
            perf_type, perf_id, perf_format = performer_ref
            observation["performer"] = [{
                "reference": self._format_reference(perf_type, perf_id, perf_format)
            }]
        
        if encounter_ref:
            enc_type, enc_id, enc_format = encounter_ref
            observation["encounter"] = {
                "reference": self._format_reference(enc_type, enc_id, enc_format)
            }
        
        return observation
    
    def create_condition(self,
                        patient_ref: Tuple[str, str, ReferenceFormat],
                        code: Optional[Dict[str, Any]] = None,
                        clinical_status: str = "active",
                        verification_status: str = "confirmed",
                        onset_datetime: Optional[str] = None,
                        recorder_ref: Optional[Tuple[str, str, ReferenceFormat]] = None) -> Dict[str, Any]:
        """Create a Condition resource"""
        condition_id = self._generate_id("Condition")
        
        if not code:
            code = random.choice(self.code_systems["conditions"])
        
        if not onset_datetime:
            onset_datetime = self._random_datetime(365)
        
        patient_type, patient_id, patient_ref_format = patient_ref
        
        condition = {
            "resourceType": "Condition",
            "id": condition_id,
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": clinical_status
                }]
            },
            "verificationStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": verification_status
                }]
            },
            "code": {
                "coding": [code]
            },
            "subject": {
                "reference": self._format_reference(patient_type, patient_id, patient_ref_format)
            },
            "onsetDateTime": onset_datetime
        }
        
        if recorder_ref:
            rec_type, rec_id, rec_format = recorder_ref
            condition["recorder"] = {
                "reference": self._format_reference(rec_type, rec_id, rec_format)
            }
        
        return condition
    
    def create_medication(self,
                         code: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a Medication resource"""
        med_id = self._generate_id("Medication")
        
        if not code:
            code = random.choice(self.code_systems["medications"])
        
        return {
            "resourceType": "Medication",
            "id": med_id,
            "code": {
                "coding": [code]
            }
        }
    
    def create_medication_request(self,
                                patient_ref: Tuple[str, str, ReferenceFormat],
                                medication_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                                requester_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                                encounter_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                                authored_on: Optional[str] = None,
                                status: str = "active",
                                intent: str = "order") -> Dict[str, Any]:
        """Create a MedicationRequest resource"""
        med_req_id = self._generate_id("MedicationRequest")
        
        if not authored_on:
            authored_on = self._random_datetime(30)
        
        patient_type, patient_id, patient_ref_format = patient_ref
        
        med_request = {
            "resourceType": "MedicationRequest",
            "id": med_req_id,
            "status": status,
            "intent": intent,
            "subject": {
                "reference": self._format_reference(patient_type, patient_id, patient_ref_format)
            },
            "authoredOn": authored_on
        }
        
        if medication_ref:
            med_type, med_id, med_format = medication_ref
            med_request["medicationReference"] = {
                "reference": self._format_reference(med_type, med_id, med_format)
            }
        else:
            # Use inline medication code
            med_request["medicationCodeableConcept"] = {
                "coding": [random.choice(self.code_systems["medications"])]
            }
        
        if requester_ref:
            req_type, req_id, req_format = requester_ref
            med_request["requester"] = {
                "reference": self._format_reference(req_type, req_id, req_format)
            }
        
        if encounter_ref:
            enc_type, enc_id, enc_format = encounter_ref
            med_request["encounter"] = {
                "reference": self._format_reference(enc_type, enc_id, enc_format)
            }
        
        return med_request
    
    def create_encounter(self,
                        patient_ref: Tuple[str, str, ReferenceFormat],
                        participant_refs: Optional[List[Tuple[str, str, ReferenceFormat]]] = None,
                        service_provider_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                        period_start: Optional[str] = None,
                        period_end: Optional[str] = None,
                        status: str = "finished",
                        class_code: str = "AMB") -> Dict[str, Any]:
        """Create an Encounter resource"""
        encounter_id = self._generate_id("Encounter")
        
        if not period_start:
            period_start = self._random_datetime(90)
        if not period_end:
            # End 1-4 hours after start
            start_dt = datetime.fromisoformat(period_start.replace('Z', '+00:00'))
            end_dt = start_dt + timedelta(hours=random.randint(1, 4))
            period_end = end_dt.isoformat().replace('+00:00', 'Z')
        
        patient_type, patient_id, patient_ref_format = patient_ref
        
        encounter = {
            "resourceType": "Encounter",
            "id": encounter_id,
            "status": status,
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": class_code
            },
            "subject": {
                "reference": self._format_reference(patient_type, patient_id, patient_ref_format)
            },
            "period": {
                "start": period_start,
                "end": period_end
            }
        }
        
        if participant_refs:
            encounter["participant"] = []
            for part_type, part_id, part_format in participant_refs:
                encounter["participant"].append({
                    "individual": {
                        "reference": self._format_reference(part_type, part_id, part_format)
                    }
                })
        
        if service_provider_ref:
            sp_type, sp_id, sp_format = service_provider_ref
            encounter["serviceProvider"] = {
                "reference": self._format_reference(sp_type, sp_id, sp_format)
            }
        
        return encounter
    
    def create_related_person(self,
                            patient_ref: Tuple[str, str, ReferenceFormat],
                            relationship_code: str = "MTH",
                            given_name: Optional[str] = None,
                            family_name: Optional[str] = None,
                            gender: Optional[str] = None) -> Dict[str, Any]:
        """Create a RelatedPerson resource"""
        related_id = self._generate_id("RelatedPerson")
        
        if not given_name:
            given_name = random.choice(self.name_pool["given_female"] if relationship_code == "MTH" else self.name_pool["given_male"])
        if not family_name:
            family_name = random.choice(self.name_pool["family"])
        if not gender:
            gender = "female" if relationship_code == "MTH" else random.choice(["male", "female"])
        
        patient_type, patient_id, patient_ref_format = patient_ref
        
        relationship_display = {
            "MTH": "mother",
            "FTH": "father",
            "SIB": "sibling",
            "CHILD": "child",
            "SPS": "spouse"
        }.get(relationship_code, "family member")
        
        return {
            "resourceType": "RelatedPerson",
            "id": related_id,
            "patient": {
                "reference": self._format_reference(patient_type, patient_id, patient_ref_format)
            },
            "relationship": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                    "code": relationship_code,
                    "display": relationship_display
                }]
            }],
            "name": [{
                "family": family_name,
                "given": [given_name]
            }],
            "gender": gender
        }
    
    def create_diagnostic_report(self,
                               patient_ref: Tuple[str, str, ReferenceFormat],
                               result_refs: Optional[List[Tuple[str, str, ReferenceFormat]]] = None,
                               performer_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                               code: Optional[Dict[str, Any]] = None,
                               status: str = "final",
                               effective_datetime: Optional[str] = None) -> Dict[str, Any]:
        """Create a DiagnosticReport resource"""
        report_id = self._generate_id("DiagnosticReport")
        
        if not code:
            code = {
                "system": "http://loinc.org",
                "code": "58410-2",
                "display": "Complete blood count (hemogram) panel"
            }
        
        if not effective_datetime:
            effective_datetime = self._random_datetime(7)
        
        patient_type, patient_id, patient_ref_format = patient_ref
        
        report = {
            "resourceType": "DiagnosticReport",
            "id": report_id,
            "status": status,
            "code": {
                "coding": [code]
            },
            "subject": {
                "reference": self._format_reference(patient_type, patient_id, patient_ref_format)
            },
            "effectiveDateTime": effective_datetime
        }
        
        if result_refs:
            report["result"] = []
            for res_type, res_id, res_format in result_refs:
                report["result"].append({
                    "reference": self._format_reference(res_type, res_id, res_format)
                })
        
        if performer_ref:
            perf_type, perf_id, perf_format = performer_ref
            report["performer"] = [{
                "reference": self._format_reference(perf_type, perf_id, perf_format)
            }]
        
        return report
    
    def create_procedure(self,
                        patient_ref: Tuple[str, str, ReferenceFormat],
                        code: Optional[Dict[str, Any]] = None,
                        performer_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                        performed_datetime: Optional[str] = None,
                        status: str = "completed") -> Dict[str, Any]:
        """Create a Procedure resource"""
        procedure_id = self._generate_id("Procedure")
        
        if not code:
            code = random.choice(self.code_systems["procedure_codes"])
        
        if not performed_datetime:
            performed_datetime = self._random_datetime(180)
        
        patient_type, patient_id, patient_ref_format = patient_ref
        
        procedure = {
            "resourceType": "Procedure",
            "id": procedure_id,
            "status": status,
            "code": {
                "coding": [code]
            },
            "subject": {
                "reference": self._format_reference(patient_type, patient_id, patient_ref_format)
            },
            "performedDateTime": performed_datetime
        }
        
        if performer_ref:
            perf_type, perf_id, perf_format = performer_ref
            procedure["performer"] = [{
                "actor": {
                    "reference": self._format_reference(perf_type, perf_id, perf_format)
                }
            }]
        
        return procedure
    
    def create_care_plan(self,
                        patient_ref: Tuple[str, str, ReferenceFormat],
                        author_ref: Optional[Tuple[str, str, ReferenceFormat]] = None,
                        title: Optional[str] = None,
                        status: str = "active",
                        intent: str = "plan",
                        period_start: Optional[str] = None) -> Dict[str, Any]:
        """Create a CarePlan resource"""
        care_plan_id = self._generate_id("CarePlan")
        
        if not title:
            title = f"Care Plan for chronic conditions - {care_plan_id}"
        
        if not period_start:
            period_start = self._random_datetime(30)
        
        patient_type, patient_id, patient_ref_format = patient_ref
        
        care_plan = {
            "resourceType": "CarePlan",
            "id": care_plan_id,
            "status": status,
            "intent": intent,
            "title": title,
            "subject": {
                "reference": self._format_reference(patient_type, patient_id, patient_ref_format)
            },
            "period": {
                "start": period_start
            }
        }
        
        if author_ref:
            auth_type, auth_id, auth_format = author_ref
            care_plan["author"] = {
                "reference": self._format_reference(auth_type, auth_id, auth_format)
            }
        
        return care_plan
    
    def generate_simple_dataset(self, 
                              num_patients: int = 10,
                              reference_format: ReferenceFormat = ReferenceFormat.STANDARD) -> TestDataSet:
        """
        Generate a simple dataset with basic relationships
        
        Creates:
        - Practitioners
        - Organizations
        - Patients (with references to practitioners and organizations)
        - Observations for each patient
        - Conditions for each patient
        """
        dataset = TestDataSet()
        
        # Create practitioners
        practitioners = []
        for i in range(3):
            practitioner = self.create_practitioner()
            practitioners.append(practitioner)
            dataset.add_resource("Practitioner", practitioner)
        
        # Create organizations
        organizations = []
        parent_org = self.create_organization(name="Regional Health Network")
        organizations.append(parent_org)
        dataset.add_resource("Organization", parent_org)
        
        for i in range(2):
            child_org = self.create_organization(
                name=f"Community Hospital {i+1}",
                part_of=("Organization", parent_org["id"], reference_format)
            )
            organizations.append(child_org)
            dataset.add_resource("Organization", child_org)
        
        # Create patients with references
        for i in range(num_patients):
            practitioner = random.choice(practitioners)
            organization = random.choice(organizations[1:])  # Skip parent org
            
            patient = self.create_patient(
                general_practitioner=("Practitioner", practitioner["id"], reference_format),
                managing_organization=("Organization", organization["id"], reference_format)
            )
            dataset.add_resource("Patient", patient)
            
            # Create observations for each patient
            for j in range(random.randint(2, 5)):
                observation = self.create_observation(
                    patient_ref=("Patient", patient["id"], reference_format),
                    performer_ref=("Practitioner", practitioner["id"], reference_format)
                )
                dataset.add_resource("Observation", observation)
            
            # Create conditions for each patient
            for j in range(random.randint(1, 3)):
                condition = self.create_condition(
                    patient_ref=("Patient", patient["id"], reference_format),
                    recorder_ref=("Practitioner", practitioner["id"], reference_format)
                )
                dataset.add_resource("Condition", condition)
        
        dataset.metadata["description"] = "Simple dataset with basic patient-practitioner-organization relationships"
        dataset.metadata["reference_format"] = reference_format.value
        dataset.metadata["created_at"] = datetime.utcnow().isoformat() + "Z"
        
        return dataset
    
    def generate_complex_dataset(self,
                               num_families: int = 5,
                               patients_per_family: int = 3) -> TestDataSet:
        """
        Generate a complex dataset with family relationships and mixed reference formats
        
        Creates:
        - Family units with RelatedPerson resources
        - Complete clinical workflows (encounters, observations, procedures, reports)
        - Mixed reference formats (standard, urn:uuid, URL)
        - Medication workflows with references
        - Care plans
        """
        dataset = TestDataSet()
        
        # Create shared resources
        practitioners = []
        for i in range(5):
            practitioner = self.create_practitioner()
            practitioners.append(practitioner)
            dataset.add_resource("Practitioner", practitioner)
        
        # Create organization hierarchy
        health_system = self.create_organization(name="State Health System")
        dataset.add_resource("Organization", health_system)
        
        hospitals = []
        for i in range(3):
            hospital = self.create_organization(
                name=f"General Hospital {i+1}",
                part_of=("Organization", health_system["id"], ReferenceFormat.STANDARD)
            )
            hospitals.append(hospital)
            dataset.add_resource("Organization", hospital)
            
            # Create departments
            for dept in ["Emergency", "Cardiology", "Primary Care"]:
                department = self.create_organization(
                    name=f"{dept} - {hospital['name']}",
                    part_of=("Organization", hospital["id"], ReferenceFormat.URN_UUID)
                )
                dataset.add_resource("Organization", department)
        
        # Create medications
        medications = []
        for i in range(10):
            medication = self.create_medication()
            medications.append(medication)
            dataset.add_resource("Medication", medication)
        
        # Create family units
        for family_idx in range(num_families):
            family_name = self.name_pool["family"][family_idx % len(self.name_pool["family"])]
            family_practitioner = random.choice(practitioners)
            family_hospital = random.choice(hospitals)
            
            # Different reference format for each family
            ref_formats = [ReferenceFormat.STANDARD, ReferenceFormat.URN_UUID, ReferenceFormat.URL]
            family_ref_format = ref_formats[family_idx % len(ref_formats)]
            
            family_members = []
            
            # Create family members
            for member_idx in range(patients_per_family):
                if member_idx == 0:
                    # Parent 1
                    patient = self.create_patient(
                        family_name=family_name,
                        gender="female",
                        birth_date=self._random_date(1960, 1980),
                        general_practitioner=("Practitioner", family_practitioner["id"], family_ref_format),
                        managing_organization=("Organization", family_hospital["id"], family_ref_format)
                    )
                elif member_idx == 1:
                    # Parent 2
                    patient = self.create_patient(
                        family_name=family_name,
                        gender="male",
                        birth_date=self._random_date(1960, 1980),
                        general_practitioner=("Practitioner", family_practitioner["id"], family_ref_format),
                        managing_organization=("Organization", family_hospital["id"], family_ref_format)
                    )
                else:
                    # Child
                    patient = self.create_patient(
                        family_name=family_name,
                        birth_date=self._random_date(2000, 2020),
                        general_practitioner=("Practitioner", family_practitioner["id"], family_ref_format),
                        managing_organization=("Organization", family_hospital["id"], family_ref_format)
                    )
                
                family_members.append(patient)
                dataset.add_resource("Patient", patient)
            
            # Create family relationships
            if len(family_members) >= 3:
                # Mother relationship to child
                mother_rel = self.create_related_person(
                    patient_ref=("Patient", family_members[2]["id"], family_ref_format),
                    relationship_code="MTH",
                    given_name=family_members[0]["name"][0]["given"][0],
                    family_name=family_name,
                    gender="female"
                )
                dataset.add_resource("RelatedPerson", mother_rel)
                
                # Father relationship to child
                father_rel = self.create_related_person(
                    patient_ref=("Patient", family_members[2]["id"], family_ref_format),
                    relationship_code="FTH",
                    given_name=family_members[1]["name"][0]["given"][0],
                    family_name=family_name,
                    gender="male"
                )
                dataset.add_resource("RelatedPerson", father_rel)
            
            # Create clinical data for each family member
            for patient in family_members:
                # Create encounters
                for enc_idx in range(random.randint(1, 3)):
                    encounter = self.create_encounter(
                        patient_ref=("Patient", patient["id"], family_ref_format),
                        participant_refs=[("Practitioner", random.choice(practitioners)["id"], family_ref_format)],
                        service_provider_ref=("Organization", family_hospital["id"], family_ref_format)
                    )
                    dataset.add_resource("Encounter", encounter)
                    
                    # Create observations for encounter
                    observations = []
                    for obs_idx in range(random.randint(3, 6)):
                        observation = self.create_observation(
                            patient_ref=("Patient", patient["id"], family_ref_format),
                            performer_ref=("Practitioner", family_practitioner["id"], family_ref_format),
                            encounter_ref=("Encounter", encounter["id"], family_ref_format)
                        )
                        observations.append(observation)
                        dataset.add_resource("Observation", observation)
                    
                    # Create diagnostic report linking observations
                    if observations and random.random() > 0.5:
                        result_refs = [
                            ("Observation", obs["id"], family_ref_format) 
                            for obs in random.sample(observations, min(3, len(observations)))
                        ]
                        report = self.create_diagnostic_report(
                            patient_ref=("Patient", patient["id"], family_ref_format),
                            result_refs=result_refs,
                            performer_ref=("Practitioner", family_practitioner["id"], family_ref_format)
                        )
                        dataset.add_resource("DiagnosticReport", report)
                
                # Create conditions
                for cond_idx in range(random.randint(0, 2)):
                    condition = self.create_condition(
                        patient_ref=("Patient", patient["id"], family_ref_format),
                        recorder_ref=("Practitioner", family_practitioner["id"], family_ref_format)
                    )
                    dataset.add_resource("Condition", condition)
                
                # Create medication requests
                for med_idx in range(random.randint(0, 3)):
                    # Mix of reference and inline medications
                    if random.random() > 0.3:
                        medication_ref = ("Medication", random.choice(medications)["id"], family_ref_format)
                    else:
                        medication_ref = None
                    
                    med_request = self.create_medication_request(
                        patient_ref=("Patient", patient["id"], family_ref_format),
                        medication_ref=medication_ref,
                        requester_ref=("Practitioner", family_practitioner["id"], family_ref_format)
                    )
                    dataset.add_resource("MedicationRequest", med_request)
                
                # Create procedures
                if random.random() > 0.6:
                    procedure = self.create_procedure(
                        patient_ref=("Patient", patient["id"], family_ref_format),
                        performer_ref=("Practitioner", random.choice(practitioners)["id"], family_ref_format)
                    )
                    dataset.add_resource("Procedure", procedure)
                
                # Create care plan
                if random.random() > 0.7:
                    care_plan = self.create_care_plan(
                        patient_ref=("Patient", patient["id"], family_ref_format),
                        author_ref=("Practitioner", family_practitioner["id"], family_ref_format)
                    )
                    dataset.add_resource("CarePlan", care_plan)
        
        dataset.metadata["description"] = "Complex dataset with family relationships and complete clinical workflows"
        dataset.metadata["num_families"] = num_families
        dataset.metadata["patients_per_family"] = patients_per_family
        dataset.metadata["created_at"] = datetime.utcnow().isoformat() + "Z"
        
        return dataset
    
    def generate_edge_cases_dataset(self) -> TestDataSet:
        """
        Generate a dataset with edge cases and boundary conditions
        
        Creates:
        - Resources with missing optional fields
        - Circular references
        - Deep reference chains
        - Null/empty values
        - Invalid reference formats (for error testing)
        - Resources with maximum field populations
        """
        dataset = TestDataSet()
        
        # Case 1: Minimal resources (only required fields)
        minimal_patient = {
            "resourceType": "Patient",
            "id": self._generate_id("Patient")
        }
        dataset.add_resource("Patient", minimal_patient)
        
        minimal_observation = {
            "resourceType": "Observation",
            "id": self._generate_id("Observation"),
            "status": "final",
            "code": {"text": "Unknown"}
        }
        dataset.add_resource("Observation", minimal_observation)
        
        # Case 2: Circular organization references
        org1_id = self._generate_id("Organization")
        org2_id = self._generate_id("Organization")
        
        org1 = {
            "resourceType": "Organization",
            "id": org1_id,
            "name": "Org A",
            "partOf": {"reference": f"Organization/{org2_id}"}
        }
        
        org2 = {
            "resourceType": "Organization",
            "id": org2_id,
            "name": "Org B",
            "partOf": {"reference": f"Organization/{org1_id}"}
        }
        
        dataset.add_resource("Organization", org1)
        dataset.add_resource("Organization", org2)
        
        # Case 3: Deep reference chain
        practitioners = []
        for i in range(5):
            if i == 0:
                practitioner = self.create_practitioner(family_name="ChainStart")
            else:
                # Each practitioner supervised by the previous
                practitioner = self.create_practitioner(family_name=f"Chain{i}")
                # Add custom extension for supervisor (simulate deep chain)
                practitioner["extension"] = [{
                    "url": "http://example.org/supervisor",
                    "valueReference": {"reference": f"Practitioner/{practitioners[i-1]['id']}"}
                }]
            practitioners.append(practitioner)
            dataset.add_resource("Practitioner", practitioner)
        
        # Case 4: Patient with all possible references populated
        maximal_patient = self.create_patient(
            given_name="Maximal",
            family_name="Patient",
            general_practitioner=("Practitioner", practitioners[0]["id"], ReferenceFormat.STANDARD),
            managing_organization=("Organization", org1_id, ReferenceFormat.URN_UUID)
        )
        
        # Add additional references through extensions
        maximal_patient["extension"] = [
            {
                "url": "http://example.org/primary-care-team",
                "valueReference": {"reference": f"CareTeam/team-{maximal_patient['id']}"}
            },
            {
                "url": "http://example.org/emergency-contact",
                "valueReference": {"reference": f"RelatedPerson/emergency-{maximal_patient['id']}"}
            }
        ]
        
        # Add multiple identifiers
        maximal_patient["identifier"].extend([
            {"system": "http://example.org/ssn", "value": "123-45-6789"},
            {"system": "http://example.org/drivers-license", "value": "DL123456"},
            {"system": "http://example.org/insurance", "value": "INS-98765"}
        ])
        
        # Add multiple names
        maximal_patient["name"].extend([
            {"use": "nickname", "given": ["Max"]},
            {"use": "old", "family": "Previous", "given": ["Maximal"]}
        ])
        
        dataset.add_resource("Patient", maximal_patient)
        
        # Case 5: Invalid/unusual reference formats (for error testing)
        error_patient = self.create_patient(given_name="Error", family_name="Case")
        dataset.add_resource("Patient", error_patient)
        
        # Observation with malformed reference
        error_observation = {
            "resourceType": "Observation",
            "id": self._generate_id("Observation"),
            "status": "final",
            "code": {"coding": [{"system": "http://loinc.org", "code": "1234-5"}]},
            "subject": {
                "reference": "Patient/"  # Missing ID
            }
        }
        dataset.add_resource("Observation", error_observation)
        
        # Observation with non-existent reference
        ghost_observation = {
            "resourceType": "Observation",
            "id": self._generate_id("Observation"),
            "status": "final",
            "code": {"coding": [{"system": "http://loinc.org", "code": "5678-9"}]},
            "subject": {
                "reference": "Patient/non-existent-patient-12345"
            }
        }
        dataset.add_resource("Observation", ghost_observation)
        
        # Case 6: Resources with empty arrays and null values
        empty_arrays_patient = {
            "resourceType": "Patient",
            "id": self._generate_id("Patient"),
            "name": [],  # Empty array
            "identifier": [],  # Empty array
            "telecom": [],  # Empty array
            "address": [],  # Empty array
            "gender": "unknown"
        }
        dataset.add_resource("Patient", empty_arrays_patient)
        
        # Case 7: Very long reference chains (A -> B -> C -> D)
        org_chain = []
        for i in range(10):
            org = self.create_organization(
                name=f"Chain Organization {i}",
                part_of=("Organization", org_chain[-1]["id"], ReferenceFormat.STANDARD) if org_chain else None
            )
            org_chain.append(org)
            dataset.add_resource("Organization", org)
        
        # Case 8: Patient with future dates
        future_patient = self.create_patient(
            given_name="Future",
            family_name="Born",
            birth_date="2025-12-31"
        )
        dataset.add_resource("Patient", future_patient)
        
        # Case 9: Observation with extreme values
        extreme_observation = self.create_observation(
            patient_ref=("Patient", maximal_patient["id"], ReferenceFormat.STANDARD),
            value={"value": 999999.99, "unit": "mg/dL"}
        )
        extreme_observation["valueQuantity"]["comparator"] = ">"
        dataset.add_resource("Observation", extreme_observation)
        
        # Case 10: MedicationRequest with both reference and inline medication (invalid)
        invalid_med_request = {
            "resourceType": "MedicationRequest",
            "id": self._generate_id("MedicationRequest"),
            "status": "active",
            "intent": "order",
            "subject": {"reference": f"Patient/{error_patient['id']}"},
            "medicationReference": {"reference": "Medication/med-123"},
            "medicationCodeableConcept": {
                "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "123456"}]
            }
        }
        dataset.add_resource("MedicationRequest", invalid_med_request)
        
        dataset.metadata["description"] = "Edge cases dataset with boundary conditions and error scenarios"
        dataset.metadata["created_at"] = datetime.utcnow().isoformat() + "Z"
        dataset.metadata["test_cases"] = [
            "minimal_resources",
            "circular_references",
            "deep_reference_chains",
            "maximal_field_population",
            "invalid_references",
            "empty_arrays",
            "long_chains",
            "future_dates",
            "extreme_values",
            "conflicting_data"
        ]
        
        return dataset
    
    def generate_search_parameter_dataset(self) -> TestDataSet:
        """
        Generate a dataset optimized for testing all search parameter types
        
        Creates resources with specific values for testing:
        - String searches (exact, contains, text)
        - Token searches (system|code variations)
        - Date searches (ranges, periods, comparisons)
        - Number/Quantity searches
        - Reference searches (chained, _include, _revinclude)
        - Composite searches
        """
        dataset = TestDataSet()
        
        # Create practitioners with specific names for string searching
        practitioner_names = [
            ("Smith", "John", "Dr."),
            ("Smith", "Jane", "Dr."),
            ("Smithson", "Robert", "Dr."),
            ("Johnson", "Emily", "Dr."),
            ("Jones-Smith", "Mary", "Dr."),
            ("O'Brien", "Patrick", "Dr."),  # Special character
            ("van der Berg", "Johan", "Dr."),  # Multi-part name
            ("李", "明", "Dr.")  # Non-ASCII characters
        ]
        
        practitioners = []
        for family, given, prefix in practitioner_names:
            practitioner = self.create_practitioner(
                family_name=family,
                given_name=given,
                prefix=prefix,
                identifier_value=f"NPI-{family.upper()}-{given.upper()}"
            )
            practitioners.append(practitioner)
            dataset.add_resource("Practitioner", practitioner)
        
        # Create organizations with hierarchy for chained searches
        health_systems = []
        for i, name in enumerate(["Northern Health", "Southern Health", "Eastern Health"]):
            system = self.create_organization(name=name, identifier_value=f"SYS-{i:03d}")
            health_systems.append(system)
            dataset.add_resource("Organization", system)
        
        hospitals = []
        hospital_names = [
            "General Hospital",
            "Children's Hospital",
            "University Medical Center",
            "Community Hospital",
            "Regional Medical Center"
        ]
        
        for i, hospital_name in enumerate(hospital_names):
            system = health_systems[i % len(health_systems)]
            hospital = self.create_organization(
                name=f"{hospital_name} - {system['name']}",
                identifier_value=f"HOSP-{i:03d}",
                part_of=("Organization", system["id"], ReferenceFormat.STANDARD)
            )
            hospitals.append(hospital)
            dataset.add_resource("Organization", hospital)
        
        # Create patients with specific attributes for searching
        patient_data = [
            # (given, family, gender, birth_year, practitioner_idx, hospital_idx)
            ("John", "Doe", "male", 1980, 0, 0),
            ("Jane", "Doe", "female", 1985, 0, 0),
            ("Robert", "Smith", "male", 1970, 1, 1),
            ("Mary", "Smith", "female", 1975, 1, 1),
            ("James", "Johnson", "male", 1990, 3, 2),
            ("Patricia", "Johnson", "female", 1992, 3, 2),
            ("Michael", "Williams", "male", 2000, 0, 3),
            ("Linda", "Williams", "female", 2002, 0, 3),
            ("David", "Brown", "male", 1965, 2, 4),
            ("Barbara", "Brown", "female", 1968, 2, 4)
        ]
        
        patients = []
        for given, family, gender, birth_year, pract_idx, hosp_idx in patient_data:
            patient = self.create_patient(
                given_name=given,
                family_name=family,
                gender=gender,
                birth_date=f"{birth_year}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                general_practitioner=("Practitioner", practitioners[pract_idx]["id"], ReferenceFormat.STANDARD),
                managing_organization=("Organization", hospitals[hosp_idx]["id"], ReferenceFormat.STANDARD)
            )
            
            # Add various identifiers for token searching
            patient["identifier"].extend([
                {"system": "http://example.org/insurance", "value": f"INS-{birth_year}-{given[0]}{family[0]}"},
                {"system": "http://example.org/employee", "value": f"EMP-{random.randint(1000, 9999)}"}
            ])
            
            patients.append(patient)
            dataset.add_resource("Patient", patient)
        
        # Create observations with specific dates and values for range searching
        observation_types = [
            ("8480-6", "Systolic blood pressure", 110, 140, "mmHg"),
            ("8462-4", "Diastolic blood pressure", 70, 90, "mmHg"),
            ("8867-4", "Heart rate", 60, 100, "beats/minute"),
            ("2339-0", "Glucose", 70, 110, "mg/dL"),
            ("2571-8", "Triglycerides", 50, 150, "mg/dL"),
            ("2085-9", "HDL Cholesterol", 40, 60, "mg/dL"),
            ("2089-1", "LDL Cholesterol", 70, 130, "mg/dL")
        ]
        
        # Create observations with specific date patterns
        base_date = datetime(2024, 1, 1)
        for patient_idx, patient in enumerate(patients):
            practitioner = practitioners[patient_idx % len(practitioners)]
            
            # Create observations at regular intervals
            for month in range(12):
                obs_date = base_date + timedelta(days=month * 30)
                
                for code, display, min_val, max_val, unit in observation_types:
                    # Create values that form patterns
                    if month < 6:
                        # First half of year: normal values
                        value = random.randint(min_val, max_val)
                    else:
                        # Second half: some elevated values
                        if patient_idx % 3 == 0:  # Every third patient has elevated values
                            value = random.randint(max_val, int(max_val * 1.3))
                        else:
                            value = random.randint(min_val, max_val)
                    
                    observation = {
                        "resourceType": "Observation",
                        "id": self._generate_id("Observation"),
                        "status": "final",
                        "code": {
                            "coding": [{
                                "system": "http://loinc.org",
                                "code": code,
                                "display": display
                            }]
                        },
                        "subject": {
                            "reference": f"Patient/{patient['id']}"
                        },
                        "performer": [{
                            "reference": f"Practitioner/{practitioner['id']}"
                        }],
                        "effectiveDateTime": obs_date.isoformat() + "Z",
                        "valueQuantity": {
                            "value": value,
                            "unit": unit,
                            "system": "http://unitsofmeasure.org",
                            "code": unit
                        }
                    }
                    
                    # Add category for some observations
                    if code in ["8480-6", "8462-4", "8867-4"]:
                        observation["category"] = [{
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "vital-signs",
                                "display": "Vital Signs"
                            }]
                        }]
                    elif code in ["2339-0", "2571-8", "2085-9", "2089-1"]:
                        observation["category"] = [{
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "laboratory",
                                "display": "Laboratory"
                            }]
                        }]
                    
                    dataset.add_resource("Observation", observation)
        
        # Create conditions with specific onset dates
        condition_patterns = [
            ("38341003", "Hypertension", -365),  # Started 1 year ago
            ("44054006", "Diabetes mellitus type 2", -730),  # Started 2 years ago
            ("55822004", "Hyperlipidemia", -180),  # Started 6 months ago
            ("13645005", "Chronic obstructive pulmonary disease", -1095),  # Started 3 years ago
        ]
        
        for patient_idx, patient in enumerate(patients):
            # Give some patients specific conditions for testing
            if patient_idx % 2 == 0:  # Even-indexed patients get conditions
                for code, display, days_ago in condition_patterns[:2]:  # First 2 conditions
                    onset_date = datetime.utcnow() + timedelta(days=days_ago)
                    condition = {
                        "resourceType": "Condition",
                        "id": self._generate_id("Condition"),
                        "clinicalStatus": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                                "code": "active"
                            }]
                        },
                        "verificationStatus": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                                "code": "confirmed"
                            }]
                        },
                        "code": {
                            "coding": [{
                                "system": "http://snomed.info/sct",
                                "code": code,
                                "display": display
                            }]
                        },
                        "subject": {
                            "reference": f"Patient/{patient['id']}"
                        },
                        "onsetDateTime": onset_date.isoformat() + "Z",
                        "recordedDate": onset_date.isoformat() + "Z"
                    }
                    dataset.add_resource("Condition", condition)
        
        # Create encounters with specific dates and types
        encounter_types = [
            ("AMB", "ambulatory", 1),  # 1 hour
            ("EMER", "emergency", 4),  # 4 hours
            ("IMP", "inpatient", 72),  # 3 days
            ("OBSENC", "observation encounter", 24)  # 1 day
        ]
        
        for patient in patients[:5]:  # First 5 patients get encounters
            for i, (class_code, class_display, duration_hours) in enumerate(encounter_types):
                start_date = datetime.utcnow() - timedelta(days=30 * (i + 1))
                end_date = start_date + timedelta(hours=duration_hours)
                
                encounter = {
                    "resourceType": "Encounter",
                    "id": self._generate_id("Encounter"),
                    "status": "finished",
                    "class": {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": class_code,
                        "display": class_display
                    },
                    "type": [{
                        "coding": [{
                            "system": "http://snomed.info/sct",
                            "code": "308335008",
                            "display": "Patient encounter procedure"
                        }]
                    }],
                    "subject": {
                        "reference": f"Patient/{patient['id']}"
                    },
                    "participant": [{
                        "individual": {
                            "reference": f"Practitioner/{random.choice(practitioners)['id']}"
                        }
                    }],
                    "period": {
                        "start": start_date.isoformat() + "Z",
                        "end": end_date.isoformat() + "Z"
                    }
                }
                dataset.add_resource("Encounter", encounter)
        
        # Create medication requests with specific statuses and dates
        medication_statuses = ["active", "completed", "stopped", "on-hold"]
        
        for patient_idx, patient in enumerate(patients):
            for med_idx, medication in enumerate(self.code_systems["medications"][:3]):
                status = medication_statuses[med_idx % len(medication_statuses)]
                authored_date = datetime.utcnow() - timedelta(days=random.randint(1, 180))
                
                med_request = {
                    "resourceType": "MedicationRequest",
                    "id": self._generate_id("MedicationRequest"),
                    "status": status,
                    "intent": "order",
                    "medicationCodeableConcept": {
                        "coding": [medication]
                    },
                    "subject": {
                        "reference": f"Patient/{patient['id']}"
                    },
                    "requester": {
                        "reference": f"Practitioner/{practitioners[patient_idx % len(practitioners)]['id']}"
                    },
                    "authoredOn": authored_date.isoformat() + "Z"
                }
                
                # Add dosage instructions for active medications
                if status == "active":
                    med_request["dosageInstruction"] = [{
                        "text": "Take 1 tablet daily",
                        "timing": {
                            "repeat": {
                                "frequency": 1,
                                "period": 1,
                                "periodUnit": "d"
                            }
                        }
                    }]
                
                dataset.add_resource("MedicationRequest", med_request)
        
        dataset.metadata["description"] = "Search parameter testing dataset with comprehensive coverage"
        dataset.metadata["created_at"] = datetime.utcnow().isoformat() + "Z"
        dataset.metadata["search_test_coverage"] = {
            "string": "Practitioner names with exact/contains variations",
            "token": "Patient identifiers, Observation codes with categories",
            "date": "Observations with monthly patterns, Conditions with onset dates",
            "number": "Observation values with normal/elevated patterns",
            "reference": "Complete patient-practitioner-organization chains",
            "composite": "Observation code+value combinations"
        }
        
        return dataset


def main():
    """Example usage of the FHIR Test Data Factory"""
    factory = FHIRTestDataFactory(seed=42)  # Use seed for reproducibility
    
    # Generate different datasets
    print("Generating simple dataset...")
    simple_data = factory.generate_simple_dataset(num_patients=5)
    print(f"Created {sum(len(resources) for resources in simple_data.resources.values())} resources")
    
    print("\nGenerating complex dataset...")
    complex_data = factory.generate_complex_dataset(num_families=3)
    print(f"Created {sum(len(resources) for resources in complex_data.resources.values())} resources")
    
    print("\nGenerating edge cases dataset...")
    edge_data = factory.generate_edge_cases_dataset()
    print(f"Created {sum(len(resources) for resources in edge_data.resources.values())} resources")
    
    print("\nGenerating search parameter dataset...")
    search_data = factory.generate_search_parameter_dataset()
    print(f"Created {sum(len(resources) for resources in search_data.resources.values())} resources")
    
    # Save to files
    import os
    output_dir = "test_data"
    os.makedirs(output_dir, exist_ok=True)
    
    datasets = [
        ("simple", simple_data),
        ("complex", complex_data),
        ("edge_cases", edge_data),
        ("search_params", search_data)
    ]
    
    for name, dataset in datasets:
        # Save as bundle
        bundle = dataset.to_bundle()
        with open(f"{output_dir}/{name}_bundle.json", "w") as f:
            json.dump(bundle, f, indent=2)
        
        # Save as individual resources
        for resource_type, resources in dataset.resources.items():
            with open(f"{output_dir}/{name}_{resource_type}.json", "w") as f:
                json.dump(resources, f, indent=2)
        
        print(f"\nSaved {name} dataset to {output_dir}/")


if __name__ == "__main__":
    main()