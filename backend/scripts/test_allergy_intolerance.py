#!/usr/bin/env python3
"""
Debug AllergyIntolerance manifestation issue
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.allergyintolerance import AllergyIntolerance

def test_allergy():
    """Test AllergyIntolerance transformation."""
    allergy = {
        "resourceType": "AllergyIntolerance",
        "id": "test-123",
        "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "code": "active"}]},
        "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "code": "confirmed"}]},
        "type": "allergy",
        "category": ["environment"],
        "criticality": "low",
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "264287008", "display": "Animal dander"}]},
        "patient": {"reference": "Patient/123"},
        "reaction": [{
            "manifestation": [{
                "coding": [{"system": "http://snomed.info/sct", "code": "271807003", "display": "Skin rash"}],
                "text": "Skin rash"
            }]
        }]
    }
    
    print("Original reaction.manifestation:")
    print(json.dumps(allergy['reaction'][0]['manifestation'], indent=2))
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(allergy)
    
    print("\nTransformed reaction.manifestation:")
    if 'reaction' in transformed and transformed['reaction']:
        print(json.dumps(transformed['reaction'][0].get('manifestation', []), indent=2))
    
    # Check what fields AllergyIntoleranceReaction expects
    from fhir.resources.allergyintolerance import AllergyIntoleranceReaction
    print("\nAllergyIntoleranceReaction manifestation field type:")
    print(AllergyIntoleranceReaction.__fields__['manifestation'].type_)
    
    try:
        AllergyIntolerance(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_allergy()