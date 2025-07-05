#!/usr/bin/env python3
"""
Fix ALL urn:uuid references by mapping them to actual FHIR IDs
"""

import asyncio
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from database import DATABASE_URL

async def fix_all_references():
    """Fix all urn:uuid references in the database."""
    engine = create_async_engine(DATABASE_URL)
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    
    async with async_session() as session:
        # Build a comprehensive UUID map from ALL resources
        uuid_map = {}
        
        print("Building comprehensive UUID map...")
        
        # Get all resources that have any identifier
        query = text("""
            SELECT resource_type, fhir_id, resource
            FROM fhir.resources
            WHERE deleted = false
        """)
        
        result = await session.execute(query)
        for row in result:
            resource_type = row.resource_type
            fhir_id = row.fhir_id
            resource = row.resource
            
            # The FHIR ID itself might be the UUID we're looking for
            uuid_map[f"urn:uuid:{fhir_id}"] = f"{resource_type}/{fhir_id}"
            
            # Also check identifiers
            identifiers = resource.get('identifier', [])
            for identifier in identifiers:
                if identifier.get('system') == 'https://github.com/synthetichealth/synthea':
                    uuid = identifier.get('value')
                    if uuid:
                        uuid_map[f"urn:uuid:{uuid}"] = f"{resource_type}/{fhir_id}"
        
        print(f"Built UUID map with {len(uuid_map)} entries")
        
        # Show some examples
        print("\nExample mappings:")
        for i, (urn, ref) in enumerate(list(uuid_map.items())[:5]):
            print(f"  {urn} -> {ref}")
        
        # Now update all resources with urn:uuid references
        print("\nFixing references...")
        update_count = 0
        
        # Get all resources that have urn:uuid references
        query = text("""
            SELECT id, resource_type, fhir_id, resource
            FROM fhir.resources
            WHERE deleted = false
            AND resource::text LIKE '%urn:uuid:%'
        """)
        
        result = await session.execute(query)
        rows = result.fetchall()
        
        print(f"Found {len(rows)} resources with urn:uuid references")
        
        for row in rows:
            resource_id = row.id
            resource_type = row.resource_type
            fhir_id = row.fhir_id
            resource = row.resource
            
            # Convert to string for replacement
            resource_str = json.dumps(resource)
            original_str = resource_str
            
            # Replace all urn:uuid references
            changes_made = 0
            for urn_uuid, proper_ref in uuid_map.items():
                if urn_uuid in resource_str:
                    resource_str = resource_str.replace(f'"{urn_uuid}"', f'"{proper_ref}"')
                    changes_made += 1
            
            # If we made changes, update the resource
            if resource_str != original_str:
                new_resource = json.loads(resource_str)
                
                update_query = text("""
                    UPDATE fhir.resources
                    SET resource = CAST(:resource AS jsonb),
                        version_id = version_id + 1
                    WHERE id = :id
                """)
                
                await session.execute(update_query, {
                    "resource": json.dumps(new_resource),
                    "id": resource_id
                })
                
                update_count += 1
                if update_count % 100 == 0:
                    print(f"  Updated {update_count} resources...")
                    await session.commit()  # Commit periodically
        
        await session.commit()
        print(f"\n✅ Fixed references in {update_count} resources")
        
        # Verify by checking specific resource types
        print("\nVerifying fixes...")
        
        for resource_type in ['MedicationRequest', 'Observation', 'Condition', 'Procedure']:
            query = text(f"""
                SELECT COUNT(*) 
                FROM fhir.resources
                WHERE resource_type = :resource_type
                AND resource::text LIKE '%Patient/%'
            """)
            result = await session.execute(query, {"resource_type": resource_type})
            count = result.scalar()
            print(f"{resource_type}s with Patient references: {count}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_all_references())