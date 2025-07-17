#!/usr/bin/env python3
"""
Comprehensive analysis of Synthea data import to identify gaps
"""

import json
import asyncio
from pathlib import Path
from collections import defaultdict
import sys

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL


async def analyze_synthea_import():
    """Analyze what Synthea generates vs what we import"""
    
    # 1. First analyze what's in Synthea output files
    synthea_output = Path(__file__).parent.parent.parent / "synthea" / "output" / "fhir"
    
    print("=== SYNTHEA OUTPUT ANALYSIS ===\n")
    
    source_resources = defaultdict(int)
    source_files = 0
    total_source_resources = 0
    
    if synthea_output.exists():
        print(f"Analyzing Synthea output at: {synthea_output}")
        
        for json_file in synthea_output.glob("*.json"):
            # Skip non-patient bundles
            if any(skip in json_file.name for skip in ['hospitalInformation', 'practitionerInformation']):
                continue
                
            source_files += 1
            
            try:
                with open(json_file, 'r') as f:
                    bundle = json.load(f)
                    
                if bundle.get('resourceType') == 'Bundle':
                    for entry in bundle.get('entry', []):
                        resource = entry.get('resource', {})
                        resource_type = resource.get('resourceType')
                        if resource_type:
                            source_resources[resource_type] += 1
                            total_source_resources += 1
                            
            except Exception as e:
                print(f"Error reading {json_file.name}: {e}")
    else:
        print(f"Synthea output directory not found at: {synthea_output}")
        return
    
    print(f"\nPatient bundle files found: {source_files}")
    print(f"Total resources in files: {total_source_resources:,}")
    print("\nResource types in Synthea output:")
    print("-" * 50)
    for rtype, count in sorted(source_resources.items(), key=lambda x: x[1], reverse=True):
        print(f"{rtype:<30} {count:>10,}")
    
    # 2. Now check what's in the database
    print("\n\n=== DATABASE ANALYSIS ===\n")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Get resource counts
        result = await conn.execute(text("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = FALSE OR deleted IS NULL
            GROUP BY resource_type
            ORDER BY count DESC
        """))
        
        db_resources = {}
        total_db_resources = 0
        
        for row in result:
            db_resources[row.resource_type] = row.count
            total_db_resources += row.count
            
        print(f"Total resources in database: {total_db_resources:,}")
        print("\nResource types in database:")
        print("-" * 50)
        for rtype, count in sorted(db_resources.items(), key=lambda x: x[1], reverse=True):
            print(f"{rtype:<30} {count:>10,}")
    
    # 3. Compare and identify gaps
    print("\n\n=== IMPORT COMPARISON ===\n")
    print(f"{'Resource Type':<30} {'Synthea':>10} {'Database':>10} {'Status':>15}")
    print("-" * 70)
    
    all_types = set(source_resources.keys()) | set(db_resources.keys())
    
    missing_types = []
    partial_imports = []
    
    for rtype in sorted(all_types):
        source_count = source_resources.get(rtype, 0)
        db_count = db_resources.get(rtype, 0)
        
        if source_count > 0 and db_count == 0:
            status = "❌ NOT IMPORTED"
            missing_types.append(rtype)
        elif source_count > 0 and db_count < source_count:
            pct = (db_count / source_count) * 100
            status = f"⚠️  {pct:.0f}% imported"
            partial_imports.append((rtype, source_count, db_count))
        elif db_count > source_count:
            status = "✅ Complete+"
        elif source_count == 0 and db_count > 0:
            status = "🔍 DB only"
        else:
            status = "✅ Complete"
            
        print(f"{rtype:<30} {source_count:>10,} {db_count:>10,} {status}")
    
    # 4. List standard Synthea resource types we should expect
    print("\n\n=== EXPECTED SYNTHEA RESOURCE TYPES ===\n")
    
    # Based on Synthea documentation
    expected_synthea_types = [
        # Core patient data
        'Patient',
        'Encounter', 
        'Condition',
        'Observation',
        'Procedure',
        'MedicationRequest',
        'MedicationAdministration',
        'Immunization',
        'AllergyIntolerance',
        
        # Care management
        'CarePlan',
        'CareTeam',
        'Goal',
        
        # Diagnostics
        'DiagnosticReport',
        'ImagingStudy',
        'Media',
        'DocumentReference',
        
        # Financial
        'Claim',
        'ExplanationOfBenefit',
        'Coverage',
        
        # Organization
        'Organization',
        'Practitioner',
        'PractitionerRole',
        'Location',
        
        # Other
        'Device',
        'ServiceRequest',
        'SupplyDelivery',
        'Provenance'
    ]
    
    print("Checking standard Synthea resources:")
    print("-" * 60)
    for expected in expected_synthea_types:
        in_source = '✓' if expected in source_resources else '✗'
        in_db = '✓' if expected in db_resources else '✗'
        
        status = ""
        if in_source == '✓' and in_db == '✗':
            status = " ← NOT IMPORTED!"
        elif in_source == '✗' and in_db == '✗':
            status = " ← Not generated"
            
        print(f"{expected:<25} Source: {in_source}  DB: {in_db} {status}")
    
    # 5. Summary of issues
    print("\n\n=== SUMMARY OF GAPS ===\n")
    
    if missing_types:
        print(f"❌ Resource types NOT imported ({len(missing_types)}):")
        for rtype in missing_types:
            count = source_resources[rtype]
            print(f"   - {rtype}: {count:,} resources missing")
    
    if partial_imports:
        print(f"\n⚠️  Partially imported types ({len(partial_imports)}):")
        for rtype, source, db in partial_imports:
            missing = source - db
            print(f"   - {rtype}: {missing:,} resources missing ({db}/{source})")
    
    # 6. Check for specific known issues
    print("\n\n=== SPECIFIC CHECKS ===\n")
    
    # Check for urn:uuid references
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT COUNT(*) 
            FROM fhir.resources 
            WHERE resource::text LIKE '%urn:uuid:%'
        """))
        urn_count = result.scalar()
        print(f"Resources with urn:uuid references: {urn_count:,}")
        
        # Check for references in the references table
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM fhir.references
        """))
        ref_count = result.scalar()
        print(f"Total references indexed: {ref_count:,}")
        
        # Check for broken references
        result = await conn.execute(text("""
            SELECT COUNT(DISTINCT r.reference_value)
            FROM fhir.references r
            WHERE r.target_id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM fhir.resources res
                WHERE res.fhir_id = r.target_id
            )
        """))
        broken_refs = result.scalar()
        if broken_refs > 0:
            print(f"⚠️  Broken references found: {broken_refs:,}")
    
    await engine.dispose()
    
    # 7. Recommendations
    print("\n\n=== RECOMMENDATIONS ===\n")
    
    if missing_types:
        print("1. Missing resource types need investigation:")
        print("   - Check if import script filters these out")
        print("   - Verify ProfileAwareFHIRTransformer handles these types")
        print("   - Look for validation errors during import")
    
    if partial_imports:
        print("\n2. Partial imports suggest data loss during import:")
        print("   - Check for validation errors in import logs")
        print("   - Verify reference resolution for urn:uuid format")
        print("   - Check for duplicate key violations")
    
    print("\n3. Next steps:")
    print("   - Run import with --verbose flag to see errors")
    print("   - Check import logs for specific failures")
    print("   - Verify all Synthea resource types are handled")


if __name__ == "__main__":
    asyncio.run(analyze_synthea_import())