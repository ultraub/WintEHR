#!/usr/bin/env python3
"""
Test CDS Hook Drug Safety Integration
Tests the enhanced drug safety checking through CDS Hooks
"""

import asyncio
import aiohttp
import json
from datetime import datetime

# API configuration
BASE_URL = "http://localhost:8000"
CDS_HOOKS_BASE = f"{BASE_URL}/cds-services"

async def test_cds_services_discovery():
    """Test CDS services discovery endpoint"""
    print("\n=== Testing CDS Services Discovery ===")
    
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{CDS_HOOKS_BASE}") as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Found {len(data['services'])} CDS services")
                
                # Look for medication-prescribe hook
                med_prescribe_services = [s for s in data['services'] if s['hook'] == 'medication-prescribe']
                print(f"  Medication prescribe services: {len(med_prescribe_services)}")
                
                for service in med_prescribe_services:
                    print(f"  - {service['id']}: {service['title']}")
                    print(f"    {service['description']}")
            else:
                print(f"✗ Error: {response.status}")

async def test_medication_prescribe_hook():
    """Test medication-prescribe hook with drug safety checking"""
    print("\n=== Testing Medication Prescribe Hook ===")
    
    # Prepare CDS hook request
    hook_request = {
        "hook": "medication-prescribe",
        "hookInstance": "test-drug-safety-001",
        "patient": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9",
        "userId": "Practitioner/demo",
        "context": {
            "patientId": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9",
            "encounterId": "Encounter/test",
            "draftOrders": [{
                "resourceType": "MedicationRequest",
                "status": "draft",
                "intent": "order",
                "medicationCodeableConcept": {
                    "coding": [{
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "855332",
                        "display": "Warfarin 5mg"
                    }],
                    "text": "Warfarin 5mg"
                },
                "subject": {
                    "reference": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9"
                },
                "dosageInstruction": [{
                    "text": "Take 1 tablet by mouth daily",
                    "timing": {
                        "repeat": {
                            "frequency": 1,
                            "period": 1,
                            "periodUnit": "d"
                        }
                    },
                    "doseAndRate": [{
                        "doseQuantity": {
                            "value": 5,
                            "unit": "mg",
                            "system": "http://unitsofmeasure.org",
                            "code": "mg"
                        }
                    }],
                    "route": {
                        "coding": [{
                            "system": "http://snomed.info/sct",
                            "code": "26643006",
                            "display": "Oral route"
                        }],
                        "text": "Oral"
                    }
                }]
            }]
        },
        "prefetch": {
            "medicationRequests": {
                "resourceType": "Bundle",
                "type": "searchset",
                "entry": [
                    {
                        "resource": {
                            "resourceType": "MedicationRequest",
                            "id": "existing-med-1",
                            "status": "active",
                            "medicationCodeableConcept": {
                                "coding": [{
                                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                                    "code": "243670",
                                    "display": "Aspirin 81mg"
                                }],
                                "text": "Aspirin 81mg"
                            },
                            "subject": {
                                "reference": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9"
                            }
                        }
                    },
                    {
                        "resource": {
                            "resourceType": "MedicationRequest",
                            "id": "existing-med-2",
                            "status": "active",
                            "medicationCodeableConcept": {
                                "coding": [{
                                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                                    "code": "860974",
                                    "display": "Metformin 1000mg"
                                }],
                                "text": "Metformin 1000mg"
                            },
                            "subject": {
                                "reference": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9"
                            }
                        }
                    }
                ]
            },
            "allergyIntolerances": {
                "resourceType": "Bundle",
                "type": "searchset",
                "entry": [
                    {
                        "resource": {
                            "resourceType": "AllergyIntolerance",
                            "id": "allergy-1",
                            "clinicalStatus": {
                                "coding": [{
                                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                                    "code": "active"
                                }]
                            },
                            "code": {
                                "coding": [{
                                    "system": "http://snomed.info/sct",
                                    "code": "387406002",
                                    "display": "Sulfonamide antibacterial"
                                }],
                                "text": "Sulfa drugs"
                            },
                            "patient": {
                                "reference": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9"
                            },
                            "criticality": "high"
                        }
                    }
                ]
            }
        }
    }
    
    async with aiohttp.ClientSession() as session:
        # Execute drug interaction check hook
        print("\nTesting drug-interaction-check hook...")
        async with session.post(
            f"{CDS_HOOKS_BASE}/drug-interaction-check",
            json=hook_request,
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Hook executed successfully")
                print(f"  Cards returned: {len(data.get('cards', []))}")
                
                for card in data.get('cards', []):
                    print(f"\n  Card: {card['summary']}")
                    print(f"    Severity: {card['indicator']}")
                    print(f"    Detail: {card['detail'][:100]}...")
                    
                    if card.get('suggestions'):
                        print(f"    Suggestions:")
                        for suggestion in card['suggestions']:
                            print(f"      - {suggestion['label']}")
            else:
                print(f"✗ Error: {response.status}")
                print(await response.text())
        
        # Execute allergy check hook
        print("\n\nTesting allergy-check hook...")
        async with session.post(
            f"{CDS_HOOKS_BASE}/allergy-check",
            json=hook_request,
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Hook executed successfully")
                print(f"  Cards returned: {len(data.get('cards', []))}")
                
                for card in data.get('cards', []):
                    print(f"\n  Card: {card['summary']}")
                    print(f"    Severity: {card['indicator']}")
                    print(f"    Detail: {card['detail']}")
            else:
                print(f"✗ Error: {response.status}")

async def test_complex_drug_scenario():
    """Test a complex drug scenario with multiple safety issues"""
    print("\n=== Testing Complex Drug Scenario ===")
    
    # Prepare hook request with multiple issues
    hook_request = {
        "hook": "medication-prescribe",
        "hookInstance": "test-complex-001",
        "patient": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9",
        "userId": "Practitioner/demo",
        "context": {
            "patientId": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9",
            "encounterId": "Encounter/test",
            "draftOrders": [{
                "resourceType": "MedicationRequest",
                "status": "draft",
                "intent": "order",
                "medicationCodeableConcept": {
                    "coding": [{
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "197805",
                        "display": "Ibuprofen 800mg"
                    }],
                    "text": "Ibuprofen 800mg"
                },
                "subject": {
                    "reference": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9"
                },
                "dosageInstruction": [{
                    "text": "Take 2 tablets by mouth every 6 hours",
                    "timing": {
                        "repeat": {
                            "frequency": 4,
                            "period": 1,
                            "periodUnit": "d"
                        }
                    },
                    "doseAndRate": [{
                        "doseQuantity": {
                            "value": 1600,
                            "unit": "mg",
                            "system": "http://unitsofmeasure.org",
                            "code": "mg"
                        }
                    }]
                }]
            }]
        },
        "prefetch": {}  # Will use comprehensive check to fetch patient data
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{CDS_HOOKS_BASE}/drug-interaction-check",
            json=hook_request,
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Complex scenario executed")
                print(f"  Total cards: {len(data.get('cards', []))}")
                
                # Group cards by type
                card_types = {}
                for card in data.get('cards', []):
                    card_type = card['summary'].split(':')[0]
                    if card_type not in card_types:
                        card_types[card_type] = []
                    card_types[card_type].append(card)
                
                print("\n  Cards by type:")
                for card_type, cards in card_types.items():
                    print(f"    {card_type}: {len(cards)} cards")
                    for card in cards[:2]:  # Show first 2 of each type
                        print(f"      - {card['summary']}")
            else:
                print(f"✗ Error: {response.status}")

async def test_cds_feedback():
    """Test CDS feedback endpoint"""
    print("\n=== Testing CDS Feedback ===")
    
    feedback_data = {
        "feedback": [{
            "card": "card-uuid-001",
            "outcome": "accepted",
            "outcomeTimestamp": datetime.utcnow().isoformat() + "Z",
            "acceptedSuggestions": []
        }]
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{CDS_HOOKS_BASE}/feedback",
            json=feedback_data,
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status == 200:
                print("✓ Feedback accepted")
            else:
                print(f"✗ Error: {response.status}")

async def main():
    """Run all tests"""
    print("CDS Hook Drug Safety Integration Testing")
    print("=======================================")
    
    await test_cds_services_discovery()
    await test_medication_prescribe_hook()
    await test_complex_drug_scenario()
    await test_cds_feedback()
    
    print("\n✓ All tests completed!")

if __name__ == "__main__":
    asyncio.run(main())