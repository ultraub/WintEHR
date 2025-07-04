#!/usr/bin/env python3
"""
Test creating resources via FHIR API
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/fhir/R4"

# Get first patient
response = requests.get(f"{BASE_URL}/Patient?_count=1")
if response.status_code != 200 or response.json().get('total', 0) == 0:
    print("No patients found")
    exit(1)

patient = response.json()['entry'][0]['resource']
patient_id = patient['id']
patient_name = f"{patient['name'][0]['given'][0]} {patient['name'][0]['family']}"

print(f"Testing with patient: {patient_name} (ID: {patient_id})")

# Test 1: Create a simple encounter
print("\n1. Testing Encounter creation...")
# Build minimal encounter that works with the validator
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

response = requests.post(f"{BASE_URL}/Encounter", json=encounter)
print(f"   Status: {response.status_code}")
if response.status_code == 201:
    print(f"   ✅ Created: {response.headers.get('Location')}")
else:
    print(f"   ❌ Error: {response.text[:200]}")

# Test 2: Create AllergyIntolerance
print("\n2. Testing AllergyIntolerance creation...")
allergy = {
    "resourceType": "AllergyIntolerance",
    "clinicalStatus": {
        "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
            "code": "active"
        }]
    },
    "verificationStatus": {
        "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
            "code": "confirmed"
        }]
    },
    "category": ["medication"],
    "criticality": "high",
    "code": {
        "text": "Penicillin"
    },
    "patient": {
        "reference": f"Patient/{patient_id}"
    }
}

response = requests.post(f"{BASE_URL}/AllergyIntolerance", json=allergy)
print(f"   Status: {response.status_code}")
if response.status_code == 201:
    print(f"   ✅ Created: {response.headers.get('Location')}")
else:
    print(f"   ❌ Error: {response.text[:200]}")

# Test 3: Create MedicationRequest
print("\n3. Testing MedicationRequest creation...")
medication = {
    "resourceType": "MedicationRequest",
    "status": "active",
    "intent": "order",
    "medicationCodeableConcept": {
        "text": "Metformin 500mg"
    },
    "subject": {
        "reference": f"Patient/{patient_id}"
    },
    "authoredOn": datetime.now().isoformat() + "Z"
}

response = requests.post(f"{BASE_URL}/MedicationRequest", json=medication)
print(f"   Status: {response.status_code}")
if response.status_code == 201:
    print(f"   ✅ Created: {response.headers.get('Location')}")
else:
    print(f"   ❌ Error: {response.text[:200]}")

# Test 4: List created resources
print("\n4. Verifying created resources...")

# Check encounters
response = requests.get(f"{BASE_URL}/Encounter?patient={patient_id}")
if response.status_code == 200:
    count = response.json().get('total', 0)
    print(f"   Encounters: {count}")

# Check allergies
response = requests.get(f"{BASE_URL}/AllergyIntolerance?patient={patient_id}")
if response.status_code == 200:
    count = response.json().get('total', 0)
    print(f"   Allergies: {count}")

# Check medications
response = requests.get(f"{BASE_URL}/MedicationRequest?patient={patient_id}")
if response.status_code == 200:
    count = response.json().get('total', 0)
    print(f"   Medications: {count}")