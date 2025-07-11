#!/usr/bin/env python3
"""
CDS Hooks Integration Test Suite
Tests Clinical Decision Support hooks with FHIR data
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import random

class CDSHooksIntegrationTest:
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
            
    async def test_cds_discovery(self):
        """Test CDS Hooks discovery endpoint"""
        print("\n🔍 Testing CDS Hooks Discovery...")
        start_time = time.time()
        
        try:
            async with self.session.get(f"{self.base_url}/cds-services") as response:
                if response.status == 200:
                    services = await response.json()
                    service_count = len(services.get("services", []))
                    self.log_test(
                        "CDS Discovery Endpoint",
                        True,
                        f"Found {service_count} CDS services",
                        time.time() - start_time
                    )
                    
                    # Log discovered services
                    for service in services.get("services", []):
                        print(f"   - {service.get('id')}: {service.get('title')}")
                else:
                    self.log_test(
                        "CDS Discovery Endpoint",
                        False,
                        f"HTTP {response.status}",
                        time.time() - start_time
                    )
        except Exception as e:
            self.log_test(
                "CDS Discovery Endpoint",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
    async def test_patient_view_hook(self):
        """Test patient-view hook"""
        print("\n👤 Testing Patient View Hook...")
        start_time = time.time()
        
        # Prepare hook context
        hook_request = {
            "hookInstance": "test-patient-view-001",
            "fhirServer": self.base_url,
            "hook": "patient-view",
            "fhirAuthorization": {
                "access_token": self.auth_token,
                "token_type": "Bearer",
                "scope": "patient/*.read"
            },
            "context": {
                "userId": "Practitioner/example",
                "patientId": self.patient_id
            }
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/cds-services/patient-view-hook",
                json=hook_request,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    cards = result.get("cards", [])
                    self.log_test(
                        "Patient View Hook",
                        True,
                        f"Received {len(cards)} card(s)",
                        time.time() - start_time
                    )
                    
                    # Display cards
                    for i, card in enumerate(cards):
                        print(f"   Card {i+1}: {card.get('summary')}")
                        print(f"   Indicator: {card.get('indicator', 'info')}")
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Patient View Hook",
                        False,
                        f"HTTP {response.status}: {error_text}",
                        time.time() - start_time
                    )
        except Exception as e:
            self.log_test(
                "Patient View Hook",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
    async def test_medication_prescribe_hook(self):
        """Test medication-prescribe hook"""
        print("\n💊 Testing Medication Prescribe Hook...")
        start_time = time.time()
        
        # Create a draft medication request
        draft_medication = {
            "resourceType": "MedicationRequest",
            "status": "draft",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "7980",  # Penicillin
                    "display": "Penicillin"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "dosageInstruction": [{
                "text": "Take 1 tablet by mouth three times daily"
            }]
        }
        
        # Prepare hook context
        hook_request = {
            "hookInstance": "test-med-prescribe-001",
            "fhirServer": self.base_url,
            "hook": "medication-prescribe",
            "fhirAuthorization": {
                "access_token": self.auth_token,
                "token_type": "Bearer",
                "scope": "patient/*.read"
            },
            "context": {
                "userId": "Practitioner/example",
                "patientId": self.patient_id,
                "medications": [draft_medication]
            }
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/cds-services/allergy-check",
                json=hook_request,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    cards = result.get("cards", [])
                    self.log_test(
                        "Medication Prescribe Hook",
                        True,
                        f"Received {len(cards)} card(s)",
                        time.time() - start_time
                    )
                    
                    # Check for allergy warnings
                    warning_cards = [c for c in cards if c.get("indicator") in ["warning", "critical"]]
                    if warning_cards:
                        print(f"   ⚠️ Found {len(warning_cards)} warning(s)")
                        for card in warning_cards:
                            print(f"      - {card.get('summary')}")
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Medication Prescribe Hook",
                        False,
                        f"HTTP {response.status}: {error_text}",
                        time.time() - start_time
                    )
        except Exception as e:
            self.log_test(
                "Medication Prescribe Hook",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
    async def test_order_select_hook(self):
        """Test order-select hook"""
        print("\n📋 Testing Order Select Hook...")
        start_time = time.time()
        
        # Create draft lab orders
        draft_orders = [{
            "resourceType": "ServiceRequest",
            "status": "draft",
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
                    "code": "2947-0",
                    "display": "Sodium [Moles/volume] in Blood"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            }
        }]
        
        # Prepare hook context
        hook_request = {
            "hookInstance": "test-order-select-001",
            "fhirServer": self.base_url,
            "hook": "order-select",
            "fhirAuthorization": {
                "access_token": self.auth_token,
                "token_type": "Bearer",
                "scope": "patient/*.read"
            },
            "context": {
                "userId": "Practitioner/example",
                "patientId": self.patient_id,
                "draftOrders": draft_orders
            }
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/cds-services/order-select-hook",
                json=hook_request,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    cards = result.get("cards", [])
                    self.log_test(
                        "Order Select Hook",
                        True,
                        f"Received {len(cards)} card(s)",
                        time.time() - start_time
                    )
                    
                    # Display recommendations
                    for card in cards:
                        if card.get("suggestions"):
                            print(f"   📌 {card.get('summary')}")
                            for suggestion in card.get("suggestions", []):
                                print(f"      - {suggestion.get('label')}")
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Order Select Hook",
                        False,
                        f"HTTP {response.status}: {error_text}",
                        time.time() - start_time
                    )
        except Exception as e:
            self.log_test(
                "Order Select Hook",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
    async def test_hook_with_prefetch(self):
        """Test CDS hook with prefetch data"""
        print("\n🔄 Testing Hook with Prefetch...")
        start_time = time.time()
        
        # Get patient data for prefetch
        prefetch_data = {}
        try:
            # Fetch patient
            async with self.session.get(f"{self.base_url}/fhir/R4/Patient/{self.patient_id}") as response:
                if response.status == 200:
                    prefetch_data["patient"] = await response.json()
                    
            # Fetch conditions
            async with self.session.get(
                f"{self.base_url}/fhir/R4/Condition",
                params={"patient": self.patient_id}
            ) as response:
                if response.status == 200:
                    prefetch_data["conditions"] = await response.json()
        except Exception as e:
            print(f"   Warning: Could not fetch prefetch data: {e}")
            
        # Prepare hook request with prefetch
        hook_request = {
            "hookInstance": "test-prefetch-001",
            "fhirServer": self.base_url,
            "hook": "patient-view",
            "fhirAuthorization": {
                "access_token": self.auth_token,
                "token_type": "Bearer",
                "scope": "patient/*.read"
            },
            "context": {
                "userId": "Practitioner/example",
                "patientId": self.patient_id
            },
            "prefetch": prefetch_data
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/cds-services/patient-view-hook",
                json=hook_request,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    cards = result.get("cards", [])
                    self.log_test(
                        "Hook with Prefetch",
                        True,
                        f"Received {len(cards)} card(s) using prefetch data",
                        time.time() - start_time
                    )
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Hook with Prefetch",
                        False,
                        f"HTTP {response.status}: {error_text}",
                        time.time() - start_time
                    )
        except Exception as e:
            self.log_test(
                "Hook with Prefetch",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
    async def test_custom_cds_rule_creation(self):
        """Test creating a custom CDS rule"""
        print("\n➕ Testing Custom CDS Rule Creation...")
        start_time = time.time()
        
        # Create a custom hook
        custom_hook = {
            "id": "test-custom-diabetes-check",
            "title": "Diabetes Screening Reminder",
            "description": "Reminds providers to screen for diabetes in at-risk patients",
            "hook": "patient-view",
            "prefetch": {
                "patient": "Patient/{{context.patientId}}",
                "conditions": "Condition?patient={{context.patientId}}"
            },
            "conditions": [
                {
                    "type": "age",
                    "operator": "greater_than",
                    "value": 45
                },
                {
                    "type": "condition_absent",
                    "codes": ["73211009"]  # Diabetes mellitus SNOMED code
                }
            ],
            "cards": [
                {
                    "summary": "Consider diabetes screening",
                    "detail": "Patient is over 45 and has no diabetes diagnosis on record",
                    "indicator": "warning",
                    "source": {
                        "label": "ADA Guidelines",
                        "url": "https://diabetes.org/diabetes/a1c/diagnosis"
                    }
                }
            ]
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/api/cds-hooks/hooks",
                json=custom_hook,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status in [200, 201]:
                    created_hook = await response.json()
                    hook_id = created_hook.get("id", custom_hook["id"])
                    self.log_test(
                        "Create Custom CDS Rule",
                        True,
                        f"Created hook: {hook_id}",
                        time.time() - start_time
                    )
                    
                    # Test the custom hook
                    await self._test_custom_hook(hook_id)
                    
                    # Cleanup - delete the custom hook
                    try:
                        async with self.session.delete(
                            f"{self.base_url}/api/cds-hooks/hooks/{hook_id}"
                        ) as delete_response:
                            if delete_response.status == 204:
                                print(f"   Cleaned up custom hook: {hook_id}")
                    except:
                        pass
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Create Custom CDS Rule",
                        False,
                        f"HTTP {response.status}: {error_text}",
                        time.time() - start_time
                    )
        except Exception as e:
            self.log_test(
                "Create Custom CDS Rule",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
    async def _test_custom_hook(self, hook_id: str):
        """Test a custom hook"""
        start_time = time.time()
        
        hook_request = {
            "hookInstance": f"test-{hook_id}",
            "fhirServer": self.base_url,
            "hook": "patient-view",
            "context": {
                "userId": "Practitioner/example",
                "patientId": self.patient_id
            }
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/cds-services/{hook_id}",
                json=hook_request,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    cards = result.get("cards", [])
                    self.log_test(
                        "Test Custom Hook",
                        True,
                        f"Custom hook returned {len(cards)} card(s)",
                        time.time() - start_time
                    )
                else:
                    self.log_test(
                        "Test Custom Hook",
                        False,
                        f"HTTP {response.status}",
                        time.time() - start_time
                    )
        except Exception as e:
            self.log_test(
                "Test Custom Hook",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 CDS HOOKS INTEGRATION TEST SUMMARY")
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
    """Run all CDS Hooks integration tests"""
    print("🏥 MedGenEMR CDS Hooks Integration Testing")
    print("="*60)
    
    tester = CDSHooksIntegrationTest()
    
    # Setup
    if not await tester.setup():
        print("❌ Failed to setup test environment")
        return
        
    # Run all tests
    try:
        await tester.test_cds_discovery()
        await tester.test_patient_view_hook()
        await tester.test_medication_prescribe_hook()
        await tester.test_order_select_hook()
        await tester.test_hook_with_prefetch()
        await tester.test_custom_cds_rule_creation()
    finally:
        # Cleanup
        await tester.teardown()
        
    # Print summary
    tester.print_summary()

if __name__ == "__main__":
    asyncio.run(main())