#!/usr/bin/env python3
"""
Test Location transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.location import Location

def test_location():
    """Test Location from Synthea."""
    
    # From the error - a real Synthea Location
    location = {
        "resourceType": "Location",
        "id": "test-123",
        "status": "active",
        "name": "Test Hospital",
        "description": "A test hospital",
        "mode": "instance",
        "type": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode", "code": "HOSP"}]}],
        "address": [{"city": "Boston", "state": "MA"}],
        "telecom": [{"system": "phone", "value": "555-1234"}],
        "managingOrganization": [{"reference": "Organization/123"}]
    }
    
    print("Original Location:")
    print(f"  name: {location.get('name')}")
    print(f"  address: {location.get('address')} (type: {type(location.get('address')).__name__})")
    print(f"  telecom: {location.get('telecom')}")
    print(f"  managingOrganization: {location.get('managingOrganization')} (type: {type(location.get('managingOrganization')).__name__})")
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(location)
    
    print("\nTransformed Location:")
    print(f"  name: {transformed.get('name')}")
    print(f"  address: {transformed.get('address')} (type: {type(transformed.get('address')).__name__ if 'address' in transformed else 'None'})")
    print(f"  telecom: {transformed.get('telecom')}")
    print(f"  managingOrganization: {transformed.get('managingOrganization')} (type: {type(transformed.get('managingOrganization')).__name__ if 'managingOrganization' in transformed else 'None'})")
    
    try:
        Location(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_location()