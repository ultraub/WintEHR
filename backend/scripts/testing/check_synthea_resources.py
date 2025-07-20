#!/usr/bin/env python3
"""
Quick Synthea Resource Check

This script provides a quick overview of what Synthea-generated FHIR resources
are available in the system. It's designed for rapid checking during development.

Created: 2025-01-20
"""

import asyncio
import asyncpg
import sys
from datetime import datetime
from typing import Dict, List
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def check_synthea_resources(database_url: str = None):
    """Quick check of Synthea resources."""
    database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
    
    try:
        conn = await asyncpg.connect(database_url)
        
        # Check if any data exists
        total = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
        """)
        
        if total == 0:
            logger.error("\n❌ No FHIR data found in the system!")
            logger.info("\n💡 To load Synthea data, run:")
            logger.info("   ./fresh-deploy.sh --patients 20")
            logger.info("   OR")
            logger.info("   docker exec emr-backend python scripts/active/synthea_master.py full --count 20")
            return
        
        logger.info("\n" + "=" * 60)
        logger.info("SYNTHEA RESOURCE SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"Total Resources: {total:,}")
        
        # Get resource counts
        resources = await conn.fetch("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
            GROUP BY resource_type
            ORDER BY count DESC
        """)
        
        # Categorize resources
        clinical_resources = {
            'Core': ['Patient', 'Practitioner', 'Organization', 'Location'],
            'Clinical': ['Condition', 'Observation', 'Procedure', 'Encounter'],
            'Medications': ['MedicationRequest', 'MedicationStatement', 'Medication'],
            'Diagnostics': ['DiagnosticReport', 'ImagingStudy', 'ServiceRequest'],
            'Care': ['CarePlan', 'CareTeam', 'Goal'],
            'Other': ['AllergyIntolerance', 'Immunization', 'Device', 'Claim']
        }
        
        # Print categorized resources
        resource_dict = {r['resource_type']: r['count'] for r in resources}
        
        for category, types in clinical_resources.items():
            logger.info(f"\n{category} Resources:")
            logger.info("-" * 40)
            for rtype in types:
                if rtype in resource_dict:
                    logger.info(f"  {rtype:.<25} {resource_dict[rtype]:>8,}")
        
        # Print any uncategorized resources
        all_known = set()
        for types in clinical_resources.values():
            all_known.update(types)
        
        uncategorized = [r for r in resources if r['resource_type'] not in all_known]
        if uncategorized:
            logger.info("\nOther Resources:")
            logger.info("-" * 40)
            for r in uncategorized:
                logger.info(f"  {r['resource_type']:.<25} {r['count']:>8,}")
        
        # Sample patients for testing
        logger.info("\n📋 Sample Patients for Testing:")
        logger.info("-" * 40)
        
        patients = await conn.fetch("""
            SELECT 
                fhir_id,
                resource->'name'->0->>'family' as family,
                resource->'name'->0->'given'->0 as given,
                resource->>'birthDate' as birth_date
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            ORDER BY created_at DESC
            LIMIT 5
        """)
        
        for p in patients:
            name = f"{p['given']} {p['family']}" if p['given'] and p['family'] else "Unknown"
            logger.info(f"  Patient/{p['fhir_id']} - {name} (DOB: {p['birth_date']})")
        
        # Check data quality indicators
        logger.info("\n✅ Data Quality Indicators:")
        logger.info("-" * 40)
        
        # Patients with conditions
        patients_with_conditions = await conn.fetchval("""
            SELECT COUNT(DISTINCT resource->'subject'->>'reference')
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
        """)
        
        # Patients with medications
        patients_with_meds = await conn.fetchval("""
            SELECT COUNT(DISTINCT resource->'subject'->>'reference')
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
        """)
        
        # Patients with observations
        patients_with_obs = await conn.fetchval("""
            SELECT COUNT(DISTINCT resource->'subject'->>'reference')
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
        """)
        
        patient_count = resource_dict.get('Patient', 0)
        
        logger.info(f"  Patients with Conditions: {patients_with_conditions}/{patient_count}")
        logger.info(f"  Patients with Medications: {patients_with_meds}/{patient_count}")
        logger.info(f"  Patients with Observations: {patients_with_obs}/{patient_count}")
        
        # Check search parameter coverage
        search_coverage = await conn.fetchval("""
            SELECT COUNT(DISTINCT resource_id) * 100.0 / NULLIF(COUNT(*), 0)
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id
            WHERE r.deleted = false OR r.deleted IS NULL
        """)
        
        if search_coverage:
            logger.info(f"  Search Parameter Coverage: {search_coverage:.1f}%")
        
        # Testing recommendations
        logger.info("\n🧪 Testing Recommendations:")
        logger.info("-" * 40)
        
        if resource_dict.get('Condition', 0) > 0 and resource_dict.get('Observation', 0) > 0:
            logger.info("  ✅ Chart Review module - Sufficient clinical data")
        
        if resource_dict.get('MedicationRequest', 0) > 0:
            logger.info("  ✅ Pharmacy module - Medication data available")
        
        if resource_dict.get('ServiceRequest', 0) > 0:
            logger.info("  ✅ Orders module - Service requests available")
        
        if resource_dict.get('DiagnosticReport', 0) > 0 or resource_dict.get('Observation', 0) > 0:
            logger.info("  ✅ Results module - Lab/diagnostic data available")
        
        if resource_dict.get('ImagingStudy', 0) > 0:
            logger.info("  ✅ Imaging module - Imaging studies available")
        else:
            logger.info("  ⚠️  Imaging module - No imaging studies (run DICOM generation)")
        
        await conn.close()
        
    except Exception as e:
        logger.error(f"Error checking Synthea resources: {e}")
        sys.exit(1)


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Quick check of Synthea resources')
    parser.add_argument('--database-url', help='Database connection URL')
    
    args = parser.parse_args()
    
    asyncio.run(check_synthea_resources(args.database_url))