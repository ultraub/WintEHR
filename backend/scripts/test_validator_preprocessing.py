#!/usr/bin/env python3
"""
Test if the SyntheaFHIRValidator preprocessing is working correctly.
"""

import json
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.fhir.synthea_validator import SyntheaFHIRValidator

def test_preprocessing():
    """Test preprocessing of various resource types."""
    validator = SyntheaFHIRValidator()
    
    # Test Encounter preprocessing
    encounter_before = {
        "resourceType": "Encounter",
        "id": "test-123",
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "AMB"
        },
        "period": {
            "start": "2024-01-01T10:00:00Z",
            "end": "2024-01-01T11:00:00Z",
            "extra_field": "should be removed"
        },
        "participant": [{
            "individual": {
                "reference": "Practitioner/123",
                "display": "Dr. Test",
                "extra_field": "should be removed"
            },
            "extra_participant_field": "should be removed"
        }],
        "reasonCode": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "12345",
                "display": "Test",
                "extra_coding_field": "should be removed"
            }],
            "text": "Test reason",
            "extra_cc_field": "should be removed"
        }],
        "subject": {
            "reference": "Patient/123"
        }
    }
    
    print("🧪 Testing Encounter Preprocessing")
    print("=" * 60)
    print("\nBEFORE preprocessing:")
    print(json.dumps(encounter_before, indent=2))
    
    # Preprocess
    encounter_after = validator._preprocess_synthea_resource("Encounter", encounter_before)
    
    print("\nAFTER preprocessing:")
    print(json.dumps(encounter_after, indent=2))
    
    # Validate the preprocessed resource
    validation_result = validator.validate_resource("Encounter", encounter_before)
    
    print("\nValidation Result:")
    for issue in validation_result.issue:
        print(f"  {issue.severity}: {issue.code}")
        if hasattr(issue, 'details') and issue.details:
            if hasattr(issue.details, 'text'):
                print(f"    Details: {issue.details.text}")
            else:
                print(f"    Details: {issue.details}")
    
    # Test MedicationRequest preprocessing
    print("\n\n🧪 Testing MedicationRequest Preprocessing")
    print("=" * 60)
    
    med_request_before = {
        "resourceType": "MedicationRequest",
        "id": "test-med-123",
        "status": "active",
        "intent": "order",
        "medication": {
            "coding": [{
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code": "12345",
                "display": "Test Med"
            }],
            "text": "Test Medication",
            "extra_field": "should be removed"
        },
        "subject": {
            "reference": "Patient/123"
        },
        "authoredOn": "2024-01-01"
    }
    
    print("\nBEFORE preprocessing:")
    print(json.dumps(med_request_before, indent=2))
    
    med_request_after = validator._preprocess_synthea_resource("MedicationRequest", med_request_before)
    
    print("\nAFTER preprocessing:")
    print(json.dumps(med_request_after, indent=2))

if __name__ == "__main__":
    test_preprocessing()