#!/usr/bin/env python3
"""
Test MedicationRequest transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.medicationrequest import MedicationRequest

def test_medication_request():
    """Test MedicationRequest from Synthea bundle."""
    
    # Load a real Synthea bundle
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "Beatriz277_Ana_María762_Muro989_c0219ca9-576f-f7c2-9c44-de030e94969b.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    transformer = ProfileAwareFHIRTransformer()
    
    # Find MedicationRequest resources
    med_requests = []
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'MedicationRequest':
            med_requests.append(resource)
    
    print(f"Found {len(med_requests)} MedicationRequest resources")
    
    if med_requests:
        # Test first one
        med_req = med_requests[0]
        print("\nOriginal MedicationRequest fields:")
        for key in sorted(med_req.keys()):
            if key.startswith('medication'):
                value_preview = str(med_req[key])[:100]
                print(f"  {key}: {value_preview}...")
        
        # Transform
        transformed = transformer.transform_resource(med_req)
        
        print("\nTransformed MedicationRequest fields:")
        for key in sorted(transformed.keys()):
            if key.startswith('medication'):
                value_preview = str(transformed[key])[:100]
                print(f"  {key}: {value_preview}...")
        
        # Check medication field structure
        if 'medication' in transformed:
            med_field = transformed['medication']
            print("\nMedication field structure:")
            print(f"  Type: {type(med_field)}")
            if isinstance(med_field, dict):
                print(f"  Keys: {list(med_field.keys())}")
                
                # Try wrapping in CodeableReference structure
                if 'coding' in med_field:
                    print("  Detected as CodeableConcept, wrapping in concept field...")
                    transformed['medication'] = {'concept': med_field}
        
        # Validate
        try:
            mr_obj = MedicationRequest(**transformed)
            print("\n✅ Validation: PASSED")
        except Exception as e:
            print(f"\n❌ Validation: FAILED")
            print(f"   Error: {str(e)}")

if __name__ == "__main__":
    test_medication_request()