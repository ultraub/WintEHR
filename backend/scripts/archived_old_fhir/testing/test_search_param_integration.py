#!/usr/bin/env python3
"""
Integration test for search parameter extraction.

This test creates resources via the FHIR API and verifies that search 
parameters are properly extracted, allowing searches to work correctly.

Usage:
    python scripts/test_search_param_integration.py
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
import uuid


async def test_search_param_integration():
    """Test that newly created resources get search params and are searchable."""
    
    BASE_URL = "http://localhost:8000/fhir/R4"
    
    print("🧪 Search Parameter Integration Test")
    print("=" * 60)
    
    async with aiohttp.ClientSession() as session:
        test_results = []
        
        try:
            # Test 1: Create a patient and verify it's searchable
            print("\n📋 Test 1: Patient creation and search")
            
            test_patient = {
                "resourceType": "Patient",
                "identifier": [{
                    "system": "http://test.medgenemr.com",
                    "value": f"INTEGRATION-TEST-{uuid.uuid4()}"
                }],
                "name": [{
                    "family": "IntegrationTest",
                    "given": ["SearchParam"]
                }],
                "gender": "male",
                "birthDate": "1990-01-01"
            }
            
            # Create patient
            async with session.post(f"{BASE_URL}/Patient", json=test_patient) as resp:
                if resp.status not in [200, 201]:
                    test_results.append(("Patient Creation", False, f"Failed with status {resp.status}"))
                    return test_results
                
                patient_result = await resp.json()
                patient_id = patient_result.get('id')
                print(f"✅ Created patient with ID: {patient_id}")
                test_results.append(("Patient Creation", True, f"ID: {patient_id}"))
            
            # Wait for indexing
            await asyncio.sleep(1)
            
            # Search by family name
            async with session.get(f"{BASE_URL}/Patient?family=IntegrationTest") as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    found = bundle.get('total', 0) > 0
                    test_results.append(("Patient Search by Name", found, 
                                       f"Found {bundle.get('total', 0)} patients"))
                    if found:
                        print(f"✅ Patient searchable by name")
                    else:
                        print(f"❌ Patient NOT searchable by name")
                else:
                    test_results.append(("Patient Search by Name", False, f"Status {resp.status}"))
            
            # Test 2: Create condition and verify patient reference search
            print("\n📋 Test 2: Condition with patient reference")
            
            test_condition = {
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
                    "text": "Diabetes mellitus"
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                },
                "onsetDateTime": "2023-01-01T00:00:00Z"
            }
            
            # Create condition
            async with session.post(f"{BASE_URL}/Condition", json=test_condition) as resp:
                if resp.status not in [200, 201]:
                    test_results.append(("Condition Creation", False, f"Failed with status {resp.status}"))
                else:
                    condition_result = await resp.json()
                    condition_id = condition_result.get('id')
                    print(f"✅ Created condition with ID: {condition_id}")
                    test_results.append(("Condition Creation", True, f"ID: {condition_id}"))
            
            # Wait for indexing
            await asyncio.sleep(1)
            
            # Search condition by patient - all three formats
            search_formats = [
                ("UUID only", patient_id),
                ("Resource/UUID", f"Patient/{patient_id}"),
                ("urn:uuid", f"urn:uuid:{patient_id}")
            ]
            
            for format_name, search_value in search_formats:
                async with session.get(f"{BASE_URL}/Condition?patient={search_value}") as resp:
                    if resp.status == 200:
                        bundle = await resp.json()
                        found = bundle.get('total', 0) > 0
                        test_results.append((f"Condition Search by Patient ({format_name})", found,
                                           f"Found {bundle.get('total', 0)} conditions"))
                        if found:
                            print(f"✅ Condition searchable by patient ({format_name})")
                        else:
                            print(f"❌ Condition NOT searchable by patient ({format_name})")
                    else:
                        test_results.append((f"Condition Search by Patient ({format_name})", False, 
                                           f"Status {resp.status}"))
            
            # Test 3: Create observation with multiple search params
            print("\n📋 Test 3: Observation with multiple search parameters")
            
            test_observation = {
                "resourceType": "Observation",
                "status": "final",
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "vital-signs",
                        "display": "Vital Signs"
                    }]
                }],
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "85354-9",
                        "display": "Blood pressure"
                    }]
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                },
                "effectiveDateTime": "2024-01-15T10:30:00Z",
                "component": [
                    {
                        "code": {
                            "coding": [{
                                "system": "http://loinc.org",
                                "code": "8480-6",
                                "display": "Systolic blood pressure"
                            }]
                        },
                        "valueQuantity": {
                            "value": 120,
                            "unit": "mmHg",
                            "system": "http://unitsofmeasure.org",
                            "code": "mm[Hg]"
                        }
                    }
                ]
            }
            
            # Create observation
            async with session.post(f"{BASE_URL}/Observation", json=test_observation) as resp:
                if resp.status not in [200, 201]:
                    test_results.append(("Observation Creation", False, f"Failed with status {resp.status}"))
                else:
                    obs_result = await resp.json()
                    obs_id = obs_result.get('id')
                    print(f"✅ Created observation with ID: {obs_id}")
                    test_results.append(("Observation Creation", True, f"ID: {obs_id}"))
            
            # Wait for indexing
            await asyncio.sleep(1)
            
            # Search by code
            async with session.get(f"{BASE_URL}/Observation?code=85354-9") as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    found = bundle.get('total', 0) > 0
                    test_results.append(("Observation Search by Code", found,
                                       f"Found {bundle.get('total', 0)} observations"))
                    if found:
                        print(f"✅ Observation searchable by code")
                    else:
                        print(f"❌ Observation NOT searchable by code")
            
            # Search by category
            async with session.get(f"{BASE_URL}/Observation?category=vital-signs") as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    found = bundle.get('total', 0) > 0
                    test_results.append(("Observation Search by Category", found,
                                       f"Found {bundle.get('total', 0)} observations"))
                    if found:
                        print(f"✅ Observation searchable by category")
                    else:
                        print(f"❌ Observation NOT searchable by category")
            
            # Cleanup test data
            print("\n🧹 Cleaning up test data...")
            
            # Delete created resources
            for resource_type, resource_id in [("Condition", condition_id), 
                                              ("Observation", obs_id), 
                                              ("Patient", patient_id)]:
                if resource_id:
                    async with session.delete(f"{BASE_URL}/{resource_type}/{resource_id}") as resp:
                        if resp.status in [200, 204]:
                            print(f"✅ Deleted test {resource_type}")
                        else:
                            print(f"⚠️  Failed to delete test {resource_type}")
            
        except Exception as e:
            print(f"❌ Error during test: {e}")
            test_results.append(("Test Execution", False, str(e)))
            import traceback
            traceback.print_exc()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 Test Summary:")
        print("=" * 60)
        
        passed = sum(1 for _, result, _ in test_results if result)
        total = len(test_results)
        
        for test_name, result, details in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}: {details}")
        
        print(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print("\n🎉 All tests passed! Search parameter extraction is working correctly.")
            return 0
        else:
            print("\n❌ Some tests failed. Search parameter extraction may have issues.")
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_search_param_integration())
    sys.exit(exit_code)