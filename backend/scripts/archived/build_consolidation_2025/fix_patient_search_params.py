#!/usr/bin/env python3
"""
Fix missing patient search parameters by adding them to resources that have subject references.
This allows searching with ?patient= instead of just ?subject=
"""

import asyncio
import asyncpg
import json
from datetime import datetime
import uuid
import os


async def add_patient_search_params():
    """Add patient search parameter for all resources that have subject references."""
    
    # Connect to database
    db_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    # Convert to asyncpg format
    if db_url.startswith('postgresql+asyncpg://'):
        db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(db_url)
    
    try:
        print("Adding patient search parameters...")
        
        # Get all resources that have subject references
        query = """
            SELECT DISTINCT r.id, r.resource_type, r.resource
            FROM fhir.resources r
            WHERE r.resource->>'subject' IS NOT NULL
            AND r.deleted = false
            ORDER BY r.resource_type, r.id
        """
        
        resources = await conn.fetch(query)
        print(f"Found {len(resources)} resources with subject references")
        
        # Group by resource type
        by_type = {}
        for row in resources:
            resource_type = row['resource_type']
            if resource_type not in by_type:
                by_type[resource_type] = []
            by_type[resource_type].append(row)
        
        print(f"Resource types with subject references: {list(by_type.keys())}")
        
        # For each resource, add patient search parameter pointing to subject
        total_added = 0
        for resource_type, type_resources in by_type.items():
            print(f"\nProcessing {len(type_resources)} {resource_type} resources...")
            
            for row in type_resources:
                resource_id = row['id']
                resource = json.loads(row['resource']) if isinstance(row['resource'], str) else row['resource']
                
                # Extract subject reference
                subject = resource.get('subject', {})
                if isinstance(subject, dict) and 'reference' in subject:
                    reference = subject['reference']
                    
                    # Check if patient param already exists
                    existing = await conn.fetchval("""
                        SELECT COUNT(*) FROM fhir.search_params
                        WHERE resource_id = $1 AND param_name = 'patient'
                    """, resource_id)
                    
                    if existing == 0:
                        # Add patient search parameter
                        await conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_string, value_number, value_date,
                                value_token_system, value_token_code
                            ) VALUES ($1, $2, 'patient', 'reference', $3, NULL, NULL, NULL, NULL)
                        """, resource_id, resource_type, reference)
                        total_added += 1
                        
                        if total_added % 1000 == 0:
                            print(f"  Added {total_added} patient parameters...")
        
        print(f"\nTotal patient search parameters added: {total_added}")
        
        # Verify the fix
        print("\nVerifying patient search parameters...")
        verify_query = """
            SELECT resource_type, COUNT(*) as count
            FROM fhir.search_params
            WHERE param_name = 'patient'
            GROUP BY resource_type
            ORDER BY resource_type
        """
        
        results = await conn.fetch(verify_query)
        print("\nPatient parameters by resource type:")
        for row in results:
            print(f"  {row['resource_type']}: {row['count']}")
        
        # Test a search
        print("\nTesting patient search...")
        test_query = """
            SELECT COUNT(DISTINCT sp.resource_id) as count
            FROM fhir.search_params sp
            WHERE sp.resource_type = 'Condition'
            AND sp.param_name = 'patient'
            AND sp.value_string LIKE '%'
        """
        
        test_result = await conn.fetchval(test_query)
        print(f"Conditions with patient search parameter: {test_result}")
        
    finally:
        await conn.close()


async def update_indexer_definitions():
    """Update the SearchParameterIndexer to include patient parameter definitions."""
    
    print("\nNote: To make this permanent, update the SearchParameterIndexer class to include:")
    print("  'patient': {'type': 'reference', 'path': 'subject'}")
    print("in the search definitions for resources like Condition, Observation, etc.")


if __name__ == "__main__":
    asyncio.run(add_patient_search_params())
    asyncio.run(update_indexer_definitions())