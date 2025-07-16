#!/usr/bin/env python3
"""
Comprehensive analysis of data element import from Synthea
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


async def analyze_patient_elements():
    """Analyze Patient resource data elements"""
    
    print("=== PATIENT DATA ELEMENT ANALYSIS ===\n")
    
    # First, let's look at a Synthea patient
    synthea_backup = Path(__file__).parent.parent / "data/synthea_backups/synthea_backup_20250712_062127"
    
    # Find first patient file
    patient_files = [f for f in synthea_backup.glob("*.json") 
                     if not any(skip in f.name for skip in ['hospitalInformation', 'practitionerInformation'])]
    
    if not patient_files:
        print("No patient files found in backup")
        return
        
    sample_file = patient_files[0]
    
    with open(sample_file, 'r') as f:
        bundle = json.load(f)
    
    # Find the patient resource
    synthea_patient = None
    for entry in bundle['entry']:
        if entry['resource']['resourceType'] == 'Patient':
            synthea_patient = entry['resource']
            break
    
    if synthea_patient:
        print("Synthea Patient Data Elements:")
        print("-" * 50)
        
        # Key elements to check
        elements = {
            'ID': synthea_patient.get('id'),
            'Name': len(synthea_patient.get('name', [])),
            'Gender': synthea_patient.get('gender'),
            'BirthDate': synthea_patient.get('birthDate'),
            'Address': len(synthea_patient.get('address', [])),
            'Telecom': len(synthea_patient.get('telecom', [])),
            'Identifiers': len(synthea_patient.get('identifier', [])),
            'Extensions': len(synthea_patient.get('extension', [])),
            'MaritalStatus': 'maritalStatus' in synthea_patient,
            'Language': 'communication' in synthea_patient,
            'Deceased': 'deceasedBoolean' in synthea_patient or 'deceasedDateTime' in synthea_patient
        }
        
        for key, value in elements.items():
            print(f"{key:<20} {value}")
        
        # Check extensions
        print("\nExtensions found:")
        for ext in synthea_patient.get('extension', []):
            url = ext.get('url', '').split('/')[-1]
            print(f"  - {url}")
        
        # Check identifiers
        print("\nIdentifiers found:")
        for ident in synthea_patient.get('identifier', []):
            system = ident.get('system', 'unknown')
            type_display = ident.get('type', {}).get('coding', [{}])[0].get('display', 'unknown')
            print(f"  - {type_display}: {system}")
    
    # Now check what's in the database
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Get a sample patient from DB
        result = await conn.execute(text("""
            SELECT resource 
            FROM fhir.resources 
            WHERE resource_type = 'Patient' 
            AND fhir_id = :patient_id
            LIMIT 1
        """), {"patient_id": synthea_patient['id']})
        
        db_patient_row = result.fetchone()
        
        if db_patient_row:
            db_patient = db_patient_row.resource
            
            print("\n\nDatabase Patient Data Elements:")
            print("-" * 50)
            
            db_elements = {
                'ID': db_patient.get('id'),
                'Name': len(db_patient.get('name', [])),
                'Gender': db_patient.get('gender'),
                'BirthDate': db_patient.get('birthDate'),
                'Address': len(db_patient.get('address', [])),
                'Telecom': len(db_patient.get('telecom', [])),
                'Identifiers': len(db_patient.get('identifier', [])),
                'Extensions': len(db_patient.get('extension', [])),
                'MaritalStatus': 'maritalStatus' in db_patient,
                'Language': 'communication' in db_patient,
                'Deceased': 'deceasedBoolean' in db_patient or 'deceasedDateTime' in db_patient
            }
            
            print("\nComparison:")
            print(f"{'Element':<20} {'Synthea':<15} {'Database':<15} {'Status'}")
            print("-" * 65)
            
            for key in elements.keys():
                synthea_val = str(elements[key])
                db_val = str(db_elements[key])
                status = "✅" if synthea_val == db_val else "❌ MISMATCH"
                print(f"{key:<20} {synthea_val:<15} {db_val:<15} {status}")
        
        # Check search parameter extraction
        print("\n\nSearch Parameters Indexed:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT DISTINCT param_name, param_type, COUNT(*) as count
            FROM fhir.search_params
            WHERE resource_type = 'Patient'
            GROUP BY param_name, param_type
            ORDER BY param_name
        """))
        
        for row in result:
            print(f"{row.param_name:<20} {row.param_type:<10} {row.count:>10}")
    
    await engine.dispose()


