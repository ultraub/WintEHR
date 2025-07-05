#!/usr/bin/env python3
"""
Test Procedure transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.procedure import Procedure

def test_procedure():
    """Test Procedure from Synthea bundle."""
    
    # Load a real Synthea bundle
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "Beatriz277_Ana_María762_Muro989_c0219ca9-576f-f7c2-9c44-de030e94969b.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    transformer = ProfileAwareFHIRTransformer()
    
    # Find Procedure resources
    procedures = []
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'Procedure':
            procedures.append(resource)
    
    print(f"Found {len(procedures)} Procedure resources")
    
    if procedures:
        # Test first one
        proc = procedures[0]
        print("\nOriginal Procedure fields:")
        for key in sorted(proc.keys()):
            if 'performed' in key:
                value_preview = str(proc[key])[:100]
                print(f"  {key}: {value_preview}...")
        
        # Transform
        transformed = transformer.transform_resource(proc)
        
        print("\nTransformed Procedure fields:")
        for key in sorted(transformed.keys()):
            if 'performed' in key:
                value_preview = str(transformed[key])[:100]
                print(f"  {key}: {value_preview}...")
        
        # Validate
        try:
            proc_obj = Procedure(**transformed)
            print("\n✅ Validation: PASSED")
        except Exception as e:
            print(f"\n❌ Validation: FAILED")
            print(f"   Error: {str(e)}")
            
            # Check if it's the performed field issue
            if 'performed' in str(e):
                print("\nChecking performed field...")
                if 'performed' in transformed:
                    perf = transformed['performed']
                    print(f"  Type: {type(perf)}")
                    if isinstance(perf, dict):
                        print(f"  Keys: {list(perf.keys())}")

if __name__ == "__main__":
    test_procedure()