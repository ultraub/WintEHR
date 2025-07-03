#!/usr/bin/env python3
"""
Test importing a single encounter to debug validation issues
"""

import json
import asyncio
import httpx

async def test_encounter_import():
    """Test importing just one encounter resource from a Synthea bundle"""
    
    # Load the bundle
    with open('synthea/output/fhir/Alexander630_Davis923_489827e3-ec23-57bf-3b56-10a206ebf745.json', 'r') as f:
        bundle = json.load(f)
    
    print(f"Bundle has {len(bundle['entry'])} entries")
    
    # Find and extract the first encounter
    encounter = None
    for entry in bundle['entry']:
        if entry['resource']['resourceType'] == 'Encounter':
            encounter = entry['resource']
            break
    
    if not encounter:
        print("❌ No encounter found in bundle")
        return
    
    print(f"✅ Found encounter: {encounter['id']}")
    print(f"   Class: {encounter.get('class', 'Unknown')}")
    print(f"   Status: {encounter.get('status', 'Unknown')}")
    print(f"   Subject: {encounter.get('subject', {}).get('reference', 'Unknown')}")
    
    # Try to post the encounter
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/fhir/R4/Encounter",
                json=encounter,
                timeout=30.0
            )
            
            print(f"Response status: {response.status_code}")
            if response.status_code in [200, 201]:
                print("✅ Encounter created successfully!")
                location = response.headers.get('location', 'Unknown')
                print(f"   Location: {location}")
            else:
                print(f"❌ Error creating encounter:")
                print(f"   Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text}")
                    
        except Exception as e:
            print(f"❌ Exception: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_encounter_import())