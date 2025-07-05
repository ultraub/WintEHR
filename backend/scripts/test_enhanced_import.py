#!/usr/bin/env python3
"""
Test the enhanced FHIR transformer with Synthea data
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources import construct_fhir_element


def test_single_resource(file_path: str, resource_type: str = None):
    """Test transformation of a single resource."""
    print(f"\n{'='*60}")
    print(f"Testing: {Path(file_path).name}")
    print('='*60)
    
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # If it's a bundle, extract first resource of given type
    if data.get('resourceType') == 'Bundle' and resource_type:
        for entry in data.get('entry', []):
            resource = entry.get('resource', {})
            if resource.get('resourceType') == resource_type:
                data = resource
                break
        else:
            print(f"No {resource_type} found in bundle")
            return None, None, []
    
    original_type = data.get('resourceType')
    print(f"Resource Type: {original_type}")
    
    # Transform the resource
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(data)
    
    # Try to validate with fhir.resources
    errors = []
    is_valid = False
    
    try:
        # Attempt to construct FHIR resource
        construct_fhir_element(original_type, transformed)
        is_valid = True
        print("✅ Validation: PASSED")
    except Exception as e:
        errors.append(str(e))
        print(f"❌ Validation: FAILED")
        print(f"   Error: {str(e)[:200]}...")
    
    # Show what transformations were applied
    print("\nTransformations Applied:")
    changes = compare_resources(data, transformed)
    for change in changes[:10]:  # Show first 10 changes
        print(f"  - {change}")
    if len(changes) > 10:
        print(f"  ... and {len(changes) - 10} more changes")
    
    return is_valid, transformed, errors


def compare_resources(original: dict, transformed: dict, path: str = "") -> list:
    """Compare two resources and return list of changes."""
    changes = []
    
    # Check for added keys
    for key in transformed:
        if key not in original:
            changes.append(f"{path}.{key}: Added field")
    
    # Check for removed keys
    for key in original:
        if key not in transformed:
            changes.append(f"{path}.{key}: Removed field")
    
    # Check for modified values
    for key in original:
        if key in transformed:
            orig_val = original[key]
            trans_val = transformed[key]
            
            if type(orig_val) != type(trans_val):
                changes.append(f"{path}.{key}: Type changed from {type(orig_val).__name__} to {type(trans_val).__name__}")
            elif isinstance(orig_val, dict):
                changes.extend(compare_resources(orig_val, trans_val, f"{path}.{key}"))
            elif isinstance(orig_val, list):
                if len(orig_val) != len(trans_val):
                    changes.append(f"{path}.{key}: Array length changed from {len(orig_val)} to {len(trans_val)}")
            elif orig_val != trans_val:
                changes.append(f"{path}.{key}: Value changed")
    
    return changes


def test_all_resource_types():
    """Test transformation of all resource types from Synthea."""
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    
    # Test with first patient bundle
    test_file = synthea_dir / "Beatriz277_Ana_María762_Muro989_c0219ca9-576f-f7c2-9c44-de030e94969b.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    # Resource types to test
    resource_types = [
        'Patient', 'Encounter', 'Observation', 'Condition',
        'Procedure', 'MedicationRequest', 'DiagnosticReport',
        'DocumentReference', 'Claim', 'ExplanationOfBenefit',
        'Device', 'CarePlan', 'CareTeam', 'Immunization',
        'AllergyIntolerance', 'ImagingStudy'
    ]
    
    results = {}
    
    for resource_type in resource_types:
        is_valid, transformed, errors = test_single_resource(str(test_file), resource_type)
        if is_valid is not None:  # Resource was found
            results[resource_type] = {
                'valid': is_valid,
                'errors': errors
            }
    
    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    passed = sum(1 for r in results.values() if r['valid'])
    failed = len(results) - passed
    
    print(f"Total Resources Tested: {len(results)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if failed > 0:
        print("\nFailed Resources:")
        for resource_type, result in results.items():
            if not result['valid']:
                print(f"  - {resource_type}: {result['errors'][0][:100]}...")
    
    return results


def test_practitioner_bundle():
    """Test practitioner information bundle."""
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "practitionerInformation1751698322447.json"
    
    if not test_file.exists():
        print(f"Practitioner file not found: {test_file}")
        return
    
    print("\n" + "="*60)
    print("Testing Practitioner Bundle")
    print("="*60)
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    transformer = ProfileAwareFHIRTransformer()
    
    practitioner_count = 0
    role_count = 0
    errors = []
    
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')
        
        if resource_type in ['Practitioner', 'PractitionerRole']:
            try:
                transformed = transformer.transform_resource(resource)
                construct_fhir_element(resource_type, transformed)
                
                if resource_type == 'Practitioner':
                    practitioner_count += 1
                else:
                    role_count += 1
                    
            except Exception as e:
                errors.append(f"{resource_type}: {str(e)[:100]}")
    
    print(f"✅ Successfully transformed {practitioner_count} Practitioners")
    print(f"✅ Successfully transformed {role_count} PractitionerRoles")
    
    if errors:
        print(f"\n❌ Errors ({len(errors)}):")
        for err in errors[:5]:
            print(f"  - {err}")


if __name__ == "__main__":
    print("🧪 Testing Enhanced FHIR Transformer")
    
    # Test all resource types from a patient bundle
    results = test_all_resource_types()
    
    # Test practitioner bundle
    test_practitioner_bundle()
    
    print("\n✨ Test Complete!")