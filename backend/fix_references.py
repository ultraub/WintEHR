#!/usr/bin/env python3
"""
Fix FHIR references from urn:uuid to proper resource references
"""

import asyncio
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from database import DATABASE_URL
import re

async def fix_references():
    """Fix all urn:uuid references in the database."""
    engine = create_async_engine(DATABASE_URL)
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    
    async with async_session() as session:
        # First, build a map of all resources by their original UUID
        uuid_map = {}
        
        print("Building UUID map...")
        query = text("""
            SELECT resource_type, fhir_id, resource
            FROM fhir.resources
            WHERE deleted = false
        """)
        
        result = await session.execute(query)
        for row in result:
            resource_type = row.resource_type
            fhir_id = row.fhir_id
            data = row.resource
            
            # Check if resource has identifiers with synthea system
            identifiers = data.get('identifier', [])
            for identifier in identifiers:
                if identifier.get('system') == 'https://github.com/synthetichealth/synthea':
                    uuid = identifier.get('value')
                    if uuid:
                        uuid_map[f"urn:uuid:{uuid}"] = f"{resource_type}/{fhir_id}"
                        break
        
        print(f"Found {len(uuid_map)} resources with UUIDs")
        
        # Now update all resources with urn:uuid references
        print("\nFixing references...")
        update_count = 0
        
        # Get all resources that might have references
        query = text("""
            SELECT id, resource_type, fhir_id, resource
            FROM fhir.resources
            WHERE deleted = false
            AND resource::text LIKE '%urn:uuid:%'
        """)
        
        result = await session.execute(query)
        rows = result.fetchall()
        
        for row in rows:
            resource_id = row.id
            resource_type = row.resource_type
            fhir_id = row.fhir_id
            data = row.resource
            
            # Convert data to string for regex replacement
            data_str = json.dumps(data)
            original_str = data_str
            
            # Replace all urn:uuid references
            for urn_uuid, proper_ref in uuid_map.items():
                data_str = data_str.replace(f'"{urn_uuid}"', f'"{proper_ref}"')
            
            # If we made changes, update the resource
            if data_str != original_str:
                new_data = json.loads(data_str)
                
                update_query = text("""
                    UPDATE fhir.resources
                    SET resource = CAST(:data AS jsonb),
                        version_id = version_id + 1
                    WHERE id = :id
                """)
                
                await session.execute(update_query, {
                    "data": json.dumps(new_data),
                    "id": resource_id
                })
                
                update_count += 1
                if update_count % 100 == 0:
                    print(f"  Updated {update_count} resources...")
        
        await session.commit()
        print(f"\n✅ Fixed references in {update_count} resources")
        
        # Verify by checking MedicationRequests
        print("\nVerifying MedicationRequest references...")
        query = text("""
            SELECT COUNT(*) 
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND resource->'subject'->>'reference' LIKE 'Patient/%'
        """)
        result = await session.execute(query)
        count = result.scalar()
        
        print(f"MedicationRequests with proper Patient references: {count}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_references())