#!/usr/bin/env python3
"""Check the status of patients with gender='unknown'."""

import asyncio
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


async def check_unknown_gender_status():
    """Check if patients with gender='unknown' are deleted."""
    async with get_db_context() as db:
        print("=== Checking status of patients with gender='unknown' ===\n")
        
        # Get all patients with gender='unknown' and their deleted status
        result = await db.execute(text("""
            SELECT 
                r.fhir_id,
                r.deleted,
                r.resource->>'gender' as gender,
                sp.id as search_param_id,
                sp.value_token,
                sp.value_token_code
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON sp.resource_id = r.id AND sp.param_name = 'gender'
            WHERE r.resource_type = 'Patient' 
            AND r.resource->>'gender' = 'unknown'
            ORDER BY r.deleted, r.fhir_id
        """))
        
        patients = result.fetchall()
        
        # Group by deleted status
        not_deleted = [p for p in patients if not p.deleted]
        deleted = [p for p in patients if p.deleted]
        
        print(f"Total patients with gender='unknown': {len(set(p.fhir_id for p in patients))}")
        print(f"  - Active (not deleted): {len(set(p.fhir_id for p in not_deleted))}")
        print(f"  - Deleted: {len(set(p.fhir_id for p in deleted))}")
        
        print("\n--- Active patients with gender='unknown' ---")
        for p in not_deleted:
            if p.search_param_id:
                print(f"Patient {p.fhir_id}: deleted={p.deleted}, search_param indexed: YES (token={p.value_token})")
            else:
                print(f"Patient {p.fhir_id}: deleted={p.deleted}, search_param indexed: NO")
        
        print("\n--- Deleted patients with gender='unknown' ---")
        for p in deleted:
            if p.search_param_id:
                print(f"Patient {p.fhir_id}: deleted={p.deleted}, search_param indexed: YES (token={p.value_token})")
            else:
                print(f"Patient {p.fhir_id}: deleted={p.deleted}, search_param indexed: NO")
        
        # Check search params for non-deleted patients
        print("\n--- Verifying search should find active patients ---")
        result = await db.execute(text("""
            SELECT COUNT(DISTINCT r.id)
            FROM fhir.resources r
            INNER JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND sp.param_name = 'gender'
            AND sp.value_token = 'unknown'
        """))
        count = result.scalar()
        print(f"Query with INNER JOIN finds: {count} active patients")
        
        # Test with actual values
        print("\n--- Checking actual search param values ---")
        result = await db.execute(text("""
            SELECT DISTINCT sp.value_token, sp.value_token_code, COUNT(*) as count
            FROM fhir.search_params sp
            JOIN fhir.resources r ON r.id = sp.resource_id
            WHERE sp.resource_type = 'Patient'
            AND sp.param_name = 'gender'
            AND r.deleted = false
            GROUP BY sp.value_token, sp.value_token_code
            ORDER BY count DESC
        """))
        values = result.fetchall()
        for v in values:
            print(f"  value_token='{v.value_token}', value_token_code='{v.value_token_code}': {v.count} active patients")


if __name__ == "__main__":
    asyncio.run(check_unknown_gender_status())