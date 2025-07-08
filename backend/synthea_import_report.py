#!/usr/bin/env python3
import json
import asyncio
import asyncpg
from collections import defaultdict
from pathlib import Path
from datetime import datetime
import logging


async def generate_synthea_import_report():
    """Generate comprehensive Synthea import validation report"""
    
    logging.info("=" * 80)
    logging.info("SYNTHEA DATA IMPORT COMPREHENSIVE CHECK REPORT")
    logging.info(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logging.info("=" * 80)
    # Connect to database
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='emr_user',
        password='emr_password',
        database='emr_db'
    )
    
    # 1. SOURCE FILE ANALYSIS
    logging.info("\n1. SOURCE FILE ANALYSIS")
    logging.info("-" * 50)
    # Analyze current synthea output
    synthea_output = Path('synthea/output/fhir')
    source_stats = defaultdict(int)
    source_patients = set()
    
    if synthea_output.exists():
        files = list(synthea_output.glob('*.json'))
        patient_files = [f for f in files if 'hospitalInformation' not in f.name and 'practitionerInformation' not in f.name]
        
        logging.info(f"Synthea output directory: {synthea_output}")
        logging.info(f"Total files: {len(files)}")
        logging.info(f"Patient bundle files: {len(patient_files)}")
        # Analyze each patient file
        for file_path in patient_files:
            try:
                with open(file_path, 'r') as f:
                    bundle = json.load(f)
                    
                if bundle.get('resourceType') == 'Bundle' and 'entry' in bundle:
                    # Find patient ID
                    for entry in bundle['entry']:
                        resource = entry.get('resource', {})
                        if resource.get('resourceType') == 'Patient':
                            patient_id = resource.get('id')
                            if patient_id:
                                source_patients.add(patient_id)
                        
                        # Count all resources
                        resource_type = resource.get('resourceType')
                        if resource_type:
                            source_stats[resource_type] += 1
            except Exception as e:
                logging.error(f"Error reading {file_path.name}: {e}")
        # Check hospital and practitioner files
        for pattern, name in [('hospitalInformation*.json', 'Hospital'), ('practitionerInformation*.json', 'Practitioner')]:
            info_files = list(synthea_output.glob(pattern))
            if info_files:
                logging.info(f"\n{name} information files: {len(info_files)}")
                for file_path in info_files:
                    try:
                        with open(file_path, 'r') as f:
                            bundle = json.load(f)
                        if bundle.get('resourceType') == 'Bundle' and 'entry' in bundle:
                            for entry in bundle['entry']:
                                resource_type = entry.get('resource', {}).get('resourceType')
                                if resource_type:
                                    source_stats[resource_type] += 1
                    except Exception as e:
                        logging.error(f"Error reading {file_path.name}: {e}")
    logging.info(f"\nUnique patients in source files: {len(source_patients)}")
    logging.info("\nResource types in source files:")
    total_source = sum(source_stats.values())
    for rt, count in sorted(source_stats.items(), key=lambda x: x[1], reverse=True):
        logging.info(f"  {rt:30} {count:8}")
    logging.info(f"\nTotal resources in source: {total_source}")
    # 2. DATABASE ANALYSIS
    logging.info("\n\n2. DATABASE ANALYSIS")
    logging.info("-" * 50)
    # Get database counts
    query = """
        SELECT resource_type, COUNT(*) as count
        FROM fhir.resources
        WHERE deleted = false
        GROUP BY resource_type
        ORDER BY count DESC
    """
    
    db_stats = {}
    rows = await conn.fetch(query)
    for row in rows:
        db_stats[row['resource_type']] = row['count']
    
    total_db = sum(db_stats.values())
    
    # Get patient count
    patient_query = """
        SELECT COUNT(DISTINCT fhir_id) as count
        FROM fhir.resources
        WHERE resource_type = 'Patient' AND deleted = false
    """
    patient_count = await conn.fetchval(patient_query)
    
    logging.info(f"Patients in database: {patient_count}")
    logging.info(f"Total resources in database: {total_db}")
    if patient_count > 0:
        logging.info(f"Average resources per patient: {total_db / patient_count:.0f}")
    logging.info("\nResource types in database:")
    for rt, count in sorted(db_stats.items(), key=lambda x: x[1], reverse=True):
        logging.info(f"  {rt:30} {count:8}")
    # 3. COMPARISON
    logging.info("\n\n3. SOURCE vs DATABASE COMPARISON")
    logging.info("-" * 80)
    logging.info(f"{'Resource Type':30} {'Source':>10} {'Database':>10} {'Diff':>10} {'Ratio':>8} Status")
    logging.info("-" * 80)
    all_types = sorted(set(source_stats.keys()) | set(db_stats.keys()))
    
    issues = []
    for rt in all_types:
        source = source_stats.get(rt, 0)
        db = db_stats.get(rt, 0)
        diff = db - source
        ratio = f"{db/source:.1f}x" if source > 0 else "N/A"
        
        status = ""
        if source > 0 and db == 0:
            status = "⚠️  MISSING IN DB"
            issues.append(f"{rt}: Not imported to database")
        elif source == 0 and db > 0:
            status = "📥 DB ONLY"
        elif db > source * 1.5:
            status = "📈 MULTIPLE IMPORTS?"
        elif db < source * 0.8:
            status = "⚠️  INCOMPLETE"
            issues.append(f"{rt}: Only {db}/{source} imported ({db/source*100:.0f}%)")
        else:
            status = "✓"
        
        logging.info(f"{rt:30} {source:10} {db:10} {diff:+10} {ratio:>8} {status}")
    # 4. MISSING RESOURCE TYPES
    logging.info("\n\n4. SYNTHEA STANDARD RESOURCE TYPES")
    logging.info("-" * 50)
    expected_types = {
        # Always present
        'Patient', 'Encounter', 'Condition', 'Observation', 'Procedure',
        'MedicationRequest', 'Immunization', 'CarePlan', 'CareTeam',
        'Claim', 'ExplanationOfBenefit', 'DiagnosticReport', 'DocumentReference',
        
        # Usually present
        'AllergyIntolerance', 'Device', 'ImagingStudy', 'MedicationAdministration',
        'Organization', 'Practitioner', 'PractitionerRole', 'Location',
        'Medication', 'SupplyDelivery', 'Provenance',
        
        # Sometimes present
        'Goal', 'Coverage', 'Media', 'ServiceRequest'
    }
    
    missing_in_source = []
    missing_in_db = []
    
    for rt in sorted(expected_types):
        in_source = rt in source_stats
        in_db = rt in db_stats
        
        if not in_source:
            missing_in_source.append(rt)
        if not in_db:
            missing_in_db.append(rt)
        
        status = f"Source: {'✓' if in_source else '✗'}  DB: {'✓' if in_db else '✗'}"
        logging.info(f"{rt:30} {status}")
    # 5. DATA INTEGRITY CHECKS
    logging.info("\n\n5. DATA INTEGRITY CHECKS")
    logging.info("-" * 50)
    # Check for URN references
    urn_query = """
        SELECT COUNT(*) as count
        FROM fhir.resources
        WHERE deleted = false
        AND resource::text LIKE '%urn:uuid:%'
    """
    urn_count = await conn.fetchval(urn_query)
    logging.info(f"Resources with URN references: {urn_count}")
    # Check medication references
    med_ref_query = """
        SELECT 
            COUNT(*) FILTER (WHERE resource->>'medicationReference' IS NOT NULL) as with_ref,
            COUNT(*) FILTER (WHERE resource->>'medicationCodeableConcept' IS NOT NULL) as with_concept,
            COUNT(*) as total
        FROM fhir.resources
        WHERE resource_type = 'MedicationRequest'
        AND deleted = false
    """
    med_stats = await conn.fetchrow(med_ref_query)
    if med_stats:
        logging.info(f"\nMedicationRequest analysis:")
        logging.info(f"  With medicationReference: {med_stats['with_ref']}")
        logging.info(f"  With medicationCodeableConcept: {med_stats['with_concept']}")
        logging.info(f"  Total: {med_stats['total']}")
    # Check for duplicate imports
    dup_query = """
        WITH patient_data AS (
            SELECT 
                resource->>'id' as synthea_id,
                resource->'name'->0->>'family' as family,
                resource->'name'->0->'given'->0 as given,
                resource->>'birthDate' as birth_date,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            GROUP BY synthea_id, family, given, birth_date
        )
        SELECT * FROM patient_data WHERE count > 1
    """
    dups = await conn.fetch(dup_query)
    if dups:
        logging.info(f"\n⚠️  Found {len(dups)} duplicate patient records!")
        for dup in dups[:5]:  # Show first 5
            logging.info(f"  {dup['given']} {dup['family']} - {dup['count']} copies")
    else:
        logging.info("\n✓ No duplicate patients found")
    # Check latest imports
    latest_query = """
        SELECT 
            resource_type,
            COUNT(*) as count,
            MAX(last_updated) as latest
        FROM fhir.resources
        WHERE deleted = false
        GROUP BY resource_type
        ORDER BY latest DESC
        LIMIT 5
    """
    latest = await conn.fetch(latest_query)
    logging.info("\nMost recently updated resource types:")
    for row in latest:
        logging.info(f"  {row['resource_type']:20} {row['count']:8} (last: {row['latest']})")
    await conn.close()
    
    # 6. SUMMARY AND RECOMMENDATIONS
    logging.info("\n\n6. SUMMARY AND RECOMMENDATIONS")
    logging.info("=" * 80)
    logging.info(f"\n✓ Source files contain {total_source} resources across {len(source_stats)} types")
    logging.info(f"✓ Database contains {total_db} resources across {len(db_stats)} types")
    if patient_count > len(source_patients):
        logging.info(f"\n📊 Database has {patient_count} patients vs {len(source_patients)} in current source")
        logging.info("   This suggests multiple imports or additional data sources")
    if missing_in_db:
        logging.info(f"\n⚠️  Resource types missing from database:")
        for rt in missing_in_db:
            if rt in ['Goal', 'Coverage', 'Media', 'ServiceRequest']:
                logging.info(f"   - {rt} (optional - not always generated by Synthea)")
            else:
                logging.info(f"   - {rt} (should be present)")
    if issues:
        logging.info("\n⚠️  Import issues detected:")
        for issue in issues:
            logging.info(f"   - {issue}")
    # Check backup directories
    backup_dir = Path('data/synthea_backups')
    if backup_dir.exists():
        backups = sorted(backup_dir.glob('synthea_backup_*'))
        if backups:
            logging.info(f"\n📁 Found {len(backups)} backup directories")
            logging.info(f"   Latest: {backups[-1].name}")
            # Count total patient files across all backups
            total_backup_patients = 0
            for backup in backups:
                patient_files = [f for f in backup.glob('*.json') 
                               if 'hospitalInformation' not in f.name 
                               and 'practitionerInformation' not in f.name]
                total_backup_patients += len(patient_files)
            
            logging.info(f"   Total patient files in backups: {total_backup_patients}")
            if total_backup_patients > len(source_patients):
                logging.info(f"\n💡 Recommendation: The backup directories contain more patient data")
                logging.info(f"   Consider re-importing from the latest backup for completeness")
    logging.info("\n" + "=" * 80)
    logging.info("END OF REPORT")
    logging.info("=" * 80)
if __name__ == "__main__":
    asyncio.run(generate_synthea_import_report())