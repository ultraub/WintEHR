#!/usr/bin/env python3
"""
Comprehensive FHIR Data Validation Script

This script provides a complete analysis of what FHIR data is currently available
in the system, including:
- Resource types and counts
- Clinical data availability (conditions, medications, observations, etc.)
- Data quality metrics
- Resource relationships
- Search parameter coverage

Created: 2025-01-20
Location: backend/scripts/testing/validate_fhir_data.py
"""

import asyncio
import asyncpg
import sys
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import logging
import json
from collections import defaultdict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FHIRDataValidator:
    """Comprehensive FHIR data validation and analysis."""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        self.conn = None
        self.resource_counts = {}
        self.clinical_data = {}
        self.quality_metrics = {}
        self.sample_resources = {}
        
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
    
    async def get_resource_counts(self):
        """Get counts of all FHIR resource types."""
        logger.info("\n🔍 Analyzing FHIR Resource Types...")
        
        # Get all resource types and counts
        resources = await self.conn.fetch("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
            GROUP BY resource_type
            ORDER BY count DESC
        """)
        
        total = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
        """)
        
        logger.info(f"\n📊 Total Resources: {total}")
        logger.info("Resource Type Distribution:")
        logger.info("-" * 50)
        
        for r in resources:
            self.resource_counts[r['resource_type']] = r['count']
            logger.info(f"  {r['resource_type']:.<30} {r['count']:>10,}")
    
    async def analyze_clinical_data(self):
        """Analyze clinical data availability."""
        logger.info("\n🏥 Clinical Data Analysis...")
        
        # Patients with demographics
        patients = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """)
        
        patients_with_names = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND resource->'name' IS NOT NULL
            AND jsonb_array_length(resource->'name') > 0
            AND deleted = false
        """)
        
        self.clinical_data['patients'] = {
            'total': patients,
            'with_names': patients_with_names,
            'without_names': patients - patients_with_names
        }
        
        # Conditions (diagnoses)
        conditions = await self.conn.fetch("""
            SELECT 
                resource->>'clinicalStatus' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
            GROUP BY status
        """)
        
        self.clinical_data['conditions'] = {
            'total': sum(c['count'] for c in conditions),
            'by_status': {c['status']: c['count'] for c in conditions if c['status']}
        }
        
        # Medications
        med_requests = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
        """)
        
        active_meds = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND resource->>'status' = 'active'
            AND deleted = false
        """)
        
        self.clinical_data['medications'] = {
            'total_requests': med_requests,
            'active': active_meds
        }
        
        # Observations (labs, vitals)
        observations = await self.conn.fetch("""
            SELECT 
                resource->'category'->0->'coding'->0->>'code' as category,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            GROUP BY category
            ORDER BY count DESC
        """)
        
        self.clinical_data['observations'] = {
            'total': sum(o['count'] for o in observations),
            'by_category': {o['category'] or 'uncategorized': o['count'] for o in observations}
        }
        
        # Encounters
        encounters = await self.conn.fetch("""
            SELECT 
                resource->'class'->>'code' as encounter_class,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Encounter'
            AND deleted = false
            GROUP BY encounter_class
        """)
        
        self.clinical_data['encounters'] = {
            'total': sum(e['count'] for e in encounters),
            'by_class': {e['encounter_class'] or 'unknown': e['count'] for e in encounters}
        }
        
        # Print clinical data summary
        logger.info("\n📋 Clinical Data Summary:")
        logger.info("-" * 50)
        logger.info(f"Patients: {self.clinical_data['patients']['total']} "
                   f"(with names: {self.clinical_data['patients']['with_names']})")
        logger.info(f"Conditions: {self.clinical_data['conditions']['total']}")
        logger.info(f"Medication Requests: {self.clinical_data['medications']['total_requests']} "
                   f"(active: {self.clinical_data['medications']['active']})")
        logger.info(f"Observations: {self.clinical_data['observations']['total']}")
        logger.info(f"Encounters: {self.clinical_data['encounters']['total']}")
    
    async def check_data_quality(self):
        """Check data quality metrics."""
        logger.info("\n✅ Data Quality Checks...")
        
        # Check for orphaned resources
        orphaned_conditions = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources c
            WHERE c.resource_type = 'Condition'
            AND c.deleted = false
            AND NOT EXISTS (
                SELECT 1 FROM fhir.resources p
                WHERE p.resource_type = 'Patient'
                AND p.fhir_id = (c.resource->'subject'->>'reference')::text
                    REPLACE('Patient/', '')
                AND p.deleted = false
            )
        """)
        
        # Check search parameter coverage
        resources_without_search = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources r
            WHERE (r.deleted = false OR r.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
            )
        """)
        
        # Check compartment coverage
        resources_without_compartments = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources r
            WHERE r.resource_type IN ('Condition', 'Observation', 'MedicationRequest', 'Procedure')
            AND (r.deleted = false OR r.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.compartments c
                WHERE c.resource_id = r.id
            )
        """)
        
        self.quality_metrics = {
            'orphaned_conditions': orphaned_conditions,
            'resources_without_search_params': resources_without_search,
            'resources_without_compartments': resources_without_compartments
        }
        
        logger.info("\n🔍 Quality Metrics:")
        logger.info("-" * 50)
        logger.info(f"Orphaned Conditions: {orphaned_conditions}")
        logger.info(f"Resources without search params: {resources_without_search}")
        logger.info(f"Resources without compartments: {resources_without_compartments}")
    
    async def get_sample_resources(self):
        """Get sample resources for testing."""
        logger.info("\n📝 Sample Resources for Testing...")
        
        # Get sample patients
        patients = await self.conn.fetch("""
            SELECT fhir_id, resource->>'name' as name
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            LIMIT 5
        """)
        
        self.sample_resources['patients'] = []
        for p in patients:
            name_data = json.loads(p['name']) if p['name'] else []
            name = 'Unknown'
            if name_data and isinstance(name_data, list) and name_data:
                name_obj = name_data[0]
                given = name_obj.get('given', [])
                family = name_obj.get('family', '')
                name = f"{' '.join(given)} {family}".strip()
            
            self.sample_resources['patients'].append({
                'id': p['fhir_id'],
                'name': name
            })
        
        logger.info("\n🧪 Sample Patient IDs for Testing:")
        for p in self.sample_resources['patients']:
            logger.info(f"  Patient/{p['id']} - {p['name']}")
    
    async def check_resource_relationships(self):
        """Analyze resource relationships."""
        logger.info("\n🔗 Resource Relationships...")
        
        # Check references
        references = await self.conn.fetch("""
            SELECT 
                source_resource_type,
                target_resource_type,
                COUNT(*) as count
            FROM fhir.references
            WHERE target_resource_type IS NOT NULL
            GROUP BY source_resource_type, target_resource_type
            ORDER BY count DESC
            LIMIT 10
        """)
        
        logger.info("\nTop Resource Relationships:")
        logger.info("-" * 50)
        for r in references:
            logger.info(f"  {r['source_resource_type']} → {r['target_resource_type']}: {r['count']}")
    
    async def check_available_features(self):
        """Check what clinical features have data available."""
        logger.info("\n🌟 Available Clinical Features...")
        
        features = {
            'Chart Review': False,
            'Orders': False,
            'Results': False,
            'Pharmacy': False,
            'Imaging': False,
            'Care Plans': False,
            'Allergies': False,
            'Immunizations': False
        }
        
        # Check Chart Review data (Conditions, Observations)
        if self.resource_counts.get('Condition', 0) > 0 and self.resource_counts.get('Observation', 0) > 0:
            features['Chart Review'] = True
        
        # Check Orders (ServiceRequest, MedicationRequest)
        if self.resource_counts.get('ServiceRequest', 0) > 0 or self.resource_counts.get('MedicationRequest', 0) > 0:
            features['Orders'] = True
        
        # Check Results (Observation with lab category, DiagnosticReport)
        lab_obs = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->'category' @> '[{"coding": [{"code": "laboratory"}]}]'
            AND deleted = false
        """)
        if lab_obs > 0 or self.resource_counts.get('DiagnosticReport', 0) > 0:
            features['Results'] = True
        
        # Check Pharmacy (MedicationRequest, MedicationStatement)
        if self.resource_counts.get('MedicationRequest', 0) > 0:
            features['Pharmacy'] = True
        
        # Check Imaging (ImagingStudy, DiagnosticReport with imaging)
        if self.resource_counts.get('ImagingStudy', 0) > 0:
            features['Imaging'] = True
        
        # Check Care Plans
        if self.resource_counts.get('CarePlan', 0) > 0:
            features['Care Plans'] = True
        
        # Check Allergies
        if self.resource_counts.get('AllergyIntolerance', 0) > 0:
            features['Allergies'] = True
        
        # Check Immunizations
        if self.resource_counts.get('Immunization', 0) > 0:
            features['Immunizations'] = True
        
        logger.info("\n✨ Clinical Features with Available Data:")
        logger.info("-" * 50)
        for feature, available in features.items():
            status = "✅ Available" if available else "❌ No Data"
            logger.info(f"  {feature:.<30} {status}")
    
    async def generate_summary_report(self, output_file: Optional[str] = None):
        """Generate a comprehensive summary report."""
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_resources': sum(self.resource_counts.values()),
            'resource_types': len(self.resource_counts),
            'resource_counts': self.resource_counts,
            'clinical_data': self.clinical_data,
            'quality_metrics': self.quality_metrics,
            'sample_resources': self.sample_resources
        }
        
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2)
            logger.info(f"\n📄 Report saved to: {output_file}")
        
        return report
    
    async def run(self, verbose: bool = False, output_file: Optional[str] = None):
        """Run the complete validation."""
        await self.connect()
        
        try:
            logger.info("=" * 60)
            logger.info("FHIR DATA VALIDATION REPORT")
            logger.info("=" * 60)
            logger.info(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            # Run all checks
            await self.get_resource_counts()
            await self.analyze_clinical_data()
            await self.check_data_quality()
            await self.check_resource_relationships()
            await self.check_available_features()
            await self.get_sample_resources()
            
            # Generate report
            report = await self.generate_summary_report(output_file)
            
            # Summary
            logger.info("\n" + "=" * 60)
            logger.info("VALIDATION SUMMARY")
            logger.info("=" * 60)
            
            if sum(self.resource_counts.values()) == 0:
                logger.error("❌ No FHIR data found in the system!")
                logger.info("\n💡 To load data, run:")
                logger.info("   docker exec emr-backend python scripts/active/synthea_master.py full --count 20")
                return False
            else:
                logger.info(f"✅ System contains {sum(self.resource_counts.values()):,} FHIR resources")
                logger.info(f"✅ {self.clinical_data['patients']['total']} patients loaded")
                
                if self.quality_metrics['resources_without_search_params'] > 0:
                    logger.warning(f"⚠️  {self.quality_metrics['resources_without_search_params']} resources need search parameter indexing")
                    logger.info("   Run: docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix")
                
                if self.quality_metrics['resources_without_compartments'] > 0:
                    logger.warning(f"⚠️  {self.quality_metrics['resources_without_compartments']} resources need compartment assignment")
                    logger.info("   Run: docker exec emr-backend python scripts/populate_compartments.py")
                
                return True
            
        finally:
            await self.disconnect()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Validate FHIR data in the system')
    parser.add_argument('--verbose', '-v', action='store_true', 
                       help='Show detailed information')
    parser.add_argument('--output', '-o', help='Save report to JSON file')
    parser.add_argument('--database-url', help='Database connection URL')
    
    args = parser.parse_args()
    
    validator = FHIRDataValidator(database_url=args.database_url)
    success = await validator.run(verbose=args.verbose, output_file=args.output)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    asyncio.run(main())