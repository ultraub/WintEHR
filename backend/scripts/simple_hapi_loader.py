#!/usr/bin/env python3
"""
Simple HTTP-based test data loader for HAPI FHIR

Loads test patients directly to HAPI FHIR using HTTP requests.
No dependencies on fhirclient or complex bundle processing.
"""

import requests
import random
import sys
from datetime import datetime, timedelta

# HAPI FHIR endpoint
HAPI_BASE = "http://localhost:8888/fhir"

# Sample data
FIRST_NAMES = ["John", "Jane", "Michael", "Sarah", "David", "Emily", "James", "Maria", "Robert", "Lisa"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
CITIES = ["Boston", "New York", "Chicago", "Houston", "Phoenix"]
STATES = ["MA", "NY", "IL", "TX", "AZ"]

def create_resource(resource_data):
    """POST resource to HAPI FHIR"""
    resource_type = resource_data.get("resourceType")
    url = f"{HAPI_BASE}/{resource_type}"

    response = requests.post(
        url,
        json=resource_data,
        headers={"Content-Type": "application/fhir+json"}
    )

    if response.status_code in [200, 201]:
        return response.json()
    else:
        raise Exception(f"Failed to create {resource_type}: {response.status_code} - {response.text}")

def generate_patient(index):
    """Generate a test patient resource"""
    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    birth_date = (datetime.now() - timedelta(days=random.randint(20*365, 80*365))).strftime("%Y-%m-%d")
    gender = random.choice(["male", "female"])

    return {
        "resourceType": "Patient",
        "identifier": [{
            "use": "usual",
            "system": "http://hospital.example.org/mrn",
            "value": f"MRN{1000 + index}"
        }],
        "name": [{
            "use": "official",
            "family": last_name,
            "given": [first_name]
        }],
        "gender": gender,
        "birthDate": birth_date,
        "address": [{
            "use": "home",
            "city": random.choice(CITIES),
            "state": random.choice(STATES),
            "postalCode": f"{random.randint(10000, 99999)}",
            "country": "US"
        }]
    }

def generate_condition(patient_id, index):
    """Generate a test condition for a patient"""
    conditions = [
        {"code": "38341003", "display": "Hypertension"},
        {"code": "44054006", "display": "Type 2 Diabetes"},
        {"code": "13645005", "display": "Chronic obstructive pulmonary disease"},
        {"code": "195967001", "display": "Asthma"}
    ]

    condition = random.choice(conditions)
    onset_date = (datetime.now() - timedelta(days=random.randint(30, 1000))).strftime("%Y-%m-%d")

    return {
        "resourceType": "Condition",
        "clinicalStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code": "active"
            }]
        },
        "verificationStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code": "confirmed"
            }]
        },
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                "code": "encounter-diagnosis"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": condition["code"],
                "display": condition["display"]
            }],
            "text": condition["display"]
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "onsetDateTime": onset_date,
        "recordedDate": onset_date
    }

def generate_observation(patient_id, index):
    """Generate a vital signs observation"""
    observations = [
        {"code": "8480-6", "display": "Systolic Blood Pressure", "value": random.randint(110, 140), "unit": "mmHg"},
        {"code": "8462-6", "display": "Diastolic Blood Pressure", "value": random.randint(70, 90), "unit": "mmHg"},
        {"code": "8310-5", "display": "Body Temperature", "value": round(random.uniform(36.5, 37.5), 1), "unit": "Cel"}
    ]

    obs = random.choice(observations)
    effective_date = (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()

    return {
        "resourceType": "Observation",
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": obs["code"],
                "display": obs["display"]
            }],
            "text": obs["display"]
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "effectiveDateTime": effective_date,
        "valueQuantity": {
            "value": obs["value"],
            "unit": obs["unit"],
            "system": "http://unitsofmeasure.org",
            "code": obs["unit"]
        }
    }

def check_hapi_connection():
    """Verify HAPI FHIR is accessible"""
    try:
        response = requests.get(f"{HAPI_BASE}/metadata", timeout=5)
        if response.status_code == 200:
            print(f"✓ HAPI FHIR server is accessible at {HAPI_BASE}")
            return True
        else:
            print(f"✗ HAPI FHIR server returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Cannot connect to HAPI FHIR server: {e}")
        return False

def main():
    """Load test patients to HAPI FHIR"""
    print("=" * 60)
    print("Simple HAPI FHIR Test Data Loader")
    print("=" * 60)

    # Check connection
    if not check_hapi_connection():
        sys.exit(1)

    patient_count = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    print(f"\nGenerating {patient_count} test patients...\n")

    patients_created = []
    conditions_created = 0
    observations_created = 0

    try:
        for i in range(patient_count):
            # Create patient
            patient_data = generate_patient(i)
            patient = create_resource(patient_data)
            patient_id = patient["id"]
            patients_created.append(patient_id)
            print(f"✓ Created Patient {i+1}/{patient_count}: {patient_id}")

            # Create 1-3 conditions per patient
            num_conditions = random.randint(1, 3)
            for j in range(num_conditions):
                condition_data = generate_condition(patient_id, j)
                create_resource(condition_data)
                conditions_created += 1

            # Create 2-5 observations per patient
            num_obs = random.randint(2, 5)
            for j in range(num_obs):
                obs_data = generate_observation(patient_id, j)
                create_resource(obs_data)
                observations_created += 1

        print("\n" + "=" * 60)
        print("Import Complete!")
        print("=" * 60)
        print(f"Patients created: {len(patients_created)}")
        print(f"Conditions created: {conditions_created}")
        print(f"Observations created: {observations_created}")
        print("\nSample patient IDs:")
        for pid in patients_created[:5]:
            print(f"  - {pid}")
        print("\n" + "=" * 60)

        # Verify via search
        print("\nVerifying data in HAPI FHIR...")
        response = requests.get(f"{HAPI_BASE}/Patient?_summary=count")
        if response.status_code == 200:
            total = response.json().get("total", 0)
            print(f"✓ Total patients in HAPI FHIR: {total}")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
