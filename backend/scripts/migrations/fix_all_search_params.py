#!/usr/bin/env python3
"""
Fix all search parameter inconsistencies found by the audit.
This includes token parameters stored in wrong columns and reference parameters with string values.
"""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@db:5432/emr_dev')

async def fix_search_params():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        print("=== Fixing Search Parameter Storage Issues ===\n")
        
        # 1. Fix token parameters stored in string column
        token_params = ['_id', 'intent', 'status']
        
        for param_name in token_params:
            print(f"Fixing token parameter: {param_name}")
            
            # First check how many need fixing
            result = await db.execute(text("""
                SELECT COUNT(*)
                FROM fhir.search_params
                WHERE param_name = :param_name 
                AND param_type = 'token'
                AND value_string IS NOT NULL
                AND value_token_code IS NULL
            """), {'param_name': param_name})
            count = result.scalar()
            
            if count > 0:
                print(f"  Found {count} entries to fix")
                
                # Copy values from string to token column
                await db.execute(text("""
                    UPDATE fhir.search_params
                    SET value_token_code = value_string
                    WHERE param_name = :param_name 
                    AND param_type = 'token'
                    AND value_string IS NOT NULL
                    AND value_token_code IS NULL
                """), {'param_name': param_name})
                
                print(f"  ✓ Updated {count} entries")
            else:
                print(f"  ✓ No entries need fixing")
        
        # 2. Fix reference parameters stored in string column
        # For references, we need to extract the ID from the reference string
        reference_params = ['patient', 'requester', 'subject']
        
        for param_name in reference_params:
            print(f"\nFixing reference parameter: {param_name}")
            
            # Check how many need fixing
            result = await db.execute(text("""
                SELECT COUNT(*)
                FROM fhir.search_params
                WHERE param_name = :param_name 
                AND param_type = 'reference'
                AND value_string IS NOT NULL
                AND value_reference IS NULL
            """), {'param_name': param_name})
            count = result.scalar()
            
            if count > 0:
                print(f"  Found {count} entries to fix")
                
                # For references, value_string might contain the full reference
                # We need to extract just the ID part
                await db.execute(text("""
                    UPDATE fhir.search_params
                    SET value_reference = 
                        CASE 
                            WHEN value_string LIKE '%/%' THEN split_part(value_string, '/', -1)
                            ELSE value_string
                        END
                    WHERE param_name = :param_name 
                    AND param_type = 'reference'
                    AND value_string IS NOT NULL
                    AND value_reference IS NULL
                """), {'param_name': param_name})
                
                print(f"  ✓ Updated {count} entries")
            else:
                print(f"  ✓ No entries need fixing")
        
        await db.commit()
        print("\n=== All fixes applied successfully ===")
        
        # 3. Verify the fixes
        print("\n=== Verification ===")
        
        # Test status search
        result = await db.execute(text("""
            SELECT COUNT(DISTINCT r.id)
            FROM fhir.resources r
            JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'Observation'
            AND r.deleted = false
            AND sp.param_name = 'status'
            AND sp.value_token_code = 'final'
        """))
        final_obs = result.scalar()
        print(f"Observations with status=final: {final_obs}")
        
        # Test _id search
        result = await db.execute(text("""
            SELECT COUNT(*)
            FROM fhir.search_params
            WHERE param_name = '_id'
            AND value_token_code IS NOT NULL
        """))
        id_count = result.scalar()
        print(f"_id parameters with token values: {id_count}")
        
        # Test reference searches
        result = await db.execute(text("""
            SELECT param_name, COUNT(*)
            FROM fhir.search_params
            WHERE param_type = 'reference'
            AND value_reference IS NOT NULL
            GROUP BY param_name
            ORDER BY param_name
        """))
        print("\nReference parameters with proper values:")
        for row in result:
            print(f"  {row[0]}: {row[1]}")

if __name__ == "__main__":
    asyncio.run(fix_search_params())