"""
FHIR Resource Storage Engine

Handles storage and retrieval of FHIR resources using PostgreSQL JSONB.
Implements versioning, history tracking, and search parameter extraction.
"""

import json
import uuid
import re
import logging
from decimal import Decimal
from datetime import datetime, timezone, date
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from fhir.core.resources_r4b import (
    construct_fhir_element, Bundle, BundleEntry, BundleEntryRequest, 
    BundleEntryResponse, OperationOutcome, OperationOutcomeIssue
)

from fhir.core.validators.synthea import SyntheaFHIRValidator
from fhir.core.reference_utils import ReferenceUtils
from fhir.core.versioning.negotiator import FHIRVersion, version_negotiator
from fhir.core.versioning.transformer import fhir_transformer
try:
    from api.websocket.fhir_notifications import notification_service
except ImportError:
    notification_service = None


class ConditionalCreateExistingResource(Exception):
    """Raised when conditional create finds an existing resource."""
    def __init__(self, fhir_id: str, version_id: int, last_updated: datetime):
        self.fhir_id = fhir_id
        self.version_id = version_id
        self.last_updated = last_updated
        super().__init__(f"Resource already exists: {fhir_id}")


class FHIRJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for FHIR resources that handles date/datetime objects and Decimal types."""
    
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        # Handle Decimal types for monetary amounts and measurements
        if isinstance(obj, Decimal):
            return float(obj)
        # Handle bytes (base64 encoded data)
        if isinstance(obj, bytes):
            import base64
            return base64.b64encode(obj).decode('utf-8')
        return super().default(obj)


class FHIRStorageEngine:
    """Core storage engine for FHIR resources."""
    
    def __init__(self, session: AsyncSession, default_version: FHIRVersion = FHIRVersion.R4):
        self.session = session
        self.validator = SyntheaFHIRValidator()
        self.default_version = default_version
        self.version_negotiator = version_negotiator
        self.version_transformer = fhir_transformer
    
    def _get_search_parameter_definitions(self) -> Dict[str, Dict]:
        """Get search parameter definitions for all resource types."""
        return {
            'Patient': {
                'identifier': {'type': 'token'},
                'name': {'type': 'string'},
                'family': {'type': 'string'},
                'given': {'type': 'string'},
                'gender': {'type': 'token'},
                'birthdate': {'type': 'date'},
                'address': {'type': 'string'},
                'phone': {'type': 'token'},
                'email': {'type': 'token'}
            },
            'Observation': {
                'code': {'type': 'token'},
                'category': {'type': 'token'},
                'value-quantity': {'type': 'quantity'},
                'date': {'type': 'date'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'performer': {'type': 'reference'},
                'status': {'type': 'token'},
                'based-on': {'type': 'reference'},  # Added for Phase 1-3 features
                'code-value-quantity': {'type': 'composite'},  # Composite parameter
                'component-code-value-quantity': {'type': 'composite'}  # Composite parameter
            },
            'Condition': {
                'code': {'type': 'token'},
                'clinical-status': {'type': 'token'},
                'severity': {'type': 'token'},
                'onset-date': {'type': 'date'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'encounter': {'type': 'reference'}
            },
            'Medication': {
                'code': {'type': 'token'},
                'status': {'type': 'token'},
                'form': {'type': 'token'}
            },
            'MedicationRequest': {
                'medication': {'type': 'token'},  # FHIR R4 compliant parameter
                'code': {'type': 'token'},        # Keep for backward compatibility
                'status': {'type': 'token'},
                'intent': {'type': 'token'},
                'identifier': {'type': 'token'},
                'patient': {'type': 'reference'},
                'subject': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'requester': {'type': 'reference'},
                'performer': {'type': 'reference'},
                'authoredon': {'type': 'date'}
            },
            'MedicationDispense': {
                'identifier': {'type': 'token'},
                'status': {'type': 'token'},
                'patient': {'type': 'reference'},
                'subject': {'type': 'reference'},
                'context': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'medication': {'type': 'token'},
                'code': {'type': 'token'},
                'performer': {'type': 'reference'},
                'receiver': {'type': 'reference'},
                'destination': {'type': 'reference'},
                'responsibleparty': {'type': 'reference'},
                'prescription': {'type': 'reference'},
                'type': {'type': 'token'},
                'whenhandedover': {'type': 'date'},
                'whenprepared': {'type': 'date'}
            },
            'MedicationAdministration': {
                'identifier': {'type': 'token'},
                'status': {'type': 'token'},
                'patient': {'type': 'reference'},
                'subject': {'type': 'reference'},
                'context': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'effective-time': {'type': 'date'},
                'medication': {'type': 'token'},
                'code': {'type': 'token'},
                'performer': {'type': 'reference'},
                'device': {'type': 'reference'},
                'request': {'type': 'reference'},
                'reason-given': {'type': 'token'},
                'reason-not-given': {'type': 'token'}
            },
            'Encounter': {
                'status': {'type': 'token'},
                'class': {'type': 'token'},
                'type': {'type': 'token'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'participant': {'type': 'reference'},
                'practitioner': {'type': 'reference'},
                'date': {'type': 'date'},
                'period': {'type': 'date'}
            },
            'Practitioner': {
                'name': {'type': 'string'},
                'family': {'type': 'string'},
                'given': {'type': 'string'},
                'identifier': {'type': 'token'},
                'active': {'type': 'token'},
                'email': {'type': 'token'},
                'phone': {'type': 'token'},
                'telecom': {'type': 'token'},
                'address': {'type': 'string'},
                'address-city': {'type': 'string'},
                'address-state': {'type': 'string'},
                'gender': {'type': 'token'},
                'communication': {'type': 'token'}
            },
            'Organization': {
                'name': {'type': 'string'},
                'identifier': {'type': 'token'},
                'type': {'type': 'token'},
                'active': {'type': 'token'},
                'partof': {'type': 'reference'},
                'address': {'type': 'string'},
                'address-city': {'type': 'string'},
                'endpoint': {'type': 'reference'}
            },
            'PractitionerRole': {
                'identifier': {'type': 'token'},
                'practitioner': {'type': 'reference'},
                'organization': {'type': 'reference'},
                'location': {'type': 'reference'},
                'specialty': {'type': 'token'},
                'role': {'type': 'token'},
                'service': {'type': 'reference'},
                'active': {'type': 'token'},
                'date': {'type': 'date'},
                'period': {'type': 'date'},
                'endpoint': {'type': 'reference'}
            },
            'Location': {
                'identifier': {'type': 'token'},
                'name': {'type': 'string'},
                'address': {'type': 'string'},
                'address-city': {'type': 'string'},
                'address-state': {'type': 'string'},
                'address-postalcode': {'type': 'string'},
                'organization': {'type': 'reference'},
                'partof': {'type': 'reference'},
                'status': {'type': 'token'},
                'type': {'type': 'token'},
                'near': {'type': 'special'},
                'endpoint': {'type': 'reference'}
            },
            'Procedure': {
                'code': {'type': 'token'},
                'status': {'type': 'token'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'performer': {'type': 'reference'},
                'date': {'type': 'date'},
                'performed': {'type': 'date'}
            },
            'AllergyIntolerance': {
                'code': {'type': 'token'},
                'clinical-status': {'type': 'token'},
                'verification-status': {'type': 'token'},
                'criticality': {'type': 'token'},
                'type': {'type': 'token'},
                'category': {'type': 'token'},
                'patient': {'type': 'reference'},
                'date': {'type': 'date'}
            },
            'Immunization': {
                'vaccine-code': {'type': 'token'},
                'status': {'type': 'token'},
                'patient': {'type': 'reference'},
                'performer': {'type': 'reference'},
                'date': {'type': 'date'},
                'encounter': {'type': 'reference'}
            },
            'DiagnosticReport': {
                'code': {'type': 'token'},
                'status': {'type': 'token'},
                'category': {'type': 'token'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'performer': {'type': 'reference'},
                'date': {'type': 'date'},
                'issued': {'type': 'date'}
            },
            'ImagingStudy': {
                'status': {'type': 'token'},
                'modality': {'type': 'token'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'performer': {'type': 'reference'},
                'started': {'type': 'date'}
            },
            'DocumentReference': {
                # Core search parameters
                'patient': {'type': 'reference'},
                'subject': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'type': {'type': 'token'},
                'category': {'type': 'token'},
                'date': {'type': 'date'},
                'author': {'type': 'reference'},
                'status': {'type': 'token'},
                'doc-status': {'type': 'token'},
                'identifier': {'type': 'token'},
                'description': {'type': 'string'},
                # Enhanced search parameters
                'facility': {'type': 'token'},
                'period': {'type': 'date'},
                'relatesto': {'type': 'reference'},
                'security-label': {'type': 'token'},
                'content-format': {'type': 'token'},
                'content-size': {'type': 'quantity'},
                # Clinical workflow parameters
                'custodian': {'type': 'reference'},
                'authenticator': {'type': 'reference'},
                'event': {'type': 'token'}
            },
            'Communication': {
                # Core FHIR R4 search parameters
                'category': {'type': 'token'},
                'encounter': {'type': 'reference'},
                'identifier': {'type': 'token'},
                'medium': {'type': 'token'},
                'received': {'type': 'date'},
                'recipient': {'type': 'reference'},
                'sender': {'type': 'reference'},
                'sent': {'type': 'date'},
                'status': {'type': 'token'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'priority': {'type': 'token'},
                # Workflow and threading parameters
                'based-on': {'type': 'reference'},
                'part-of': {'type': 'reference'},
                'reason-reference': {'type': 'reference'},
                'reason-code': {'type': 'token'},
                # Context parameters
                'context': {'type': 'reference'},
                'payload-content': {'type': 'string'}
            },
            'Task': {
                # Core FHIR R4 search parameters
                'status': {'type': 'token'},
                'business-status': {'type': 'token'},
                'code': {'type': 'token'},
                'focus': {'type': 'reference'},
                'for': {'type': 'reference'},
                'identifier': {'type': 'token'},
                'owner': {'type': 'reference'},
                'part-of': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'performer': {'type': 'reference'},
                'requester': {'type': 'reference'},
                'subject': {'type': 'reference'},
                # Date and timing parameters
                'authored-on': {'type': 'date'},
                'modified': {'type': 'date'},
                'period': {'type': 'date'},
                # Workflow parameters
                'priority': {'type': 'token'},
                'intent': {'type': 'token'},
                'group-identifier': {'type': 'token'},
                'based-on': {'type': 'reference'},
                'reason-code': {'type': 'token'},
                'reason-reference': {'type': 'reference'},
                # Context parameters
                'encounter': {'type': 'reference'},
                'location': {'type': 'reference'}
            },
            'Bundle': {
                # Bundle search parameters
                'type': {'type': 'token'},
                'identifier': {'type': 'token'},
                'timestamp': {'type': 'date'},
                'total': {'type': 'number'},
                'composition': {'type': 'reference'},
                'message': {'type': 'reference'}
            },
            'OperationOutcome': {
                # OperationOutcome search parameters
                'severity': {'type': 'token'},
                'code': {'type': 'token'},
                'details': {'type': 'token'},
                'diagnostics': {'type': 'string'},
                'expression': {'type': 'string'},
                'location': {'type': 'string'}
            },
            'Parameters': {
                # Core Parameters search parameters
                'name': {'type': 'string'},
                'value': {'type': 'string'},
                'identifier': {'type': 'token'},
                
                # Extended Parameters search parameters for FHIR operations
                'parameter': {'type': 'string'},  # Parameter name search
                'value-string': {'type': 'string'},  # String parameter values
                'value-boolean': {'type': 'token'},  # Boolean parameter values  
                'value-integer': {'type': 'number'},  # Integer parameter values
                'value-decimal': {'type': 'number'},  # Decimal parameter values
                'value-date': {'type': 'date'},  # Date parameter values
                'value-time': {'type': 'date'},  # Time parameter values
                'value-datetime': {'type': 'date'},  # DateTime parameter values
                'value-code': {'type': 'token'},  # Code parameter values
                'value-uri': {'type': 'uri'},  # URI parameter values
                'value-reference': {'type': 'reference'},  # Reference parameter values
                'value-quantity': {'type': 'quantity'},  # Quantity parameter values
                
                # Meta search parameters for operation tracking
                'operation': {'type': 'string'},  # Operation name context
                'context': {'type': 'string'},  # Operation context
                'source': {'type': 'reference'},  # Source resource reference
                'target': {'type': 'reference'}  # Target resource reference
            }
        }
    
    async def create_resource(
        self,
        resource_type: str,
        resource_data: Dict[str, Any],
        if_none_exist: Optional[str] = None,
        target_version: Optional[FHIRVersion] = None
    ) -> Tuple[str, int, datetime]:
        """
        Create a new FHIR resource.
        
        Args:
            resource_type: FHIR resource type (e.g., 'Patient', 'Observation')
            resource_data: FHIR resource data as dictionary
            if_none_exist: Conditional create search criteria
            
        Returns:
            Tuple of (fhir_id, version_id, last_updated)
        """
        
        # Handle FHIR version transformation
        if target_version is None:
            target_version = self.default_version
        
        # Detect source version and transform if needed
        detection_result = self.version_negotiator.detect_version_from_resource(resource_data)
        if detection_result.detected_version != target_version:
            transformation_result = self.version_transformer.transform_resource(
                resource_data, target_version, detection_result.detected_version
            )
            if transformation_result.success:
                resource_data = transformation_result.transformed_resource
                logging.info(f"Transformed {resource_type} from {detection_result.detected_version.value} "
                           f"to {target_version.value}")
            else:
                logging.warning(f"Version transformation failed: {transformation_result.warnings}")
        
        # Validate resource
        try:
            # Ensure resourceType is set
            if 'resourceType' not in resource_data:
                resource_data['resourceType'] = resource_type
            
            # Preprocess with SyntheaFHIRValidator before validation
            resource_data = self.validator._preprocess_synthea_resource(resource_type, resource_data)
            
            logging.info(f"Attempting to construct FHIR element for {resource_type}")
            logging.debug(f"Resource data: {json.dumps(resource_data, indent=2, default=str)}")
            
            try:
                # Special handling for DocumentReference to check for integer issues
                if resource_type == 'DocumentReference':
                    # Remove resourceType before construction as it's not a field
                    resource_data_for_construction = resource_data.copy()
                    resource_data_for_construction.pop('resourceType', None)
                    
                    # Check for numeric strings in the data
                    def check_and_fix_integers(data, path=''):
                        if isinstance(data, dict):
                            for key, value in data.items():
                                new_path = f"{path}.{key}" if path else key
                                if isinstance(value, str) and value.isdigit():
                                    logging.warning(f"Found numeric string at {new_path}: '{value}'")
                                    # Convert known integer fields
                                    if key in ['size', 'height', 'width', 'pages', 'frames']:
                                        data[key] = int(value)
                                        logging.info(f"Converted {new_path} from string '{value}' to int {data[key]}")
                                elif isinstance(value, (dict, list)):
                                    check_and_fix_integers(value, new_path)
                        elif isinstance(data, list):
                            for i, item in enumerate(data):
                                check_and_fix_integers(item, f"{path}[{i}]")
                    
                    check_and_fix_integers(resource_data_for_construction)
                    fhir_resource = construct_fhir_element(resource_type, resource_data_for_construction)
                else:
                    fhir_resource = construct_fhir_element(resource_type, resource_data)
                    
                logging.info(f"Successfully constructed FHIR element for {resource_type}")
            except Exception as construction_error:
                logging.error(f"Failed to construct FHIR element: {construction_error}")
                logging.error(f"Error type: {type(construction_error).__name__}")
                if hasattr(construction_error, 'errors') and callable(construction_error.errors):
                    try:
                        errors = construction_error.errors()
                        logging.error(f"Validation errors: {json.dumps(errors, indent=2, default=str)}")
                    except:
                        pass
                logging.error(f"Resource data that failed construction: {json.dumps(resource_data, indent=2, default=str)}")
                raise ValueError(f"Failed to construct {resource_type}: {str(construction_error)}")
            
            # Apply DocumentReference-specific validation
            if resource_type == 'DocumentReference':
                logging.info("=== DOCUMENTREFERENCE VALIDATION START ===")
                from api.services.fhir.document_validation_service import DocumentValidationService
                try:
                    fhir_resource = DocumentValidationService.validate_before_save(
                        fhir_resource, auto_fix=True
                    )
                    logging.info(f"DocumentReference validation passed for resource {fhir_resource.id}")
                except Exception as validation_error:
                    logging.error(f"DocumentReference validation failed: {validation_error}")
                    logging.error(f"Resource data that failed validation: {json.dumps(resource_data, indent=2, default=str)}")
                    raise ValueError(f"DocumentReference validation failed: {str(validation_error)}")
            
            # For DocumentReference, use json() method instead of dict() to preserve data types
            if resource_type == 'DocumentReference':
                import json as json_module
                resource_dict = json_module.loads(fhir_resource.json(exclude_none=True))
            else:
                resource_dict = fhir_resource.dict(exclude_none=True)
            
            # Ensure resourceType is in the final dict
            resource_dict['resourceType'] = resource_type
        except Exception as e:
            raise ValueError(f"Invalid FHIR resource: {str(e)}")
        
        # Generate IDs and metadata
        fhir_id = resource_dict.get('id') or str(uuid.uuid4())
        version_id = 1
        last_updated = datetime.now(timezone.utc)
        
        logging.info(f"DEBUG: Creating {resource_type} with ID {fhir_id}")
        
        # Add resource metadata
        resource_dict['id'] = fhir_id
        resource_dict['meta'] = resource_dict.get('meta', {})
        resource_dict['meta']['versionId'] = str(version_id)
        resource_dict['meta']['lastUpdated'] = last_updated.isoformat()
        
        # Check conditional create
        if if_none_exist:
            existing = await self._search_by_criteria(resource_type, if_none_exist)
            if existing:
                # Return the first matching resource
                # For conditional create, we need to signal that we found an existing resource
                # by raising a special exception that the router can catch
                first_match = existing[0]
                # Extract metadata from the existing resource
                existing_id = first_match.get('id')
                existing_meta = first_match.get('meta', {})
                existing_version = int(existing_meta.get('versionId', 1))
                existing_updated = existing_meta.get('lastUpdated')
                
                if existing_updated:
                    # Parse the lastUpdated timestamp
                    if isinstance(existing_updated, str):
                        existing_updated = datetime.fromisoformat(existing_updated.replace('Z', '+00:00'))
                else:
                    existing_updated = datetime.now(timezone.utc)
                
                # Raise a custom exception to indicate existing resource found
                raise ConditionalCreateExistingResource(
                    existing_id, existing_version, existing_updated
                )
        
        # Insert resource
        query = text("""
            INSERT INTO fhir.resources (
                resource_type, fhir_id, version_id, last_updated, resource
            ) VALUES (
                :resource_type, :fhir_id, :version_id, :last_updated, :resource
            )
            RETURNING id
        """)
        
        params = {
            'resource_type': resource_type,
            'fhir_id': fhir_id,
            'version_id': version_id,
            'last_updated': last_updated,
            'resource': json.dumps(resource_dict, cls=FHIRJSONEncoder)
        }
        
        result = await self.session.execute(query, params)
        
        resource_id = result.scalar()
        
        # Create history entry
        await self._create_history_entry(
            resource_id, version_id, 'create', resource_dict
        )
        
        # Extract search parameters
        try:
            logging.info(f"DEBUG: About to extract search params - resource_id={resource_id}, resource_type={resource_type}, fhir_id={fhir_id}")
            await self._extract_search_parameters(resource_id, resource_type, resource_dict)
            logging.debug(f"DEBUG: Successfully extracted search parameters for {resource_type} {fhir_id}")
        except Exception as e:
            logging.error(f"ERROR: Failed to extract search parameters for {resource_type} {fhir_id}: {e}")
            # Don't fail the whole operation, but log the error
        
        # Extract references
        try:
            await self._extract_references(resource_id, resource_dict, "", resource_type)
        except Exception as e:
            logging.error(f"ERROR: Failed to extract references for {resource_type} {fhir_id}: {e}")
        
        # Auto-link Observations to ServiceRequests
        if resource_type == 'Observation' and not resource_dict.get('basedOn'):
            try:
                print(f"\n\n=== AUTO-LINK: Attempting to auto-link Observation {fhir_id} ===\n")
                logging.info(f"DEBUG: Attempting to auto-link Observation {fhir_id}")
                await self._auto_link_observation_to_service_request(resource_id, resource_dict)
            except Exception as e:
                print(f"\n\n=== AUTO-LINK ERROR: {e} ===\n")
                logging.error(f"ERROR: Failed to auto-link Observation to ServiceRequest: {e}", exc_info=True)
        
        await self.session.commit()
        
        # Send WebSocket notification
        if notification_service:
            await notification_service.notify_resource_created(
            resource_type=resource_type,
            resource_id=fhir_id,
            resource_data=resource_dict
        )
        
        return fhir_id, version_id, last_updated
    
    async def read_resource(
        self,
        resource_type: str,
        fhir_id: str,
        version_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Read a FHIR resource by ID.
        
        Args:
            resource_type: FHIR resource type
            fhir_id: FHIR resource ID
            version_id: Specific version to retrieve (optional)
            
        Returns:
            Resource data or None if not found
        """
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Reading resource: {resource_type}/{fhir_id} (version: {version_id})")
        if version_id:
            # Read specific version from history
            query = text("""
                SELECT rh.resource
                FROM fhir.resource_history rh
                JOIN fhir.resources r ON rh.resource_id = r.id
                WHERE r.resource_type = :resource_type
                AND r.fhir_id = :fhir_id
                AND rh.version_id = :version_id
            """)
            params = {
                'resource_type': resource_type,
                'fhir_id': fhir_id,
                'version_id': version_id
            }
        else:
            # Read current version
            query = text("""
                SELECT resource
                FROM fhir.resources
                WHERE resource_type = :resource_type
                AND fhir_id = :fhir_id
                AND deleted = false
            """)
            params = {
                'resource_type': resource_type,
                'fhir_id': fhir_id
            }
        
        result = await self.session.execute(query, params)
        row = result.first()
        
        logger.debug(f"Query params: {params}")
        logger.info(f"Query result: {'Found' if row else 'Not found'}")
        
        if row:
            return json.loads(row[0]) if isinstance(row[0], str) else row[0]
        return None
    
    async def update_resource(
        self,
        resource_type: str,
        fhir_id: str,
        resource_data: Dict[str, Any],
        if_match: Optional[str] = None
    ) -> Tuple[int, datetime]:
        """
        Update an existing FHIR resource.
        
        Args:
            resource_type: FHIR resource type
            fhir_id: FHIR resource ID
            resource_data: Updated resource data
            if_match: ETag for conditional update
            
        Returns:
            Tuple of (version_id, last_updated)
        """
        # Get current resource first
        query = text("""
            SELECT id, version_id
            FROM fhir.resources
            WHERE resource_type = :resource_type
            AND fhir_id = :fhir_id
            AND deleted = false
            FOR UPDATE
        """)
        
        result = await self.session.execute(query, {
            'resource_type': resource_type,
            'fhir_id': fhir_id
        })
        
        row = result.first()
        if not row:
            raise ValueError(f"Resource {resource_type}/{fhir_id} not found")
        
        resource_id, current_version = row
        
        # Validate resource early to prevent search parameter corruption
        try:
            # Ensure resourceType is set
            if 'resourceType' not in resource_data:
                resource_data['resourceType'] = resource_type
            
            # Preprocess with SyntheaFHIRValidator before validation
            resource_data = self.validator._preprocess_synthea_resource(resource_type, resource_data)
            
            try:
                # Special handling for DocumentReference to check for integer issues
                if resource_type == 'DocumentReference':
                    # Remove resourceType before construction as it's not a field
                    resource_data_for_construction = resource_data.copy()
                    resource_data_for_construction.pop('resourceType', None)
                    
                    # Check for numeric strings in the data
                    def check_and_fix_integers(data, path=''):
                        if isinstance(data, dict):
                            for key, value in data.items():
                                new_path = f"{path}.{key}" if path else key
                                if isinstance(value, str) and value.isdigit():
                                    logging.warning(f"Found numeric string at {new_path}: '{value}'")
                                    # Convert known integer fields
                                    if key in ['size', 'height', 'width', 'pages', 'frames']:
                                        data[key] = int(value)
                                        logging.info(f"Converted {new_path} from string '{value}' to int {data[key]}")
                                elif isinstance(value, (dict, list)):
                                    check_and_fix_integers(value, new_path)
                        elif isinstance(data, list):
                            for i, item in enumerate(data):
                                check_and_fix_integers(item, f"{path}[{i}]")
                    
                    check_and_fix_integers(resource_data_for_construction)
                    fhir_resource = construct_fhir_element(resource_type, resource_data_for_construction)
                else:
                    fhir_resource = construct_fhir_element(resource_type, resource_data)
            except Exception as construction_error:
                logging.error(f"Failed to construct FHIR element for update: {construction_error}")
                logging.error(f"Resource data that failed construction: {json.dumps(resource_data, indent=2, default=str)}")
                raise ValueError(f"Failed to construct {resource_type}: {str(construction_error)}")
            
            # Apply DocumentReference-specific validation for updates
            if resource_type == 'DocumentReference':
                from api.services.fhir.document_validation_service import DocumentValidationService
                try:
                    fhir_resource = DocumentValidationService.validate_before_save(
                        fhir_resource, auto_fix=True
                    )
                    logging.info(f"DocumentReference update validation passed for resource {fhir_resource.id}")
                except Exception as validation_error:
                    logging.error(f"DocumentReference update validation failed: {validation_error}")
                    logging.error(f"Resource data that failed validation: {json.dumps(resource_data, indent=2, default=str)}")
                    raise ValueError(f"DocumentReference validation failed: {str(validation_error)}")
            
            # For DocumentReference, use json() method instead of dict() to preserve data types
            if resource_type == 'DocumentReference':
                import json as json_module
                resource_dict = json_module.loads(fhir_resource.json(exclude_none=True))
            else:
                resource_dict = fhir_resource.dict(exclude_none=True)
            
            # Ensure resourceType is in the final dict
            resource_dict['resourceType'] = resource_type
            
            logging.debug(f"DEBUG: Successfully validated {resource_type} {fhir_id}")
        except Exception as e:
            logging.error(f"ERROR: FHIR validation failed for {resource_type} {fhir_id}: {e}")
            raise ValueError(f"Invalid FHIR resource: {str(e)}")
        
        # Check if-match condition
        if if_match:
            # Parse ETag - can be W/"version" or just "version"
            etag_match = re.match(r'^(?:W/)?"?([^"]+)"?$', if_match)
            if etag_match:
                requested_version = etag_match.group(1)
                if str(current_version) != requested_version:
                    raise ValueError(f"Resource version mismatch: current version is {current_version}, but If-Match specified {requested_version}")
            else:
                raise ValueError(f"Invalid If-Match header format: {if_match}")
        
        # Update metadata
        new_version = current_version + 1
        last_updated = datetime.now(timezone.utc)
        
        resource_dict['id'] = fhir_id
        resource_dict['meta'] = resource_dict.get('meta', {})
        resource_dict['meta']['versionId'] = str(new_version)
        resource_dict['meta']['lastUpdated'] = last_updated.isoformat()
        
        # Update resource
        update_query = text("""
            UPDATE fhir.resources
            SET version_id = :version_id,
                last_updated = :last_updated,
                resource = :resource
            WHERE id = :id
        """)
        
        await self.session.execute(update_query, {
            'id': resource_id,
            'version_id': new_version,
            'last_updated': last_updated,
            'resource': json.dumps(resource_dict, cls=FHIRJSONEncoder)
        })
        
        # Create history entry
        await self._create_history_entry(
            resource_id, new_version, 'update', resource_dict
        )
        
        # Atomic update of search parameters and references
        try:
            # Update search parameters
            await self._delete_search_parameters(resource_id)
            await self._extract_search_parameters(resource_id, resource_type, resource_dict)
            logging.debug(f"DEBUG: Successfully updated search parameters for {resource_type} {fhir_id}")
            
            # Update references
            await self._delete_references(resource_id)
            await self._extract_references(resource_id, resource_dict, "", resource_type)
            logging.debug(f"DEBUG: Successfully updated references for {resource_type} {fhir_id}")
            
            # Commit all changes atomically
            await self.session.commit()
            logging.debug(f"DEBUG: Successfully committed update for {resource_type} {fhir_id}")
            
        except Exception as e:
            # Rollback the entire transaction on any failure
            await self.session.rollback()
            logging.error(f"ERROR: Failed to update search parameters/references for {resource_type} {fhir_id}: {e}")
            raise ValueError(f"Failed to update resource indexing: {str(e)}")
        
        # Send WebSocket notification
        if notification_service:
            await notification_service.notify_resource_updated(
            resource_type=resource_type,
            resource_id=fhir_id,
            resource_data=resource_dict
        )
        
        return new_version, last_updated
    
    async def delete_resource(
        self,
        resource_type: str,
        fhir_id: str
    ) -> bool:
        """
        Soft delete a FHIR resource.
        
        Args:
            resource_type: FHIR resource type
            fhir_id: FHIR resource ID
            
        Returns:
            True if deleted, False if not found
        """
        query = text("""
            UPDATE fhir.resources
            SET deleted = true,
                last_updated = :last_updated,
                version_id = version_id + 1
            WHERE resource_type = :resource_type
            AND fhir_id = :fhir_id
            AND deleted = false
            RETURNING id, version_id, resource
        """)
        
        result = await self.session.execute(query, {
            'resource_type': resource_type,
            'fhir_id': fhir_id,
            'last_updated': datetime.now(timezone.utc)
        })
        
        row = result.first()
        if row:
            resource_id, version_id, resource_data = row
            
            # Create history entry
            await self._create_history_entry(
                resource_id, version_id, 'delete', 
                json.loads(resource_data) if isinstance(resource_data, str) else resource_data
            )
            
            # Delete search parameters and references
            await self._delete_search_parameters(resource_id)
            await self._delete_references(resource_id)
            
            await self.session.commit()
            
            # Send WebSocket notification
            if notification_service:
                await notification_service.notify_resource_deleted(
                resource_type=resource_type,
                resource_id=fhir_id
            )
            
            return True
        
        return False
    
    async def search_resources(
        self,
        resource_type: str,
        search_params: Dict[str, Any],
        offset: int = 0,
        limit: int = 100
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Search for FHIR resources.
        
        Args:
            resource_type: FHIR resource type
            search_params: Search parameters (already parsed by SearchParameterHandler)
            offset: Result offset for pagination
            limit: Maximum results to return
            
        Returns:
            Tuple of (resources, total_count)
        """
        from fhir.core.search.basic import SearchParameterHandler
        
        # Initialize search handler
        search_handler = SearchParameterHandler(self._get_search_parameter_definitions())
        
        # Build search query using the handler
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            resource_type, search_params
        )
        
        # Build base query
        base_query = """
            SELECT DISTINCT r.resource, r.fhir_id, r.version_id, r.last_updated
            FROM fhir.resources r
        """
        
        # Add base where clauses
        base_where = [
            "r.resource_type = :resource_type",
            "r.deleted = false"
        ]
        sql_params['resource_type'] = resource_type
        
        # Combine clauses
        all_where_clauses = base_where + where_clauses
        
        # Build final query
        query = base_query
        if join_clauses:
            query += " " + " ".join(join_clauses)
        query += " WHERE " + " AND ".join(all_where_clauses)
        
        # Add ordering
        query += " ORDER BY r.last_updated DESC"
        
        # Get total count
        count_query = f"""
            SELECT COUNT(DISTINCT r.id) 
            FROM fhir.resources r
            {" ".join(join_clauses) if join_clauses else ""}
            WHERE {" AND ".join(all_where_clauses)}
        """
        count_result = await self.session.execute(text(count_query), sql_params)
        total_count = count_result.scalar() or 0
        
        # Add pagination
        query += " LIMIT :limit OFFSET :offset"
        sql_params['limit'] = limit
        sql_params['offset'] = offset
        
        # Execute search
        result = await self.session.execute(text(query), sql_params)
        resources = []
        
        for row in result:
            resource_data = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            resources.append(resource_data)
        
        return resources, total_count
    
    async def get_history(
        self,
        resource_type: Optional[str] = None,
        fhir_id: Optional[str] = None,
        offset: int = 0,
        limit: int = 100,
        since: Optional[datetime] = None,
        at: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get resource history.
        
        Args:
            resource_type: Filter by resource type (optional)
            fhir_id: Filter by resource ID (optional)
            offset: Result offset
            limit: Maximum results
            since: Only include changes since this time
            at: Only include changes at or before this time
            
        Returns:
            List of history entries
        """
        query = """
            SELECT rh.resource, rh.version_id, rh.operation, rh.transaction_time,
                   r.resource_type, r.fhir_id
            FROM fhir.resource_history rh
            JOIN fhir.resources r ON rh.resource_id = r.id
            WHERE 1=1
        """
        
        params = {}
        
        if resource_type:
            query += " AND r.resource_type = :resource_type"
            params['resource_type'] = resource_type
            
        if fhir_id:
            query += " AND r.fhir_id = :fhir_id"
            params['fhir_id'] = fhir_id
            
        if since:
            query += " AND rh.transaction_time > :since"
            params['since'] = since
            
        if at:
            query += " AND rh.transaction_time <= :at"
            params['at'] = at
        
        query += " ORDER BY rh.transaction_time DESC LIMIT :limit OFFSET :offset"
        params['limit'] = limit
        params['offset'] = offset
        
        result = await self.session.execute(text(query), params)
        
        history = []
        for row in result:
            resource_data = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            history.append({
                'resource': resource_data,
                'versionId': str(row[1]),
                'operation': row[2],
                'lastUpdated': row[3].isoformat(),
                'resourceType': row[4],
                'id': row[5]
            })
        
        return history
    
    async def process_bundle(self, bundle: Bundle) -> Bundle:
        """
        Process a FHIR Bundle (batch/transaction).
        
        Args:
            bundle: FHIR Bundle to process
            
        Returns:
            Response Bundle
        """
        response_bundle = Bundle(
            type="batch-response" if bundle.type == "batch" else "transaction-response",
            entry=[]
        )
        
        # Transaction handling
        if bundle.type == "transaction":
            # All operations must succeed
            try:
                for entry in bundle.entry or []:
                    response_entry = await self._process_bundle_entry(entry)
                    response_bundle.entry.append(response_entry)
                await self.session.commit()
            except Exception as e:
                await self.session.rollback()
                raise
        else:
            # Batch - independent operations
            for entry in bundle.entry or []:
                try:
                    response_entry = await self._process_bundle_entry(entry)
                    await self.session.commit()
                except Exception as e:
                    # Create error response
                    response_entry = BundleEntry(
                        response=BundleEntryResponse(
                            status="500",
                            outcome=OperationOutcome(
                                issue=[OperationOutcomeIssue(
                                    severity="error",
                                    code="exception",
                                    diagnostics=str(e)
                                )]
                            )
                        )
                    )
                    await self.session.rollback()
                response_bundle.entry.append(response_entry)
        
        # Convert to dict to avoid serialization issues with fhir.resources objects
        return response_bundle.dict()
    
    async def process_bundle_dict(self, bundle_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhanced FHIR Bundle processing with optimization and detailed error handling.
        
        Args:
            bundle_data: Bundle data as dictionary
            
        Returns:
            Response Bundle as dictionary
        """
        # Validate bundle structure
        if not isinstance(bundle_data, dict) or bundle_data.get('resourceType') != 'Bundle':
            raise ValueError("Invalid Bundle resource structure")
        
        bundle_type = bundle_data.get('type')
        if not bundle_type:
            raise ValueError("Bundle type is required")
        
        # Validate bundle type
        valid_types = ['transaction', 'batch', 'collection', 'searchset', 'history', 'document']
        if bundle_type not in valid_types:
            raise ValueError(f"Invalid Bundle type '{bundle_type}'. Must be one of: {', '.join(valid_types)}")
        
        entries = bundle_data.get('entry', [])
        
        # Performance optimization: pre-validate entries for transactions
        if bundle_type == "transaction":
            await self._validate_transaction_bundle_entries(entries)
        
        response_bundle = {
            "resourceType": "Bundle",
            "type": f"{bundle_type}-response" if bundle_type in ['transaction', 'batch'] else bundle_type,
            "entry": [],
            "meta": {
                "lastUpdated": datetime.now(timezone.utc).isoformat()
            }
        }
        
        # Add bundle ID if provided
        if 'id' in bundle_data:
            response_bundle['id'] = bundle_data['id']
        
        # Performance monitoring
        start_time = datetime.now()
        processed_count = 0
        error_count = 0
        
        try:
            if bundle_type == "transaction":
                # Enhanced transaction handling with atomic operations
                response_bundle['entry'] = await self._process_transaction_bundle(entries)
                processed_count = len(entries)
                
            elif bundle_type == "batch":
                # Enhanced batch processing with independent error handling
                batch_results = await self._process_batch_bundle(entries)
                response_bundle['entry'] = batch_results['entries']
                processed_count = batch_results['processed_count']
                error_count = batch_results['error_count']
                
            elif bundle_type == "collection":
                # Collection bundles don't require processing - return as-is
                response_bundle['entry'] = [{'resource': entry.get('resource')} for entry in entries if entry.get('resource')]
                processed_count = len(response_bundle['entry'])
                
            elif bundle_type in ["searchset", "history", "document"]:
                # These are typically response bundles, but handle gracefully
                response_bundle['entry'] = entries
                response_bundle['total'] = len(entries)
                processed_count = len(entries)
                
            else:
                raise ValueError(f"Bundle type '{bundle_type}' processing not implemented")
            
            # Add processing metadata
            processing_time = (datetime.now() - start_time).total_seconds()
            response_bundle['meta']['extension'] = [{
                "url": "http://wintehr.com/fhir/StructureDefinition/bundle-processing-info",
                "extension": [
                    {
                        "url": "processedCount",
                        "valueInteger": processed_count
                    },
                    {
                        "url": "errorCount", 
                        "valueInteger": error_count
                    },
                    {
                        "url": "processingTimeMs",
                        "valueDecimal": round(processing_time * 1000, 2)
                    }
                ]
            }]
            
            logging.info(f"Bundle processing completed: {processed_count} entries processed, "
                        f"{error_count} errors, {processing_time:.2f}s")
            
        except Exception as e:
            # Enhanced error handling with detailed OperationOutcome
            logging.error(f"Bundle processing failed: {str(e)}")
            await self.session.rollback()
            
            error_outcome = await self._create_enhanced_operation_outcome(
                severity="fatal",
                code="exception",
                diagnostics=f"Bundle processing failed: {str(e)}",
                expression=["Bundle"],
                details_code="bundle-processing-error"
            )
            
            raise ValueError(f"Bundle processing failed: {str(e)}")
        
        return response_bundle
    
    async def _validate_transaction_bundle_entries(self, entries: List[Dict[str, Any]]):
        """Validate transaction bundle entries before processing."""
        if not entries:
            return
        
        # Check for required request elements
        for i, entry in enumerate(entries):
            if 'request' not in entry:
                raise ValueError(f"Bundle entry {i} missing required 'request' element")
            
            request = entry['request']
            if 'method' not in request or 'url' not in request:
                raise ValueError(f"Bundle entry {i} request missing required 'method' or 'url'")
            
            method = request['method']
            if method not in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                raise ValueError(f"Bundle entry {i} has invalid HTTP method: {method}")
            
            # Validate resource presence for operations that require it
            if method in ['POST', 'PUT', 'PATCH'] and 'resource' not in entry:
                raise ValueError(f"Bundle entry {i} with method {method} missing required 'resource'")
        
        # Check for duplicate fullUrl values
        full_urls = [entry.get('fullUrl') for entry in entries if entry.get('fullUrl')]
        if len(full_urls) != len(set(full_urls)):
            raise ValueError("Bundle contains duplicate fullUrl values")
    
    async def _process_transaction_bundle(self, entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process transaction bundle with atomic operations."""
        response_entries = []
        
        try:
            # Process all entries in a single transaction
            for entry in entries:
                response_entry = await self._process_bundle_entry_dict(entry)
                response_entries.append(response_entry)
            
            # Commit all changes atomically
            await self.session.commit()
            logging.debug(f"Transaction bundle committed successfully with {len(response_entries)} entries")
            
        except Exception as e:
            # Rollback all changes on any failure
            await self.session.rollback()
            logging.error(f"Transaction bundle failed, rolled back: {str(e)}")
            
            # Create enhanced error response
            error_outcome = await self._create_enhanced_operation_outcome(
                severity="fatal",
                code="transient",
                diagnostics=f"Transaction failed: {str(e)}",
                expression=["Bundle"],
                details_code="transaction-rollback"
            )
            
            raise ValueError(f"Transaction bundle processing failed: {str(e)}")
        
        return response_entries
    
    async def _process_batch_bundle(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process batch bundle with independent error handling."""
        response_entries = []
        processed_count = 0
        error_count = 0
        
        for i, entry in enumerate(entries):
            try:
                response_entry = await self._process_bundle_entry_dict(entry)
                await self.session.commit()
                response_entries.append(response_entry)
                processed_count += 1
                
            except Exception as e:
                # Create detailed error response for this entry
                await self.session.rollback()
                error_count += 1
                
                # Determine appropriate HTTP status code
                status_code = "400"  # Default to bad request
                error_code = "invalid"
                
                if "validation" in str(e).lower():
                    status_code = "400"
                    error_code = "invalid"
                elif "not found" in str(e).lower():
                    status_code = "404"
                    error_code = "not-found"
                elif "unauthorized" in str(e).lower():
                    status_code = "401"
                    error_code = "forbidden"
                else:
                    status_code = "500"
                    error_code = "exception"
                
                # Create enhanced OperationOutcome
                error_outcome = await self._create_enhanced_operation_outcome(
                    severity="error",
                    code=error_code,
                    diagnostics=str(e),
                    expression=[f"Bundle.entry[{i}]"],
                    details_code="batch-entry-error"
                )
                
                response_entry = {
                    "response": {
                        "status": status_code,
                        "outcome": error_outcome
                    }
                }
                response_entries.append(response_entry)
                
                logging.warning(f"Batch entry {i} failed: {str(e)}")
        
        return {
            'entries': response_entries,
            'processed_count': processed_count,
            'error_count': error_count
        }
    
    async def _create_enhanced_operation_outcome(
        self,
        severity: str,
        code: str,
        diagnostics: str,
        expression: List[str] = None,
        location: List[str] = None,
        details_code: str = None
    ) -> Dict[str, Any]:
        """Create enhanced OperationOutcome with detailed diagnostics."""
        
        issue = {
            "severity": severity,
            "code": code,
            "diagnostics": diagnostics
        }
        
        # Add expression paths for error location
        if expression:
            issue["expression"] = expression
        
        # Add location information
        if location:
            issue["location"] = location
        elif expression:
            # Default location to expression if not provided
            issue["location"] = expression
        
        # Add coded details
        if details_code:
            issue["details"] = {
                "coding": [{
                    "system": "http://wintehr.com/fhir/CodeSystem/operation-outcome-details",
                    "code": details_code,
                    "display": details_code.replace('-', ' ').title()
                }]
            }
        
        operation_outcome = {
            "resourceType": "OperationOutcome",
            "issue": [issue],
            "meta": {
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
                "profile": ["http://wintehr.com/fhir/StructureDefinition/enhanced-operation-outcome"]
            }
        }
        
        return operation_outcome
    
    async def _process_bundle_entry_dict(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single bundle entry from dictionary."""
        request = entry.get('request')
        resource = entry.get('resource')
        
        if not request:
            raise ValueError("Bundle entry missing request")
        
        method = request.get('method')
        url = request.get('url')
        
        # Parse URL to get resource type and ID
        url_parts = url.split('/')
        resource_type = url_parts[0]
        fhir_id = url_parts[1] if len(url_parts) > 1 else None
        
        response_entry = {}
        
        if method == "POST":
            # Create
            if resource:
                fhir_id, version_id, last_updated = await self.create_resource(
                    resource_type, resource
                )
                response_entry['response'] = {
                    "status": "201",
                    "location": f"{resource_type}/{fhir_id}/_history/{version_id}",
                    "lastModified": last_updated.isoformat()
                }
        
        elif method == "PUT":
            # Update
            if fhir_id and resource:
                version_id, last_updated = await self.update_resource(
                    resource_type, fhir_id, resource
                )
                response_entry['response'] = {
                    "status": "200",
                    "location": f"{resource_type}/{fhir_id}/_history/{version_id}",
                    "lastModified": last_updated.isoformat()
                }
        
        elif method == "DELETE":
            # Delete
            if fhir_id:
                deleted = await self.delete_resource(resource_type, fhir_id)
                response_entry['response'] = {
                    "status": "204" if deleted else "404"
                }
        
        elif method == "GET":
            # Read/Search
            if fhir_id:
                # Read single resource
                resource = await self.get_resource(resource_type, fhir_id)
                if resource:
                    response_entry['resource'] = resource
                    response_entry['response'] = {"status": "200"}
                else:
                    response_entry['response'] = {"status": "404"}
            else:
                # Search
                try:
                    # Simple search without parameters for now
                    resources, total = await self.search_resources(
                        resource_type, {}, limit=10
                    )
                    
                    search_bundle = {
                        "resourceType": "Bundle",
                        "type": "searchset",
                        "total": total,
                        "entry": [
                            {"resource": res} for res in resources
                        ]
                    }
                    
                    response_entry['resource'] = search_bundle
                    response_entry['response'] = {"status": "200"}
                    
                except Exception as e:
                    response_entry['response'] = {
                        "status": "500",
                        "outcome": {
                            "resourceType": "OperationOutcome",
                            "issue": [{
                                "severity": "error",
                                "code": "exception",
                                "diagnostics": str(e)
                            }]
                        }
                    }
        
        return response_entry
    
    async def _process_bundle_entry(self, entry: BundleEntry) -> BundleEntry:
        """Process a single bundle entry."""
        request = entry.request
        resource = entry.resource
        
        logging.debug(f"DEBUG: Processing bundle entry")
        logging.debug(f"DEBUG: Entry type: {type(entry)}")
        logging.debug(f"DEBUG: Has request: {request is not None}")
        logging.debug(f"DEBUG: Has resource: {resource is not None}")
        if not request:
            raise ValueError("Bundle entry missing request")
        
        method = request.method
        url = request.url
        
        logging.debug(f"DEBUG: Method: {method}, URL: {url}")
        # Parse URL to get resource type and ID
        url_parts = url.split('/')
        resource_type = url_parts[0]
        fhir_id = url_parts[1] if len(url_parts) > 1 else None
        
        response_entry = BundleEntry()
        
        if method == "POST":
            # Create
            if resource:
                fhir_id, version_id, last_updated = await self.create_resource(
                    resource_type,
                    resource.dict(exclude_none=True),
                    getattr(request, 'ifNoneExist', None)
                )
                logging.debug(f"DEBUG: Created resource - ID: {fhir_id}, Version: {version_id}")
                response_entry.response = BundleEntryResponse(
                    status="201",
                    location=f"{resource_type}/{fhir_id}/_history/{version_id}",
                    lastModified=last_updated.isoformat()
                )
        
        elif method == "PUT":
            # Update
            if resource and fhir_id:
                version_id, last_updated = await self.update_resource(
                    resource_type,
                    fhir_id,
                    resource.dict(exclude_none=True),
                    getattr(request, 'ifMatch', None)
                )
                response_entry.response = BundleEntryResponse(
                    status="200",
                    location=f"{resource_type}/{fhir_id}/_history/{version_id}",
                    lastModified=last_updated.isoformat()
                )
        
        elif method == "DELETE":
            # Delete
            if fhir_id:
                deleted = await self.delete_resource(resource_type, fhir_id)
                response_entry.response = BundleEntryResponse(
                    status="204" if deleted else "404"
                )
        
        elif method == "GET":
            # Handle both read (with ID) and search (with query parameters)
            if '?' in url:
                # This is a search query
                try:
                    # Parse the URL
                    url_parts = url.split('?')
                    resource_type = url_parts[0].split('/')[0]
                    query_string = url_parts[1] if len(url_parts) > 1 else ""
                    
                    # Parse query parameters
                    from urllib.parse import parse_qs
                    query_params = parse_qs(query_string)
                    # Convert lists to single values for simplicity
                    query_params = {k: v[0] if len(v) == 1 else v for k, v in query_params.items()}
                    
                    # Execute search
                    from fhir.core.search.basic import SearchParameterHandler
                    search_handler = SearchParameterHandler(self._get_search_parameter_definitions())
                    search_params, result_params = search_handler.parse_search_params(
                        resource_type, query_params
                    )
                    
                    # Get count parameter
                    count = int(query_params.get('_count', 10))
                    
                    # Execute search
                    resources, total = await self.search_resources(
                        resource_type,
                        search_params,
                        offset=0,
                        limit=count
                    )
                    
                    # Build search bundle
                    search_bundle = {
                        "resourceType": "Bundle",
                        "type": "searchset",
                        "total": total,
                        "entry": [
                            {
                                "fullUrl": f"{resource_type}/{res['id']}",
                                "resource": res,
                                "search": {"mode": "match"}
                            }
                            for res in resources
                        ]
                    }
                    
                    response_entry.resource = construct_fhir_element("Bundle", search_bundle)
                    response_entry.response = BundleEntryResponse(status="200")
                    
                except Exception as e:
                    logging.error(f"ERROR in batch search: {e}")
                    response_entry.response = BundleEntryResponse(
                        status="500",
                        outcome={
                            "resourceType": "OperationOutcome",
                            "issue": [{
                                "severity": "error",
                                "code": "exception",
                                "details": {"text": f"Error processing search: {str(e)}"}
                            }]
                        }
                    )
            elif fhir_id:
                # This is a read operation
                resource_data = await self.read_resource(resource_type, fhir_id)
                if resource_data:
                    response_entry.resource = construct_fhir_element(
                        resource_type, resource_data
                    )
                    response_entry.response = BundleEntryResponse(status="200")
                else:
                    response_entry.response = BundleEntryResponse(status="404")
            else:
                # Invalid URL format
                response_entry.response = BundleEntryResponse(
                    status="400",
                    outcome={
                        "resourceType": "OperationOutcome",
                        "issue": [{
                            "severity": "error",
                            "code": "invalid",
                            "details": {"text": f"Invalid request URL: {url}"}
                        }]
                    }
                )
        
        return response_entry
    
    async def _update_search_params(self, resource_id: int, resource_type: str, resource_data: Dict[str, Any]):
        """Update search parameters for a resource."""
        # Delete existing search params
        delete_query = text("""
            DELETE FROM fhir.search_params
            WHERE resource_id = :resource_id
        """)
        await self.session.execute(delete_query, {'resource_id': resource_id})
        
        # Extract and add new search params
        # Always index the resource ID
        await self._add_search_param(
            resource_id, resource_type, '_id', 'token', 
            value_token_code=resource_data.get('id')
        )
        
        # Resource-specific parameters
        if resource_type == 'Patient':
            # Names
            if 'name' in resource_data:
                for name in resource_data['name']:
                    if 'family' in name:
                        await self._add_search_param(
                            resource_id, resource_type, 'family', 'string',
                            value_string=name['family']
                        )
                    if 'given' in name:
                        for given in name['given']:
                            await self._add_search_param(
                                resource_id, resource_type, 'given', 'string',
                                value_string=given
                            )
            
            # Gender
            if 'gender' in resource_data:
                await self._add_search_param(
                    resource_id, resource_type, 'gender', 'token',
                    value_token_code=resource_data['gender']
                )
        
        elif resource_type in ['Encounter', 'Observation', 'Condition', 'MedicationRequest', 
                              'MedicationAdministration', 'Procedure', 'DiagnosticReport', 
                              'Immunization', 'AllergyIntolerance', 'ImagingStudy']:
            # Patient reference (handle both Patient/ and urn:uuid: formats)
            if 'subject' in resource_data and isinstance(resource_data['subject'], dict):
                ref = resource_data['subject'].get('reference', '')
                patient_id = None
                
                if ref.startswith('Patient/'):
                    patient_id = ref.replace('Patient/', '')
                elif ref.startswith('urn:uuid:'):
                    # Extract UUID from urn:uuid: format
                    patient_id = ref.replace('urn:uuid:', '')
                
                if patient_id:
                    await self._add_search_param(
                        resource_id, resource_type, 'patient', 'reference',
                        value_reference=patient_id
                    )
    
    async def _add_search_param(self, resource_id: int, resource_type: str, param_name: str, 
                               param_type: str, **values):
        """Add a search parameter to the database."""
        query = text("""
            INSERT INTO fhir.search_params (
                resource_id, resource_type, param_name, param_type,
                value_string, value_number, value_date,
                value_token_system, value_token_code, value_reference
            ) VALUES (
                :resource_id, :resource_type, :param_name, :param_type,
                :value_string, :value_number, :value_date,
                :value_token_system, :value_token_code, :value_reference
            )
        """)
        
        params = {
            'resource_id': resource_id,
            'resource_type': resource_type,
            'param_name': param_name,
            'param_type': param_type,
            'value_string': values.get('value_string'),
            'value_number': values.get('value_number'),
            'value_date': values.get('value_date'),
            'value_token_system': values.get('value_token_system'),
            'value_token_code': values.get('value_token_code'),
            'value_reference': values.get('value_reference')
        }
        
        await self.session.execute(query, params)
    
    async def _create_history_entry(
        self,
        resource_id: int,
        version_id: int,
        operation: str,
        resource_data: Dict[str, Any]
    ):
        """Create a history entry for a resource."""
        query = text("""
            INSERT INTO fhir.resource_history (
                resource_id, version_id, operation, resource
            ) VALUES (
                :resource_id, :version_id, :operation, :resource
            )
        """)
        
        await self.session.execute(query, {
            'resource_id': resource_id,
            'version_id': version_id,
            'operation': operation,
            'resource': json.dumps(resource_data, cls=FHIRJSONEncoder)
        })
    
    async def _extract_search_parameters(
        self,
        resource_id: int,
        resource_type: str,
        resource_data: Dict[str, Any]
    ):
        """Extract and store search parameters from a resource."""
        logging.debug(f"DEBUG: Extracting search parameters for {resource_type} resource {resource_id}")
        params_to_extract = []
        
        # Extract common parameters
        if 'id' in resource_data:
            params_to_extract.append({
                'param_name': '_id',
                'param_type': 'token',
                'value_string': resource_data['id']
            })
        
        if 'meta' in resource_data and 'lastUpdated' in resource_data['meta']:
            params_to_extract.append({
                'param_name': '_lastUpdated',
                'param_type': 'date',
                'value_date': datetime.fromisoformat(
                    resource_data['meta']['lastUpdated'].replace('Z', '+00:00')
                )
            })
        
        # Resource-specific parameters
        if resource_type == 'Patient':
            # Gender
            if 'gender' in resource_data:
                params_to_extract.append({
                    'param_name': 'gender',
                    'param_type': 'token',
                    'value_token_code': resource_data['gender']
                })
            
            # Birth date
            if 'birthDate' in resource_data:
                birth_date = datetime.strptime(resource_data['birthDate'], '%Y-%m-%d') if isinstance(resource_data['birthDate'], str) else resource_data['birthDate']
                params_to_extract.append({
                    'param_name': 'birthdate',
                    'param_type': 'date',
                    'value_date': birth_date
                })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
            
            # Names
            if 'name' in resource_data:
                for name in resource_data['name']:
                    if 'family' in name:
                        params_to_extract.append({
                            'param_name': 'family',
                            'param_type': 'string',
                            'value_string': name['family']
                        })
                    if 'given' in name:
                        for given in name['given']:
                            params_to_extract.append({
                                'param_name': 'given',
                                'param_type': 'string',
                                'value_string': given
                            })
        
        elif resource_type == 'Observation':
            # Code
            if 'code' in resource_data and 'coding' in resource_data['code']:
                for coding in resource_data['code']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Category
            if 'category' in resource_data:
                for category in resource_data['category']:
                    if 'coding' in category:
                        for coding in category['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'category',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Subject reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                
                # Also extract patient-specific reference
                # Handle both standard Patient/id and urn:uuid: formats
                resource_type_ref, ref_resource_id = ReferenceUtils.extract_resource_type_and_id(ref)
                if resource_type_ref == 'Patient' or (resource_type_ref is None and ref.startswith('urn:uuid:')):
                    # For urn:uuid refs, we assume subject refers to patient in Observation context
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Date (effectiveDateTime or effectivePeriod)
            if 'effectiveDateTime' in resource_data:
                try:
                    effective_date = datetime.fromisoformat(
                        resource_data['effectiveDateTime'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': effective_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse effectiveDateTime: {resource_data.get('effectiveDateTime')} - {e}")
            elif 'effectivePeriod' in resource_data and 'start' in resource_data['effectivePeriod']:
                try:
                    effective_date = datetime.fromisoformat(
                        resource_data['effectivePeriod']['start'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': effective_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse effectivePeriod.start: {resource_data.get('effectivePeriod', {}).get('start')} - {e}")
            
            # Value quantity (CRIT-001-OBS)
            if 'valueQuantity' in resource_data:
                value_quantity = resource_data['valueQuantity']
                if 'value' in value_quantity:
                    try:
                        quantity_value = float(value_quantity['value'])
                        params_to_extract.append({
                            'param_name': 'value-quantity',
                            'param_type': 'quantity',
                            'value_quantity_value': quantity_value,
                            'value_quantity_unit': value_quantity.get('unit'),
                            'value_quantity_system': value_quantity.get('system'),
                            'value_quantity_code': value_quantity.get('code')
                        })
                    except (ValueError, TypeError) as e:
                        logging.warning(f"WARNING: Could not parse valueQuantity.value: {value_quantity.get('value')} - {e}")
        
        elif resource_type == 'Condition':
            # Code
            if 'code' in resource_data and 'coding' in resource_data['code']:
                for coding in resource_data['code']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Clinical status
            if 'clinicalStatus' in resource_data and 'coding' in resource_data['clinicalStatus']:
                for coding in resource_data['clinicalStatus']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'clinical-status',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Subject reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                
                # Also extract patient-specific reference
                # Handle both Patient/ and urn:uuid: formats
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Onset date (CRIT-001-CON)
            if 'onsetDateTime' in resource_data:
                try:
                    onset_date = datetime.fromisoformat(
                        resource_data['onsetDateTime'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'onset-date',
                        'param_type': 'date',
                        'value_date': onset_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse onsetDateTime: {resource_data.get('onsetDateTime')} - {e}")
            elif 'onsetPeriod' in resource_data and 'start' in resource_data['onsetPeriod']:
                try:
                    onset_date = datetime.fromisoformat(
                        resource_data['onsetPeriod']['start'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'onset-date',
                        'param_type': 'date',
                        'value_date': onset_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse onsetPeriod.start: {resource_data.get('onsetPeriod', {}).get('start')} - {e}")
        
        elif resource_type == 'MedicationRequest':
            # Medication code
            if 'medicationCodeableConcept' in resource_data and 'coding' in resource_data['medicationCodeableConcept']:
                for coding in resource_data['medicationCodeableConcept']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
                        params_to_extract.append({
                            'param_name': 'medication',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Subject reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                
                # Also extract patient-specific reference
                # Handle both Patient/ and urn:uuid: formats
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Requester reference
            if 'requester' in resource_data and 'reference' in resource_data['requester']:
                params_to_extract.append({
                    'param_name': 'requester',
                    'param_type': 'reference',
                    'value_string': resource_data['requester']['reference']
                })
            
            # Authored on date
            if 'authoredOn' in resource_data:
                try:
                    authored_on_str = resource_data['authoredOn']
                    if isinstance(authored_on_str, str):
                        # Handle multiple datetime formats
                        if authored_on_str.endswith('Z'):
                            authored_date = datetime.fromisoformat(authored_on_str.replace('Z', '+00:00'))
                        elif '+' in authored_on_str or authored_on_str.endswith('00:00'):
                            authored_date = datetime.fromisoformat(authored_on_str)
                        else:
                            # Assume UTC if no timezone info
                            authored_date = datetime.fromisoformat(authored_on_str + '+00:00')
                    else:
                        # Handle case where it's already a datetime object
                        authored_date = authored_on_str if isinstance(authored_on_str, datetime) else datetime.fromisoformat(str(authored_on_str))
                    
                    params_to_extract.append({
                        'param_name': 'authoredon',
                        'param_type': 'date',
                        'value_date': authored_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse authoredOn: {resource_data.get('authoredOn')} (type: {type(resource_data.get('authoredOn'))}) - {e}")
        
        elif resource_type == 'MedicationDispense':
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Medication code/reference
            if 'medicationCodeableConcept' in resource_data and 'coding' in resource_data['medicationCodeableConcept']:
                for coding in resource_data['medicationCodeableConcept']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'medication',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            elif 'medicationReference' in resource_data and 'reference' in resource_data['medicationReference']:
                params_to_extract.append({
                    'param_name': 'medication',
                    'param_type': 'reference',
                    'value_string': resource_data['medicationReference']['reference']
                })
            
            # Subject/Patient reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Context/Encounter reference
            if 'context' in resource_data and 'reference' in resource_data['context']:
                params_to_extract.append({
                    'param_name': 'context',
                    'param_type': 'reference',
                    'value_string': resource_data['context']['reference']
                })
                if resource_data['context']['reference'].startswith('Encounter/'):
                    params_to_extract.append({
                        'param_name': 'encounter',
                        'param_type': 'reference',
                        'value_string': resource_data['context']['reference']
                    })
            
            # Performer reference
            if 'performer' in resource_data:
                for performer in resource_data['performer']:
                    if 'actor' in performer and 'reference' in performer['actor']:
                        params_to_extract.append({
                            'param_name': 'performer',
                            'param_type': 'reference',
                            'value_string': performer['actor']['reference']
                        })
            
            # Prescription reference
            if 'authorizingPrescription' in resource_data:
                for prescription in resource_data['authorizingPrescription']:
                    if 'reference' in prescription:
                        params_to_extract.append({
                            'param_name': 'prescription',
                            'param_type': 'reference',
                            'value_string': prescription['reference']
                        })
            
            # When handed over
            if 'whenHandedOver' in resource_data:
                try:
                    when_handed_over_str = resource_data['whenHandedOver']
                    if isinstance(when_handed_over_str, str):
                        if when_handed_over_str.endswith('Z'):
                            when_handed_over_date = datetime.fromisoformat(when_handed_over_str.replace('Z', '+00:00'))
                        elif '+' in when_handed_over_str or when_handed_over_str.endswith('00:00'):
                            when_handed_over_date = datetime.fromisoformat(when_handed_over_str)
                        else:
                            when_handed_over_date = datetime.fromisoformat(when_handed_over_str + '+00:00')
                    else:
                        when_handed_over_date = when_handed_over_str if isinstance(when_handed_over_str, datetime) else datetime.fromisoformat(str(when_handed_over_str))
                    
                    params_to_extract.append({
                        'param_name': 'whenhandedover',
                        'param_type': 'date',
                        'value_date': when_handed_over_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse whenHandedOver: {resource_data.get('whenHandedOver')} - {e}")
            
            # When prepared
            if 'whenPrepared' in resource_data:
                try:
                    when_prepared_str = resource_data['whenPrepared']
                    if isinstance(when_prepared_str, str):
                        if when_prepared_str.endswith('Z'):
                            when_prepared_date = datetime.fromisoformat(when_prepared_str.replace('Z', '+00:00'))
                        elif '+' in when_prepared_str or when_prepared_str.endswith('00:00'):
                            when_prepared_date = datetime.fromisoformat(when_prepared_str)
                        else:
                            when_prepared_date = datetime.fromisoformat(when_prepared_str + '+00:00')
                    else:
                        when_prepared_date = when_prepared_str if isinstance(when_prepared_str, datetime) else datetime.fromisoformat(str(when_prepared_str))
                    
                    params_to_extract.append({
                        'param_name': 'whenprepared',
                        'param_type': 'date',
                        'value_date': when_prepared_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse whenPrepared: {resource_data.get('whenPrepared')} - {e}")
        
        elif resource_type == 'MedicationAdministration':
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Medication code/reference
            if 'medicationCodeableConcept' in resource_data and 'coding' in resource_data['medicationCodeableConcept']:
                for coding in resource_data['medicationCodeableConcept']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'medication',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            elif 'medicationReference' in resource_data and 'reference' in resource_data['medicationReference']:
                params_to_extract.append({
                    'param_name': 'medication',
                    'param_type': 'reference',
                    'value_string': resource_data['medicationReference']['reference']
                })
            
            # Subject/Patient reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Context/Encounter reference
            if 'context' in resource_data and 'reference' in resource_data['context']:
                params_to_extract.append({
                    'param_name': 'context',
                    'param_type': 'reference',
                    'value_string': resource_data['context']['reference']
                })
                if resource_data['context']['reference'].startswith('Encounter/'):
                    params_to_extract.append({
                        'param_name': 'encounter',
                        'param_type': 'reference',
                        'value_string': resource_data['context']['reference']
                    })
            
            # Effective time
            effective_time_field = None
            if 'effectiveDateTime' in resource_data:
                effective_time_field = 'effectiveDateTime'
            elif 'effectivePeriod' in resource_data and 'start' in resource_data['effectivePeriod']:
                effective_time_field = 'effectivePeriod'
            
            if effective_time_field:
                try:
                    if effective_time_field == 'effectiveDateTime':
                        effective_time_str = resource_data['effectiveDateTime']
                    else:
                        effective_time_str = resource_data['effectivePeriod']['start']
                    
                    if isinstance(effective_time_str, str):
                        if effective_time_str.endswith('Z'):
                            effective_date = datetime.fromisoformat(effective_time_str.replace('Z', '+00:00'))
                        elif '+' in effective_time_str or effective_time_str.endswith('00:00'):
                            effective_date = datetime.fromisoformat(effective_time_str)
                        else:
                            effective_date = datetime.fromisoformat(effective_time_str + '+00:00')
                    else:
                        effective_date = effective_time_str if isinstance(effective_time_str, datetime) else datetime.fromisoformat(str(effective_time_str))
                    
                    params_to_extract.append({
                        'param_name': 'effective-time',
                        'param_type': 'date',
                        'value_date': effective_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse effective time: {resource_data.get(effective_time_field)} - {e}")
            
            # Performer reference
            if 'performer' in resource_data:
                for performer in resource_data['performer']:
                    if 'actor' in performer and 'reference' in performer['actor']:
                        params_to_extract.append({
                            'param_name': 'performer',
                            'param_type': 'reference',
                            'value_string': performer['actor']['reference']
                        })
            
            # Request reference
            if 'request' in resource_data and 'reference' in resource_data['request']:
                params_to_extract.append({
                    'param_name': 'request',
                    'param_type': 'reference',
                    'value_string': resource_data['request']['reference']
                })
            
            # Device reference
            if 'device' in resource_data:
                for device in resource_data['device']:
                    if 'reference' in device:
                        params_to_extract.append({
                            'param_name': 'device',
                            'param_type': 'reference',
                            'value_string': device['reference']
                        })
        
        elif resource_type == 'Encounter':
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Class
            if 'class' in resource_data and 'code' in resource_data['class']:
                params_to_extract.append({
                    'param_name': 'class',
                    'param_type': 'token',
                    'value_token_system': resource_data['class'].get('system'),
                    'value_token_code': resource_data['class']['code']
                })
            
            # Type
            if 'type' in resource_data:
                for type_item in resource_data['type']:
                    if 'coding' in type_item:
                        for coding in type_item['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'type',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Subject reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                
                # Also extract patient-specific reference
                # Handle both Patient/ and urn:uuid: formats
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Date/Period
            if 'period' in resource_data:
                if 'start' in resource_data['period']:
                    try:
                        period_start = datetime.fromisoformat(
                            resource_data['period']['start'].replace('Z', '+00:00')
                        )
                        params_to_extract.append({
                            'param_name': 'date',
                            'param_type': 'date',
                            'value_date': period_start
                        })
                    except (ValueError, TypeError) as e:
                        logging.warning(f"WARNING: Could not parse period.start: {resource_data.get('period', {}).get('start')} - {e}")
            
            # Participant references (CRIT-002-Multiple)
            if 'participant' in resource_data:
                for participant in resource_data['participant']:
                    if 'individual' in participant and 'reference' in participant['individual']:
                        ref = participant['individual']['reference']
                        params_to_extract.append({
                            'param_name': 'participant',
                            'param_type': 'reference',
                            'value_string': ref
                        })
                        # Also extract as practitioner if reference is to Practitioner
                        if ref.startswith('Practitioner/'):
                            params_to_extract.append({
                                'param_name': 'practitioner',
                                'param_type': 'reference',
                                'value_string': ref
                            })
        
        elif resource_type == 'Procedure':
            # Code
            if 'code' in resource_data and 'coding' in resource_data['code']:
                for coding in resource_data['code']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Subject reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                
                # Also extract patient-specific reference
                # Handle both Patient/ and urn:uuid: formats
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Performed date
            if 'performedDateTime' in resource_data:
                try:
                    performed_date = datetime.fromisoformat(
                        resource_data['performedDateTime'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': performed_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse performedDateTime: {resource_data.get('performedDateTime')} - {e}")
            elif 'performedPeriod' in resource_data and 'start' in resource_data['performedPeriod']:
                try:
                    performed_date = datetime.fromisoformat(
                        resource_data['performedPeriod']['start'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': performed_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse performedPeriod.start: {resource_data.get('performedPeriod', {}).get('start')} - {e}")
            
            # Performer references (CRIT-002-Multiple)
            if 'performer' in resource_data:
                for performer in resource_data['performer']:
                    if 'actor' in performer and 'reference' in performer['actor']:
                        ref = performer['actor']['reference']
                        params_to_extract.append({
                            'param_name': 'performer',
                            'param_type': 'reference',
                            'value_string': ref
                        })
        
        elif resource_type == 'Immunization':
            # Vaccine code
            if 'vaccineCode' in resource_data and 'coding' in resource_data['vaccineCode']:
                for coding in resource_data['vaccineCode']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'vaccine-code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Patient reference
            if 'patient' in resource_data and 'reference' in resource_data['patient']:
                ref = resource_data['patient']['reference']
                params_to_extract.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_string': ref
                })
            
            # Date
            if 'occurrenceDateTime' in resource_data:
                try:
                    occurrence_date = datetime.fromisoformat(
                        resource_data['occurrenceDateTime'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': occurrence_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse occurrenceDateTime: {resource_data.get('occurrenceDateTime')} - {e}")
            
            # Performer references (CRIT-002-Multiple)
            if 'performer' in resource_data:
                for performer in resource_data['performer']:
                    if 'actor' in performer and 'reference' in performer['actor']:
                        ref = performer['actor']['reference']
                        params_to_extract.append({
                            'param_name': 'performer',
                            'param_type': 'reference',
                            'value_string': ref
                        })
        
        elif resource_type == 'AllergyIntolerance':
            # Code
            if 'code' in resource_data and 'coding' in resource_data['code']:
                for coding in resource_data['code']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Clinical status
            if 'clinicalStatus' in resource_data and 'coding' in resource_data['clinicalStatus']:
                for coding in resource_data['clinicalStatus']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'clinical-status',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Verification status (CRIT-002-ALL)
            if 'verificationStatus' in resource_data and 'coding' in resource_data['verificationStatus']:
                for coding in resource_data['verificationStatus']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'verification-status',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Criticality (CRIT-002-ALL) 
            if 'criticality' in resource_data:
                params_to_extract.append({
                    'param_name': 'criticality',
                    'param_type': 'token',
                    'value_token_code': resource_data['criticality']
                })
            
            # Patient reference
            if 'patient' in resource_data and 'reference' in resource_data['patient']:
                ref = resource_data['patient']['reference']
                params_to_extract.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_string': ref
                })
        
        elif resource_type == 'DiagnosticReport':
            # Code
            if 'code' in resource_data and 'coding' in resource_data['code']:
                for coding in resource_data['code']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Subject reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                
                # Also extract patient-specific reference
                # Handle both Patient/ and urn:uuid: formats
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Date
            if 'effectiveDateTime' in resource_data:
                try:
                    effective_date = datetime.fromisoformat(
                        resource_data['effectiveDateTime'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': effective_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse effectiveDateTime: {resource_data.get('effectiveDateTime')} - {e}")
            
            # Performer references (CRIT-002-Multiple)
            if 'performer' in resource_data:
                for performer in resource_data['performer']:
                    if 'reference' in performer:
                        ref = performer['reference']
                        params_to_extract.append({
                            'param_name': 'performer',
                            'param_type': 'reference',
                            'value_string': ref
                        })
        
        elif resource_type == 'CarePlan':
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Subject reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                
                # Also extract patient-specific reference
                # Handle both Patient/ and urn:uuid: formats
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Date
            if 'period' in resource_data and 'start' in resource_data['period']:
                try:
                    period_start = datetime.fromisoformat(
                        resource_data['period']['start'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': period_start
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse period.start: {resource_data.get('period', {}).get('start')} - {e}")
        
        elif resource_type == 'ImagingStudy':
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Subject reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                
                # Also extract patient-specific reference
                # Handle both Patient/ and urn:uuid: formats
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Started date
            if 'started' in resource_data:
                try:
                    started_date = datetime.fromisoformat(
                        resource_data['started'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'started',
                        'param_type': 'date',
                        'value_date': started_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse started: {resource_data.get('started')} - {e}")
            
            # Performer references (CRIT-002-Multiple)
            if 'series' in resource_data:
                for series in resource_data['series']:
                    if 'performer' in series:
                        for performer in series['performer']:
                            if 'actor' in performer and 'reference' in performer['actor']:
                                ref = performer['actor']['reference']
                                params_to_extract.append({
                                    'param_name': 'performer',
                                    'param_type': 'reference',
                                    'value_string': ref
                                })
        
        elif resource_type == 'Coverage':
            # FHIR R4 Coverage search parameters for insurance verification workflows
            # Comprehensive implementation for revenue cycle management
            
            # Status (required) - active, cancelled, draft, entered-in-error
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Beneficiary (required) - the covered party
            if 'beneficiary' in resource_data and 'reference' in resource_data['beneficiary']:
                params_to_extract.append({
                    'param_name': 'beneficiary',
                    'param_type': 'reference',
                    'value_string': resource_data['beneficiary']['reference']
                })
            
            # Subscriber - the subscriber to the plan
            if 'subscriber' in resource_data and 'reference' in resource_data['subscriber']:
                params_to_extract.append({
                    'param_name': 'subscriber',
                    'param_type': 'reference',
                    'value_string': resource_data['subscriber']['reference']
                })
            
            # PolicyHolder - owner of the policy
            if 'policyHolder' in resource_data and 'reference' in resource_data['policyHolder']:
                params_to_extract.append({
                    'param_name': 'policy-holder',
                    'param_type': 'reference',
                    'value_string': resource_data['policyHolder']['reference']
                })
            
            # Payor - the insurer/payor
            if 'payor' in resource_data:
                for payor in resource_data['payor']:
                    if 'reference' in payor:
                        params_to_extract.append({
                            'param_name': 'payor',
                            'param_type': 'reference',
                            'value_string': payor['reference']
                        })
            
            # Type - coverage category
            if 'type' in resource_data:
                coverage_type = resource_data['type']
                if 'coding' in coverage_type:
                    for coding in coverage_type['coding']:
                        if 'code' in coding:
                            params_to_extract.append({
                                'param_name': 'type',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
            
            # Class - coverage class information
            if 'class' in resource_data:
                for coverage_class in resource_data['class']:
                    # Class type
                    if 'type' in coverage_class and 'coding' in coverage_class['type']:
                        for coding in coverage_class['type']['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'class-type',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
                    
                    # Class value
                    if 'value' in coverage_class:
                        params_to_extract.append({
                            'param_name': 'class-value',
                            'param_type': 'string',
                            'value_string': coverage_class['value']
                        })
            
            # Dependent - dependent number
            if 'dependent' in resource_data:
                params_to_extract.append({
                    'param_name': 'dependent',
                    'param_type': 'string',
                    'value_string': resource_data['dependent']
                })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        elif resource_type == 'Claim':
            # FHIR R4 Claim search parameters for medical billing workflows
            # Enhanced implementation for claims processing and revenue cycle management
            
            # Status (required) - active, cancelled, draft, entered-in-error
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Use (required) - claim, preauthorization, predetermination
            if 'use' in resource_data:
                params_to_extract.append({
                    'param_name': 'use',
                    'param_type': 'token',
                    'value_token_code': resource_data['use']
                })
            
            # Patient reference (required)
            if 'patient' in resource_data and 'reference' in resource_data['patient']:
                params_to_extract.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_string': resource_data['patient']['reference']
                })
            
            # Insurer (required) - the insurer organization
            if 'insurer' in resource_data and 'reference' in resource_data['insurer']:
                params_to_extract.append({
                    'param_name': 'insurer',
                    'param_type': 'reference',
                    'value_string': resource_data['insurer']['reference']
                })
            
            # Provider (required) - the provider of services
            if 'provider' in resource_data and 'reference' in resource_data['provider']:
                params_to_extract.append({
                    'param_name': 'provider',
                    'param_type': 'reference',
                    'value_string': resource_data['provider']['reference']
                })
            
            # Created date (required)
            if 'created' in resource_data:
                try:
                    created_date = datetime.fromisoformat(
                        resource_data['created'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'created',
                        'param_type': 'date',
                        'value_date': created_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse created: {resource_data.get('created')} - {e}")
            
            # Priority - claim priority
            if 'priority' in resource_data and 'coding' in resource_data['priority']:
                for coding in resource_data['priority']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'priority',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Encounter reference
            if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
                params_to_extract.append({
                    'param_name': 'encounter',
                    'param_type': 'reference',
                    'value_string': resource_data['encounter']['reference']
                })
            
            # Care team members
            if 'careTeam' in resource_data:
                for care_team_member in resource_data['careTeam']:
                    if 'provider' in care_team_member and 'reference' in care_team_member['provider']:
                        params_to_extract.append({
                            'param_name': 'care-team',
                            'param_type': 'reference',
                            'value_string': care_team_member['provider']['reference']
                        })
            
            # Insurance references
            if 'insurance' in resource_data:
                for insurance in resource_data['insurance']:
                    if 'coverage' in insurance and 'reference' in insurance['coverage']:
                        params_to_extract.append({
                            'param_name': 'coverage',
                            'param_type': 'reference',
                            'value_string': insurance['coverage']['reference']
                        })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        elif resource_type == 'ExplanationOfBenefit':
            # FHIR R4 ExplanationOfBenefit search parameters for payment processing workflows
            # Enhanced implementation for claims adjudication and payment tracking
            
            # Status (required) - active, cancelled, draft, entered-in-error
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Patient reference (required)
            if 'patient' in resource_data and 'reference' in resource_data['patient']:
                params_to_extract.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_string': resource_data['patient']['reference']
                })
            
            # Insurer (required) - the insurer organization
            if 'insurer' in resource_data and 'reference' in resource_data['insurer']:
                params_to_extract.append({
                    'param_name': 'insurer',
                    'param_type': 'reference',
                    'value_string': resource_data['insurer']['reference']
                })
            
            # Provider - the provider of services
            if 'provider' in resource_data and 'reference' in resource_data['provider']:
                params_to_extract.append({
                    'param_name': 'provider',
                    'param_type': 'reference',
                    'value_string': resource_data['provider']['reference']
                })
            
            # Created date (required)
            if 'created' in resource_data:
                try:
                    created_date = datetime.fromisoformat(
                        resource_data['created'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'created',
                        'param_type': 'date',
                        'value_date': created_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse created: {resource_data.get('created')} - {e}")
            
            # Claim reference - reference to the original claim
            if 'claim' in resource_data and 'reference' in resource_data['claim']:
                params_to_extract.append({
                    'param_name': 'claim',
                    'param_type': 'reference',
                    'value_string': resource_data['claim']['reference']
                })
            
            # Coverage references
            if 'insurance' in resource_data:
                for insurance in resource_data['insurance']:
                    if 'coverage' in insurance and 'reference' in insurance['coverage']:
                        params_to_extract.append({
                            'param_name': 'coverage',
                            'param_type': 'reference',
                            'value_string': insurance['coverage']['reference']
                        })
            
            # Disposition - claim disposition
            if 'disposition' in resource_data:
                params_to_extract.append({
                    'param_name': 'disposition',
                    'param_type': 'string',
                    'value_string': resource_data['disposition']
                })
            
            # Outcome - claim outcome
            if 'outcome' in resource_data:
                params_to_extract.append({
                    'param_name': 'outcome',
                    'param_type': 'token',
                    'value_token_code': resource_data['outcome']
                })
            
            # Encounter reference
            if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
                params_to_extract.append({
                    'param_name': 'encounter',
                    'param_type': 'reference',
                    'value_string': resource_data['encounter']['reference']
                })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        elif resource_type == 'Device':
            # FHIR R4 Device search parameters for medical equipment management
            # Comprehensive implementation for device tracking and maintenance
            
            # Status - active, inactive, entered-in-error, unknown
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Patient reference - device assigned to patient
            if 'patient' in resource_data and 'reference' in resource_data['patient']:
                params_to_extract.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_string': resource_data['patient']['reference']
                })
            
            # Location reference - current location of device
            if 'location' in resource_data and 'reference' in resource_data['location']:
                params_to_extract.append({
                    'param_name': 'location',
                    'param_type': 'reference',
                    'value_string': resource_data['location']['reference']
                })
            
            # Organization reference - owning organization
            if 'owner' in resource_data and 'reference' in resource_data['owner']:
                params_to_extract.append({
                    'param_name': 'organization',
                    'param_type': 'reference',
                    'value_string': resource_data['owner']['reference']
                })
            
            # Device type
            if 'type' in resource_data and 'coding' in resource_data['type']:
                for coding in resource_data['type']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'type',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Manufacturer
            if 'manufacturer' in resource_data:
                params_to_extract.append({
                    'param_name': 'manufacturer',
                    'param_type': 'string',
                    'value_string': resource_data['manufacturer']
                })
            
            # Model number
            if 'modelNumber' in resource_data:
                params_to_extract.append({
                    'param_name': 'model',
                    'param_type': 'string',
                    'value_string': resource_data['modelNumber']
                })
            
            # UDI (Unique Device Identifier)
            if 'udiCarrier' in resource_data:
                for udi in resource_data['udiCarrier']:
                    if 'deviceIdentifier' in udi:
                        params_to_extract.append({
                            'param_name': 'udi-di',
                            'param_type': 'string',
                            'value_string': udi['deviceIdentifier']
                        })
                    if 'carrierHRF' in udi:
                        params_to_extract.append({
                            'param_name': 'udi-carrier',
                            'param_type': 'string',
                            'value_string': udi['carrierHRF']
                        })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        elif resource_type == 'Goal':
            # FHIR R4 Goal search parameters for care planning workflows
            # Comprehensive implementation for goal management and tracking
            
            # LifecycleStatus (required) - proposed, planned, accepted, active, on-hold, completed, cancelled, entered-in-error, rejected
            if 'lifecycleStatus' in resource_data:
                params_to_extract.append({
                    'param_name': 'lifecycle-status',
                    'param_type': 'token',
                    'value_token_code': resource_data['lifecycleStatus']
                })
            
            # AchievementStatus - in-progress, improving, worsening, no-change, achieved, sustaining, not-achieved, no-progress, not-attainable
            if 'achievementStatus' in resource_data and 'coding' in resource_data['achievementStatus']:
                for coding in resource_data['achievementStatus']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'achievement-status',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Subject (patient) reference - who the goal is for
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                subject_ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': subject_ref
                })
                # Also index as 'patient' for compatibility
                params_to_extract.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_string': subject_ref
                })
            
            # Category - goal category
            if 'category' in resource_data:
                for category in resource_data['category']:
                    if 'coding' in category:
                        for coding in category['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'category',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Start date
            if 'startDate' in resource_data:
                try:
                    start_date = datetime.strptime(resource_data['startDate'], '%Y-%m-%d') if isinstance(resource_data['startDate'], str) else resource_data['startDate']
                    params_to_extract.append({
                        'param_name': 'start-date',
                        'param_type': 'date',
                        'value_date': start_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse goal start date: {resource_data.get('startDate')} - {e}")
            
            # Target dates
            if 'target' in resource_data:
                for target in resource_data['target']:
                    if 'dueDate' in target:
                        try:
                            due_date = datetime.strptime(target['dueDate'], '%Y-%m-%d') if isinstance(target['dueDate'], str) else target['dueDate']
                            params_to_extract.append({
                                'param_name': 'target-date',
                                'param_type': 'date',
                                'value_date': due_date
                            })
                        except (ValueError, TypeError) as e:
                            logging.warning(f"WARNING: Could not parse goal target date: {target.get('dueDate')} - {e}")
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        elif resource_type == 'Media':
            # FHIR R4 Media search parameters for multimedia content management
            # Comprehensive implementation for imaging and media workflows
            
            # Status (required) - preparation, in-progress, not-done, on-hold, stopped, completed, entered-in-error, unknown
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Subject (patient) reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                subject_ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': subject_ref
                })
                # Also index as 'patient' for compatibility
                params_to_extract.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_string': subject_ref
                })
            
            # Type - photo, video, audio
            if 'type' in resource_data and 'coding' in resource_data['type']:
                for coding in resource_data['type']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'type',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Modality - imaging modality (CT, MR, US, etc.)
            if 'modality' in resource_data and 'coding' in resource_data['modality']:
                for coding in resource_data['modality']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'modality',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Created date/time
            if 'createdDateTime' in resource_data:
                try:
                    created_date = datetime.fromisoformat(
                        resource_data['createdDateTime'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'created',
                        'param_type': 'date',
                        'value_date': created_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse media created date: {resource_data.get('createdDateTime')} - {e}")
            
            # Operator - who created the media
            if 'operator' in resource_data and 'reference' in resource_data['operator']:
                params_to_extract.append({
                    'param_name': 'operator',
                    'param_type': 'reference',
                    'value_string': resource_data['operator']['reference']
                })
            
            # Encounter reference
            if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
                params_to_extract.append({
                    'param_name': 'encounter',
                    'param_type': 'reference',
                    'value_string': resource_data['encounter']['reference']
                })
            
            # BasedOn - what the media is based on (ServiceRequest, etc.)
            if 'basedOn' in resource_data:
                for based_on in resource_data['basedOn']:
                    if 'reference' in based_on:
                        params_to_extract.append({
                            'param_name': 'based-on',
                            'param_type': 'reference',
                            'value_string': based_on['reference']
                        })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        elif resource_type == 'AuditEvent':
            # FHIR R4 AuditEvent search parameters for security audit trails
            # Comprehensive implementation for compliance and security monitoring
            
            # Action - C (Create), R (Read), U (Update), D (Delete), E (Execute)
            if 'action' in resource_data:
                params_to_extract.append({
                    'param_name': 'action',
                    'param_type': 'token',
                    'value_token_code': resource_data['action']
                })
            
            # Outcome - 0 (Success), 4 (Minor failure), 8 (Serious failure), 12 (Major failure)
            if 'outcome' in resource_data:
                params_to_extract.append({
                    'param_name': 'outcome',
                    'param_type': 'token',
                    'value_token_code': resource_data['outcome']
                })
            
            # Recorded date - when the event was recorded
            if 'recorded' in resource_data:
                try:
                    recorded_date = datetime.fromisoformat(
                        resource_data['recorded'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': recorded_date
                    })
                    # Also index as 'recorded'
                    params_to_extract.append({
                        'param_name': 'recorded',
                        'param_type': 'date',
                        'value_date': recorded_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse audit recorded date: {resource_data.get('recorded')} - {e}")
            
            # Type - the type of event
            if 'type' in resource_data:
                audit_type = resource_data['type']
                if 'code' in audit_type:
                    params_to_extract.append({
                        'param_name': 'type',
                        'param_type': 'token',
                        'value_token_system': audit_type.get('system'),
                        'value_token_code': audit_type['code']
                    })
            
            # Subtype - more specific event classification
            if 'subtype' in resource_data:
                for subtype in resource_data['subtype']:
                    if 'code' in subtype:
                        params_to_extract.append({
                            'param_name': 'subtype',
                            'param_type': 'token',
                            'value_token_system': subtype.get('system'),
                            'value_token_code': subtype['code']
                        })
            
            # Agent - who performed the action
            if 'agent' in resource_data:
                for agent in resource_data['agent']:
                    if 'who' in agent and 'reference' in agent['who']:
                        params_to_extract.append({
                            'param_name': 'agent',
                            'param_type': 'reference',
                            'value_string': agent['who']['reference']
                        })
                    
                    # Agent name
                    if 'name' in agent:
                        params_to_extract.append({
                            'param_name': 'agent-name',
                            'param_type': 'string',
                            'value_string': agent['name']
                        })
                    
                    # Agent role
                    if 'type' in agent and 'coding' in agent['type']:
                        for coding in agent['type']['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'agent-role',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Source - audit event source
            if 'source' in resource_data:
                source = resource_data['source']
                if 'observer' in source and 'reference' in source['observer']:
                    params_to_extract.append({
                        'param_name': 'source',
                        'param_type': 'reference',
                        'value_string': source['observer']['reference']
                    })
                
                # Source site
                if 'site' in source:
                    params_to_extract.append({
                        'param_name': 'site',
                        'param_type': 'string',
                        'value_string': source['site']
                    })
            
            # Entity - what was accessed/modified
            if 'entity' in resource_data:
                for entity in resource_data['entity']:
                    if 'what' in entity and 'reference' in entity['what']:
                        params_to_extract.append({
                            'param_name': 'entity',
                            'param_type': 'reference',
                            'value_string': entity['what']['reference']
                        })
                    
                    # Entity name
                    if 'name' in entity:
                        params_to_extract.append({
                            'param_name': 'entity-name',
                            'param_type': 'string',
                            'value_string': entity['name']
                        })
                    
                    # Entity type
                    if 'type' in entity and 'code' in entity['type']:
                        params_to_extract.append({
                            'param_name': 'entity-type',
                            'param_type': 'token',
                            'value_token_system': entity['type'].get('system'),
                            'value_token_code': entity['type']['code']
                        })
        
        elif resource_type == 'Practitioner':
            # Name (family and given)
            if 'name' in resource_data:
                for name in resource_data['name']:
                    if 'family' in name:
                        params_to_extract.append({
                            'param_name': 'family',
                            'param_type': 'string',
                            'value_string': name['family']
                        })
                        params_to_extract.append({
                            'param_name': 'name',
                            'param_type': 'string',
                            'value_string': name['family']
                        })
                    if 'given' in name:
                        for given in name['given']:
                            params_to_extract.append({
                                'param_name': 'given',
                                'param_type': 'string',
                                'value_string': given
                            })
                            params_to_extract.append({
                                'param_name': 'name',
                                'param_type': 'string',
                                'value_string': given
                            })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
            
            # Active status
            if 'active' in resource_data:
                params_to_extract.append({
                    'param_name': 'active',
                    'param_type': 'token',
                    'value_token_code': str(resource_data['active']).lower()
                })
            
            # Gender
            if 'gender' in resource_data:
                params_to_extract.append({
                    'param_name': 'gender',
                    'param_type': 'token',
                    'value_token_code': resource_data['gender']
                })
            
            # Telecom (email and phone)
            if 'telecom' in resource_data:
                for telecom in resource_data['telecom']:
                    if 'value' in telecom and 'system' in telecom:
                        # General telecom parameter
                        params_to_extract.append({
                            'param_name': 'telecom',
                            'param_type': 'token',
                            'value_token_system': telecom['system'],
                            'value_token_code': telecom['value']
                        })
                        
                        # Specific system parameters
                        if telecom['system'] == 'email':
                            params_to_extract.append({
                                'param_name': 'email',
                                'param_type': 'token',
                                'value_token_code': telecom['value']
                            })
                        elif telecom['system'] == 'phone':
                            params_to_extract.append({
                                'param_name': 'phone',
                                'param_type': 'token',
                                'value_token_code': telecom['value']
                            })
            
            # Address
            if 'address' in resource_data:
                for address in resource_data['address']:
                    # Full address string
                    address_parts = []
                    if 'line' in address:
                        address_parts.extend(address['line'])
                    if 'city' in address:
                        address_parts.append(address['city'])
                        params_to_extract.append({
                            'param_name': 'address-city',
                            'param_type': 'string',
                            'value_string': address['city']
                        })
                    if 'state' in address:
                        address_parts.append(address['state'])
                        params_to_extract.append({
                            'param_name': 'address-state',
                            'param_type': 'string',
                            'value_string': address['state']
                        })
                    if 'postalCode' in address:
                        address_parts.append(address['postalCode'])
                    
                    if address_parts:
                        params_to_extract.append({
                            'param_name': 'address',
                            'param_type': 'string',
                            'value_string': ' '.join(address_parts)
                        })
            
            # Communication
            if 'communication' in resource_data:
                for communication in resource_data['communication']:
                    if 'coding' in communication:
                        for coding in communication['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'communication',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
        
        elif resource_type == 'Organization':
            # Name
            if 'name' in resource_data:
                params_to_extract.append({
                    'param_name': 'name',
                    'param_type': 'string',
                    'value_string': resource_data['name']
                })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
            
            # Type
            if 'type' in resource_data:
                for org_type in resource_data['type']:
                    if 'coding' in org_type:
                        for coding in org_type['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'type',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Active status
            if 'active' in resource_data:
                params_to_extract.append({
                    'param_name': 'active',
                    'param_type': 'token',
                    'value_token_code': str(resource_data['active']).lower()
                })
            
            # Part of (organizational hierarchy)
            if 'partOf' in resource_data and 'reference' in resource_data['partOf']:
                params_to_extract.append({
                    'param_name': 'partof',
                    'param_type': 'reference',
                    'value_string': resource_data['partOf']['reference']
                })
            
            # Address
            if 'address' in resource_data:
                for address in resource_data['address']:
                    # Full address string
                    address_parts = []
                    if 'line' in address:
                        address_parts.extend(address['line'])
                    if 'city' in address:
                        address_parts.append(address['city'])
                        params_to_extract.append({
                            'param_name': 'address-city',
                            'param_type': 'string',
                            'value_string': address['city']
                        })
                    if 'state' in address:
                        address_parts.append(address['state'])
                    if 'postalCode' in address:
                        address_parts.append(address['postalCode'])
                    
                    if address_parts:
                        params_to_extract.append({
                            'param_name': 'address',
                            'param_type': 'string',
                            'value_string': ' '.join(address_parts)
                        })
            
            # Endpoint
            if 'endpoint' in resource_data:
                for endpoint in resource_data['endpoint']:
                    if 'reference' in endpoint:
                        params_to_extract.append({
                            'param_name': 'endpoint',
                            'param_type': 'reference',
                            'value_string': endpoint['reference']
                        })
        
        elif resource_type == 'PractitionerRole':
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
            
            # Practitioner reference
            if 'practitioner' in resource_data and 'reference' in resource_data['practitioner']:
                params_to_extract.append({
                    'param_name': 'practitioner',
                    'param_type': 'reference',
                    'value_string': resource_data['practitioner']['reference']
                })
            
            # Organization reference
            if 'organization' in resource_data and 'reference' in resource_data['organization']:
                params_to_extract.append({
                    'param_name': 'organization',
                    'param_type': 'reference',
                    'value_string': resource_data['organization']['reference']
                })
            
            # Location references
            if 'location' in resource_data:
                for location in resource_data['location']:
                    if 'reference' in location:
                        params_to_extract.append({
                            'param_name': 'location',
                            'param_type': 'reference',
                            'value_string': location['reference']
                        })
            
            # Specialty
            if 'specialty' in resource_data:
                for specialty in resource_data['specialty']:
                    if 'coding' in specialty:
                        for coding in specialty['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'specialty',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Role (code)
            if 'code' in resource_data:
                for code in resource_data['code']:
                    if 'coding' in code:
                        for coding in code['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'role',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Healthcare Service references
            if 'healthcareService' in resource_data:
                for service in resource_data['healthcareService']:
                    if 'reference' in service:
                        params_to_extract.append({
                            'param_name': 'service',
                            'param_type': 'reference',
                            'value_string': service['reference']
                        })
            
            # Active status
            if 'active' in resource_data:
                params_to_extract.append({
                    'param_name': 'active',
                    'param_type': 'token',
                    'value_token_code': str(resource_data['active']).lower()
                })
            
            # Period (date range)
            if 'period' in resource_data:
                if 'start' in resource_data['period']:
                    try:
                        start_date = datetime.fromisoformat(
                            resource_data['period']['start'].replace('Z', '+00:00')
                        )
                        params_to_extract.append({
                            'param_name': 'date',
                            'param_type': 'date',
                            'value_date': start_date
                        })
                        params_to_extract.append({
                            'param_name': 'period',
                            'param_type': 'date',
                            'value_date': start_date
                        })
                    except (ValueError, TypeError) as e:
                        logging.warning(f"WARNING: Could not parse period start: {resource_data['period'].get('start')} - {e}")
            
            # Endpoint references
            if 'endpoint' in resource_data:
                for endpoint in resource_data['endpoint']:
                    if 'reference' in endpoint:
                        params_to_extract.append({
                            'param_name': 'endpoint',
                            'param_type': 'reference',
                            'value_string': endpoint['reference']
                        })
        
        elif resource_type == 'Location':
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
            
            # Name
            if 'name' in resource_data:
                params_to_extract.append({
                    'param_name': 'name',
                    'param_type': 'string',
                    'value_string': resource_data['name']
                })
            
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Type
            if 'type' in resource_data:
                for location_type in resource_data['type']:
                    if 'coding' in location_type:
                        for coding in location_type['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'type',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Address
            if 'address' in resource_data:
                address = resource_data['address']
                # Full address string
                address_parts = []
                if 'line' in address:
                    address_parts.extend(address['line'])
                if 'city' in address:
                    address_parts.append(address['city'])
                    params_to_extract.append({
                        'param_name': 'address-city',
                        'param_type': 'string',
                        'value_string': address['city']
                    })
                if 'state' in address:
                    address_parts.append(address['state'])
                    params_to_extract.append({
                        'param_name': 'address-state',
                        'param_type': 'string',
                        'value_string': address['state']
                    })
                if 'postalCode' in address:
                    address_parts.append(address['postalCode'])
                    params_to_extract.append({
                        'param_name': 'address-postalcode',
                        'param_type': 'string',
                        'value_string': address['postalCode']
                    })
                
                if address_parts:
                    params_to_extract.append({
                        'param_name': 'address',
                        'param_type': 'string',
                        'value_string': ' '.join(address_parts)
                    })
            
            # Position (for geographic searches)
            if 'position' in resource_data:
                position = resource_data['position']
                if 'latitude' in position and 'longitude' in position:
                    # Store position for 'near' search parameter
                    # We'll implement the geographic distance calculation in the search logic
                    params_to_extract.append({
                        'param_name': 'near',
                        'param_type': 'special',
                        'value_string': f"{position['latitude']},{position['longitude']}"
                    })
            
            # Managing organization
            if 'managingOrganization' in resource_data and 'reference' in resource_data['managingOrganization']:
                params_to_extract.append({
                    'param_name': 'organization',
                    'param_type': 'reference',
                    'value_string': resource_data['managingOrganization']['reference']
                })
            
            # Part of (location hierarchy)
            if 'partOf' in resource_data and 'reference' in resource_data['partOf']:
                params_to_extract.append({
                    'param_name': 'partof',
                    'param_type': 'reference',
                    'value_string': resource_data['partOf']['reference']
                })
            
            # Endpoint references
            if 'endpoint' in resource_data:
                for endpoint in resource_data['endpoint']:
                    if 'reference' in endpoint:
                        params_to_extract.append({
                            'param_name': 'endpoint',
                            'param_type': 'reference',
                            'value_string': endpoint['reference']
                        })
        
        elif resource_type == 'DocumentReference':
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Doc status
            if 'docStatus' in resource_data:
                params_to_extract.append({
                    'param_name': 'doc-status',
                    'param_type': 'token',
                    'value_token_code': resource_data['docStatus']
                })
            
            # Type
            if 'type' in resource_data and 'coding' in resource_data['type']:
                for coding in resource_data['type']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'type',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Category
            if 'category' in resource_data:
                for category in resource_data['category']:
                    if 'coding' in category:
                        for coding in category['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'category',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Subject/Patient reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Author references
            if 'author' in resource_data:
                for author in resource_data['author']:
                    if 'reference' in author:
                        params_to_extract.append({
                            'param_name': 'author',
                            'param_type': 'reference',
                            'value_string': author['reference']
                        })
            
            # Date
            if 'date' in resource_data:
                try:
                    date_value = datetime.fromisoformat(
                        resource_data['date'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': date_value
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse date: {resource_data.get('date')} - {e}")
            
            # Encounter reference
            if 'context' in resource_data and 'encounter' in resource_data['context']:
                for encounter in resource_data['context']['encounter']:
                    if 'reference' in encounter:
                        params_to_extract.append({
                            'param_name': 'encounter',
                            'param_type': 'reference',
                            'value_string': encounter['reference']
                        })
            
            # Facility (from context.facilityType)
            if 'context' in resource_data and 'facilityType' in resource_data['context']:
                facility_type = resource_data['context']['facilityType']
                if 'coding' in facility_type:
                    for coding in facility_type['coding']:
                        if 'code' in coding:
                            params_to_extract.append({
                                'param_name': 'facility',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
            
            # Period (from context.period)
            if 'context' in resource_data and 'period' in resource_data['context']:
                period = resource_data['context']['period']
                if 'start' in period:
                    try:
                        period_start = datetime.fromisoformat(
                            period['start'].replace('Z', '+00:00')
                        )
                        params_to_extract.append({
                            'param_name': 'period',
                            'param_type': 'date',
                            'value_date': period_start
                        })
                    except (ValueError, TypeError) as e:
                        logging.warning(f"WARNING: Could not parse period.start: {period.get('start')} - {e}")
                if 'end' in period:
                    try:
                        period_end = datetime.fromisoformat(
                            period['end'].replace('Z', '+00:00')
                        )
                        params_to_extract.append({
                            'param_name': 'period',
                            'param_type': 'date',
                            'value_date': period_end
                        })
                    except (ValueError, TypeError) as e:
                        logging.warning(f"WARNING: Could not parse period.end: {period.get('end')} - {e}")
            
            # RelatesTo
            if 'relatesTo' in resource_data:
                for relates in resource_data['relatesTo']:
                    if 'target' in relates and 'reference' in relates['target']:
                        params_to_extract.append({
                            'param_name': 'relatesto',
                            'param_type': 'reference',
                            'value_string': relates['target']['reference']
                        })
            
            # Security label
            if 'securityLabel' in resource_data:
                for label in resource_data['securityLabel']:
                    if 'coding' in label:
                        for coding in label['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'security-label',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Content format and size
            if 'content' in resource_data:
                for content in resource_data['content']:
                    # Format
                    if 'format' in content and 'code' in content['format']:
                        params_to_extract.append({
                            'param_name': 'content-format',
                            'param_type': 'token',
                            'value_token_system': content['format'].get('system'),
                            'value_token_code': content['format']['code']
                        })
                    
                    # Size
                    if 'attachment' in content and 'size' in content['attachment']:
                        try:
                            size_value = float(content['attachment']['size'])
                            params_to_extract.append({
                                'param_name': 'content-size',
                                'param_type': 'quantity',
                                'value_number': size_value
                            })
                        except (ValueError, TypeError) as e:
                            logging.warning(f"WARNING: Could not parse content size: {content['attachment'].get('size')} - {e}")
        
        elif resource_type == 'Communication':
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Category
            if 'category' in resource_data:
                for category in resource_data['category']:
                    if 'coding' in category:
                        for coding in category['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'category',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Priority
            if 'priority' in resource_data:
                params_to_extract.append({
                    'param_name': 'priority',
                    'param_type': 'token',
                    'value_token_code': resource_data['priority']
                })
            
            # Subject/Patient reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Encounter reference
            if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
                params_to_extract.append({
                    'param_name': 'encounter',
                    'param_type': 'reference',
                    'value_string': resource_data['encounter']['reference']
                })
            
            # Sender reference
            if 'sender' in resource_data and 'reference' in resource_data['sender']:
                params_to_extract.append({
                    'param_name': 'sender',
                    'param_type': 'reference',
                    'value_string': resource_data['sender']['reference']
                })
            
            # Recipient references
            if 'recipient' in resource_data:
                for recipient in resource_data['recipient']:
                    if 'reference' in recipient:
                        params_to_extract.append({
                            'param_name': 'recipient',
                            'param_type': 'reference',
                            'value_string': recipient['reference']
                        })
            
            # Sent date
            if 'sent' in resource_data:
                try:
                    sent_date = datetime.fromisoformat(
                        resource_data['sent'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'sent',
                        'param_type': 'date',
                        'value_date': sent_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse sent: {resource_data.get('sent')} - {e}")
            
            # Received date
            if 'received' in resource_data:
                try:
                    received_date = datetime.fromisoformat(
                        resource_data['received'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'received',
                        'param_type': 'date',
                        'value_date': received_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse received: {resource_data.get('received')} - {e}")
            
            # Medium
            if 'medium' in resource_data:
                for medium in resource_data['medium']:
                    if 'coding' in medium:
                        for coding in medium['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'medium',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
            
            # Based on references
            if 'basedOn' in resource_data:
                for based_on in resource_data['basedOn']:
                    if 'reference' in based_on:
                        params_to_extract.append({
                            'param_name': 'based-on',
                            'param_type': 'reference',
                            'value_string': based_on['reference']
                        })
            
            # Part of references
            if 'partOf' in resource_data:
                for part_of in resource_data['partOf']:
                    if 'reference' in part_of:
                        params_to_extract.append({
                            'param_name': 'part-of',
                            'param_type': 'reference',
                            'value_string': part_of['reference']
                        })
            
            # Reason references
            if 'reasonReference' in resource_data:
                for reason in resource_data['reasonReference']:
                    if 'reference' in reason:
                        params_to_extract.append({
                            'param_name': 'reason-reference',
                            'param_type': 'reference',
                            'value_string': reason['reference']
                        })
        
        elif resource_type == 'Task':
            # Status
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Business status
            if 'businessStatus' in resource_data and 'coding' in resource_data['businessStatus']:
                for coding in resource_data['businessStatus']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'business-status',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Intent
            if 'intent' in resource_data:
                params_to_extract.append({
                    'param_name': 'intent',
                    'param_type': 'token',
                    'value_token_code': resource_data['intent']
                })
            
            # Priority
            if 'priority' in resource_data:
                params_to_extract.append({
                    'param_name': 'priority',
                    'param_type': 'token',
                    'value_token_code': resource_data['priority']
                })
            
            # Code (task type)
            if 'code' in resource_data and 'coding' in resource_data['code']:
                for coding in resource_data['code']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'code',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # For/Subject/Patient reference
            if 'for' in resource_data and 'reference' in resource_data['for']:
                ref = resource_data['for']['reference']
                params_to_extract.append({
                    'param_name': 'for',
                    'param_type': 'reference',
                    'value_string': ref
                })
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': ref
                })
                if ref.startswith('Patient/') or ref.startswith('urn:uuid:'):
                    params_to_extract.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_string': ref
                    })
            
            # Owner reference
            if 'owner' in resource_data and 'reference' in resource_data['owner']:
                params_to_extract.append({
                    'param_name': 'owner',
                    'param_type': 'reference',
                    'value_string': resource_data['owner']['reference']
                })
            
            # Requester reference
            if 'requester' in resource_data and 'reference' in resource_data['requester']:
                params_to_extract.append({
                    'param_name': 'requester',
                    'param_type': 'reference',
                    'value_string': resource_data['requester']['reference']
                })
            
            # Focus reference
            if 'focus' in resource_data and 'reference' in resource_data['focus']:
                params_to_extract.append({
                    'param_name': 'focus',
                    'param_type': 'reference',
                    'value_string': resource_data['focus']['reference']
                })
            
            # Encounter reference
            if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
                params_to_extract.append({
                    'param_name': 'encounter',
                    'param_type': 'reference',
                    'value_string': resource_data['encounter']['reference']
                })
            
            # Authored on date
            if 'authoredOn' in resource_data:
                try:
                    authored_date = datetime.fromisoformat(
                        resource_data['authoredOn'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'authored-on',
                        'param_type': 'date',
                        'value_date': authored_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse authoredOn: {resource_data.get('authoredOn')} - {e}")
            
            # Last modified date
            if 'lastModified' in resource_data:
                try:
                    modified_date = datetime.fromisoformat(
                        resource_data['lastModified'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'modified',
                        'param_type': 'date',
                        'value_date': modified_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse lastModified: {resource_data.get('lastModified')} - {e}")
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
            
            # Part of references
            if 'partOf' in resource_data:
                for part_of in resource_data['partOf']:
                    if 'reference' in part_of:
                        params_to_extract.append({
                            'param_name': 'part-of',
                            'param_type': 'reference',
                            'value_string': part_of['reference']
                        })
            
            # Based on references
            if 'basedOn' in resource_data:
                for based_on in resource_data['basedOn']:
                    if 'reference' in based_on:
                        params_to_extract.append({
                            'param_name': 'based-on',
                            'param_type': 'reference',
                            'value_string': based_on['reference']
                        })
            
            # Reason references
            if 'reasonReference' in resource_data:
                for reason in resource_data['reasonReference']:
                    if 'reference' in reason:
                        params_to_extract.append({
                            'param_name': 'reason-reference',
                            'param_type': 'reference',
                            'value_string': reason['reference']
                        })
        
        elif resource_type == 'ServiceRequest':
            # FHIR R4 ServiceRequest search parameters for clinical ordering workflows
            # Comprehensive implementation supporting Orders and Results module integration
            
            # Status (required) - active, cancelled, completed, draft, entered-in-error, on-hold, revoked, unknown
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Intent (required) - directive, filler-order, instance-order, option, order, original-order, plan, proposal, reflex-order
            if 'intent' in resource_data:
                params_to_extract.append({
                    'param_name': 'intent',
                    'param_type': 'token',
                    'value_token_code': resource_data['intent']
                })
            
            # Priority - routine, urgent, asap, stat
            if 'priority' in resource_data:
                params_to_extract.append({
                    'param_name': 'priority',
                    'param_type': 'token',
                    'value_token_code': resource_data['priority']
                })
            
            # Category - laboratory, imaging, procedure, survey, etc.
            if 'category' in resource_data:
                for category in resource_data['category']:
                    if 'coding' in category:
                        for coding in category['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'category',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
                    if 'text' in category:
                        params_to_extract.append({
                            'param_name': 'category',
                            'param_type': 'string',
                            'value_string': category['text']
                        })
            
            # Code - what is being requested (LOINC, SNOMED, CPT, etc.)
            if 'code' in resource_data:
                code = resource_data['code']
                if 'coding' in code:
                    for coding in code['coding']:
                        if 'code' in coding:
                            params_to_extract.append({
                                'param_name': 'code',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
                if 'text' in code:
                    params_to_extract.append({
                        'param_name': 'code',
                        'param_type': 'string',
                        'value_string': code['text']
                    })
            
            # Subject (patient) reference - critical for patient-specific orders
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                subject_ref = resource_data['subject']['reference']
                params_to_extract.append({
                    'param_name': 'subject',
                    'param_type': 'reference',
                    'value_string': subject_ref
                })
                # Also index as 'patient' for compatibility
                params_to_extract.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_string': subject_ref
                })
            
            # Encounter reference - link to clinical encounter
            if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
                params_to_extract.append({
                    'param_name': 'encounter',
                    'param_type': 'reference',
                    'value_string': resource_data['encounter']['reference']
                })
            
            # Authored date - when the order was created
            if 'authoredOn' in resource_data:
                try:
                    authored_date = datetime.fromisoformat(
                        resource_data['authoredOn'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'authored',
                        'param_type': 'date',
                        'value_date': authored_date
                    })
                    # Also index as 'authoredon' for compatibility
                    params_to_extract.append({
                        'param_name': 'authoredon',
                        'param_type': 'date',
                        'value_date': authored_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse authoredOn date: {resource_data.get('authoredOn')} - {e}")
            
            # Occurrence date/time - when the service should be performed
            if 'occurrenceDateTime' in resource_data:
                try:
                    occurrence_date = datetime.fromisoformat(
                        resource_data['occurrenceDateTime'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'occurrence',
                        'param_type': 'date',
                        'value_date': occurrence_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse occurrenceDateTime: {resource_data.get('occurrenceDateTime')} - {e}")
            
            # Occurrence period
            if 'occurrencePeriod' in resource_data:
                period = resource_data['occurrencePeriod']
                if 'start' in period:
                    try:
                        start_date = datetime.fromisoformat(
                            period['start'].replace('Z', '+00:00')
                        )
                        params_to_extract.append({
                            'param_name': 'occurrence',
                            'param_type': 'date',
                            'value_date': start_date
                        })
                    except (ValueError, TypeError) as e:
                        logging.warning(f"WARNING: Could not parse occurrence period start: {period.get('start')} - {e}")
            
            # Requester - who requested the service
            if 'requester' in resource_data and 'reference' in resource_data['requester']:
                params_to_extract.append({
                    'param_name': 'requester',
                    'param_type': 'reference',
                    'value_string': resource_data['requester']['reference']
                })
            
            # Performer - who should perform the service
            if 'performer' in resource_data:
                for performer in resource_data['performer']:
                    if 'reference' in performer:
                        params_to_extract.append({
                            'param_name': 'performer',
                            'param_type': 'reference',
                            'value_string': performer['reference']
                        })
            
            # PerformerType - type of performer
            if 'performerType' in resource_data:
                performer_type = resource_data['performerType']
                if 'coding' in performer_type:
                    for coding in performer_type['coding']:
                        if 'code' in coding:
                            params_to_extract.append({
                                'param_name': 'performer-type',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
            
            # Specimen reference
            if 'specimen' in resource_data:
                for specimen in resource_data['specimen']:
                    if 'reference' in specimen:
                        params_to_extract.append({
                            'param_name': 'specimen',
                            'param_type': 'reference',
                            'value_string': specimen['reference']
                        })
            
            # BodySite - anatomical location
            if 'bodySite' in resource_data:
                for body_site in resource_data['bodySite']:
                    if 'coding' in body_site:
                        for coding in body_site['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'body-site',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # ReasonCode - coded reason for the request
            if 'reasonCode' in resource_data:
                for reason_code in resource_data['reasonCode']:
                    if 'coding' in reason_code:
                        for coding in reason_code['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'reason-code',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
                    if 'text' in reason_code:
                        params_to_extract.append({
                            'param_name': 'reason-code',
                            'param_type': 'string',
                            'value_string': reason_code['text']
                        })
            
            # ReasonReference - reference to condition or observation
            if 'reasonReference' in resource_data:
                for reason_ref in resource_data['reasonReference']:
                    if 'reference' in reason_ref:
                        params_to_extract.append({
                            'param_name': 'reason-reference',
                            'param_type': 'reference',
                            'value_string': reason_ref['reference']
                        })
            
            # Insurance references
            if 'insurance' in resource_data:
                for insurance in resource_data['insurance']:
                    if 'reference' in insurance:
                        params_to_extract.append({
                            'param_name': 'insurance',
                            'param_type': 'reference',
                            'value_string': insurance['reference']
                        })
            
            # Supporting info references
            if 'supportingInfo' in resource_data:
                for supporting_info in resource_data['supportingInfo']:
                    if 'reference' in supporting_info:
                        params_to_extract.append({
                            'param_name': 'supporting-info',
                            'param_type': 'reference',
                            'value_string': supporting_info['reference']
                        })
            
            # BasedOn - references to other requests this is based on
            if 'basedOn' in resource_data:
                for based_on in resource_data['basedOn']:
                    if 'reference' in based_on:
                        params_to_extract.append({
                            'param_name': 'based-on',
                            'param_type': 'reference',
                            'value_string': based_on['reference']
                        })
            
            # Replaces - references to requests this replaces
            if 'replaces' in resource_data:
                for replaces in resource_data['replaces']:
                    if 'reference' in replaces:
                        params_to_extract.append({
                            'param_name': 'replaces',
                            'param_type': 'reference',
                            'value_string': replaces['reference']
                        })
            
            # Identifiers - external identifiers for the service request
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        elif resource_type == 'Appointment':
            # FHIR R4 Appointment search parameters for healthcare scheduling workflows
            # Comprehensive implementation supporting Schedule module integration
            
            # Status (required) - proposed, pending, booked, arrived, fulfilled, cancelled, noshow, entered-in-error, checked-in, waitlist
            if 'status' in resource_data:
                params_to_extract.append({
                    'param_name': 'status',
                    'param_type': 'token',
                    'value_token_code': resource_data['status']
                })
            
            # Date - appointment start date and time (CRITICAL for scheduling)
            if 'start' in resource_data:
                try:
                    start_date = datetime.fromisoformat(
                        resource_data['start'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': start_date
                    })
                    # Also index as 'start' for compatibility
                    params_to_extract.append({
                        'param_name': 'start',
                        'param_type': 'date',
                        'value_date': start_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse appointment start date: {resource_data.get('start')} - {e}")
            
            # End date - appointment end time
            if 'end' in resource_data:
                try:
                    end_date = datetime.fromisoformat(
                        resource_data['end'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'end',
                        'param_type': 'date',
                        'value_date': end_date
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"WARNING: Could not parse appointment end date: {resource_data.get('end')} - {e}")
            
            # ServiceCategory - broad categorization of service
            if 'serviceCategory' in resource_data:
                for service_category in resource_data['serviceCategory']:
                    if 'coding' in service_category:
                        for coding in service_category['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'service-category',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # ServiceType - specific type of service
            if 'serviceType' in resource_data:
                for service_type in resource_data['serviceType']:
                    if 'coding' in service_type:
                        for coding in service_type['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'service-type',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Specialty - medical specialty required
            if 'specialty' in resource_data:
                for specialty in resource_data['specialty']:
                    if 'coding' in specialty:
                        for coding in specialty['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'specialty',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # AppointmentType - style of appointment or patient
            if 'appointmentType' in resource_data:
                appointment_type = resource_data['appointmentType']
                if 'coding' in appointment_type:
                    for coding in appointment_type['coding']:
                        if 'code' in coding:
                            params_to_extract.append({
                                'param_name': 'appointment-type',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
            
            # Priority - appointment priority
            if 'priority' in resource_data:
                params_to_extract.append({
                    'param_name': 'priority',
                    'param_type': 'number',
                    'value_number': resource_data['priority']
                })
            
            # Participants - extract patient, practitioner, location references
            if 'participant' in resource_data:
                for participant in resource_data['participant']:
                    if 'actor' in participant and 'reference' in participant['actor']:
                        actor_ref = participant['actor']['reference']
                        
                        # Generic participant search
                        params_to_extract.append({
                            'param_name': 'participant',
                            'param_type': 'reference',
                            'value_string': actor_ref
                        })
                        
                        # Specific participant type searches
                        if actor_ref.startswith('Patient/'):
                            params_to_extract.append({
                                'param_name': 'patient',
                                'param_type': 'reference',
                                'value_string': actor_ref
                            })
                        elif actor_ref.startswith('Practitioner/'):
                            params_to_extract.append({
                                'param_name': 'practitioner',
                                'param_type': 'reference',
                                'value_string': actor_ref
                            })
                        elif actor_ref.startswith('Location/'):
                            params_to_extract.append({
                                'param_name': 'location',
                                'param_type': 'reference',
                                'value_string': actor_ref
                            })
                        elif actor_ref.startswith('Device/'):
                            params_to_extract.append({
                                'param_name': 'device',
                                'param_type': 'reference',
                                'value_string': actor_ref
                            })
                        elif actor_ref.startswith('HealthcareService/'):
                            params_to_extract.append({
                                'param_name': 'healthcare-service',
                                'param_type': 'reference',
                                'value_string': actor_ref
                            })
                    
                    # Participant status
                    if 'status' in participant:
                        params_to_extract.append({
                            'param_name': 'participant-status',
                            'param_type': 'token',
                            'value_token_code': participant['status']
                        })
                    
                    # Participant required status
                    if 'required' in participant:
                        params_to_extract.append({
                            'param_name': 'participant-required',
                            'param_type': 'token',
                            'value_token_code': participant['required']
                        })
            
            # Slot references
            if 'slot' in resource_data:
                for slot in resource_data['slot']:
                    if 'reference' in slot:
                        params_to_extract.append({
                            'param_name': 'slot',
                            'param_type': 'reference',
                            'value_string': slot['reference']
                        })
            
            # Reason codes
            if 'reasonCode' in resource_data:
                for reason_code in resource_data['reasonCode']:
                    if 'coding' in reason_code:
                        for coding in reason_code['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'reason-code',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Reason references
            if 'reasonReference' in resource_data:
                for reason_ref in resource_data['reasonReference']:
                    if 'reference' in reason_ref:
                        params_to_extract.append({
                            'param_name': 'reason-reference',
                            'param_type': 'reference',
                            'value_string': reason_ref['reference']
                        })
            
            # Supporting information
            if 'supportingInformation' in resource_data:
                for supporting_info in resource_data['supportingInformation']:
                    if 'reference' in supporting_info:
                        params_to_extract.append({
                            'param_name': 'supporting-information',
                            'param_type': 'reference',
                            'value_string': supporting_info['reference']
                        })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        elif resource_type == 'Parameters':
            # Process Parameters resource for FHIR operations support
            
            # Extract each parameter within the Parameters resource
            if 'parameter' in resource_data:
                for param in resource_data['parameter']:
                    # Parameter name
                    if 'name' in param:
                        param_name = param['name']
                        params_to_extract.append({
                            'param_name': 'parameter',
                            'param_type': 'string',
                            'value_string': param_name
                        })
                        
                        # Also index as 'name' for backward compatibility
                        params_to_extract.append({
                            'param_name': 'name',
                            'param_type': 'string',
                            'value_string': param_name
                        })
                    
                    # Parameter values based on type
                    # String values
                    if 'valueString' in param:
                        params_to_extract.append({
                            'param_name': 'value-string',
                            'param_type': 'string',
                            'value_string': param['valueString']
                        })
                        # Generic value search
                        params_to_extract.append({
                            'param_name': 'value',
                            'param_type': 'string',
                            'value_string': param['valueString']
                        })
                    
                    # Boolean values
                    if 'valueBoolean' in param:
                        params_to_extract.append({
                            'param_name': 'value-boolean',
                            'param_type': 'token',
                            'value_token_code': str(param['valueBoolean']).lower()
                        })
                        params_to_extract.append({
                            'param_name': 'value',
                            'param_type': 'string',
                            'value_string': str(param['valueBoolean']).lower()
                        })
                    
                    # Integer values
                    if 'valueInteger' in param:
                        params_to_extract.append({
                            'param_name': 'value-integer',
                            'param_type': 'number',
                            'value_number': param['valueInteger']
                        })
                        params_to_extract.append({
                            'param_name': 'value',
                            'param_type': 'string',
                            'value_string': str(param['valueInteger'])
                        })
                    
                    # Decimal values
                    if 'valueDecimal' in param:
                        params_to_extract.append({
                            'param_name': 'value-decimal',
                            'param_type': 'number',
                            'value_number': param['valueDecimal']
                        })
                        params_to_extract.append({
                            'param_name': 'value',
                            'param_type': 'string',
                            'value_string': str(param['valueDecimal'])
                        })
                    
                    # Date values
                    if 'valueDate' in param:
                        try:
                            date_value = datetime.strptime(param['valueDate'], '%Y-%m-%d') if isinstance(param['valueDate'], str) else param['valueDate']
                            params_to_extract.append({
                                'param_name': 'value-date',
                                'param_type': 'date',
                                'value_date': date_value
                            })
                        except (ValueError, TypeError) as e:
                            logging.warning(f"WARNING: Could not parse valueDate: {param.get('valueDate')} - {e}")
                    
                    # DateTime values
                    if 'valueDateTime' in param:
                        try:
                            datetime_value = datetime.fromisoformat(
                                param['valueDateTime'].replace('Z', '+00:00')
                            )
                            params_to_extract.append({
                                'param_name': 'value-datetime',
                                'param_type': 'date',
                                'value_date': datetime_value
                            })
                        except (ValueError, TypeError) as e:
                            logging.warning(f"WARNING: Could not parse valueDateTime: {param.get('valueDateTime')} - {e}")
                    
                    # Time values
                    if 'valueTime' in param:
                        try:
                            # Convert time to datetime for consistency
                            time_str = param['valueTime']
                            time_value = datetime.strptime(f"1970-01-01T{time_str}", '%Y-%m-%dT%H:%M:%S')
                            params_to_extract.append({
                                'param_name': 'value-time',
                                'param_type': 'date',
                                'value_date': time_value
                            })
                        except (ValueError, TypeError) as e:
                            logging.warning(f"WARNING: Could not parse valueTime: {param.get('valueTime')} - {e}")
                    
                    # Code values
                    if 'valueCode' in param:
                        params_to_extract.append({
                            'param_name': 'value-code',
                            'param_type': 'token',
                            'value_token_code': param['valueCode']
                        })
                        params_to_extract.append({
                            'param_name': 'value',
                            'param_type': 'string',
                            'value_string': param['valueCode']
                        })
                    
                    # URI values
                    if 'valueUri' in param:
                        params_to_extract.append({
                            'param_name': 'value-uri',
                            'param_type': 'uri',
                            'value_string': param['valueUri']
                        })
                        params_to_extract.append({
                            'param_name': 'value',
                            'param_type': 'string',
                            'value_string': param['valueUri']
                        })
                    
                    # Reference values
                    if 'valueReference' in param and 'reference' in param['valueReference']:
                        params_to_extract.append({
                            'param_name': 'value-reference',
                            'param_type': 'reference',
                            'value_string': param['valueReference']['reference']
                        })
                    
                    # Quantity values
                    if 'valueQuantity' in param:
                        quantity = param['valueQuantity']
                        if 'value' in quantity:
                            params_to_extract.append({
                                'param_name': 'value-quantity',
                                'param_type': 'number',
                                'value_number': quantity['value']
                            })
                        # Also store unit information
                        if 'unit' in quantity:
                            params_to_extract.append({
                                'param_name': 'value',
                                'param_type': 'string',
                                'value_string': f"{quantity.get('value', '')} {quantity['unit']}"
                            })
                    
                    # Coding values
                    if 'valueCoding' in param:
                        coding = param['valueCoding']
                        if 'code' in coding:
                            params_to_extract.append({
                                'param_name': 'value-code',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
                        if 'display' in coding:
                            params_to_extract.append({
                                'param_name': 'value',
                                'param_type': 'string',
                                'value_string': coding['display']
                            })
                    
                    # CodeableConcept values
                    if 'valueCodeableConcept' in param:
                        concept = param['valueCodeableConcept']
                        if 'coding' in concept:
                            for coding in concept['coding']:
                                if 'code' in coding:
                                    params_to_extract.append({
                                        'param_name': 'value-code',
                                        'param_type': 'token',
                                        'value_token_system': coding.get('system'),
                                        'value_token_code': coding['code']
                                    })
                        if 'text' in concept:
                            params_to_extract.append({
                                'param_name': 'value',
                                'param_type': 'string',
                                'value_string': concept['text']
                            })
                    
                    # Nested parameters (recursive structure)
                    if 'part' in param:
                        for part in param['part']:
                            if 'name' in part:
                                params_to_extract.append({
                                    'param_name': 'parameter',
                                    'param_type': 'string',
                                    'value_string': f"{param.get('name', '')}.{part['name']}"
                                })
            
            # Meta parameters for operation context
            if 'meta' in resource_data:
                meta = resource_data['meta']
                # Extract operation context from meta tags
                if 'tag' in meta:
                    for tag in meta['tag']:
                        if tag.get('system') == 'http://hl7.org/fhir/operation':
                            params_to_extract.append({
                                'param_name': 'operation',
                                'param_type': 'string',
                                'value_string': tag.get('code', '')
                            })
                        elif tag.get('system') == 'http://hl7.org/fhir/operation-context':
                            params_to_extract.append({
                                'param_name': 'context',
                                'param_type': 'string',
                                'value_string': tag.get('code', '')
                            })
            
            # Identifiers
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier.get('system'),
                            'value_token_code': identifier['value']
                        })
        
        # Insert all search parameters
        logging.debug(f"DEBUG: Found {len(params_to_extract)} search parameters to store")
        for i, param in enumerate(params_to_extract):
            logging.debug(f"DEBUG: Param {i+1}: {param}")
            query = text("""
                INSERT INTO fhir.search_params (
                    resource_id, resource_type, param_name, param_type,
                    value_string, value_number, value_date,
                    value_token_system, value_token_code, value_reference
                ) VALUES (
                    :resource_id, :resource_type, :param_name, :param_type,
                    :value_string, :value_number, :value_date,
                    :value_token_system, :value_token_code, :value_reference
                )
            """)
            
            # Ensure numeric values are properly typed
            value_number = param.get('value_number')
            if value_number is not None:
                try:
                    value_number = float(value_number)
                except (ValueError, TypeError):
                    value_number = None
            
            params_dict = {
                'resource_id': resource_id,
                'resource_type': resource_type,
                'param_name': param['param_name'],
                'param_type': param['param_type'],
                'value_string': param.get('value_string'),
                'value_number': value_number,
                'value_date': param.get('value_date'),
                'value_token_system': param.get('value_token_system'),
                'value_token_code': param.get('value_token_code'),
                'value_reference': param.get('value_reference')
            }
            
            await self.session.execute(query, params_dict)
    
    async def _extract_references(
        self,
        resource_id: int,
        resource_data: Dict[str, Any],
        path: str = "",
        source_type: str = None
    ):
        """Extract and store references from a resource."""
        for key, value in resource_data.items():
            current_path = f"{path}.{key}" if path else key
            
            if key == 'reference' and isinstance(value, str):
                # Found a reference - extract target type and ID
                target_type = None
                target_id = None
                
                # Handle different reference formats
                if value.startswith('urn:uuid:'):
                    # Handle urn:uuid: format (common in Synthea data)
                    target_id = value.replace('urn:uuid:', '')
                    # For urn:uuid references, we need to determine the type from context
                    # This is typically found in the parent path (e.g., "subject", "patient", "encounter")
                    parent_key = path.split('.')[-1] if '.' in path else path
                    target_type = self._infer_resource_type_from_path(parent_key)
                elif '/' in value:
                    # Handle ResourceType/id format
                    parts = value.split('/', 1)
                    if len(parts) == 2:
                        target_type = parts[0]
                        target_id = parts[1]
                elif value.startswith('#'):
                    # Skip internal references (contained resources)
                    continue
                
                # Store the reference if we have both type and ID
                if target_type and target_id and source_type:
                    query = text("""
                        INSERT INTO fhir.references (
                            source_id, source_type, target_type, target_id,
                            reference_path, reference_value
                        ) VALUES (
                            :source_id, :source_type, :target_type, :target_id,
                            :reference_path, :reference_value
                        )
                    """)
                    
                    await self.session.execute(query, {
                        'source_id': resource_id,
                        'source_type': source_type,
                        'target_type': target_type,
                        'target_id': target_id,
                        'reference_path': path,  # Remove the .reference part for cleaner paths
                        'reference_value': value
                    })
            
            elif isinstance(value, dict):
                # Recurse into nested objects
                await self._extract_references(resource_id, value, current_path, source_type)
            
            elif isinstance(value, list):
                # Recurse into arrays
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        await self._extract_references(
                            resource_id, item, f"{current_path}[{i}]", source_type
                        )
    
    def _infer_resource_type_from_path(self, path_element: str) -> str:
        """Infer the resource type from the reference path element."""
        # Common FHIR reference field to resource type mappings
        reference_mappings = {
            'subject': 'Patient',  # Most common
            'patient': 'Patient',
            'encounter': 'Encounter',
            'author': 'Practitioner',
            'performer': 'Practitioner',
            'requester': 'Practitioner',
            'practitioner': 'Practitioner',
            'organization': 'Organization',
            'managingOrganization': 'Organization',
            'location': 'Location',
            'medicationReference': 'Medication',
            'medication': 'Medication',
            'basedOn': 'ServiceRequest',
            'partOf': 'Procedure',
            'reasonReference': 'Condition',
            'focus': 'Resource',  # Generic
            'context': 'Encounter',
            'supportingInformation': 'Resource',  # Could be various types
            'specimen': 'Specimen',
            'device': 'Device',
            'related': 'Resource',  # Generic
            'derivedFrom': 'Observation',
            'hasMember': 'Observation',
            'interpretation': 'Observation',
            'bodySite': 'BodyStructure',
            'method': 'Procedure',
            'component': 'Observation',
            'referenceRange': 'Observation',
            'member': 'Patient',
            'coverage': 'Coverage',
            'payor': 'Organization',
            'prescription': 'MedicationRequest',
            'authorizingPrescription': 'MedicationRequest',
            'request': 'MedicationRequest',
            'receiver': 'Patient',
            'destination': 'Location',
            'responsibleparty': 'Practitioner',
            'eventHistory': 'Provenance'
        }
        
        # Return the mapped type or 'Resource' as a fallback
        return reference_mappings.get(path_element, 'Resource')
    
    async def _delete_search_parameters(self, resource_id: int):
        """Delete all search parameters for a resource."""
        query = text("""
            DELETE FROM fhir.search_params
            WHERE resource_id = :resource_id
        """)
        await self.session.execute(query, {'resource_id': resource_id})
    
    async def _auto_link_observation_to_service_request(self, observation_id: int, observation_data: Dict[str, Any]):
        """
        Automatically link an Observation to a ServiceRequest based on matching criteria.
        
        Matching logic:
        1. Same patient
        2. Same test code (LOINC)
        3. Date proximity (result within 7 days of order)
        4. ServiceRequest status is 'active' or 'completed'
        """
        from datetime import timedelta
        
        print(f"\n=== AUTO-LINK: Starting auto-link for Observation ID {observation_id} ===")
        logging.info(f"DEBUG: Starting auto-link for Observation ID {observation_id}")
        
        # Extract observation details
        patient_ref = observation_data.get('subject', {}).get('reference', '')
        if not patient_ref:
            logging.info("DEBUG: No patient reference found in Observation")
            return
        
        # Extract LOINC codes from observation
        obs_codes = []
        if 'code' in observation_data and 'coding' in observation_data['code']:
            for coding in observation_data['code']['coding']:
                if coding.get('system') == 'http://loinc.org' and 'code' in coding:
                    obs_codes.append(coding['code'])
        
        logging.info(f"DEBUG: Found LOINC codes in Observation: {obs_codes}")
        
        if not obs_codes:
            logging.info("DEBUG: No LOINC codes found in Observation")
            return
        
        # Get observation date
        obs_date_str = observation_data.get('effectiveDateTime') or observation_data.get('issued')
        if not obs_date_str:
            return
        
        try:
            obs_date = datetime.fromisoformat(obs_date_str.replace('Z', '+00:00'))
        except:
            return
        
        # Search for matching ServiceRequests
        # Build search query for ServiceRequests with matching patient and date range
        min_date = (obs_date - timedelta(days=7)).isoformat()
        
        query = text("""
            SELECT r.fhir_id, r.resource
            FROM fhir.resources r
            WHERE r.resource_type = 'ServiceRequest'
            AND r.deleted = false
            AND r.resource->>'status' IN ('active', 'completed')
            AND r.resource->'subject'->>'reference' = :patient_ref
            AND (
                r.resource->'category' @> '[{"coding": [{"code": "laboratory"}]}]'::jsonb
                OR r.resource->'category' @> '[{"coding": [{"system": "http://snomed.info/sct", "code": "108252007"}]}]'::jsonb
            )
            AND COALESCE(
                r.resource->>'authoredOn',
                r.resource->>'occurrenceDateTime'
            ) >= :min_date
            ORDER BY r.last_updated DESC
        """)
        
        logging.info(f"DEBUG: Searching for ServiceRequests with patient_ref={patient_ref}, min_date={min_date}")
        
        result = await self.session.execute(query, {
            'patient_ref': patient_ref,
            'min_date': min_date
        })
        
        rows = list(result)
        print(f"=== AUTO-LINK: Found {len(rows)} ServiceRequests ===")
        logging.info(f"DEBUG: Found {len(rows)} ServiceRequests")
        
        best_match = None
        best_time_diff = timedelta(days=7)
        
        for row in result:
            sr_fhir_id, sr_resource = row
            sr_data = json.loads(sr_resource) if isinstance(sr_resource, str) else sr_resource
            
            # Extract ServiceRequest date
            sr_date_str = sr_data.get('authoredOn') or sr_data.get('occurrenceDateTime')
            if not sr_date_str:
                continue
            
            try:
                sr_date = datetime.fromisoformat(sr_date_str.replace('Z', '+00:00'))
            except:
                continue
            
            # Result should come after order
            if obs_date < sr_date:
                continue
            
            # Check if LOINC codes match
            sr_codes = []
            if 'code' in sr_data and 'coding' in sr_data['code']:
                for coding in sr_data['code']['coding']:
                    if coding.get('system') == 'http://loinc.org' and 'code' in coding:
                        sr_codes.append(coding['code'])
            
            # Check for matching codes
            print(f"=== AUTO-LINK: Comparing obs codes {obs_codes} with sr codes {sr_codes} ===")
            if not any(code in sr_codes for code in obs_codes):
                print(f"=== AUTO-LINK: No matching codes, skipping ===")
                continue
            
            # Calculate time difference
            time_diff = obs_date - sr_date
            
            # Check if this is a better match
            if time_diff < best_time_diff:
                best_match = sr_fhir_id
                best_time_diff = time_diff
        
        # If we found a match, update the observation
        if best_match:
            logging.info(f"DEBUG: Found match! Linking Observation to ServiceRequest {best_match}")
            
            # Add basedOn reference to the observation
            observation_data['basedOn'] = [{
                'reference': f'ServiceRequest/{best_match}',
                'type': 'ServiceRequest'
            }]
            
            # Update the observation in the database
            update_query = text("""
                UPDATE fhir.resources
                SET resource = :resource,
                    last_updated = CURRENT_TIMESTAMP,
                    version_id = version_id + 1
                WHERE id = :resource_id
            """)
            
            await self.session.execute(update_query, {
                'resource': json.dumps(observation_data, cls=FHIRJSONEncoder),
                'resource_id': observation_id
            })
            
            # Also update the ServiceRequest status to completed if it's active
            sr_update_query = text("""
                UPDATE fhir.resources
                SET resource = jsonb_set(resource, '{status}', '"completed"'::jsonb),
                    last_updated = CURRENT_TIMESTAMP,
                    version_id = version_id + 1
                WHERE resource_type = 'ServiceRequest'
                AND fhir_id = :fhir_id
                AND resource->>'status' = 'active'
            """)
            
            await self.session.execute(sr_update_query, {
                'fhir_id': best_match
            })
            
            logging.info(f"Auto-linked Observation {observation_data['id']} to ServiceRequest {best_match}")
        else:
            logging.info("DEBUG: No matching ServiceRequest found")
    
    async def create_clinical_workflow(
        self, 
        workflow_type: str,
        patient_ref: str,
        encounter_ref: Optional[str] = None,
        initiator_ref: Optional[str] = None,
        description: str = "",
        priority: str = "normal"
    ) -> Dict[str, str]:
        """
        Create a clinical workflow with linked Document-Communication-Task resources.
        
        Args:
            workflow_type: Type of workflow (e.g., 'consultation', 'referral', 'care_coordination')
            patient_ref: Patient reference (e.g., 'Patient/patient-id')
            encounter_ref: Optional encounter reference
            initiator_ref: Optional practitioner/organization reference
            description: Workflow description
            priority: Workflow priority ('low', 'normal', 'high', 'urgent')
            
        Returns:
            Dictionary with created resource IDs
        """
        workflow_id = str(uuid.uuid4())
        created_resources = {}
        
        # 1. Create DocumentReference for workflow documentation
        document_data = {
            "resourceType": "DocumentReference",
            "status": "current",
            "type": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "34133-9", 
                    "display": "Summary of care record"
                }]
            },
            "category": [{
                "coding": [{
                    "system": "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
                    "code": "clinical-note",
                    "display": "Clinical Note"
                }]
            }],
            "subject": {"reference": patient_ref},
            "date": datetime.now(timezone.utc).isoformat(),
            "description": f"Workflow documentation: {description}",
            "content": [{
                "attachment": {
                    "contentType": "text/plain",
                    "title": f"Clinical Workflow - {workflow_type}",
                    "creation": datetime.now(timezone.utc).isoformat()
                }
            }],
            "context": {
                "encounter": [{"reference": encounter_ref}] if encounter_ref else [],
                "event": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": workflow_type,
                        "display": workflow_type.replace('_', ' ').title()
                    }]
                }],
                "period": {
                    "start": datetime.now(timezone.utc).isoformat()
                }
            },
            "identifier": [{
                "system": "http://example.org/clinical-workflow",
                "value": workflow_id
            }]
        }
        
        if initiator_ref:
            document_data["author"] = [{"reference": initiator_ref}]
        
        doc_id, _, _ = await self.create_resource("DocumentReference", document_data)
        created_resources["document"] = doc_id
        
        # 2. Create Communication for workflow notifications
        communication_data = {
            "resourceType": "Communication", 
            "status": "preparation",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/communication-category",
                    "code": "notification",
                    "display": "Notification"
                }]
            }],
            "priority": priority,
            "subject": {"reference": patient_ref},
            "topic": {
                "text": f"Clinical Workflow: {workflow_type}"
            },
            "payload": [{
                "contentString": f"Workflow initiated: {description}"
            }],
            "identifier": [{
                "system": "http://example.org/clinical-workflow",
                "value": workflow_id
            }],
            "about": [{"reference": f"DocumentReference/{doc_id}"}]
        }
        
        if encounter_ref:
            communication_data["encounter"] = {"reference": encounter_ref}
        
        if initiator_ref:
            communication_data["sender"] = {"reference": initiator_ref}
        
        comm_id, _, _ = await self.create_resource("Communication", communication_data)
        created_resources["communication"] = comm_id
        
        # 3. Create Task for workflow orchestration
        task_data = {
            "resourceType": "Task",
            "status": "ready",
            "intent": "plan", 
            "priority": priority,
            "code": {
                "coding": [{
                    "system": "http://hl7.org/fhir/CodeSystem/task-code",
                    "code": "fulfill",
                    "display": "Fulfill the focal request"
                }]
            },
            "description": description,
            "for": {"reference": patient_ref},
            "authoredOn": datetime.now(timezone.utc).isoformat(),
            "lastModified": datetime.now(timezone.utc).isoformat(),
            "identifier": [{
                "system": "http://example.org/clinical-workflow", 
                "value": workflow_id
            }],
            "focus": {"reference": f"DocumentReference/{doc_id}"},
            "input": [{
                "type": {
                    "coding": [{
                        "system": "http://hl7.org/fhir/task-input-type",
                        "code": "reference",
                        "display": "Reference"
                    }]
                },
                "valueReference": {"reference": f"Communication/{comm_id}"}
            }],
            "businessStatus": {
                "text": f"Workflow {workflow_type} initiated"
            }
        }
        
        if encounter_ref:
            task_data["encounter"] = {"reference": encounter_ref}
        
        if initiator_ref:
            task_data["requester"] = {"reference": initiator_ref}
        
        task_id, _, _ = await self.create_resource("Task", task_data)
        created_resources["task"] = task_id
        
        # 4. Update Communication to reference the Task
        communication_update = {
            "resourceType": "Communication",
            "id": comm_id,
            "status": "in-progress",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/communication-category", 
                    "code": "notification",
                    "display": "Notification"
                }]
            }],
            "priority": priority,
            "subject": {"reference": patient_ref},
            "topic": {
                "text": f"Clinical Workflow: {workflow_type}"
            },
            "payload": [{
                "contentString": f"Workflow initiated: {description}",
                "contentReference": {"reference": f"Task/{task_id}"}
            }],
            "identifier": [{
                "system": "http://example.org/clinical-workflow",
                "value": workflow_id
            }],
            "about": [
                {"reference": f"DocumentReference/{doc_id}"},
                {"reference": f"Task/{task_id}"}
            ],
            "basedOn": [{"reference": f"Task/{task_id}"}]
        }
        
        if encounter_ref:
            communication_update["encounter"] = {"reference": encounter_ref}
        
        if initiator_ref:
            communication_update["sender"] = {"reference": initiator_ref}
        
        await self.update_resource("Communication", comm_id, communication_update)
        
        return {
            "workflow_id": workflow_id,
            "resources": created_resources
        }
    
    async def link_workflow_resources(
        self,
        source_resource_type: str,
        source_id: str, 
        target_resource_type: str,
        target_id: str,
        relationship_type: str = "supports"
    ) -> bool:
        """
        Create links between workflow resources.
        
        Args:
            source_resource_type: Source resource type
            source_id: Source resource ID
            target_resource_type: Target resource type
            target_id: Target resource ID
            relationship_type: Type of relationship ('supports', 'replaces', 'references')
            
        Returns:
            True if successful
        """
        try:
            # Read source resource
            source_resource = await self.read_resource(source_resource_type, source_id)
            if not source_resource:
                return False
            
            # Add relationship based on resource types and relationship
            target_ref = f"{target_resource_type}/{target_id}"
            
            if source_resource_type == "DocumentReference":
                if relationship_type == "supports":
                    # Add to relatesTo
                    if "relatesTo" not in source_resource:
                        source_resource["relatesTo"] = []
                    source_resource["relatesTo"].append({
                        "code": "supports",
                        "target": {"reference": target_ref}
                    })
                elif relationship_type == "references":
                    # Add to context.related
                    if "context" not in source_resource:
                        source_resource["context"] = {}
                    if "related" not in source_resource["context"]:
                        source_resource["context"]["related"] = []
                    source_resource["context"]["related"].append({
                        "reference": target_ref
                    })
            
            elif source_resource_type == "Communication":
                if relationship_type == "supports":
                    # Add to about
                    if "about" not in source_resource:
                        source_resource["about"] = []
                    source_resource["about"].append({"reference": target_ref})
                elif relationship_type == "references":
                    # Add to basedOn
                    if "basedOn" not in source_resource:
                        source_resource["basedOn"] = []
                    source_resource["basedOn"].append({"reference": target_ref})
            
            elif source_resource_type == "Task":
                if relationship_type == "supports":
                    # Add to focus or input
                    if target_resource_type == "DocumentReference":
                        source_resource["focus"] = {"reference": target_ref}
                    else:
                        if "input" not in source_resource:
                            source_resource["input"] = []
                        source_resource["input"].append({
                            "type": {
                                "coding": [{
                                    "system": "http://hl7.org/fhir/task-input-type",
                                    "code": "reference",
                                    "display": "Reference"
                                }]
                            },
                            "valueReference": {"reference": target_ref}
                        })
                elif relationship_type == "references":
                    # Add to basedOn or partOf
                    if "basedOn" not in source_resource:
                        source_resource["basedOn"] = []
                    source_resource["basedOn"].append({"reference": target_ref})
            
            # Update the source resource
            await self.update_resource(source_resource_type, source_id, source_resource)
            return True
            
        except Exception as e:
            logging.error(f"ERROR: Failed to link workflow resources: {e}")
            return False
    
    async def get_workflow_resources(
        self,
        workflow_id: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all resources associated with a clinical workflow.
        
        Args:
            workflow_id: Workflow identifier
            
        Returns:
            Dictionary of resource lists by type
        """
        workflow_resources = {
            "DocumentReference": [],
            "Communication": [],
            "Task": []
        }
        
        try:
            # Search for resources with the workflow identifier
            for resource_type in workflow_resources.keys():
                search_result = await self.search_resources(
                    resource_type,
                    {"identifier": [f"http://example.org/clinical-workflow|{workflow_id}"]},
                    {"_count": ["50"]}
                )
                
                if "entry" in search_result:
                    workflow_resources[resource_type] = [
                        entry["resource"] for entry in search_result["entry"]
                    ]
            
            return workflow_resources
            
        except Exception as e:
            logging.error(f"ERROR: Failed to get workflow resources: {e}")
            return workflow_resources
    
    async def update_workflow_status(
        self,
        workflow_id: str,
        new_status: str,
        update_reason: Optional[str] = None
    ) -> bool:
        """
        Update the status of all resources in a clinical workflow.
        
        Args:
            workflow_id: Workflow identifier
            new_status: New status to apply
            update_reason: Optional reason for the status change
            
        Returns:
            True if successful
        """
        try:
            workflow_resources = await self.get_workflow_resources(workflow_id)
            
            # Update Task status
            for task in workflow_resources["Task"]:
                task["status"] = new_status
                task["lastModified"] = datetime.now(timezone.utc).isoformat()
                
                if update_reason:
                    if "statusReason" not in task:
                        task["statusReason"] = {}
                    task["statusReason"]["text"] = update_reason
                
                await self.update_resource("Task", task["id"], task)
            
            # Update Communication status
            for comm in workflow_resources["Communication"]:
                if new_status in ["completed", "stopped"]:
                    comm["status"] = "completed"
                elif new_status in ["in-progress", "ready"]:
                    comm["status"] = "in-progress"
                else:
                    comm["status"] = "preparation"
                
                if update_reason:
                    if "payload" not in comm:
                        comm["payload"] = []
                    comm["payload"].append({
                        "contentString": f"Status update: {update_reason}"
                    })
                
                await self.update_resource("Communication", comm["id"], comm)
            
            # Update DocumentReference status if needed
            for doc in workflow_resources["DocumentReference"]:
                if new_status == "completed":
                    doc["status"] = "current"
                elif new_status == "stopped":
                    doc["status"] = "superseded"
                
                await self.update_resource("DocumentReference", doc["id"], doc)
            
            return True
            
        except Exception as e:
            logging.error(f"ERROR: Failed to update workflow status: {e}")
            return False

    async def _delete_references(self, resource_id: int):
        """Delete all references for a resource."""
        query = text("""
            DELETE FROM fhir.references
            WHERE source_id = :resource_id
        """)
        await self.session.execute(query, {'resource_id': resource_id})
    
    async def _search_by_criteria(
        self,
        resource_type: str,
        criteria: str
    ) -> List[Dict[str, Any]]:
        """Search by search criteria string (for conditional operations)."""
        from fhir.core.search.basic import SearchParameterHandler
        
        # Parse search criteria into parameters
        # Handle multiple parameters separated by &
        search_params = {}
        
        # Split by & to handle multiple parameters
        param_pairs = criteria.split('&')
        
        for param_pair in param_pairs:
            # Handle different operators: =, :=, etc.
            if '=' in param_pair:
                param_name, param_value = param_pair.split('=', 1)
                # URL decode the value
                from urllib.parse import unquote
                param_value = unquote(param_value)
                search_params[param_name] = param_value
        
        if not search_params:
            return []
        
        # Initialize search handler and parse parameters
        search_handler = SearchParameterHandler(self._get_search_parameter_definitions())
        parsed_params, _ = search_handler.parse_search_params(resource_type, search_params)
        
        # Search for matching resources
        results, _ = await self.search_resources(
            resource_type,
            parsed_params,
            limit=10  # Return up to 10 matches for conditional create
        )
        
        return results