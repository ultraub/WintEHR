#!/usr/bin/env python3
"""
Setup Test Data for FHIR API Testing

This script ensures the database has proper test data for comprehensive FHIR API testing.
It validates existing data and can optionally load fresh data if needed.

Created: 2025-01-20
"""

import asyncio
import asyncpg
import subprocess
import sys
import logging
from datetime import datetime
from typing import Dict, List, Tuple
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TestDataSetup:
    """Manages test data setup for FHIR API testing."""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        self.min_patients = 5
        self.min_resources_per_patient = {
            'Condition': 3,
            'Observation': 10,
            'MedicationRequest': 2,
            'Encounter': 5,
            'Procedure': 1,
            'AllergyIntolerance': 1,
            'Immunization': 5
        }
    
    async def check_database_health(self) -> bool:
        """Check if database is accessible and has proper tables."""
        try:
            conn = await asyncpg.connect(self.database_url)
            
            # Check if FHIR tables exist
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
                return False
            
            await conn.close()
            return True
            
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    async def check_existing_data(self) -> Dict[str, any]:
        """Check what test data already exists."""
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
        
        # Get patient count and details
        patients = await conn.fetch("""
            SELECT 
                fhir_id,
                resource->'name'->0->>'family' as family,
                resource->'name'->0->'given'->0 as given,
                created_at
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            ORDER BY created_at DESC
            LIMIT 10
        """)
        
        # Check search parameter coverage
        search_coverage = await conn.fetchval("""
            SELECT 
                CASE 
                    WHEN COUNT(DISTINCT r.id) = 0 THEN 0
                    ELSE COUNT(DISTINCT sp.resource_id) * 100.0 / COUNT(DISTINCT r.id)
                END as coverage
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id
            WHERE r.deleted = false OR r.deleted IS NULL
        """)
        
        # Check compartment coverage
        compartment_coverage = await conn.fetchval("""
            SELECT 
                CASE 
                    WHEN COUNT(*) = 0 THEN 0
                    ELSE COUNT(DISTINCT compartment_id) * 100.0 / COUNT(*)
                END as coverage
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND (deleted = false OR deleted IS NULL)
        """)
        
        await conn.close()
        
        return {
            'resource_counts': counts,
            'patient_count': counts.get('Patient', 0),
            'patients': [dict(p) for p in patients],
            'search_coverage': float(search_coverage or 0),
            'compartment_coverage': float(compartment_coverage or 0)
        }
    
    async def validate_test_readiness(self, data_info: Dict) -> Tuple[bool, List[str]]:
        """Validate if current data is sufficient for testing."""
        issues = []
        
        # Check patient count
        if data_info['patient_count'] < self.min_patients:
            issues.append(f"Insufficient patients: {data_info['patient_count']} < {self.min_patients}")
        
        # Check resource diversity
        for resource_type, min_count in self.min_resources_per_patient.items():
            total_needed = min_count * self.min_patients
            actual = data_info['resource_counts'].get(resource_type, 0)
            if actual < total_needed:
                issues.append(f"Insufficient {resource_type}: {actual} < {total_needed}")
        
        # Check search parameter indexing
        if data_info['search_coverage'] < 90:
            issues.append(f"Low search parameter coverage: {data_info['search_coverage']:.1f}%")
        
        # Check compartments
        if data_info['compartment_coverage'] < 90:
            issues.append(f"Low compartment coverage: {data_info['compartment_coverage']:.1f}%")
        
        return len(issues) == 0, issues
    
    async def load_test_data(self, patient_count: int = 10):
        """Load fresh test data using synthea_master."""
        logger.info(f"Loading {patient_count} test patients...")
        
        try:
            # Use synthea_master to load data
            result = subprocess.run([
                'python', 'scripts/active/synthea_master.py', 
                'full', '--count', str(patient_count)
            ], capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"Failed to load test data: {result.stderr}")
                return False
            
            logger.info("Test data loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error loading test data: {e}")
            return False
    
    async def fix_search_parameters(self):
        """Ensure search parameters are properly indexed."""
        logger.info("Checking and fixing search parameters...")
        
        try:
            result = subprocess.run([
                'python', 'scripts/consolidated_search_indexing.py',
                '--mode', 'index'
            ], capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"Failed to index search parameters: {result.stderr}")
                return False
            
            logger.info("Search parameters indexed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error indexing search parameters: {e}")
            return False
    
    async def fix_compartments(self):
        """Ensure patient compartments are populated."""
        logger.info("Populating patient compartments...")
        
        try:
            # Import here to avoid circular imports
            sys.path.append('/app')
            from scripts.populate_compartments import populate_compartments
            
            await populate_compartments()
            logger.info("Compartments populated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error populating compartments: {e}")
            # Try subprocess as fallback
            try:
                result = subprocess.run([
                    'python', 'scripts/populate_compartments.py'
                ], capture_output=True, text=True)
                
                return result.returncode == 0
            except:
                return False
    
    async def generate_test_summary(self, data_info: Dict):
        """Generate a summary of available test data."""
        summary = {
            'generated_at': datetime.now().isoformat(),
            'database_status': 'healthy',
            'patient_count': data_info['patient_count'],
            'total_resources': sum(data_info['resource_counts'].values()),
            'resource_types': len(data_info['resource_counts']),
            'search_coverage': f"{data_info['search_coverage']:.1f}%",
            'compartment_coverage': f"{data_info['compartment_coverage']:.1f}%",
            'top_resources': []
        }
        
        # Get top 10 resource types
        sorted_resources = sorted(
            data_info['resource_counts'].items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:10]
        
        for resource_type, count in sorted_resources:
            summary['top_resources'].append({
                'type': resource_type,
                'count': count
            })
        
        # Sample patients for testing
        summary['sample_patients'] = []
        for patient in data_info['patients'][:5]:
            name = f"{patient.get('given', '')} {patient.get('family', '')}".strip()
            summary['sample_patients'].append({
                'id': patient['fhir_id'],
                'name': name or 'Unknown'
            })
        
        # Save summary
        with open('backend/tests/fhir_comprehensive/test_data/data_summary.json', 'w') as f:
            json.dump(summary, f, indent=2)
        
        return summary
    
    def print_summary(self, summary: Dict):
        """Print a formatted summary of test data."""
        print("\n" + "="*60)
        print("FHIR TEST DATA SUMMARY")
        print("="*60)
        print(f"Generated: {summary['generated_at']}")
        print(f"Database Status: {summary['database_status']}")
        print(f"\nData Overview:")
        print(f"  Total Patients: {summary['patient_count']}")
        print(f"  Total Resources: {summary['total_resources']:,}")
        print(f"  Resource Types: {summary['resource_types']}")
        print(f"  Search Coverage: {summary['search_coverage']}")
        print(f"  Compartment Coverage: {summary['compartment_coverage']}")
        
        print(f"\nTop Resource Types:")
        for resource in summary['top_resources']:
            print(f"  {resource['type']:.<30} {resource['count']:>8,}")
        
        print(f"\nSample Patients for Testing:")
        for patient in summary['sample_patients']:
            print(f"  Patient/{patient['id']} - {patient['name']}")
        
        print(f"\n✅ Test data is ready for comprehensive FHIR API testing!")
        print("="*60)


