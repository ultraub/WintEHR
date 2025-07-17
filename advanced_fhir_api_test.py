#!/usr/bin/env python3
"""
Advanced FHIR API Test Script
Tests advanced features like chained searches, _has, composite parameters, and complex scenarios
"""

import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import aiohttp
from urllib.parse import quote, urlencode

# Configuration
BASE_URL = "http://localhost:8000/fhir/R4"
TIMEOUT = aiohttp.ClientTimeout(total=30)


class TestStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    ERROR = "ERROR"
    NOT_IMPLEMENTED = "NOT_IMPL"


@dataclass
class TestResult:
    """Individual test result"""
    test_name: str
    feature: str
    query: str
    status: TestStatus
    message: str = ""
    response_time: float = 0.0
    expected: Any = None
    actual: Any = None
    http_status: int = 0
    

@dataclass
class TestSuite:
    """Collection of test results"""
    name: str
    results: List[TestResult] = field(default_factory=list)
    
    @property
    def passed(self) -> int:
        return len([r for r in self.results if r.status == TestStatus.PASS])
    
    @property
    def failed(self) -> int:
        return len([r for r in self.results if r.status == TestStatus.FAIL])
    
    @property
    def not_implemented(self) -> int:
        return len([r for r in self.results if r.status == TestStatus.NOT_IMPLEMENTED])
    
    @property
    def total(self) -> int:
        return len(self.results)


