#!/usr/bin/env python3
"""
Investigate why Coverage resources are not properly typed
"""

import json
import asyncio
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL


async def investigate_coverage():
    """Find out why Coverage resources aren't properly typed."""
    
    print("=== COVERAGE RESOURCE INVESTIGATION ===\n")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Check Coverage resources
        print("1. Finding resources that contain Coverage resourceType:")
        result = await conn.execute(text("""
            SELECT 
                id,
                resource_type,
                fhir_id,
                jsonb_pretty(resource) as resource_json
            FROM fhir.resources 
            WHERE resource::text LIKE '%"resourceType": "Coverage"%'
            LIMIT 5
        """))
        
        coverage_resources = result.fetchall()
        
        print(f"Found {len(coverage_resources)} Coverage resources")
        
        for i, row in enumerate(coverage_resources):
            print(f"\nCoverage {i+1}:")
            print(f"  DB ID: {row.id}")
            print(f"  Resource Type in DB: {row.resource_type}")
            print(f"  FHIR ID: {row.fhir_id}")
            
            # Parse JSON to check structure
            resource_data = json.loads(row.resource_json)
            print(f"  Actual resourceType: {resource_data.get('resourceType')}")
            print(f"  Status: {resource_data.get('status')}")
            if 'beneficiary' in resource_data:
                print(f"  Beneficiary: {resource_data['beneficiary'].get('reference', 'None')}")
        
        # Check if they're stored as wrong type
        print("\n\n2. Checking resource_type distribution for Coverage-like resources:")
        result = await conn.execute(text("""
            SELECT 
                resource_type,
                COUNT(*) as count
            FROM fhir.resources 
            WHERE resource::text LIKE '%"resourceType": "Coverage"%'
            GROUP BY resource_type
        """))
        
        for row in result:
            print(f"  {row.resource_type}: {row.count}")
        
        # Sample a mis-typed Coverage
        print("\n\n3. Detailed analysis of a mis-typed Coverage:")
        result = await conn.execute(text("""
            SELECT 
                id,
                resource_type,
                fhir_id,
                resource
            FROM fhir.resources 
            WHERE resource::text LIKE '%"resourceType": "Coverage"%'
            AND resource_type != 'Coverage'
            LIMIT 1
        """))
        
        mistyped = result.fetchone()
        if mistyped:
            print(f"  DB ID: {mistyped.id}")
            print(f"  Stored as type: {mistyped.resource_type}")
            print(f"  FHIR ID: {mistyped.fhir_id}")
            
            resource_data = mistyped.resource
            print(f"  Actual resourceType: {resource_data.get('resourceType')}")
            
            # Check if it's in a bundle
            if resource_data.get('resourceType') == 'Bundle':
                print("  ⚠️  This is a Bundle! Coverage might be inside.")
                entries = resource_data.get('entry', [])
                print(f"  Bundle has {len(entries)} entries")
                
                # Look for Coverage in entries
                coverage_count = 0
                for entry in entries:
                    if entry.get('resource', {}).get('resourceType') == 'Coverage':
                        coverage_count += 1
                print(f"  Coverage resources in bundle: {coverage_count}")
        
        # Check the import process
        print("\n\n4. Checking how Coverage resources are imported:")
        
        # Look at Bundle resources
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Bundle'
        """))
        bundle_count = result.scalar()
        print(f"  Bundle resources in DB: {bundle_count}")
        
        if bundle_count > 0:
            print("\n  ⚠️  PROBLEM IDENTIFIED: Bundles are being stored instead of extracted!")
            print("  The import process should extract individual resources from bundles,")
            print("  not store the bundles themselves.")
    
    await engine.dispose()
    
    print("\n\n=== CONCLUSIONS ===")
    print("1. Coverage resources exist but are likely stored inside Bundle resources")
    print("2. The import process may be storing entire bundles instead of extracting entries")
    print("3. This would explain why Coverage (and potentially other resources) are 'missing'")
    print("4. Need to check the _process_batch method in synthea_master.py")


if __name__ == "__main__":
    asyncio.run(investigate_coverage())