async def analyze_observation_elements():
    """Analyze Observation resource data elements"""
    
    print("\n\n=== OBSERVATION DATA ELEMENT ANALYSIS ===\n")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Sample observations
        result = await conn.execute(text("""
            SELECT resource 
            FROM fhir.resources 
            WHERE resource_type = 'Observation'
            LIMIT 5
        """))
        
        observations = result.fetchall()
        
        # Analyze common patterns
        element_stats = defaultdict(int)
        missing_elements = defaultdict(int)
        
        for obs_row in observations:
            obs = obs_row.resource
            
            # Check key elements
            if obs.get('status'): element_stats['status'] += 1
            else: missing_elements['status'] += 1
            
            if obs.get('code'): element_stats['code'] += 1
            else: missing_elements['code'] += 1
            
            if obs.get('subject'): element_stats['subject'] += 1
            else: missing_elements['subject'] += 1
            
            if obs.get('effectiveDateTime') or obs.get('effectivePeriod'): 
                element_stats['effective'] += 1
            else: 
                missing_elements['effective'] += 1
            
            if obs.get('valueQuantity') or obs.get('valueCodeableConcept') or obs.get('valueString'):
                element_stats['value'] += 1
            else:
                missing_elements['value'] += 1
            
            if obs.get('referenceRange'): element_stats['referenceRange'] += 1
            if obs.get('interpretation'): element_stats['interpretation'] += 1
            if obs.get('performer'): element_stats['performer'] += 1
            if obs.get('encounter'): element_stats['encounter'] += 1
            if obs.get('issued'): element_stats['issued'] += 1
            if obs.get('component'): element_stats['component'] += 1
        
        print("Observation Element Presence (sample of 5):")
        print("-" * 50)
        for element, count in sorted(element_stats.items()):
            pct = (count / 5) * 100
            print(f"{element:<20} {count}/5 ({pct:.0f}%)")
        
        # Check specific value types distribution
        print("\n\nValue Type Distribution:")
        result = await conn.execute(text("""
            SELECT 
                COUNT(CASE WHEN resource->>'valueQuantity' IS NOT NULL THEN 1 END) as quantity,
                COUNT(CASE WHEN resource->>'valueCodeableConcept' IS NOT NULL THEN 1 END) as codeable,
                COUNT(CASE WHEN resource->>'valueString' IS NOT NULL THEN 1 END) as string,
                COUNT(CASE WHEN resource->>'valueBoolean' IS NOT NULL THEN 1 END) as boolean,
                COUNT(CASE WHEN resource->>'valueRange' IS NOT NULL THEN 1 END) as range,
                COUNT(CASE WHEN resource->>'valueRatio' IS NOT NULL THEN 1 END) as ratio,
                COUNT(*) as total
            FROM fhir.resources
            WHERE resource_type = 'Observation'
        """))
        
        row = result.fetchone()
        print(f"Total Observations: {row.total}")
        print(f"  - ValueQuantity: {row.quantity} ({row.quantity/row.total*100:.1f}%)")
        print(f"  - ValueCodeableConcept: {row.codeable} ({row.codeable/row.total*100:.1f}%)")
        print(f"  - ValueString: {row.string} ({row.string/row.total*100:.1f}%)")
        print(f"  - ValueBoolean: {row.boolean} ({row.boolean/row.total*100:.1f}%)")
        print(f"  - ValueRange: {row.range} ({row.range/row.total*100:.1f}%)")
        print(f"  - ValueRatio: {row.ratio} ({row.ratio/row.total*100:.1f}%)")
        print(f"  - No value: {row.total - row.quantity - row.codeable - row.string - row.boolean - row.range - row.ratio}")
        
        # Check reference ranges
        print("\n\nReference Range Analysis:")
        result = await conn.execute(text("""
            SELECT 
                COUNT(CASE WHEN resource->>'referenceRange' IS NOT NULL THEN 1 END) as with_range,
                COUNT(CASE WHEN resource->>'interpretation' IS NOT NULL THEN 1 END) as with_interp,
                COUNT(*) as total
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->>'valueQuantity' IS NOT NULL
        """))
        
        row = result.fetchone()
        print(f"Numeric observations: {row.total}")
        print(f"  - With reference range: {row.with_range} ({row.with_range/row.total*100:.1f}%)")
        print(f"  - With interpretation: {row.with_interp} ({row.with_interp/row.total*100:.1f}%)")
    
    await engine.dispose()


