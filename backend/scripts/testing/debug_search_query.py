#!/usr/bin/env python3
"""Debug the exact search query issue."""

import asyncio
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


async def debug_search_query():
    """Debug why the search query returns 0 results."""
    async with get_db_context() as db:
        print("=== Debugging search query for gender=unknown ===\n")
        
        # 1. Get the resource IDs that have gender search params
        print("1. Resource IDs with gender='unknown' search params:")
        result = await db.execute(text("""
            SELECT resource_id, value_token, value_token_code
            FROM fhir.search_params
            WHERE resource_type = 'Patient'
            AND param_name = 'gender'
            AND value_token_code = 'unknown'
        """))
        resource_ids = result.fetchall()
        print(f"   Found {len(resource_ids)} resources")
        for rid in resource_ids:
            print(f"   Resource ID {rid.resource_id}: token={rid.value_token}, code={rid.value_token_code}")
        
        if resource_ids:
            # 2. Check if these resources exist in the resources table
            print("\n2. Checking if these resources exist:")
            resource_id_list = [str(rid.resource_id) for rid in resource_ids]
            result = await db.execute(text(f"""
                SELECT id, fhir_id, deleted, resource_type
                FROM fhir.resources
                WHERE id IN ({','.join([f"'{rid}'" for rid in resource_id_list])})
            """))
            resources = result.fetchall()
            print(f"   Found {len(resources)} resources in resources table")
            for res in resources:
                print(f"   ID {res.id}: fhir_id={res.fhir_id}, deleted={res.deleted}, type={res.resource_type}")
        
        # 3. Try a simpler query - direct match on value_token_code
        print("\n3. Simplified query - direct match on value_token_code:")
        result = await db.execute(text("""
            SELECT DISTINCT r.fhir_id
            FROM fhir.resources r
            JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND sp.param_name = 'gender'
            AND sp.value_token_code = 'unknown'
        """))
        results = result.fetchall()
        print(f"   Found {len(results)} results")
        for res in results:
            print(f"   - {res.fhir_id}")
        
        # 4. Check if the issue is case sensitivity
        print("\n4. Checking case sensitivity:")
        result = await db.execute(text("""
            SELECT DISTINCT value_token, value_token_code, COUNT(*) as count
            FROM fhir.search_params
            WHERE resource_type = 'Patient'
            AND param_name = 'gender'
            GROUP BY value_token, value_token_code
        """))
        values = result.fetchall()
        for val in values:
            print(f"   '{val.value_token}' / '{val.value_token_code}': {val.count} entries")
        
        # 5. Test with explicit parameter values
        print("\n5. Testing with explicit parameter binding:")
        result = await db.execute(
            text("""
                SELECT r.fhir_id
                FROM fhir.resources r
                JOIN fhir.search_params sp ON sp.resource_id = r.id
                WHERE r.resource_type = :resource_type
                AND r.deleted = false
                AND sp.param_name = :param_name
                AND sp.value_token_code = :token_value
            """),
            {"resource_type": "Patient", "param_name": "gender", "token_value": "unknown"}
        )
        results = result.fetchall()
        print(f"   Found {len(results)} results with parameter binding")
        
        # 6. Check the actual data types
        print("\n6. Checking data types of columns:")
        result = await db.execute(text("""
            SELECT 
                column_name, 
                data_type,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'fhir'
            AND table_name = 'search_params'
            AND column_name IN ('value_token', 'value_token_code')
        """))
        columns = result.fetchall()
        for col in columns:
            print(f"   {col.column_name}: {col.data_type}({col.character_maximum_length})")


if __name__ == "__main__":
    asyncio.run(debug_search_query())