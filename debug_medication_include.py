#!/usr/bin/env python3
"""
Debug why Medication resources aren't being included with _include
"""

import asyncio
import aiohttp
import json

BASE_URL = "http://localhost:8000/fhir/R4"


async def debug_medication_include():
    async with aiohttp.ClientSession() as session:
        print("=== Debugging Medication _include ===\n")
        
        # Step 1: Get a MedicationRequest with medicationReference
        print("Step 1: Finding MedicationRequests with medicationReference...")
        async with session.get(f"{BASE_URL}/MedicationRequest?_count=5") as resp:
            if resp.status == 200:
                data = await resp.json()
                
                # Find one with medicationReference
                med_req_with_ref = None
                medication_ref = None
                
                for entry in data.get('entry', []):
                    resource = entry.get('resource', {})
                    if resource.get('medicationReference'):
                        med_req_with_ref = resource
                        medication_ref = resource['medicationReference']['reference']
                        break
                
                if med_req_with_ref:
                    print(f"Found MedicationRequest: {med_req_with_ref.get('id')}")
                    print(f"medicationReference: {medication_ref}")
                    
                    # Step 2: Try to fetch the referenced Medication directly
                    print(f"\nStep 2: Trying to fetch the Medication directly...")
                    
                    # Extract ID from reference
                    if medication_ref.startswith('urn:uuid:'):
                        med_id = medication_ref.replace('urn:uuid:', '')
                        # Try fetching as urn:uuid ID
                        print(f"  Trying: GET /Medication/{med_id}")
                        async with session.get(f"{BASE_URL}/Medication/{med_id}") as med_resp:
                            print(f"  Result: {med_resp.status}")
                            if med_resp.status == 200:
                                med_data = await med_resp.json()
                                print(f"  SUCCESS: Found Medication with ID {med_id}")
                            else:
                                print(f"  FAILED: Could not fetch Medication/{med_id}")
                    elif '/' in medication_ref:
                        parts = medication_ref.split('/', 1)
                        resource_type, med_id = parts
                        print(f"  Trying: GET /{resource_type}/{med_id}")
                        async with session.get(f"{BASE_URL}/{resource_type}/{med_id}") as med_resp:
                            print(f"  Result: {med_resp.status}")
                    
                    # Step 3: Search for the Medication by ID
                    print(f"\nStep 3: Searching for Medication by ID...")
                    print(f"  Trying: GET /Medication?_id={med_id}")
                    async with session.get(f"{BASE_URL}/Medication", params={"_id": med_id}) as search_resp:
                        print(f"  Result: {search_resp.status}")
                        if search_resp.status == 200:
                            search_data = await search_resp.json()
                            total = search_data.get('total', 0)
                            print(f"  Found {total} Medication(s)")
                    
                    # Step 4: Try _include with specific MedicationRequest
                    print(f"\nStep 4: Testing _include with this specific MedicationRequest...")
                    med_req_id = med_req_with_ref.get('id')
                    
                    params = {
                        "_id": med_req_id,
                        "_include": "MedicationRequest:medication"
                    }
                    
                    async with session.get(f"{BASE_URL}/MedicationRequest", params=params) as include_resp:
                        print(f"  Query: MedicationRequest?_id={med_req_id}&_include=MedicationRequest:medication")
                        print(f"  Result: {include_resp.status}")
                        
                        if include_resp.status == 200:
                            include_data = await include_resp.json()
                            entries = include_data.get('entry', [])
                            
                            print(f"  Total entries: {len(entries)}")
                            
                            for entry in entries:
                                resource = entry.get('resource', {})
                                resource_type = resource.get('resourceType')
                                search_mode = entry.get('search', {}).get('mode', 'not-specified')
                                print(f"    - {resource_type} (mode={search_mode})")
                                
                                if resource_type == 'Medication':
                                    print(f"      SUCCESS: Medication included!")
                                    print(f"      Medication ID: {resource.get('id')}")
                else:
                    print("No MedicationRequest with medicationReference found in the first 5 results")
        
        # Step 5: Check if there are any Medications in the database
        print(f"\nStep 5: Checking if Medications exist in database...")
        async with session.get(f"{BASE_URL}/Medication?_count=5") as resp:
            if resp.status == 200:
                data = await resp.json()
                total = data.get('total', 0)
                print(f"Total Medications in database: {total}")
                
                if total > 0:
                    print("\nFirst few Medication IDs:")
                    for entry in data.get('entry', [])[:3]:
                        med = entry.get('resource', {})
                        print(f"  - {med.get('id')}")


async def main():
    await debug_medication_include()


if __name__ == "__main__":
    asyncio.run(main())