#!/usr/bin/env python3
"""
Test CareTeam transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.careteam import CareTeam

def test_careteam():
    """Test CareTeam from Synthea bundle."""
    
    # Load a real Synthea bundle
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "Beatriz277_Ana_María762_Muro989_c0219ca9-576f-f7c2-9c44-de030e94969b.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    transformer = ProfileAwareFHIRTransformer()
    
    # Find CareTeam resources
    careteams = []
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'CareTeam':
            careteams.append(resource)
    
    print(f"Found {len(careteams)} CareTeam resources")
    
    if careteams:
        # Test first one
        careteam = careteams[0]
        print("\nOriginal CareTeam structure:")
        if 'participant' in careteam and careteam['participant']:
            print(f"  participant count: {len(careteam['participant'])}")
            participant = careteam['participant'][0]
            print(f"  participant[0] keys: {list(participant.keys())}")
            if 'role' in participant:
                role = participant['role']
                print(f"  participant[0].role type: {type(role).__name__}")
                if isinstance(role, list) and role:
                    print(f"  participant[0].role[0]: {role[0]}")
                elif isinstance(role, dict):
                    print(f"  participant[0].role: {role}")
        
        # Transform
        transformed = transformer.transform_resource(careteam)
        
        print("\nTransformed CareTeam structure:")
        if 'participant' in transformed and transformed['participant']:
            print(f"  participant count: {len(transformed['participant'])}")
            participant = transformed['participant'][0]
            print(f"  participant[0] keys: {list(participant.keys())}")
            if 'role' in participant:
                role = participant['role']
                print(f"  participant[0].role type: {type(role).__name__}")
                if isinstance(role, list) and role:
                    print(f"  participant[0].role[0]: {role[0]}")
                elif isinstance(role, dict):
                    print(f"  participant[0].role: {role}")
        
        # Validate
        try:
            careteam_obj = CareTeam(**transformed)
            print("\n✅ Validation: PASSED")
        except Exception as e:
            print(f"\n❌ Validation: FAILED")
            print(f"   Error: {str(e)[:300]}...")

if __name__ == "__main__":
    test_careteam()