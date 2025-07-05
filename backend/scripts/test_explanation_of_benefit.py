#!/usr/bin/env python3
"""
Test ExplanationOfBenefit transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.explanationofbenefit import ExplanationOfBenefit

def test_eob():
    """Test ExplanationOfBenefit from Synthea."""
    
    # Create test data like Synthea generates
    eob = {
        "resourceType": "ExplanationOfBenefit",
        "id": "test-123",
        "status": "active",
        "type": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/claim-type",
                "code": "professional"
            }]
        }],
        "use": "claim",
        "patient": {"reference": "Patient/123"},
        "created": "2023-01-01T00:00:00Z",
        "insurer": {"reference": "Organization/123"},
        "provider": {"reference": "Practitioner/123"},
        "outcome": "complete",
        "payment": [{
            "amount": {
                "value": 100.00,
                "currency": "USD"
            }
        }],
        "contained": [
            {
                "resourceType": "ServiceRequest",
                "id": "referral",
                "status": "completed",
                "intent": "order",
                "subject": {"reference": "Patient/123"}
            },
            {
                "resourceType": "Coverage",
                "id": "coverage",
                "status": "active",
                "type": {"text": "Medicaid"},
                "beneficiary": {"reference": "Patient/123"},
                "payor": [{"display": "Medicaid"}]
            }
        ],
        "insurance": [{
            "focal": True,
            "coverage": {"reference": "#coverage"}
        }],
        "total": [{
            "category": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/adjudication",
                    "code": "submitted"
                }]
            },
            "amount": {
                "value": 100.00,
                "currency": "USD"
            }
        }]
    }
    
    print("Original ExplanationOfBenefit:")
    print(json.dumps(eob, indent=2))
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(eob)
    
    print("\nTransformed ExplanationOfBenefit:")
    print(json.dumps(transformed, indent=2))
    
    # Validate
    try:
        eob_obj = ExplanationOfBenefit(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_eob()