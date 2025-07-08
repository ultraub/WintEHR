#!/usr/bin/env python3
"""
Create order sets using FHIR Questionnaire resources.
Since PlanDefinition is not yet supported, we'll use Questionnaire
to store structured order set definitions.
"""

import asyncio
import json
import httpx
from datetime import datetime
import logging


FHIR_BASE_URL = "http://localhost:8000/fhir/R4"

# Define order sets as Questionnaires with structured items
ORDER_SETS = [
    {
        "id": "order-set-admission-basic",
        "name": "BasicAdmissionOrders",
        "title": "Basic Admission Orders",
        "description": "Standard order set for hospital admissions",
        "status": "active",
        "subjectType": ["Patient"],
        "code": [{
            "system": "http://medgenemr.com/order-set-type",
            "code": "admission-basic",
            "display": "Basic Admission Orders"
        }],
        "item": [
            {
                "linkId": "1",
                "text": "Comprehensive Metabolic Panel",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "24323-8",
                    "display": "Comprehensive metabolic 2000 panel - Serum or Plasma"
                }],
                "extension": [{
                    "url": "http://medgenemr.com/order-type",
                    "valueCode": "laboratory"
                }]
            },
            {
                "linkId": "2",
                "text": "Complete Blood Count with Differential",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "58410-2",
                    "display": "Complete blood count (hemogram) panel - Blood by Automated count"
                }],
                "extension": [{
                    "url": "http://medgenemr.com/order-type",
                    "valueCode": "laboratory"
                }]
            },
            {
                "linkId": "3",
                "text": "Chest X-ray PA and Lateral",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "36643-5",
                    "display": "Chest X-ray"
                }],
                "extension": [{
                    "url": "http://medgenemr.com/order-type",
                    "valueCode": "imaging"
                }]
            }
        ]
    },
    {
        "id": "order-set-cardiac-workup",
        "name": "CardiacWorkup",
        "title": "Cardiac Workup Order Set",
        "description": "Standard order set for cardiac evaluation",
        "status": "active",
        "subjectType": ["Patient"],
        "code": [{
            "system": "http://medgenemr.com/order-set-type",
            "code": "cardiac-workup",
            "display": "Cardiac Workup"
        }],
        "item": [
            {
                "linkId": "1",
                "text": "Troponin I - Serial x3",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "42757-5",
                    "display": "Troponin I.cardiac [Mass/volume] in Blood"
                }],
                "extension": [
                    {
                        "url": "http://medgenemr.com/order-type",
                        "valueCode": "laboratory"
                    },
                    {
                        "url": "http://medgenemr.com/order-frequency",
                        "valueString": "q8h x 3"
                    }
                ]
            },
            {
                "linkId": "2",
                "text": "NT-proBNP",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "33762-6",
                    "display": "Natriuretic peptide.B prohormone N-Terminal [Mass/volume] in Serum or Plasma"
                }],
                "extension": [{
                    "url": "http://medgenemr.com/order-type",
                    "valueCode": "laboratory"
                }]
            },
            {
                "linkId": "3",
                "text": "12-Lead EKG STAT",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "11524-6",
                    "display": "EKG study"
                }],
                "extension": [
                    {
                        "url": "http://medgenemr.com/order-type",
                        "valueCode": "procedure"
                    },
                    {
                        "url": "http://medgenemr.com/order-priority",
                        "valueCode": "stat"
                    }
                ]
            }
        ]
    },
    {
        "id": "order-set-diabetes-monitoring",
        "name": "DiabetesMonitoring",
        "title": "Diabetes Monitoring Order Set",
        "description": "Standard order set for diabetes management",
        "status": "active",
        "subjectType": ["Patient"],
        "code": [{
            "system": "http://medgenemr.com/order-set-type",
            "code": "diabetes-monitoring",
            "display": "Diabetes Monitoring"
        }],
        "item": [
            {
                "linkId": "1",
                "text": "Hemoglobin A1c",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "4548-4",
                    "display": "Hemoglobin A1c/Hemoglobin.total in Blood"
                }],
                "extension": [{
                    "url": "http://medgenemr.com/order-type",
                    "valueCode": "laboratory"
                }]
            },
            {
                "linkId": "2",
                "text": "Fasting Glucose",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "1558-6",
                    "display": "Fasting glucose [Mass/volume] in Serum or Plasma"
                }],
                "extension": [{
                    "url": "http://medgenemr.com/order-type",
                    "valueCode": "laboratory"
                }]
            },
            {
                "linkId": "3",
                "text": "Lipid Panel",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "57698-3",
                    "display": "Lipid panel with direct LDL - Serum or Plasma"
                }],
                "extension": [{
                    "url": "http://medgenemr.com/order-type",
                    "valueCode": "laboratory"
                }]
            },
            {
                "linkId": "4",
                "text": "Urine Microalbumin",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "14959-1",
                    "display": "Microalbumin [Mass/volume] in Urine"
                }],
                "extension": [{
                    "url": "http://medgenemr.com/order-type",
                    "valueCode": "laboratory"
                }]
            }
        ]
    },
    {
        "id": "order-set-sepsis-bundle",
        "name": "SepsisBundle",
        "title": "Sepsis Bundle Order Set",
        "description": "3-hour sepsis bundle orders",
        "status": "active",
        "subjectType": ["Patient"],
        "code": [{
            "system": "http://medgenemr.com/order-set-type",
            "code": "sepsis-bundle",
            "display": "Sepsis Bundle"
        }],
        "item": [
            {
                "linkId": "1",
                "text": "Lactate Level STAT",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "2524-7",
                    "display": "Lactate [Mass/volume] in Serum or Plasma"
                }],
                "extension": [
                    {
                        "url": "http://medgenemr.com/order-type",
                        "valueCode": "laboratory"
                    },
                    {
                        "url": "http://medgenemr.com/order-priority",
                        "valueCode": "stat"
                    }
                ]
            },
            {
                "linkId": "2",
                "text": "Blood Cultures x2 sets",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://loinc.org",
                    "code": "600-7",
                    "display": "Bacteria identified in Blood by Culture"
                }],
                "extension": [
                    {
                        "url": "http://medgenemr.com/order-type",
                        "valueCode": "laboratory"
                    },
                    {
                        "url": "http://medgenemr.com/order-priority",
                        "valueCode": "urgent"
                    }
                ]
            },
            {
                "linkId": "3",
                "text": "Broad Spectrum Antibiotics (within 1 hour)",
                "type": "boolean",
                "initial": [{
                    "valueBoolean": True
                }],
                "code": [{
                    "system": "http://snomed.info/sct",
                    "code": "281789004",
                    "display": "Antibiotic therapy"
                }],
                "extension": [
                    {
                        "url": "http://medgenemr.com/order-type",
                        "valueCode": "medication"
                    },
                    {
                        "url": "http://medgenemr.com/order-priority",
                        "valueCode": "stat"
                    }
                ]
            }
        ]
    }
]

