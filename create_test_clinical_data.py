#!/usr/bin/env python3
"""
Create test clinical data for demonstration
"""

import requests
import json
from datetime import datetime, timedelta
import random

BASE_URL = "http://localhost:8000/fhir/R4"

def create_test_data():
    """Create test clinical data for the first patient"""
    
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
    
    print(f"Creating test data for patient: {patient_name} (ID: {patient_id})")
    
    # Create encounters
    print("\n1. Creating encounters...")
    encounters = []
    for i in range(3):
        encounter_date = datetime.now() - timedelta(days=i*30)
        encounter = {
            "resourceType": "Encounter",
            "status": "finished" if i > 0 else "in-progress",
            "class": {  # Note: This gets mapped to class_field in the model
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
                "text": "Office Visit" if i == 0 else "Follow-up Visit"
            }],
            "subject": {
                "reference": f"Patient/{patient_id}",
                "display": patient_name
            },
            "period": {
                "start": encounter_date.isoformat() + "Z",
                "end": (encounter_date + timedelta(hours=1)).isoformat() + "Z" if i > 0 else None
            }
        }
        
        if encounter["period"]["end"] is None:
            del encounter["period"]["end"]
        
        resp = requests.post(f"{BASE_URL}/Encounter", json=encounter)
        if resp.status_code in [200, 201]:
            enc_id = resp.json()['id']
            encounters.append(enc_id)
            print(f"  ✅ Created encounter: {enc_id}")
        else:
            print(f"  ❌ Failed to create encounter: {resp.status_code}")
    
    # Create allergies
    print("\n2. Creating allergies...")
    allergies = [
        {"substance": "Penicillin", "severity": "high", "reaction": "Anaphylaxis"},
        {"substance": "Peanuts", "severity": "medium", "reaction": "Hives"}
    ]
    
    for allergy in allergies:
        allergy_resource = {
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
            "type": "allergy",
            "category": ["medication" if "Penicillin" in allergy["substance"] else "food"],
            "criticality": allergy["severity"],
            "code": {
                "text": allergy["substance"]
            },
            "patient": {
                "reference": f"Patient/{patient_id}"
            },
            "reaction": [{
                "manifestation": [{
                    "text": allergy["reaction"]
                }]
            }]
        }
        
        resp = requests.post(f"{BASE_URL}/AllergyIntolerance", json=allergy_resource)
        if resp.status_code in [200, 201]:
            print(f"  ✅ Created allergy: {allergy['substance']}")
        else:
            print(f"  ❌ Failed to create allergy: {resp.status_code}")
    
    # Create conditions
    print("\n3. Creating conditions...")
    conditions = [
        {"code": "44054006", "display": "Type 2 diabetes mellitus"},
        {"code": "38341003", "display": "Hypertension"},
        {"code": "427089005", "display": "Diabetes mellitus due to genetic defect in beta cell function"}
    ]
    
    for condition in conditions:
        condition_resource = {
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
            "onsetDateTime": (datetime.now() - timedelta(days=random.randint(30, 365))).isoformat() + "Z"
        }
        
        resp = requests.post(f"{BASE_URL}/Condition", json=condition_resource)
        if resp.status_code in [200, 201]:
            print(f"  ✅ Created condition: {condition['display']}")
        else:
            print(f"  ❌ Failed to create condition: {resp.status_code}")
    
    # Create medications
    print("\n4. Creating medications...")
    medications = [
        {"name": "Metformin 500mg", "dosage": "500mg", "frequency": "Twice daily"},
        {"name": "Lisinopril 10mg", "dosage": "10mg", "frequency": "Once daily"},
        {"name": "Aspirin 81mg", "dosage": "81mg", "frequency": "Once daily"}
    ]
    
    for med in medications:
        med_resource = {
            "resourceType": "MedicationRequest",
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "text": med["name"]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "authoredOn": datetime.now().isoformat() + "Z",
            "dosageInstruction": [{
                "text": f"{med['dosage']} - {med['frequency']}",
                "timing": {
                    "repeat": {
                        "frequency": 2 if "Twice" in med["frequency"] else 1,
                        "period": 1,
                        "periodUnit": "d"
                    }
                },
                "doseAndRate": [{
                    "doseQuantity": {
                        "value": float(med["dosage"].replace("mg", "")),
                        "unit": "mg"
                    }
                }]
            }]
        }
        
        resp = requests.post(f"{BASE_URL}/MedicationRequest", json=med_resource)
        if resp.status_code in [200, 201]:
            print(f"  ✅ Created medication: {med['name']}")
        else:
            print(f"  ❌ Failed to create medication: {resp.status_code}")
    
    # Create vital sign observations
    print("\n5. Creating vital signs...")
    vitals = [
        {"code": "8867-4", "display": "Heart rate", "value": 72, "unit": "beats/minute"},
        {"code": "8310-5", "display": "Body temperature", "value": 98.6, "unit": "°F"},
        {"code": "2708-6", "display": "Oxygen saturation", "value": 98, "unit": "%"},
        {"code": "8480-6", "display": "Systolic blood pressure", "value": 120, "unit": "mmHg"},
        {"code": "8462-4", "display": "Diastolic blood pressure", "value": 80, "unit": "mmHg"}
    ]
    
    # Create blood pressure as a panel
    bp_observation = {
        "resourceType": "Observation",
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": "85354-9",
                "display": "Blood pressure panel"
            }],
            "text": "Blood pressure"
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "effectiveDateTime": datetime.now().isoformat() + "Z",
        "component": [
            {
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8480-6",
                        "display": "Systolic blood pressure"
                    }]
                },
                "valueQuantity": {
                    "value": 120,
                    "unit": "mmHg"
                }
            },
            {
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8462-4",
                        "display": "Diastolic blood pressure"
                    }]
                },
                "valueQuantity": {
                    "value": 80,
                    "unit": "mmHg"
                }
            }
        ]
    }
    
    resp = requests.post(f"{BASE_URL}/Observation", json=bp_observation)
    if resp.status_code in [200, 201]:
        print(f"  ✅ Created vital: Blood pressure")
    else:
        print(f"  ❌ Failed to create blood pressure: {resp.status_code}")
    
    # Create other vitals
    for vital in vitals[:3]:  # Skip BP components
        vital_resource = {
            "resourceType": "Observation",
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "vital-signs",
                    "display": "Vital Signs"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": vital["code"],
                    "display": vital["display"]
                }],
                "text": vital["display"]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": datetime.now().isoformat() + "Z",
            "valueQuantity": {
                "value": vital["value"],
                "unit": vital["unit"]
            }
        }
        
        resp = requests.post(f"{BASE_URL}/Observation", json=vital_resource)
        if resp.status_code in [200, 201]:
            print(f"  ✅ Created vital: {vital['display']}")
        else:
            print(f"  ❌ Failed to create vital: {resp.status_code}")
    
    print("\n✅ Test data creation complete!")

if __name__ == "__main__":
    create_test_data()