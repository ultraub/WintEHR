#!/usr/bin/env python3
"""
Test ImagingStudy transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.imagingstudy import ImagingStudy

def test_imaging_study():
    """Test ImagingStudy from Synthea."""
    
    # Create test data like Synthea generates - based on validation errors
    imaging_study = {
        "resourceType": "ImagingStudy",
        "id": "test-123",
        "status": "available",
        "subject": {"reference": "Patient/123"},
        "procedureCode": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "104101",
                "display": "Radiography of chest (procedure)"
            }]
        }],
        "series": [{
            "uid": "1.2.840.99999999.48266081.1699055701697.1",
            "number": 1,
            "modality": {
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": "DX",
                "display": "Digital Radiography"
            },
            "numberOfInstances": 1,
            "bodySite": {
                "system": "http://snomed.info/sct",
                "code": "302551006",
                "display": "Entire thorax"
            }
        }]
    }
    
    print("Original ImagingStudy:")
    print(json.dumps(imaging_study, indent=2))
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(imaging_study)
    
    print("\nTransformed ImagingStudy:")
    print(json.dumps(transformed, indent=2))
    
    # Validate
    try:
        imaging_study_obj = ImagingStudy(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_imaging_study()