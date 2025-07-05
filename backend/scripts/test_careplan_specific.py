#!/usr/bin/env python3
"""
Test specific CarePlan transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.careplan import CarePlan

def test_careplan():
    """Test CarePlan from specific file."""
    
    # Load a specific Synthea bundle with CarePlan.activity.detail
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "Sal878_Hoppe518_aade3c61-92bd-d079-9d28-0b2b7fde0fbb.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    transformer = ProfileAwareFHIRTransformer()
    
    # Find CarePlan resources
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'CarePlan':
            if 'activity' in resource and resource['activity']:
                if any('detail' in act for act in resource['activity']):
                    print("Found CarePlan with activity.detail")
                    
                    # Show original
                    print("\nOriginal activity:")
                    for i, act in enumerate(resource['activity']):
                        if 'detail' in act:
                            print(f"  activity[{i}].detail:")
                            print(f"    keys: {list(act['detail'].keys())}")
                            if 'location' in act['detail']:
                                print(f"    location: {act['detail']['location']}")
                    
                    # Transform
                    transformed = transformer.transform_resource(resource)
                    
                    # Show transformed
                    print("\nTransformed activity:")
                    if 'activity' in transformed:
                        for i, act in enumerate(transformed['activity']):
                            print(f"  activity[{i}] keys: {list(act.keys())}")
                            if 'detail' in act:
                                print(f"    detail keys: {list(act['detail'].keys())}")
                                if 'location' in act['detail']:
                                    print(f"    location: {act['detail']['location']}")
                    
                    # Validate
                    try:
                        careplan_obj = CarePlan(**transformed)
                        print("\n✅ Validation: PASSED")
                    except Exception as e:
                        print(f"\n❌ Validation: FAILED")
                        print(f"   Error: {str(e)}")
                    
                    break

if __name__ == "__main__":
    test_careplan()