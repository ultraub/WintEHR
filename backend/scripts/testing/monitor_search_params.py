#!/usr/bin/env python3
"""
Monitor search parameter health and alert on issues.

This script checks for resources that are missing search parameters and
can optionally trigger re-indexing to fix the issues.

Usage:
    python scripts/monitor_search_params.py [--fix]
"""

import asyncio
import asyncpg
from datetime import datetime
import sys
import argparse


async def monitor_search_params(fix: bool = False):
    """Monitor search parameter health and optionally fix issues."""
    
    print(f"🔍 Search Parameter Health Monitor")
    print(f"{'=' * 60}")
    print(f"Started at: {datetime.now()}")
    print()
    
    try:
        # Connect to database
        conn = await asyncpg.connect("postgresql://emr_user:emr_password@postgres:5432/emr_db")
        print("✅ Connected to database")
        
        # Get total resource count
        total_resources = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE deleted = FALSE OR deleted IS NULL
        """)
        
        # Get resources without any search params
        resources_without_params = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources r
            WHERE (deleted = FALSE OR deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
            )
        """)
        
        # Get breakdown by resource type
        missing_params_by_type = await conn.fetch("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources r
            WHERE (deleted = FALSE OR deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
            )
            GROUP BY resource_type
            HAVING COUNT(*) > 0
            ORDER BY count DESC
        """)
        
        # Check specific critical search parameters
        critical_checks = []
        
        # Check patient references for clinical resources
        clinical_types = ['Condition', 'Observation', 'MedicationRequest', 'Procedure', 
                         'Immunization', 'AllergyIntolerance', 'DiagnosticReport']
        
        for resource_type in clinical_types:
            missing_patient_refs = await conn.fetchval("""
                SELECT COUNT(*) FROM fhir.resources r
                WHERE r.resource_type = $1
                AND (r.deleted = FALSE OR r.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.search_params sp
                    WHERE sp.resource_id = r.id
                    AND sp.param_name IN ('patient', 'subject')
                    AND sp.param_type = 'reference'
                )
            """, resource_type)
            
            if missing_patient_refs > 0:
                critical_checks.append(f"{resource_type}: {missing_patient_refs} missing patient/subject reference")
        
        # Display results
        print(f"\n📊 Overall Statistics:")
        print(f"   Total resources: {total_resources}")
        print(f"   Resources without any search params: {resources_without_params}")
        print(f"   Percentage indexed: {((total_resources - resources_without_params) / total_resources * 100):.1f}%")
        
        if missing_params_by_type:
            print(f"\n⚠️  Resources missing search parameters by type:")
            for row in missing_params_by_type:
                print(f"   {row['resource_type']}: {row['count']}")
        
        if critical_checks:
            print(f"\n❌ Critical search parameter issues:")
            for issue in critical_checks:
                print(f"   {issue}")
        
        # Check search parameter distribution
        param_stats = await conn.fetch("""
            SELECT param_name, param_type, COUNT(*) as count
            FROM fhir.search_params
            GROUP BY param_name, param_type
            ORDER BY count DESC
            LIMIT 20
        """)
        
        print(f"\n📊 Top 20 search parameters:")
        for row in param_stats:
            print(f"   {row['param_name']} ({row['param_type']}): {row['count']}")
        
        # Health assessment
        print(f"\n🏥 Health Assessment:")
        if resources_without_params == 0:
            print("   ✅ EXCELLENT: All resources have search parameters")
        elif resources_without_params < total_resources * 0.01:
            print("   ✅ GOOD: Less than 1% of resources missing parameters")
        elif resources_without_params < total_resources * 0.05:
            print("   ⚠️  WARNING: 1-5% of resources missing parameters")
        else:
            print("   ❌ CRITICAL: More than 5% of resources missing parameters")
        
        if fix and (resources_without_params > 0 or critical_checks):
            print(f"\n🔧 Fix requested - running re-indexing...")
            print("   Executing: python scripts/active/run_migration.py")
            
            # Import and run the migration
            sys.path.append('/app')
            from scripts.migrations.migrate_search_params import SearchParamMigrator
            
            migrator = SearchParamMigrator(batch_size=100)
            await migrator.migrate()
            
            print("   ✅ Re-indexing completed")
        elif resources_without_params > 0 or critical_checks:
            print(f"\n💡 To fix these issues, run:")
            print("   python scripts/monitor_search_params.py --fix")
            print("   OR")
            print("   python scripts/active/run_migration.py")
        
        await conn.close()
        print(f"\n✅ Monitoring completed at: {datetime.now()}")
        
        # Return exit code based on health
        if resources_without_params == 0:
            return 0  # Healthy
        elif resources_without_params < total_resources * 0.05:
            return 1  # Warning
        else:
            return 2  # Critical
        
    except Exception as e:
        print(f"\n❌ Error during monitoring: {e}")
        import traceback
        traceback.print_exc()
        return 3


async def main():
    parser = argparse.ArgumentParser(description='Monitor search parameter health')
    parser.add_argument('--fix', action='store_true', 
                       help='Automatically fix issues by running re-indexing')
    args = parser.parse_args()
    
    exit_code = await monitor_search_params(fix=args.fix)
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())