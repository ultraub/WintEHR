#!/usr/bin/env python3
"""
Test why Encounter period and reasonCode are showing as extra fields
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from core.fhir.field_definitions import RESOURCE_FIELDS
from fhir.resources.encounter import Encounter

def test_encounter_fields():
    """Test Encounter field validation."""
    
    # Load a real Synthea bundle
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "Beatriz277_Ana_María762_Muro989_c0219ca9-576f-f7c2-9c44-de030e94969b.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    # Find first Encounter
    encounter = None
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'Encounter':
            encounter = resource
            break
    
    if not encounter:
        print("No Encounter found")
        return
    
    print("Original Encounter keys:")
    print(sorted(encounter.keys()))
    
    # Check allowed fields
    print("\nAllowed Encounter fields from field_definitions:")
    allowed = sorted(RESOURCE_FIELDS.get('Encounter', set()))
    print(allowed)
    
    # Check if period and reasonCode are in allowed fields
    print(f"\n'period' in allowed fields: {'period' in allowed}")
    print(f"'reasonCode' in allowed fields: {'reasonCode' in allowed}")
    
    # Transform
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(encounter)
    
    print("\nTransformed Encounter keys:")
    print(sorted(transformed.keys()))
    
    # Check specific fields
    if 'period' in transformed:
        print(f"\nperiod field type: {type(transformed['period'])}")
        print(f"period field value: {transformed['period']}")
    
    if 'reasonCode' in transformed:
        print(f"\nreasonCode field type: {type(transformed['reasonCode'])}")
        print(f"reasonCode field length: {len(transformed['reasonCode']) if isinstance(transformed['reasonCode'], list) else 'N/A'}")
    
    # Try validation
    try:
        enc_obj = Encounter(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Full error: {e}")

if __name__ == "__main__":
    test_encounter_fields()