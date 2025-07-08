#!/usr/bin/env python3
import json
import asyncio
import asyncpg
from collections import defaultdict
from pathlib import Path
import logging


async def comprehensive_synthea_validation():
    """Perform comprehensive validation of Synthea data import"""
    
    logging.info("=== COMPREHENSIVE SYNTHEA DATA IMPORT CHECK ===\n")
    # Connect to database
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='emr_user',
        password='emr_password',
        database='emr_db'
    )
    
    # 1. Get current database counts by resource type
    logging.info("1. Current Database Resource Counts:")
    logging.info("-" * 50)
    query = """
        SELECT resource_type, COUNT(*) as count
        FROM fhir.resources
        WHERE deleted = false
        GROUP BY resource_type
        ORDER BY count DESC
    """
    
    db_counts = {}
    rows = await conn.fetch(query)
    total_db = 0
    for row in rows:
        db_counts[row['resource_type']] = row['count']
        total_db += row['count']
        logging.info(f"{row['resource_type']:30} {row['count']:8}")
    logging.info(f"\nTotal resources in database: {total_db}")
    # 2. Check for orphaned references
    logging.info("\n\n2. Checking for Orphaned References:")
    logging.info("-" * 50)
    # Check if references point to existing resources
    orphan_query = """
        WITH all_references AS (
            SELECT 
                r.id,
                r.resource_type,
                ref->>'reference' as reference,
                ref->>'type' as ref_type
            FROM fhir.resources r,
                 jsonb_array_elements(
                     CASE 
                         WHEN r.data ? 'subject' AND r.data->'subject' ? 'reference' 
                         THEN jsonb_build_array(r.data->'subject')
                         ELSE '[]'::jsonb
                     END ||
                     CASE 
                         WHEN r.data ? 'patient' AND r.data->'patient' ? 'reference' 
                         THEN jsonb_build_array(r.data->'patient')
                         ELSE '[]'::jsonb
                     END ||
                     CASE 
                         WHEN r.data ? 'encounter' AND r.data->'encounter' ? 'reference' 
                         THEN jsonb_build_array(r.data->'encounter')
                         ELSE '[]'::jsonb
                     END ||
                     CASE 
                         WHEN r.data ? 'performer' AND jsonb_typeof(r.data->'performer') = 'array'
                         THEN r.data->'performer'
                         ELSE '[]'::jsonb
                     END ||
                     CASE 
                         WHEN r.data ? 'author' AND jsonb_typeof(r.data->'author') = 'array'
                         THEN r.data->'author'
                         ELSE '[]'::jsonb
                     END
                 ) as ref
            WHERE r.deleted = false
              AND ref->>'reference' IS NOT NULL
        ),
        reference_check AS (
            SELECT 
                ar.resource_type,
                ar.reference,
                CASE 
                    WHEN ar.reference LIKE 'urn:uuid:%' THEN 
                        EXISTS (
                            SELECT 1 FROM fhir.resources r2 
                            WHERE r2.id::text = substring(ar.reference from 10)
                            AND r2.deleted = false
                        )
                    WHEN ar.reference LIKE '%/%' THEN
                        EXISTS (
                            SELECT 1 FROM fhir.resources r2 
                            WHERE r2.resource_type = split_part(ar.reference, '/', 1)
                            AND r2.id::text = split_part(ar.reference, '/', 2)
                            AND r2.deleted = false
                        )
                    ELSE false
                END as exists_in_db
            FROM all_references ar
        )
        SELECT 
            resource_type,
            COUNT(*) FILTER (WHERE NOT exists_in_db) as orphaned_refs,
            COUNT(*) as total_refs
        FROM reference_check
        GROUP BY resource_type
        HAVING COUNT(*) FILTER (WHERE NOT exists_in_db) > 0
        ORDER BY orphaned_refs DESC
    """
    
    try:
        orphan_rows = await conn.fetch(orphan_query)
        if orphan_rows:
            for row in orphan_rows:
                logging.info(f"{row['resource_type']:20} {row['orphaned_refs']:8} orphaned out of {row['total_refs']:8} total")
        else:
            logging.info("✓ No orphaned references found!")
    except Exception as e:
        logging.error(f"Error checking orphaned references: {e}")
    # 3. Check for required resource types
    logging.info("\n\n3. Synthea Standard Resource Type Coverage:")
    logging.info("-" * 50)
    synthea_standard_types = {
        # Core patient data
        'Patient': 'Core patient demographics',
        'Practitioner': 'Healthcare providers',
        'PractitionerRole': 'Provider roles and specialties',
        'Organization': 'Healthcare organizations',
        'Location': 'Physical locations',
        
        # Clinical data
        'Encounter': 'Patient visits and encounters',
        'Condition': 'Diagnoses and problems',
        'Observation': 'Vital signs, lab results, etc.',
        'Procedure': 'Procedures performed',
        'MedicationRequest': 'Prescription orders',
        'MedicationAdministration': 'Medication given',
        'Medication': 'Medication definitions',
        'Immunization': 'Vaccination records',
        'AllergyIntolerance': 'Allergies and intolerances',
        
        # Care coordination
        'CarePlan': 'Care plans',
        'CareTeam': 'Care team members',
        'Goal': 'Treatment goals',
        
        # Diagnostics
        'DiagnosticReport': 'Lab and imaging reports',
        'ImagingStudy': 'Medical imaging',
        'DocumentReference': 'Clinical documents',
        'Media': 'Images and other media',
        
        # Financial
        'Claim': 'Insurance claims',
        'ExplanationOfBenefit': 'Insurance EOBs',
        'Coverage': 'Insurance coverage',
        
        # Supplies & Devices
        'Device': 'Medical devices',
        'SupplyDelivery': 'Medical supplies',
        
        # Provenance
        'Provenance': 'Resource history and origin'
    }
    
    for resource_type, description in synthea_standard_types.items():
        count = db_counts.get(resource_type, 0)
        status = "✓" if count > 0 else "✗ MISSING"
        logging.info(f"{resource_type:25} {status:10} {count:8}  {description}")
    # 4. Check medication references
    logging.info("\n\n4. Medication Reference Analysis:")
    logging.info("-" * 50)
    med_query = """
        SELECT 
            COUNT(*) FILTER (WHERE data->'medicationReference' IS NOT NULL) as with_reference,
            COUNT(*) FILTER (WHERE data->'medicationCodeableConcept' IS NOT NULL) as with_concept,
            COUNT(*) as total
        FROM fhir.resources
        WHERE resource_type = 'MedicationRequest'
        AND deleted = false
    """
    
    med_row = await conn.fetch(med_query)
    if med_row:
        row = med_row[0]
        logging.info(f"MedicationRequests with reference: {row['with_reference']}")
        logging.info(f"MedicationRequests with concept: {row['with_concept']}")
        logging.info(f"Total MedicationRequests: {row['total']}")
    # 5. Check for duplicate patients
    logging.info("\n\n5. Duplicate Patient Check:")
    logging.info("-" * 50)
    dup_query = """
        WITH patient_names AS (
            SELECT 
                id,
                data->'name'->0->>'family' as family,
                data->'name'->0->'given'->0 as given,
                data->>'birthDate' as birth_date
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        )
        SELECT 
            family,
            given,
            birth_date,
            COUNT(*) as count
        FROM patient_names
        GROUP BY family, given, birth_date
        HAVING COUNT(*) > 1
        ORDER BY count DESC
    """
    
    dup_rows = await conn.fetch(dup_query)
    if dup_rows:
        logging.info("Found potential duplicate patients:")
        for row in dup_rows:
            logging.info(f"  {row['given']} {row['family']} (DOB: {row['birth_date']}): {row['count']} records")
    else:
        logging.info("✓ No duplicate patients found!")
    # 6. Compare with source files
    logging.info("\n\n6. Source File Analysis:")
    logging.info("-" * 50)
    # Count resources in current synthea output
    synthea_output = Path('synthea/output/fhir')
    patient_files = list(synthea_output.glob('*.json'))
    patient_files = [f for f in patient_files if 'hospitalInformation' not in f.name and 'practitionerInformation' not in f.name]
    
    logging.info(f"Current synthea output directory: {synthea_output}")
    logging.info(f"Patient files: {len(patient_files)}")
    # Check backup directories
    backup_dir = Path('data/synthea_backups')
    if backup_dir.exists():
        backups = sorted(backup_dir.glob('synthea_backup_*'))
        logging.info(f"\nBackup directories found: {len(backups)}")
        if backups:
            latest = backups[-1]
            latest_files = list(latest.glob('*.json'))
            latest_patient_files = [f for f in latest_files if 'hospitalInformation' not in f.name and 'practitionerInformation' not in f.name]
            logging.info(f"Latest backup: {latest.name}")
            logging.info(f"Latest backup patient files: {len(latest_patient_files)}")
    # 7. Resource creation timeline
    logging.info("\n\n7. Resource Import Timeline:")
    logging.info("-" * 50)
    timeline_query = """
        SELECT 
            DATE(created) as import_date,
            resource_type,
            COUNT(*) as count
        FROM fhir.resources
        WHERE deleted = false
        GROUP BY DATE(created), resource_type
        ORDER BY import_date DESC, count DESC
        LIMIT 20
    """
    
    timeline_rows = await conn.fetch(timeline_query)
    current_date = None
    for row in timeline_rows:
        if row['import_date'] != current_date:
            current_date = row['import_date']
            logging.info(f"\n{current_date}:")
        logging.info(f"  {row['resource_type']:20} {row['count']:8}")
    await conn.close()
    
    # 8. Summary and Recommendations
    logging.info("\n\n=== SUMMARY ===")
    logging.info("-" * 50)
    logging.info(f"Total resources in database: {total_db}")
    logging.info(f"Resource types in database: {len(db_counts)}")
    logging.info(f"Current synthea output files: {len(patient_files)} patients")
    # Check for missing critical types
    missing_critical = []
    for rt in ['Patient', 'Practitioner', 'Organization', 'Location']:
        if db_counts.get(rt, 0) == 0:
            missing_critical.append(rt)
    
    if missing_critical:
        logging.info(f"\n⚠️  Missing critical resource types: {', '.join(missing_critical)}")
        logging.info("   These are typically in separate files (hospitalInformation, practitionerInformation)")
    # Check if counts make sense
    if db_counts.get('Patient', 0) > 0:
        avg_resources_per_patient = total_db / db_counts['Patient']
        logging.info(f"\nAverage resources per patient: {avg_resources_per_patient:.0f}")
        if avg_resources_per_patient < 100:
            logging.info("⚠️  Low resource count per patient - may indicate incomplete import")
        elif avg_resources_per_patient > 2000:
            logging.info("⚠️  Very high resource count per patient - may indicate duplicate imports")
        else:
            logging.info("✓ Resource count per patient appears normal")
if __name__ == "__main__":
    asyncio.run(comprehensive_synthea_validation())