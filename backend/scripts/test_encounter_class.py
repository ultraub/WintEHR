#!/usr/bin/env python3
"""
Test Encounter.class transformation specifically
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.encounter import Encounter

def test_encounter_class():
    """Test various Encounter.class formats."""
    
    test_cases = [
        {
            "name": "Synthea format - single Coding",
            "input": {
                "resourceType": "Encounter",
                "id": "test-1",
                "status": "finished",
                "class": {
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "AMB",
                    "display": "ambulatory"
                }
            }
        },
        {
            "name": "Synthea format - array of Coding (incorrect)",
            "input": {
                "resourceType": "Encounter",
                "id": "test-2",
                "status": "finished",
                "class": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "IMP",
                    "display": "inpatient encounter"
                }]
            }
        },
        {
            "name": "Already CodeableConcept",
            "input": {
                "resourceType": "Encounter",
                "id": "test-3",
                "status": "finished",
                "class": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": "EMER",
                        "display": "emergency"
                    }]
                }
            }
        }
    ]
    
    transformer = ProfileAwareFHIRTransformer()
    
    # Check if Synthea handler can handle Encounter
    test_enc = {"resourceType": "Encounter", "class": {"code": "AMB"}}
    for handler in transformer.handlers:
        print(f"Handler {handler.__class__.__name__} can handle Encounter: {handler.can_handle(test_enc)}")
    
    for test_case in test_cases:
        print(f"\n{'='*60}")
        print(f"Test: {test_case['name']}")
        print('='*60)
        
        encounter = test_case['input']
        print(f"Original class: {json.dumps(encounter['class'], indent=2)}")
        
        # Transform
        transformed = transformer.transform_resource(encounter)
        print(f"\nTransformed class: {json.dumps(transformed.get('class', 'MISSING'), indent=2)}")
        
        # Check if clean_resource removed it
        print(f"All transformed keys: {list(transformed.keys())}")
        
        # Manually test the _to_codeable_concept method
        if hasattr(transformer, '_handlers'):
            for handler in transformer._handlers:
                if isinstance(handler, type(transformer._handlers[0])):  # SyntheaProfileHandler
                    manual_cc = handler._to_codeable_concept(encounter['class'])
                    print(f"Manual _to_codeable_concept result: {json.dumps(manual_cc, indent=2)}")
                    break
        
        # Validate
        try:
            enc_obj = Encounter(**transformed)
            print("✅ Validation: PASSED")
            print(f"   class_fhir type: {type(enc_obj.class_fhir)}")
        except Exception as e:
            print(f"❌ Validation: FAILED")
            print(f"   Error: {str(e)}")

if __name__ == "__main__":
    print("🧪 Testing Encounter.class Transformation")
    test_encounter_class()