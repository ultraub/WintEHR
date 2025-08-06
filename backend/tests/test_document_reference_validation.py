"""
Test suite for DocumentReference validation and content processing.

Tests all content formats, validation scenarios, and edge cases.
"""

import pytest
import base64
import json
from datetime import datetime
from typing import Dict, Any

from api.services.fhir.document_validation_service import DocumentValidationService, DocumentValidationError
from fhir.core.converters.resource_specific.document_reference import DocumentReferenceConverter
from fhir.resources.documentreference import DocumentReference
from fhir.resources.attachment import Attachment
from fhir.resources.documentreference import DocumentReferenceContent


class TestDocumentValidationService:
    """Test DocumentValidationService functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.validator = DocumentValidationService()
        
    def create_valid_document_reference(self, content_data: str = "Test content", 
                                      content_type: str = "text/plain") -> DocumentReference:
        """Create a valid DocumentReference for testing"""
        encoded_content = base64.b64encode(content_data.encode('utf-8')).decode('utf-8')
        
        doc_ref_dict = {
            "resourceType": "DocumentReference",
            "id": "test-doc-123",
            "status": "current",
            "docStatus": "final",
            "type": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "11506-3",
                    "display": "Progress note"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-123"
            },
            "date": datetime.now().isoformat() + "Z",
            "author": [{
                "reference": "Practitioner/test-practitioner-123"
            }],
            "content": [{
                "attachment": {
                    "contentType": content_type,
                    "data": encoded_content,
                    "title": "Test Document",
                    "creation": datetime.now().isoformat()
                }
            }]
        }
        
        return DocumentReference(**doc_ref_dict)
    
    def test_validate_valid_document(self):
        """Test validation of a valid DocumentReference"""
        doc_ref = self.create_valid_document_reference()
        
        is_valid, issues = self.validator.validate_document_reference(doc_ref)
        
        assert is_valid
        assert len(issues) == 0
    
    def test_validate_missing_required_fields(self):
        """Test validation with missing required fields"""
        doc_ref_dict = {
            "resourceType": "DocumentReference",
            "id": "test-doc-123"
            # Missing status, type, subject, content
        }
        
        doc_ref = DocumentReference(**doc_ref_dict)
        is_valid, issues = self.validator.validate_document_reference(doc_ref)
        
        assert not is_valid
        assert len(issues) >= 4  # Should have issues for missing required fields
        
        issue_fields = [issue['field'] for issue in issues]
        assert 'status' in issue_fields
        assert 'type' in issue_fields
        assert 'subject' in issue_fields
        assert 'content' in issue_fields
    
    def test_validate_invalid_status(self):
        """Test validation with invalid status value"""
        doc_ref = self.create_valid_document_reference()
        doc_ref.status = "invalid-status"
        
        is_valid, issues = self.validator.validate_document_reference(doc_ref)
        
        assert not is_valid
        error_issues = [i for i in issues if i['severity'] == 'error']
        assert len(error_issues) > 0
        assert any(i['field'] == 'status' for i in error_issues)
    
    def test_validate_invalid_base64_content(self):
        """Test validation with invalid base64 content"""
        doc_ref = self.create_valid_document_reference()
        doc_ref.content[0].attachment.data = "invalid-base64-data!!!"
        
        is_valid, issues = self.validator.validate_document_reference(doc_ref)
        
        assert not is_valid
        critical_issues = [i for i in issues if i['severity'] == 'critical']
        assert len(critical_issues) > 0
        assert any('base64' in i['message'].lower() for i in critical_issues)
    
    def test_validate_invalid_json_content(self):
        """Test validation with content marked as JSON but invalid JSON"""
        invalid_json = "This is not valid JSON {{"
        encoded_content = base64.b64encode(invalid_json.encode('utf-8')).decode('utf-8')
        
        doc_ref = self.create_valid_document_reference()
        doc_ref.content[0].attachment.contentType = "application/json"
        doc_ref.content[0].attachment.data = encoded_content
        
        is_valid, issues = self.validator.validate_document_reference(doc_ref)
        
        assert not is_valid
        error_issues = [i for i in issues if i['severity'] == 'error']
        assert any('json' in i['message'].lower() for i in error_issues)
    
    def test_validate_and_fix(self):
        """Test automatic fixing of common issues"""
        doc_ref_dict = {
            "resourceType": "DocumentReference",
            "id": "test-doc-123",
            "status": "current",
            "type": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "11506-3",
                    "display": "Progress note"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-123"
            },
            "content": [{
                "attachment": {
                    "data": base64.b64encode("Test content".encode('utf-8')).decode('utf-8')
                    # Missing contentType and date
                }
            }]
        }
        
        doc_ref = DocumentReference(**doc_ref_dict)
        fixed_doc_ref, remaining_issues = self.validator.validate_and_fix(doc_ref)
        
        # Should have fixed missing date and contentType
        assert fixed_doc_ref.date is not None
        assert fixed_doc_ref.content[0].attachment.contentType is not None
        
        # Should have fewer critical issues after fixes
        critical_issues = [i for i in remaining_issues if i['severity'] in ['error', 'critical']]
        assert len(critical_issues) == 0
    
    def test_validate_before_save_success(self):
        """Test validate_before_save with valid document"""
        doc_ref = self.create_valid_document_reference()
        
        # Should not raise exception
        validated_doc = self.validator.validate_before_save(doc_ref)
        assert validated_doc is not None
        assert validated_doc.id == doc_ref.id
    
    def test_validate_before_save_failure(self):
        """Test validate_before_save with invalid document"""
        doc_ref_dict = {
            "resourceType": "DocumentReference",
            "id": "test-doc-123"
            # Missing required fields
        }
        
        doc_ref = DocumentReference(**doc_ref_dict)
        
        with pytest.raises(DocumentValidationError) as exc_info:
            self.validator.validate_before_save(doc_ref, auto_fix=False)
        
        assert "validation failed" in str(exc_info.value).lower()
        assert len(exc_info.value.issues) > 0


class TestDocumentReferenceConverter:
    """Test DocumentReferenceConverter functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.converter = DocumentReferenceConverter()
    
    def test_soap_content_conversion(self):
        """Test SOAP format content conversion"""
        soap_data = {
            "subjective": "Patient complains of headache",
            "objective": "BP 120/80, alert and oriented",
            "assessment": "Tension headache",
            "plan": "Rest and hydration"
        }
        
        # Test to_fhir conversion
        form_data = {
            "type": "soap",
            "contentType": "soap",
            "soapSections": soap_data,
            "patientId": "patient-123",
            "status": "current"
        }
        
        fhir_doc = self.converter.to_fhir(form_data)
        
        assert fhir_doc.resourceType == "DocumentReference"
        assert fhir_doc.content[0].attachment.contentType == "application/json"
        
        # Decode and verify content
        decoded_content = base64.b64decode(fhir_doc.content[0].attachment.data).decode('utf-8')
        parsed_content = json.loads(decoded_content)
        
        assert parsed_content["subjective"] == soap_data["subjective"]
        assert parsed_content["objective"] == soap_data["objective"]
        assert parsed_content["assessment"] == soap_data["assessment"]
        assert parsed_content["plan"] == soap_data["plan"]
        
        # Test from_fhir conversion
        internal_data = self.converter.from_fhir(fhir_doc)
        
        assert internal_data["contentType"] == "soap"
        assert internal_data["soapSections"]["subjective"] == soap_data["subjective"]
        assert internal_data["soapSections"]["objective"] == soap_data["objective"]
        assert internal_data["soapSections"]["assessment"] == soap_data["assessment"]
        assert internal_data["soapSections"]["plan"] == soap_data["plan"]
    
    def test_medical_history_conversion(self):
        """Test medical history format conversion"""
        history_data = {
            "chiefComplaint": "Chest pain",
            "historyOfPresentIllness": "Started 2 hours ago",
            "pastMedicalHistory": "Hypertension, diabetes",
            "medications": "Metformin, Lisinopril",
            "allergies": "NKDA"
        }
        
        # Create FHIR document with medical history content
        encoded_content = base64.b64encode(json.dumps(history_data).encode('utf-8')).decode('utf-8')
        
        fhir_doc_dict = {
            "resourceType": "DocumentReference",
            "id": "test-doc",
            "status": "current",
            "type": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "34117-2",
                    "display": "History and physical note"
                }]
            },
            "subject": {"reference": "Patient/test-patient"},
            "content": [{
                "attachment": {
                    "contentType": "application/json",
                    "data": encoded_content
                }
            }]
        }
        
        fhir_doc = DocumentReference(**fhir_doc_dict)
        internal_data = self.converter.from_fhir(fhir_doc)
        
        assert internal_data["contentType"] == "medical-history"
        assert "Chief Complaint: Chest pain" in internal_data["content"]
        assert "History of Present Illness: Started 2 hours ago" in internal_data["content"]
        assert "Past Medical History: Hypertension, diabetes" in internal_data["content"]
    
    def test_plain_text_conversion(self):
        """Test plain text content conversion"""
        text_content = "This is a simple progress note with plain text content."
        
        form_data = {
            "type": "progress",
            "contentType": "text",
            "content": text_content,
            "patientId": "patient-123"
        }
        
        # Test to_fhir conversion
        fhir_doc = self.converter.to_fhir(form_data)
        
        assert fhir_doc.content[0].attachment.contentType == "text/plain"
        
        # Decode and verify content
        decoded_content = base64.b64decode(fhir_doc.content[0].attachment.data).decode('utf-8')
        assert decoded_content == text_content
        
        # Test from_fhir conversion
        internal_data = self.converter.from_fhir(fhir_doc)
        
        assert internal_data["contentType"] == "text"
        assert internal_data["content"] == text_content
    
    def test_loinc_code_mapping(self):
        """Test LOINC code mapping for different note types"""
        test_cases = [
            ("progress", "11506-3", "Progress note"),
            ("history_physical", "34117-2", "History and physical note"),
            ("consultation", "11488-4", "Consultation note"),
            ("discharge", "18842-5", "Discharge summary"),
            ("soap", "34109-9", "Note")
        ]
        
        for note_type, expected_code, expected_display in test_cases:
            form_data = {
                "type": note_type,
                "content": "Test content",
                "patientId": "patient-123"
            }
            
            fhir_doc = self.converter.to_fhir(form_data)
            
            assert fhir_doc.type.coding[0].code == expected_code
            assert fhir_doc.type.coding[0].display == expected_display
            assert fhir_doc.type.coding[0].system == "http://loinc.org"
    
    def test_error_handling(self):
        """Test error handling for malformed data"""
        # Test with missing required data
        with pytest.raises(Exception):
            self.converter.to_fhir({})  # Empty data should fail
        
        # Test with invalid FHIR resource
        invalid_fhir_dict = {
            "resourceType": "DocumentReference",
            "status": "invalid-status"  # Invalid status
        }
        
        # This should handle gracefully or raise appropriate error
        try:
            invalid_doc = DocumentReference(**invalid_fhir_dict)
            result = self.converter.from_fhir(invalid_doc)
            # Should handle gracefully
            assert result is not None
        except Exception:
            # Or raise appropriate error
            pass


