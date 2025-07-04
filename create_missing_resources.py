#!/usr/bin/env python3
"""
Create missing resources (Encounters and Medications) for demonstration
"""

import requests
import json
from datetime import datetime, timedelta
import uuid

BASE_URL = "http://localhost:8000/fhir/R4"

def create_encounters_and_medications():
    """Create test encounters and medications"""
    
    # Get first patient
    response = requests.get(f"{BASE_URL}/Patient?_count=1")
    if response.status_code != 200:
        print("Failed to get patient")
        return
    
    patients = response.json()
    if patients.get('total', 0) == 0:
        print("No patients found")
        return
    
    patient = patients['entry'][0]['resource']
    patient_id = patient['id']
    patient_name = f"{patient['name'][0]['given'][0]} {patient['name'][0]['family']}"
    
    print(f"Creating resources for patient: {patient_name} (ID: {patient_id})")
    
    # Get a practitioner
    pract_response = requests.get(f"{BASE_URL}/Practitioner?_count=1")
    practitioner_id = None
    if pract_response.status_code == 200 and pract_response.json().get('total', 0) > 0:
        practitioner_id = pract_response.json()['entry'][0]['resource']['id']
    
    # Create encounters using transaction bundle
    print("\n1. Creating encounters via transaction bundle...")
    
    entries = []
    encounter_ids = []
    
    for i in range(3):
        encounter_date = datetime.now() - timedelta(days=i*30)
        encounter_id = str(uuid.uuid4())
        encounter_ids.append(encounter_id)
        
        encounter = {
            "resourceType": "Encounter",
            "id": encounter_id,
            "status": "finished",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory"
            },
            "type": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "308335008",
                    "display": "Patient encounter procedure"
                }],
                "text": "Office Visit" if i == 0 else f"Follow-up Visit {i}"
            }],
            "subject": {
                "reference": f"Patient/{patient_id}",
                "display": patient_name
            },
            "period": {
                "start": encounter_date.isoformat() + "Z",
                "end": (encounter_date + timedelta(hours=1)).isoformat() + "Z"
            }
        }
        
        if practitioner_id:
            encounter["participant"] = [{
                "type": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                        "code": "PPRF",
                        "display": "primary performer"
                    }]
                }],
                "individual": {
                    "reference": f"Practitioner/{practitioner_id}"
                }
            }]
        
        entries.append({
            "resource": encounter,
            "request": {
                "method": "PUT",
                "url": f"Encounter/{encounter_id}"
            }
        })
    
    # Create medications
    print("\n2. Creating medications...")
    
    medications = [
        {
            "name": "Metformin",
            "code": "6809",
            "display": "Metformin 500 MG Oral Tablet",
            "dosage": "Take 1 tablet by mouth twice daily",
            "quantity": 500,
            "unit": "mg"
        },
        {
            "name": "Lisinopril",
            "code": "29046",
            "display": "Lisinopril 10 MG Oral Tablet",
            "dosage": "Take 1 tablet by mouth once daily",
            "quantity": 10,
            "unit": "mg"
        },
        {
            "name": "Aspirin",
            "code": "1191",
            "display": "Aspirin 81 MG Oral Tablet",
            "dosage": "Take 1 tablet by mouth once daily",
            "quantity": 81,
            "unit": "mg"
        }
    ]
    
    for med in medications:
        med_id = str(uuid.uuid4())
        
        medication_request = {
            "resourceType": "MedicationRequest",
            "id": med_id,
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": med["code"],
                    "display": med["display"]
                }],
                "text": med["name"]
            },
            "subject": {
                "reference": f"Patient/{patient_id}",
                "display": patient_name
            },
            "encounter": {
                "reference": f"Encounter/{encounter_ids[0]}"
            },
            "authoredOn": datetime.now().isoformat() + "Z",
            "dosageInstruction": [{
                "text": med["dosage"],
                "timing": {
                    "repeat": {
                        "frequency": 1 if "once" in med["dosage"] else 2,
                        "period": 1,
                        "periodUnit": "d"
                    }
                },
                "doseAndRate": [{
                    "type": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/dose-rate-type",
                            "code": "ordered",
                            "display": "Ordered"
                        }]
                    },
                    "doseQuantity": {
                        "value": med["quantity"],
                        "unit": med["unit"],
                        "system": "http://unitsofmeasure.org",
                        "code": med["unit"]
                    }
                }]
            }]
        }
        
        if practitioner_id:
            medication_request["requester"] = {
                "reference": f"Practitioner/{practitioner_id}"
            }
        
        entries.append({
            "resource": medication_request,
            "request": {
                "method": "PUT",
                "url": f"MedicationRequest/{med_id}"
            }
        })
    
    # Send transaction bundle
    bundle = {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": entries
    }
    
    response = requests.post(f"{BASE_URL}", json=bundle, headers={"Content-Type": "application/fhir+json"})
    if response.status_code in [200, 201]:
        print("✅ Successfully created all resources via transaction bundle")
        result = response.json()
        if 'entry' in result:
            encounters_created = sum(1 for e in result['entry'] if 'Encounter' in e.get('response', {}).get('location', ''))
            meds_created = sum(1 for e in result['entry'] if 'MedicationRequest' in e.get('response', {}).get('location', ''))
            print(f"   - Created {encounters_created} encounters")
            print(f"   - Created {meds_created} medications")
    else:
        print(f"❌ Failed to create resources: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
    
    # Verify resources
    print("\n3. Verifying created resources...")
    
    # Check encounters
    response = requests.get(f"{BASE_URL}/Encounter?patient={patient_id}")
    if response.status_code == 200:
        count = response.json().get('total', 0)
        print(f"   ✅ Encounters: {count}")
        if count > 0:
            enc = response.json()['entry'][0]['resource']
            print(f"      - Example: {enc['type'][0]['text']} on {enc['period']['start'][:10]}")
    
    # Check medications
    response = requests.get(f"{BASE_URL}/MedicationRequest?patient={patient_id}")
    if response.status_code == 200:
        count = response.json().get('total', 0)
        print(f"   ✅ Medications: {count}")
        if count > 0:
            med = response.json()['entry'][0]['resource']
            print(f"      - Example: {med['medicationCodeableConcept']['text']}")
    
    print("\n✅ Missing resources created successfully!")
    print("\nThe Clinical Workspace should now show:")
    print("- Encounter dropdown with selectable encounters")
    print("- Medications list with active prescriptions")
    print("- Full clinical data for the patient")

if __name__ == "__main__":
    create_encounters_and_medications()