#!/usr/bin/env python3
"""Test gender search after fixing TOKEN_MODIFIERS."""

import asyncio
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fhir.core.storage import FHIRStorageEngine
from fhir.core.search.basic import SearchParameterHandler
from database import get_db_context
from sqlalchemy import text


async def test_gender_search():
    """Test gender search with and without :exact modifier."""
    # Get database session
    async with get_db_context() as db:
        # Create storage engine
        storage = FHIRStorageEngine(db)
        
        # Import search handler
        search_handler = SearchParameterHandler(storage._get_search_parameter_definitions())
        
        print("Testing gender searches after fix...\n")
        
        # Test 1: Basic search (should work now)
        print("Test 1: Basic gender search")
        parsed_params1, _ = search_handler.parse_search_params('Patient', {'gender': 'unknown'})
        print(f"  Parsed params: {parsed_params1}")
        resources1, total1 = await storage.search_resources('Patient', parsed_params1)
        print(f"  /Patient?gender=unknown: {total1} results")
        
        # Test 2: With exact modifier  
        print("\nTest 2: Gender search with :exact modifier")
        parsed_params2, _ = search_handler.parse_search_params('Patient', {'gender:exact': 'unknown'})
        print(f"  Parsed params: {parsed_params2}")
        resources2, total2 = await storage.search_resources('Patient', parsed_params2)
        print(f"  /Patient?gender:exact=unknown: {total2} results")
        
        # Test 3: Check database directly
        print("\nTest 3: Direct database verification")
        result = await db.execute(text("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE resource_type = 'Patient' 
            AND resource->>'gender' = 'unknown'
        """))
        db_count = result.scalar()
        print(f"  Patients with gender='unknown' in database: {db_count}")
        
        # Test 4: Check search params
        print("\nTest 4: Search parameter index verification")
        result = await db.execute(text("""
            SELECT COUNT(*) FROM fhir.search_params 
            WHERE resource_type = 'Patient' 
            AND param_name = 'gender'
            AND value_token = 'unknown'
        """))
        sp_count = result.scalar()
        print(f"  Indexed gender='unknown' search params: {sp_count}")
        
        # Test 5: Other gender values
        print("\nTest 5: Other gender values")
        for gender in ['male', 'female']:
            parsed_params, _ = search_handler.parse_search_params('Patient', {'gender': gender})
            resources, total = await storage.search_resources('Patient', parsed_params)
            print(f"  /Patient?gender={gender}: {total} results")
        
        # Summary
        print("\n" + "="*50)
        if total1 == total2 == db_count == sp_count:
            print("✅ SUCCESS: Gender search is working correctly!")
            print(f"   All methods return {total1} patients with gender='unknown'")
        else:
            print("❌ FAILURE: Gender search results are inconsistent")
            print(f"   Basic search: {total1}")
            print(f"   :exact search: {total2}")
            print(f"   Database count: {db_count}")
            print(f"   Indexed params: {sp_count}")
            
        # Debug: Check what's happening with parsing
        if total1 != db_count:
            print("\n🔍 DEBUG: Checking why basic search fails...")
            # Test with raw SQL like the search engine would use
            result = await db.execute(text("""
                SELECT COUNT(DISTINCT r.id)
                FROM fhir.resources r
                LEFT JOIN fhir.search_params sp1 ON sp1.resource_id = r.id
                WHERE r.resource_type = 'Patient'
                AND r.deleted = false
                AND sp1.param_name = 'gender'
                AND (sp1.value_token = 'unknown' OR sp1.value_token_code = 'unknown')
            """))
            sql_count = result.scalar()
            print(f"  Raw SQL search count: {sql_count}")


if __name__ == "__main__":
    asyncio.run(test_gender_search())