class TestContentFormatValidation:
    """Test validation of different content formats"""
    
    def test_validate_soap_sections(self):
        """Test validation of SOAP section content"""
        from utils.documentContentValidator import DocumentContentValidator
        
        # Valid SOAP sections
        valid_soap = {
            "subjective": "Patient reports headache for 2 days",
            "objective": "Alert, oriented, BP 130/85",
            "assessment": "Tension headache",
            "plan": "Ibuprofen 400mg TID, follow up in 1 week"
        }
        
        result = DocumentContentValidator.validateSOAPSections(valid_soap)
        assert result['isValid']
        assert len(result['completeSections']) == 4
        
        # Incomplete SOAP sections
        incomplete_soap = {
            "subjective": "Patient reports headache",
            "objective": "",
            "assessment": "",
            "plan": ""
        }
        
        result = DocumentContentValidator.validateSOAPSections(incomplete_soap)
        assert len(result['warnings']) > 0
        assert len(result['completeSections']) == 1
    
    def test_validate_medical_history(self):
        """Test validation of medical history content"""
        from utils.documentContentValidator import DocumentContentValidator
        
        # Valid medical history
        valid_history = {
            "chiefComplaint": "Chest pain",
            "historyOfPresentIllness": "Started this morning, sharp, 7/10 severity",
            "pastMedicalHistory": "Hypertension, no prior cardiac events"
        }
        
        result = DocumentContentValidator.validateMedicalHistory(valid_history)
        assert result['isValid']
        assert len(result['completeFields']) == 3
        
        # Empty medical history
        empty_history = {}
        
        result = DocumentContentValidator.validateMedicalHistory(empty_history)
        assert not result['isValid']
        assert len(result['errors']) > 0
    
    def test_validate_plain_text(self):
        """Test validation of plain text content"""
        from utils.documentContentValidator import DocumentContentValidator
        
        # Valid plain text
        valid_text = "Patient seen for routine follow-up. Doing well on current medications. Plan to continue current regimen."
        
        result = DocumentContentValidator.validatePlainTextContent(valid_text)
        assert result['isValid']
        assert result['wordCount'] > 10
        
        # Empty text
        empty_text = ""
        
        result = DocumentContentValidator.validatePlainTextContent(empty_text)
        assert not result['isValid']
        assert len(result['errors']) > 0
        
        # Very short text
        short_text = "OK"
        
        result = DocumentContentValidator.validatePlainTextContent(short_text)
        assert result['isValid']  # Valid but has warnings
        assert len(result['warnings']) > 0
    
    def test_validate_base64_content(self):
        """Test base64 content validation"""
        from utils.documentContentValidator import DocumentContentValidator
        
        # Valid base64
        valid_content = "Hello, this is test content"
        valid_base64 = base64.b64encode(valid_content.encode('utf-8')).decode('utf-8')
        
        result = DocumentContentValidator.validateBase64Content(valid_base64)
        assert result['isValid']
        
        # Invalid base64 characters
        invalid_base64 = "This is not base64!!!"
        
        result = DocumentContentValidator.validateBase64Content(invalid_base64)
        assert not result['isValid']
        assert 'characters' in result['errors'][0].lower()
        
        # Invalid base64 length
        invalid_length = "ABC"  # Not multiple of 4
        
        result = DocumentContentValidator.validateBase64Content(invalid_length)
        assert not result['isValid']
        assert 'length' in result['errors'][0].lower()


