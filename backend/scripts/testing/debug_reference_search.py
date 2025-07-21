#!/usr/bin/env python3
"""Debug reference search issues."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


async def debug_references():
    async with get_db_context() as db:
        # Get a patient with resources
        result = await db.execute(text("""
            SELECT 
                c.compartment_id as patient_id,
                COUNT(*) as total_resources
            FROM fhir.compartments c
            JOIN fhir.resources r ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            AND r.deleted = false
            GROUP BY c.compartment_id
            ORDER BY total_resources DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            print(f"Patient: {patient.patient_id}")
            print(f"Total resources in compartment: {patient.total_resources}")
            
            # Check observations directly
            result = await db.execute(text("""
                SELECT COUNT(*) as count
                FROM fhir.resources r
                WHERE r.resource_type = 'Observation'
                AND r.deleted = false
                AND r.resource->'subject'->>'reference' = :ref
            """), {'ref': f'Patient/{patient.patient_id}'})
            obs_count = result.scalar()
            print(f"\nObservations with subject reference = Patient/{patient.patient_id}: {obs_count}")
            
            # Check if references might be in different format
            result = await db.execute(text("""
                SELECT DISTINCT resource->'subject'->>'reference' as ref
                FROM fhir.resources
                WHERE resource_type = 'Observation'
                AND deleted = false
                AND resource->>'subject' IS NOT NULL
                LIMIT 10
            """))
            refs = result.fetchall()
            print("\nSample observation subject references:")
            for ref in refs:
                print(f"  {ref.ref}")
            
            # Check search parameters
            result = await db.execute(text("""
                SELECT COUNT(DISTINCT sp.resource_id) as count
                FROM fhir.search_params sp
                JOIN fhir.resources r ON r.id = sp.resource_id
                WHERE sp.resource_type = 'Observation'
                AND sp.param_name = 'patient'
                AND sp.value_reference = :ref
                AND r.deleted = false
            """), {'ref': f'Patient/{patient.patient_id}'})
            search_count = result.scalar()
            print(f"\nObservations indexed with patient search param: {search_count}")
            
            # Check if references are stored without prefix
            result = await db.execute(text("""
                SELECT COUNT(DISTINCT sp.resource_id) as count
                FROM fhir.search_params sp
                JOIN fhir.resources r ON r.id = sp.resource_id
                WHERE sp.resource_type = 'Observation'
                AND sp.param_name = 'patient'
                AND sp.value_reference = :ref
                AND r.deleted = false
            """), {'ref': patient.patient_id})
            search_count2 = result.scalar()
            print(f"Observations indexed with patient ID only: {search_count2}")
            
            # Check how references are actually stored
            result = await db.execute(text("""
                SELECT DISTINCT value_reference
                FROM fhir.search_params
                WHERE resource_type = 'Observation'
                AND param_name = 'patient'
                LIMIT 10
            """))
            refs = result.fetchall()
            print("\nSample patient references in search params:")
            for ref in refs:
                print(f"  {ref.value_reference}")


if __name__ == "__main__":
    asyncio.run(debug_references())