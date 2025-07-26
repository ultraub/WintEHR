#!/usr/bin/env python3
"""
WintEHR Unified Data Management Script

Consolidates all data management operations into a single, easy-to-use interface.
Replaces multiple scattered scripts with one comprehensive tool.

Usage:
    python manage_data.py load --patients 20        # Load patient data
    python manage_data.py index                     # Index search parameters
    python manage_data.py validate                  # Validate all data
    python manage_data.py clean                     # Clean all data
    python manage_data.py status                    # Check data status
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path
from typing import Optional, Dict, Any
import os

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db"
)


class DataManager:
    """Unified data management for WintEHR"""
    
    def __init__(self):
        self.engine = None
        self.async_session = None
        
    async def initialize(self):
        """Initialize database connection"""
        self.engine = create_async_engine(DATABASE_URL, echo=False)
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
        
    async def cleanup(self):
        """Clean up database connections"""
        if self.engine:
            await self.engine.dispose()
    
    # =========================================================================
    # Data Loading
    # =========================================================================
    
    async def load_patients(self, count: int = 20, include_dicom: bool = True):
        """Load patient data using synthea_master.py"""
        logger.info(f"Loading {count} patients...")
        
        try:
            # Import and run synthea_master
            from active.synthea_master import main as synthea_main
            
            # Configure arguments
            args = type('Args', (), {
                'command': 'full',
                'count': count,
                'validation_mode': 'light',
                'include_dicom': include_dicom,
                'workers': 4,
                'docker': True
            })()
            
            # Run synthea master
            await synthea_main(args)
            
            logger.info("✅ Patient data loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to load patient data: {e}")
            raise
    
    # =========================================================================
    # Search Indexing
    # =========================================================================
    
    async def index_search_parameters(self):
        """Index all search parameters for FHIR resources"""
        logger.info("Indexing search parameters...")
        
        try:
            # Try consolidated script first
            if Path("consolidated_search_indexing.py").exists():
                from consolidated_search_indexing import index_all_resources
                await index_all_resources(batch_size=2000)
            elif Path("fast_search_indexing.py").exists():
                from fast_search_indexing import main as index_main
                await index_main()
            else:
                logger.warning("No search indexing script found")
                return
            
            logger.info("✅ Search parameters indexed")
            
        except Exception as e:
            logger.error(f"❌ Failed to index search parameters: {e}")
            raise
    
    async def populate_compartments(self):
        """Populate patient compartments for efficient queries"""
        logger.info("Populating patient compartments...")
        
        try:
            if Path("populate_compartments.py").exists():
                from populate_compartments import populate_all_compartments
                await populate_all_compartments()
                logger.info("✅ Compartments populated")
            else:
                logger.warning("Compartment population script not found")
                
        except Exception as e:
            logger.error(f"❌ Failed to populate compartments: {e}")
            raise
    
    async def fix_references(self):
        """Fix and normalize FHIR references"""
        logger.info("Fixing FHIR references...")
        
        try:
            async with self.async_session() as session:
                # Add reference format variants for better search compatibility
                await session.execute(text("""
                    -- Add UUID-only references
                    INSERT INTO fhir.search_params (resource_id, resource_type, param_name, value_reference, value_string)
                    SELECT DISTINCT
                        sp.resource_id,
                        sp.resource_type,
                        sp.param_name,
                        REPLACE(sp.value_reference, 'urn:uuid:', '') as value_reference,
                        REPLACE(sp.value_reference, 'urn:uuid:', '') as value_string
                    FROM fhir.search_params sp
                    WHERE sp.param_name IN ('patient', 'subject')
                    AND sp.value_reference LIKE 'urn:uuid:%'
                    AND NOT EXISTS (
                        SELECT 1 FROM fhir.search_params sp2
                        WHERE sp2.resource_id = sp.resource_id
                        AND sp2.param_name = sp.param_name
                        AND sp2.value_reference = REPLACE(sp.value_reference, 'urn:uuid:', '')
                    );
                """))
                
                await session.commit()
                logger.info("✅ References fixed")
                
        except Exception as e:
            logger.error(f"❌ Failed to fix references: {e}")
            raise
    
    # =========================================================================
    # Data Validation
    # =========================================================================
    
    async def validate_data(self, verbose: bool = False):
        """Validate all FHIR data and indexes"""
        logger.info("Validating FHIR data...")
        
        validation_results = {
            "tables": {},
            "resources": {},
            "search_params": {},
            "compartments": {},
            "references": {}
        }
        
        async with self.async_session() as session:
            # Check FHIR tables
            tables = [
                'fhir.resources',
                'fhir.resource_history', 
                'fhir.search_params',
                'fhir.references',
                'fhir.compartments',
                'fhir.audit_logs'
            ]
            
            for table in tables:
                result = await session.execute(
                    text(f"SELECT COUNT(*) FROM {table}")
                )
                count = result.scalar()
                validation_results["tables"][table] = count
                
                if verbose:
                    logger.info(f"  {table}: {count} records")
            
            # Check resource types
            result = await session.execute(text("""
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources
                GROUP BY resource_type
                ORDER BY count DESC
            """))
            
            for row in result:
                validation_results["resources"][row.resource_type] = row.count
                if verbose:
                    logger.info(f"  {row.resource_type}: {row.count}")
            
            # Check search parameter coverage
            result = await session.execute(text("""
                SELECT 
                    r.resource_type,
                    COUNT(DISTINCT r.id) as total_resources,
                    COUNT(DISTINCT sp.resource_id) as indexed_resources
                FROM fhir.resources r
                LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id
                WHERE r.resource_type IN ('Patient', 'Condition', 'Observation', 'MedicationRequest')
                GROUP BY r.resource_type
            """))
            
            for row in result:
                coverage = (row.indexed_resources / row.total_resources * 100) if row.total_resources > 0 else 0
                validation_results["search_params"][row.resource_type] = {
                    "total": row.total_resources,
                    "indexed": row.indexed_resources,
                    "coverage": f"{coverage:.1f}%"
                }
                
                if verbose:
                    logger.info(f"  {row.resource_type}: {coverage:.1f}% search coverage")
        
        # Summary
        total_resources = sum(validation_results["resources"].values())
        resource_types = len(validation_results["resources"])
        
        logger.info(f"\n✅ Validation Summary:")
        logger.info(f"  Total Resources: {total_resources}")
        logger.info(f"  Resource Types: {resource_types}")
        logger.info(f"  Tables Verified: {len(validation_results['tables'])}")
        
        return validation_results
    
    # =========================================================================
    # Data Cleaning
    # =========================================================================
    
    async def clean_all_data(self, confirm: bool = False):
        """Clean all FHIR data (requires confirmation)"""
        if not confirm:
            logger.error("❌ Data cleaning requires --confirm flag")
            return
        
        logger.warning("⚠️  Cleaning all FHIR data...")
        
        async with self.async_session() as session:
            # Clean in correct order to respect foreign keys
            tables = [
                'fhir.audit_logs',
                'fhir.compartments',
                'fhir.references',
                'fhir.search_params',
                'fhir.resource_history',
                'fhir.resources'
            ]
            
            for table in tables:
                await session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                logger.info(f"  Cleaned {table}")
            
            await session.commit()
            
        logger.info("✅ All FHIR data cleaned")
    
    # =========================================================================
    # Status Check
    # =========================================================================
    
    async def check_status(self):
        """Check current data status"""
        logger.info("WintEHR Data Status")
        logger.info("==================")
        
        async with self.async_session() as session:
            # Patient count
            result = await session.execute(
                text("SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient'")
            )
            patient_count = result.scalar()
            logger.info(f"  Patients: {patient_count}")
            
            # Total resources
            result = await session.execute(
                text("SELECT COUNT(*) FROM fhir.resources")
            )
            total_resources = result.scalar()
            logger.info(f"  Total Resources: {total_resources}")
            
            # Resource types
            result = await session.execute(text("""
                SELECT COUNT(DISTINCT resource_type) 
                FROM fhir.resources
            """))
            resource_types = result.scalar()
            logger.info(f"  Resource Types: {resource_types}")
            
            # Search parameters
            result = await session.execute(
                text("SELECT COUNT(*) FROM fhir.search_params")
            )
            search_params = result.scalar()
            logger.info(f"  Search Parameters: {search_params}")
            
            # Compartments
            result = await session.execute(
                text("SELECT COUNT(DISTINCT compartment_id) FROM fhir.compartments WHERE compartment_type = 'Patient'")
            )
            compartments = result.scalar()
            logger.info(f"  Patient Compartments: {compartments}")
            
            # Recent activity
            result = await session.execute(text("""
                SELECT MAX(created_at) as last_created,
                       MAX(updated_at) as last_updated
                FROM fhir.resources
            """))
            row = result.one()
            if row.last_created:
                logger.info(f"  Last Created: {row.last_created}")
            if row.last_updated:
                logger.info(f"  Last Updated: {row.last_updated}")


# =============================================================================
# Main Entry Point
# =============================================================================

async def main():
    """Main entry point for data management"""
    parser = argparse.ArgumentParser(
        description="WintEHR Unified Data Management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python manage_data.py load --patients 20    # Load 20 patients
    python manage_data.py index                 # Index search parameters
    python manage_data.py validate --verbose    # Detailed validation
    python manage_data.py status               # Check data status
    python manage_data.py clean --confirm      # Clean all data
        """
    )
    
    # Commands
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Load command
    load_parser = subparsers.add_parser('load', help='Load patient data')
    load_parser.add_argument('--patients', type=int, default=20, help='Number of patients')
    load_parser.add_argument('--no-dicom', action='store_true', help='Skip DICOM generation')
    
    # Index command
    index_parser = subparsers.add_parser('index', help='Index search parameters')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate all data')
    validate_parser.add_argument('--verbose', action='store_true', help='Verbose output')
    
    # Clean command
    clean_parser = subparsers.add_parser('clean', help='Clean all data')
    clean_parser.add_argument('--confirm', action='store_true', help='Confirm data deletion')
    
    # Status command
    status_parser = subparsers.add_parser('status', help='Check data status')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize manager
    manager = DataManager()
    await manager.initialize()
    
    try:
        # Execute command
        if args.command == 'load':
            await manager.load_patients(
                count=args.patients,
                include_dicom=not args.no_dicom
            )
            # Auto-index after loading
            await manager.index_search_parameters()
            await manager.populate_compartments()
            await manager.fix_references()
            
        elif args.command == 'index':
            await manager.index_search_parameters()
            await manager.populate_compartments()
            await manager.fix_references()
            
        elif args.command == 'validate':
            await manager.validate_data(verbose=args.verbose)
            
        elif args.command == 'clean':
            await manager.clean_all_data(confirm=args.confirm)
            
        elif args.command == 'status':
            await manager.check_status()
            
    finally:
        await manager.cleanup()


if __name__ == "__main__":
    asyncio.run(main())