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
from fhir.resources import construct_fhir_element
from fhir.resources.bundle import Bundle, BundleEntry, BundleEntryRequest, BundleEntryResponse
from fhir.resources.operationoutcome import OperationOutcome, OperationOutcomeIssue

from .synthea_validator import SyntheaFHIRValidator
from .reference_utils import ReferenceUtils
from .version_negotiator import FHIRVersion, version_negotiator
from .version_transformer import fhir_transformer
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
                'status': {'type': 'token'}
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
                'code': {'type': 'token'},
                'status': {'type': 'token'},
                'intent': {'type': 'token'},
                'patient': {'type': 'reference'},
                'subject': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'authoredon': {'type': 'date'}
            },
            'Encounter': {
                'status': {'type': 'token'},
                'class': {'type': 'token'},
                'type': {'type': 'token'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'date': {'type': 'date'},
                'period': {'type': 'date'}
            },
            'Practitioner': {
                'name': {'type': 'string'},
                'family': {'type': 'string'},
                'given': {'type': 'string'},
                'identifier': {'type': 'token'},
                'active': {'type': 'token'}
            },
            'Organization': {
                'name': {'type': 'string'},
                'identifier': {'type': 'token'},
                'type': {'type': 'token'},
                'active': {'type': 'token'}
            },
            'Procedure': {
                'code': {'type': 'token'},
                'status': {'type': 'token'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'date': {'type': 'date'},
                'performed': {'type': 'date'}
            },
            'AllergyIntolerance': {
                'code': {'type': 'token'},
                'clinical-status': {'type': 'token'},
                'type': {'type': 'token'},
                'category': {'type': 'token'},
                'patient': {'type': 'reference'},
                'date': {'type': 'date'}
            },
            'Immunization': {
                'vaccine-code': {'type': 'token'},
                'status': {'type': 'token'},
                'patient': {'type': 'reference'},
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
                'date': {'type': 'date'},
                'issued': {'type': 'date'}
            },
            'ImagingStudy': {
                'status': {'type': 'token'},
                'modality': {'type': 'token'},
                'subject': {'type': 'reference'},
                'patient': {'type': 'reference'},
                'encounter': {'type': 'reference'},
                'started': {'type': 'date'}
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
                from services.document_validation_service import DocumentValidationService
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
                from services.document_validation_service import DocumentValidationService
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
        from .search import SearchParameterHandler
        
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
        Process a FHIR Bundle from dictionary data (without fhir.resources validation).
        
        Args:
            bundle_data: Bundle data as dictionary
            
        Returns:
            Response Bundle as dictionary
        """
        bundle_type = bundle_data.get('type')
        entries = bundle_data.get('entry', [])
        
        response_bundle = {
            "resourceType": "Bundle",
            "type": "batch-response" if bundle_type == "batch" else "transaction-response",
            "entry": []
        }
        
        # Transaction handling
        if bundle_type == "transaction":
            # All operations must succeed
            try:
                for entry in entries:
                    response_entry = await self._process_bundle_entry_dict(entry)
                    response_bundle['entry'].append(response_entry)
                await self.session.commit()
            except Exception as e:
                await self.session.rollback()
                raise
        else:
            # Batch - independent operations
            for entry in entries:
                try:
                    response_entry = await self._process_bundle_entry_dict(entry)
                    await self.session.commit()
                except Exception as e:
                    # Create error response
                    response_entry = {
                        "response": {
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
                    }
                    await self.session.rollback()
                response_bundle['entry'].append(response_entry)
        
        return response_bundle
    
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
                    from .search import SearchParameterHandler
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
            value_string=resource_data.get('id')
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
                    value_string=resource_data['gender']
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
        elif resource_type == 'Claim':
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
            
            # Created date
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
        elif resource_type == 'ExplanationOfBenefit':
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
            
            # Created date
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
        # Insert all search parameters
        logging.debug(f"DEBUG: Found {len(params_to_extract)} search parameters to store")
        for i, param in enumerate(params_to_extract):
            logging.debug(f"DEBUG: Param {i+1}: {param}")
            query = text("""
                INSERT INTO fhir.search_params (
                    resource_id, resource_type, param_name, param_type,
                    value_string, value_number, value_date,
                    value_token_system, value_token_code
                ) VALUES (
                    :resource_id, :resource_type, :param_name, :param_type,
                    :value_string, :value_number, :value_date,
                    :value_token_system, :value_token_code
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
                'value_token_code': param.get('value_token_code')
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
        from .search import SearchParameterHandler
        
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