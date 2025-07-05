#!/usr/bin/env python3
"""
Debug DocumentReference transformation
"""

import json
import sys
from pathlib import Path
import copy

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer

def test_debug():
    """Debug DocumentReference transformation."""
    
    doc_ref = {
        "resourceType": "DocumentReference",
        "id": "test-123",
        "status": "current",
        "custodian": [{"reference": "Organization/123"}]
    }
    
    print("Original:")
    print(json.dumps(doc_ref, indent=2))
    
    # Manual transformation
    test = copy.deepcopy(doc_ref)
    if 'custodian' in test and isinstance(test['custodian'], list):
        print(f"\nCustodian is list with length {len(test['custodian'])}")
        if len(test['custodian']) > 0:
            test['custodian'] = test['custodian'][0]
            print(f"After transform: {test['custodian']}")
    
    # Full transformation
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(doc_ref)
    
    print("\nFull transform result:")
    print(json.dumps(transformed, indent=2))

if __name__ == "__main__":
    test_debug()