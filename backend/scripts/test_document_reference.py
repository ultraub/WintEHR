#!/usr/bin/env python3
"""
Test DocumentReference transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.documentreference import DocumentReference

def test_document_reference():
    """Test DocumentReference from Synthea."""
    
    # Create test data like Synthea generates
    doc_ref = {
        "resourceType": "DocumentReference",
        "id": "test-123",
        "status": "current",
        "type": [{
            "coding": [{
                "system": "http://loinc.org",
                "code": "34117-2",
                "display": "History and physical note"
            }]
        }],
        "subject": {"reference": "Patient/123"},
        "custodian": [{"reference": "Organization/123"}],
        "content": [{
            "attachment": {
                "contentType": "text/plain",
                "data": "SGVsbG8="
            },
            "format": {
                "system": "http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem",
                "code": "urn:ihe:iti:xds:2017:mimeTypeSufficient",
                "display": "mimeType Sufficient"
            }
        }],
        "context": [{
            "encounter": {"reference": "Encounter/123"},
            "period": {
                "start": "2023-01-01",
                "end": "2023-01-02"
            }
        }]
    }
    
    print("Original DocumentReference:")
    print(json.dumps(doc_ref, indent=2))
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(doc_ref)
    
    print("\nTransformed DocumentReference:")
    print(json.dumps(transformed, indent=2))
    
    # Validate
    try:
        doc_ref_obj = DocumentReference(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_document_reference()