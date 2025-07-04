#!/usr/bin/env python3
"""
Test importing a single resource to see the exact error
"""

import requests
import json

BASE_URL = "http://localhost:8000"

# Load a patient bundle
with open("/Users/robertbarrett/Documents/MedGenEMR/backend/synthea/output/fhir/Nicholas495_Wiegand701_c092006e-bed0-b9af-1817-eb56abbabf8a.json") as f:
    bundle = json.load(f)

# Find an Encounter resource to test
encounter = None
for entry in bundle['entry']:
    if entry['resource']['resourceType'] == 'Encounter':
        encounter = entry['resource']
        break

if encounter:
    print(f"Testing Encounter import: {encounter['id']}")
    print(f"Encounter type: {encounter.get('type', [{}])[0].get('text', 'Unknown')}")
    
    # Try to import it
    response = requests.post(
        f"{BASE_URL}/fhir/R4/Encounter",
        json=encounter,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"\nStatus code: {response.status_code}")
    if response.status_code != 201:
        print(f"Response: {response.text}")
        
        # Try to parse the error
        try:
            error_data = response.json()
            if 'issue' in error_data:
                for issue in error_data['issue']:
                    print(f"\nIssue: {issue.get('severity', 'unknown')}")
                    print(f"Details: {issue.get('details', {}).get('text', 'No details')}")
                    print(f"Expression: {issue.get('expression', 'No expression')}")
        except:
            pass
else:
    print("No encounter found in bundle")