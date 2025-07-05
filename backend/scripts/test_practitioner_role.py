#!/usr/bin/env python3
"""
Test PractitionerRole transformation
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.practitionerrole import PractitionerRole

def test_practitioner_role():
    """Test PractitionerRole from Synthea."""
    
    # Get a real PractitionerRole from error report
    with open('validation_errors_report.json', 'r') as f:
        errors = json.load(f)
    
    # Find PractitionerRole error
    pr_errors = [e for e in errors['validation_errors'] if e['resource_type'] == 'PractitionerRole']
    if pr_errors:
        pr = pr_errors[0]['original_resource']
        print("Original PractitionerRole:")
        print(json.dumps(pr, indent=2))
        
        transformer = ProfileAwareFHIRTransformer()
        transformed = transformer.transform_resource(pr)
        
        print("\nTransformed PractitionerRole:")
        print(json.dumps(transformed, indent=2))
        
        try:
            PractitionerRole(**transformed)
            print("\n✅ Validation: PASSED")
        except Exception as e:
            print(f"\n❌ Validation: FAILED")
            print(f"   Error: {str(e)}")
    else:
        print("No PractitionerRole errors found in report")

if __name__ == "__main__":
    test_practitioner_role()