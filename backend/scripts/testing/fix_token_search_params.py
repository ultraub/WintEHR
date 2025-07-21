#!/usr/bin/env python3
"""
Fix token search parameters by populating the value_token column.
This is needed for token searches to work properly.

Created: 2025-01-20
"""

import asyncio
import asyncpg
from datetime import datetime


async def fix_token_search_params():
    """Fix token search parameters by populating value_token column."""
    
    # Connect to database
    conn = await asyncpg.connect(
        "postgresql://emr_user:emr_password@postgres:5432/emr_db"
    )
    
    try:
        print("🔧 Fixing token search parameters...")
        
        # First, check how many token params have NULL value_token
        count_query = """
        SELECT COUNT(*) as count
        FROM fhir.search_params
        WHERE param_type = 'token'
        AND value_token IS NULL
        AND value_token_code IS NOT NULL
        """
        
        count = await conn.fetchval(count_query)
        print(f"   Found {count:,} token parameters with missing value_token")
        
        if count > 0:
            # Update value_token to match value_token_code for all token params
            update_query = """
            UPDATE fhir.search_params
            SET value_token = value_token_code
            WHERE param_type = 'token'
            AND value_token IS NULL
            AND value_token_code IS NOT NULL
            """
            
            result = await conn.execute(update_query)
            rows_updated = int(result.split()[-1])
            print(f"   ✅ Updated {rows_updated:,} token parameters")
        
        # Check specific problematic searches
        print("\n📊 Verifying fixes:")
        
        # Check gender tokens
        gender_check = """
        SELECT 
            value_token,
            value_token_code,
            COUNT(*) as count
        FROM fhir.search_params
        WHERE resource_type = 'Patient'
        AND param_name = 'gender'
        GROUP BY value_token, value_token_code
        """
        
        print("\n   Gender tokens:")
        gender_rows = await conn.fetch(gender_check)
        for row in gender_rows:
            print(f"   - value_token: {row['value_token']}, value_token_code: {row['value_token_code']}, count: {row['count']}")
        
        # Check clinical status tokens
        status_check = """
        SELECT 
            value_token,
            value_token_code,
            COUNT(*) as count
        FROM fhir.search_params
        WHERE resource_type = 'Condition'
        AND param_name = 'clinical-status'
        GROUP BY value_token, value_token_code
        LIMIT 5
        """
        
        print("\n   Clinical status tokens:")
        status_rows = await conn.fetch(status_check)
        for row in status_rows:
            print(f"   - value_token: {row['value_token']}, value_token_code: {row['value_token_code']}, count: {row['count']}")
        
        # Check observation codes
        code_check = """
        SELECT 
            COUNT(DISTINCT value_token) as unique_tokens,
            COUNT(DISTINCT value_token_code) as unique_codes,
            COUNT(*) as total
        FROM fhir.search_params
        WHERE resource_type = 'Observation'
        AND param_name = 'code'
        """
        
        code_row = await conn.fetchrow(code_check)
        print(f"\n   Observation codes:")
        print(f"   - Unique value_tokens: {code_row['unique_tokens']}")
        print(f"   - Unique value_token_codes: {code_row['unique_codes']}")
        print(f"   - Total code parameters: {code_row['total']}")
        
        print("\n✅ Token search parameter fix complete!")
        
    finally:
        await conn.close()


async def main():
    """Run the fix."""
    await fix_token_search_params()


if __name__ == "__main__":
    asyncio.run(main())