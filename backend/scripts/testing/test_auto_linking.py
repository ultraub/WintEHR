#!/usr/bin/env python3
"""
Test script for auto-linking Observations to ServiceRequests

This script:
1. Creates a test ServiceRequest for a patient with proper LOINC code
2. Creates a test Observation for the same patient and LOINC code
3. Verifies that the Observation is automatically linked to the ServiceRequest
"""

import asyncio
import json
from datetime import datetime, timezone
import httpx
import random

# API configuration
BASE_URL = "http://localhost:8000"
FHIR_BASE = f"{BASE_URL}/fhir/R4"

# Get a real patient ID from the system
async def get_patient_id():
    """Get a real patient ID from the system"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{FHIR_BASE}/Patient?_count=1")
        if response.status_code == 200:
            bundle = response.json()
            if bundle.get('entry'):
                return bundle['entry'][0]['resource']['id']
    return None

async def create_service_request(patient_id: str, loinc_code: str, display: str):
    """Create a ServiceRequest for lab test"""
    service_request = {
        "resourceType": "ServiceRequest",
        "status": "active",
        "intent": "order",
        "priority": "routine",
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": loinc_code,
                "display": display
            }],
            "text": display
        },
        "subject": {
            "reference": f"Patient/{patient_id}",
            "type": "Patient"
        },
        "category": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "108252007",
                "display": "Laboratory procedure"
            }]
        }],
        "authoredOn": datetime.now(timezone.utc).isoformat(),
        "requester": {
            "reference": "Practitioner/test-practitioner",
            "display": "Dr. Test"
        },
        "reasonCode": [{
            "text": "Annual checkup"
        }]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{FHIR_BASE}/ServiceRequest",
            json=service_request,
            headers={"Content-Type": "application/fhir+json"}
        )
        if response.status_code == 201:
            location = response.headers.get('Location')
            sr_id = location.split('/')[-1] if location else None
            print(f"✅ Created ServiceRequest: {sr_id}")
            return sr_id
        else:
            print(f"❌ Failed to create ServiceRequest: {response.status_code}")
            print(response.text)
            return None

async def create_observation(patient_id: str, loinc_code: str, display: str, value: float, unit: str):
    """Create an Observation (lab result)"""
    observation = {
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
                "code": loinc_code,
                "display": display
            }],
            "text": display
        },
        "subject": {
            "reference": f"Patient/{patient_id}",
            "type": "Patient"
        },
        "effectiveDateTime": datetime.now(timezone.utc).isoformat(),
        "valueQuantity": {
            "value": value,
            "unit": unit,
            "system": "http://unitsofmeasure.org",
            "code": unit
        },
        "referenceRange": [{
            "low": {
                "value": 70,
                "unit": unit,
                "system": "http://unitsofmeasure.org",
                "code": unit
            },
            "high": {
                "value": 100,
                "unit": unit,
                "system": "http://unitsofmeasure.org",
                "code": unit
            }
        }]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{FHIR_BASE}/Observation",
            json=observation,
            headers={"Content-Type": "application/fhir+json"}
        )
        if response.status_code == 201:
            location = response.headers.get('Location')
            obs_id = location.split('/')[-1] if location else None
            print(f"✅ Created Observation: {obs_id}")
            return obs_id
        else:
            print(f"❌ Failed to create Observation: {response.status_code}")
            print(response.text)
            return None

async def check_observation_linked(obs_id: str):
    """Check if the Observation has a basedOn reference"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{FHIR_BASE}/Observation/{obs_id}")
        if response.status_code == 200:
            observation = response.json()
            based_on = observation.get('basedOn')
            if based_on:
                print(f"✅ Observation is linked to: {based_on[0]['reference']}")
                return True
            else:
                print("❌ Observation has no basedOn reference")
                return False
        else:
            print(f"❌ Failed to fetch Observation: {response.status_code}")
            return False

async def main():
    """Main test function"""
    print("=== Testing Auto-Linking of Observations to ServiceRequests ===\n")
    
    # Get a real patient ID
    patient_id = await get_patient_id()
    if not patient_id:
        print("❌ No patients found in the system")
        return
    
    print(f"Using patient: {patient_id}\n")
    
    # Common lab test - Glucose
    loinc_code = "2345-7"
    display = "Glucose [Mass/volume] in Serum or Plasma"
    
    # Step 1: Create ServiceRequest
    print("Step 1: Creating ServiceRequest for glucose test...")
    sr_id = await create_service_request(patient_id, loinc_code, display)
    if not sr_id:
        return
    
    # Wait a moment for the ServiceRequest to be fully processed
    await asyncio.sleep(2)
    
    # Step 2: Create Observation (lab result)
    print("\nStep 2: Creating Observation (lab result)...")
    value = round(random.uniform(80, 120), 1)
    obs_id = await create_observation(patient_id, loinc_code, display, value, "mg/dL")
    if not obs_id:
        return
    
    # Wait a moment for auto-linking to occur
    await asyncio.sleep(2)
    
    # Step 3: Check if the Observation was linked
    print("\nStep 3: Checking if Observation was auto-linked...")
    linked = await check_observation_linked(obs_id)
    
    if linked:
        print("\n✅ SUCCESS: Auto-linking is working correctly!")
        
        # Check ServiceRequest status
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{FHIR_BASE}/ServiceRequest/{sr_id}")
            if response.status_code == 200:
                sr = response.json()
                print(f"ServiceRequest status: {sr.get('status')}")
    else:
        print("\n❌ FAILURE: Auto-linking did not work")
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    asyncio.run(main())