#!/usr/bin/env python3
"""
Test script to check clinical data across all patients
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_all_patients():
    """Test clinical data for all patients"""
    print("\n=== Testing Clinical Data Across All Patients ===\n")
    
    # Get all patients
    response = requests.get(f"{BASE_URL}/fhir/R4/Patient?_count=100")
    if response.status_code != 200:
        print(f"❌ Failed to get patients: {response.status_code}")
        return
    
    patients = response.json()
    total_patients = patients.get('total', 0)
    print(f"Found {total_patients} patients\n")
    
    # Summary stats
    patients_with_allergies = 0
    patients_with_conditions = 0
    patients_with_medications = 0
    patients_with_vitals = 0
    patients_with_encounters = 0
    
    # Check each patient
    for i, entry in enumerate(patients.get('entry', [])):
        patient = entry['resource']
        patient_id = patient['id']
        patient_name = patient['name'][0]['given'][0] + ' ' + patient['name'][0]['family']
        
        print(f"\nPatient {i+1}: {patient_name} (ID: {patient_id})")
        
        # Check allergies
        resp = requests.get(f"{BASE_URL}/fhir/R4/AllergyIntolerance?patient={patient_id}")
        if resp.status_code == 200:
            allergy_count = resp.json().get('total', 0)
            if allergy_count > 0:
                patients_with_allergies += 1
                print(f"  - Allergies: {allergy_count}")
        
        # Check conditions
        resp = requests.get(f"{BASE_URL}/fhir/R4/Condition?patient={patient_id}")
        if resp.status_code == 200:
            condition_count = resp.json().get('total', 0)
            if condition_count > 0:
                patients_with_conditions += 1
                print(f"  - Conditions: {condition_count}")
        
        # Check medications
        resp = requests.get(f"{BASE_URL}/fhir/R4/MedicationRequest?patient={patient_id}")
        if resp.status_code == 200:
            med_count = resp.json().get('total', 0)
            if med_count > 0:
                patients_with_medications += 1
                print(f"  - Medications: {med_count}")
        
        # Check vital signs - look for specific vital sign codes
        resp = requests.get(f"{BASE_URL}/fhir/R4/Observation?patient={patient_id}&code=8867-4,8310-5,85354-9,2708-6&_count=5")
        if resp.status_code == 200:
            vital_data = resp.json()
            vital_count = vital_data.get('total', 0)
            if vital_count > 0:
                patients_with_vitals += 1
                print(f"  - Vital Signs: {vital_count}")
                # Show specific vitals
                for ve in vital_data.get('entry', [])[:3]:
                    obs = ve['resource']
                    code = obs['code']['coding'][0]['code']
                    display = obs['code']['coding'][0]['display']
                    value = obs.get('valueQuantity', {}).get('value', 'N/A')
                    unit = obs.get('valueQuantity', {}).get('unit', '')
                    print(f"    • {display}: {value} {unit}")
        
        # Check encounters
        resp = requests.get(f"{BASE_URL}/fhir/R4/Encounter?patient={patient_id}")
        if resp.status_code == 200:
            enc_count = resp.json().get('total', 0)
            if enc_count > 0:
                patients_with_encounters += 1
                print(f"  - Encounters: {enc_count}")
        
        # Limit to first 5 patients for brevity
        if i >= 4:
            print("\n... (showing first 5 patients only)")
            break
    
    print(f"\n=== Summary ===")
    print(f"Total patients: {total_patients}")
    print(f"Patients with allergies: {patients_with_allergies}")
    print(f"Patients with conditions: {patients_with_conditions}")
    print(f"Patients with medications: {patients_with_medications}")
    print(f"Patients with vital signs: {patients_with_vitals}")
    print(f"Patients with encounters: {patients_with_encounters}")

if __name__ == "__main__":
    test_all_patients()