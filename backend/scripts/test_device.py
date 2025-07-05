#!/usr/bin/env python3
"""
Test Device transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.device import Device

def test_device():
    """Test Device from Synthea."""
    
    # Create test data like Synthea generates - based on validation errors
    device = {
        "resourceType": "Device",
        "id": "test-123",
        "status": "active",
        "udiCarrier": [{
            "deviceIdentifier": "86900314973589",
            "carrierHRF": "(01)86900314973589(11)231013(17)481027(10)379912553927(21)255740202092"
        }],
        "distinctIdentifier": "86900314973589",
        "expirationDate": "2048-10-27",
        "lotNumber": "379912553927",
        "serialNumber": "255740202092",
        "deviceName": [{
            "name": "Absorb GT1 Bioresorbable Vascular Scaffold System",
            "type": "udi-label-name"
        }],
        "patient": {"reference": "Patient/123"},
        "type": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "74444006",
                "display": "Coronary artery stent (physical object)"
            }]
        },
        "manufacturer": "Abbott Vascular Inc.",
        "model": "GT1"
    }
    
    print("Original Device:")
    print(json.dumps(device, indent=2))
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(device)
    
    print("\nTransformed Device:")
    print(json.dumps(transformed, indent=2))
    
    # Validate
    try:
        device_obj = Device(**transformed)
        print("\n✅ Validation: PASSED")
    except Exception as e:
        print(f"\n❌ Validation: FAILED")
        print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_device()