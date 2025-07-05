#!/usr/bin/env python3
"""
Test CarePlan transformation directly
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
    
    # Create test data like Synthea generates
    careplan = {
        "resourceType": "CarePlan",
        "id": "test-123",
        "status": "active",
        "intent": "plan",
        "subject": {"reference": "Patient/123"},
        "addresses": [{"display": "Diabetes"}],
        "activity": [{
            "detail": {
                "code": {
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "409002",
                        "display": "Food allergy diet"
                    }]
                },
                "status": "in-progress",
                "location": {"display": "Test Hospital"}
            }
        }]
    }
    
    print("Original CarePlan:")
    print(json.dumps(careplan, indent=2))
    
    transformer = ProfileAwareFHIRTransformer()
    
    # Check if Synthea handler is being used
    handler = transformer.detect_profile(careplan)
    print(f"\nDetected handler: {handler.__class__.__name__ if handler else 'None'}")
    
    # Transform
    transformed = transformer.transform_resource(careplan)
    
    print("\nTransformed CarePlan:")
    print(json.dumps(transformed, indent=2))
    
    # Validate
    try:
        careplan_obj = CarePlan(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_careplan()