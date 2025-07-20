#!/usr/bin/env python3
"""
Test Data Summary Script

Provides a quick summary of what test data is available for different
clinical modules and testing scenarios.

Created: 2025-01-20
"""

import asyncio
import asyncpg
import sys
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)


async def get_test_data_summary(database_url: str = None):
    """Generate a summary of available test data."""
    database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
    
    try:
        conn = await asyncpg.connect(database_url)
        
        # Header
        logger.info("\n" + "=" * 70)
        logger.info("TEST DATA SUMMARY FOR WINTEHR")
        logger.info("=" * 70)
        logger.info(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        # Check if data exists
        total = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
        """)
        
        if total == 0:
            logger.error("❌ No test data available!")
            logger.info("\n📝 To load test data:")
            logger.info("   ./fresh-deploy.sh --patients 20")
            await conn.close()
            return
        
        # Get patient count
        patient_count = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Patient' AND deleted = false
        """)
        
        logger.info(f"📊 Total Patients: {patient_count}")
        logger.info(f"📊 Total Resources: {total:,}\n")
        
        # Module-specific data availability
        logger.info("🏥 CLINICAL MODULE TEST DATA")
        logger.info("-" * 70)
        
        # Chart Review Module
        conditions = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Condition' AND deleted = false
        """)
        
        vitals = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Observation' 
            AND resource->'category' @> '[{"coding": [{"code": "vital-signs"}]}]'
            AND deleted = false
        """)
        
        allergies = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'AllergyIntolerance' AND deleted = false
        """)
        
        logger.info(f"\n📋 Chart Review Module:")
        logger.info(f"   ✅ Conditions (Problems): {conditions}")
        logger.info(f"   ✅ Vital Signs: {vitals}")
        logger.info(f"   ✅ Allergies: {allergies}")
        logger.info(f"   Test Scenario: View patient problems, vitals, and allergies")
        
        # Orders Module
        med_requests = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'MedicationRequest' AND deleted = false
        """)
        
        service_requests = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'ServiceRequest' AND deleted = false
        """)
        
        logger.info(f"\n📝 Orders Module:")
        logger.info(f"   ✅ Medication Orders: {med_requests}")
        if service_requests > 0:
            logger.info(f"   ✅ Service Requests: {service_requests}")
        else:
            logger.info(f"   ⚠️  Service Requests: 0 (run generate_service_requests.py)")
        logger.info(f"   Test Scenario: Create and manage clinical orders")
        
        # Results Module
        lab_results = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'Observation' 
            AND resource->'category' @> '[{"coding": [{"code": "laboratory"}]}]'
            AND deleted = false
        """)
        
        diagnostic_reports = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'DiagnosticReport' AND deleted = false
        """)
        
        logger.info(f"\n🧪 Results Module:")
        logger.info(f"   ✅ Lab Results: {lab_results}")
        logger.info(f"   ✅ Diagnostic Reports: {diagnostic_reports}")
        logger.info(f"   Test Scenario: View lab results with trends and critical values")
        
        # Pharmacy Module
        active_meds = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'MedicationRequest' 
            AND resource->>'status' = 'active'
            AND deleted = false
        """)
        
        logger.info(f"\n💊 Pharmacy Module:")
        logger.info(f"   ✅ Total Prescriptions: {med_requests}")
        logger.info(f"   ✅ Active Prescriptions: {active_meds}")
        logger.info(f"   Test Scenario: Prescription verification and dispensing workflow")
        
        # Imaging Module
        imaging_studies = await conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources
            WHERE resource_type = 'ImagingStudy' AND deleted = false
        """)
        
        logger.info(f"\n🏥 Imaging Module:")
        if imaging_studies > 0:
            logger.info(f"   ✅ Imaging Studies: {imaging_studies}")
            logger.info(f"   Test Scenario: View DICOM images with multi-slice support")
        else:
            logger.info(f"   ⚠️  Imaging Studies: 0")
            logger.info(f"   Run: docker exec emr-backend python scripts/active/generate_dicom_for_studies.py")
        
        # Sample test patients
        logger.info(f"\n\n🧪 SAMPLE TEST PATIENTS")
        logger.info("-" * 70)
        
        patients = await conn.fetch("""
            SELECT 
                p.fhir_id,
                p.resource->'name'->0->>'family' as family,
                p.resource->'name'->0->'given'->0 as given,
                p.resource->>'birthDate' as birth_date,
                (SELECT COUNT(*) FROM fhir.resources c 
                 WHERE c.resource_type = 'Condition' 
                 AND c.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                 AND c.deleted = false) as conditions,
                (SELECT COUNT(*) FROM fhir.resources m 
                 WHERE m.resource_type = 'MedicationRequest' 
                 AND m.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                 AND m.deleted = false) as medications
            FROM fhir.resources p
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            ORDER BY conditions DESC, medications DESC
            LIMIT 5
        """)
        
        for p in patients:
            name = f"{p['given']} {p['family']}" if p['given'] and p['family'] else "Unknown"
            logger.info(f"\nPatient/{p['fhir_id']}")
            logger.info(f"   Name: {name}")
            logger.info(f"   DOB: {p['birth_date']}")
            logger.info(f"   Conditions: {p['conditions']}, Medications: {p['medications']}")
        
        # Test recommendations
        logger.info(f"\n\n🎯 TESTING RECOMMENDATIONS")
        logger.info("-" * 70)
        
        logger.info("\n1. Basic Functionality Tests:")
        logger.info("   - Patient search: /fhir/R4/Patient?name=Smith")
        logger.info("   - Patient summary: /fhir/R4/Patient/[ID]/$everything")
        logger.info("   - Active medications: /fhir/R4/MedicationRequest?patient=[ID]&status=active")
        
        logger.info("\n2. Clinical Workflow Tests:")
        logger.info("   - Chart Review: Load patient with conditions and observations")
        logger.info("   - Orders: Create new medication and lab orders")
        logger.info("   - Results: View lab results with reference ranges")
        logger.info("   - Pharmacy: Process prescription dispensing")
        
        logger.info("\n3. Performance Tests:")
        logger.info("   - Patient load time: Use test_patient_load_performance.py")
        logger.info("   - Search performance: Use test_search_functionality.py")
        logger.info("   - Bundle operations: Test $everything with different sizes")
        
        # Data quality checks
        search_params = await conn.fetchval("""
            SELECT COUNT(DISTINCT resource_id) FROM fhir.search_params
        """)
        
        compartments = await conn.fetchval("""
            SELECT COUNT(DISTINCT resource_id) FROM fhir.compartments
        """)
        
        logger.info(f"\n\n📊 DATA QUALITY METRICS")
        logger.info("-" * 70)
        logger.info(f"Resources with search parameters: {search_params}/{total} "
                   f"({search_params*100/total if total > 0 else 0:.1f}%)")
        logger.info(f"Resources in compartments: {compartments}")
        
        if search_params < total * 0.8:
            logger.info("\n⚠️  Low search parameter coverage!")
            logger.info("   Run: docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix")
        
        await conn.close()
        
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        sys.exit(1)


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Test data summary')
    parser.add_argument('--database-url', help='Database connection URL')
    
    args = parser.parse_args()
    
    asyncio.run(get_test_data_summary(args.database_url))