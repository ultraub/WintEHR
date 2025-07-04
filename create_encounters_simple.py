#!/usr/bin/env python3
"""
Create encounters and medications using individual POST requests
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/fhir/R4"

def main():
    # Get first patient
    response = requests.get(f"{BASE_URL}/Patient?_count=1")
    if response.status_code != 200 or response.json().get('total', 0) == 0:
        print("No patients found")
        return
    
    patient = response.json()['entry'][0]['resource']
    patient_id = patient['id']
    patient_name = f"{patient['name'][0]['given'][0]} {patient['name'][0]['family']}"
    
    print(f"Creating resources for: {patient_name} (ID: {patient_id})")
    
    # Test a simple encounter first
    print("\n1. Testing simplified encounter creation...")
    encounter = {
        "resourceType": "Encounter",
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "AMB"
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        }
    }
    
    # Use regular json content-type
    headers = {"Content-Type": "application/json"}
    response = requests.post(f"{BASE_URL}/Encounter", json=encounter, headers=headers)
    
    print(f"Response status: {response.status_code}")
    if response.status_code not in [200, 201]:
        print(f"Response: {response.text}")
    else:
        print("✅ Basic encounter created successfully!")

if __name__ == "__main__":
    main()