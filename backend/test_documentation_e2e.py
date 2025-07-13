#!/usr/bin/env python3
"""
End-to-End Testing Suite for Documentation Tab
Tests FHIR compliance, full workflow, and data integrity
"""

import sys
import os
import json
import base64
from datetime import datetime

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.fhir.converter_modules.document_reference import DocumentReferenceConverter
from api.fhir.batch_transaction import BatchProcessor
from fhir.resources.documentreference import DocumentReference
from fhir.resources.bundle import Bundle

def test_fhir_compliance():
    """Test FHIR R4 compliance for DocumentReference resources"""
    
    print("🔍 Testing FHIR R4 Compliance")
    print("=" * 50)
    
    # Test data that covers all note types and content formats
    test_cases = [
        {
            "name": "Progress Note - SOAP Format",
            "data": {
                "type": "progress",
                "status": "current",
                "docStatus": "preliminary",
                "title": "Daily Progress Note",
                "description": "Patient progress documentation",
                "contentType": "soap",
                "soapSections": {
                    "subjective": "Patient reports improved symptoms",
                    "objective": "BP 120/80, HR 72, normal examination",
                    "assessment": "Hypertension well controlled",
                    "plan": "Continue current medications, follow up in 3 months"
                },
                "patientId": "patient-123",
                "encounterId": "encounter-456",
                "authorId": "practitioner-789",
                "signNote": False
            }
        },
        {
            "name": "History & Physical - Medical History Format",
            "data": {
                "type": "history_physical",
                "status": "current",
                "docStatus": "final",
                "title": "Admission History & Physical",
                "description": "Complete H&P on admission",
                "contentType": "text",
                "content": json.dumps({
                    "chiefComplaint": "Chest pain for 2 hours",
                    "historyOfPresentIllness": "55-year-old male with acute onset chest pain",
                    "pastMedicalHistory": "Hypertension, diabetes mellitus type 2",
                    "medications": "Metformin 500mg BID, Lisinopril 10mg daily",
                    "allergies": "NKDA",
                    "socialHistory": "Non-smoker, occasional alcohol use",
                    "familyHistory": "Father with CAD, mother with diabetes"
                }),
                "patientId": "patient-123",
                "authorId": "practitioner-789",
                "signNote": True
            }
        },
        {
            "name": "Consultation Note - Plain Text",
            "data": {
                "type": "consultation",
                "status": "current",
                "docStatus": "final",
                "title": "Cardiology Consultation",
                "description": "Specialist consultation for chest pain",
                "contentType": "text",
                "content": "Thank you for referring this pleasant 55-year-old gentleman for evaluation of chest pain. Initial workup suggests stable angina. Recommend stress testing and optimization of medical therapy.",
                "patientId": "patient-123",
                "encounterId": "encounter-456",
                "authorId": "practitioner-999",
                "signNote": True
            }
        }
    ]
    
    passed_tests = 0
    total_tests = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        try:
            # Convert to FHIR using our converter
            fhir_resource = DocumentReferenceConverter.to_fhir(test_case['data'])
            
            # Validate FHIR resource structure
            if not isinstance(fhir_resource, DocumentReference):
                raise ValueError(f"Expected DocumentReference, got {type(fhir_resource)}")
            
            # Check required fields
            required_fields = ['status', 'content', 'type', 'subject']
            for field in required_fields:
                if not hasattr(fhir_resource, field) or getattr(fhir_resource, field) is None:
                    raise ValueError(f"Missing required field: {field}")
            
            # Check content structure
            if not fhir_resource.content or not fhir_resource.content[0].attachment:
                raise ValueError("Missing content attachment")
                
            attachment = fhir_resource.content[0].attachment
            if not attachment.data or not attachment.contentType:
                raise ValueError("Missing attachment data or contentType")
            
            # Test base64 decoding
            try:
                decoded_content = base64.b64decode(attachment.data).decode('utf-8')
                if not decoded_content:
                    raise ValueError("Empty decoded content")
            except Exception as e:
                raise ValueError(f"Base64 decoding failed: {e}")
            
            # Test round-trip conversion
            converted_back = DocumentReferenceConverter.from_fhir(fhir_resource)
            
            # Verify key fields preserved
            original_type = test_case['data']['type']
            converted_type = converted_back.get('type')
            if original_type != converted_type:
                raise ValueError(f"Type mismatch: {original_type} != {converted_type}")
            
            original_patient = test_case['data']['patientId']
            converted_patient = converted_back.get('patientId')
            if original_patient != converted_patient:
                raise ValueError(f"Patient ID mismatch: {original_patient} != {converted_patient}")
            
            print(f"   ✅ FHIR validation passed")
            print(f"   ✅ Round-trip conversion successful")
            print(f"   ✅ Content type: {attachment.contentType}")
            print(f"   ✅ Content size: {len(decoded_content)} chars")
            
            passed_tests += 1
            
        except Exception as e:
            print(f"   ❌ Test failed: {str(e)}")
    
    print(f"\n📊 FHIR Compliance Results: {passed_tests}/{total_tests} tests passed")
    return passed_tests == total_tests

