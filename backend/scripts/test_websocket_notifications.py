#!/usr/bin/env python3
"""
Test script for WebSocket notifications
Creates sample FHIR resources to trigger real-time updates
"""

import asyncio
import json
import random
from datetime import datetime, timezone
from decimal import Decimal
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Import the storage engine
import sys
sys.path.append('..')
from core.fhir.storage import FHIRStorageEngine
from database import DATABASE_URL

# Test patient ID - you'll need to update this with an actual patient ID from your database
TEST_PATIENT_ID = "test-patient-id"

async def create_test_observation(session: AsyncSession, patient_id: str):
    """Create a test lab observation."""
    storage = FHIRStorageEngine(session)
    
    # Lab test names and normal ranges
    lab_tests = [
        ("Hemoglobin", "g/dL", 12.0, 16.0),
        ("White Blood Cell Count", "10*3/uL", 4.5, 11.0),
        ("Platelet Count", "10*3/uL", 150, 450),
        ("Glucose", "mg/dL", 70, 100),
        ("Creatinine", "mg/dL", 0.6, 1.2),
        ("Potassium", "mmol/L", 3.5, 5.0),
        ("Sodium", "mmol/L", 136, 145),
    ]
    
    test_name, unit, low, high = random.choice(lab_tests)
    value = round(random.uniform(low * 0.8, high * 1.2), 2)
    
    # Determine if value is abnormal
    interpretation = "normal"
    if value < low:
        interpretation = "low"
    elif value > high:
        interpretation = "high"
    
    observation = {
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
                "code": "XXXXX-X",  # Placeholder LOINC code
                "display": test_name
            }],
            "text": test_name
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "effectiveDateTime": datetime.now(timezone.utc).isoformat(),
        "valueQuantity": {
            "value": float(value),
            "unit": unit,
            "system": "http://unitsofmeasure.org",
            "code": unit
        },
        "referenceRange": [{
            "low": {
                "value": float(low),
                "unit": unit
            },
            "high": {
                "value": float(high),
                "unit": unit
            }
        }]
    }
    
    if interpretation != "normal":
        observation["interpretation"] = [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                "code": interpretation.upper(),
                "display": interpretation.capitalize()
            }]
        }]
    
    # Create the observation - this will trigger WebSocket notification
    fhir_id, version_id, last_updated = await storage.create_resource(
        "Observation",
        observation
    )
    
    print(f"Created Observation/{fhir_id}: {test_name} = {value} {unit} ({interpretation})")
    
    return fhir_id


async def create_critical_observation(session: AsyncSession, patient_id: str):
    """Create a critical lab result that should trigger alerts."""
    storage = FHIRStorageEngine(session)
    
    # Critical value - very high glucose
    observation = {
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
                "code": "2339-0",
                "display": "Glucose"
            }],
            "text": "Glucose (Critical High)"
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "effectiveDateTime": datetime.now(timezone.utc).isoformat(),
        "valueQuantity": {
            "value": 450.0,  # Critical high value
            "unit": "mg/dL",
            "system": "http://unitsofmeasure.org",
            "code": "mg/dL"
        },
        "interpretation": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                "code": "HH",
                "display": "Critical high"
            }]
        }],
        "referenceRange": [{
            "low": {
                "value": 70.0,
                "unit": "mg/dL"
            },
            "high": {
                "value": 100.0,
                "unit": "mg/dL"
            }
        }]
    }
    
    # Create the observation
    fhir_id, version_id, last_updated = await storage.create_resource(
        "Observation",
        observation
    )
    
    print(f"Created CRITICAL Observation/{fhir_id}: Glucose = 450 mg/dL")
    
    # In a real system, this would trigger a critical result notification
    # through the notification service
    from api.websocket.fhir_notifications import notification_service
    await notification_service.notify_clinical_event(
        event_type="critical_result",
        resource_type="Observation",
        resource_id=fhir_id,
        patient_id=patient_id,
        details={
            "message": "Critical glucose level: 450 mg/dL (Normal: 70-100)",
            "severity": "critical",
            "test_name": "Glucose",
            "value": "450 mg/dL",
            "requires_action": True
        }
    )
    
    return fhir_id


async def create_diagnostic_report(session: AsyncSession, patient_id: str, observation_ids: list):
    """Create a diagnostic report with the given observations."""
    storage = FHIRStorageEngine(session)
    
    report = {
        "resourceType": "DiagnosticReport",
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                "code": "LAB",
                "display": "Laboratory"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": "58410-2",
                "display": "Complete blood count (CBC) panel"
            }],
            "text": "Complete Blood Count"
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "effectiveDateTime": datetime.now(timezone.utc).isoformat(),
        "issued": datetime.now(timezone.utc).isoformat(),
        "result": [
            {"reference": f"Observation/{obs_id}"}
            for obs_id in observation_ids
        ]
    }
    
    # Create the report - this will trigger WebSocket notification
    fhir_id, version_id, last_updated = await storage.create_resource(
        "DiagnosticReport",
        report
    )
    
    print(f"Created DiagnosticReport/{fhir_id} with {len(observation_ids)} observations")
    
    return fhir_id


async def main():
    """Main test function."""
    print("WebSocket Notification Test Script")
    print("==================================")
    
    # Create database connection
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get a test patient ID (you'll need to update this)
        result = await session.execute(
            "SELECT fhir_id FROM fhir.resources WHERE resource_type = 'Patient' LIMIT 1"
        )
        row = result.first()
        if row:
            patient_id = row[0]
            print(f"Using patient ID: {patient_id}")
        else:
            print("No patients found in database. Please create some patients first.")
            return
        
        print("\nCreating test observations...")
        observation_ids = []
        
        # Create several normal observations
        for i in range(3):
            obs_id = await create_test_observation(session, patient_id)
            observation_ids.append(obs_id)
            await asyncio.sleep(1)  # Space out the notifications
        
        # Create a critical observation
        print("\nCreating critical observation...")
        critical_id = await create_critical_observation(session, patient_id)
        observation_ids.append(critical_id)
        
        # Create a diagnostic report
        print("\nCreating diagnostic report...")
        await asyncio.sleep(2)
        await create_diagnostic_report(session, patient_id, observation_ids)
        
        print("\nTest complete! Check your frontend for real-time notifications.")
        print("Make sure you have:")
        print("1. The frontend running and logged in")
        print("2. The patient chart open for the test patient")
        print("3. The WebSocket connection established (check browser console)")


if __name__ == "__main__":
    asyncio.run(main())