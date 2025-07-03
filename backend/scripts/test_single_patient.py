#!/usr/bin/env python3
"""
Test importing a single Synthea patient to debug the import process
"""

import json
import asyncio
import httpx

async def test_patient_import():
    """Test importing just the patient resource from a Synthea bundle"""
    
    # Load the bundle
    with open('synthea/output/fhir/Alexander630_Davis923_489827e3-ec23-57bf-3b56-10a206ebf745.json', 'r') as f:
        bundle = json.load(f)
    
    print(f"Bundle has {len(bundle['entry'])} entries")
    
    # Find and extract the patient
    patient = None
    for entry in bundle['entry']:
        if entry['resource']['resourceType'] == 'Patient':
            patient = entry['resource']
            break
    
    if not patient:
        print("❌ No patient found in bundle")
        return
    
    print(f"✅ Found patient: {patient['name'][0]['given'][0]} {patient['name'][0]['family']}")
    print(f"   ID: {patient['id']}")
    print(f"   Birth Date: {patient['birthDate']}")
    print(f"   Gender: {patient['gender']}")
    
    # Try to post the patient
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/fhir/R4/Patient",
                json=patient,
                timeout=30.0
            )
            
            print(f"Response status: {response.status_code}")
            if response.status_code in [200, 201]:
                print("✅ Patient created successfully!")
                location = response.headers.get('location', 'Unknown')
                print(f"   Location: {location}")
            else:
                print(f"❌ Error creating patient:")
                print(f"   Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text}")
                    
        except Exception as e:
            print(f"❌ Exception: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_patient_import())