def test_content_format_handling():
    """Test different content format handling"""
    
    print("\n🔍 Testing Content Format Handling")
    print("=" * 50)
    
    formats_tested = []
    
    # Test SOAP format
    print("1. Testing SOAP format processing:")
    soap_data = {
        "type": "progress",
        "contentType": "soap",
        "soapSections": {
            "subjective": "Patient feels better today",
            "objective": "Vital signs stable, afebrile",
            "assessment": "Condition improving",
            "plan": "Continue current treatment"
        },
        "patientId": "test-patient",
        "authorId": "test-user"
    }
    
    try:
        fhir_resource = DocumentReferenceConverter.to_fhir(soap_data)
        converted_back = DocumentReferenceConverter.from_fhir(fhir_resource)
        
        if converted_back.get('contentType') == 'soap':
            soap_sections = converted_back.get('soapSections', {})
            if (soap_sections.get('subjective') and soap_sections.get('objective') and 
                soap_sections.get('assessment') and soap_sections.get('plan')):
                print("   ✅ SOAP format preserved correctly")
                formats_tested.append('soap')
            else:
                print("   ❌ SOAP sections not preserved")
        else:
            print("   ❌ SOAP content type not preserved")
    except Exception as e:
        print(f"   ❌ SOAP format test failed: {e}")
    
    # Test medical history format
    print("2. Testing medical history format processing:")
    history_data = {
        "type": "history_physical",
        "contentType": "text",
        "content": json.dumps({
            "chiefComplaint": "Shortness of breath",
            "historyOfPresentIllness": "3-day history of progressive dyspnea",
            "pastMedicalHistory": "Asthma, seasonal allergies",
            "medications": "Albuterol inhaler PRN",
            "allergies": "Penicillin - rash",
            "socialHistory": "Non-smoker",
            "familyHistory": "Mother with asthma"
        }),
        "patientId": "test-patient",
        "authorId": "test-user"
    }
    
    try:
        fhir_resource = DocumentReferenceConverter.to_fhir(history_data)
        converted_back = DocumentReferenceConverter.from_fhir(fhir_resource)
        
        # The medical history format should be detected and converted to readable text
        content = converted_back.get('content', '')
        if ('Chief Complaint:' in content and 'History of Present Illness:' in content and
            'Past Medical History:' in content):
            print("   ✅ Medical history format converted correctly")
            print(f"   Content type detected as: {converted_back.get('contentType')}")
            formats_tested.append('medical-history')
        else:
            print(f"   ❌ Medical history sections not formatted properly")
            print(f"   Content type: {converted_back.get('contentType')}")
            print(f"   Content preview: {content[:100]}...")
    except Exception as e:
        print(f"   ❌ Medical history format test failed: {e}")
    
    # Test plain text format
    print("3. Testing plain text format processing:")
    text_data = {
        "type": "consultation",
        "contentType": "text",
        "content": "This is a simple consultation note with plain text content for testing purposes.",
        "patientId": "test-patient",
        "authorId": "test-user"
    }
    
    try:
        fhir_resource = DocumentReferenceConverter.to_fhir(text_data)
        converted_back = DocumentReferenceConverter.from_fhir(fhir_resource)
        
        if converted_back.get('content') == text_data['content']:
            print("   ✅ Plain text format preserved correctly")
            formats_tested.append('text')
        else:
            print("   ❌ Plain text content not preserved")
    except Exception as e:
        print(f"   ❌ Plain text format test failed: {e}")
    
    print(f"\n📊 Content Format Results: {len(formats_tested)}/3 formats working correctly")
    return len(formats_tested) == 3

