#!/usr/bin/env python3
"""
Test Organization transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.organization import Organization

def test_organization():
    """Test Organization from validation error."""
    
    # From the error report - a real failing Organization
    org = {
        "resourceType": "Organization",
        "id": "test-123",
        "identifier": [{"system": "http://example.com", "value": "123"}],
        "active": True,
        "name": "Test Hospital",
        "address": [{"city": "Boston", "state": "MA"}],
        "telecom": [{"system": "phone", "value": "555-1234"}]
    }
    
    print("Original Organization:")
    print(f"  name: {org.get('name')} (type: {type(org.get('name')).__name__})")
    print(f"  address: {org.get('address')}")
    print(f"  telecom: {org.get('telecom')}")
    
    # Check what Organization expects
    print("\nOrganization field types:")
    print(f"  name: {Organization.__fields__['name'].type_}")
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(org)
    
    print("\nTransformed Organization:")
    print(f"  name: {transformed.get('name')} (type: {type(transformed.get('name')).__name__})")
    print(f"  address: {json.dumps(transformed.get('address', []), indent=2)}")
    print(f"  telecom: {json.dumps(transformed.get('telecom', []), indent=2)}")
    
    try:
        Organization(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_organization()