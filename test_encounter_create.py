#!/usr/bin/env python3

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/fhir/R4"

# Simple encounter - class should be a Coding, not a CodeableConcept
encounter = {
    "resourceType": "Encounter",
    "status": "finished",
    "class": {
        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        "code": "AMB",
        "display": "ambulatory"
    },
    "subject": {
        "reference": "Patient/c092006e-bed0-b9af-1817-eb56abbabf8a"
    },
    "period": {
        "start": datetime.now().isoformat() + "Z"
    }
}

print("Testing minimal encounter:")
print(json.dumps(encounter, indent=2))

resp = requests.post(f"{BASE_URL}/Encounter", json=encounter)
print(f"\nStatus: {resp.status_code}")
if resp.status_code != 201:
    print(f"Response: {resp.text}")
    
    # Try to understand the error
    try:
        error = resp.json()
        if 'issue' in error:
            for issue in error['issue']:
                print(f"\nIssue: {issue.get('severity')}")
                print(f"Details: {issue.get('details', {}).get('text')}")
    except:
        pass