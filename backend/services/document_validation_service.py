"""
Document Validation Service

Provides comprehensive validation for DocumentReference resources
before they are stored in the database.
"""

import base64
import json
import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime
from fhir.resources.documentreference import DocumentReference
from fhir.resources.attachment import Attachment

logger = logging.getLogger(__name__)


class DocumentValidationError(Exception):
    """Raised when document validation fails"""
    def __init__(self, message: str, issues: List[Dict[str, Any]]):
        super().__init__(message)
        self.issues = issues


class DocumentValidationService:
    """Service for validating DocumentReference resources"""
    
    # Valid status values per FHIR R4
    VALID_STATUSES = ['current', 'superseded', 'entered-in-error']
    VALID_DOC_STATUSES = ['preliminary', 'final', 'amended', 'entered-in-error']
    
    # Required LOINC system
    LOINC_SYSTEM = 'http://loinc.org'
    
    @classmethod
    def validate_document_reference(cls, doc_ref: DocumentReference, 
                                  strict: bool = False) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Validate a DocumentReference resource
        
        Args:
            doc_ref: FHIR DocumentReference resource
            strict: If True, treat warnings as errors
            
        Returns:
            Tuple of (is_valid, issues_list)
        """
        issues = []
        
        # Validate required fields
        issues.extend(cls._validate_required_fields(doc_ref))
        
        # Validate field values
        issues.extend(cls._validate_field_values(doc_ref))
        
        # Validate content structure
        issues.extend(cls._validate_content(doc_ref))
        
        # Validate references
        issues.extend(cls._validate_references(doc_ref))
        
        # Determine if valid
        critical_issues = [i for i in issues if i['severity'] in ['error', 'critical']]
        warning_issues = [i for i in issues if i['severity'] == 'warning']
        
        is_valid = len(critical_issues) == 0 and (not strict or len(warning_issues) == 0)
        
        if issues:
            logger.info(f"DocumentReference validation found {len(issues)} issues: "
                       f"{len(critical_issues)} critical, {len(warning_issues)} warnings")
        
        return is_valid, issues
    
    @classmethod
    def _validate_required_fields(cls, doc_ref: DocumentReference) -> List[Dict[str, Any]]:
        """Validate required FHIR fields"""
        issues = []
        
        if not doc_ref.status:
            issues.append({
                'field': 'status',
                'severity': 'critical',
                'message': 'Missing required field: status',
                'code': 'MISSING_REQUIRED_FIELD'
            })
        
        if not doc_ref.type:
            issues.append({
                'field': 'type',
                'severity': 'critical',
                'message': 'Missing required field: type',
                'code': 'MISSING_REQUIRED_FIELD'
            })
        
        if not doc_ref.subject:
            issues.append({
                'field': 'subject',
                'severity': 'critical',
                'message': 'Missing required field: subject',
                'code': 'MISSING_REQUIRED_FIELD'
            })
        
        if not doc_ref.content or len(doc_ref.content) == 0:
            issues.append({
                'field': 'content',
                'severity': 'critical',
                'message': 'Missing required field: content',
                'code': 'MISSING_REQUIRED_FIELD'
            })
        
        # Recommended fields
        if not doc_ref.date:
            issues.append({
                'field': 'date',
                'severity': 'warning',
                'message': 'Missing recommended field: date',
                'code': 'MISSING_RECOMMENDED_FIELD'
            })
        
        if not doc_ref.author or len(doc_ref.author) == 0:
            issues.append({
                'field': 'author',
                'severity': 'warning',
                'message': 'Missing recommended field: author',
                'code': 'MISSING_RECOMMENDED_FIELD'
            })
        
        return issues
    
    @classmethod
    def _validate_field_values(cls, doc_ref: DocumentReference) -> List[Dict[str, Any]]:
        """Validate field values are within expected ranges"""
        issues = []
        
        # Validate status
        if doc_ref.status and doc_ref.status not in cls.VALID_STATUSES:
            issues.append({
                'field': 'status',
                'severity': 'error',
                'message': f'Invalid status: {doc_ref.status}. Must be one of: {cls.VALID_STATUSES}',
                'code': 'INVALID_FIELD_VALUE',
                'value': doc_ref.status
            })
        
        # Validate docStatus
        if doc_ref.docStatus and doc_ref.docStatus not in cls.VALID_DOC_STATUSES:
            issues.append({
                'field': 'docStatus',
                'severity': 'error',
                'message': f'Invalid docStatus: {doc_ref.docStatus}. Must be one of: {cls.VALID_DOC_STATUSES}',
                'code': 'INVALID_FIELD_VALUE',
                'value': doc_ref.docStatus
            })
        
        # Validate type coding
        if doc_ref.type and doc_ref.type.coding:
            for coding in doc_ref.type.coding:
                if coding.system == cls.LOINC_SYSTEM:
                    if not coding.code:
                        issues.append({
                            'field': 'type.coding.code',
                            'severity': 'error',
                            'message': 'LOINC coding missing code',
                            'code': 'MISSING_CODING_FIELD'
                        })
                    if not coding.display:
                        issues.append({
                            'field': 'type.coding.display',
                            'severity': 'warning',
                            'message': 'LOINC coding missing display',
                            'code': 'MISSING_CODING_FIELD'
                        })
        
        # Validate date format
        if doc_ref.date:
            try:
                # Try to parse as FHIR instant
                datetime.fromisoformat(doc_ref.date.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                issues.append({
                    'field': 'date',
                    'severity': 'error',
                    'message': f'Invalid date format: {doc_ref.date}',
                    'code': 'INVALID_DATE_FORMAT',
                    'value': doc_ref.date
                })
        
        return issues
    
    @classmethod
    def _validate_content(cls, doc_ref: DocumentReference) -> List[Dict[str, Any]]:
        """Validate content structure and data"""
        issues = []
        
        if not doc_ref.content or len(doc_ref.content) == 0:
            return issues  # Already handled in required fields
        
        for i, content in enumerate(doc_ref.content):
            content_path = f'content[{i}]'
            
            if not content.attachment:
                issues.append({
                    'field': f'{content_path}.attachment',
                    'severity': 'critical',
                    'message': 'Content item missing attachment',
                    'code': 'MISSING_ATTACHMENT'
                })
                continue
            
            attachment = content.attachment
            
            # Validate attachment data
            if not attachment.data and not attachment.url:
                issues.append({
                    'field': f'{content_path}.attachment',
                    'severity': 'critical',
                    'message': 'Attachment missing both data and url',
                    'code': 'MISSING_ATTACHMENT_CONTENT'
                })
            
            # Validate base64 data if present
            if attachment.data:
                validation_result = cls._validate_base64_data(attachment.data)
                if not validation_result['valid']:
                    issues.append({
                        'field': f'{content_path}.attachment.data',
                        'severity': 'critical',
                        'message': validation_result['error'],
                        'code': 'INVALID_BASE64_DATA'
                    })
            
            # Validate content type
            if not attachment.contentType:
                issues.append({
                    'field': f'{content_path}.attachment.contentType',
                    'severity': 'warning',
                    'message': 'Attachment missing contentType',
                    'code': 'MISSING_CONTENT_TYPE'
                })
            elif attachment.contentType not in ['text/plain', 'application/json', 'text/html']:
                issues.append({
                    'field': f'{content_path}.attachment.contentType',
                    'severity': 'warning',
                    'message': f'Unusual contentType: {attachment.contentType}',
                    'code': 'UNUSUAL_CONTENT_TYPE',
                    'value': attachment.contentType
                })
            
            # Validate JSON content if marked as JSON
            if (attachment.contentType == 'application/json' and attachment.data):
                try:
                    decoded = base64.b64decode(attachment.data).decode('utf-8')
                    json.loads(decoded)
                except json.JSONDecodeError as e:
                    issues.append({
                        'field': f'{content_path}.attachment.data',
                        'severity': 'error',
                        'message': f'Invalid JSON content: {e}',
                        'code': 'INVALID_JSON_CONTENT'
                    })
                except Exception as e:
                    issues.append({
                        'field': f'{content_path}.attachment.data',
                        'severity': 'error',
                        'message': f'Failed to decode content: {e}',
                        'code': 'CONTENT_DECODE_ERROR'
                    })
        
        return issues
    
    @classmethod
    def _validate_references(cls, doc_ref: DocumentReference) -> List[Dict[str, Any]]:
        """Validate reference fields"""
        issues = []
        
        # Validate subject reference
        if doc_ref.subject:
            if not doc_ref.subject.reference:
                issues.append({
                    'field': 'subject.reference',
                    'severity': 'error',
                    'message': 'Subject missing reference',
                    'code': 'MISSING_REFERENCE'
                })
            elif not doc_ref.subject.reference.startswith('Patient/'):
                issues.append({
                    'field': 'subject.reference',
                    'severity': 'error',
                    'message': f'Subject reference should start with "Patient/": {doc_ref.subject.reference}',
                    'code': 'INVALID_REFERENCE_TYPE',
                    'value': doc_ref.subject.reference
                })
        
        # Validate author references
        if doc_ref.author:
            for i, author in enumerate(doc_ref.author):
                if not author.reference:
                    issues.append({
                        'field': f'author[{i}].reference',
                        'severity': 'warning',
                        'message': 'Author missing reference',
                        'code': 'MISSING_REFERENCE'
                    })
                elif not (author.reference.startswith('Practitioner/') or 
                         author.reference.startswith('Organization/') or
                         author.reference.startswith('Device/')):
                    issues.append({
                        'field': f'author[{i}].reference',
                        'severity': 'warning',
                        'message': f'Unusual author reference type: {author.reference}',
                        'code': 'UNUSUAL_REFERENCE_TYPE',
                        'value': author.reference
                    })
        
        # Validate context references
        if doc_ref.context:
            for i, context in enumerate(doc_ref.context):
                if not context.reference:
                    issues.append({
                        'field': f'context[{i}].reference',
                        'severity': 'warning',
                        'message': 'Context missing reference',
                        'code': 'MISSING_REFERENCE'
                    })
        
        return issues
    
    @classmethod
    def _validate_base64_data(cls, data: str) -> Dict[str, Any]:
        """Validate base64 encoded data"""
        if not data or not isinstance(data, str):
            return {'valid': False, 'error': 'Data is not a string'}
        
        # Clean whitespace
        cleaned = data.replace(' ', '').replace('\n', '').replace('\r', '').replace('\t', '')
        
        # Check base64 format
        import re
        if not re.match(r'^[A-Za-z0-9+/]*={0,2}$', cleaned):
            return {'valid': False, 'error': 'Invalid base64 characters'}
        
        # Check length (must be multiple of 4)
        if len(cleaned) % 4 != 0:
            return {'valid': False, 'error': 'Invalid base64 length (must be multiple of 4)'}
        
        # Try to decode
        try:
            decoded = base64.b64decode(cleaned)
            if len(decoded) == 0:
                return {'valid': False, 'error': 'Base64 decodes to empty content'}
            
            # Try to decode as UTF-8
            try:
                decoded.decode('utf-8')
            except UnicodeDecodeError:
                return {'valid': False, 'error': 'Decoded content is not valid UTF-8'}
            
            return {'valid': True, 'error': None}
            
        except Exception as e:
            return {'valid': False, 'error': f'Base64 decoding failed: {e}'}
    
    @classmethod
    def validate_and_fix(cls, doc_ref: DocumentReference) -> Tuple[DocumentReference, List[Dict[str, Any]]]:
        """
        Validate and apply automatic fixes where possible
        
        Returns:
            Tuple of (fixed_document, remaining_issues)
        """
        # Make a copy to avoid modifying the original
        doc_data = doc_ref.dict()
        
        # Apply automatic fixes
        fixes_applied = []
        
        # Fix missing date
        if not doc_data.get('date'):
            doc_data['date'] = datetime.now().isoformat() + 'Z'
            fixes_applied.append({
                'field': 'date',
                'fix': 'Set to current timestamp',
                'value': doc_data['date']
            })
        
        # Fix missing docStatus
        if not doc_data.get('docStatus'):
            doc_data['docStatus'] = 'preliminary'
            fixes_applied.append({
                'field': 'docStatus',
                'fix': 'Set to preliminary',
                'value': 'preliminary'
            })
        
        # Fix content type if missing
        if doc_data.get('content'):
            for i, content in enumerate(doc_data['content']):
                if (content.get('attachment') and 
                    content['attachment'].get('data') and 
                    not content['attachment'].get('contentType')):
                    
                    # Try to detect content type from data
                    try:
                        decoded = base64.b64decode(content['attachment']['data']).decode('utf-8')
                        try:
                            json.loads(decoded)
                            content_type = 'application/json'
                        except json.JSONDecodeError:
                            content_type = 'text/plain'
                        
                        content['attachment']['contentType'] = content_type
                        fixes_applied.append({
                            'field': f'content[{i}].attachment.contentType',
                            'fix': f'Detected and set to {content_type}',
                            'value': content_type
                        })
                    except Exception:
                        content['attachment']['contentType'] = 'text/plain'
                        fixes_applied.append({
                            'field': f'content[{i}].attachment.contentType',
                            'fix': 'Set to text/plain (fallback)',
                            'value': 'text/plain'
                        })
        
        # Create fixed DocumentReference
        try:
            fixed_doc_ref = DocumentReference(**doc_data)
        except Exception as e:
            # If creation fails, return original with error
            return doc_ref, [{
                'field': 'document',
                'severity': 'critical',
                'message': f'Failed to create fixed document: {e}',
                'code': 'DOCUMENT_CREATION_ERROR'
            }]
        
        # Validate the fixed document
        is_valid, remaining_issues = cls.validate_document_reference(fixed_doc_ref)
        
        # Add fix information to issues
        for issue in remaining_issues:
            issue['fixes_applied'] = fixes_applied
        
        if fixes_applied:
            logger.info(f"Applied {len(fixes_applied)} automatic fixes to DocumentReference")
        
        return fixed_doc_ref, remaining_issues
    
    @classmethod
    def validate_before_save(cls, doc_ref: DocumentReference, auto_fix: bool = True) -> DocumentReference:
        """
        Validate a DocumentReference before saving to database
        
        Args:
            doc_ref: DocumentReference to validate
            auto_fix: Whether to apply automatic fixes
            
        Returns:
            Validated (and possibly fixed) DocumentReference
            
        Raises:
            DocumentValidationError: If validation fails
        """
        if auto_fix:
            fixed_doc_ref, issues = cls.validate_and_fix(doc_ref)
        else:
            fixed_doc_ref = doc_ref
            is_valid, issues = cls.validate_document_reference(doc_ref)
        
        # Check for critical issues
        critical_issues = [i for i in issues if i['severity'] in ['error', 'critical']]
        
        if critical_issues:
            raise DocumentValidationError(
                f"DocumentReference validation failed with {len(critical_issues)} critical issues",
                critical_issues
            )
        
        # Log warnings
        warnings = [i for i in issues if i['severity'] == 'warning']
        if warnings:
            logger.warning(f"DocumentReference has {len(warnings)} validation warnings")
            for warning in warnings:
                logger.warning(f"  {warning['field']}: {warning['message']}")
        
        return fixed_doc_ref