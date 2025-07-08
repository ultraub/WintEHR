#!/usr/bin/env python3
import json
import os
from collections import defaultdict
from pathlib import Path
import logging


def analyze_synthea_bundles():
    """Analyze all FHIR bundles in Synthea output directory"""
    
    # Paths to check
    synthea_dirs = [
        'synthea/output/fhir',
        'data/synthea_backups'
    ]
    
    all_resource_types = defaultdict(int)
    file_count = 0
    total_resources = 0
    
    # Process synthea output directory
    synthea_output = Path('synthea/output/fhir')
    if synthea_output.exists():
        for file_path in synthea_output.glob('*.json'):
            if 'hospitalInformation' in file_path.name or 'practitionerInformation' in file_path.name:
                continue  # Skip non-patient files for now
                
            try:
                with open(file_path, 'r') as f:
                    bundle = json.load(f)
                    
                if bundle.get('resourceType') == 'Bundle' and 'entry' in bundle:
                    file_count += 1
                    for entry in bundle['entry']:
                        if 'resource' in entry:
                            resource_type = entry['resource'].get('resourceType')
                            if resource_type:
                                all_resource_types[resource_type] += 1
                                total_resources += 1
            except Exception as e:
                logging.error(f"Error processing {file_path}: {e}")
    # Also check backup directories for comparison
    backup_dirs = list(Path('data/synthea_backups').glob('synthea_backup_*'))
    latest_backup = None
    if backup_dirs:
        latest_backup = sorted(backup_dirs)[-1]
        
    logging.info("=== Synthea Resource Type Analysis ===\n")
    logging.info(f"Current Synthea output directory: {synthea_output}")
    logging.info(f"Patient files found: {file_count}")
    logging.info(f"Total resources: {total_resources}\n")
    logging.info("Resource types and counts:")
    logging.info("-" * 40)
    for resource_type, count in sorted(all_resource_types.items(), key=lambda x: x[1], reverse=True):
        logging.info(f"{resource_type:30} {count:6}")
    # Now query the database to compare
    logging.info("\n\n=== Database Resource Counts ===")
    try:
        import asyncio
        import asyncpg
        
        async def get_db_counts():
            conn = await asyncpg.connect(
                host='localhost',
                port=5432,
                user='emr_user',
                password='emr_password',
                database='emr_db'
            )
            
            # Get all resource types from database
            query = """
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources
                WHERE deleted = false
                GROUP BY resource_type
                ORDER BY count DESC
            """
            
            rows = await conn.fetch(query)
            
            db_resources = {}
            total_db = 0
            for row in rows:
                db_resources[row['resource_type']] = row['count']
                total_db += row['count']
                
            await conn.close()
            return db_resources, total_db
        
        db_resources, total_db = asyncio.run(get_db_counts())
        
    except Exception as e:
        logging.error(f"\nError connecting to database: {e}")
        db_resources = {}
        total_db = 0
        
    
    if db_resources:
        logging.info(f"\nTotal resources in database: {total_db}")
        logging.info("-" * 40)
        for resource_type, count in sorted(db_resources.items(), key=lambda x: x[1], reverse=True):
            logging.info(f"{resource_type:30} {count:6}")
        # Compare source vs database
        logging.info("\n\n=== Comparison: Source Files vs Database ===")
        logging.info("-" * 60)
        logging.info(f"{'Resource Type':30} {'Source':>10} {'Database':>10} {'Diff':>10}")
        logging.info("-" * 60)
        all_types = set(all_resource_types.keys()) | set(db_resources.keys())
        for resource_type in sorted(all_types):
            source_count = all_resource_types.get(resource_type, 0)
            db_count = db_resources.get(resource_type, 0)
            diff = db_count - source_count
            
            status = ""
            if source_count > 0 and db_count == 0:
                status = " ⚠️  MISSING IN DB"
            elif diff < 0:
                status = " ⚠️  FEWER IN DB"
            elif diff > 0:
                status = " ✓ MORE IN DB"
                
            logging.info(f"{resource_type:30} {source_count:10} {db_count:10} {diff:+10} {status}")
    # Check for specific expected Synthea resource types
    logging.info("\n\n=== Expected Synthea Resource Types Check ===")
    expected_types = [
        'Patient', 'Encounter', 'Condition', 'Observation', 'Procedure',
        'MedicationRequest', 'Immunization', 'CarePlan', 'Goal', 'CareTeam',
        'AllergyIntolerance', 'Claim', 'ExplanationOfBenefit', 'Coverage',
        'Organization', 'Practitioner', 'PractitionerRole', 'Location',
        'Device', 'DiagnosticReport', 'DocumentReference', 'ImagingStudy',
        'Media', 'MedicationAdministration', 'ServiceRequest'
    ]
    
    logging.info("\nChecking for standard Synthea resource types:")
    logging.info("-" * 50)
    for expected in expected_types:
        source_has = '✓' if expected in all_resource_types else '✗'
        db_has = '✓' if expected in db_resources else '✗'
        logging.info(f"{expected:30} Source: {source_has}  Database: {db_has}")
    # Check latest backup if available
    if latest_backup:
        logging.info(f"\n\nLatest backup directory: {latest_backup}")
        backup_files = list(latest_backup.glob('*.json'))
        patient_files = [f for f in backup_files if 'hospitalInformation' not in f.name and 'practitionerInformation' not in f.name]
        logging.info(f"Patient files in latest backup: {len(patient_files)}")
if __name__ == "__main__":
    analyze_synthea_bundles()