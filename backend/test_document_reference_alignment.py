#!/usr/bin/env python3
"""
Test script to verify alignment between frontend and backend DocumentReference converters
"""

import sys
import os
import json
from datetime import datetime

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.fhir.converter_modules.document_reference import DocumentReferenceConverter

def test_frontend_backend_alignment():
    """Test that frontend and backend converters handle the same data structures"""
    
    print("Testing DocumentReference Frontend-Backend Alignment")
    print("=" * 60)
    
    # Test data that simulates what frontend sends
    frontend_data = {
        "type": "progress",
        "status": "current", 
        "docStatus": "preliminary",
        "title": "Test Progress Note",
        "description": "Test note description",
        "contentType": "soap",
        "content": "",
        "soapSections": {
            "subjective": "Patient reports feeling better",
            "objective": "Vital signs stable",
            "assessment": "Improving condition", 
            "plan": "Continue current treatment"
        },
        "patientId": "test-patient-123",
        "encounterId": "test-encounter-456",
        "authorId": "test-practitioner-789",
        "signNote": False
    }
    
    print("1. Testing frontend-style data conversion to FHIR:")
    print(f"   Input: {json.dumps(frontend_data, indent=2)}")
    
    try:
        # Convert to FHIR using backend converter
        fhir_resource = DocumentReferenceConverter.to_fhir(frontend_data)
        print(f"   ✅ Successfully converted to FHIR")
        print(f"   Resource Type: {fhir_resource.resourceType}")
        print(f"   Status: {fhir_resource.status}")
        print(f"   Doc Status: {fhir_resource.docStatus}")
        print(f"   Content Type: {fhir_resource.content[0].attachment.contentType}")
        
        # Convert back from FHIR
        converted_back = DocumentReferenceConverter.from_fhir(fhir_resource)
        print(f"   ✅ Successfully converted back from FHIR")
        print(f"   Type: {converted_back.get('type')}")
        print(f"   Content Type: {converted_back.get('contentType')}")
        print(f"   Has SOAP Sections: {bool(converted_back.get('soapSections'))}")
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False
    
    print("\n2. Testing medical history format:")
    
    # Test medical history format (like what was showing as base64)
    medical_history_data = {
        "type": "history_physical",
        "status": "current",
        "docStatus": "final", 
        "title": "Medical History",
        "description": "Patient medical history",
        "contentType": "text",
        "content": json.dumps({
            "chiefComplaint": "testing",
            "historyOfPresentIllness": "sadia", 
            "pastMedicalHistory": "adsa",
            "medications": "ads",
            "allergies": "adsd",
            "socialHistory": "asd",
            "familyHistory": "adad"
        }),
        "patientId": "test-patient-123",
        "authorId": "test-practitioner-789",
        "signNote": True
    }
    
    try:
        fhir_resource = DocumentReferenceConverter.to_fhir(medical_history_data)
        converted_back = DocumentReferenceConverter.from_fhir(fhir_resource)
        
        print(f"   ✅ Medical history format handled correctly")
        print(f"   Content Type: {converted_back.get('contentType')}")
        print(f"   Content Preview: {converted_back.get('content', '')[:100]}...")
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False
        
    print("\n3. Testing field mapping compatibility:")
    
    # Check that all expected fields are mapped correctly
    expected_mappings = [
        ("type", "type"),
        ("authorId", "authorId"), 
        ("authorId", "createdBy"),  # Backend compatibility
        ("patientId", "patientId"),
        ("encounterId", "encounterId"),
        ("signNote", "signNote"),
        ("docStatus", "docStatus"),
        ("status", "status"),
        ("contentType", "contentType"),
        ("soapSections", "soapSections")
    ]
    
    all_fields_present = True
    for frontend_field, backend_field in expected_mappings:
        if frontend_field in frontend_data:
            if backend_field not in converted_back:
                print(f"   ❌ Missing field mapping: {frontend_field} -> {backend_field}")
                all_fields_present = False
            else:
                print(f"   ✅ Field mapping OK: {frontend_field} -> {backend_field}")
    
    if all_fields_present:
        print("\n🎉 All alignment tests passed!")
        print("Frontend and backend DocumentReference converters are properly aligned.")
        return True
    else:
        print("\n❌ Some alignment issues found.")
        return False

if __name__ == "__main__":
    success = test_frontend_backend_alignment()
    sys.exit(0 if success else 1)