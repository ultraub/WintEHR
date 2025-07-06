"""
FHIR DocumentReference Converter

Handles conversion between FHIR DocumentReference resources and internal data models.
Used for clinical notes and documents.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import base64
import json
from fhir.resources.documentreference import DocumentReference
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.coding import Coding
from fhir.resources.reference import Reference
from fhir.resources.attachment import Attachment
from fhir.resources.documentreference import DocumentReferenceContent
from fhir.resources.identifier import Identifier


class DocumentReferenceConverter:
    """Converter for FHIR DocumentReference resources"""
    
    # LOINC codes for common note types
    NOTE_TYPE_CODES = {
        'progress': {'code': '11506-3', 'display': 'Progress note'},
        'history_physical': {'code': '34117-2', 'display': 'History and physical note'},
        'consultation': {'code': '11488-4', 'display': 'Consultation note'},
        'discharge': {'code': '18842-5', 'display': 'Discharge summary'},
        'operative': {'code': '11504-8', 'display': 'Surgical operation note'},
        'procedure': {'code': '28570-0', 'display': 'Procedure note'},
        'imaging': {'code': '18748-4', 'display': 'Diagnostic imaging study'},
        'laboratory': {'code': '11502-2', 'display': 'Laboratory report'},
        'pathology': {'code': '11526-1', 'display': 'Pathology study'},
    }
    
    @staticmethod
    def to_fhir(data: Dict[str, Any]) -> DocumentReference:
        """Convert internal note data to FHIR DocumentReference"""
        
        # Get note type
        note_type = data.get('noteType', 'progress')
        type_info = DocumentReferenceConverter.NOTE_TYPE_CODES.get(
            note_type, 
            DocumentReferenceConverter.NOTE_TYPE_CODES['progress']
        )
        
        # Build DocumentReference
        doc_ref = DocumentReference()
        
        # Required fields
        doc_ref.status = data.get('status', 'current')
        
        # Type
        doc_ref.type = CodeableConcept()
        doc_ref.type.coding = [Coding()]
        doc_ref.type.coding[0].system = "http://loinc.org"
        doc_ref.type.coding[0].code = type_info['code']
        doc_ref.type.coding[0].display = type_info['display']
        
        # Category
        doc_ref.category = [CodeableConcept()]
        doc_ref.category[0].coding = [Coding()]
        doc_ref.category[0].coding[0].system = "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category"
        doc_ref.category[0].coding[0].code = "clinical-note"
        doc_ref.category[0].coding[0].display = "Clinical Note"
        
        # Subject (Patient)
        if data.get('patientId'):
            doc_ref.subject = Reference()
            doc_ref.subject.reference = f"Patient/{data['patientId']}"
        
        # Encounter
        if data.get('encounterId'):
            doc_ref.encounter = Reference()
            doc_ref.encounter.reference = f"Encounter/{data['encounterId']}"
        
        # Date
        doc_ref.date = data.get('createdAt', datetime.now().isoformat())
        
        # Author
        if data.get('createdBy'):
            doc_ref.author = [Reference()]
            doc_ref.author[0].reference = f"Practitioner/{data['createdBy']}"
        
        # Content
        content_data = data.get('content', {})
        if isinstance(content_data, dict):
            # SOAP note or structured content
            content_str = json.dumps(content_data)
        else:
            # Plain text
            content_str = str(content_data)
        
        # Base64 encode the content
        encoded_content = base64.b64encode(content_str.encode('utf-8')).decode('utf-8')
        
        doc_ref.content = [DocumentReferenceContent()]
        doc_ref.content[0].attachment = Attachment()
        doc_ref.content[0].attachment.contentType = "application/json" if isinstance(content_data, dict) else "text/plain"
        doc_ref.content[0].attachment.data = encoded_content
        doc_ref.content[0].attachment.title = data.get('title', f"{note_type.replace('_', ' ').title()} Note")
        
        # Identifiers
        if data.get('id'):
            doc_ref.identifier = [Identifier()]
            doc_ref.identifier[0].system = "http://medgenemr.com/documentreference"
            doc_ref.identifier[0].value = str(data['id'])
        
        # Document status
        if data.get('docStatus'):
            doc_ref.docStatus = data['docStatus']
        elif data.get('status') == 'final':
            doc_ref.docStatus = 'final'
        else:
            doc_ref.docStatus = 'preliminary'
        
        # Additional metadata
        if data.get('description'):
            doc_ref.description = data['description']
        
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
        
        # Extract content
        content = {}
        if doc_ref.content and doc_ref.content[0].attachment:
            attachment = doc_ref.content[0].attachment
            if attachment.data:
                # Base64 decode
                decoded_content = base64.b64decode(attachment.data).decode('utf-8')
                if attachment.contentType == "application/json":
                    try:
                        content = json.loads(decoded_content)
                    except json.JSONDecodeError:
                        content = {'text': decoded_content}
                else:
                    content = {'text': decoded_content}
        
        # Build internal representation
        data = {
            'resourceType': 'DocumentReference',
            'id': doc_ref.id,
            'noteType': note_type,
            'content': content,
            'status': doc_ref.status,
            'docStatus': doc_ref.docStatus,
            'createdAt': doc_ref.date,
            'title': doc_ref.content[0].attachment.title if doc_ref.content and doc_ref.content[0].attachment else None,
        }
        
        # Extract references
        if doc_ref.subject and doc_ref.subject.reference:
            data['patientId'] = doc_ref.subject.reference.split('/')[-1]
        
        if doc_ref.encounter and doc_ref.encounter.reference:
            data['encounterId'] = doc_ref.encounter.reference.split('/')[-1]
        
        if doc_ref.author and doc_ref.author[0].reference:
            data['createdBy'] = doc_ref.author[0].reference.split('/')[-1]
        
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