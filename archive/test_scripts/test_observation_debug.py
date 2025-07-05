import requests
import json

# Test observation with components
component_obs = {
    "resourceType": "Observation",
    "status": "final",
    "category": [
        {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "vital-signs",
                    "display": "Vital Signs"
                }
            ]
        }
    ],
    "code": {
        "coding": [
            {
                "system": "http://loinc.org",
                "code": "85354-9",
                "display": "Blood pressure panel"
            }
        ]
    },
    "subject": {"reference": "Patient/test"},
    "effectiveDateTime": "2024-01-15T10:30:00Z",
    "component": [
        {
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "8480-6",
                        "display": "Systolic blood pressure"
                    }
                ]
            },
            "valueQuantity": {
                "value": 120,
                "unit": "mmHg",
                "system": "http://unitsofmeasure.org",
                "code": "mm[Hg]"
            }
        },
        {
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "8462-4",
                        "display": "Diastolic blood pressure"
                    }
                ]
            },
            "valueQuantity": {
                "value": 80,
                "unit": "mmHg",
                "system": "http://unitsofmeasure.org",
                "code": "mm[Hg]"
            }
        }
    ]
}

response = requests.post("http://localhost:8000/fhir/R4/Observation", json=component_obs)
print(f"Status: {response.status_code}")
if response.status_code != 201:
    print(f"Response: {response.text}")
else:
    print("Success!")
