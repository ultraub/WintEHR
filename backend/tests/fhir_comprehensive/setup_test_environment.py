#!/usr/bin/env python3
"""
Setup Test Environment for FHIR API Testing

This script ensures the test database is properly prepared with all necessary
data transformations and indexing that occur during a normal build process.

Created: 2025-01-20
"""

import asyncio
import asyncpg
import subprocess
import sys
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


class TestEnvironmentSetup:
    """Manages test environment setup for FHIR API testing."""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or os.getenv(
            'TEST_DATABASE_URL',
            'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        )
        self.backend_dir = Path(__file__).parent.parent.parent
        self.scripts_dir = self.backend_dir / 'scripts'
        self.required_patient_count = 5
        self.setup_complete = False
        
    async def setup(self) -> bool:
        """Run complete test environment setup."""
        logger.info("🚀 Starting FHIR API test environment setup...")
        logger.info("=" * 60)
        
        try:
            # Step 1: Verify database
            if not await self.verify_database():
                return False
                
            # Step 2: Check existing data
            data_status = await self.check_data_status()
            if not data_status['has_sufficient_data']:
                logger.error("Insufficient test data. Please run synthea_master.py first.")
                return False
                
            # Step 3: Index search parameters
            if not await self.index_search_parameters():
                logger.warning("Search parameter indexing had issues")
                
            # Step 4: Populate compartments
            if not await self.populate_compartments():
                logger.warning("Compartment population had issues")
                
            # Step 5: Optimize indexes
            if not await self.optimize_database_indexes():
                logger.warning("Database optimization had issues")
                
            # Step 6: Fix any schema issues
            if not await self.fix_schema_issues():
                logger.warning("Schema fixes had issues")
                
            # Step 7: Validate setup
            if not await self.validate_setup():
                logger.error("Setup validation failed")
                return False
                
            self.setup_complete = True
            logger.info("=" * 60)
            logger.info("✅ Test environment setup completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"Setup failed: {e}")
            return False
    
    async def verify_database(self) -> bool:
        """Verify database connectivity and schema."""
        logger.info("🔍 Verifying database...")
        
        try:
            conn = await asyncpg.connect(self.database_url)
            
            # Check FHIR tables exist
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'fhir'
                AND table_name IN ('resources', 'search_params', 'compartments', 
                                   'references', 'resource_history', 'audit_logs')
            """)
            
            if len(tables) < 6:
                logger.error(f"Missing FHIR tables. Found only {len(tables)} of 6 required tables.")
                logger.info("Run: python scripts/setup/init_database_definitive.py")
                await conn.close()
                return False
            
            logger.info(f"  ✓ All 6 FHIR tables present")
            
            await conn.close()
            return True
            
        except Exception as e:
            logger.error(f"Database verification failed: {e}")
            return False
    
    async def check_data_status(self) -> Dict[str, any]:
        """Check existing test data status."""
        logger.info("📊 Checking existing data...")
        
        conn = await asyncpg.connect(self.database_url)
        
        # Get resource counts
        resource_counts = await conn.fetch("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
            GROUP BY resource_type
            ORDER BY count DESC
        """)
        
        counts = {row['resource_type']: row['count'] for row in resource_counts}
        patient_count = counts.get('Patient', 0)
        
        # Check search parameter coverage
        search_coverage = await conn.fetchval("""
            WITH resource_counts AS (
                SELECT COUNT(DISTINCT id) as total_resources
                FROM fhir.resources
                WHERE resource_type IN ('Patient', 'Condition', 'Observation', 
                                      'MedicationRequest', 'Procedure', 'Encounter')
                AND (deleted = false OR deleted IS NULL)
            ),
            param_counts AS (
                SELECT COUNT(DISTINCT resource_id) as indexed_resources
                FROM fhir.search_params
                WHERE param_name IN ('_id', 'patient', 'subject', 'name', 'identifier')
            )
            SELECT 
                CASE 
                    WHEN rc.total_resources = 0 THEN 100.0
                    ELSE (pc.indexed_resources * 100.0 / rc.total_resources)
                END as coverage
            FROM resource_counts rc, param_counts pc
        """)
        
        # Check compartment coverage
        compartment_coverage = await conn.fetchval("""
            WITH clinical_resources AS (
                SELECT COUNT(DISTINCT id) as total_resources
                FROM fhir.resources
                WHERE resource_type IN ('Condition', 'Observation', 'MedicationRequest', 
                                      'Procedure', 'Encounter', 'Immunization')
                AND (deleted = false OR deleted IS NULL)
            ),
            compartment_counts AS (
                SELECT COUNT(DISTINCT resource_id) as compartmented_resources
                FROM fhir.compartments
                WHERE compartment_type = 'Patient'
            )
            SELECT 
                CASE 
                    WHEN cr.total_resources = 0 THEN 100.0
                    ELSE (cc.compartmented_resources * 100.0 / cr.total_resources)
                END as coverage
            FROM clinical_resources cr, compartment_counts cc
        """)
        
        await conn.close()
        
        status = {
            'resource_counts': counts,
            'patient_count': patient_count,
            'total_resources': sum(counts.values()),
            'search_coverage': float(search_coverage or 0),
            'compartment_coverage': float(compartment_coverage or 0),
            'has_sufficient_data': patient_count >= self.required_patient_count
        }
        
        logger.info(f"  Patients: {patient_count}")
        logger.info(f"  Total resources: {status['total_resources']}")
        logger.info(f"  Search parameter coverage: {status['search_coverage']:.1f}%")
        logger.info(f"  Compartment coverage: {status['compartment_coverage']:.1f}%")
        
        return status
    
    async def index_search_parameters(self) -> bool:
        """Index search parameters using the preferred script."""
        logger.info("🔍 Indexing search parameters...")
        
        # Check which scripts are available
        fast_script = self.scripts_dir / 'fast_search_indexing.py'
        consolidated_script = self.scripts_dir / 'consolidated_search_indexing.py'
        
        try:
            if fast_script.exists():
                logger.info("  Using fast_search_indexing.py...")
                result = subprocess.run(
                    ['python', str(fast_script), '--docker', '--batch-size', '2000', '--workers', '4'],
                    cwd=self.backend_dir,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                
                if result.returncode == 0:
                    logger.info("  ✓ Search parameters indexed successfully")
                    return True
                else:
                    logger.warning(f"  Fast indexing failed: {result.stderr}")
                    
            # Fallback to consolidated script
            if consolidated_script.exists():
                logger.info("  Trying consolidated_search_indexing.py...")
                result = subprocess.run(
                    ['python', str(consolidated_script), '--docker', '--mode', 'index'],
                    cwd=self.backend_dir,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                
                if result.returncode == 0:
                    logger.info("  ✓ Search parameters indexed successfully")
                    return True
                else:
                    logger.error(f"  Consolidated indexing failed: {result.stderr}")
                    
            logger.error("  No search indexing script found")
            return False
            
        except subprocess.TimeoutExpired:
            logger.error("  Search indexing timed out")
            return False
        except Exception as e:
            logger.error(f"  Search indexing error: {e}")
            return False
    
    async def populate_compartments(self) -> bool:
        """Populate patient compartments."""
        logger.info("📁 Populating compartments...")
        
        script = self.scripts_dir / 'populate_compartments.py'
        
        if not script.exists():
            logger.warning("  Compartment script not found")
            return False
            
        try:
            result = subprocess.run(
                ['python', str(script)],
                cwd=self.backend_dir,
                capture_output=True,
                text=True,
                timeout=180
            )
            
            if result.returncode == 0:
                logger.info("  ✓ Compartments populated successfully")
                return True
            else:
                logger.error(f"  Compartment population failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"  Compartment population error: {e}")
            return False
    
    async def optimize_database_indexes(self) -> bool:
        """Optimize database indexes for performance."""
        logger.info("⚡ Optimizing database indexes...")
        
        # Check for optimization script
        optimize_script = self.scripts_dir / 'optimize_database_indexes.py'
        
        if optimize_script.exists():
            try:
                result = subprocess.run(
                    ['python', str(optimize_script)],
                    cwd=self.backend_dir,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                if result.returncode == 0:
                    logger.info("  ✓ Database indexes optimized")
                    return True
                else:
                    logger.warning(f"  Optimization had issues: {result.stderr}")
                    
            except Exception as e:
                logger.warning(f"  Optimization error: {e}")
        
        # Always run ANALYZE to update statistics
        try:
            conn = await asyncpg.connect(self.database_url)
            await conn.execute("ANALYZE fhir.resources")
            await conn.execute("ANALYZE fhir.search_params")
            await conn.execute("ANALYZE fhir.compartments")
            await conn.close()
            logger.info("  ✓ Database statistics updated")
            return True
            
        except Exception as e:
            logger.error(f"  Failed to update statistics: {e}")
            return False
    
    async def fix_schema_issues(self) -> bool:
        """Fix any known schema issues."""
        logger.info("🔧 Checking for schema issues...")
        
        # Fix CDS hooks enabled column if needed
        cds_script = self.scripts_dir / 'fix_cds_hooks_enabled_column.py'
        
        if cds_script.exists():
            try:
                result = subprocess.run(
                    ['python', str(cds_script)],
                    cwd=self.backend_dir,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    logger.info("  ✓ Schema issues fixed")
                else:
                    logger.warning("  Schema fix had issues")
                    
            except Exception as e:
                logger.warning(f"  Schema fix error: {e}")
        
        return True
    
    async def validate_setup(self) -> bool:
        """Validate the test environment is properly set up."""
        logger.info("✅ Validating test environment...")
        
        conn = await asyncpg.connect(self.database_url)
        issues = []
        
        try:
            # Check patient count
            patient_count = await conn.fetchval(
                "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient' AND (deleted = false OR deleted IS NULL)"
            )
            
            if patient_count < self.required_patient_count:
                issues.append(f"Insufficient patients: {patient_count} < {self.required_patient_count}")
            else:
                logger.info(f"  ✓ Patient count: {patient_count}")
            
            # Check search parameters
            search_param_count = await conn.fetchval(
                "SELECT COUNT(*) FROM fhir.search_params WHERE param_name IN ('name', 'patient', 'subject')"
            )
            
            if search_param_count == 0:
                issues.append("No critical search parameters indexed")
            else:
                logger.info(f"  ✓ Search parameters: {search_param_count}")
            
            # Check compartments
            compartment_count = await conn.fetchval(
                "SELECT COUNT(*) FROM fhir.compartments WHERE compartment_type = 'Patient'"
            )
            
            if compartment_count == 0:
                issues.append("No patient compartments found")
            else:
                logger.info(f"  ✓ Compartments: {compartment_count}")
            
            # Test a basic search
            test_search = await conn.fetchval("""
                SELECT COUNT(*) 
                FROM fhir.resources r
                JOIN fhir.search_params sp ON r.id = sp.resource_id
                WHERE r.resource_type = 'Patient'
                AND sp.param_name = '_id'
                LIMIT 1
            """)
            
            if test_search is not None:
                logger.info("  ✓ Basic search functionality verified")
            else:
                issues.append("Search functionality test failed")
                
        finally:
            await conn.close()
        
        if issues:
            logger.error("Validation issues found:")
            for issue in issues:
                logger.error(f"  - {issue}")
            return False
        
        logger.info("  ✓ All validations passed")
        return True
    
    async def get_summary(self) -> Dict[str, any]:
        """Get a summary of the test environment."""
        if not self.setup_complete:
            return {"error": "Setup not complete"}
            
        data_status = await self.check_data_status()
        
        return {
            "setup_complete": True,
            "timestamp": datetime.now().isoformat(),
            "database_url": self.database_url.split('@')[1],  # Hide password
            "patient_count": data_status['patient_count'],
            "total_resources": data_status['total_resources'],
            "resource_types": len(data_status['resource_counts']),
            "search_coverage": f"{data_status['search_coverage']:.1f}%",
            "compartment_coverage": f"{data_status['compartment_coverage']:.1f}%",
            "top_resources": [
                {"type": k, "count": v} 
                for k, v in sorted(
                    data_status['resource_counts'].items(), 
                    key=lambda x: x[1], 
                    reverse=True
                )[:10]
            ]
        }


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Setup test environment for FHIR API testing'
    )
    parser.add_argument(
        '--database-url', 
        help='Database connection URL',
        default=os.getenv('TEST_DATABASE_URL')
    )
    parser.add_argument(
        '--summary-only', 
        action='store_true',
        help='Only show current status without running setup'
    )
    
    args = parser.parse_args()
    
    setup = TestEnvironmentSetup(args.database_url)
    
    if args.summary_only:
        # Just show current status
        data_status = await setup.check_data_status()
        print(json.dumps(data_status, indent=2))
    else:
        # Run full setup
        success = await setup.setup()
        
        if success:
            # Show summary
            summary = await setup.get_summary()
            
            print("\n" + "=" * 60)
            print("TEST ENVIRONMENT SUMMARY")
            print("=" * 60)
            print(json.dumps(summary, indent=2))
            print("=" * 60)
            
            sys.exit(0)
        else:
            sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())