async def create_order_set(order_set_data):
    """Create a single order set as a Questionnaire resource."""
    questionnaire = {
        "resourceType": "Questionnaire",
        "id": order_set_data["id"],
        "status": order_set_data["status"],
        "name": order_set_data["name"],
        "title": order_set_data["title"],
        "description": order_set_data["description"],
        "subjectType": order_set_data["subjectType"],
        "date": datetime.now().isoformat(),
        "publisher": "MedGenEMR",
        "code": order_set_data.get("code", []),
        "item": order_set_data["item"]
    }
    
    async with httpx.AsyncClient() as client:
        # Try to update if exists, otherwise create
        response = await client.put(
            f"{FHIR_BASE_URL}/Questionnaire/{order_set_data['id']}",
            json=questionnaire,
            headers={"Content-Type": "application/fhir+json"}
        )
        
        if response.status_code not in [200, 201]:
            # Try create instead
            response = await client.post(
                f"{FHIR_BASE_URL}/Questionnaire",
                json=questionnaire,
                headers={"Content-Type": "application/fhir+json"}
            )
        
        if response.status_code in [200, 201]:
            logging.info(f"✅ Created Order Set: {order_set_data['title']}")
            return True
        else:
            logging.info(f"❌ Failed to create Order Set: {response.status_code}")
            logging.info(response.text)
            return False

async def main():
    """Create all order sets."""
    logging.info("🏥 Creating Order Sets as FHIR Questionnaires")
    logging.info("=" * 60)
    created_count = 0
    for order_set in ORDER_SETS:
        if await create_order_set(order_set):
            created_count += 1
    
    logging.info(f"\n✅ Created {created_count}/{len(ORDER_SETS)} Order Sets")
if __name__ == "__main__":
    asyncio.run(main())