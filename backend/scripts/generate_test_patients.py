#!/usr/bin/env python3
"""
Generate test patients using Synthea format for MedGenEMR testing
"""

import json
import asyncio
import httpx
from datetime import datetime, timedelta
import random
import uuid

# Sample data for generating patients
FIRST_NAMES = {
    'male': ['John', 'Michael', 'David', 'James', 'Robert'],
    'female': ['Mary', 'Jennifer', 'Linda', 'Patricia', 'Elizabeth']
}

LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones']

CITIES = [
    {'city': 'Boston', 'state': 'MA', 'zip': '02101'},
    {'city': 'New York', 'state': 'NY', 'zip': '10001'},
    {'city': 'Chicago', 'state': 'IL', 'zip': '60601'},
    {'city': 'Houston', 'state': 'TX', 'zip': '77001'},
    {'city': 'Phoenix', 'state': 'AZ', 'zip': '85001'}
]

CONDITIONS = [
    {'code': '38341003', 'display': 'Hypertension'},
    {'code': '44054006', 'display': 'Type 2 diabetes mellitus'},
    {'code': '195967001', 'display': 'Asthma'},
    {'code': '53741008', 'display': 'Coronary arteriosclerosis'},
    {'code': '267432004', 'display': 'Pure hypercholesterolemia'}
]

MEDICATIONS = [
    {'code': '318272', 'display': 'Metformin 500 MG Oral Tablet'},
    {'code': '316049', 'display': 'Lisinopril 10 MG Oral Tablet'},
    {'code': '197361', 'display': 'Atorvastatin 20 MG Oral Tablet'},
    {'code': '311036', 'display': 'Amlodipine 5 MG Oral Tablet'},
    {'code': '746030', 'display': 'Albuterol 0.09 MG/ACTUAT Inhalant Solution'}
]

async def create_patient_bundle(index: int):
    """Create a patient with associated clinical data"""
    gender = random.choice(['male', 'female'])
    first_name = random.choice(FIRST_NAMES[gender])
    last_name = random.choice(LAST_NAMES)
    location = random.choice(CITIES)
    birth_date = datetime.now() - timedelta(days=random.randint(20*365, 80*365))
    patient_id = str(uuid.uuid4())
    
    # Create Patient resource
    patient = {
        "resourceType": "Patient",
        "id": patient_id,
        "identifier": [{
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                    "code": "MR"
                }]
            },
            "value": f"MRN-{index:05d}"
        }],
        "name": [{
            "use": "official",
            "family": last_name,
            "given": [first_name]
        }],
        "birthDate": birth_date.strftime("%Y-%m-%d"),
        "gender": gender,
        "telecom": [
            {
                "system": "phone",
                "value": f"555-{random.randint(1000, 9999)}",
                "use": "home"
            },
            {
                "system": "email",
                "value": f"{first_name.lower()}.{last_name.lower()}@example.com"
            }
        ],
        "address": [{
            "use": "home",
            "line": [f"{random.randint(100, 9999)} Main Street"],
            "city": location['city'],
            "state": location['state'],
            "postalCode": location['zip']
        }]
    }
    
    # Create an active encounter
    encounter_id = str(uuid.uuid4())
    encounter = {
        "resourceType": "Encounter",
        "id": encounter_id,
        "status": "in-progress",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "AMB",
            "display": "ambulatory"
        },
        "type": [{
            "text": "Office Visit"
        }],
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "period": {
            "start": datetime.now().isoformat()
        }
    }
    
    resources = [patient, encounter]
    
    # Add some conditions
    num_conditions = random.randint(1, 3)
    for _ in range(num_conditions):
        condition = random.choice(CONDITIONS)
        resources.append({
            "resourceType": "Condition",
            "id": str(uuid.uuid4()),
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
                    "code": condition['code'],
                    "display": condition['display']
                }],
                "text": condition['display']
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "encounter": {
                "reference": f"Encounter/{encounter_id}"
            },
            "onsetDateTime": (datetime.now() - timedelta(days=random.randint(30, 365*5))).isoformat()
        })
    
    # Add some medications
    num_medications = random.randint(1, 3)
    for _ in range(num_medications):
        medication = random.choice(MEDICATIONS)
        resources.append({
            "resourceType": "MedicationRequest",
            "id": str(uuid.uuid4()),
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": medication['code'],
                    "display": medication['display']
                }],
                "text": medication['display']
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "encounter": {
                "reference": f"Encounter/{encounter_id}"
            },
            "authoredOn": datetime.now().isoformat(),
            "dosageInstruction": [{
                "text": "Take as directed"
            }]
        })
    
    # Add some vital signs
    vitals = [
        {"code": "8867-4", "display": "Heart rate", "value": random.randint(60, 90), "unit": "beats/minute"},
        {"code": "8310-5", "display": "Body temperature", "value": round(random.uniform(97.0, 99.0), 1), "unit": "degF"},
        {"code": "8462-4", "display": "Diastolic blood pressure", "value": random.randint(60, 80), "unit": "mmHg"},
        {"code": "8480-6", "display": "Systolic blood pressure", "value": random.randint(110, 130), "unit": "mmHg"},
        {"code": "2708-6", "display": "Oxygen saturation", "value": random.randint(95, 100), "unit": "%"}
    ]
    
    for vital in vitals:
        resources.append({
            "resourceType": "Observation",
            "id": str(uuid.uuid4()),
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
                    "code": vital['code'],
                    "display": vital['display']
                }],
                "text": vital['display']
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "encounter": {
                "reference": f"Encounter/{encounter_id}"
            },
            "effectiveDateTime": datetime.now().isoformat(),
            "valueQuantity": {
                "value": vital['value'],
                "unit": vital['unit']
            }
        })
    
    # Add a lab result
    resources.append({
        "resourceType": "Observation",
        "id": str(uuid.uuid4()),
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
                "code": "2093-3",
                "display": "Cholesterol [Mass/volume] in Serum or Plasma"
            }],
            "text": "Total Cholesterol"
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "effectiveDateTime": (datetime.now() - timedelta(days=7)).isoformat(),
        "valueQuantity": {
            "value": random.randint(150, 250),
            "unit": "mg/dL"
        }
    })
    
    return resources

async def load_test_patients(num_patients: int = 5):
    """Load test patients into the FHIR server"""
    print(f"Generating and loading {num_patients} test patients...")
    
    async with httpx.AsyncClient() as client:
        for i in range(num_patients):
            print(f"\nCreating patient {i+1}/{num_patients}...")
            resources = await create_patient_bundle(i)
            
            # Create each resource
            for resource in resources:
                try:
                    response = await client.post(
                        f"http://localhost:8000/fhir/R4/{resource['resourceType']}",
                        json=resource,
                        headers={"Content-Type": "application/fhir+json"}
                    )
                    if response.status_code in [200, 201]:
                        print(f"  ✓ Created {resource['resourceType']}")
                    else:
                        print(f"  ✗ Failed to create {resource['resourceType']}: {response.status_code}")
                except Exception as e:
                    print(f"  ✗ Error creating {resource['resourceType']}: {e}")
    
    print("\n✅ Test data generation complete!")

if __name__ == "__main__":
    asyncio.run(load_test_patients(5))