def test_loinc_code_mapping():
    """Test LOINC code mapping for all note types"""
    
    print("\n🔍 Testing LOINC Code Mapping")
    print("=" * 50)
    
    note_types = [
        'progress', 'history_physical', 'consultation', 'discharge',
        'operative', 'procedure', 'soap', 'nursing', 'therapy',
        'social_work', 'imaging', 'laboratory', 'pathology'
    ]
    
    mapped_correctly = 0
    
    for note_type in note_types:
        try:
            type_info = DocumentReferenceConverter.NOTE_TYPE_CODES.get(note_type)
            if not type_info:
                print(f"   ❌ {note_type}: No LOINC mapping found")
                continue
            
            # Validate LOINC code structure
            if not type_info.get('code') or not type_info.get('display') or not type_info.get('system'):
                print(f"   ❌ {note_type}: Incomplete LOINC mapping")
                continue
            
            # Test conversion
            test_data = {
                "type": note_type,
                "content": f"Test {note_type} note",
                "patientId": "test-patient",
                "authorId": "test-user"
            }
            
            fhir_resource = DocumentReferenceConverter.to_fhir(test_data)
            
            if (fhir_resource.type and fhir_resource.type.coding and 
                fhir_resource.type.coding[0].code == type_info['code']):
                print(f"   ✅ {note_type}: {type_info['code']} ({type_info['display']})")
                mapped_correctly += 1
            else:
                print(f"   ❌ {note_type}: LOINC code not applied correctly")
                
        except Exception as e:
            print(f"   ❌ {note_type}: Conversion failed - {e}")
    
    print(f"\n📊 LOINC Mapping Results: {mapped_correctly}/{len(note_types)} note types mapped correctly")
    return mapped_correctly == len(note_types)

def test_workflow_integration():
    """Test integration with clinical workflow events"""
    
    print("\n🔍 Testing Workflow Integration")
    print("=" * 50)
    
    # Test note lifecycle
    test_scenarios = [
        {"name": "Create new note", "action": "create", "sign": False},
        {"name": "Create and sign note", "action": "create", "sign": True},
        {"name": "Update existing note", "action": "update", "sign": False},
        {"name": "Sign existing note", "action": "update", "sign": True}
    ]
    
    passed_scenarios = 0
    
    for scenario in test_scenarios:
        print(f"   Testing: {scenario['name']}")
        try:
            # Simulate note data
            note_data = {
                "type": "progress",
                "title": f"Test note for {scenario['name']}",
                "content": "This is test content for workflow validation",
                "contentType": "text",
                "patientId": "workflow-test-patient",
                "authorId": "workflow-test-user",
                "signNote": scenario['sign']
            }
            
            # Convert to FHIR
            fhir_resource = DocumentReferenceConverter.to_fhir(note_data)
            
            # Check document status based on signing
            expected_doc_status = 'final' if scenario['sign'] else 'preliminary'
            if fhir_resource.docStatus == expected_doc_status:
                print(f"     ✅ Document status correct: {fhir_resource.docStatus}")
                passed_scenarios += 1
            else:
                print(f"     ❌ Document status incorrect: expected {expected_doc_status}, got {fhir_resource.docStatus}")
                
        except Exception as e:
            print(f"     ❌ Scenario failed: {e}")
    
    print(f"\n📊 Workflow Integration Results: {passed_scenarios}/{len(test_scenarios)} scenarios passed")
    return passed_scenarios == len(test_scenarios)

def run_comprehensive_test():
    """Run all end-to-end tests"""
    
    print("🚀 Documentation Tab End-to-End Testing Suite")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    test_results = []
    
    # Run all test suites
    test_results.append(("FHIR Compliance", test_fhir_compliance()))
    test_results.append(("Content Format Handling", test_content_format_handling()))
    test_results.append(("LOINC Code Mapping", test_loinc_code_mapping()))
    test_results.append(("Workflow Integration", test_workflow_integration()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 FINAL RESULTS SUMMARY")
    print("=" * 60)
    
    passed_count = 0
    for test_name, passed in test_results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:25} : {status}")
        if passed:
            passed_count += 1
    
    print(f"\nOverall Results: {passed_count}/{len(test_results)} test suites passed")
    
    if passed_count == len(test_results):
        print("\n🎉 ALL TESTS PASSED! Documentation tab is ready for production.")
        return True
    else:
        print(f"\n⚠️  {len(test_results) - passed_count} test suite(s) failed. Review and fix issues before deployment.")
        return False

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)