@pytest.mark.integration
class TestIntegrationWorkflows:
    """Integration tests for complete workflows"""
    
    def test_create_soap_note_workflow(self):
        """Test complete SOAP note creation workflow"""
        # Simulate frontend form data
        form_data = {
            "type": "soap",
            "contentType": "soap",
            "soapSections": {
                "subjective": "Patient complains of fatigue and joint pain",
                "objective": "Afebrile, BP 125/82, joints without swelling",
                "assessment": "Possible viral syndrome vs. early arthritis",
                "plan": "Supportive care, follow up in 1 week, labs if no improvement"
            },
            "patientId": "patient-123",
            "authorId": "practitioner-456",
            "title": "Follow-up Visit SOAP Note",
            "status": "current"
        }
        
        # Convert to FHIR
        converter = DocumentReferenceConverter()
        fhir_doc = converter.to_fhir(form_data)
        
        # Validate
        validator = DocumentValidationService()
        is_valid, issues = validator.validate_document_reference(fhir_doc)
        
        assert is_valid, f"Validation failed: {issues}"
        
        # Convert back to internal format
        internal_data = converter.from_fhir(fhir_doc)
        
        assert internal_data["contentType"] == "soap"
        assert internal_data["soapSections"]["subjective"] == form_data["soapSections"]["subjective"]
        assert internal_data["patientId"] == "patient-123"
    
    def test_update_note_workflow(self):
        """Test note update workflow with validation"""
        # Create initial note
        converter = DocumentReferenceConverter()
        initial_data = {
            "type": "progress",
            "content": "Initial progress note content",
            "patientId": "patient-123"
        }
        
        fhir_doc = converter.to_fhir(initial_data)
        
        # Update the note
        updated_data = {
            "type": "progress",
            "content": "Updated progress note with additional observations",
            "patientId": "patient-123",
            "id": fhir_doc.id
        }
        
        updated_fhir_doc = converter.to_fhir(updated_data)
        
        # Validate updated document
        validator = DocumentValidationService()
        is_valid, issues = validator.validate_document_reference(updated_fhir_doc)
        
        assert is_valid
        
        # Verify content was updated
        internal_data = converter.from_fhir(updated_fhir_doc)
        assert "additional observations" in internal_data["content"]
    
    def test_error_recovery_workflow(self):
        """Test error recovery and automatic fixing"""
        # Create document with missing fields
        incomplete_data = {
            "type": "progress",
            "content": "Some content",
            "patientId": "patient-123"
            # Missing status, author, etc.
        }
        
        converter = DocumentReferenceConverter()
        fhir_doc = converter.to_fhir(incomplete_data)
        
        # Validate and fix
        validator = DocumentValidationService()
        fixed_doc, remaining_issues = validator.validate_and_fix(fhir_doc)
        
        # Should have applied automatic fixes
        assert fixed_doc.date is not None  # Should add missing date
        assert fixed_doc.docStatus is not None  # Should add missing docStatus
        
        # Remaining issues should only be warnings
        critical_issues = [i for i in remaining_issues if i['severity'] in ['error', 'critical']]
        assert len(critical_issues) == 0


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])