#!/usr/bin/env python3
"""
Simple test data loader for MedGenEMR
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append('/app')

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample test data - minimal FHIR resources
TEST_PATIENT = {
    "resourceType": "Patient",
    "identifier": [{
        "system": "http://example.org/mrn",
        "value": "TEST001"
    }],
    "name": [{
        "family": "Test",
        "given": ["John"]
    }],
    "gender": "male",
    "birthDate": "1980-01-01"
}

TEST_OBSERVATION = {
    "resourceType": "Observation",
    "status": "final",
    "code": {
        "coding": [{
            "system": "http://loinc.org",
            "code": "8867-4",
            "display": "Heart rate"
        }]
    },
    "subject": {
        "reference": "Patient/{patient_id}"
    },
    "effectiveDateTime": "2025-01-18T10:00:00Z",
    "valueQuantity": {
        "value": 72,
        "unit": "beats/minute",
        "system": "http://unitsofmeasure.org",
        "code": "/min"
    }
}

TEST_MEDICATION_REQUEST = {
    "resourceType": "MedicationRequest",
    "status": "active",
    "intent": "order",
    "medicationCodeableConcept": {
        "coding": [{
            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
            "code": "197361",
            "display": "Ibuprofen 400 MG Oral Tablet"
        }]
    },
    "subject": {
        "reference": "Patient/{patient_id}"
    },
    "authoredOn": "2025-01-18T10:00:00Z",
    "dosageInstruction": [{
        "text": "Take 1 tablet by mouth every 6 hours as needed for pain"
    }]
}

TEST_PROCEDURE = {
    "resourceType": "Procedure",
    "status": "completed",
    "code": {
        "coding": [{
            "system": "http://snomed.info/sct",
            "code": "90385005",
            "display": "Blood pressure measurement"
        }]
    },
    "subject": {
        "reference": "Patient/{patient_id}"
    },
    "performedDateTime": "2025-01-18T10:00:00Z"
}

async def load_test_data():
    """Load minimal test data into FHIR database"""
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        # Create patient
        result = await conn.execute(
            text("""
                INSERT INTO fhir_resources (resource_type, data, version_id)
                VALUES (:resource_type, CAST(:data AS jsonb), 1)
                RETURNING id
            """),
            {
                "resource_type": "Patient",
                "data": json.dumps(TEST_PATIENT)
            }
        )
        patient_id = result.scalar()
        logger.info(f"Created Patient with ID: {patient_id}")
        
        # Update patient data with ID
        patient_data = TEST_PATIENT.copy()
        patient_data["id"] = str(patient_id)
        
        await conn.execute(
            text("""
                UPDATE fhir_resources 
                SET data = :data::jsonb
                WHERE id = :id
            """),
            {
                "id": patient_id,
                "data": json.dumps(patient_data)
            }
        )
        
        # Create observation
        obs_data = TEST_OBSERVATION.copy()
        obs_data["subject"]["reference"] = f"Patient/{patient_id}"
        
        result = await conn.execute(
            text("""
                INSERT INTO fhir_resources (resource_type, data, version_id)
                VALUES (:resource_type, :data::jsonb, 1)
                RETURNING id
            """),
            {
                "resource_type": "Observation",
                "data": json.dumps(obs_data)
            }
        )
        obs_id = result.scalar()
        obs_data["id"] = str(obs_id)
        
        await conn.execute(
            text("""
                UPDATE fhir_resources 
                SET data = :data::jsonb
                WHERE id = :id
            """),
            {
                "id": obs_id,
                "data": json.dumps(obs_data)
            }
        )
        logger.info(f"Created Observation with ID: {obs_id}")
        
        # Create medication request
        med_data = TEST_MEDICATION_REQUEST.copy()
        med_data["subject"]["reference"] = f"Patient/{patient_id}"
        
        result = await conn.execute(
            text("""
                INSERT INTO fhir_resources (resource_type, data, version_id)
                VALUES (:resource_type, :data::jsonb, 1)
                RETURNING id
            """),
            {
                "resource_type": "MedicationRequest",
                "data": json.dumps(med_data)
            }
        )
        med_id = result.scalar()
        med_data["id"] = str(med_id)
        
        await conn.execute(
            text("""
                UPDATE fhir_resources 
                SET data = :data::jsonb
                WHERE id = :id
            """),
            {
                "id": med_id,
                "data": json.dumps(med_data)
            }
        )
        logger.info(f"Created MedicationRequest with ID: {med_id}")
        
        # Create procedure
        proc_data = TEST_PROCEDURE.copy()
        proc_data["subject"]["reference"] = f"Patient/{patient_id}"
        
        result = await conn.execute(
            text("""
                INSERT INTO fhir_resources (resource_type, data, version_id)
                VALUES (:resource_type, :data::jsonb, 1)
                RETURNING id
            """),
            {
                "resource_type": "Procedure",
                "data": json.dumps(proc_data)
            }
        )
        proc_id = result.scalar()
        proc_data["id"] = str(proc_id)
        
        await conn.execute(
            text("""
                UPDATE fhir_resources 
                SET data = :data::jsonb
                WHERE id = :id
            """),
            {
                "id": proc_id,
                "data": json.dumps(proc_data)
            }
        )
        logger.info(f"Created Procedure with ID: {proc_id}")
        
    await engine.dispose()
    logger.info("Test data loaded successfully!")

if __name__ == "__main__":
    asyncio.run(load_test_data())