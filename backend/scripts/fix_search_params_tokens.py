#!/usr/bin/env python3
"""
Fix search parameters that were incorrectly stored in value_string instead of value_token_code.

This script fixes:
1. MedicationRequest status values stored in value_string instead of value_token_code
2. Missing clinical-status search parameters for Conditions
3. Any other token-type parameters stored in the wrong column
"""

import asyncio
import asyncpg
import json
from datetime import datetime


async def fix_search_params():
    """Fix incorrectly stored search parameters."""
    
    print("🔧 Fixing Search Parameter Storage Issues")
    print("=" * 60)
    print(f"Started at: {datetime.now()}")
    
    try:
        conn = await asyncpg.connect("postgresql://emr_user:emr_password@postgres:5432/emr_db")
        print("✅ Connected to database")
        
        # Step 1: Fix MedicationRequest status parameters
        print("\n📋 Step 1: Fixing MedicationRequest status parameters...")
        
        # Move status values from value_string to value_token_code
        update_result = await conn.execute("""
            UPDATE fhir.search_params
            SET value_token_code = value_string,
                value_string = NULL
            WHERE resource_type = 'MedicationRequest'
            AND param_name = 'status'
            AND param_type = 'token'
            AND value_string IS NOT NULL
            AND value_token_code IS NULL
        """)
        
        print(f"✅ Fixed {update_result.split()[-1]} MedicationRequest status parameters")
        
        # Step 2: Extract missing clinical-status for Conditions
        print("\n📋 Step 2: Extracting missing clinical-status for Conditions...")
        
        # Get all conditions without clinical-status search param
        conditions_missing_status = await conn.fetch("""
            SELECT r.id, r.resource
            FROM fhir.resources r
            WHERE r.resource_type = 'Condition'
            AND (r.deleted = FALSE OR r.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
                AND sp.param_name = 'clinical-status'
            )
        """)
        
        print(f"Found {len(conditions_missing_status)} conditions missing clinical-status parameter")
        
        # Extract clinical-status for each condition
        extracted_count = 0
        for row in conditions_missing_status:
            resource_id = row['id']
            resource_data = json.loads(row['resource'])
            
            # Extract clinical status
            if 'clinicalStatus' in resource_data and 'coding' in resource_data['clinicalStatus']:
                for coding in resource_data['clinicalStatus']['coding']:
                    if 'code' in coding:
                        await conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_token_system, value_token_code
                            ) VALUES ($1, $2, $3, $4, $5, $6)
                            ON CONFLICT DO NOTHING
                        """, resource_id, 'Condition', 'clinical-status', 'token',
                            coding.get('system'), coding['code'])
                        extracted_count += 1
        
        print(f"✅ Extracted {extracted_count} clinical-status parameters")
        
        # Step 3: Fix any other token parameters stored in value_string
        print("\n📋 Step 3: Checking for other misplaced token parameters...")
        
        misplaced_tokens = await conn.fetch("""
            SELECT DISTINCT resource_type, param_name, COUNT(*) as count
            FROM fhir.search_params
            WHERE param_type = 'token'
            AND value_string IS NOT NULL
            AND value_token_code IS NULL
            GROUP BY resource_type, param_name
        """)
        
        if misplaced_tokens:
            print("Found misplaced token parameters:")
            for row in misplaced_tokens:
                print(f"  {row['resource_type']}.{row['param_name']}: {row['count']} entries")
                
                # Fix each type
                update_result = await conn.execute("""
                    UPDATE fhir.search_params
                    SET value_token_code = value_string,
                        value_string = NULL
                    WHERE resource_type = $1
                    AND param_name = $2
                    AND param_type = 'token'
                    AND value_string IS NOT NULL
                    AND value_token_code IS NULL
                """, row['resource_type'], row['param_name'])
                
                print(f"    ✅ Fixed {update_result.split()[-1]} entries")
        else:
            print("✅ No other misplaced token parameters found")
        
        # Step 4: Verify the fixes
        print("\n📋 Step 4: Verifying fixes...")
        
        # Check MedicationRequest active status
        active_meds = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.search_params
            WHERE resource_type = 'MedicationRequest'
            AND param_name = 'status'
            AND value_token_code = 'active'
        """)
        
        print(f"  MedicationRequests with status=active: {active_meds}")
        
        # Check Condition active clinical-status
        active_conditions = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.search_params
            WHERE resource_type = 'Condition'
            AND param_name = 'clinical-status'
            AND value_token_code = 'active'
        """)
        
        print(f"  Conditions with clinical-status=active: {active_conditions}")
        
        await conn.close()
        print(f"\n✅ Search parameter fixes completed at: {datetime.now()}")
        
    except Exception as e:
        print(f"\n❌ Error during fix: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(fix_search_params())