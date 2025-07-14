"""
FHIR DocumentReference Converter

Handles conversion between FHIR DocumentReference resources and internal data models.
Used for clinical notes and documents.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import base64
import json
from core.fhir.resources_r4b import (
    DocumentReference, CodeableConcept, Coding, Reference, 
    Attachment, Identifier
)


class DocumentReferenceConverter:
    """Converter for FHIR DocumentReference resources"""
    
    # LOINC codes for common note types - synchronized with frontend
    NOTE_TYPE_CODES = {
        'progress': {'code': '11506-3', 'display': 'Progress note', 'system': 'http://loinc.org'},
        'history_physical': {'code': '34117-2', 'display': 'History and physical note', 'system': 'http://loinc.org'},
        'consultation': {'code': '11488-4', 'display': 'Consultation note', 'system': 'http://loinc.org'},
        'discharge': {'code': '18842-5', 'display': 'Discharge summary', 'system': 'http://loinc.org'},
        'operative': {'code': '11504-8', 'display': 'Surgical operation note', 'system': 'http://loinc.org'},
        'procedure': {'code': '28570-0', 'display': 'Procedure note', 'system': 'http://loinc.org'},
        'soap': {'code': '34109-9', 'display': 'Note', 'system': 'http://loinc.org'},
        'nursing': {'code': '34746-8', 'display': 'Nursing note', 'system': 'http://loinc.org'},
        'therapy': {'code': '28635-1', 'display': 'Physical therapy note', 'system': 'http://loinc.org'},
        'social_work': {'code': '34107-3', 'display': 'Social work note', 'system': 'http://loinc.org'},
        'imaging': {'code': '18748-4', 'display': 'Diagnostic imaging study', 'system': 'http://loinc.org'},
        'laboratory': {'code': '11502-2', 'display': 'Laboratory report', 'system': 'http://loinc.org'},
        'pathology': {'code': '11526-1', 'display': 'Pathology study', 'system': 'http://loinc.org'},
    }
    
    @staticmethod
    def to_fhir(data: Dict[str, Any]) -> DocumentReference:
        """Convert internal note data to FHIR DocumentReference"""
        
        # Get note type - handle both frontend 'type' and backend 'noteType' fields
        note_type = data.get('type', data.get('noteType', 'progress'))
        type_info = DocumentReferenceConverter.NOTE_TYPE_CODES.get(
            note_type, 
            DocumentReferenceConverter.NOTE_TYPE_CODES['progress']
        )
        
        # Prepare content first (required field)
        content_data = None
        content_type = data.get('contentType', 'text')
        
        if content_type == 'soap' and data.get('soapSections'):
            # SOAP format from frontend
            content_data = data['soapSections']
        elif content_type == 'text' and data.get('content'):
            # Plain text format
            content_data = data['content']
        elif data.get('content'):
            # Legacy format
            content_data = data['content']
        else:
            content_data = 'Empty document content'
        
        # Prepare content string and detect format
        if isinstance(content_data, dict):
            content_str = json.dumps(content_data)
            attachment_content_type = "application/json"
        else:
            content_str = str(content_data)
            # Check if string content is actually JSON
            try:
                parsed_test = json.loads(content_str)
                if isinstance(parsed_test, dict):
                    attachment_content_type = "application/json"
                else:
                    attachment_content_type = "text/plain"
            except (json.JSONDecodeError, ValueError):
                attachment_content_type = "text/plain"
        
        # Base64 encode the content
        encoded_content = base64.b64encode(content_str.encode('utf-8')).decode('utf-8')
        
        # Build DocumentReference with required fields using dict constructor
        doc_ref_dict = {
            "resourceType": "DocumentReference",
            "status": data.get('status', 'current'),
            "content": [
                {
                    "attachment": {
                        "contentType": attachment_content_type,
                        "data": encoded_content,
                        "title": data.get('title', f"{note_type.replace('_', ' ').title()} Note"),
                        "creation": data.get('createdAt', datetime.now().isoformat())
                    }
                }
            ]
        }
        
        # Add Type (required)
        doc_ref_dict["type"] = {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": type_info['code'],
                    "display": type_info['display']
                }
            ]
        }
        
        # Add Category (required for US Core)
        doc_ref_dict["category"] = [
            {
                "coding": [
                    {
                        "system": "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
                        "code": "clinical-note",
                        "display": "Clinical Note"
                    }
                ]
            }
        ]
        
        # Subject (Patient) - required field
        patient_id = data.get('patientId')
        if patient_id:
            doc_ref_dict["subject"] = {"reference": f"Patient/{patient_id}"}
        else:
            # FHIR requires subject, use placeholder if not provided
            doc_ref_dict["subject"] = {"reference": "Patient/unknown"}
        
        # Context (optional) - includes encounter references
        if data.get('encounterId'):
            doc_ref_dict["context"] = [{"reference": f"Encounter/{data['encounterId']}"}]
        
        # Date (required) - format as FHIR instant
        created_at = data.get('createdAt')
        if created_at:
            # Ensure proper FHIR instant format
            if isinstance(created_at, str):
                doc_ref_dict["date"] = created_at
            else:
                doc_ref_dict["date"] = created_at.isoformat() + 'Z'
        else:
            doc_ref_dict["date"] = datetime.now().isoformat() + 'Z'
        
        # Author - handle both frontend 'authorId' and backend 'createdBy' fields
        author_id = data.get('authorId', data.get('createdBy'))
        if author_id:
            doc_ref_dict["author"] = [{"reference": f"Practitioner/{author_id}"}]
        
        # Identifiers
        if data.get('id'):
            doc_ref_dict["identifier"] = [
                {
                    "system": "http://medgenemr.com/documentreference",
                    "value": str(data['id'])
                }
            ]
        
        # Document status - handle signNote from frontend
        if data.get('docStatus'):
            doc_ref_dict["docStatus"] = data['docStatus']
        elif data.get('signNote'):
            doc_ref_dict["docStatus"] = 'final'
        elif data.get('status') == 'final':
            doc_ref_dict["docStatus"] = 'final'
        else:
            doc_ref_dict["docStatus"] = 'preliminary'
        
        # Additional metadata
        if data.get('description'):
            doc_ref_dict["description"] = data['description']
        
        # Create DocumentReference from complete dict
        doc_ref = DocumentReference(**doc_ref_dict)
        return doc_ref
    
    @staticmethod
    def from_fhir(doc_ref: DocumentReference) -> Dict[str, Any]:
        """Convert FHIR DocumentReference to internal note format"""
        
        # Extract note type from coding
        note_type = 'progress'  # default
        if doc_ref.type and doc_ref.type.coding:
            code = doc_ref.type.coding[0].code
            for key, value in DocumentReferenceConverter.NOTE_TYPE_CODES.items():
                if value['code'] == code:
                    note_type = key
                    break
        
        # Extract content with enhanced format support
        content = {}
        content_type = 'text'
        soap_sections = {
            'subjective': '',
            'objective': '',
            'assessment': '',
            'plan': ''
        }
        
        if doc_ref.content and doc_ref.content[0].attachment:
            attachment = doc_ref.content[0].attachment
            if attachment.data:
                # Base64 decode
                decoded_content = base64.b64decode(attachment.data).decode('utf-8')
                
                if attachment.contentType == "application/json":
                    try:
                        parsed_content = json.loads(decoded_content)
                        
                        # Check for SOAP format
                        if (parsed_content.get('subjective') or parsed_content.get('objective') or 
                            parsed_content.get('assessment') or parsed_content.get('plan')):
                            content_type = 'soap'
                            soap_sections = {
                                'subjective': parsed_content.get('subjective', ''),
                                'objective': parsed_content.get('objective', ''),
                                'assessment': parsed_content.get('assessment', ''),
                                'plan': parsed_content.get('plan', '')
                            }
                            content = {'soapSections': soap_sections}
                        # Check for medical history format
                        elif (parsed_content.get('chiefComplaint') or parsed_content.get('historyOfPresentIllness') or 
                              parsed_content.get('pastMedicalHistory')):
                            content_type = 'medical-history'
                            # Convert medical history to readable format
                            sections = []
                            if parsed_content.get('chiefComplaint'): 
                                sections.append(f"Chief Complaint: {parsed_content['chiefComplaint']}")
                            if parsed_content.get('historyOfPresentIllness'): 
                                sections.append(f"History of Present Illness: {parsed_content['historyOfPresentIllness']}")
                            if parsed_content.get('pastMedicalHistory'): 
                                sections.append(f"Past Medical History: {parsed_content['pastMedicalHistory']}")
                            if parsed_content.get('medications'): 
                                sections.append(f"Medications: {parsed_content['medications']}")
                            if parsed_content.get('allergies'): 
                                sections.append(f"Allergies: {parsed_content['allergies']}")
                            if parsed_content.get('socialHistory'): 
                                sections.append(f"Social History: {parsed_content['socialHistory']}")
                            if parsed_content.get('familyHistory'): 
                                sections.append(f"Family History: {parsed_content['familyHistory']}")
                            content = {'text': '\n\n'.join(sections)}
                        # Check for text wrapper
                        elif parsed_content.get('text'):
                            content = {'text': parsed_content['text']}
                        else:
                            content = parsed_content
                    except json.JSONDecodeError:
                        content = {'text': decoded_content}
                else:
                    content = {'text': decoded_content}
        
        # Build internal representation with enhanced field mapping
        data = {
            'resourceType': 'DocumentReference',
            'id': doc_ref.id,
            'type': note_type,  # Use 'type' for frontend compatibility
            'noteType': note_type,  # Keep for backend compatibility
            'content': content.get('text', ''),
            'contentType': content_type,
            'soapSections': soap_sections if content_type == 'soap' else {
                'subjective': '',
                'objective': '',
                'assessment': '',
                'plan': ''
            },
            'status': doc_ref.status,
            'docStatus': doc_ref.docStatus,
            'signNote': doc_ref.docStatus == 'final',
            'createdAt': doc_ref.date,
            'date': doc_ref.date,  # Add for frontend compatibility
            'title': doc_ref.content[0].attachment.title if doc_ref.content and doc_ref.content[0].attachment else None,
        }
        
        # Extract references
        if doc_ref.subject and doc_ref.subject.reference:
            data['patientId'] = doc_ref.subject.reference.split('/')[-1]
        
        if doc_ref.context:
            for context_ref in doc_ref.context:
                if context_ref.reference and 'Encounter/' in context_ref.reference:
                    data['encounterId'] = context_ref.reference.split('/')[-1]
                    break
        
        if doc_ref.author and doc_ref.author[0].reference:
            author_id = doc_ref.author[0].reference.split('/')[-1]
            data['createdBy'] = author_id  # Backend compatibility
            data['authorId'] = author_id   # Frontend compatibility
        
        # Additional fields
        if doc_ref.description:
            data['description'] = doc_ref.description
        
        # Extract identifiers
        if doc_ref.identifier:
            for identifier in doc_ref.identifier:
                if identifier.system == "http://medgenemr.com/documentreference":
                    data['externalId'] = identifier.value
        
        return data
    
    @staticmethod
    def get_search_params() -> List[Dict[str, Any]]:
        """Get supported search parameters for DocumentReference"""
        return [
            {
                'name': 'patient',
                'type': 'reference',
                'documentation': 'Who/what is the subject of the document'
            },
            {
                'name': 'encounter',
                'type': 'reference',
                'documentation': 'Encounter related to the document'
            },
            {
                'name': 'type',
                'type': 'token',
                'documentation': 'Kind of document'
            },
            {
                'name': 'category',
                'type': 'token',
                'documentation': 'Categorization of document'
            },
            {
                'name': 'date',
                'type': 'date',
                'documentation': 'When this document reference was created'
            },
            {
                'name': 'author',
                'type': 'reference',
                'documentation': 'Who and/or what authored the document'
            },
            {
                'name': 'status',
                'type': 'token',
                'documentation': 'current | superseded | entered-in-error'
            },
            {
                'name': '_lastUpdated',
                'type': 'date',
                'documentation': 'When the resource version last changed'
            }
        ]