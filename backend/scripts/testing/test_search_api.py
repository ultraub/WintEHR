#!/usr/bin/env python3
"""
Test search parameter extraction using the actual FHIR API.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

async def test_via_api():
    """Test search parameters using the FHIR API."""
    
    BASE_URL = "http://localhost:8000/fhir/R4"
    
    print("🔍 Testing Search Parameter Extraction via FHIR API")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        try:
            # Step 1: Create a test patient via API
            print("\n📋 Step 1: Creating test patient via API...")
            test_patient = {
                "resourceType": "Patient",
                "identifier": [{
                    "system": "http://example.org/test",
                    "value": f"TEST-API-{datetime.now().isoformat()}"
                }],
                "name": [{
                    "family": "TestAPI",
                    "given": ["Search"]
                }],
                "gender": "male",
                "birthDate": "1985-05-15"
            }
            
            async with session.post(f"{BASE_URL}/Patient", json=test_patient) as resp:
                if resp.status in [200, 201]:
                    patient_result = await resp.json()
                    patient_id = patient_result.get('id')
                    print(f"✅ Created patient with ID: {patient_id}")
                else:
                    print(f"❌ Failed to create patient: {resp.status}")
                    return
            
            # Step 2: Create a condition referencing this patient
            print("\n📋 Step 2: Creating condition via API...")
            test_condition = {
                "resourceType": "Condition",
                "clinicalStatus": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active"
                    }]
                },
                "code": {
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "44054006",
                        "display": "Diabetes mellitus type 2"
                    }]
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                },
                "onsetDateTime": "2021-01-01T00:00:00Z"
            }
            
            async with session.post(f"{BASE_URL}/Condition", json=test_condition) as resp:
                if resp.status in [200, 201]:
                    condition_result = await resp.json()
                    condition_id = condition_result.get('id')
                    print(f"✅ Created condition with ID: {condition_id}")
                else:
                    print(f"❌ Failed to create condition: {resp.status}")
                    text = await resp.text()
                    print(f"   Response: {text}")
                    return
            
            # Step 3: Test searching for conditions by patient
            print("\n📋 Step 3: Testing search by patient...")
            
            # Wait a moment for indexing
            await asyncio.sleep(1)
            
            # Search using patient parameter
            search_url = f"{BASE_URL}/Condition?patient={patient_id}"
            print(f"   Searching: {search_url}")
            
            async with session.get(search_url) as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    total = bundle.get('total', 0)
                    print(f"✅ Search returned {total} results")
                    
                    if total > 0:
                        print("✅ SUCCESS: Search parameters are working!")
                        print("   The condition was found using patient search parameter.")
                        
                        # Show the first result
                        if bundle.get('entry'):
                            found_condition = bundle['entry'][0]['resource']
                            print(f"   Found condition: {found_condition.get('code', {}).get('coding', [{}])[0].get('display', 'Unknown')}")
                    else:
                        print("❌ FAILURE: Search returned no results!")
                        print("   Search parameters may not be indexed properly.")
                else:
                    print(f"❌ Search failed with status: {resp.status}")
                    text = await resp.text()
                    print(f"   Response: {text}")
            
            # Step 4: Try alternative search approaches
            print("\n📋 Step 4: Testing alternative search approaches...")
            
            # Try with subject parameter
            subject_url = f"{BASE_URL}/Condition?subject={patient_id}"
            print(f"   Trying subject parameter: {subject_url}")
            
            async with session.get(subject_url) as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    total = bundle.get('total', 0)
                    print(f"   Subject search returned {total} results")
            
            # Try with full reference
            ref_url = f"{BASE_URL}/Condition?subject=Patient/{patient_id}"
            print(f"   Trying full reference: {ref_url}")
            
            async with session.get(ref_url) as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    total = bundle.get('total', 0)
                    print(f"   Full reference search returned {total} results")
            
            # Step 5: Clean up
            print("\n🧹 Cleaning up test data...")
            
            # Delete condition
            async with session.delete(f"{BASE_URL}/Condition/{condition_id}") as resp:
                if resp.status in [200, 204]:
                    print("✅ Deleted test condition")
            
            # Delete patient
            async with session.delete(f"{BASE_URL}/Patient/{patient_id}") as resp:
                if resp.status in [200, 204]:
                    print("✅ Deleted test patient")
            
            print("\n✅ API test completed!")
            
        except Exception as e:
            print(f"\n❌ Error during API test: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_via_api())