"""
FHIR Resource Storage Engine

Handles storage and retrieval of FHIR resources using PostgreSQL JSONB.
Implements versioning, history tracking, and search parameter extraction.
"""

import json
import uuid
from datetime import datetime, timezone, date
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import UUID, JSONB
from fhir.resources import construct_fhir_element
from fhir.resources.bundle import Bundle, BundleEntry, BundleEntryRequest, BundleEntryResponse
from fhir.resources.operationoutcome import OperationOutcome, OperationOutcomeIssue


class FHIRJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for FHIR resources that handles date/datetime objects."""
    
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


class FHIRStorageEngine:
    """Core storage engine for FHIR resources."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_resource(
        self,
        resource_type: str,
        resource_data: Dict[str, Any],
        if_none_exist: Optional[str] = None
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
        # Validate resource
        try:
            fhir_resource = construct_fhir_element(resource_type, resource_data)
            resource_dict = fhir_resource.dict(exclude_none=True)
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
                return existing[0]['fhir_id'], existing[0]['version_id'], existing[0]['last_updated']
        
        # Insert resource
        query = text("""
            INSERT INTO fhir.resources (
                resource_type, fhir_id, version_id, last_updated, resource
            ) VALUES (
                :resource_type, :fhir_id, :version_id, :last_updated, :resource
            )
            RETURNING id
        """)
        
        result = await self.session.execute(query, {
            'resource_type': resource_type,
            'fhir_id': fhir_id,
            'version_id': version_id,
            'last_updated': last_updated,
            'resource': json.dumps(resource_dict, cls=FHIRJSONEncoder)
        })
        
        resource_id = result.scalar()
        
        # Create history entry
        await self._create_history_entry(
            resource_id, version_id, 'create', resource_dict
        )
        
        # Extract search parameters
        await self._extract_search_parameters(resource_id, resource_type, resource_dict)
        
        # Extract references
        await self._extract_references(resource_id, resource_dict)
        
        await self.session.commit()
        
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
        # Validate resource
        try:
            fhir_resource = construct_fhir_element(resource_type, resource_data)
            resource_dict = fhir_resource.dict(exclude_none=True)
        except Exception as e:
            raise ValueError(f"Invalid FHIR resource: {str(e)}")
        
        # Get current resource
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
        
        # Check if-match condition
        if if_match and f'W/"{current_version}"' != if_match:
            raise ValueError("Resource version mismatch")
        
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
        
        # Update search parameters
        await self._delete_search_parameters(resource_id)
        await self._extract_search_parameters(resource_id, resource_type, resource_dict)
        
        # Update references
        await self._delete_references(resource_id)
        await self._extract_references(resource_id, resource_dict)
        
        await self.session.commit()
        
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
            search_params: Search parameters
            offset: Result offset for pagination
            limit: Maximum results to return
            
        Returns:
            Tuple of (resources, total_count)
        """
        # Build search query
        base_query = """
            SELECT DISTINCT r.resource, r.fhir_id, r.version_id, r.last_updated
            FROM fhir.resources r
        """
        
        where_clauses = [
            "r.resource_type = :resource_type",
            "r.deleted = false"
        ]
        
        params = {'resource_type': resource_type}
        join_clauses = []
        param_count = 0
        
        # Process search parameters
        for param_name, param_value in search_params.items():
            if param_name.startswith('_'):
                # Handle special parameters
                continue
                
            param_count += 1
            alias = f"sp{param_count}"
            
            join_clauses.append(
                f"JOIN fhir.search_params {alias} ON {alias}.resource_id = r.id"
            )
            
            where_clauses.append(f"{alias}.param_name = :param_name_{param_count}")
            params[f'param_name_{param_count}'] = param_name
            
            # Handle different parameter types
            if isinstance(param_value, str):
                where_clauses.append(f"{alias}.value_string = :param_value_{param_count}")
                params[f'param_value_{param_count}'] = param_value
            # Add other parameter type handling as needed
        
        # Build final query
        query = base_query
        if join_clauses:
            query += " " + " ".join(join_clauses)
        query += " WHERE " + " AND ".join(where_clauses)
        
        # Add ordering
        query += " ORDER BY r.last_updated DESC"
        
        # Get total count - build a separate count query
        count_query = f"""
            SELECT COUNT(DISTINCT r.id) 
            FROM fhir.resources r
            {" ".join(join_clauses) if join_clauses else ""}
            WHERE {" AND ".join(where_clauses)}
        """
        count_result = await self.session.execute(text(count_query), params)
        total_count = count_result.scalar()
        
        # Add pagination
        query += " LIMIT :limit OFFSET :offset"
        params['limit'] = limit
        params['offset'] = offset
        
        # Execute search
        result = await self.session.execute(text(query), params)
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
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get resource history.
        
        Args:
            resource_type: Filter by resource type (optional)
            fhir_id: Filter by resource ID (optional)
            offset: Result offset
            limit: Maximum results
            
        Returns:
            List of history entries
        """
        query = """
            SELECT rh.resource, rh.version_id, rh.operation, rh.modified_at,
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
        
        query += " ORDER BY rh.modified_at DESC LIMIT :limit OFFSET :offset"
        params['limit'] = limit
        params['offset'] = offset
        
        result = await self.session.execute(text(query), params)
        
        history = []
        for row in result:
            resource_data = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            history.append({
                'resource': resource_data,
                'versionId': row[1],
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
        
        return response_bundle
    
    async def _process_bundle_entry(self, entry: BundleEntry) -> BundleEntry:
        """Process a single bundle entry."""
        request = entry.request
        resource = entry.resource
        
        if not request:
            raise ValueError("Bundle entry missing request")
        
        method = request.method
        url = request.url
        
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
                    request.ifNoneExist
                )
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
                    request.ifMatch
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
            # Read
            if fhir_id:
                resource_data = await self.read_resource(resource_type, fhir_id)
                if resource_data:
                    response_entry.resource = construct_fhir_element(
                        resource_type, resource_data
                    )
                    response_entry.response = BundleEntryResponse(status="200")
                else:
                    response_entry.response = BundleEntryResponse(status="404")
        
        return response_entry
    
    async def _create_history_entry(
        self,
        resource_id: UUID,
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
        resource_id: UUID,
        resource_type: str,
        resource_data: Dict[str, Any]
    ):
        """Extract and store search parameters from a resource."""
        # This is a simplified version - full implementation would use
        # SearchParameter definitions to extract all searchable values
        
        # Extract common parameters
        params_to_extract = []
        
        # ID parameter
        if 'id' in resource_data:
            params_to_extract.append({
                'param_name': '_id',
                'param_type': 'token',
                'value_string': resource_data['id']
            })
        
        # LastUpdated parameter
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
            # Extract patient-specific search parameters
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'system' in identifier and 'value' in identifier:
                        params_to_extract.append({
                            'param_name': 'identifier',
                            'param_type': 'token',
                            'value_token_system': identifier['system'],
                            'value_token_code': identifier['value']
                        })
            
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
        
        # Insert search parameters
        for param in params_to_extract:
            query = text("""
                INSERT INTO fhir.search_params (
                    resource_id, param_name, param_type,
                    value_string, value_number, value_date,
                    value_token_system, value_token_code
                ) VALUES (
                    :resource_id, :param_name, :param_type,
                    :value_string, :value_number, :value_date,
                    :value_token_system, :value_token_code
                )
            """)
            
            await self.session.execute(query, {
                'resource_id': resource_id,
                'param_name': param['param_name'],
                'param_type': param['param_type'],
                'value_string': param.get('value_string'),
                'value_number': param.get('value_number'),
                'value_date': param.get('value_date'),
                'value_token_system': param.get('value_token_system'),
                'value_token_code': param.get('value_token_code')
            })
    
    async def _extract_references(
        self,
        resource_id: UUID,
        resource_data: Dict[str, Any],
        path: str = ""
    ):
        """Extract and store references from a resource."""
        for key, value in resource_data.items():
            current_path = f"{path}.{key}" if path else key
            
            if key == 'reference' and isinstance(value, str):
                # Found a reference
                parts = value.split('/')
                if len(parts) >= 2:
                    target_type = parts[0]
                    target_id = parts[1]
                    
                    query = text("""
                        INSERT INTO fhir.references (
                            source_id, target_type, target_id, reference_path
                        ) VALUES (
                            :source_id, :target_type, :target_id, :reference_path
                        )
                    """)
                    
                    await self.session.execute(query, {
                        'source_id': resource_id,
                        'target_type': target_type,
                        'target_id': target_id,
                        'reference_path': path  # Parent path of the reference
                    })
            
            elif isinstance(value, dict):
                # Recurse into nested objects
                await self._extract_references(resource_id, value, current_path)
            
            elif isinstance(value, list):
                # Recurse into arrays
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        await self._extract_references(
                            resource_id, item, f"{current_path}[{i}]"
                        )
    
    async def _delete_search_parameters(self, resource_id: UUID):
        """Delete all search parameters for a resource."""
        query = text("""
            DELETE FROM fhir.search_params
            WHERE resource_id = :resource_id
        """)
        await self.session.execute(query, {'resource_id': resource_id})
    
    async def _delete_references(self, resource_id: UUID):
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
        """Search by simple criteria string (for conditional operations)."""
        # Parse simple search criteria (e.g., "identifier=12345")
        # This is a simplified implementation
        parts = criteria.split('=')
        if len(parts) == 2:
            param_name = parts[0]
            param_value = parts[1]
            
            results, _ = await self.search_resources(
                resource_type,
                {param_name: param_value},
                limit=1
            )
            return results
        
        return []