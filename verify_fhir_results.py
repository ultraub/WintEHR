#!/usr/bin/env python3
"""
Verify FHIR API Results - Checks that queries return correct data, not just 200 status
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass
import aiohttp

BASE_URL = "http://localhost:8000/fhir/R4"


@dataclass
class VerificationResult:
    test_name: str
    query: str
    passed: bool
    message: str
    expected: Any = None
    actual: Any = None
    details: Dict[str, Any] = None


class FHIRResultVerifier:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.created_resources: List[tuple] = []
        self.test_data: Dict[str, Any] = {}
        self.results: List[VerificationResult] = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Cleanup
        for resource_type, resource_id in reversed(self.created_resources):
            try:
                await self.session.delete(f"{BASE_URL}/{resource_type}/{resource_id}")
            except:
                pass
        await self.session.close()
    
    async def create_resource(self, resource_type: str, data: dict) -> Optional[dict]:
        """Create a resource and track for cleanup"""
        try:
            async with self.session.post(f"{BASE_URL}/{resource_type}", json=data) as resp:
                if resp.status == 201:
                    result = await resp.json()
                    self.created_resources.append((resource_type, result['id']))
                    return result
        except Exception as e:
            print(f"Failed to create {resource_type}: {e}")
        return None
    
    async def search(self, resource_type: str, params: dict) -> dict:
        """Perform a search and return results"""
        try:
            async with self.session.get(f"{BASE_URL}/{resource_type}", params=params) as resp:
                return {
                    'status': resp.status,
                    'data': await resp.json() if resp.status == 200 else None
                }
        except Exception as e:
            return {'status': 500, 'data': None, 'error': str(e)}
    
    async def setup_test_data(self):
        """Create specific test data for verification"""
        print("Creating test data for verification...")
        
        # Create practitioners with specific names
        dr_smith = await self.create_resource("Practitioner", {
            "resourceType": "Practitioner",
            "name": [{"family": "Smith", "given": ["John"], "prefix": ["Dr."]}],
            "identifier": [{"system": "http://example.org/npi", "value": "NPI-SMITH"}]
        })
        
        dr_jones = await self.create_resource("Practitioner", {
            "resourceType": "Practitioner", 
            "name": [{"family": "Jones", "given": ["Sarah"], "prefix": ["Dr."]}],
            "identifier": [{"system": "http://example.org/npi", "value": "NPI-JONES"}]
        })
        
        self.test_data['dr_smith'] = dr_smith
        self.test_data['dr_jones'] = dr_jones
        
        # Create patients with specific practitioners
        patient_with_smith = await self.create_resource("Patient", {
            "resourceType": "Patient",
            "name": [{"family": "PatientOfSmith", "given": ["Alice"]}],
            "birthDate": "1980-01-01",
            "generalPractitioner": [{"reference": f"Practitioner/{dr_smith['id']}"}] if dr_smith else []
        })
        
        patient_with_jones = await self.create_resource("Patient", {
            "resourceType": "Patient",
            "name": [{"family": "PatientOfJones", "given": ["Bob"]}],
            "birthDate": "1975-05-15",
            "generalPractitioner": [{"reference": f"Practitioner/{dr_jones['id']}"}] if dr_jones else []
        })
        
        patient_no_doctor = await self.create_resource("Patient", {
            "resourceType": "Patient",
            "name": [{"family": "NoDoctor", "given": ["Charlie"]}],
            "birthDate": "1990-12-25"
        })
        
        self.test_data['patient_with_smith'] = patient_with_smith
        self.test_data['patient_with_jones'] = patient_with_jones
        self.test_data['patient_no_doctor'] = patient_no_doctor
        
        # Create specific observations
        if patient_with_smith:
            # Heart rate observation for Smith's patient
            hr_obs = await self.create_resource("Observation", {
                "resourceType": "Observation",
                "status": "final",
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": "8867-4", "display": "Heart rate"}]
                },
                "subject": {"reference": f"Patient/{patient_with_smith['id']}"},
                "valueQuantity": {"value": 72, "unit": "beats/minute"},
                "effectiveDateTime": "2023-01-15T10:00:00Z"
            })
            
            # Glucose observation > 100
            glucose_obs = await self.create_resource("Observation", {
                "resourceType": "Observation",
                "status": "final",
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": "2339-0", "display": "Glucose"}]
                },
                "subject": {"reference": f"Patient/{patient_with_smith['id']}"},
                "valueQuantity": {"value": 110, "unit": "mg/dL"},
                "effectiveDateTime": "2023-01-15T11:00:00Z"
            })
            
            self.test_data['hr_obs'] = hr_obs
            self.test_data['glucose_obs'] = glucose_obs
        
        # Create glucose < 100 for Jones's patient
        if patient_with_jones:
            glucose_low = await self.create_resource("Observation", {
                "resourceType": "Observation",
                "status": "final",
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": "2339-0", "display": "Glucose"}]
                },
                "subject": {"reference": f"Patient/{patient_with_jones['id']}"},
                "valueQuantity": {"value": 90, "unit": "mg/dL"},
                "effectiveDateTime": "2023-01-16T10:00:00Z"
            })
            
            self.test_data['glucose_low'] = glucose_low
        
        # Create medication and medication request
        medication = await self.create_resource("Medication", {
            "resourceType": "Medication",
            "code": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "387458008",
                    "display": "Aspirin"
                }]
            }
        })
        
        if medication and patient_with_smith and dr_smith:
            med_request = await self.create_resource("MedicationRequest", {
                "resourceType": "MedicationRequest",
                "status": "active",
                "intent": "order",
                "medicationReference": {"reference": f"Medication/{medication['id']}"},
                "subject": {"reference": f"Patient/{patient_with_smith['id']}"},
                "requester": {"reference": f"Practitioner/{dr_smith['id']}"}
            })
            
            self.test_data['medication'] = medication
            self.test_data['med_request'] = med_request
        
        print(f"Created test data: {len(self.created_resources)} resources")
    
    async def verify_chained_search(self):
        """Verify chained searches return correct results"""
        print("\n=== Verifying Chained Searches ===")
        
        # Test 1: Find patients whose practitioner is named Smith
        result = await self.search("Patient", {"general-practitioner.name": "Smith"})
        
        if result['status'] == 200 and result['data']:
            bundle = result['data']
            entries = bundle.get('entry', [])
            
            # Check if we got patients
            patient_names = []
            for entry in entries:
                if entry.get('resource', {}).get('resourceType') == 'Patient':
                    patient = entry['resource']
                    name = patient.get('name', [{}])[0]
                    patient_names.append(f"{name.get('family', '')} {name.get('given', [''])[0]}")
            
            # Verify we got PatientOfSmith but not PatientOfJones or NoDoctor
            has_smith_patient = any('PatientOfSmith' in name for name in patient_names)
            has_jones_patient = any('PatientOfJones' in name for name in patient_names)
            has_no_doctor = any('NoDoctor' in name for name in patient_names)
            
            passed = has_smith_patient and not has_jones_patient and not has_no_doctor
            
            self.results.append(VerificationResult(
                test_name="Chained search: Patient by practitioner name",
                query="Patient?general-practitioner.name=Smith",
                passed=passed,
                message=f"Found patients: {patient_names}",
                expected="Only PatientOfSmith",
                actual=patient_names,
                details={'total': bundle.get('total', 0)}
            ))
        else:
            self.results.append(VerificationResult(
                test_name="Chained search: Patient by practitioner name",
                query="Patient?general-practitioner.name=Smith",
                passed=False,
                message=f"Search failed with status {result['status']}"
            ))
        
        # Test 2: Find observations where patient name contains "PatientOfSmith"
        result = await self.search("Observation", {"patient.name": "PatientOfSmith"})
        
        if result['status'] == 200 and result['data']:
            bundle = result['data']
            entries = bundle.get('entry', [])
            
            # Check observation codes
            obs_codes = []
            for entry in entries:
                if entry.get('resource', {}).get('resourceType') == 'Observation':
                    obs = entry['resource']
                    code = obs.get('code', {}).get('coding', [{}])[0].get('code', '')
                    obs_codes.append(code)
            
            # Should have heart rate (8867-4) and glucose (2339-0)
            has_hr = '8867-4' in obs_codes
            has_glucose = '2339-0' in obs_codes
            
            self.results.append(VerificationResult(
                test_name="Chained search: Observation by patient name",
                query="Observation?patient.name=PatientOfSmith",
                passed=has_hr and has_glucose,
                message=f"Found observation codes: {obs_codes}",
                expected="8867-4 (HR) and 2339-0 (Glucose)",
                actual=obs_codes
            ))
        else:
            self.results.append(VerificationResult(
                test_name="Chained search: Observation by patient name",
                query="Observation?patient.name=PatientOfSmith",
                passed=False,
                message=f"Search failed with status {result['status']}"
            ))
    
    async def verify_has_parameter(self):
        """Verify _has parameter returns correct results"""
        print("\n=== Verifying _has Parameter ===")
        
        # Test: Find patients who have heart rate observations
        result = await self.search("Patient", {"_has:Observation:patient:code": "8867-4"})
        
        if result['status'] == 200 and result['data']:
            bundle = result['data']
            entries = bundle.get('entry', [])
            
            patient_names = []
            for entry in entries:
                if entry.get('resource', {}).get('resourceType') == 'Patient':
                    patient = entry['resource']
                    name = patient.get('name', [{}])[0]
                    patient_names.append(name.get('family', ''))
            
            # Should only have PatientOfSmith (who has heart rate observation)
            has_smith = 'PatientOfSmith' in patient_names
            has_jones = 'PatientOfJones' in patient_names
            has_no_doc = 'NoDoctor' in patient_names
            
            passed = has_smith and not has_jones and not has_no_doc and len(patient_names) == 1
            
            self.results.append(VerificationResult(
                test_name="_has: Patients with heart rate observations",
                query="Patient?_has:Observation:patient:code=8867-4",
                passed=passed,
                message=f"Found patients: {patient_names}",
                expected="Only PatientOfSmith",
                actual=patient_names
            ))
        else:
            self.results.append(VerificationResult(
                test_name="_has: Patients with heart rate observations",
                query="Patient?_has:Observation:patient:code=8867-4",
                passed=False,
                message=f"Search failed with status {result['status']}"
            ))
    
    async def verify_composite_search(self):
        """Verify composite searches return correct results"""
        print("\n=== Verifying Composite Searches ===")
        
        # Test: Find observations with glucose > 100
        result = await self.search("Observation", {"code-value-quantity": "2339-0$gt100"})
        
        if result['status'] == 200 and result['data']:
            bundle = result['data']
            entries = bundle.get('entry', [])
            
            glucose_values = []
            patient_refs = []
            
            for entry in entries:
                if entry.get('resource', {}).get('resourceType') == 'Observation':
                    obs = entry['resource']
                    code = obs.get('code', {}).get('coding', [{}])[0].get('code', '')
                    if code == '2339-0':
                        value = obs.get('valueQuantity', {}).get('value', 0)
                        glucose_values.append(value)
                        patient_refs.append(obs.get('subject', {}).get('reference', ''))
            
            # All values should be > 100
            all_above_100 = all(v > 100 for v in glucose_values)
            # Should have at least one result (110 mg/dL)
            has_results = len(glucose_values) > 0
            # Should NOT include the 90 mg/dL result
            no_low_values = 90 not in glucose_values
            
            passed = all_above_100 and has_results and no_low_values
            
            self.results.append(VerificationResult(
                test_name="Composite: Glucose > 100",
                query="Observation?code-value-quantity=2339-0$gt100",
                passed=passed,
                message=f"Found glucose values: {glucose_values}",
                expected="Only values > 100 (should be [110])",
                actual=glucose_values,
                details={'patient_refs': patient_refs}
            ))
        else:
            self.results.append(VerificationResult(
                test_name="Composite: Glucose > 100",
                query="Observation?code-value-quantity=2339-0$gt100",
                passed=False,
                message=f"Search failed with status {result['status']}"
            ))
    
    async def verify_include_operations(self):
        """Verify _include returns the referenced resources"""
        print("\n=== Verifying _include Operations ===")
        
        if not self.test_data.get('med_request'):
            print("Skipping _include test - no medication request created")
            return
        
        # Test: Get medication request and include the medication and requester
        result = await self.search("MedicationRequest", {
            "_include": ["MedicationRequest:medication", "MedicationRequest:requester"]
        })
        
        if result['status'] == 200 and result['data']:
            bundle = result['data']
            entries = bundle.get('entry', [])
            
            resource_types = {}
            included_resources = []
            
            for entry in entries:
                resource = entry.get('resource', {})
                resource_type = resource.get('resourceType', '')
                search_mode = entry.get('search', {}).get('mode', '')
                
                if resource_type not in resource_types:
                    resource_types[resource_type] = 0
                resource_types[resource_type] += 1
                
                if search_mode == 'include':
                    included_resources.append({
                        'type': resource_type,
                        'id': resource.get('id', ''),
                        'display': resource.get('code', {}).get('display', '') or 
                                  resource.get('name', [{}])[0].get('family', '') if resource_type == 'Practitioner' else ''
                    })
            
            # Should have MedicationRequest, Medication, and Practitioner
            has_med_request = 'MedicationRequest' in resource_types
            has_medication = 'Medication' in resource_types
            has_practitioner = 'Practitioner' in resource_types
            
            passed = has_med_request and has_medication and has_practitioner
            
            self.results.append(VerificationResult(
                test_name="_include: MedicationRequest with medication and requester",
                query="MedicationRequest?_include=MedicationRequest:medication&_include=MedicationRequest:requester",
                passed=passed,
                message=f"Resource types found: {resource_types}",
                expected="MedicationRequest, Medication, Practitioner",
                actual=resource_types,
                details={'included': included_resources}
            ))
        else:
            self.results.append(VerificationResult(
                test_name="_include: MedicationRequest with medication and requester",
                query="MedicationRequest?_include=MedicationRequest:medication&_include=MedicationRequest:requester",
                passed=False,
                message=f"Search failed with status {result['status']}"
            ))
    
    async def verify_revinclude_operations(self):
        """Verify _revinclude returns resources that reference the main resource"""
        print("\n=== Verifying _revinclude Operations ===")
        
        if not self.test_data.get('patient_with_smith'):
            print("Skipping _revinclude test - no patient created")
            return
        
        patient_id = self.test_data['patient_with_smith']['id']
        
        # Test: Get patient and include all observations that reference it
        result = await self.search("Patient", {
            "_id": patient_id,
            "_revinclude": "Observation:patient"
        })
        
        if result['status'] == 200 and result['data']:
            bundle = result['data']
            entries = bundle.get('entry', [])
            
            resource_counts = {}
            observation_codes = []
            
            for entry in entries:
                resource = entry.get('resource', {})
                resource_type = resource.get('resourceType', '')
                
                if resource_type not in resource_counts:
                    resource_counts[resource_type] = 0
                resource_counts[resource_type] += 1
                
                if resource_type == 'Observation':
                    code = resource.get('code', {}).get('coding', [{}])[0].get('code', '')
                    observation_codes.append(code)
            
            # Should have 1 Patient and 2 Observations (HR and glucose)
            correct_patient_count = resource_counts.get('Patient', 0) == 1
            correct_obs_count = resource_counts.get('Observation', 0) == 2
            has_hr = '8867-4' in observation_codes
            has_glucose = '2339-0' in observation_codes
            
            passed = correct_patient_count and correct_obs_count and has_hr and has_glucose
            
            self.results.append(VerificationResult(
                test_name="_revinclude: Patient with observations",
                query=f"Patient?_id={patient_id}&_revinclude=Observation:patient",
                passed=passed,
                message=f"Found: {resource_counts}, Obs codes: {observation_codes}",
                expected="1 Patient, 2 Observations (8867-4, 2339-0)",
                actual=resource_counts
            ))
        else:
            self.results.append(VerificationResult(
                test_name="_revinclude: Patient with observations",
                query=f"Patient?_id={patient_id}&_revinclude=Observation:patient",
                passed=False,
                message=f"Search failed with status {result['status']}"
            ))
    
    async def verify_everything_operation(self):
        """Verify $everything returns all related resources"""
        print("\n=== Verifying $everything Operation ===")
        
        if not self.test_data.get('patient_with_smith'):
            print("Skipping $everything test - no patient created")
            return
        
        patient_id = self.test_data['patient_with_smith']['id']
        
        # Test Patient/$everything
        try:
            async with self.session.get(f"{BASE_URL}/Patient/{patient_id}/$everything") as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    
                    resource_types = {}
                    for entry in bundle.get('entry', []):
                        resource_type = entry.get('resource', {}).get('resourceType', '')
                        if resource_type not in resource_types:
                            resource_types[resource_type] = 0
                        resource_types[resource_type] += 1
                    
                    # Should include Patient, Observations, MedicationRequest, Practitioner, etc.
                    expected_types = {'Patient', 'Observation', 'MedicationRequest'}
                    found_types = set(resource_types.keys())
                    missing_types = expected_types - found_types
                    
                    passed = len(missing_types) == 0
                    
                    self.results.append(VerificationResult(
                        test_name="$everything operation",
                        query=f"Patient/{patient_id}/$everything",
                        passed=passed,
                        message=f"Resource types: {resource_types}",
                        expected=f"At least: {expected_types}",
                        actual=found_types,
                        details={'missing': list(missing_types)}
                    ))
                else:
                    self.results.append(VerificationResult(
                        test_name="$everything operation",
                        query=f"Patient/{patient_id}/$everything",
                        passed=False,
                        message=f"Failed with status {resp.status}"
                    ))
        except Exception as e:
            self.results.append(VerificationResult(
                test_name="$everything operation",
                query=f"Patient/{patient_id}/$everything",
                passed=False,
                message=f"Error: {str(e)}"
            ))
    
    def print_results(self):
        """Print verification results"""
        print("\n" + "="*80)
        print("FHIR API RESULT VERIFICATION REPORT")
        print("="*80)
        
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        
        print(f"\nTotal Tests: {total}")
        print(f"Passed: {passed} ({passed/total*100:.1f}%)")
        print(f"Failed: {total-passed} ({(total-passed)/total*100:.1f}%)")
        
        print("\n" + "-"*80)
        print("DETAILED RESULTS:")
        print("-"*80)
        
        for result in self.results:
            status = "✅ PASS" if result.passed else "❌ FAIL"
            print(f"\n{status} {result.test_name}")
            print(f"Query: {result.query}")
            print(f"Message: {result.message}")
            if result.expected:
                print(f"Expected: {result.expected}")
            if result.actual:
                print(f"Actual: {result.actual}")
            if result.details:
                print(f"Details: {result.details}")
        
        print("\n" + "="*80)
        print("SUMMARY OF FINDINGS:")
        print("="*80)
        
        # Analyze results
        findings = []
        
        for result in self.results:
            if not result.passed:
                if "Chained search" in result.test_name:
                    findings.append("❌ Chained searches may not be filtering correctly")
                elif "_has" in result.test_name:
                    findings.append("❌ _has parameter may not be filtering correctly")
                elif "Composite" in result.test_name:
                    findings.append("❌ Composite searches may not be parsing values correctly")
                elif "_include" in result.test_name:
                    findings.append("❌ _include may not be returning referenced resources")
                elif "_revinclude" in result.test_name:
                    findings.append("❌ _revinclude may not be returning referencing resources")
                elif "$everything" in result.test_name:
                    findings.append("❌ $everything not returning all related resources")
        
        if not findings:
            findings.append("✅ All tested features are working correctly!")
        
        for finding in set(findings):
            print(f"\n{finding}")
        
        print("\n" + "="*80)
    
    async def run_verification(self):
        """Run all verification tests"""
        await self.setup_test_data()
        
        await self.verify_chained_search()
        await self.verify_has_parameter()
        await self.verify_composite_search()
        await self.verify_include_operations()
        await self.verify_revinclude_operations()
        await self.verify_everything_operation()
        
        self.print_results()


async def main():
    print("FHIR API Result Verification")
    print("="*80)
    print("This test verifies that FHIR searches return the correct data,")
    print("not just a successful HTTP status.")
    print("="*80)
    
    async with FHIRResultVerifier() as verifier:
        await verifier.run_verification()


if __name__ == "__main__":
    asyncio.run(main())