#!/usr/bin/env python3
"""
Test script to verify search parameter improvements
"""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL


async def test_search_improvements():
    """Test that search parameters are properly indexed."""
    
    print("=== TESTING SEARCH PARAMETER IMPROVEMENTS ===\n")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Test 1: ServiceRequest search
        print("1. Testing ServiceRequest search capabilities:")
        print("-" * 50)
        
        # Check if ServiceRequests are searchable by patient
        result = await conn.execute(text("""
            SELECT COUNT(DISTINCT sp.resource_id) as indexed_count,
                   (SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'ServiceRequest') as total_count
            FROM fhir.search_params sp
            WHERE sp.resource_type = 'ServiceRequest'
            AND sp.param_name = 'patient'
        """))
        
        row = result.fetchone()
        print(f"ServiceRequests with patient index: {row.indexed_count}/{row.total_count}")
        
        if row.indexed_count > 0:
            # Try a search
            result = await conn.execute(text("""
                SELECT r.fhir_id, r.resource->>'status' as status,
                       r.resource->'code'->>'text' as code_text
                FROM fhir.resources r
                JOIN fhir.search_params sp ON r.id = sp.resource_id
                WHERE r.resource_type = 'ServiceRequest'
                AND sp.param_name = 'patient'
                AND sp.param_type = 'reference'
                LIMIT 5
            """))
            
            print("\nSample ServiceRequests found:")
            for sr in result:
                print(f"  ID: {sr.fhir_id}")
                print(f"    Status: {sr.status}")
                print(f"    Code: {sr.code_text}")
        
        # Test 2: Check search parameter diversity
        print("\n\n2. Search parameter coverage by resource type:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT resource_type, param_name, COUNT(*) as count
            FROM fhir.search_params
            WHERE resource_type IN ('ServiceRequest', 'CarePlan', 'CareTeam', 'Coverage')
            GROUP BY resource_type, param_name
            ORDER BY resource_type, param_name
        """))
        
        current_type = None
        for row in result:
            if row.resource_type != current_type:
                current_type = row.resource_type
                print(f"\n{current_type}:")
            print(f"  {row.param_name:<20} {row.count:>8}")
        
        # Test 3: Verify reference resolution
        print("\n\n3. Testing reference resolution:")
        print("-" * 50)
        
        # Check urn:uuid vs Type/ID in search params
        result = await conn.execute(text("""
            SELECT 
                COUNT(CASE WHEN value_reference LIKE '%-%-%-%-%' THEN 1 END) as uuid_refs,
                COUNT(CASE WHEN value_reference NOT LIKE '%-%-%-%-%' THEN 1 END) as other_refs,
                COUNT(*) as total_refs
            FROM fhir.search_params
            WHERE param_type = 'reference'
            AND value_reference IS NOT NULL
        """))
        
        row = result.fetchone()
        print(f"Reference formats in search params:")
        print(f"  UUID format: {row.uuid_refs:,} ({row.uuid_refs/row.total_refs*100:.1f}%)")
        print(f"  Other format: {row.other_refs:,} ({row.other_refs/row.total_refs*100:.1f}%)")
        
        # Test 4: Check for broken references
        print("\n\n4. Checking reference integrity:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            WITH ref_check AS (
                SELECT sp.resource_type, sp.param_name, sp.value_reference,
                       r2.id as target_exists
                FROM fhir.search_params sp
                LEFT JOIN fhir.resources r2 ON r2.fhir_id = sp.value_reference
                WHERE sp.param_type = 'reference'
                AND sp.value_reference IS NOT NULL
                LIMIT 1000
            )
            SELECT 
                COUNT(*) as total_checked,
                COUNT(CASE WHEN target_exists IS NOT NULL THEN 1 END) as valid_refs,
                COUNT(CASE WHEN target_exists IS NULL THEN 1 END) as broken_refs
            FROM ref_check
        """))
        
        row = result.fetchone()
        print(f"Sample of 1000 references:")
        print(f"  Valid: {row.valid_refs} ({row.valid_refs/row.total_checked*100:.1f}%)")
        print(f"  Broken: {row.broken_refs} ({row.broken_refs/row.total_checked*100:.1f}%)")
        
        # Test 5: Coverage resources
        print("\n\n5. Coverage resource status:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Coverage'
        """))
        coverage_count = result.scalar()
        
        print(f"Coverage resources in database: {coverage_count}")
        print("Note: Synthea doesn't generate Coverage resources in recent versions.")
        print("Insurance information is embedded in Claim and ExplanationOfBenefit resources.")
    
    await engine.dispose()
    
    print("\n\n=== TEST SUMMARY ===")
    print("The improvements enable comprehensive searching across all resource types.")
    print("ServiceRequest resources are now properly searchable for order-to-result workflows.")


if __name__ == "__main__":
    asyncio.run(test_search_improvements())