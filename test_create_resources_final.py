#!/usr/bin/env python3
"""
Create test clinical data using proper FHIR formats
"""

import requests
import json
from datetime import datetime, timedelta
import random

BASE_URL = "http://localhost:8000/fhir/R4"

def create_test_data():
    """Create test clinical data for demonstration"""
    
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
    
    # Create allergies (these work!)
    print("\n1. Creating allergies...")
    allergies = [
        {"substance": "Penicillin", "severity": "high", "reaction": "Anaphylaxis"},
        {"substance": "Peanuts", "severity": "medium", "reaction": "Hives"},
        {"substance": "Latex", "severity": "low", "reaction": "Rash"}
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
            "category": ["medication" if "Penicillin" in allergy["substance"] else "food" if "Peanuts" in allergy["substance"] else "environment"],
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
    
    # Create conditions (these already work!)
    print("\n2. Creating conditions...")
    conditions = [
        {"code": "44054006", "display": "Type 2 diabetes mellitus"},
        {"code": "38341003", "display": "Hypertension"},
        {"code": "271737000", "display": "Anemia"},
        {"code": "195967001", "display": "Asthma"}
    ]
    
    for idx, condition in enumerate(conditions):
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
            "onsetDateTime": (datetime.now() - timedelta(days=random.randint(30, 365*2))).isoformat() + "Z"
        }
        
        resp = requests.post(f"{BASE_URL}/Condition", json=condition_resource)
        if resp.status_code in [200, 201]:
            print(f"  ✅ Created condition: {condition['display']}")
        else:
            print(f"  ❌ Failed to create condition: {resp.status_code}")
    
    # Create vital sign observations (these already work!)
    print("\n3. Creating vital signs...")
    
    # Create multiple sets of vitals over time
    for days_ago in [0, 7, 30]:
        vital_date = datetime.now() - timedelta(days=days_ago)
        
        vitals = [
            {"code": "8867-4", "display": "Heart rate", "value": 70 + random.randint(-5, 15), "unit": "beats/minute"},
            {"code": "8310-5", "display": "Body temperature", "value": 97.5 + random.random() * 2, "unit": "°F"},
            {"code": "2708-6", "display": "Oxygen saturation", "value": 95 + random.randint(0, 4), "unit": "%"},
            {"code": "9279-1", "display": "Respiratory rate", "value": 16 + random.randint(-2, 4), "unit": "breaths/minute"},
            {"code": "8480-6", "display": "Systolic blood pressure", "value": 110 + random.randint(0, 30), "unit": "mmHg"},
            {"code": "8462-4", "display": "Diastolic blood pressure", "value": 70 + random.randint(0, 20), "unit": "mmHg"}
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
            "effectiveDateTime": vital_date.isoformat() + "Z",
            "component": [
                {
                    "code": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": vitals[4]["code"],
                            "display": vitals[4]["display"]
                        }]
                    },
                    "valueQuantity": {
                        "value": vitals[4]["value"],
                        "unit": vitals[4]["unit"]
                    }
                },
                {
                    "code": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": vitals[5]["code"],
                            "display": vitals[5]["display"]
                        }]
                    },
                    "valueQuantity": {
                        "value": vitals[5]["value"],
                        "unit": vitals[5]["unit"]
                    }
                }
            ]
        }
        
        resp = requests.post(f"{BASE_URL}/Observation", json=bp_observation)
        if resp.status_code in [200, 201]:
            print(f"  ✅ Created blood pressure for {days_ago} days ago")
        
        # Create other vitals
        for vital in vitals[:4]:  # Skip BP components
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
                "effectiveDateTime": vital_date.isoformat() + "Z",
                "valueQuantity": {
                    "value": vital["value"],
                    "unit": vital["unit"]
                }
            }
            
            resp = requests.post(f"{BASE_URL}/Observation", json=vital_resource)
            if resp.status_code in [200, 201] and days_ago == 0:
                print(f"  ✅ Created vital: {vital['display']} = {vital['value']} {vital['unit']}")
    
    # Create lab results
    print("\n4. Creating lab results...")
    labs = [
        {"code": "2160-0", "display": "Creatinine", "value": 1.2, "unit": "mg/dL", "low": 0.7, "high": 1.3},
        {"code": "2345-7", "display": "Glucose", "value": 110, "unit": "mg/dL", "low": 70, "high": 100},
        {"code": "718-7", "display": "Hemoglobin", "value": 14.5, "unit": "g/dL", "low": 13.5, "high": 17.5},
        {"code": "6690-2", "display": "White blood cell count", "value": 7.5, "unit": "10*3/uL", "low": 4.5, "high": 11.0}
    ]
    
    for lab in labs:
        lab_resource = {
            "resourceType": "Observation",
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "laboratory",
                    "display": "Laboratory"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": lab["code"],
                    "display": lab["display"]
                }],
                "text": lab["display"]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": datetime.now().isoformat() + "Z",
            "valueQuantity": {
                "value": lab["value"],
                "unit": lab["unit"]
            },
            "referenceRange": [{
                "low": {"value": lab["low"], "unit": lab["unit"]},
                "high": {"value": lab["high"], "unit": lab["unit"]}
            }]
        }
        
        resp = requests.post(f"{BASE_URL}/Observation", json=lab_resource)
        if resp.status_code in [200, 201]:
            print(f"  ✅ Created lab: {lab['display']} = {lab['value']} {lab['unit']}")
        else:
            print(f"  ❌ Failed to create lab: {resp.status_code}")
    
    print("\n✅ Test data creation complete!")
    
    # Summary
    print("\n📊 Summary of created resources:")
    
    # Check allergies
    response = requests.get(f"{BASE_URL}/AllergyIntolerance?patient={patient_id}")
    if response.status_code == 200:
        count = response.json().get('total', 0)
        print(f"   - Allergies: {count}")
    
    # Check conditions
    response = requests.get(f"{BASE_URL}/Condition?patient={patient_id}")
    if response.status_code == 200:
        count = response.json().get('total', 0)
        print(f"   - Conditions: {count}")
    
    # Check observations
    response = requests.get(f"{BASE_URL}/Observation?patient={patient_id}&category=vital-signs")
    if response.status_code == 200:
        count = response.json().get('total', 0)
        print(f"   - Vital signs: {count}")
    
    response = requests.get(f"{BASE_URL}/Observation?patient={patient_id}&category=laboratory")
    if response.status_code == 200:
        count = response.json().get('total', 0)
        print(f"   - Lab results: {count}")

if __name__ == "__main__":
    create_test_data()