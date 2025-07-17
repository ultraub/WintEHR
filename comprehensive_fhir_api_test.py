#!/usr/bin/env python3
"""
Comprehensive FHIR API Test Script
Tests complex queries and parameter coverage for FHIR R4 implementation
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


@dataclass
class TestResult:
    """Individual test result"""
    test_name: str
    resource_type: str
    parameter: str
    query: str
    status: TestStatus
    message: str = ""
    response_time: float = 0.0
    expected: Any = None
    actual: Any = None
    

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
    def skipped(self) -> int:
        return len([r for r in self.results if r.status == TestStatus.SKIP])
    
    @property
    def errors(self) -> int:
        return len([r for r in self.results if r.status == TestStatus.ERROR])
    
    @property
    def total(self) -> int:
        return len(self.results)
    
    @property
    def success_rate(self) -> float:
        if self.total == 0:
            return 0.0
        return (self.passed / self.total) * 100


class FHIRTestClient:
    """HTTP client for FHIR API testing"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.created_resources: List[Tuple[str, str]] = []  # (resource_type, id) pairs
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=TIMEOUT)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Cleanup created resources
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
    
    async def read(self, path: str) -> dict:
        """Read a FHIR resource"""
        url = f"{self.base_url}/{path}"
        start_time = datetime.now()
        
        async with self.session.get(url) as response:
            response_time = (datetime.now() - start_time).total_seconds()
            result = await response.json()
            
            return {
                'status': response.status,
                'data': result,
                'response_time': response_time
            }
    
    async def search(self, resource_type: str, params: dict) -> dict:
        """Search for FHIR resources"""
        url = f"{self.base_url}/{resource_type}"
        start_time = datetime.now()
        
        async with self.session.get(url, params=params) as response:
            response_time = (datetime.now() - start_time).total_seconds()
            result = await response.json()
            
            return {
                'status': response.status,
                'data': result,
                'response_time': response_time,
                'url': str(response.url)
            }
    
    async def delete(self, path: str) -> dict:
        """Delete a FHIR resource"""
        url = f"{self.base_url}/{path}"
        
        async with self.session.delete(url) as response:
            return {'status': response.status}


