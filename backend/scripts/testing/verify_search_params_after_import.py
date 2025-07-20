#!/usr/bin/env python3
"""
Verify search parameters were properly extracted after data import.

This script should be run after importing FHIR resources to ensure
search parameters were correctly extracted and indexed.

Usage:
    python scripts/verify_search_params_after_import.py
    python scripts/verify_search_params_after_import.py --fix
    python scripts/verify_search_params_after_import.py --verbose
"""

import asyncio
import asyncpg
from datetime import datetime
import sys
import argparse
import subprocess
import logging


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def verify_search_params(fix: bool = False, verbose: bool = False):
    """Verify search parameters were extracted for imported resources."""
    
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info(f"🔍 Search Parameter Import Verification")
    logger.info(f"{'=' * 60}")
    
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
                logger.error(f"❌ {resource_type}: {missing_params} of {resource_count} resources missing patient/subject params")
            else:
                logger.info(f"✅ {resource_type}: All {resource_count} resources have patient/subject params")
        
        # Check overall search parameter statistics
        total_resources = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE deleted = FALSE OR deleted IS NULL
        """)
        
        total_search_params = await conn.fetchval("SELECT COUNT(*) FROM fhir.search_params")
        
        avg_params_per_resource = total_search_params / total_resources if total_resources > 0 else 0
        
        logger.info(f"\n📊 Overall Statistics:")
        logger.info(f"   Total resources: {total_resources}")
        logger.info(f"   Total search parameters: {total_search_params}")
        logger.info(f"   Average params per resource: {avg_params_per_resource:.1f}")
        
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
            logger.warning(f"\n⚠️  Resources with NO search parameters:")
            for row in unindexed_resources:
                logger.warning(f"   {row['resource_type']}: {row['count']}")
                issues_found.append(f"{row['resource_type']}: {row['count']} completely unindexed")
        
        await conn.close()
        
        # Final verdict
        logger.info(f"\n{'=' * 60}")
        if all_passed and not unindexed_resources:
            logger.info("✅ VERIFICATION PASSED: All critical search parameters are present")
            return 0
        else:
            logger.error("❌ VERIFICATION FAILED: Search parameters are missing")
            logger.error("\nIssues found:")
            for issue in issues_found:
                logger.error(f"  - {issue}")
            
            if fix:
                logger.info("\n🔧 Attempting to fix missing search parameters...")
                
                # Try to run the consolidated search indexing script
                try:
                    # First try consolidated script
                    result = subprocess.run(
                        ["python", "/app/scripts/consolidated_search_indexing.py", "--mode", "fix"],
                        capture_output=True,
                        text=True
                    )
                    
                    if result.returncode == 0:
                        logger.info("✅ Fix completed successfully")
                        logger.info("Re-running verification...")
                        
                        # Re-run verification without fix flag
                        return await verify_search_params(fix=False, verbose=verbose)
                    else:
                        # Fallback to legacy script if needed
                        logger.warning("Consolidated script failed, trying legacy method...")
                        result = subprocess.run(
                            ["python", "/app/scripts/active/run_migration.py"],
                            capture_output=True,
                            text=True
                        )
                        
                        if result.returncode == 0:
                            logger.info("✅ Fix completed with legacy script")
                            return await verify_search_params(fix=False, verbose=verbose)
                        else:
                            logger.error("❌ Fix failed")
                            if verbose:
                                logger.error(result.stderr)
                            return 1
                except Exception as e:
                    logger.error(f"Error running fix: {e}")
                    return 1
            else:
                logger.info("\n💡 To fix: Run with --fix flag or 'python scripts/consolidated_search_indexing.py --mode fix'")
                return 1
            
    except Exception as e:
        logger.error(f"❌ Error during verification: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return 2


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Verify search parameters after import')
    parser.add_argument('--fix', action='store_true', help='Attempt to fix missing parameters')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose output')
    
    args = parser.parse_args()
    
    exit_code = await verify_search_params(fix=args.fix, verbose=args.verbose)
    return exit_code


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)