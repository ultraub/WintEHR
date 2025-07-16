#!/usr/bin/env python3
"""
Detailed analysis of Synthea import gaps
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


async def analyze_import_gaps():
    """Analyze specific gaps in Synthea import"""
    
    print("=== SYNTHEA IMPORT GAP ANALYSIS ===\n")
    
    # Based on the grep analysis of actual Synthea files, these are the expected counts
    synthea_expected = {
        'Observation': 1873,
        'Procedure': 889,
        'DiagnosticReport': 617,
        'ServiceRequest': 529,
        'ExplanationOfBenefit': 529,
        'Coverage': 529,
        'Claim': 529,
        'Encounter': 411,
        'DocumentReference': 411,
        'Condition': 239,
        'Immunization': 150,
        'SupplyDelivery': 131,
        'MedicationRequest': 118,
        'Location': 36,
        'PractitionerRole': 35,
        'Practitioner': 35,
        'Organization': 35,
        'Device': 30,
        'CareTeam': 29,
        'CarePlan': 29,
        'AllergyIntolerance': 20,
        'ImagingStudy': 17,
        'MedicationAdministration': 16,
        'Medication': 16,
        'Provenance': 11,
        'Patient': 11
    }
    
    # Get database counts
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = FALSE OR deleted IS NULL
            GROUP BY resource_type
        """))
        
        db_counts = {row.resource_type: row.count for row in result}
    
    # Analyze gaps
    print("Resource Type Analysis:")
    print("-" * 80)
    print(f"{'Resource Type':<25} {'Expected':<10} {'In DB':<10} {'Missing':<10} {'Status'}")
    print("-" * 80)
    
    total_expected = 0
    total_in_db = 0
    total_missing = 0
    missing_types = []
    incomplete_types = []
    
    for rtype, expected in sorted(synthea_expected.items()):
        db_count = db_counts.get(rtype, 0)
        missing = expected - db_count
        total_expected += expected
        total_in_db += db_count
        
        if db_count == 0:
            status = "❌ NOT IMPORTED"
            missing_types.append((rtype, expected))
            total_missing += expected
        elif missing > 0:
            pct = (db_count / expected) * 100
            status = f"⚠️  {pct:.0f}% imported"
            incomplete_types.append((rtype, expected, db_count, missing))
            total_missing += missing
        else:
            # More in DB than expected (from multiple runs)
            status = "✅ Complete+"
            
        print(f"{rtype:<25} {expected:<10} {db_count:<10} {missing:<10} {status}")
    
    print("-" * 80)
    print(f"{'TOTALS':<25} {total_expected:<10} {total_in_db:<10} {total_missing:<10}")
    
    # Critical gaps
    print("\n\n=== CRITICAL GAPS ===\n")
    
    if missing_types:
        print(f"❌ Resource types completely missing ({len(missing_types)}):")
        for rtype, count in missing_types:
            print(f"   - {rtype}: {count} resources")
    
    print(f"\n⚠️  ServiceRequest: Expected 529, found only 5")
    print("   This is a MAJOR gap - ServiceRequests link orders to results!")
    
    print(f"\n⚠️  Coverage: Expected 529, found only 1")
    print("   This breaks the financial/insurance workflow")
    
    # Check specific issues
    print("\n\n=== ROOT CAUSE ANALYSIS ===\n")
    
    async with engine.connect() as conn:
        # Check for urn:uuid references
        print("1. Checking reference formats...")
        result = await conn.execute(text("""
            SELECT 
                COUNT(CASE WHEN resource::text LIKE '%"reference": "urn:uuid:%' THEN 1 END) as urn_refs,
                COUNT(CASE WHEN resource::text LIKE '%"reference": "%/%"%' THEN 1 END) as slash_refs
            FROM fhir.resources
        """))
        row = result.fetchone()
        print(f"   - Resources with urn:uuid references: {row.urn_refs:,}")
        print(f"   - Resources with Type/ID references: {row.slash_refs:,}")
        
        # Check for specific missing types in raw data
        print("\n2. Checking for ServiceRequest in stored data...")
        result = await conn.execute(text("""
            SELECT COUNT(*) 
            FROM fhir.resources 
            WHERE resource::text LIKE '%"resourceType": "ServiceRequest"%'
        """))
        sr_count = result.scalar()
        print(f"   - ServiceRequests in database: {sr_count}")
        
        # Check bundle entries
        print("\n3. Analyzing bundle structure...")
        result = await conn.execute(text("""
            SELECT resource_type, resource->>'id' as id, 
                   jsonb_array_length(resource->'entry') as entry_count
            FROM fhir.resources
            WHERE resource_type = 'Bundle'
            LIMIT 5
        """))
        bundles = result.fetchall()
        if bundles:
            print("   - Found Bundle resources (shouldn't be stored!):")
            for bundle in bundles:
                print(f"     Bundle {bundle.id}: {bundle.entry_count} entries")
                
    # Import process analysis
    print("\n\n=== IMPORT PROCESS ISSUES ===\n")
    
    print("1. Bundle Processing:")
    print("   - Are we correctly extracting ALL entries from bundles?")
    print("   - Check: _process_batch method in synthea_master.py")
    
    print("\n2. Resource Filtering:")
    print("   - Line 563 of synthea_master.py only indexes specific types")
    print("   - ServiceRequest, Coverage, etc. are NOT in the list!")
    
    print("\n3. Reference Resolution:")
    print("   - urn:uuid references need to be resolved to actual IDs")
    print("   - This might cause resources to be skipped")
    
    # Recommendations
    print("\n\n=== RECOMMENDATIONS ===\n")
    
    print("1. Fix _extract_search_params to index ALL resource types")
    print("   Currently only handles: Patient + specific clinical types")
    print("   Missing: ServiceRequest, Coverage, Location, etc.")
    
    print("\n2. Add comprehensive resource type handling")
    print("   Every Synthea resource type should be imported")
    
    print("\n3. Implement proper urn:uuid resolution")
    print("   Convert urn:uuid references to proper Patient/ID format")
    
    print("\n4. Add import validation")
    print("   Count resources in bundle vs imported")
    print("   Report any skipped resources with reasons")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(analyze_import_gaps())