async def main():
    """Main setup function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Setup test data for FHIR API testing')
    parser.add_argument('--database-url', help='Database connection URL')
    parser.add_argument('--patients', type=int, default=10, help='Number of patients to load if needed')
    parser.add_argument('--force-reload', action='store_true', help='Force reload of test data')
    parser.add_argument('--fix-only', action='store_true', help='Only fix search params and compartments')
    
    args = parser.parse_args()
    
    setup = TestDataSetup(args.database_url)
    
    # Check database health
    logger.info("Checking database health...")
    if not await setup.check_database_health():
        logger.error("Database is not properly initialized. Please run database setup first.")
        sys.exit(1)
    
    # Check existing data
    logger.info("Checking existing test data...")
    data_info = await setup.check_existing_data()
    
    # Validate test readiness
    is_ready, issues = await setup.validate_test_readiness(data_info)
    
    if not is_ready and not args.fix_only:
        logger.warning("Test data validation issues found:")
        for issue in issues:
            logger.warning(f"  - {issue}")
        
        if args.force_reload or data_info['patient_count'] == 0:
            logger.info("Loading fresh test data...")
            if not await setup.load_test_data(args.patients):
                logger.error("Failed to load test data")
                sys.exit(1)
            
            # Re-check data after loading
            data_info = await setup.check_existing_data()
    
    # Fix search parameters if needed
    if data_info['search_coverage'] < 90:
        if not await setup.fix_search_parameters():
            logger.error("Failed to fix search parameters")
            sys.exit(1)
    
    # Fix compartments if needed
    if data_info['compartment_coverage'] < 90:
        if not await setup.fix_compartments():
            logger.error("Failed to fix compartments")
            sys.exit(1)
    
    # Final check
    data_info = await setup.check_existing_data()
    is_ready, issues = await setup.validate_test_readiness(data_info)
    
    if not is_ready:
        logger.error("Test data setup failed. Outstanding issues:")
        for issue in issues:
            logger.error(f"  - {issue}")
        sys.exit(1)
    
    # Generate and display summary
    summary = await setup.generate_test_summary(data_info)
    setup.print_summary(summary)
    
    logger.info("Test data setup completed successfully!")


if __name__ == '__main__':
    asyncio.run(main())