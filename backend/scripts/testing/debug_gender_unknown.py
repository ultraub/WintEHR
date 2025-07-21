#!/usr/bin/env python3
"""Debug why gender=unknown search returns 0 results."""

import asyncio
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


async def debug_gender_unknown():
    """Debug the gender=unknown search issue."""
    async with get_db_context() as db:
        print("=== Debugging gender=unknown search issue ===\n")
        
        # 1. Get all patients with gender=unknown
        print("1. Patients with gender='unknown' in resources table:")
        result = await db.execute(text("""
            SELECT fhir_id, resource->>'gender' as gender
            FROM fhir.resources 
            WHERE resource_type = 'Patient' 
            AND resource->>'gender' = 'unknown'
            LIMIT 10
        """))
        patients = result.fetchall()
        for patient in patients:
            print(f"   Patient {patient.fhir_id}: gender={patient.gender}")
        
        # 2. Check search params for these patients
        print("\n2. Search parameters for gender='unknown':")
        result = await db.execute(text("""
            SELECT sp.resource_id, r.fhir_id, sp.param_name, sp.value_token, sp.value_token_code
            FROM fhir.search_params sp
            JOIN fhir.resources r ON r.id = sp.resource_id
            WHERE sp.resource_type = 'Patient' 
            AND sp.param_name = 'gender'
            AND (sp.value_token = 'unknown' OR sp.value_token_code = 'unknown')
        """))
        search_params = result.fetchall()
        print(f"   Found {len(search_params)} search parameters")
        for sp in search_params:
            print(f"   Resource {sp.fhir_id}: value_token={sp.value_token}, value_token_code={sp.value_token_code}")
        
        # 3. Check if there are any NULL value_token entries
        print("\n3. Checking for NULL value_token entries:")
        result = await db.execute(text("""
            SELECT COUNT(*) 
            FROM fhir.search_params 
            WHERE resource_type = 'Patient' 
            AND param_name = 'gender'
            AND value_token IS NULL
            AND value_token_code = 'unknown'
        """))
        null_count = result.scalar()
        print(f"   Found {null_count} entries with NULL value_token but value_token_code='unknown'")
        
        # 4. Get sample of actual search param data
        print("\n4. Sample of all gender search params:")
        result = await db.execute(text("""
            SELECT param_name, value_token, value_token_code, COUNT(*) as count
            FROM fhir.search_params 
            WHERE resource_type = 'Patient' 
            AND param_name = 'gender'
            GROUP BY param_name, value_token, value_token_code
            ORDER BY count DESC
        """))
        groups = result.fetchall()
        for group in groups:
            print(f"   value_token={group.value_token}, value_token_code={group.value_token_code}: {group.count} entries")
        
        # 5. Test the actual SQL query that would be used
        print("\n5. Testing the actual search SQL:")
        result = await db.execute(text("""
            SELECT r.fhir_id
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp1 ON sp1.resource_id = r.id
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND sp1.param_name = 'gender'
            AND (sp1.value_token = 'unknown' OR sp1.value_token_code = 'unknown')
            LIMIT 5
        """))
        results = result.fetchall()
        print(f"   Query returned {len(results)} results")
        for res in results:
            print(f"   - {res.fhir_id}")
        
        # 6. Check if the issue is with the LEFT JOIN
        print("\n6. Testing with INNER JOIN instead:")
        result = await db.execute(text("""
            SELECT r.fhir_id
            FROM fhir.resources r
            INNER JOIN fhir.search_params sp1 ON sp1.resource_id = r.id
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND sp1.param_name = 'gender'
            AND sp1.value_token_code = 'unknown'
            LIMIT 5
        """))
        results = result.fetchall()
        print(f"   Query returned {len(results)} results")
        
        # 7. Direct check - are the value_token values actually NULL?
        print("\n7. Direct check of search params:")
        result = await db.execute(text("""
            SELECT sp.id, sp.value_token, sp.value_token_code, 
                   sp.value_token IS NULL as token_is_null,
                   sp.value_token_code IS NULL as code_is_null
            FROM fhir.search_params sp
            WHERE sp.resource_type = 'Patient' 
            AND sp.param_name = 'gender'
            AND sp.value_token_code = 'unknown'
            LIMIT 5
        """))
        entries = result.fetchall()
        for entry in entries:
            print(f"   ID {entry.id}: value_token={entry.value_token} (NULL: {entry.token_is_null}), "
                  f"value_token_code={entry.value_token_code} (NULL: {entry.code_is_null})")


if __name__ == "__main__":
    asyncio.run(debug_gender_unknown())