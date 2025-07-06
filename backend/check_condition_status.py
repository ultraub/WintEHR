#!/usr/bin/env python3
import asyncio
import asyncpg
import json

async def check_condition():
    # Connect to the database
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        database='medgenemr',
        user='medgenemr',
        password='medgenemr'
    )
    
    try:
        # Check the condition in the database
        condition_id = '64fbe8a6-4059-f7fe-2bdf-8f2e4cdd69ed'
        
        query = """
            SELECT 
                id,
                fhir_id,
                resource_type,
                version_id,
                deleted,
                resource->>'id' as resource_id,
                resource->'code'->>'text' as code_text,
                resource->'subject'->>'reference' as patient_ref,
                last_updated
            FROM fhir.resources
            WHERE fhir_id = $1
            ORDER BY version_id DESC
            LIMIT 5
        """
        
        rows = await conn.fetch(query, condition_id)
        
        print(f"Found {len(rows)} versions of condition {condition_id}:\n")
        
        for row in rows:
            print(f"Version {row['version_id']}:")
            print(f"  Database ID: {row['id']}")
            print(f"  Deleted: {row['deleted']}")
            print(f"  Code Text: {row['code_text']}")
            print(f"  Patient: {row['patient_ref']}")
            print(f"  Last Updated: {row['last_updated']}")
            print()
        
        # Check if the latest version is deleted
        if rows and rows[0]['deleted']:
            print("⚠️  WARNING: The latest version is marked as deleted!")
            print("This explains why it doesn't appear in search results.")
        
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(check_condition())