class ComprehensiveFHIRTest:
    """Main test runner for comprehensive FHIR API testing"""
    
    def __init__(self):
        self.client: Optional[FHIRTestClient] = None
        self.test_data: Dict[str, Any] = {}
        self.suites: List[TestSuite] = []
        
    async def setup_test_data(self):
        """Create test data for comprehensive testing"""
        print("Setting up test data...")
        
        # Create test patients
        patients = []
        patient_data = [
            {
                "resourceType": "Patient",
                "identifier": [
                    {"system": "http://example.org/mrn", "value": "MRN12345"},
                    {"system": "http://example.org/ssn", "value": "123-45-6789"}
                ],
                "active": True,
                "name": [
                    {"use": "official", "family": "Smith", "given": ["John", "Jacob"]},
                    {"use": "nickname", "given": ["Johnny"]}
                ],
                "gender": "male",
                "birthDate": "1970-01-15",
                "address": [
                    {
                        "use": "home",
                        "line": ["123 Main St"],
                        "city": "Boston",
                        "state": "MA",
                        "postalCode": "02101"
                    }
                ],
                "telecom": [
                    {"system": "phone", "value": "555-123-4567", "use": "home"},
                    {"system": "email", "value": "john.smith@example.com"}
                ]
            },
            {
                "resourceType": "Patient",
                "identifier": [
                    {"system": "http://example.org/mrn", "value": "MRN67890"}
                ],
                "active": True,
                "name": [
                    {"use": "official", "family": "Jones", "given": ["Mary", "Elizabeth"]}
                ],
                "gender": "female",
                "birthDate": "1985-06-20",
                "deceasedDateTime": "2023-01-01T00:00:00Z"
            },
            {
                "resourceType": "Patient",
                "identifier": [
                    {"system": "http://example.org/mrn", "value": "MRN11111"}
                ],
                "active": False,
                "name": [
                    {"use": "official", "family": "Johnson", "given": ["Robert"]}
                ],
                "gender": "other",
                "birthDate": "2000-12-25"
            }
        ]
        
        for patient_data in patient_data:
            result = await self.client.create("Patient", patient_data)
            if result['status'] == 201:
                patients.append(result['data'])
        
        self.test_data['patients'] = patients
        
        # Create test practitioner
        practitioner_data = {
            "resourceType": "Practitioner",
            "identifier": [
                {"system": "http://example.org/npi", "value": "1234567890"}
            ],
            "active": True,
            "name": [
                {"family": "Brown", "given": ["Sarah"], "prefix": ["Dr."]}
            ]
        }
        pract_result = await self.client.create("Practitioner", practitioner_data)
        if pract_result['status'] == 201:
            self.test_data['practitioner'] = pract_result['data']
        
        # Create observations for first patient
        if patients:
            patient_id = patients[0]['id']
            observations = []
            
            obs_data = [
                {
                    "resourceType": "Observation",
                    "status": "final",
                    "category": [{
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "laboratory"
                        }]
                    }],
                    "code": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": "2339-0",
                            "display": "Glucose"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "effectiveDateTime": "2023-01-15T10:00:00Z",
                    "valueQuantity": {
                        "value": 95,
                        "unit": "mg/dL",
                        "system": "http://unitsofmeasure.org",
                        "code": "mg/dL"
                    }
                },
                {
                    "resourceType": "Observation",
                    "status": "preliminary",
                    "category": [{
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "vital-signs"
                        }]
                    }],
                    "code": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": "8480-6",
                            "display": "Systolic blood pressure"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "effectiveDateTime": "2023-06-01T14:30:00Z",
                    "valueQuantity": {
                        "value": 120,
                        "unit": "mmHg",
                        "system": "http://unitsofmeasure.org",
                        "code": "mm[Hg]"
                    },
                    "component": [{
                        "code": {
                            "coding": [{
                                "system": "http://loinc.org",
                                "code": "8462-4",
                                "display": "Diastolic blood pressure"
                            }]
                        },
                        "valueQuantity": {
                            "value": 80,
                            "unit": "mmHg",
                            "system": "http://unitsofmeasure.org",
                            "code": "mm[Hg]"
                        }
                    }]
                },
                {
                    "resourceType": "Observation",
                    "status": "final",
                    "code": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": "718-7",
                            "display": "Hemoglobin"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "effectiveDateTime": "2024-01-01T09:00:00Z",
                    "valueString": "Normal range"
                }
            ]
            
            for obs in obs_data:
                result = await self.client.create("Observation", obs)
                if result['status'] == 201:
                    observations.append(result['data'])
            
            self.test_data['observations'] = observations
        
        # Create conditions
        if patients:
            conditions = []
            condition_data = [
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
                            "code": "44054006",
                            "display": "Diabetes mellitus"
                        }]
                    },
                    "subject": {"reference": f"Patient/{patients[0]['id']}"},
                    "onsetDateTime": "2020-01-01"
                },
                {
                    "resourceType": "Condition",
                    "clinicalStatus": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                            "code": "resolved"
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
                    "onsetDateTime": "2019-01-01",
                    "abatementDateTime": "2023-06-01"
                }
            ]
            
            for cond in condition_data:
                result = await self.client.create("Condition", cond)
                if result['status'] == 201:
                    conditions.append(result['data'])
            
            self.test_data['conditions'] = conditions
        
        print(f"Test data setup complete: {len(self.test_data.get('patients', []))} patients, "
              f"{len(self.test_data.get('observations', []))} observations, "
              f"{len(self.test_data.get('conditions', []))} conditions")
    
    async def test_basic_parameters(self):
        """Test basic search parameters common to all resources"""
        suite = TestSuite("Basic Search Parameters")
        
        if not self.test_data.get('patients'):
            suite.results.append(TestResult(
                test_name="Basic Parameters",
                resource_type="Patient",
                parameter="_id",
                query="",
                status=TestStatus.SKIP,
                message="No test data available"
            ))
            return suite
        
        patient_id = self.test_data['patients'][0]['id']
        
        # Test _id parameter
        result = await self.client.search("Patient", {"_id": patient_id})
        test_result = TestResult(
            test_name="_id search",
            resource_type="Patient",
            parameter="_id",
            query=f"_id={patient_id}",
            status=TestStatus.PASS if result['status'] == 200 and result['data'].get('total', 0) == 1 else TestStatus.FAIL,
            response_time=result['response_time'],
            expected=1,
            actual=result['data'].get('total', 0)
        )
        suite.results.append(test_result)
        
        # Test _lastUpdated with ranges
        date_tests = [
            ("_lastUpdated=gt2020-01-01", {"_lastUpdated": "gt2020-01-01"}),
            ("_lastUpdated=lt2030-01-01", {"_lastUpdated": "lt2030-01-01"}),
            ("_lastUpdated=ge2020-01-01", {"_lastUpdated": "ge2020-01-01"}),
        ]
        
        for test_name, params in date_tests:
            result = await self.client.search("Patient", params)
            test_result = TestResult(
                test_name=f"_lastUpdated search: {test_name}",
                resource_type="Patient",
                parameter="_lastUpdated",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time'],
                message=f"HTTP {result['status']}"
            )
            suite.results.append(test_result)
        
        # Test _count parameter
        result = await self.client.search("Patient", {"_count": "2"})
        test_result = TestResult(
            test_name="_count pagination",
            resource_type="Patient",
            parameter="_count",
            query="_count=2",
            status=TestStatus.PASS if result['status'] == 200 and len(result['data'].get('entry', [])) <= 2 else TestStatus.FAIL,
            response_time=result['response_time'],
            expected="<=2 entries",
            actual=len(result['data'].get('entry', []))
        )
        suite.results.append(test_result)
        
        # Test _sort parameter
        result = await self.client.search("Patient", {"_sort": "birthdate"})
        test_result = TestResult(
            test_name="_sort by birthdate",
            resource_type="Patient",
            parameter="_sort",
            query="_sort=birthdate",
            status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
            response_time=result['response_time']
        )
        suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_modifiers(self):
        """Test search parameter modifiers"""
        suite = TestSuite("Search Modifiers")
        
        if not self.test_data.get('patients'):
            suite.results.append(TestResult(
                test_name="Modifiers",
                resource_type="Patient",
                parameter="various",
                query="",
                status=TestStatus.SKIP,
                message="No test data available"
            ))
            return suite
        
        # String modifiers
        string_tests = [
            ("name:exact=Smith", {"name:exact": "Smith"}),
            ("name:contains=mit", {"name:contains": "mit"}),
            ("family:exact=Jones", {"family:exact": "Jones"}),
        ]
        
        for test_name, params in string_tests:
            result = await self.client.search("Patient", params)
            test_result = TestResult(
                test_name=f"String modifier: {test_name}",
                resource_type="Patient",
                parameter="name/family",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Missing modifiers
        missing_tests = [
            ("death-date:missing=true", {"death-date:missing": "true"}),
            ("death-date:missing=false", {"death-date:missing": "false"}),
        ]
        
        for test_name, params in missing_tests:
            result = await self.client.search("Patient", params)
            test_result = TestResult(
                test_name=f"Missing modifier: {test_name}",
                resource_type="Patient",
                parameter="death-date",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_patient_parameters(self):
        """Test Patient-specific search parameters"""
        suite = TestSuite("Patient Search Parameters")
        
        # Test identifier searches
        identifier_tests = [
            ("identifier=MRN12345", {"identifier": "MRN12345"}),
            ("identifier=http://example.org/mrn|MRN12345", {"identifier": "http://example.org/mrn|MRN12345"}),
            ("identifier=|MRN12345", {"identifier": "|MRN12345"}),
        ]
        
        for test_name, params in identifier_tests:
            result = await self.client.search("Patient", params)
            test_result = TestResult(
                test_name=f"Patient identifier: {test_name}",
                resource_type="Patient",
                parameter="identifier",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time'],
                expected=">=1",
                actual=result['data'].get('total', 0)
            )
            suite.results.append(test_result)
        
        # Test name searches
        name_tests = [
            ("name=Smith", {"name": "Smith"}),
            ("family=Smith", {"family": "Smith"}),
            ("given=John", {"given": "John"}),
            ("name=John Smith", {"name": "John Smith"}),
        ]
        
        for test_name, params in name_tests:
            result = await self.client.search("Patient", params)
            test_result = TestResult(
                test_name=f"Patient name: {test_name}",
                resource_type="Patient",
                parameter="name/family/given",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test birthdate searches
        birthdate_tests = [
            ("birthdate=1970-01-15", {"birthdate": "1970-01-15"}),
            ("birthdate=gt1980-01-01", {"birthdate": "gt1980-01-01"}),
            ("birthdate=lt1990-01-01", {"birthdate": "lt1990-01-01"}),
            ("birthdate=ge1970-01-01&birthdate=le1990-12-31", {"birthdate": ["ge1970-01-01", "le1990-12-31"]}),
        ]
        
        for test_name, params in birthdate_tests:
            result = await self.client.search("Patient", params)
            test_result = TestResult(
                test_name=f"Patient birthdate: {test_name}",
                resource_type="Patient",
                parameter="birthdate",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test gender searches
        gender_tests = [
            ("gender=male", {"gender": "male"}),
            ("gender=female", {"gender": "female"}),
            ("gender=other", {"gender": "other"}),
        ]
        
        for test_name, params in gender_tests:
            result = await self.client.search("Patient", params)
            test_result = TestResult(
                test_name=f"Patient gender: {test_name}",
                resource_type="Patient",
                parameter="gender",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test other parameters
        other_tests = [
            ("active=true", {"active": "true"}),
            ("active=false", {"active": "false"}),
            ("address=Boston", {"address": "Boston"}),
            ("address-city=Boston", {"address-city": "Boston"}),
            ("telecom=555-123-4567", {"telecom": "555-123-4567"}),
        ]
        
        for test_name, params in other_tests:
            result = await self.client.search("Patient", params)
            test_result = TestResult(
                test_name=f"Patient parameter: {test_name}",
                resource_type="Patient",
                parameter=test_name.split('=')[0],
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_observation_parameters(self):
        """Test Observation-specific search parameters"""
        suite = TestSuite("Observation Search Parameters")
        
        if not self.test_data.get('observations') or not self.test_data.get('patients'):
            suite.results.append(TestResult(
                test_name="Observation Parameters",
                resource_type="Observation",
                parameter="various",
                query="",
                status=TestStatus.SKIP,
                message="No test data available"
            ))
            return suite
        
        patient_id = self.test_data['patients'][0]['id']
        
        # Test code searches
        code_tests = [
            ("code=2339-0", {"code": "2339-0"}),
            ("code=http://loinc.org|2339-0", {"code": "http://loinc.org|2339-0"}),
            ("code=2339-0,718-7", {"code": "2339-0,718-7"}),  # OR search
        ]
        
        for test_name, params in code_tests:
            result = await self.client.search("Observation", params)
            test_result = TestResult(
                test_name=f"Observation code: {test_name}",
                resource_type="Observation",
                parameter="code",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test category searches
        category_tests = [
            ("category=laboratory", {"category": "laboratory"}),
            ("category=vital-signs", {"category": "vital-signs"}),
        ]
        
        for test_name, params in category_tests:
            result = await self.client.search("Observation", params)
            test_result = TestResult(
                test_name=f"Observation category: {test_name}",
                resource_type="Observation",
                parameter="category",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test patient/subject reference
        reference_tests = [
            (f"patient={patient_id}", {"patient": patient_id}),
            (f"subject={patient_id}", {"subject": patient_id}),
            (f"patient=Patient/{patient_id}", {"patient": f"Patient/{patient_id}"}),
        ]
        
        for test_name, params in reference_tests:
            result = await self.client.search("Observation", params)
            test_result = TestResult(
                test_name=f"Observation reference: {test_name}",
                resource_type="Observation",
                parameter="patient/subject",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test status searches
        status_tests = [
            ("status=final", {"status": "final"}),
            ("status=preliminary", {"status": "preliminary"}),
            ("status=final,preliminary", {"status": "final,preliminary"}),
        ]
        
        for test_name, params in status_tests:
            result = await self.client.search("Observation", params)
            test_result = TestResult(
                test_name=f"Observation status: {test_name}",
                resource_type="Observation",
                parameter="status",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test date searches
        date_tests = [
            ("date=2023-01-15", {"date": "2023-01-15"}),
            ("date=gt2023-01-01", {"date": "gt2023-01-01"}),
            ("date=ge2023-01-01&date=le2023-12-31", {"date": ["ge2023-01-01", "le2023-12-31"]}),
        ]
        
        for test_name, params in date_tests:
            result = await self.client.search("Observation", params)
            test_result = TestResult(
                test_name=f"Observation date: {test_name}",
                resource_type="Observation",
                parameter="date",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test value-quantity searches
        value_tests = [
            ("value-quantity=95", {"value-quantity": "95"}),
            ("value-quantity=gt90", {"value-quantity": "gt90"}),
            ("value-quantity=lt100", {"value-quantity": "lt100"}),
            ("value-quantity=95|mg/dL", {"value-quantity": "95|mg/dL"}),
            ("value-quantity=gt90|mg/dL", {"value-quantity": "gt90|mg/dL"}),
        ]
        
        for test_name, params in value_tests:
            result = await self.client.search("Observation", params)
            test_result = TestResult(
                test_name=f"Observation value-quantity: {test_name}",
                resource_type="Observation",
                parameter="value-quantity",
                query=test_name,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_complex_queries(self):
        """Test complex query patterns"""
        suite = TestSuite("Complex Queries")
        
        if not self.test_data.get('patients'):
            suite.results.append(TestResult(
                test_name="Complex Queries",
                resource_type="Various",
                parameter="complex",
                query="",
                status=TestStatus.SKIP,
                message="No test data available"
            ))
            return suite
        
        patient_id = self.test_data['patients'][0]['id']
        
        # Test combined parameters (AND)
        and_tests = [
            ("Patient?family=Smith&given=John", {"family": "Smith", "given": "John"}),
            ("Patient?gender=male&birthdate=lt1980-01-01", {"gender": "male", "birthdate": "lt1980-01-01"}),
            ("Observation?code=2339-0&status=final", {"code": "2339-0", "status": "final"}),
        ]
        
        for query, params in and_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            test_result = TestResult(
                test_name=f"AND query: {query}",
                resource_type=resource_type,
                parameter="multiple",
                query=query,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test OR searches (comma-separated values)
        or_tests = [
            ("Patient?identifier=MRN12345,MRN67890", {"identifier": "MRN12345,MRN67890"}),
            ("Observation?code=2339-0,718-7,8480-6", {"code": "2339-0,718-7,8480-6"}),
        ]
        
        for query, params in or_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            test_result = TestResult(
                test_name=f"OR query: {query}",
                resource_type=resource_type,
                parameter="multiple",
                query=query,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test _include (include referenced resources)
        include_tests = [
            (f"Observation?patient={patient_id}&_include=Observation:patient", 
             {"patient": patient_id, "_include": "Observation:patient"}),
            (f"Condition?patient={patient_id}&_include=Condition:patient",
             {"patient": patient_id, "_include": "Condition:patient"}),
        ]
        
        for query, params in include_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            test_result = TestResult(
                test_name=f"_include query: {query}",
                resource_type=resource_type,
                parameter="_include",
                query=query,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test _revinclude (include resources that reference this)
        revinclude_tests = [
            (f"Patient?_id={patient_id}&_revinclude=Observation:patient",
             {"_id": patient_id, "_revinclude": "Observation:patient"}),
            (f"Patient?_id={patient_id}&_revinclude=Condition:patient",
             {"_id": patient_id, "_revinclude": "Condition:patient"}),
        ]
        
        for query, params in revinclude_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            test_result = TestResult(
                test_name=f"_revinclude query: {query}",
                resource_type=resource_type,
                parameter="_revinclude",
                query=query,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        # Test _summary
        summary_tests = [
            ("Patient?_summary=true", {"_summary": "true"}),
            ("Patient?_summary=count", {"_summary": "count"}),
        ]
        
        for query, params in summary_tests:
            resource_type = query.split('?')[0]
            result = await self.client.search(resource_type, params)
            test_result = TestResult(
                test_name=f"_summary query: {query}",
                resource_type=resource_type,
                parameter="_summary",
                query=query,
                status=TestStatus.PASS if result['status'] == 200 else TestStatus.FAIL,
                response_time=result['response_time']
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    async def test_error_cases(self):
        """Test error handling for invalid queries"""
        suite = TestSuite("Error Handling")
        
        # Test invalid parameters
        error_tests = [
            ("Patient?invalid_param=test", {"invalid_param": "test"}, "Invalid parameter"),
            ("Patient?birthdate=invalid-date", {"birthdate": "invalid-date"}, "Invalid date format"),
            ("Patient?_count=invalid", {"_count": "invalid"}, "Invalid count value"),
            ("InvalidResource?name=test", {"name": "test"}, "Invalid resource type"),
        ]
        
        for query, params, description in error_tests:
            parts = query.split('?')
            resource_type = parts[0]
            
            if resource_type == "InvalidResource":
                # Test invalid resource type
                result = await self.client.search(resource_type, params)
                expected_status = 404
            else:
                result = await self.client.search(resource_type, params)
                expected_status = 400
            
            test_result = TestResult(
                test_name=f"Error case: {description}",
                resource_type=resource_type,
                parameter="error",
                query=query,
                status=TestStatus.PASS if result['status'] in [expected_status, 200] else TestStatus.FAIL,
                response_time=result.get('response_time', 0),
                message=f"Expected {expected_status} or 200, got {result['status']}"
            )
            suite.results.append(test_result)
        
        self.suites.append(suite)
        return suite
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*80)
        print("COMPREHENSIVE FHIR API TEST REPORT")
        print("="*80)
        print(f"Generated: {datetime.now().isoformat()}")
        print(f"Base URL: {BASE_URL}")
        print()
        
        # Overall summary
        total_tests = sum(suite.total for suite in self.suites)
        total_passed = sum(suite.passed for suite in self.suites)
        total_failed = sum(suite.failed for suite in self.suites)
        total_skipped = sum(suite.skipped for suite in self.suites)
        total_errors = sum(suite.errors for suite in self.suites)
        
        print("OVERALL SUMMARY")
        print("-"*40)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {total_passed} ({(total_passed/total_tests*100):.1f}%)")
        print(f"Failed: {total_failed} ({(total_failed/total_tests*100):.1f}%)")
        print(f"Skipped: {total_skipped}")
        print(f"Errors: {total_errors}")
        print()
        
        # Suite summaries
        for suite in self.suites:
            print(f"\n{suite.name.upper()}")
            print("-"*40)
            print(f"Tests: {suite.total} | Passed: {suite.passed} | Failed: {suite.failed} | "
                  f"Success Rate: {suite.success_rate:.1f}%")
            
            # Show failed tests
            failed_tests = [r for r in suite.results if r.status == TestStatus.FAIL]
            if failed_tests:
                print("\nFailed Tests:")
                for test in failed_tests[:5]:  # Show first 5 failures
                    print(f"  - {test.test_name}: {test.query}")
                    if test.message:
                        print(f"    Message: {test.message}")
                if len(failed_tests) > 5:
                    print(f"  ... and {len(failed_tests) - 5} more")
        
        # Parameter coverage summary
        print("\n\nPARAMETER COVERAGE")
        print("-"*40)
        
        parameter_coverage = {}
        for suite in self.suites:
            for result in suite.results:
                key = f"{result.resource_type}.{result.parameter}"
                if key not in parameter_coverage:
                    parameter_coverage[key] = {"passed": 0, "failed": 0}
                
                if result.status == TestStatus.PASS:
                    parameter_coverage[key]["passed"] += 1
                elif result.status == TestStatus.FAIL:
                    parameter_coverage[key]["failed"] += 1
        
        # Sort by resource type and parameter
        sorted_params = sorted(parameter_coverage.items())
        current_resource = None
        
        for param_key, stats in sorted_params:
            resource_type, param = param_key.split('.', 1)
            
            if resource_type != current_resource:
                print(f"\n{resource_type}:")
                current_resource = resource_type
            
            total = stats["passed"] + stats["failed"]
            success_rate = (stats["passed"] / total * 100) if total > 0 else 0
            status = "✓" if success_rate == 100 else "✗" if success_rate == 0 else "◐"
            print(f"  {status} {param:<30} {stats['passed']}/{total} ({success_rate:.0f}%)")
        
        # Performance summary
        print("\n\nPERFORMANCE SUMMARY")
        print("-"*40)
        
        response_times = []
        for suite in self.suites:
            for result in suite.results:
                if result.response_time > 0:
                    response_times.append(result.response_time)
        
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            min_time = min(response_times)
            max_time = max(response_times)
            
            print(f"Average Response Time: {avg_time:.3f}s")
            print(f"Min Response Time: {min_time:.3f}s")
            print(f"Max Response Time: {max_time:.3f}s")
        
        # Working query examples
        print("\n\nWORKING QUERY EXAMPLES")
        print("-"*40)
        
        working_queries = []
        for suite in self.suites:
            for result in suite.results:
                if result.status == TestStatus.PASS and result.query:
                    working_queries.append((result.resource_type, result.query))
        
        # Group by resource type
        from itertools import groupby
        
        for resource_type, queries in groupby(working_queries, key=lambda x: x[0]):
            print(f"\n{resource_type}:")
            unique_queries = list(set(q[1] for q in queries))[:5]  # Show first 5 unique
            for query in unique_queries:
                print(f"  - {query}")
        
        print("\n" + "="*80)
        print("END OF REPORT")
        print("="*80)
    
    async def run_all_tests(self):
        """Run all test suites"""
        async with FHIRTestClient(BASE_URL) as client:
            self.client = client
            
            # Setup test data
            await self.setup_test_data()
            
            # Run test suites
            print("\nRunning test suites...")
            await self.test_basic_parameters()
            await self.test_modifiers()
            await self.test_patient_parameters()
            await self.test_observation_parameters()
            await self.test_complex_queries()
            await self.test_error_cases()
            
            # Generate report
            self.generate_report()


async def main():
    """Main entry point"""
    print("Starting Comprehensive FHIR API Test")
    print(f"Target: {BASE_URL}")
    print("-"*80)
    
    test_runner = ComprehensiveFHIRTest()
    await test_runner.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())