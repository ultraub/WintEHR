#!/usr/bin/env python3
import requests
import json

# Test the hook directly
url = "http://localhost:8000/cds-hooks/patient-reminder"
payload = {
    "hook": "patient-view",
    "hookInstance": "test-debug",
    "context": {
        "patientId": "b47dba3f-d775-84e6-3160-663fcea0f795",
        "userId": "test-user"
    }
}

print("Testing CDS hook...")
print(f"URL: {url}")
print(f"Payload: {json.dumps(payload, indent=2)}")

response = requests.post(url, json=payload)
print(f"\nStatus: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

# Also get the patient to verify
patient_url = "http://localhost:8000/fhir/R4/Patient/b47dba3f-d775-84e6-3160-663fcea0f795"
patient_response = requests.get(patient_url)
if patient_response.status_code == 200:
    patient = patient_response.json()
    print(f"\nPatient birthDate: {patient.get('birthDate')}")
    print(f"Patient name: {patient.get('name', [{}])[0].get('given', [])} {patient.get('name', [{}])[0].get('family')}")