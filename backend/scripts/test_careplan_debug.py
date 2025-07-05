#!/usr/bin/env python3
"""
Debug CarePlan addresses issue
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.careplan import CarePlan

def test_careplan():
    """Test CarePlan transformation."""
    care_plan = {
        "resourceType": "CarePlan",
        "id": "test-123",
        "status": "active",
        "intent": "plan",
        "subject": {"reference": "Patient/123"},
        "addresses": [{"reference": "Condition/diabetes"}]
    }
    
    print("Original addresses:")
    print(json.dumps(care_plan['addresses'], indent=2))
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(care_plan)
    
    print("\nTransformed addresses:")
    print(json.dumps(transformed.get('addresses', []), indent=2))
    
    # Check what CarePlan expects for addresses
    print("\nCarePlan addresses field type:")
    print(CarePlan.__fields__['addresses'].type_)
    
    # Try minimal CarePlan
    minimal = {
        "resourceType": "CarePlan",
        "status": "active",
        "intent": "plan",
        "subject": {"reference": "Patient/123"}
    }
    
    try:
        CarePlan(**minimal)
        print("\n✅ Minimal CarePlan: PASSED")
    except Exception as e:
        print(f"\n❌ Minimal CarePlan: FAILED - {e}")
    
    # Try with addresses as CodeableReference
    with_addresses = {
        "resourceType": "CarePlan",
        "status": "active",
        "intent": "plan",
        "subject": {"reference": "Patient/123"},
        "addresses": [{
            "reference": {
                "reference": "Condition/123"
            }
        }]
    }
    
    try:
        CarePlan(**with_addresses)
        print("✅ CarePlan with reference wrapper: PASSED")
    except Exception as e:
        print(f"❌ CarePlan with reference wrapper: FAILED - {e}")
    
    # Try full validation
    try:
        CarePlan(**transformed)
        print("✅ Full CarePlan: PASSED")
    except Exception as e:
        print(f"❌ Full CarePlan: FAILED - {e}")

if __name__ == "__main__":
    test_careplan()