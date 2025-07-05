#!/usr/bin/env python3
"""
Debug CarePlan transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer

def test_careplan():
    """Debug CarePlan transformation."""
    
    # Create test data
    careplan = {
        "resourceType": "CarePlan",
        "id": "test-123",
        "status": "active",
        "intent": "plan",
        "subject": {"reference": "Patient/123"},
        "activity": [{
            "detail": {
                "code": {
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "409002",
                        "display": "Food allergy diet"
                    }],
                    "text": "Food allergy diet"
                },
                "status": "in-progress",
                "location": {"display": "Test Hospital"}
            }
        }]
    }
    
    print("Original activity:")
    print(json.dumps(careplan['activity'][0], indent=2))
    
    # Manually apply the transformation logic
    activity = careplan['activity'][0]
    new_activity = {}
    
    # Copy allowed fields
    for field in ['id', 'extension', 'modifierExtension', 'progress']:
        if field in activity:
            new_activity[field] = activity[field]
            print(f"Copied field: {field}")
    
    # Handle detail field
    if 'detail' in activity and isinstance(activity['detail'], dict):
        print("\nFound detail field")
        detail = activity['detail']
        print(f"Detail keys: {list(detail.keys())}")
        
        if 'code' in detail and isinstance(detail['code'], dict):
            print("Found code in detail")
            code_concept = detail['code']
            print(f"Code concept: {code_concept}")
            
            if 'coding' in code_concept and code_concept['coding']:
                print("Found coding in code concept")
                first_coding = code_concept['coding'][0]
                print(f"First coding: {first_coding}")
                
                # Create synthetic reference
                ref = {
                    'reference': f"ServiceRequest/{first_coding.get('code', 'unknown')}",
                    'display': first_coding.get('display', code_concept.get('text', 'Activity'))
                }
                print(f"Created reference: {ref}")
                new_activity['plannedActivityReference'] = ref
    
    print(f"\nNew activity: {new_activity}")
    print(f"Has required fields: {'plannedActivityReference' in new_activity or 'performedActivity' in new_activity}")

if __name__ == "__main__":
    test_careplan()