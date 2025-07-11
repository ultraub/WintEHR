#!/usr/bin/env python3
"""
Clinical Workspace Integration Test Suite
Tests all FHIR operations through the Clinical Workspace tabs
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import random

class ClinicalWorkspaceTest:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.test_results: List[Dict] = []
        self.patient_id: Optional[str] = None
        self.auth_token: Optional[str] = None
        
    async def setup(self):
        """Setup test session and authenticate"""
        self.session = aiohttp.ClientSession()
        
        # Login first
        try:
            auth_data = {
                "username": "demo",
                "password": "password"
            }
            async with self.session.post(
                f"{self.base_url}/api/auth/login",
                json=auth_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    self.auth_token = result.get("access_token")
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}"
                    })
                    print("✅ Authentication successful")
                else:
                    print(f"❌ Authentication failed: {response.status}")
                    return False
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
            
        # Get a test patient
        try:
            async with self.session.get(f"{self.base_url}/fhir/R4/Patient?_count=1") as response:
                if response.status == 200:
                    bundle = await response.json()
                    if bundle.get("entry"):
                        self.patient_id = bundle["entry"][0]["resource"]["id"]
                        patient_name = bundle["entry"][0]["resource"].get("name", [{}])[0]
                        display_name = f"{patient_name.get('given', [''])[0]} {patient_name.get('family', '')}"
                        print(f"✅ Using test patient: {display_name} (ID: {self.patient_id})")
                        return True
        except Exception as e:
            print(f"❌ Error getting test patient: {e}")
            
        return False
        
    async def teardown(self):
        """Cleanup test session"""
        if self.session:
            await self.session.close()
            
    def log_test(self, test_name: str, passed: bool, details: str = "", duration: float = 0):
        """Log test result"""
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "duration": duration
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name} ({duration:.3f}s)")
        if details:
            print(f"   {details}")
            
    async def test_chart_review_tab(self):
        """Test Chart Review tab CRUD operations"""
        print("\n📋 Testing Chart Review Tab...")
        
        # Test Problems (Conditions)
        await self._test_condition_crud()
        
        # Test Medications
        await self._test_medication_crud()
        
        # Test Allergies
        await self._test_allergy_crud()
        
        # Test Immunizations
        await self._test_immunization_crud()
        
    async def _test_condition_crud(self):
        """Test Condition CRUD operations"""
        start_time = time.time()
        
        # Create a new condition
        condition_data = {
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
                    "code": "73211009",
                    "display": "Diabetes mellitus"
                }],
                "text": "Diabetes mellitus type 2"
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "onsetDateTime": "2024-01-15"
        }
        
        try:
            # CREATE
            async with self.session.post(
                f"{self.base_url}/fhir/R4/Condition",
                json=condition_data
            ) as response:
                if response.status == 201:
                    created_condition = await response.json()
                    condition_id = created_condition.get("id")
                    self.log_test("Create Condition", True, f"Created ID: {condition_id}", time.time() - start_time)
                    
                    # UPDATE
                    updated_data = created_condition.copy()
                    updated_data["clinicalStatus"]["coding"][0]["code"] = "resolved"
                    
                    async with self.session.put(
                        f"{self.base_url}/fhir/R4/Condition/{condition_id}",
                        json=updated_data
                    ) as update_response:
                        if update_response.status == 200:
                            self.log_test("Update Condition", True, "Status changed to resolved", time.time() - start_time)
                        else:
                            self.log_test("Update Condition", False, f"HTTP {update_response.status}", time.time() - start_time)
                    
                    # DELETE
                    async with self.session.delete(
                        f"{self.base_url}/fhir/R4/Condition/{condition_id}"
                    ) as delete_response:
                        if delete_response.status == 204:
                            self.log_test("Delete Condition", True, "Successfully deleted", time.time() - start_time)
                        else:
                            self.log_test("Delete Condition", False, f"HTTP {delete_response.status}", time.time() - start_time)
                else:
                    self.log_test("Create Condition", False, f"HTTP {response.status}", time.time() - start_time)
        except Exception as e:
            self.log_test("Condition CRUD", False, f"Error: {str(e)}", time.time() - start_time)
            
    async def _test_medication_crud(self):
        """Test MedicationRequest CRUD operations"""
        start_time = time.time()
        
        medication_request = {
            "resourceType": "MedicationRequest",
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "authoredOn": datetime.utcnow().isoformat() + "Z",
            "dosageInstruction": [{
                "text": "Take 1 tablet by mouth twice daily",
                "timing": {
                    "repeat": {
                        "frequency": 2,
                        "period": 1,
                        "periodUnit": "d"
                    }
                }
            }]
        }
        
        try:
            # CREATE
            async with self.session.post(
                f"{self.base_url}/fhir/R4/MedicationRequest",
                json=medication_request
            ) as response:
                if response.status == 201:
                    created_med = await response.json()
                    med_id = created_med.get("id")
                    self.log_test("Create MedicationRequest", True, f"Created ID: {med_id}", time.time() - start_time)
                    
                    # UPDATE (change status)
                    updated_med = created_med.copy()
                    updated_med["status"] = "completed"
                    
                    async with self.session.put(
                        f"{self.base_url}/fhir/R4/MedicationRequest/{med_id}",
                        json=updated_med
                    ) as update_response:
                        if update_response.status == 200:
                            self.log_test("Update MedicationRequest", True, "Status changed to completed", time.time() - start_time)
                        else:
                            self.log_test("Update MedicationRequest", False, f"HTTP {update_response.status}", time.time() - start_time)
                else:
                    self.log_test("Create MedicationRequest", False, f"HTTP {response.status}", time.time() - start_time)
        except Exception as e:
            self.log_test("MedicationRequest CRUD", False, f"Error: {str(e)}", time.time() - start_time)
            
    async def _test_allergy_crud(self):
        """Test AllergyIntolerance CRUD operations"""
        start_time = time.time()
        
        allergy_data = {
            "resourceType": "AllergyIntolerance",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    "code": "active"
                }]
            },
            "verificationStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                    "code": "confirmed"
                }]
            },
            "type": "allergy",
            "category": ["medication"],
            "criticality": "high",
            "code": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "7980",
                    "display": "Penicillin"
                }]
            },
            "patient": {
                "reference": f"Patient/{self.patient_id}"
            },
            "reaction": [{
                "manifestation": [{
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "39579001",
                        "display": "Anaphylaxis"
                    }]
                }],
                "severity": "severe"
            }]
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/AllergyIntolerance",
                json=allergy_data
            ) as response:
                if response.status == 201:
                    created_allergy = await response.json()
                    allergy_id = created_allergy.get("id")
                    self.log_test("Create AllergyIntolerance", True, f"Created ID: {allergy_id}", time.time() - start_time)
                else:
                    self.log_test("Create AllergyIntolerance", False, f"HTTP {response.status}", time.time() - start_time)
        except Exception as e:
            self.log_test("AllergyIntolerance CRUD", False, f"Error: {str(e)}", time.time() - start_time)
            
    async def _test_immunization_crud(self):
        """Test Immunization CRUD operations"""
        start_time = time.time()
        
        immunization_data = {
            "resourceType": "Immunization",
            "status": "completed",
            "vaccineCode": {
                "coding": [{
                    "system": "http://hl7.org/fhir/sid/cvx",
                    "code": "208",
                    "display": "COVID-19 vaccine"
                }]
            },
            "patient": {
                "reference": f"Patient/{self.patient_id}"
            },
            "occurrenceDateTime": datetime.utcnow().isoformat() + "Z",
            "primarySource": True
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/Immunization",
                json=immunization_data
            ) as response:
                if response.status == 201:
                    created_imm = await response.json()
                    imm_id = created_imm.get("id")
                    self.log_test("Create Immunization", True, f"Created ID: {imm_id}", time.time() - start_time)
                else:
                    self.log_test("Create Immunization", False, f"HTTP {response.status}", time.time() - start_time)
        except Exception as e:
            self.log_test("Immunization CRUD", False, f"Error: {str(e)}", time.time() - start_time)
            
    async def test_orders_tab(self):
        """Test Orders tab functionality"""
        print("\n📝 Testing Orders Tab...")
        
        # Create a lab order
        service_request = {
            "resourceType": "ServiceRequest",
            "status": "active",
            "intent": "order",
            "category": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "108252007",
                    "display": "Laboratory procedure"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "2951-2",
                    "display": "Sodium [Moles/volume] in Serum or Plasma"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "authoredOn": datetime.utcnow().isoformat() + "Z",
            "priority": "routine"
        }
        
        start_time = time.time()
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/ServiceRequest",
                json=service_request
            ) as response:
                if response.status == 201:
                    created_order = await response.json()
                    order_id = created_order.get("id")
                    self.log_test("Create Lab Order", True, f"Created ID: {order_id}", time.time() - start_time)
                    
                    # Simulate order completion
                    updated_order = created_order.copy()
                    updated_order["status"] = "completed"
                    
                    async with self.session.put(
                        f"{self.base_url}/fhir/R4/ServiceRequest/{order_id}",
                        json=updated_order
                    ) as update_response:
                        if update_response.status == 200:
                            self.log_test("Complete Lab Order", True, "Order marked as completed", time.time() - start_time)
                        else:
                            self.log_test("Complete Lab Order", False, f"HTTP {update_response.status}", time.time() - start_time)
                else:
                    self.log_test("Create Lab Order", False, f"HTTP {response.status}", time.time() - start_time)
        except Exception as e:
            self.log_test("Orders Tab", False, f"Error: {str(e)}", time.time() - start_time)
            
    async def test_results_tab(self):
        """Test Results tab functionality"""
        print("\n📊 Testing Results Tab...")
        
        # Create lab result observation
        observation_data = {
            "resourceType": "Observation",
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "laboratory",
                    "display": "Laboratory"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "2951-2",
                    "display": "Sodium [Moles/volume] in Serum or Plasma"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "effectiveDateTime": datetime.utcnow().isoformat() + "Z",
            "valueQuantity": {
                "value": 142,
                "unit": "mmol/L",
                "system": "http://unitsofmeasure.org"
            },
            "referenceRange": [{
                "low": {
                    "value": 136,
                    "unit": "mmol/L"
                },
                "high": {
                    "value": 145,
                    "unit": "mmol/L"
                }
            }]
        }
        
        start_time = time.time()
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/Observation",
                json=observation_data
            ) as response:
                if response.status == 201:
                    created_obs = await response.json()
                    obs_id = created_obs.get("id")
                    self.log_test("Create Lab Result", True, f"Created ID: {obs_id}", time.time() - start_time)
                    
                    # Test searching for lab results
                    async with self.session.get(
                        f"{self.base_url}/fhir/R4/Observation",
                        params={
                            "patient": self.patient_id,
                            "category": "laboratory",
                            "_sort": "-date"
                        }
                    ) as search_response:
                        if search_response.status == 200:
                            bundle = await search_response.json()
                            count = len(bundle.get("entry", []))
                            self.log_test("Search Lab Results", True, f"Found {count} results", time.time() - start_time)
                        else:
                            self.log_test("Search Lab Results", False, f"HTTP {search_response.status}", time.time() - start_time)
                else:
                    self.log_test("Create Lab Result", False, f"HTTP {response.status}", time.time() - start_time)
        except Exception as e:
            self.log_test("Results Tab", False, f"Error: {str(e)}", time.time() - start_time)
            
    async def test_pharmacy_tab(self):
        """Test Pharmacy tab workflow"""
        print("\n💊 Testing Pharmacy Tab...")
        
        # Create a prescription to dispense
        medication_request = {
            "resourceType": "MedicationRequest",
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "197361",
                    "display": "Lisinopril 10 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "authoredOn": datetime.utcnow().isoformat() + "Z",
            "dispenseRequest": {
                "quantity": {
                    "value": 30,
                    "unit": "tablets"
                },
                "daysSupply": {
                    "value": 30,
                    "unit": "days"
                }
            }
        }
        
        start_time = time.time()
        try:
            # Create prescription
            async with self.session.post(
                f"{self.base_url}/fhir/R4/MedicationRequest",
                json=medication_request
            ) as response:
                if response.status == 201:
                    created_rx = await response.json()
                    rx_id = created_rx.get("id")
                    self.log_test("Create Prescription", True, f"Created ID: {rx_id}", time.time() - start_time)
                    
                    # Create dispense record
                    medication_dispense = {
                        "resourceType": "MedicationDispense",
                        "status": "completed",
                        "medicationCodeableConcept": medication_request["medicationCodeableConcept"],
                        "subject": {
                            "reference": f"Patient/{self.patient_id}"
                        },
                        "authorizingPrescription": [{
                            "reference": f"MedicationRequest/{rx_id}"
                        }],
                        "quantity": {
                            "value": 30,
                            "unit": "tablets"
                        },
                        "daysSupply": {
                            "value": 30,
                            "unit": "days"
                        },
                        "whenHandedOver": datetime.utcnow().isoformat() + "Z"
                    }
                    
                    async with self.session.post(
                        f"{self.base_url}/fhir/R4/MedicationDispense",
                        json=medication_dispense
                    ) as dispense_response:
                        if dispense_response.status == 201:
                            self.log_test("Dispense Medication", True, "Medication dispensed", time.time() - start_time)
                        else:
                            self.log_test("Dispense Medication", False, f"HTTP {dispense_response.status}", time.time() - start_time)
                else:
                    self.log_test("Create Prescription", False, f"HTTP {response.status}", time.time() - start_time)
        except Exception as e:
            self.log_test("Pharmacy Tab", False, f"Error: {str(e)}", time.time() - start_time)
            
    async def test_cross_tab_workflow(self):
        """Test cross-tab integration workflow"""
        print("\n🔄 Testing Cross-Tab Workflow...")
        
        start_time = time.time()
        
        # Simulate order-to-result workflow
        # 1. Create an order
        service_request = {
            "resourceType": "ServiceRequest",
            "status": "active",
            "intent": "order",
            "category": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "108252007",
                    "display": "Laboratory procedure"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "2339-0",
                    "display": "Glucose [Mass/volume] in Blood"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "authoredOn": datetime.utcnow().isoformat() + "Z"
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/ServiceRequest",
                json=service_request
            ) as response:
                if response.status == 201:
                    created_order = await response.json()
                    order_id = created_order.get("id")
                    self.log_test("Workflow: Create Order", True, f"Order ID: {order_id}", time.time() - start_time)
                    
                    # 2. Create result linked to order
                    observation_data = {
                        "resourceType": "Observation",
                        "status": "final",
                        "category": [{
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "laboratory"
                            }]
                        }],
                        "code": service_request["code"],
                        "subject": {
                            "reference": f"Patient/{self.patient_id}"
                        },
                        "effectiveDateTime": datetime.utcnow().isoformat() + "Z",
                        "valueQuantity": {
                            "value": 95,
                            "unit": "mg/dL",
                            "system": "http://unitsofmeasure.org"
                        },
                        "basedOn": [{
                            "reference": f"ServiceRequest/{order_id}"
                        }]
                    }
                    
                    async with self.session.post(
                        f"{self.base_url}/fhir/R4/Observation",
                        json=observation_data
                    ) as obs_response:
                        if obs_response.status == 201:
                            created_obs = await obs_response.json()
                            obs_id = created_obs.get("id")
                            self.log_test("Workflow: Create Result", True, f"Result ID: {obs_id}", time.time() - start_time)
                            
                            # 3. Update order status
                            updated_order = created_order.copy()
                            updated_order["status"] = "completed"
                            
                            async with self.session.put(
                                f"{self.base_url}/fhir/R4/ServiceRequest/{order_id}",
                                json=updated_order
                            ) as update_response:
                                if update_response.status == 200:
                                    self.log_test("Workflow: Complete Order", True, "Order marked complete", time.time() - start_time)
                                else:
                                    self.log_test("Workflow: Complete Order", False, f"HTTP {update_response.status}", time.time() - start_time)
                        else:
                            self.log_test("Workflow: Create Result", False, f"HTTP {obs_response.status}", time.time() - start_time)
                else:
                    self.log_test("Workflow: Create Order", False, f"HTTP {response.status}", time.time() - start_time)
        except Exception as e:
            self.log_test("Cross-Tab Workflow", False, f"Error: {str(e)}", time.time() - start_time)
            
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 CLINICAL WORKSPACE TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["passed"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"   - {result['test']}: {result['details']}")
                    
        total_duration = sum(r["duration"] for r in self.test_results)
        avg_duration = total_duration / total_tests if total_tests > 0 else 0
        print(f"\nTotal Duration: {total_duration:.3f}s")
        print(f"Average Duration: {avg_duration:.3f}s per test")
        
async def main():
    """Run all clinical workspace tests"""
    print("🏥 MedGenEMR Clinical Workspace Integration Testing")
    print("="*60)
    
    tester = ClinicalWorkspaceTest()
    
    # Setup
    if not await tester.setup():
        print("❌ Failed to setup test environment")
        return
        
    # Run all tests
    try:
        await tester.test_chart_review_tab()
        await tester.test_orders_tab()
        await tester.test_results_tab()
        await tester.test_pharmacy_tab()
        await tester.test_cross_tab_workflow()
    finally:
        # Cleanup
        await tester.teardown()
        
    # Print summary
    tester.print_summary()

if __name__ == "__main__":
    asyncio.run(main())