class AdvancedFHIRTestClient:
    """HTTP client for advanced FHIR API testing"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.created_resources: List[Tuple[str, str]] = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=TIMEOUT)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Cleanup in reverse order
        for resource_type, resource_id in reversed(self.created_resources):
            try:
                await self.delete(f"{resource_type}/{resource_id}")
            except:
                pass
        
        if self.session:
            await self.session.close()
    
    async def create(self, resource_type: str, resource_data: dict) -> dict:
        """Create a FHIR resource"""
        url = f"{self.base_url}/{resource_type}"
        start_time = datetime.now()
        
        try:
            async with self.session.post(url, json=resource_data) as response:
                response_time = (datetime.now() - start_time).total_seconds()
                result = await response.json()
                
                if response.status == 201 and 'id' in result:
                    self.created_resources.append((resource_type, result['id']))
                
                return {
                    'status': response.status,
                    'data': result,
                    'response_time': response_time
                }
        except Exception as e:
            return {
                'status': 500,
                'data': {'error': str(e)},
                'response_time': (datetime.now() - start_time).total_seconds()
            }
    
    async def search(self, resource_type: str, params: dict) -> dict:
        """Search for FHIR resources"""
        url = f"{self.base_url}/{resource_type}"
        start_time = datetime.now()
        
        try:
            async with self.session.get(url, params=params) as response:
                response_time = (datetime.now() - start_time).total_seconds()
                
                # Handle different response types
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' in content_type or 'application/fhir+json' in content_type:
                    result = await response.json()
                else:
                    result = {'error': 'Non-JSON response', 'text': await response.text()}
                
                return {
                    'status': response.status,
                    'data': result,
                    'response_time': response_time,
                    'url': str(response.url)
                }
        except Exception as e:
            return {
                'status': 500,
                'data': {'error': str(e)},
                'response_time': (datetime.now() - start_time).total_seconds()
            }
    
    async def delete(self, path: str) -> dict:
        """Delete a FHIR resource"""
        url = f"{self.base_url}/{path}"
        
        try:
            async with self.session.delete(url) as response:
                return {'status': response.status}
        except:
            return {'status': 500}
    
    async def bundle(self, bundle_data: dict) -> dict:
        """Execute a bundle operation"""
        url = self.base_url
        start_time = datetime.now()
        
        try:
            async with self.session.post(url, json=bundle_data) as response:
                response_time = (datetime.now() - start_time).total_seconds()
                
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' in content_type or 'application/fhir+json' in content_type:
                    result = await response.json()
                else:
                    result = {'error': 'Non-JSON response', 'text': await response.text()}
                
                return {
                    'status': response.status,
                    'data': result,
                    'response_time': response_time
                }
        except Exception as e:
            return {
                'status': 500,
                'data': {'error': str(e)},
                'response_time': (datetime.now() - start_time).total_seconds()
            }


class AdvancedFHIRTest:
    """Test runner for advanced FHIR features"""
    
    def __init__(self):
        self.client: Optional[AdvancedFHIRTestClient] = None
        self.test_data: Dict[str, Any] = {}
        self.suites: List[TestSuite] = []
        
    async def setup_comprehensive_test_data(self):
        """Create comprehensive test data for advanced testing"""
        print("Setting up comprehensive test data...")
        
        # Create Organizations
        orgs = []
        org_data = [
            {
                "resourceType": "Organization",
                "identifier": [{"system": "http://example.org/org", "value": "ORG001"}],
                "name": "General Hospital",
                "type": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/organization-type",
                        "code": "prov"
                    }]
                }]
            },
            {
                "resourceType": "Organization",
                "identifier": [{"system": "http://example.org/org", "value": "ORG002"}],
                "name": "City Medical Center"
            }
        ]
        
        for org in org_data:
            result = await self.client.create("Organization", org)
            if result['status'] == 201:
                orgs.append(result['data'])
        self.test_data['organizations'] = orgs
        
        # Create Practitioners with Organization links
        practitioners = []
        if orgs:
            pract_data = [
                {
                    "resourceType": "Practitioner",
                    "identifier": [{"system": "http://example.org/npi", "value": "1234567890"}],
                    "name": [{"family": "Smith", "given": ["John"], "prefix": ["Dr."]}],
                    "qualification": [{
                        "code": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/v2-0360",
                                "code": "MD"
                            }]
                        }
                    }]
                },
                {
                    "resourceType": "Practitioner",
                    "identifier": [{"system": "http://example.org/npi", "value": "0987654321"}],
                    "name": [{"family": "Johnson", "given": ["Sarah"], "prefix": ["Dr."]}]
                }
            ]
            
            for pract in pract_data:
                result = await self.client.create("Practitioner", pract)
                if result['status'] == 201:
                    practitioners.append(result['data'])
                    
            # Create PractitionerRoles linking practitioners to organizations
            if practitioners:
                for i, pract in enumerate(practitioners[:len(orgs)]):
                    role_data = {
                        "resourceType": "PractitionerRole",
                        "practitioner": {"reference": f"Practitioner/{pract['id']}"},
                        "organization": {"reference": f"Organization/{orgs[i]['id']}"},
                        "code": [{
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/practitioner-role",
                                "code": "doctor"
                            }]
                        }]
                    }
                    await self.client.create("PractitionerRole", role_data)
        
        self.test_data['practitioners'] = practitioners
        
        # Create Patients with references to practitioners
        patients = []
        patient_data = [
            {
                "resourceType": "Patient",
                "identifier": [
                    {"system": "http://example.org/mrn", "value": "PT001"},
                    {"system": "http://hl7.org/fhir/sid/us-ssn", "value": "111-11-1111"}
                ],
                "name": [{"family": "TestPatient", "given": ["Alice"]}],
                "gender": "female",
                "birthDate": "1980-01-01",
                "generalPractitioner": [{"reference": f"Practitioner/{practitioners[0]['id']}"} if practitioners else None]
            },
            {
                "resourceType": "Patient",
                "identifier": [{"system": "http://example.org/mrn", "value": "PT002"}],
                "name": [{"family": "TestPatient", "given": ["Bob"]}],
                "gender": "male",
                "birthDate": "1975-05-15",
                "generalPractitioner": [{"reference": f"Practitioner/{practitioners[1]['id']}"} if len(practitioners) > 1 else None]
            },
            {
                "resourceType": "Patient",
                "identifier": [{"system": "http://example.org/mrn", "value": "PT003"}],
                "name": [{"family": "NoDoctor", "given": ["Charlie"]}],
                "gender": "other",
                "birthDate": "1990-12-25"
            }
        ]
        
        # Remove None references
        for pd in patient_data:
            if pd.get('generalPractitioner') and pd['generalPractitioner'][0] is None:
                del pd['generalPractitioner']
        
        for pd in patient_data:
            result = await self.client.create("Patient", pd)
            if result['status'] == 201:
                patients.append(result['data'])
        
        self.test_data['patients'] = patients
        
        # Create Medications
        medications = []
        med_data = [
            {
                "resourceType": "Medication",
                "code": {
                    "coding": [{
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "387458008",
                        "display": "Aspirin"
                    }]
                },
                "form": {
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "385055001",
                        "display": "Tablet"
                    }]
                }
            },
            {
                "resourceType": "Medication",
                "code": {
                    "coding": [{
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "310798",
                        "display": "Amoxicillin"
                    }]
                }
            }
        ]
        
        for med in med_data:
            result = await self.client.create("Medication", med)
            if result['status'] == 201:
                medications.append(result['data'])
        
        self.test_data['medications'] = medications
        
        # Create Encounters
        encounters = []
        if patients and practitioners:
            enc_data = [
                {
                    "resourceType": "Encounter",
                    "status": "finished",
                    "class": {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": "AMB"
                    },
                    "type": [{
                        "coding": [{
                            "system": "http://snomed.info/sct",
                            "code": "308335008",
                            "display": "Patient encounter procedure"
                        }]
                    }],
                    "subject": {"reference": f"Patient/{patients[0]['id']}"},
                    "participant": [{
                        "individual": {"reference": f"Practitioner/{practitioners[0]['id']}"}
                    }],
                    "period": {
                        "start": "2023-01-15T10:00:00Z",
                        "end": "2023-01-15T10:30:00Z"
                    }
                },
                {
                    "resourceType": "Encounter",
                    "status": "in-progress",
                    "class": {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": "IMP"
                    },
                    "subject": {"reference": f"Patient/{patients[1]['id']}"},
                    "participant": [{
                        "individual": {"reference": f"Practitioner/{practitioners[1]['id']}"} if len(practitioners) > 1 else {"reference": f"Practitioner/{practitioners[0]['id']}"}
                    }],
                    "period": {
                        "start": "2023-06-01T08:00:00Z"
                    }
                }
            ]
            
            for enc in enc_data:
                result = await self.client.create("Encounter", enc)
                if result['status'] == 201:
                    encounters.append(result['data'])
        
        self.test_data['encounters'] = encounters
        
        # Create MedicationRequests with references
        if patients and medications and practitioners and encounters:
            med_requests = []
            med_req_data = [
                {
                    "resourceType": "MedicationRequest",
                    "status": "active",
                    "intent": "order",
                    "medicationReference": {"reference": f"Medication/{medications[0]['id']}"},
                    "subject": {"reference": f"Patient/{patients[0]['id']}"},
                    "encounter": {"reference": f"Encounter/{encounters[0]['id']}"},
                    "requester": {"reference": f"Practitioner/{practitioners[0]['id']}"},
                    "dosageInstruction": [{
                        "text": "Take 1 tablet daily",
                        "timing": {
                            "repeat": {
                                "frequency": 1,
                                "period": 1,
                                "periodUnit": "d"
                            }
                        }
                    }]
                },
                {
                    "resourceType": "MedicationRequest",
                    "status": "completed",
                    "intent": "order",
                    "medicationCodeableConcept": {
                        "coding": [{
                            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                            "code": "310798",
                            "display": "Amoxicillin"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patients[1]['id']}"},
                    "requester": {"reference": f"Practitioner/{practitioners[1]['id']}"} if len(practitioners) > 1 else {"reference": f"Practitioner/{practitioners[0]['id']}"}
                }
            ]
            
            for med_req in med_req_data:
                result = await self.client.create("MedicationRequest", med_req)
                if result['status'] == 201:
                    med_requests.append(result['data'])
            
            self.test_data['medication_requests'] = med_requests
        
        # Create Observations with various references
        if patients and encounters and practitioners:
            observations = []
            obs_data = [
                {
                    "resourceType": "Observation",
                    "status": "final",
                    "code": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": "8867-4",
                            "display": "Heart rate"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patients[0]['id']}"},
                    "encounter": {"reference": f"Encounter/{encounters[0]['id']}"},
                    "performer": [{"reference": f"Practitioner/{practitioners[0]['id']}"}],
                    "effectiveDateTime": "2023-01-15T10:15:00Z",
                    "valueQuantity": {
                        "value": 72,
                        "unit": "beats/minute",
                        "system": "http://unitsofmeasure.org",
                        "code": "/min"
                    }
                },
                {
                    "resourceType": "Observation",
                    "status": "final",
                    "code": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": "8302-2",
                            "display": "Body height"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patients[0]['id']}"},
                    "effectiveDateTime": "2023-01-15T10:10:00Z",
                    "valueQuantity": {
                        "value": 170,
                        "unit": "cm",
                        "system": "http://unitsofmeasure.org",
                        "code": "cm"
                    }
                },
                {
                    "resourceType": "Observation",
                    "status": "preliminary",
                    "code": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": "2339-0",
                            "display": "Glucose"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patients[1]['id']}"},
                    "effectiveDateTime": "2023-06-01T08:30:00Z",
                    "valueQuantity": {
                        "value": 110,
                        "unit": "mg/dL",
                        "system": "http://unitsofmeasure.org",
                        "code": "mg/dL"
                    }
                }
            ]
            
            for obs in obs_data:
                result = await self.client.create("Observation", obs)
                if result['status'] == 201:
                    observations.append(result['data'])
            
            self.test_data['observations'] = observations
        
        # Create Conditions
        if patients:
            conditions = []
            cond_data = [
                {
                    "resourceType": "Condition",
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
                            "code": "38341003",
                            "display": "Hypertension"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patients[0]['id']}"},
                    "onsetDateTime": "2020-01-01"
                }
            ]
            
            for cond in cond_data:
                result = await self.client.create("Condition", cond)
                if result['status'] == 201:
                    conditions.append(result['data'])
            
            self.test_data['conditions'] = conditions
        
        print(f"Test data setup complete:")
        print(f"  - {len(self.test_data.get('organizations', []))} organizations")
        print(f"  - {len(self.test_data.get('practitioners', []))} practitioners")
        print(f"  - {len(self.test_data.get('patients', []))} patients")
        print(f"  - {len(self.test_data.get('medications', []))} medications")
        print(f"  - {len(self.test_data.get('encounters', []))} encounters")
        print(f"  - {len(self.test_data.get('medication_requests', []))} medication requests")
        print(f"  - {len(self.test_data.get('observations', []))} observations")
        print(f"  - {len(self.test_data.get('conditions', []))} conditions")
    
    async def test_chained_searches(self):
        """Test chained search parameters"""
        suite = TestSuite("Chained Searches")
        
        if not self.test_data.get('patients') or not self.test_data.get('practitioners'):
            suite.results.append(TestResult(
                test_name="Chained searches",
                feature="chaining",
                query="N/A",
                status=TestStatus.SKIP,
                message="Insufficient test data"
            ))
            return suite
        
        # Test forward chaining
        chained_tests = [
            # Find patients whose general practitioner has name Smith
            ("Patient?general-practitioner.name=Smith", 
             {"general-practitioner.name": "Smith"},
             "Forward chain: Patient by practitioner name"),
            
            # Find patients whose general practitioner has specific identifier
            ("Patient?general-practitioner.identifier=1234567890",
             {"general-practitioner.identifier": "1234567890"},
             "Forward chain: Patient by practitioner identifier"),
            
            # Find observations where patient has specific name
            ("Observation?patient.name=TestPatient",
             {"patient.name": "TestPatient"},
             "Forward chain: Observation by patient name"),
            
            # Find observations where patient was born before 1985
            ("Observation?patient.birthdate=lt1985-01-01",
             {"patient.birthdate": "lt1985-01-01"},
             "Forward chain: Observation by patient birthdate"),
            
            # Find medication requests where medication has specific code
            ("MedicationRequest?medication.code=387458008",
             {"medication.code": "387458008"},
             "Forward chain: MedicationRequest by medication code"),
            
            # Double chaining - find observations where patient's practitioner has name Smith
            ("Observation?patient.general-practitioner.name=Smith",
             {"patient.general-practitioner.name": "Smith"},
             "Double chain: Observation by patient's practitioner name"),
        ]
        
        for query, params, description in chained_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            
            # Determine status based on response
            if result['status'] == 200:
                status = TestStatus.PASS
            elif result['status'] == 400 and 'not supported' in str(result['data']).lower():
                status = TestStatus.NOT_IMPLEMENTED
            else:
                status = TestStatus.FAIL
            
            test_result = TestResult(
                test_name=description,
                feature="forward chaining",
                query=query,
                status=status,
                response_time=result['response_time'],
                http_status=result['status'],
                message=f"HTTP {result['status']}"
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_reverse_chaining(self):
        """Test _has reverse chaining"""
        suite = TestSuite("Reverse Chaining (_has)")
        
        if not self.test_data.get('patients'):
            suite.results.append(TestResult(
                test_name="Reverse chaining",
                feature="_has",
                query="N/A",
                status=TestStatus.SKIP,
                message="Insufficient test data"
            ))
            return suite
        
        # Test _has parameter
        has_tests = [
            # Find patients who have observations with specific code
            ("Patient?_has:Observation:patient:code=8867-4",
             {"_has:Observation:patient:code": "8867-4"},
             "_has: Patients with heart rate observations"),
            
            # Find patients who have conditions
            ("Patient?_has:Condition:patient:code=38341003",
             {"_has:Condition:patient:code": "38341003"},
             "_has: Patients with hypertension"),
            
            # Find practitioners who have encounters in 2023
            ("Practitioner?_has:Encounter:participant:date=ge2023-01-01",
             {"_has:Encounter:participant:date": "ge2023-01-01"},
             "_has: Practitioners with 2023 encounters"),
            
            # Find organizations that have practitioners
            ("Organization?_has:PractitionerRole:organization:active=true",
             {"_has:PractitionerRole:organization:active": "true"},
             "_has: Organizations with active practitioner roles"),
            
            # Complex _has with multiple criteria
            ("Patient?_has:Observation:patient:code=2339-0&_has:Observation:patient:value-quantity=gt100",
             {"_has:Observation:patient:code": "2339-0", "_has:Observation:patient:value-quantity": "gt100"},
             "_has: Patients with glucose > 100"),
        ]
        
        for query, params, description in has_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            
            # Determine status
            if result['status'] == 200:
                status = TestStatus.PASS
            elif result['status'] == 400 and ('not supported' in str(result['data']).lower() or 'not implemented' in str(result['data']).lower()):
                status = TestStatus.NOT_IMPLEMENTED
            else:
                status = TestStatus.FAIL
            
            test_result = TestResult(
                test_name=description,
                feature="_has",
                query=query,
                status=status,
                response_time=result['response_time'],
                http_status=result['status'],
                message=f"HTTP {result['status']}"
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_composite_searches(self):
        """Test composite search parameters"""
        suite = TestSuite("Composite Searches")
        
        # Composite parameters combine multiple components
        composite_tests = [
            # Observation code-value-quantity (e.g., glucose > 100)
            ("Observation?code-value-quantity=2339-0$gt100",
             {"code-value-quantity": "2339-0$gt100"},
             "Composite: Glucose > 100 mg/dL"),
            
            # Observation component-code-value-quantity (e.g., diastolic BP < 90)
            ("Observation?component-code-value-quantity=8462-4$lt90",
             {"component-code-value-quantity": "8462-4$lt90"},
             "Composite: Diastolic BP < 90"),
            
            # Observation combo-code-value-quantity with units
            ("Observation?code-value-quantity=8867-4$gt60|/min",
             {"code-value-quantity": "8867-4$gt60|/min"},
             "Composite: Heart rate > 60 bpm"),
            
            # Patient name+birthdate composite
            ("Patient?name-birthdate=TestPatient$1980-01-01",
             {"name-birthdate": "TestPatient$1980-01-01"},
             "Composite: Name and birthdate"),
        ]
        
        for query, params, description in composite_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            
            # Determine status
            if result['status'] == 200:
                status = TestStatus.PASS
            elif result['status'] in [400, 404] and ('not supported' in str(result['data']).lower() or 'unknown parameter' in str(result['data']).lower()):
                status = TestStatus.NOT_IMPLEMENTED
            else:
                status = TestStatus.FAIL
            
            test_result = TestResult(
                test_name=description,
                feature="composite",
                query=query,
                status=status,
                response_time=result['response_time'],
                http_status=result['status'],
                message=f"HTTP {result['status']}"
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_advanced_includes(self):
        """Test advanced _include and _revinclude scenarios"""
        suite = TestSuite("Advanced Include Operations")
        
        if not self.test_data.get('patients'):
            suite.results.append(TestResult(
                test_name="Advanced includes",
                feature="_include/_revinclude",
                query="N/A",
                status=TestStatus.SKIP,
                message="Insufficient test data"
            ))
            return suite
        
        patient_id = self.test_data['patients'][0]['id']
        
        include_tests = [
            # Multiple includes
            ("MedicationRequest?_include=MedicationRequest:medication&_include=MedicationRequest:requester",
             {"_include": ["MedicationRequest:medication", "MedicationRequest:requester"]},
             "Multiple _include: medication and requester"),
            
            # Include with search
            (f"Encounter?patient={patient_id}&_include=Encounter:patient&_include=Encounter:participant",
             {"patient": patient_id, "_include": ["Encounter:patient", "Encounter:participant"]},
             "Include with search: encounter with patient and participant"),
            
            # Recursive include
            ("MedicationRequest?_include=MedicationRequest:medication&_include:recurse=Medication:manufacturer",
             {"_include": "MedicationRequest:medication", "_include:recurse": "Medication:manufacturer"},
             "Recursive include: medication and manufacturer"),
            
            # Wildcard include
            (f"Patient?_id={patient_id}&_include=*",
             {"_id": patient_id, "_include": "*"},
             "Wildcard include: all references"),
            
            # Typed include
            ("Observation?_include=Observation:subject:Patient",
             {"_include": "Observation:subject:Patient"},
             "Typed include: only Patient subjects"),
            
            # Multiple revinclude
            (f"Patient?_id={patient_id}&_revinclude=Observation:patient&_revinclude=Condition:patient",
             {"_id": patient_id, "_revinclude": ["Observation:patient", "Condition:patient"]},
             "Multiple _revinclude: observations and conditions"),
            
            # Iterate modifier
            (f"MedicationRequest?patient={patient_id}&_include=MedicationRequest:medication&_include:iterate=Medication:manufacturer",
             {"patient": patient_id, "_include": "MedicationRequest:medication", "_include:iterate": "Medication:manufacturer"},
             "Include with iterate: follow chain"),
        ]
        
        for query, params, description in include_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            
            # Check if includes are working
            if result['status'] == 200:
                bundle = result['data']
                # Check if we got a bundle with entries
                if bundle.get('resourceType') == 'Bundle' and 'entry' in bundle:
                    # Look for included resources (they might have search mode = include)
                    included = [e for e in bundle.get('entry', []) if e.get('search', {}).get('mode') == 'include']
                    status = TestStatus.PASS
                    message = f"Found {len(included)} included resources"
                else:
                    status = TestStatus.PASS
                    message = "Bundle returned"
            else:
                status = TestStatus.FAIL
                message = f"HTTP {result['status']}"
            
            test_result = TestResult(
                test_name=description,
                feature="_include/_revinclude",
                query=query,
                status=status,
                response_time=result['response_time'],
                http_status=result['status'],
                message=message
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_bundle_operations(self):
        """Test Bundle transaction and batch operations"""
        suite = TestSuite("Bundle Operations")
        
        # Test batch bundle
        batch_bundle = {
            "resourceType": "Bundle",
            "type": "batch",
            "entry": [
                {
                    "request": {
                        "method": "GET",
                        "url": "Patient?_count=2"
                    }
                },
                {
                    "request": {
                        "method": "GET",
                        "url": "Observation?_count=2"
                    }
                }
            ]
        }
        
        result = await self.client.bundle(batch_bundle)
        test_result = TestResult(
            test_name="Batch bundle with searches",
            feature="batch",
            query="Bundle batch with 2 searches",
            status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
            response_time=result['response_time'],
            http_status=result['status'],
            message=f"HTTP {result['status']}"
        )
        suite.results.append(test_result)
        
        # Test transaction bundle with interdependencies
        transaction_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "fullUrl": "urn:uuid:61ebe359-bfdc-4613-8bf2-c5e300945f0a",
                    "resource": {
                        "resourceType": "Patient",
                        "identifier": [{"system": "http://example.org/mrn", "value": "TX001"}],
                        "name": [{"family": "TransactionTest", "given": ["Bundle"]}],
                        "gender": "male"
                    },
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    }
                },
                {
                    "fullUrl": "urn:uuid:88f151c0-a954-468a-88bd-5ae15c08e059",
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {
                            "coding": [{
                                "system": "http://loinc.org",
                                "code": "15074-8",
                                "display": "Glucose"
                            }]
                        },
                        "subject": {
                            "reference": "urn:uuid:61ebe359-bfdc-4613-8bf2-c5e300945f0a"
                        },
                        "valueQuantity": {
                            "value": 100,
                            "unit": "mg/dL"
                        }
                    },
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    }
                }
            ]
        }
        
        result = await self.client.bundle(transaction_bundle)
        
        # Check if transaction was processed
        if result['status'] == 200 and result['data'].get('type') == 'transaction-response':
            status = TestStatus.PASS
            # Track created resources for cleanup
            if 'entry' in result['data']:
                for entry in result['data']['entry']:
                    if entry.get('response', {}).get('status', '').startswith('201'):
                        location = entry['response'].get('location', '')
                        if '/' in location:
                            parts = location.split('/')
                            if len(parts) >= 2:
                                self.client.created_resources.append((parts[-2], parts[-1].split('/')[0]))
        else:
            status = TestStatus.FAIL
        
        test_result = TestResult(
            test_name="Transaction bundle with references",
            feature="transaction",
            query="Bundle transaction with internal references",
            status=status,
            response_time=result['response_time'],
            http_status=result['status'],
            message=f"HTTP {result['status']}"
        )
        suite.results.append(test_result)
        
        # Test conditional create in bundle
        conditional_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "identifier": [{"system": "http://example.org/mrn", "value": "COND001"}],
                        "name": [{"family": "ConditionalTest", "given": ["Create"]}]
                    },
                    "request": {
                        "method": "POST",
                        "url": "Patient",
                        "ifNoneExist": "identifier=http://example.org/mrn|COND001"
                    }
                }
            ]
        }
        
        result = await self.client.bundle(conditional_bundle)
        test_result = TestResult(
            test_name="Conditional create in bundle",
            feature="conditional",
            query="Bundle with If-None-Exist",
            status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
            response_time=result['response_time'],
            http_status=result['status'],
            message=f"HTTP {result['status']}"
        )
        suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_history_operations(self):
        """Test history operations"""
        suite = TestSuite("History Operations")
        
        if not self.test_data.get('patients'):
            suite.results.append(TestResult(
                test_name="History operations",
                feature="history",
                query="N/A",
                status=TestStatus.SKIP,
                message="Insufficient test data"
            ))
            return suite
        
        patient_id = self.test_data['patients'][0]['id']
        
        # Test instance history
        result = await self.client.search(f"Patient/{patient_id}/_history", {})
        test_result = TestResult(
            test_name="Instance history",
            feature="history",
            query=f"Patient/{patient_id}/_history",
            status=TestStatus.PASS if result['status'] == 200 else TestStatus.NOT_IMPLEMENTED if result['status'] == 404 else TestStatus.FAIL,
            response_time=result['response_time'],
            http_status=result['status'],
            message=f"HTTP {result['status']}"
        )
        suite.results.append(test_result)
        
        # Test type history
        result = await self.client.search("Patient/_history", {"_count": "10"})
        test_result = TestResult(
            test_name="Type history",
            feature="history",
            query="Patient/_history?_count=10",
            status=TestStatus.PASS if result['status'] == 200 else TestStatus.NOT_IMPLEMENTED if result['status'] == 404 else TestStatus.FAIL,
            response_time=result['response_time'],
            http_status=result['status'],
            message=f"HTTP {result['status']}"
        )
        suite.results.append(test_result)
        
        # Test system history
        result = await self.client.search("_history", {"_count": "10"})
        test_result = TestResult(
            test_name="System history",
            feature="history",
            query="_history?_count=10",
            status=TestStatus.PASS if result['status'] == 200 else TestStatus.NOT_IMPLEMENTED if result['status'] == 404 else TestStatus.FAIL,
            response_time=result['response_time'],
            http_status=result['status'],
            message=f"HTTP {result['status']}"
        )
        suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_operations(self):
        """Test FHIR operations"""
        suite = TestSuite("FHIR Operations")
        
        if not self.test_data.get('patients'):
            suite.results.append(TestResult(
                test_name="Operations",
                feature="operations",
                query="N/A",
                status=TestStatus.SKIP,
                message="Insufficient test data"
            ))
            return suite
        
        patient_id = self.test_data['patients'][0]['id']
        
        # Test $everything operation
        result = await self.client.search(f"Patient/{patient_id}/$everything", {})
        test_result = TestResult(
            test_name="Patient $everything",
            feature="$everything",
            query=f"Patient/{patient_id}/$everything",
            status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
            response_time=result['response_time'],
            http_status=result['status'],
            message=f"HTTP {result['status']}"
        )
        
        # Check if everything actually returns multiple resource types
        if result['status'] == 200 and result['data'].get('resourceType') == 'Bundle':
            resource_types = set()
            for entry in result['data'].get('entry', []):
                if 'resource' in entry:
                    resource_types.add(entry['resource'].get('resourceType'))
            test_result.message = f"Found {len(resource_types)} resource types: {', '.join(sorted(resource_types))}"
            if len(resource_types) <= 1:
                test_result.status = TestStatus.FAIL
                test_result.message += " (Expected multiple resource types)"
        
        suite.results.append(test_result)
        
        # Test other operations
        operations_tests = [
            # Validate operation
            ("Resource/$validate", {"resource": {"resourceType": "Patient", "gender": "invalid"}}, "$validate with invalid resource"),
            
            # Export operation
            ("Patient/$export", {}, "$export operation"),
            
            # Match operation
            ("Patient/$match", {"resource": {"resourceType": "Patient", "name": [{"family": "TestPatient"}]}}, "$match operation"),
        ]
        
        for operation_url, params, description in operations_tests:
            # POST operations typically
            url = f"{self.client.base_url}/{operation_url}"
            try:
                async with self.client.session.post(url, json=params) as response:
                    response_data = {}
                    try:
                        response_data = await response.json()
                    except:
                        response_data = {"text": await response.text()}
                    
                    # Determine status
                    if response.status == 200:
                        status = TestStatus.PASS
                    elif response.status in [404, 501]:
                        status = TestStatus.NOT_IMPLEMENTED
                    else:
                        status = TestStatus.FAIL
                    
                    test_result = TestResult(
                        test_name=description,
                        feature="operations",
                        query=operation_url,
                        status=status,
                        response_time=0.0,
                        http_status=response.status,
                        message=f"HTTP {response.status}"
                    )
                    suite.results.append(test_result)
            except Exception as e:
                test_result = TestResult(
                    test_name=description,
                    feature="operations",
                    query=operation_url,
                    status=TestStatus.ERROR,
                    message=str(e)
                )
                suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    def generate_report(self):
        """Generate comprehensive test report for advanced features"""
        print("\n" + "="*80)
        print("ADVANCED FHIR API TEST REPORT")
        print("="*80)
        print(f"Generated: {datetime.now().isoformat()}")
        print(f"Base URL: {BASE_URL}")
        print()
        
        # Overall summary
        total_tests = sum(suite.total for suite in self.suites)
        total_passed = sum(suite.passed for suite in self.suites)
        total_failed = sum(suite.failed for suite in self.suites)
        total_not_impl = sum(suite.not_implemented for suite in self.suites)
        
        print("OVERALL SUMMARY")
        print("-"*40)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {total_passed} ({(total_passed/total_tests*100):.1f}%)")
        print(f"Failed: {total_failed} ({(total_failed/total_tests*100):.1f}%)")
        print(f"Not Implemented: {total_not_impl} ({(total_not_impl/total_tests*100):.1f}%)")
        print()
        
        # Feature implementation status
        print("FEATURE IMPLEMENTATION STATUS")
        print("-"*40)
        
        feature_status = {}
        for suite in self.suites:
            for result in suite.results:
                if result.feature not in feature_status:
                    feature_status[result.feature] = {
                        "passed": 0, "failed": 0, "not_impl": 0, "total": 0
                    }
                
                feature_status[result.feature]["total"] += 1
                if result.status == TestStatus.PASS:
                    feature_status[result.feature]["passed"] += 1
                elif result.status == TestStatus.FAIL:
                    feature_status[result.feature]["failed"] += 1
                elif result.status == TestStatus.NOT_IMPLEMENTED:
                    feature_status[result.feature]["not_impl"] += 1
        
        for feature, stats in sorted(feature_status.items()):
            total = stats["total"]
            passed = stats["passed"]
            not_impl = stats["not_impl"]
            
            if passed == total:
                status_icon = "✅"
                status_text = "IMPLEMENTED"
            elif not_impl > 0:
                status_icon = "🚧"
                status_text = "NOT IMPLEMENTED"
            else:
                status_icon = "❌"
                status_text = "FAILING"
            
            print(f"{status_icon} {feature:<25} {status_text:<15} ({passed}/{total} tests passed)")
        
        # Detailed results by suite
        print("\n\nDETAILED RESULTS BY SUITE")
        print("-"*40)
        
        for suite in self.suites:
            print(f"\n{suite.name}")
            print(f"Tests: {suite.total} | Passed: {suite.passed} | Failed: {suite.failed} | Not Implemented: {suite.not_implemented}")
            
            # Show all tests with their status
            for result in suite.results:
                if result.status == TestStatus.PASS:
                    icon = "✓"
                elif result.status == TestStatus.NOT_IMPLEMENTED:
                    icon = "○"
                else:
                    icon = "✗"
                
                print(f"  {icon} {result.test_name:<50} {result.status.value}")
                if result.message and result.status != TestStatus.PASS:
                    print(f"    → {result.message}")
        
        # Implementation recommendations
        print("\n\nIMPLEMENTATION RECOMMENDATIONS")
        print("-"*40)
        
        if feature_status.get("forward chaining", {}).get("not_impl", 0) > 0:
            print("\n1. Chained Searches (HIGH PRIORITY)")
            print("   - Implement support for dot notation in search parameters")
            print("   - Example: Patient?general-practitioner.name=Smith")
            print("   - Requires: Joining related resources and searching their fields")
        
        if feature_status.get("_has", {}).get("not_impl", 0) > 0:
            print("\n2. Reverse Chaining with _has (MEDIUM PRIORITY)")
            print("   - Implement _has parameter for finding resources referenced by others")
            print("   - Example: Patient?_has:Observation:patient:code=8867-4")
            print("   - Requires: Reverse reference lookups")
        
        if feature_status.get("composite", {}).get("not_impl", 0) > 0:
            print("\n3. Composite Search Parameters (LOW PRIORITY)")
            print("   - Implement composite parameters that combine multiple search criteria")
            print("   - Example: Observation?code-value-quantity=8867-4$gt60")
            print("   - Requires: Special parameter parsing and query building")
        
        if feature_status.get("history", {}).get("not_impl", 0) > 0:
            print("\n4. History Operations (MEDIUM PRIORITY)")
            print("   - Implement _history endpoints for audit trails")
            print("   - Support instance, type, and system-level history")
            print("   - Requires: Version tracking in storage layer")
        
        if feature_status.get("batch", {}).get("failed", 0) > 0:
            print("\n5. Bundle Operations (HIGH PRIORITY)")
            print("   - Fix batch and transaction bundle processing")
            print("   - Support reference resolution within bundles")
            print("   - Implement proper transaction rollback")
        
        # Working examples
        print("\n\nWORKING ADVANCED FEATURES")
        print("-"*40)
        
        working_features = []
        for suite in self.suites:
            for result in suite.results:
                if result.status == TestStatus.PASS:
                    working_features.append((result.feature, result.query))
        
        # Group by feature
        from itertools import groupby
        for feature, queries in groupby(working_features, key=lambda x: x[0]):
            print(f"\n{feature}:")
            unique_queries = list(set(q[1] for q in queries))[:3]
            for query in unique_queries:
                print(f"  - {query}")
        
        print("\n" + "="*80)
        print("END OF REPORT")
        print("="*80)
    
    async def run_all_tests(self):
        """Run all advanced test suites"""
        async with AdvancedFHIRTestClient(BASE_URL) as client:
            self.client = client
            
            # Setup comprehensive test data
            await self.setup_comprehensive_test_data()
            
            # Run test suites
            print("\nRunning advanced test suites...")
            await self.test_chained_searches()
            await self.test_reverse_chaining()
            await self.test_composite_searches()
            await self.test_advanced_includes()
            await self.test_bundle_operations()
            await self.test_history_operations()
            await self.test_operations()
            
            # Generate report
            self.generate_report()


async def main():
    """Main entry point"""
    print("Starting Advanced FHIR API Test")
    print(f"Target: {BASE_URL}")
    print("-"*80)
    
    test_runner = AdvancedFHIRTest()
    await test_runner.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())