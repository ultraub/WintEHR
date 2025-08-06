#!/usr/bin/env python3
"""
Test Drug Safety Enhanced Features
Tests the comprehensive drug safety checking API
"""

import asyncio
import aiohttp
import json
from datetime import datetime

# API configuration
BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/emr/clinical/drug-interactions"

async def test_basic_interaction_check():
    """Test basic drug interaction checking"""
    print("\n=== Testing Basic Drug Interaction Check ===")
    
    medications = [
        {"name": "Warfarin", "code": "855332"},
        {"name": "Aspirin", "code": "243670"}
    ]
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{BASE_URL}{API_PREFIX}/check-interactions",
            json=medications
        ) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Found {data['interaction_count']} interactions")
                for interaction in data['interactions']:
                    print(f"  - {interaction['description']} (Severity: {interaction['severity']})")
                    print(f"    Management: {interaction['management']}")
            else:
                print(f"✗ Error: {response.status}")
                print(await response.text())

async def test_comprehensive_safety_check():
    """Test comprehensive drug safety checking"""
    print("\n=== Testing Comprehensive Drug Safety Check ===")
    
    request_data = {
        "patient_id": "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9",  # Use a real patient ID
        "medications": [
            {
                "name": "Metformin",
                "code": "860974",
                "dose": "1000 mg",
                "frequency": "twice daily"
            },
            {
                "name": "Glipizide",
                "code": "4821",
                "dose": "10 mg",
                "frequency": "once daily"
            },
            {
                "name": "Ibuprofen",
                "code": "197805",
                "dose": "600 mg",
                "frequency": "as needed"
            }
        ],
        "include_current_medications": True,
        "include_allergies": True,
        "include_contraindications": True,
        "include_duplicate_therapy": True,
        "include_dosage_check": True
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{BASE_URL}{API_PREFIX}/comprehensive-safety-check",
            json=request_data
        ) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Safety Check Complete")
                print(f"  Total Alerts: {data['total_alerts']}")
                print(f"  Critical Alerts: {data['critical_alerts']}")
                print(f"  Risk Score: {data['overall_risk_score']}/10")
                
                if data['interactions']:
                    print("\n  Drug Interactions:")
                    for interaction in data['interactions']:
                        print(f"    - {interaction['drugs']} ({interaction['severity']})")
                        print(f"      {interaction['clinical_consequence']}")
                
                if data['allergy_alerts']:
                    print("\n  Allergy Alerts:")
                    for alert in data['allergy_alerts']:
                        print(f"    - {alert['drug']} vs {alert['allergen']}")
                        print(f"      {alert['management']}")
                
                if data['contraindications']:
                    print("\n  Contraindications:")
                    for contra in data['contraindications']:
                        print(f"    - {contra['drug']} contraindicated with {contra['condition']}")
                        print(f"      {contra['rationale']}")
                
                if data['duplicate_therapy']:
                    print("\n  Duplicate Therapy:")
                    for dup in data['duplicate_therapy']:
                        print(f"    - {dup['therapeutic_class']}: {', '.join(dup['drugs'])}")
                        print(f"      {dup['recommendation']}")
                
                if data['dosage_alerts']:
                    print("\n  Dosage Alerts:")
                    for dose in data['dosage_alerts']:
                        print(f"    - {dose['drug']} ({dose['issue_type']})")
                        print(f"      Current: {dose['current_dose']}, Recommended: {dose['recommended_range']}")
                
                print("\n  Recommendations:")
                for rec in data['recommendations']:
                    print(f"    - {rec}")
            else:
                print(f"✗ Error: {response.status}")
                print(await response.text())

async def test_patient_medication_summary():
    """Test patient medication summary endpoint"""
    print("\n=== Testing Patient Medication Summary ===")
    
    patient_id = "Patient/c8771406-b6fa-b1e7-4e37-c5bb2b93b1c9"  # Use a real patient ID
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{BASE_URL}{API_PREFIX}/patient/{patient_id}/medication-summary"
        ) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Patient Medication Summary")
                print(f"  Current Medications: {data['medication_count']}")
                print(f"  Active Allergies: {data['allergy_count']}")
                print(f"  Active Conditions: {data['condition_count']}")
                print(f"  Current Interactions: {data['interaction_count']}")
                
                if data['current_medications']:
                    print("\n  Medications:")
                    for med in data['current_medications'][:3]:  # Show first 3
                        print(f"    - {med['name']} ({med.get('dose', 'N/A')})")
                
                if data['allergies']:
                    print("\n  Allergies:")
                    for allergy in data['allergies']:
                        print(f"    - {allergy['substance']} ({allergy['category']})")
                
                if data['current_interactions']:
                    print("\n  Current Drug Interactions:")
                    for interaction in data['current_interactions']:
                        print(f"    - {interaction['description']} ({interaction['severity']})")
            else:
                print(f"✗ Error: {response.status}")
                print(await response.text())

async def test_interaction_database():
    """Test interaction database endpoint"""
    print("\n=== Testing Interaction Database ===")
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{BASE_URL}{API_PREFIX}/interaction-database"
        ) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Interaction Database")
                print(f"  Total Interactions: {data['total_interactions']}")
                
                # Show first few interactions
                for key, interaction in list(data['interactions'].items())[:3]:
                    print(f"\n  {key}:")
                    print(f"    Drugs: {', '.join(interaction['drugs'])}")
                    print(f"    Severity: {interaction['severity']}")
                    print(f"    Description: {interaction['description']}")
            else:
                print(f"✗ Error: {response.status}")
                print(await response.text())

async def main():
    """Run all tests"""
    print("Drug Safety Enhanced Testing")
    print("============================")
    
    # Get a real patient ID first
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{BASE_URL}/fhir/R4/Patient?_count=1"
        ) as response:
            if response.status == 200:
                bundle = await response.json()
                if bundle.get('entry'):
                    patient_id = bundle['entry'][0]['resource']['id']
                    print(f"Using patient ID: {patient_id}")
                    
                    # Update patient ID in tests
                    global TEST_PATIENT_ID
                    TEST_PATIENT_ID = f"Patient/{patient_id}"
    
    await test_basic_interaction_check()
    await test_comprehensive_safety_check()
    await test_patient_medication_summary()
    await test_interaction_database()
    
    print("\n✓ All tests completed!")

if __name__ == "__main__":
    asyncio.run(main())