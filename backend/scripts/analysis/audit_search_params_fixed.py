#!/usr/bin/env python3
"""
Audit search parameters to find inconsistencies between parameter types and storage columns
Fixed version using correct column names
"""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@db:5432/emr_dev')

async def audit_search_params():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        print("=== Search Parameter Audit ===\n")
        
        # 1. Check token parameters stored in wrong columns
        print("1. Token parameters with values in wrong columns:")
        result = await db.execute(text("""
            SELECT param_name, 
                   COUNT(CASE WHEN value_token_code IS NOT NULL THEN 1 END) as correct_count,
                   COUNT(CASE WHEN value_string IS NOT NULL AND value_token_code IS NULL THEN 1 END) as string_count,
                   COUNT(CASE WHEN value_number IS NOT NULL AND value_token_code IS NULL THEN 1 END) as number_count
            FROM fhir.search_params
            WHERE param_type = 'token'
            GROUP BY param_name
            HAVING COUNT(CASE WHEN value_string IS NOT NULL AND value_token_code IS NULL THEN 1 END) > 0
               OR COUNT(CASE WHEN value_number IS NOT NULL AND value_token_code IS NULL THEN 1 END) > 0
            ORDER BY param_name
        """))
        
        token_issues = []
        for row in result:
            print(f"  {row[0]}: correct={row[1]}, in_string={row[2]}, in_number={row[3]}")
            if row[2] > 0:  # Has values in string column
                token_issues.append(row[0])
        
        if not token_issues:
            print("  ✓ All token parameters correctly stored")
        
        # 2. Check string parameters stored in wrong columns
        print("\n2. String parameters with values in wrong columns:")
        result = await db.execute(text("""
            SELECT param_name, 
                   COUNT(CASE WHEN value_string IS NOT NULL THEN 1 END) as correct_count,
                   COUNT(CASE WHEN value_token_code IS NOT NULL AND value_string IS NULL THEN 1 END) as token_count,
                   COUNT(CASE WHEN value_number IS NOT NULL AND value_string IS NULL THEN 1 END) as number_count
            FROM fhir.search_params
            WHERE param_type = 'string'
            GROUP BY param_name
            HAVING COUNT(CASE WHEN value_token_code IS NOT NULL AND value_string IS NULL THEN 1 END) > 0
               OR COUNT(CASE WHEN value_number IS NOT NULL AND value_string IS NULL THEN 1 END) > 0
            ORDER BY param_name
        """))
        
        string_issues = []
        for row in result:
            print(f"  {row[0]}: correct={row[1]}, in_token={row[2]}, in_number={row[3]}")
            string_issues.append(row[0])
            
        if not string_issues:
            print("  ✓ All string parameters correctly stored")
        
        # 3. Check date parameters stored in wrong columns
        print("\n3. Date parameters with values in wrong columns:")
        result = await db.execute(text("""
            SELECT param_name, 
                   COUNT(CASE WHEN value_date IS NOT NULL THEN 1 END) as correct_count,
                   COUNT(CASE WHEN value_string IS NOT NULL AND value_date IS NULL THEN 1 END) as string_count
            FROM fhir.search_params
            WHERE param_type = 'date'
            GROUP BY param_name
            HAVING COUNT(CASE WHEN value_string IS NOT NULL AND value_date IS NULL THEN 1 END) > 0
            ORDER BY param_name
        """))
        
        date_issues = []
        for row in result:
            print(f"  {row[0]}: correct={row[1]}, in_string={row[2]}")
            date_issues.append(row[0])
            
        if not date_issues:
            print("  ✓ All date parameters correctly stored")
        
        # 4. Check reference parameters
        print("\n4. Reference parameters with values in wrong columns:")
        result = await db.execute(text("""
            SELECT param_name, 
                   COUNT(CASE WHEN value_reference IS NOT NULL THEN 1 END) as correct_count,
                   COUNT(CASE WHEN value_string IS NOT NULL AND value_reference IS NULL THEN 1 END) as string_count
            FROM fhir.search_params
            WHERE param_type = 'reference'
            GROUP BY param_name
            HAVING COUNT(CASE WHEN value_string IS NOT NULL AND value_reference IS NULL THEN 1 END) > 0
            ORDER BY param_name
        """))
        
        reference_issues = []
        for row in result:
            print(f"  {row[0]}: correct={row[1]}, in_string={row[2]}")
            reference_issues.append(row[0])
            
        if not reference_issues:
            print("  ✓ All reference parameters correctly stored")
        
        # 5. Summary of all parameter types
        print("\n5. Overall parameter type distribution:")
        result = await db.execute(text("""
            SELECT param_type, COUNT(DISTINCT param_name) as unique_params, COUNT(*) as total_entries
            FROM fhir.search_params
            GROUP BY param_type
            ORDER BY param_type
        """))
        
        for row in result:
            print(f"  {row[0]}: {row[1]} unique parameters, {row[2]} total entries")
            
        # 6. Sample specific problematic parameters
        print("\n6. Sample values from problematic parameters:")
        
        # Check status values
        if 'status' in token_issues:
            result = await db.execute(text("""
                SELECT DISTINCT value_string
                FROM fhir.search_params
                WHERE param_name = 'status' 
                AND param_type = 'token'
                AND value_token_code IS NULL
                LIMIT 10
            """))
            print("\n  Status values stored in string column:")
            for row in result:
                print(f"    - '{row[0]}'")
        
        # Check _id values
        if '_id' in token_issues:
            result = await db.execute(text("""
                SELECT COUNT(*)
                FROM fhir.search_params
                WHERE param_name = '_id' 
                AND param_type = 'token'
                AND value_string IS NOT NULL
                AND value_token_code IS NULL
            """))
            count = result.scalar()
            print(f"\n  _id parameters stored in string column: {count}")
            
        # 7. Generate fix script for token parameters
        if token_issues:
            print("\n7. Fix commands for token parameters:")
            for param in token_issues:
                print(f"""
UPDATE fhir.search_params
SET value_token_code = value_string
WHERE param_name = '{param}' 
AND param_type = 'token'
AND value_string IS NOT NULL
AND value_token_code IS NULL;""")
                
        # Test specific searches
        print("\n8. Testing impact on searches:")
        
        # Test status search (before fix)
        result = await db.execute(text("""
            SELECT COUNT(DISTINCT r.id)
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'Observation'
            AND r.deleted = false
            AND sp.param_name = 'status'
            AND sp.value_token_code = 'final'
        """))
        final_obs = result.scalar()
        print(f"  Observations with status=final (using token column): {final_obs}")
        
        # Check how many would match if we searched the string column
        result = await db.execute(text("""
            SELECT COUNT(DISTINCT r.id)
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'Observation'
            AND r.deleted = false
            AND sp.param_name = 'status'
            AND sp.value_string = 'final'
        """))
        final_obs_string = result.scalar()
        print(f"  Observations with status=final (using string column): {final_obs_string}")

if __name__ == "__main__":
    asyncio.run(audit_search_params())