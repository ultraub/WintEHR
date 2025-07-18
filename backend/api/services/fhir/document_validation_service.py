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
from fhir.core.resources_r4b import DocumentReference, Attachment

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
    
    @staticmethod
    def _safe_get_attr(obj, attr_path):
        """
        Safely get nested attributes from an object that might contain dicts or objects
        
        Args:
            obj: The object to get attributes from
            attr_path: Dot-separated path like 'type.coding'
            
        Returns:
            The value if found, None otherwise
        """
        try:
            current = obj
            for attr in attr_path.split('.'):
                if hasattr(current, attr):
                    current = getattr(current, attr)
                elif isinstance(current, dict) and attr in current:
                    current = current[attr]
                else:
                    return None
            return current
        except Exception:
            return None
    
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
        type_coding = cls._safe_get_attr(doc_ref, 'type.coding')
        if type_coding:
            for coding in type_coding:
                # Handle both object and dict coding
                coding_system = coding.get('system') if isinstance(coding, dict) else getattr(coding, 'system', None)
                coding_code = coding.get('code') if isinstance(coding, dict) else getattr(coding, 'code', None)
                coding_display = coding.get('display') if isinstance(coding, dict) else getattr(coding, 'display', None)
                
                if coding_system == cls.LOINC_SYSTEM:
                    if not coding_code:
                        issues.append({
                            'field': 'type.coding.code',
                            'severity': 'error',
                            'message': 'LOINC coding missing code',
                            'code': 'MISSING_CODING_FIELD'
                        })
                    if not coding_display:
                        issues.append({
                            'field': 'type.coding.display',
                            'severity': 'warning',
                            'message': 'LOINC coding missing display',
                            'code': 'MISSING_CODING_FIELD'
                        })
        
        # Validate date format
        if doc_ref.date:
            try:
                # Get the date string - handle both string and FHIR date object
                date_str = str(doc_ref.date) if not isinstance(doc_ref.date, str) else doc_ref.date
                # Try to parse as FHIR instant
                datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except (ValueError, AttributeError, TypeError) as e:
                issues.append({
                    'field': 'date',
                    'severity': 'error',
                    'message': f'Invalid date format: {doc_ref.date}',
                    'code': 'INVALID_DATE_FORMAT',
                    'value': str(doc_ref.date)
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
            
            # Handle both object and dict content
            attachment = content.get('attachment') if isinstance(content, dict) else getattr(content, 'attachment', None)
            
            if not attachment:
                issues.append({
                    'field': f'{content_path}.attachment',
                    'severity': 'critical',
                    'message': 'Content item missing attachment',
                    'code': 'MISSING_ATTACHMENT'
                })
                continue
            
            # Handle both object and dict attachment
            attachment_data = attachment.get('data') if isinstance(attachment, dict) else getattr(attachment, 'data', None)
            attachment_url = attachment.get('url') if isinstance(attachment, dict) else getattr(attachment, 'url', None)
            attachment_content_type = attachment.get('contentType') if isinstance(attachment, dict) else getattr(attachment, 'contentType', None)
            
            # Validate attachment data
            if not attachment_data and not attachment_url:
                issues.append({
                    'field': f'{content_path}.attachment',
                    'severity': 'critical',
                    'message': 'Attachment missing both data and url',
                    'code': 'MISSING_ATTACHMENT_CONTENT'
                })
            
            # Validate base64 data if present
            if attachment_data:
                validation_result = cls._validate_base64_data(attachment_data)
                if not validation_result['valid']:
                    issues.append({
                        'field': f'{content_path}.attachment.data',
                        'severity': 'critical',
                        'message': validation_result['error'],
                        'code': 'INVALID_BASE64_DATA'
                    })
            
            # Validate content type
            if not attachment_content_type:
                issues.append({
                    'field': f'{content_path}.attachment.contentType',
                    'severity': 'warning',
                    'message': 'Attachment missing contentType',
                    'code': 'MISSING_CONTENT_TYPE'
                })
            elif attachment_content_type not in ['text/plain', 'application/json', 'text/html']:
                issues.append({
                    'field': f'{content_path}.attachment.contentType',
                    'severity': 'warning',
                    'message': f'Unusual contentType: {attachment_content_type}',
                    'code': 'UNUSUAL_CONTENT_TYPE',
                    'value': attachment_content_type
                })
            
            # Validate JSON content if marked as JSON
            if (attachment_content_type == 'application/json' and attachment_data):
                try:
                    decoded = base64.b64decode(attachment_data).decode('utf-8')
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
            # Handle both object and dict subject
            subject_reference = doc_ref.subject.get('reference') if isinstance(doc_ref.subject, dict) else getattr(doc_ref.subject, 'reference', None)
            
            if not subject_reference:
                issues.append({
                    'field': 'subject.reference',
                    'severity': 'error',
                    'message': 'Subject missing reference',
                    'code': 'MISSING_REFERENCE'
                })
            elif not subject_reference.startswith('Patient/'):
                issues.append({
                    'field': 'subject.reference',
                    'severity': 'error',
                    'message': f'Subject reference should start with "Patient/": {subject_reference}',
                    'code': 'INVALID_REFERENCE_TYPE',
                    'value': subject_reference
                })
        
        # Validate author references
        if doc_ref.author:
            for i, author in enumerate(doc_ref.author):
                # Handle both object and dict author
                author_reference = author.get('reference') if isinstance(author, dict) else getattr(author, 'reference', None)
                
                if not author_reference:
                    issues.append({
                        'field': f'author[{i}].reference',
                        'severity': 'warning',
                        'message': 'Author missing reference',
                        'code': 'MISSING_REFERENCE'
                    })
                elif not (author_reference.startswith('Practitioner/') or 
                         author_reference.startswith('Organization/') or
                         author_reference.startswith('Device/')):
                    issues.append({
                        'field': f'author[{i}].reference',
                        'severity': 'warning',
                        'message': f'Unusual author reference type: {author_reference}',
                        'code': 'UNUSUAL_REFERENCE_TYPE',
                        'value': author_reference
                    })
        
        # Validate context references
        if hasattr(doc_ref, 'context') and doc_ref.context:
            for i, context in enumerate(doc_ref.context):
                # Handle both object and dict context
                context_reference = context.get('reference') if isinstance(context, dict) else getattr(context, 'reference', None)
                
                if not context_reference:
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
        logger.info("Starting validate_and_fix for DocumentReference")
        
        try:
            # Convert to dict for modification
            # Handle different FHIR library versions and types
            if isinstance(doc_ref, dict):
                # Already a dict, use directly
                doc_data = doc_ref.copy()
            elif hasattr(doc_ref, 'json') and callable(doc_ref.json):
                # In our custom resources_r4b.py, json() returns a dict, not a JSON string
                # Try with exclude_none parameter first (older versions)
                try:
                    doc_data = doc_ref.json(exclude_none=True)
                except TypeError:
                    # Fallback for newer versions that don't support exclude_none
                    doc_data = doc_ref.json()
                except Exception:
                    # Last resort - try dict() method
                    try:
                        doc_data = doc_ref.dict(exclude_none=True)
                    except Exception:
                        doc_data = doc_ref.dict()
            elif hasattr(doc_ref, 'dict') and callable(doc_ref.dict):
                # Use dict() method
                try:
                    doc_data = doc_ref.dict(exclude_none=True)
                except TypeError:
                    doc_data = doc_ref.dict()
            else:
                # Convert object to dict manually
                doc_data = {}
                for attr in dir(doc_ref):
                    if not attr.startswith('_') and hasattr(doc_ref, attr):
                        value = getattr(doc_ref, attr)
                        if not callable(value):
                            doc_data[attr] = value
            
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
            
            # Ensure resourceType is present
            doc_data['resourceType'] = 'DocumentReference'
            
            # Check for any string fields that should be integers
            def check_integer_fields(data, path=''):
                if isinstance(data, dict):
                    for key, value in data.items():
                        new_path = f"{path}.{key}" if path else key
                        if isinstance(value, str) and value.isdigit():
                            logger.warning(f"Found numeric string at {new_path}: '{value}'")
                        elif isinstance(value, (dict, list)):
                            check_integer_fields(value, new_path)
                elif isinstance(data, list):
                    for i, item in enumerate(data):
                        check_integer_fields(item, f"{path}[{i}]")
            
            check_integer_fields(doc_data)
            
            # Remove resourceType before creating the object
            doc_data_for_creation = doc_data.copy()
            doc_data_for_creation.pop('resourceType', None)
            
            # Log the data before creating DocumentReference
            logger.info(f"Creating DocumentReference with data keys: {list(doc_data_for_creation.keys())}")
            
            # Create new DocumentReference from modified data
            fixed_doc_ref = DocumentReference(**doc_data_for_creation)
            
            # Validate the document
            is_valid, remaining_issues = cls.validate_document_reference(fixed_doc_ref)
            
            # Add fix information to issues
            for issue in remaining_issues:
                issue['fixes_applied'] = fixes_applied
            
            if fixes_applied:
                logger.info(f"Applied {len(fixes_applied)} automatic fixes to DocumentReference")
            
            return fixed_doc_ref, remaining_issues
            
        except Exception as e:
            logger.error(f"Error in validate_and_fix: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            if hasattr(e, '__traceback__'):
                import traceback
                logger.error(f"Traceback: {''.join(traceback.format_tb(e.__traceback__))}")
            
            # Return original with error
            return doc_ref, [{
                'field': 'document',
                'severity': 'critical',
                'message': f'Failed to validate document: {e}',
                'code': 'DOCUMENT_VALIDATION_ERROR'
            }]
    
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
        try:
            # For now, just ensure critical fields are present
            if not doc_ref.status:
                raise DocumentValidationError("Missing required field: status", [])
            
            if not doc_ref.content or len(doc_ref.content) == 0:
                raise DocumentValidationError("Missing required field: content", [])
            
            if not doc_ref.subject:
                raise DocumentValidationError("Missing required field: subject", [])
            
            # If we reach here, validation passed
            logger.info("DocumentReference basic validation passed")
            return doc_ref
            
        except Exception as e:
            logger.error(f"DocumentReference validation error: {e}")
            raise