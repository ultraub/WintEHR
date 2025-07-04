#!/usr/bin/env python3
"""
Test importing a Synthea encounter with enhanced validation.
"""

import asyncio
import json
import sys
import os
import httpx
import glob

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.fhir.synthea_validator import SyntheaFHIRValidator

FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

async def test_real_synthea_encounter():
    """Test with a real Synthea encounter."""
    print("🧪 Testing Real Synthea Encounter Import")
    print("=" * 60)
    
    # Get a real Synthea bundle
    bundle_files = glob.glob(os.path.join(SYNTHEA_OUTPUT_DIR, "*.json"))
    patient_bundle = None
    
    for f in bundle_files:
        if not f.endswith('hospitalInformation.json') and not f.endswith('practitionerInformation.json'):
            patient_bundle = f
            break
    
    if not patient_bundle:
        print("❌ No patient bundle found")
        return
    
    print(f"📁 Using bundle: {os.path.basename(patient_bundle)}")
    
    # Load the bundle and find an encounter
    with open(patient_bundle, 'r') as f:
        bundle = json.load(f)
    
    encounter = None
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'Encounter':
            encounter = resource
            break
    
    if not encounter:
        print("❌ No encounter found in bundle")
        return
    
    print(f"\n📋 Found Encounter: {encounter.get('id')}")
    
    # Validate with our enhanced validator
    validator = SyntheaFHIRValidator()
    
    print("\n1️⃣ Original Encounter Structure:")
    print(f"   class: {json.dumps(encounter.get('class'), indent=6)}")
    print(f"   period keys: {list(encounter.get('period', {}).keys())}")
    if 'participant' in encounter and encounter['participant']:
        print(f"   participant[0] keys: {list(encounter['participant'][0].keys())}")
        if 'individual' in encounter['participant'][0]:
            print(f"   participant[0].individual keys: {list(encounter['participant'][0]['individual'].keys())}")
    
    # Preprocess the encounter
    processed = validator._preprocess_synthea_resource('Encounter', encounter.copy())
    
    print("\n2️⃣ After Preprocessing:")
    print(f"   class: {json.dumps(processed.get('class'), indent=6)}")
    print(f"   period keys: {list(processed.get('period', {}).keys())}")
    if 'participant' in processed and processed['participant']:
        print(f"   participant[0] keys: {list(processed['participant'][0].keys())}")
        if 'individual' in processed['participant'][0]:
            print(f"   participant[0].individual keys: {list(processed['participant'][0]['individual'].keys())}")
    
    # Validate
    validation_result = validator.validate_resource("Encounter", encounter)
    
    print("\n3️⃣ Validation Result:")
    has_errors = False
    for issue in validation_result.issue:
        if issue.severity in ["error", "fatal"]:
            has_errors = True
        print(f"   {issue.severity}: {issue.code}")
        if hasattr(issue, 'details') and issue.details:
            if hasattr(issue.details, 'text'):
                print(f"     Details: {issue.details.text}")
    
    if not has_errors:
        print("\n✅ Validation passed! Now attempting import...")
        
        # Try to import
        async with httpx.AsyncClient() as client:
            # Use the processed encounter for import
            response = await client.post(
                f"{FHIR_BASE_URL}/Encounter",
                json=processed,
                timeout=30.0
            )
            
            print(f"\n4️⃣ Import Result:")
            print(f"   Status: {response.status_code}")
            
            if response.status_code in [200, 201]:
                print("   ✅ Successfully imported!")
                print(f"   Location: {response.headers.get('Location')}")
            else:
                print(f"   ❌ Import failed")
                if response.status_code == 400:
                    error_data = response.json()
                    if 'issue' in error_data:
                        for issue in error_data['issue']:
                            print(f"   {issue.get('severity', 'error')}: {issue.get('code', 'unknown')}")
                            print(f"     {issue.get('details', {}).get('text', 'No details')}")

if __name__ == "__main__":
    asyncio.run(test_real_synthea_encounter())