async def analyze_reference_integrity():
    """Analyze reference integrity between resources"""
    
    print("\n\n=== REFERENCE INTEGRITY ANALYSIS ===\n")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Check urn:uuid vs proper references
        print("Reference Format Analysis:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT 
                resource_type,
                COUNT(CASE WHEN resource::text LIKE '%"reference": "urn:uuid:%' THEN 1 END) as urn_refs,
                COUNT(CASE WHEN resource::text LIKE '%"reference": "%/%"%' THEN 1 END) as slash_refs,
                COUNT(*) as total
            FROM fhir.resources
            WHERE resource_type IN ('Observation', 'Condition', 'MedicationRequest', 'Encounter', 'DiagnosticReport')
            GROUP BY resource_type
            ORDER BY total DESC
        """))
        
        for row in result:
            urn_pct = (row.urn_refs / row.total * 100) if row.total > 0 else 0
            slash_pct = (row.slash_refs / row.total * 100) if row.total > 0 else 0
            print(f"{row.resource_type:<20} Total: {row.total:>8}  urn:uuid: {row.urn_refs:>6} ({urn_pct:>5.1f}%)  Type/ID: {row.slash_refs:>6} ({slash_pct:>5.1f}%)")
        
        # Check broken references
        print("\n\nBroken Reference Analysis:")
        print("-" * 50)
        
        # Sample check for Observations referencing Patients
        result = await conn.execute(text("""
            WITH obs_refs AS (
                SELECT 
                    resource->>'id' as obs_id,
                    resource->'subject'->>'reference' as patient_ref
                FROM fhir.resources
                WHERE resource_type = 'Observation'
                AND resource->'subject'->>'reference' IS NOT NULL
                LIMIT 100
            ),
            parsed_refs AS (
                SELECT 
                    obs_id,
                    patient_ref,
                    CASE 
                        WHEN patient_ref LIKE 'urn:uuid:%' THEN REPLACE(patient_ref, 'urn:uuid:', '')
                        WHEN patient_ref LIKE 'Patient/%' THEN SPLIT_PART(patient_ref, '/', 2)
                        ELSE NULL
                    END as patient_id
                FROM obs_refs
            )
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN p.fhir_id IS NOT NULL THEN 1 END) as valid_refs,
                COUNT(CASE WHEN p.fhir_id IS NULL THEN 1 END) as broken_refs
            FROM parsed_refs pr
            LEFT JOIN fhir.resources p ON p.resource_type = 'Patient' AND p.fhir_id = pr.patient_id
        """))
        
        row = result.fetchone()
        print(f"Sample of 100 Observation->Patient references:")
        print(f"  - Valid references: {row.valid_refs}")
        print(f"  - Broken references: {row.broken_refs}")
        
    await engine.dispose()


async def analyze_coding_systems():
    """Analyze coding system usage"""
    
    print("\n\n=== CODING SYSTEM ANALYSIS ===\n")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Check condition codings
        print("Condition Coding Systems:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT 
                jsonb_array_elements(resource->'code'->'coding')->>'system' as system,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND resource->'code'->'coding' IS NOT NULL
            GROUP BY system
            ORDER BY count DESC
            LIMIT 10
        """))
        
        for row in result:
            print(f"{row.system:<50} {row.count:>8}")
        
        # Check observation codings
        print("\n\nObservation Coding Systems:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT 
                jsonb_array_elements(resource->'code'->'coding')->>'system' as system,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->'code'->'coding' IS NOT NULL
            GROUP BY system
            ORDER BY count DESC
            LIMIT 10
        """))
        
        for row in result:
            print(f"{row.system:<50} {row.count:>8}")
        
        # Check for missing displays
        print("\n\nCoding Display Text Analysis:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT 
                resource_type,
                COUNT(*) as total,
                COUNT(CASE WHEN resource->'code'->>'text' IS NOT NULL THEN 1 END) as has_text,
                COUNT(CASE WHEN jsonb_array_elements(resource->'code'->'coding')->>'display' IS NOT NULL THEN 1 END) as has_display
            FROM fhir.resources
            WHERE resource_type IN ('Condition', 'Observation', 'Procedure', 'MedicationRequest')
            AND resource->>'code' IS NOT NULL
            GROUP BY resource_type
        """))
        
        for row in result:
            text_pct = (row.has_text / row.total * 100) if row.total > 0 else 0
            print(f"{row.resource_type:<20} Total: {row.total:>8}  Has text: {text_pct:>5.1f}%")
    
    await engine.dispose()


async def main():
    """Run all analyses"""
    await analyze_patient_elements()
    await analyze_observation_elements()
    await analyze_reference_integrity()
    await analyze_coding_systems()
    
    print("\n\n=== SUMMARY OF FINDINGS ===\n")
    print("1. Patient Elements: Check if all extensions and identifiers are preserved")
    print("2. Observations: Many missing reference ranges and interpretations")
    print("3. References: Mix of urn:uuid and Type/ID formats causing potential breaks")
    print("4. Coding Systems: Verify all coding systems are properly imported")


if __name__ == "__main__":
    asyncio.run(main())