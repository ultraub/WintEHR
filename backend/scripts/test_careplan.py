#!/usr/bin/env python3
"""
Test CarePlan transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.careplan import CarePlan

def test_careplan():
    """Test CarePlan from Synthea bundle."""
    
    # Load a real Synthea bundle
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "Beatriz277_Ana_María762_Muro989_c0219ca9-576f-f7c2-9c44-de030e94969b.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    transformer = ProfileAwareFHIRTransformer()
    
    # Find CarePlan resources
    careplans = []
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'CarePlan':
            careplans.append(resource)
    
    print(f"Found {len(careplans)} CarePlan resources")
    
    if careplans:
        # Test first one
        careplan = careplans[0]
        print("\nOriginal CarePlan structure:")
        if 'activity' in careplan and careplan['activity']:
            print(f"  activity count: {len(careplan['activity'])}")
            activity = careplan['activity'][0]
            print(f"  activity[0] keys: {list(activity.keys())}")
            if 'detail' in activity:
                detail = activity['detail']
                print(f"  activity[0].detail type: {type(detail).__name__}")
                print(f"  activity[0].detail keys: {list(detail.keys())}")
        
        # Transform
        transformed = transformer.transform_resource(careplan)
        
        print("\nTransformed CarePlan structure:")
        if 'activity' in transformed and transformed['activity']:
            print(f"  activity count: {len(transformed['activity'])}")
            activity = transformed['activity'][0]
            print(f"  activity[0] keys: {list(activity.keys())}")
            if 'detail' in activity:
                detail = activity['detail']
                print(f"  activity[0].detail type: {type(detail).__name__}")
                print(f"  activity[0].detail keys: {list(detail.keys())}")
        
        # Validate
        try:
            careplan_obj = CarePlan(**transformed)
            print("\n✅ Validation: PASSED")
        except Exception as e:
            print(f"\n❌ Validation: FAILED")
            print(f"   Error: {str(e)[:300]}...")
            
            # Show specific field error
            if 'detail' in str(e):
                print(f"\nChecking detail structure...")
                if 'activity' in transformed and transformed['activity']:
                    for i, act in enumerate(transformed['activity']):
                        if 'detail' in act:
                            print(f"  activity[{i}].detail keys: {list(act['detail'].keys())}")

if __name__ == "__main__":
    test_careplan()