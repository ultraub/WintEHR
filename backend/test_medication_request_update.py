#!/usr/bin/env python3
"""
Test MedicationRequest PUT/update validation to reproduce 400 errors.
"""

import json
import asyncio
from datetime import datetime
from pathlib import Path
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from core.fhir.storage import FHIRStorageEngine
from core.fhir.synthea_validator import SyntheaFHIRValidator
from fhir.resources.medicationrequest import MedicationRequest
from fhir.resources import construct_fhir_element
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_medication_request_validation():
    """Test MedicationRequest validation that might cause 400 errors."""
    
    # Create database session
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://emr_user:secure_emr_pass@localhost:5432/emr_db")
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        storage = FHIRStorageEngine(session)
        validator = SyntheaFHIRValidator()
        
        # Load a real Synthea MedicationRequest
        synthea_dir = Path(__file__).parent / "synthea" / "output" / "fhir"
        test_file = synthea_dir / "Adalberto_Cole_a00d10c4-8d10-e65e-8365-a2433c837c86.json"
        
        if not test_file.exists():
            print(f"Test file not found: {test_file}")
            return
        
        with open(test_file, 'r') as f:
            bundle = json.load(f)
        
        # Find first MedicationRequest
        med_request = None
        for entry in bundle.get('entry', []):
            resource = entry.get('resource', {})
            if resource.get('resourceType') == 'MedicationRequest':
                med_request = resource
                break
        
        if not med_request:
            print("No MedicationRequest found in bundle")
            return
        
        print("=== Testing Original Synthea MedicationRequest ===")
        print("Original structure:")
        print(f"  - Has medicationCodeableConcept: {'medicationCodeableConcept' in med_request}")
        print(f"  - Has medication: {'medication' in med_request}")
        print(f"  - Has reasonReference: {'reasonReference' in med_request}")
        
        # Test 1: Validate original format
        print("\n--- Test 1: Validate original Synthea format ---")
        try:
            validation_result = validator.validate_resource("MedicationRequest", med_request)
            has_errors = any(issue.severity in ["error", "fatal"] for issue in validation_result.issue)
            print(f"Validation result: {'FAILED' if has_errors else 'PASSED'}")
            if has_errors:
                for issue in validation_result.issue:
                    if issue.severity in ["error", "fatal"]:
                        print(f"  ERROR: {issue.diagnostics}")
        except Exception as e:
            print(f"Validation failed with exception: {e}")
        
        # Test 2: Try construct_fhir_element directly (what storage engine does)
        print("\n--- Test 2: Test construct_fhir_element (storage engine path) ---")
        try:
            # This is what the storage engine does
            fhir_resource = construct_fhir_element("MedicationRequest", med_request)
            resource_dict = fhir_resource.dict(exclude_none=True)
            print("construct_fhir_element: SUCCESS")
        except Exception as e:
            print(f"construct_fhir_element: FAILED - {e}")
        
        # Test 3: Test update scenario - existing resource
        print("\n--- Test 3: Test update scenario ---")
        try:
            # Simulate what happens in update_resource
            resource_data = med_request.copy()
            
            # Ensure resourceType is set (as done in storage engine)
            if 'resourceType' not in resource_data:
                resource_data['resourceType'] = "MedicationRequest"
            
            fhir_resource = construct_fhir_element("MedicationRequest", resource_data)
            resource_dict = fhir_resource.dict(exclude_none=True)
            
            # Ensure resourceType is in the final dict (as done in storage engine)
            resource_dict['resourceType'] = "MedicationRequest"
            print("Update validation: SUCCESS")
            
        except Exception as e:
            print(f"Update validation: FAILED - {e}")
            # Try to identify the specific issue
            print(f"Exception type: {type(e)}")
            if hasattr(e, 'errors'):
                print("Validation errors:")
                for error in e.errors():
                    print(f"  - {error}")
        
        # Test 4: Test with transformed medication field
        print("\n--- Test 4: Test with FHIR R4 compliant medication field ---")
        try:
            transformed_request = med_request.copy()
            
            # Convert medicationCodeableConcept to medication
            if 'medicationCodeableConcept' in transformed_request:
                transformed_request['medication'] = transformed_request.pop('medicationCodeableConcept')
            
            # Also handle reasonReference -> reason transformation
            if 'reasonReference' in transformed_request:
                reason_refs = transformed_request.pop('reasonReference')
                transformed_request['reason'] = [{'reference': ref} for ref in reason_refs]
            
            fhir_resource = construct_fhir_element("MedicationRequest", transformed_request)
            resource_dict = fhir_resource.dict(exclude_none=True)
            print("Transformed validation: SUCCESS")
            
        except Exception as e:
            print(f"Transformed validation: FAILED - {e}")
            if hasattr(e, 'errors'):
                print("Validation errors:")
                for error in e.errors():
                    print(f"  - {error}")

if __name__ == "__main__":
    asyncio.run(test_medication_request_validation())