#!/usr/bin/env python3
"""
Test script to verify clinical data is available in the backend
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_patient_clinical_data():
    """Test if clinical data is available for patients"""
    print("\n=== Testing Clinical Data Availability ===\n")
    
    # First get a patient
    print("1. Getting patients...")
    response = requests.get(f"{BASE_URL}/fhir/R4/Patient?_count=5")
    if response.status_code != 200:
        print(f"❌ Failed to get patients: {response.status_code}")
        return
    
    patients = response.json()
    if patients.get('total', 0) == 0:
        print("❌ No patients found")
        return
    
    patient_id = patients['entry'][0]['resource']['id']
    patient_name = patients['entry'][0]['resource']['name'][0]['given'][0] + ' ' + patients['entry'][0]['resource']['name'][0]['family']
    print(f"✅ Found patient: {patient_name} (ID: {patient_id})")
    
    # Test AllergyIntolerance
    print(f"\n2. Getting allergies for patient {patient_id}...")
    response = requests.get(f"{BASE_URL}/fhir/R4/AllergyIntolerance?patient={patient_id}")
    if response.status_code == 200:
        data = response.json()
        count = data.get('total', 0)
        print(f"✅ Found {count} allergies")
        if count > 0 and 'entry' in data:
            for entry in data['entry'][:3]:
                allergy = entry['resource']
                substance = allergy.get('code', {}).get('text', 'Unknown')
                print(f"   - {substance}")
    else:
        print(f"❌ Failed to get allergies: {response.status_code}")
    
    # Test Condition
    print(f"\n3. Getting conditions for patient {patient_id}...")
    response = requests.get(f"{BASE_URL}/fhir/R4/Condition?patient={patient_id}")
    if response.status_code == 200:
        data = response.json()
        count = data.get('total', 0)
        print(f"✅ Found {count} conditions")
        if count > 0 and 'entry' in data:
            for entry in data['entry'][:3]:
                condition = entry['resource']
                display = condition.get('code', {}).get('text') or \
                         condition.get('code', {}).get('coding', [{}])[0].get('display', 'Unknown')
                print(f"   - {display}")
    else:
        print(f"❌ Failed to get conditions: {response.status_code}")
    
    # Test MedicationRequest
    print(f"\n4. Getting medications for patient {patient_id}...")
    response = requests.get(f"{BASE_URL}/fhir/R4/MedicationRequest?patient={patient_id}")
    if response.status_code == 200:
        data = response.json()
        count = data.get('total', 0)
        print(f"✅ Found {count} medications")
        if count > 0 and 'entry' in data:
            for entry in data['entry'][:3]:
                med = entry['resource']
                med_name = med.get('medicationCodeableConcept', {}).get('text') or \
                          med.get('medicationCodeableConcept', {}).get('coding', [{}])[0].get('display', 'Unknown')
                print(f"   - {med_name}")
    else:
        print(f"❌ Failed to get medications: {response.status_code}")
    
    # Test Observation (vitals)
    print(f"\n5. Getting observations (vitals) for patient {patient_id}...")
    response = requests.get(f"{BASE_URL}/fhir/R4/Observation?patient={patient_id}&category=vital-signs&_count=10")
    if response.status_code == 200:
        data = response.json()
        count = data.get('total', 0)
        print(f"✅ Found {count} vital sign observations")
        if count > 0 and 'entry' in data:
            for entry in data['entry'][:3]:
                obs = entry['resource']
                display = obs.get('code', {}).get('text') or \
                         obs.get('code', {}).get('coding', [{}])[0].get('display', 'Unknown')
                value = obs.get('valueQuantity', {}).get('value', 'N/A')
                unit = obs.get('valueQuantity', {}).get('unit', '')
                print(f"   - {display}: {value} {unit}")
    else:
        print(f"❌ Failed to get observations: {response.status_code}")
    
    # Test Encounter
    print(f"\n6. Getting encounters for patient {patient_id}...")
    response = requests.get(f"{BASE_URL}/fhir/R4/Encounter?patient={patient_id}")
    if response.status_code == 200:
        data = response.json()
        count = data.get('total', 0)
        print(f"✅ Found {count} encounters")
        if count > 0 and 'entry' in data:
            for entry in data['entry'][:3]:
                enc = entry['resource']
                enc_type = enc.get('type', [{}])[0].get('text', 'Unknown')
                status = enc.get('status', 'Unknown')
                print(f"   - {enc_type} (Status: {status})")
    else:
        print(f"❌ Failed to get encounters: {response.status_code}")

if __name__ == "__main__":
    test_patient_clinical_data()