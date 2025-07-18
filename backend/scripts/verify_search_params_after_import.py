#!/usr/bin/env python3
"""
Verify search parameters were properly extracted after data import.

This script should be run after importing FHIR resources to ensure
search parameters were correctly extracted and indexed.

Usage:
    python scripts/verify_search_params_after_import.py
"""

import asyncio
import asyncpg
from datetime import datetime
import sys


async def verify_search_params():
    """Verify search parameters were extracted for imported resources."""
    
    print(f"🔍 Search Parameter Import Verification")
    print(f"{'=' * 60}")
    
    try:
        conn = await asyncpg.connect("postgresql://emr_user:emr_password@postgres:5432/emr_db")
        
        # Define critical resource types that MUST have patient/subject references
        critical_resource_types = {
            'Condition': ('subject', 'patient'),
            'Observation': ('subject', 'patient'),
            'MedicationRequest': ('subject', 'patient'),
            'Procedure': ('subject', 'patient'),
            'Immunization': ('patient',),
            'AllergyIntolerance': ('patient',),
            'DiagnosticReport': ('subject', 'patient'),
            'CarePlan': ('subject', 'patient'),
            'Goal': ('subject', 'patient'),
            'Encounter': ('subject', 'patient')
        }
        
        all_passed = True
        issues_found = []
        
        for resource_type, expected_params in critical_resource_types.items():
            # Count resources of this type
            resource_count = await conn.fetchval("""
                SELECT COUNT(*) FROM fhir.resources 
                WHERE resource_type = $1 
                AND (deleted = FALSE OR deleted IS NULL)
            """, resource_type)
            
            if resource_count == 0:
                continue  # Skip if no resources of this type
            
            # Check for resources missing patient/subject references
            missing_params = await conn.fetchval("""
                SELECT COUNT(*) FROM fhir.resources r
                WHERE r.resource_type = $1
                AND (r.deleted = FALSE OR r.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.search_params sp
                    WHERE sp.resource_id = r.id
                    AND sp.param_name = ANY($2::text[])
                    AND sp.param_type = 'reference'
                )
            """, resource_type, list(expected_params))
            
            if missing_params > 0:
                all_passed = False
                issues_found.append(f"{resource_type}: {missing_params}/{resource_count} missing patient/subject params")
                print(f"❌ {resource_type}: {missing_params} of {resource_count} resources missing patient/subject params")
            else:
                print(f"✅ {resource_type}: All {resource_count} resources have patient/subject params")
        
        # Check overall search parameter statistics
        total_resources = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE deleted = FALSE OR deleted IS NULL
        """)
        
        total_search_params = await conn.fetchval("SELECT COUNT(*) FROM fhir.search_params")
        
        avg_params_per_resource = total_search_params / total_resources if total_resources > 0 else 0
        
        print(f"\n📊 Overall Statistics:")
        print(f"   Total resources: {total_resources}")
        print(f"   Total search parameters: {total_search_params}")
        print(f"   Average params per resource: {avg_params_per_resource:.1f}")
        
        # Check for completely unindexed resources
        unindexed_resources = await conn.fetch("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources r
            WHERE (deleted = FALSE OR deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
            )
            GROUP BY resource_type
            HAVING COUNT(*) > 0
        """)
        
        if unindexed_resources:
            print(f"\n⚠️  Resources with NO search parameters:")
            for row in unindexed_resources:
                print(f"   {row['resource_type']}: {row['count']}")
                issues_found.append(f"{row['resource_type']}: {row['count']} completely unindexed")
        
        await conn.close()
        
        # Final verdict
        print(f"\n{'=' * 60}")
        if all_passed and not unindexed_resources:
            print("✅ VERIFICATION PASSED: All critical search parameters are present")
            return 0
        else:
            print("❌ VERIFICATION FAILED: Search parameters are missing")
            print("\nIssues found:")
            for issue in issues_found:
                print(f"  - {issue}")
            print("\n💡 To fix: Run 'python scripts/active/run_migration.py'")
            return 1
            
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        import traceback
        traceback.print_exc()
        return 2


if __name__ == "__main__":
    exit_code = asyncio.run(verify_search_params())
    sys.exit(exit_code)