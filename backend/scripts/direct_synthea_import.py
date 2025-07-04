#!/usr/bin/env python3
"""
Direct Synthea FHIR Import Script
Bypasses validation to import Synthea data directly into the database.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL


async def import_synthea_bundle(session: AsyncSession, bundle_path: Path):
    """Import a single Synthea bundle directly to the database."""
    print(f"Importing: {bundle_path.name}")
    
    with open(bundle_path, 'r') as f:
        bundle_data = json.load(f)
    
    if bundle_data.get('resourceType') != 'Bundle':
        print(f"  Skipping - not a bundle: {bundle_path}")
        return 0
    
    imported_count = 0
    entries = bundle_data.get('entry', [])
    
    for entry in entries:
        resource = entry.get('resource')
        if not resource:
            continue
            
        resource_type = resource.get('resourceType')
        if not resource_type:
            continue
        
        # Clean up resource data for Synthea compatibility
        # Fix common Synthea format issues
        if resource_type == 'Encounter' and 'class' in resource:
            # Convert class to list format
            if not isinstance(resource['class'], list):
                resource['class'] = [resource['class']]
        
        if resource_type == 'Device' and 'type' in resource:
            # Convert type to list format
            if not isinstance(resource['type'], list):
                resource['type'] = [resource['type']]
        
        if resource_type == 'DocumentReference' and 'context' in resource:
            # Convert context to list format
            if not isinstance(resource['context'], list):
                resource['context'] = [resource['context']]
        
        # Remove fields that cause issues
        if resource_type == 'Procedure' and 'performedPeriod' in resource:
            # Convert to performedDateTime using start time
            if 'start' in resource['performedPeriod']:
                resource['performedDateTime'] = resource['performedPeriod']['start']
            del resource['performedPeriod']
        
        # Generate metadata
        fhir_id = resource.get('id', str(uuid4()))
        resource['id'] = fhir_id
        
        if 'meta' not in resource:
            resource['meta'] = {}
        
        resource['meta']['versionId'] = '1'
        resource['meta']['lastUpdated'] = datetime.now(timezone.utc).isoformat()
        
        # Insert directly into database
        try:
            await session.execute(
                text("""
                    INSERT INTO fhir.resources 
                    (resource_type, fhir_id, version_id, last_updated, resource, deleted)
                    VALUES (:resource_type, :fhir_id, :version_id, :last_updated, :resource, false)
                    ON CONFLICT (resource_type, fhir_id) DO UPDATE
                    SET resource = EXCLUDED.resource,
                        version_id = EXCLUDED.version_id,
                        last_updated = EXCLUDED.last_updated
                """),
                {
                    'resource_type': resource_type,
                    'fhir_id': fhir_id,
                    'version_id': 1,
                    'last_updated': datetime.now(timezone.utc),
                    'resource': json.dumps(resource)
                }
            )
            imported_count += 1
        except Exception as e:
            print(f"  Error importing {resource_type}/{fhir_id}: {e}")
    
    await session.commit()
    print(f"  Imported {imported_count} resources")
    return imported_count


async def main():
    """Main import function."""
    if len(sys.argv) < 2:
        print("Usage: python direct_synthea_import.py <synthea_output_dir>")
        sys.exit(1)
    
    synthea_dir = Path(sys.argv[1])
    if not synthea_dir.exists():
        print(f"Directory not found: {synthea_dir}")
        sys.exit(1)
    
    # Create database engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    # Find all JSON files
    json_files = list(synthea_dir.glob("*.json"))
    print(f"Found {len(json_files)} JSON files to import")
    
    total_imported = 0
    
    async with AsyncSession(engine) as session:
        for json_file in json_files:
            count = await import_synthea_bundle(session, json_file)
            total_imported += count
    
    print(f"\nTotal resources imported: {total_imported}")
    
    # Show summary
    async with AsyncSession(engine) as session:
        result = await session.execute(
            text("""
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources
                WHERE NOT deleted
                GROUP BY resource_type
                ORDER BY count DESC
            """)
        )
        
        print("\nResource counts in database:")
        for row in result:
            print(f"  {row.resource_type}: {row.count}")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())