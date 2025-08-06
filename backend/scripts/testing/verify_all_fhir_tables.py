#!/usr/bin/env python3
"""
Comprehensive FHIR Table Verification Script

This script verifies the health and population of all FHIR database tables:
- fhir.resources
- fhir.resource_history
- fhir.search_params
- fhir.references
- fhir.compartments
- fhir.audit_logs

Usage:
    python verify_all_fhir_tables.py
    python verify_all_fhir_tables.py --verbose
    python verify_all_fhir_tables.py --fix
"""

import asyncio
import asyncpg
import sys
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FHIRTableVerifier:
    """Verifies all FHIR database tables."""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        self.conn = None
        self.issues = []
        self.warnings = []
        self.successes = []
    
    async def connect(self):
        """Connect to the database."""
        try:
            self.conn = await asyncpg.connect(self.database_url)
            logger.info("Connected to database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from the database."""
        if self.conn:
            await self.conn.close()
            logger.info("Disconnected from database")
    
    async def verify_resources_table(self):
        """Verify fhir.resources table."""
        logger.info("\n🔍 Verifying fhir.resources table...")
        
        # Check table exists
        exists = await self.conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' AND table_name = 'resources'
            )
        """)
        
        if not exists:
            self.issues.append("❌ fhir.resources table does not exist")
            return
        
        # Get resource counts by type
        resources = await self.conn.fetch("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
            GROUP BY resource_type
            ORDER BY count DESC
            LIMIT 10
        """)
        
        total = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
        """)
        
        if total == 0:
            self.issues.append("❌ No resources found in fhir.resources")
        else:
            self.successes.append(f"✅ fhir.resources: {total} resources")
            logger.info(f"  Total resources: {total}")
            logger.info("  Top resource types:")
            for r in resources:
                logger.info(f"    {r['resource_type']}: {r['count']}")
        
        # Check for resources without version_id
        no_version = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE version_id IS NULL
            AND (deleted = false OR deleted IS NULL)
        """)
        
        if no_version > 0:
            self.warnings.append(f"⚠️  {no_version} resources without version_id")
    
    async def verify_resource_history_table(self):
        """Verify fhir.resource_history table."""
        logger.info("\n🔍 Verifying fhir.resource_history table...")
        
        # Check table exists
        exists = await self.conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' AND table_name = 'resource_history'
            )
        """)
        
        if not exists:
            self.issues.append("❌ fhir.resource_history table does not exist")
            return
        
        # Get history stats
        total_history = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resource_history
        """)
        
        operations = await self.conn.fetch("""
            SELECT operation, COUNT(*) as count
            FROM fhir.resource_history
            GROUP BY operation
        """)
        
        if total_history == 0:
            self.warnings.append("⚠️  No history entries found")
        else:
            self.successes.append(f"✅ fhir.resource_history: {total_history} entries")
            logger.info(f"  Total history entries: {total_history}")
            logger.info("  Operations:")
            for op in operations:
                logger.info(f"    {op['operation']}: {op['count']}")
        
        # Check for orphaned history
        orphaned = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resource_history h
            WHERE NOT EXISTS (
                SELECT 1 FROM fhir.resources r
                WHERE r.id = h.resource_id
            )
        """)
        
        if orphaned > 0:
            self.warnings.append(f"⚠️  {orphaned} orphaned history entries")
    
    async def verify_search_params_table(self):
        """Verify fhir.search_params table."""
        logger.info("\n🔍 Verifying fhir.search_params table...")
        
        # Check table exists
        exists = await self.conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' AND table_name = 'search_params'
            )
        """)
        
        if not exists:
            self.issues.append("❌ fhir.search_params table does not exist")
            return
        
        # Get search param stats
        total_params = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.search_params
        """)
        
        param_types = await self.conn.fetch("""
            SELECT param_type, COUNT(*) as count
            FROM fhir.search_params
            GROUP BY param_type
            ORDER BY count DESC
        """)
        
        if total_params == 0:
            self.issues.append("❌ No search parameters found")
        else:
            self.successes.append(f"✅ fhir.search_params: {total_params} parameters")
            logger.info(f"  Total search parameters: {total_params}")
            logger.info("  Parameter types:")
            for pt in param_types:
                logger.info(f"    {pt['param_type']}: {pt['count']}")
        
        # Check critical search params
        critical_params = ['patient', 'subject', 'code', 'status', '_id']
        for param in critical_params:
            count = await self.conn.fetchval("""
                SELECT COUNT(DISTINCT resource_id)
                FROM fhir.search_params
                WHERE param_name = $1
            """, param)
            
            if count == 0:
                self.issues.append(f"❌ No resources indexed with '{param}' parameter")
            else:
                logger.info(f"  Resources with '{param}': {count}")
        
        # Check for resources without search params
        missing = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources r
            WHERE (r.deleted = false OR r.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
            )
        """)
        
        if missing > 0:
            self.warnings.append(f"⚠️  {missing} resources without search parameters")
    
    async def verify_references_table(self):
        """Verify fhir.references table."""
        logger.info("\n🔍 Verifying fhir.references table...")
        
        # Check table exists
        exists = await self.conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' AND table_name = 'references'
            )
        """)
        
        if not exists:
            self.issues.append("❌ fhir.references table does not exist")
            return
        
        # Get reference stats
        total_refs = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.references
        """)
        
        ref_types = await self.conn.fetch("""
            SELECT target_type, COUNT(*) as count
            FROM fhir.references
            WHERE target_type IS NOT NULL
            GROUP BY target_type
            ORDER BY count DESC
            LIMIT 10
        """)
        
        if total_refs == 0:
            self.warnings.append("⚠️  No references found")
        else:
            self.successes.append(f"✅ fhir.references: {total_refs} references")
            logger.info(f"  Total references: {total_refs}")
            logger.info("  Top target types:")
            for rt in ref_types:
                logger.info(f"    {rt['target_type']}: {rt['count']}")
        
        # Check for broken references
        broken = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.references ref
            WHERE ref.target_type = 'Patient'
            AND NOT EXISTS (
                SELECT 1 FROM fhir.resources r
                WHERE r.resource_type = 'Patient'
                AND r.fhir_id = ref.target_id
                AND (r.deleted = false OR r.deleted IS NULL)
            )
        """)
        
        if broken > 0:
            self.warnings.append(f"⚠️  {broken} broken Patient references")
    
    async def verify_compartments_table(self):
        """Verify fhir.compartments table."""
        logger.info("\n🔍 Verifying fhir.compartments table...")
        
        # Check table exists
        exists = await self.conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' AND table_name = 'compartments'
            )
        """)
        
        if not exists:
            self.issues.append("❌ fhir.compartments table does not exist")
            return
        
        # Get compartment stats
        total_compartments = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.compartments
        """)
        
        compartment_types = await self.conn.fetch("""
            SELECT compartment_type, COUNT(*) as count
            FROM fhir.compartments
            GROUP BY compartment_type
        """)
        
        if total_compartments == 0:
            self.issues.append("❌ No compartments found - Patient/$everything will not work")
        else:
            self.successes.append(f"✅ fhir.compartments: {total_compartments} entries")
            logger.info(f"  Total compartments: {total_compartments}")
            logger.info("  Compartment types:")
            for ct in compartment_types:
                logger.info(f"    {ct['compartment_type']}: {ct['count']}")
        
        # Check resources without compartments
        critical_types = ['Condition', 'Observation', 'MedicationRequest', 'Procedure']
        for resource_type in critical_types:
            missing = await self.conn.fetchval("""
                SELECT COUNT(*)
                FROM fhir.resources r
                WHERE r.resource_type = $1
                AND (r.deleted = false OR r.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.compartments c
                    WHERE c.resource_id = r.id
                )
            """, resource_type)
            
            if missing > 0:
                self.warnings.append(f"⚠️  {missing} {resource_type} resources without compartments")
    
    async def verify_audit_logs_table(self):
        """Verify fhir.audit_logs table."""
        logger.info("\n🔍 Verifying fhir.audit_logs table...")
        
        # Check table exists
        exists = await self.conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' AND table_name = 'audit_logs'
            )
        """)
        
        if not exists:
            self.issues.append("❌ fhir.audit_logs table does not exist")
            return
        
        # Get audit log stats
        total_logs = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.audit_logs
        """)
        
        if total_logs == 0:
            self.warnings.append("⚠️  No audit logs found - FHIR operations not being audited")
        else:
            self.successes.append(f"✅ fhir.audit_logs: {total_logs} entries")
            
            # Get recent activity
            recent = await self.conn.fetch("""
                SELECT action, COUNT(*) as count
                FROM fhir.audit_logs
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY action
                ORDER BY count DESC
                LIMIT 5
            """)
            
            if recent:
                logger.info(f"  Total audit logs: {total_logs}")
                logger.info("  Recent actions (last 7 days):")
                for r in recent:
                    logger.info(f"    {r['action']}: {r['count']}")
    
    async def check_table_sizes(self):
        """Check table sizes for monitoring."""
        logger.info("\n📊 Table Size Analysis...")
        
        sizes = await self.conn.fetch("""
            SELECT 
                schemaname || '.' || tablename as table_name,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables
            WHERE schemaname = 'fhir'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        """)
        
        logger.info("  Table sizes:")
        for s in sizes:
            logger.info(f"    {s['table_name']}: {s['size']}")
    
    async def suggest_fixes(self):
        """Suggest fixes for identified issues."""
        if not self.issues and not self.warnings:
            return
        
        logger.info("\n🔧 Suggested Fixes:")
        
        if any("search parameters" in issue for issue in self.issues + self.warnings):
            logger.info("  • Run: python scripts/consolidated_search_indexing.py --mode fix")
        
        if any("compartments" in issue for issue in self.issues + self.warnings):
            logger.info("  • Run: python scripts/populate_compartments.py")
        
        if any("audit logs" in issue for issue in self.issues + self.warnings):
            logger.info("  • Note: FHIR audit logging requires code changes to enable")
        
        if any("history" in issue for issue in self.issues + self.warnings):
            logger.info("  • History is created automatically during CRUD operations")
        
        if any("references" in issue for issue in self.issues + self.warnings):
            logger.info("  • References are extracted automatically during resource creation")
    
    async def run(self, verbose: bool = False, fix: bool = False):
        """Run the verification."""
        await self.connect()
        
        try:
            logger.info("FHIR Database Table Verification")
            logger.info("=" * 60)
            
            # Verify each table
            await self.verify_resources_table()
            await self.verify_resource_history_table()
            await self.verify_search_params_table()
            await self.verify_references_table()
            await self.verify_compartments_table()
            await self.verify_audit_logs_table()
            
            if verbose:
                await self.check_table_sizes()
            
            # Summary
            logger.info("\n" + "=" * 60)
            logger.info("VERIFICATION SUMMARY")
            logger.info("=" * 60)
            
            if self.successes:
                logger.info("\n✅ Passed Checks:")
                for success in self.successes:
                    logger.info(f"  {success}")
            
            if self.warnings:
                logger.info("\n⚠️  Warnings:")
                for warning in self.warnings:
                    logger.info(f"  {warning}")
            
            if self.issues:
                logger.info("\n❌ Issues Found:")
                for issue in self.issues:
                    logger.info(f"  {issue}")
            
            # Overall status
            if not self.issues:
                if not self.warnings:
                    logger.info("\n🎉 All FHIR tables are healthy!")
                    return True
                else:
                    logger.info("\n⚠️  FHIR tables have minor issues")
                    await self.suggest_fixes()
                    return True
            else:
                logger.error("\n❌ Critical issues found in FHIR tables")
                await self.suggest_fixes()
                
                if fix:
                    logger.info("\n🔧 Attempting automatic fixes...")
                    # Run fix scripts
                    import subprocess
                    
                    if any("search parameters" in issue for issue in self.issues):
                        logger.info("  Fixing search parameters...")
                        subprocess.run(["python", "/app/scripts/consolidated_search_indexing.py", "--mode", "fix"])
                    
                    if any("compartments" in issue for issue in self.issues):
                        logger.info("  Populating compartments...")
                        subprocess.run(["python", "/app/scripts/populate_compartments.py"])
                    
                    logger.info("\n  Re-running verification...")
                    # Reset and re-run
                    self.issues = []
                    self.warnings = []
                    self.successes = []
                    return await self.run(verbose=verbose, fix=False)
                
                return False
            
        finally:
            await self.disconnect()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Verify all FHIR database tables')
    parser.add_argument('--verbose', '-v', action='store_true', 
                       help='Show detailed information including table sizes')
    parser.add_argument('--fix', action='store_true',
                       help='Attempt to fix issues automatically')
    parser.add_argument('--database-url', help='Database connection URL')
    
    args = parser.parse_args()
    
    verifier = FHIRTableVerifier(database_url=args.database_url)
    success = await verifier.run(verbose=args.verbose, fix=args.fix)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    asyncio.run(main())