#!/usr/bin/env python3
"""
Test Claim transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.claim import Claim

def test_claim():
    """Test Claim from Synthea bundle."""
    
    # Load a real Synthea bundle
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "Beatriz277_Ana_María762_Muro989_c0219ca9-576f-f7c2-9c44-de030e94969b.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    transformer = ProfileAwareFHIRTransformer()
    
    # Find Claim resources
    claims = []
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'Claim':
            claims.append(resource)
    
    print(f"Found {len(claims)} Claim resources")
    
    if claims:
        # Test first one
        claim = claims[0]
        print("\nOriginal Claim fields:")
        for key in ['type', 'total']:
            if key in claim:
                value = claim[key]
                if isinstance(value, (dict, list)):
                    print(f"  {key} ({type(value).__name__}): {json.dumps(value, indent=4)[:200]}...")
                else:
                    print(f"  {key} ({type(value).__name__}): {value}")
        
        # Transform
        transformed = transformer.transform_resource(claim)
        
        print("\nTransformed Claim fields:")
        for key in ['type', 'total']:
            if key in transformed:
                value = transformed[key]
                if isinstance(value, (dict, list)):
                    print(f"  {key} ({type(value).__name__}): {json.dumps(value, indent=4)[:200]}...")
                else:
                    print(f"  {key} ({type(value).__name__}): {value}")
        
        # Validate
        try:
            claim_obj = Claim(**transformed)
            print("\n✅ Validation: PASSED")
        except Exception as e:
            print(f"\n❌ Validation: FAILED")
            print(f"   Error: {str(e)[:200]}...")

if __name__ == "__main__":
    test_claim()