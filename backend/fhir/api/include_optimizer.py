"""
Include Operation Optimizer for FHIR API

Optimizes _include and _revinclude operations with batch fetching
to reduce query overhead from individual resource lookups.
"""

import asyncio
from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict
import logging

from fhir.core.storage import FHIRStorageEngine

logger = logging.getLogger(__name__)


class IncludeOptimizer:
    """Optimizes include operations with batch fetching."""
    
    def __init__(self, storage: FHIRStorageEngine):
        self.storage = storage
        self.search_definitions = storage._get_search_parameter_definitions()
    
    async def process_includes_batch(
        self,
        bundle: Dict,
        includes: List[str],
        base_url: str
    ) -> None:
        """
        Process _include parameters with batch fetching.
        
        Instead of fetching referenced resources one by one, this collects
        all references and fetches them in batches by resource type.
        """
        if not includes:
            return
        
        # Parse include parameters
        parsed_includes = self._parse_includes(includes)
        
        # Collect all references from bundle entries
        references_to_fetch = self._collect_references(bundle, parsed_includes)
        
        # Batch fetch resources by type
        fetched_resources = await self._batch_fetch_resources(references_to_fetch)
        
        # Add fetched resources to bundle
        included_resources = set()
        for (resource_type, resource_id), resource in fetched_resources.items():
            resource_key = f"{resource_type}/{resource_id}"
            if resource_key not in included_resources:
                bundle["entry"].append({
                    "fullUrl": f"{base_url}/{resource_type}/{resource_id}",
                    "resource": resource,
                    "search": {"mode": "include"}
                })
                included_resources.add(resource_key)
    
    async def process_revincludes_batch(
        self,
        bundle: Dict,
        revincludes: List[str],
        base_url: str
    ) -> None:
        """
        Process _revinclude parameters with batch fetching.
        
        Uses batch queries to find all resources that reference
        the resources in the bundle.
        """
        if not revincludes:
            return
        
        # Parse revinclude parameters
        parsed_revincludes = self._parse_revincludes(revincludes)
        
        # Collect target resources from bundle
        target_resources = self._collect_target_resources(bundle)
        
        # Batch search for referring resources
        referring_resources = await self._batch_search_referring(
            target_resources,
            parsed_revincludes
        )
        
        # Add referring resources to bundle
        included_resources = set()
        for resource in referring_resources:
            resource_type = resource.get('resourceType', '')
            resource_id = resource.get('id', '')
            resource_key = f"{resource_type}/{resource_id}"
            
            if resource_key not in included_resources:
                bundle["entry"].append({
                    "fullUrl": f"{base_url}/{resource_type}/{resource_id}",
                    "resource": resource,
                    "search": {"mode": "include"}
                })
                included_resources.add(resource_key)
    
    def _parse_includes(self, includes: List[str]) -> List[Dict[str, str]]:
        """Parse _include parameters into structured format."""
        parsed = []
        
        for include in includes:
            parts = include.split(':')
            if len(parts) >= 2:
                source_type = parts[0]
                search_param = parts[1]
                target_type = parts[2] if len(parts) > 2 else None
                
                # Validate that the search parameter exists and is a reference type
                param_def = self.search_definitions.get(source_type, {}).get(search_param, {})
                if param_def.get('type') == 'reference':
                    parsed.append({
                        'source_type': source_type,
                        'search_param': search_param,
                        'target_type': target_type
                    })
        
        return parsed
    
    def _parse_revincludes(self, revincludes: List[str]) -> List[Dict[str, str]]:
        """Parse _revinclude parameters into structured format."""
        parsed = []
        
        for revinclude in revincludes:
            parts = revinclude.split(':')
            if len(parts) >= 2:
                source_type = parts[0]
                search_param = parts[1]
                target_type = parts[2] if len(parts) > 2 else None
                
                # Validate that the search parameter exists and is a reference type
                param_def = self.search_definitions.get(source_type, {}).get(search_param, {})
                if param_def.get('type') == 'reference':
                    parsed.append({
                        'source_type': source_type,
                        'search_param': search_param,
                        'target_type': target_type
                    })
        
        return parsed
    
    def _collect_references(
        self,
        bundle: Dict,
        parsed_includes: List[Dict[str, str]]
    ) -> Dict[str, Set[str]]:
        """Collect all references from bundle that need to be fetched."""
        references_by_type = defaultdict(set)
        
        for include in parsed_includes:
            source_type = include['source_type']
            search_param = include['search_param']
            target_type = include['target_type']
            
            # Find references in the bundle entries
            for entry in bundle["entry"]:
                if entry.get("search", {}).get("mode") == "match":
                    resource = entry["resource"]
                    if resource.get("resourceType") == source_type:
                        # Extract reference values based on the search parameter
                        ref_values = self._extract_reference_values(resource, search_param)
                        
                        for ref_value in ref_values:
                            ref_type, ref_id = self._parse_reference(ref_value, search_param)
                            
                            if ref_type and ref_id:
                                # Check if target type matches (if specified)
                                if not target_type or ref_type == target_type:
                                    references_by_type[ref_type].add(ref_id)
        
        return references_by_type
    
    def _collect_target_resources(self, bundle: Dict) -> Dict[str, Set[str]]:
        """Collect target resources from bundle for revinclude."""
        resources_by_type = defaultdict(set)
        
        for entry in bundle["entry"]:
            if entry.get("search", {}).get("mode") == "match":
                resource = entry["resource"]
                resource_type = resource.get('resourceType', '')
                resource_id = resource.get('id', '')
                
                if resource_type and resource_id:
                    resources_by_type[resource_type].add(resource_id)
        
        return resources_by_type
    
    async def _batch_fetch_resources(
        self,
        references_by_type: Dict[str, Set[str]]
    ) -> Dict[Tuple[str, str], Dict]:
        """Batch fetch resources by type."""
        fetched_resources = {}
        
        # Fetch resources in parallel by type
        tasks = []
        for resource_type, resource_ids in references_by_type.items():
            if resource_ids:
                task = self._fetch_resources_by_type(resource_type, list(resource_ids))
                tasks.append(task)
        
        # Wait for all fetches to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Error in batch fetch: {result}")
                continue
            
            for resource in result:
                resource_type = resource.get('resourceType', '')
                resource_id = resource.get('id', '')
                if resource_type and resource_id:
                    fetched_resources[(resource_type, resource_id)] = resource
        
        return fetched_resources
    
    async def _fetch_resources_by_type(
        self,
        resource_type: str,
        resource_ids: List[str]
    ) -> List[Dict]:
        """Fetch multiple resources of the same type."""
        try:
            # Use _id search parameter for batch fetching
            search_params = {
                '_id': {
                    'name': '_id',
                    'type': 'token',
                    'modifier': None,
                    'values': [{'code': rid} for rid in resource_ids]
                }
            }
            
            # Search for all resources with these IDs
            resources, total = await self.storage.search_resources(
                resource_type,
                search_params,
                offset=0,
                limit=len(resource_ids) + 10  # Allow some margin
            )
            
            return resources
        except Exception as e:
            logger.error(f"Error fetching {resource_type} resources: {e}")
            return []
    
    async def _batch_search_referring(
        self,
        target_resources: Dict[str, Set[str]],
        parsed_revincludes: List[Dict[str, str]]
    ) -> List[Dict]:
        """Batch search for resources that reference target resources."""
        all_referring = []
        
        # Process each revinclude parameter
        tasks = []
        for revinclude in parsed_revincludes:
            source_type = revinclude['source_type']
            search_param = revinclude['search_param']
            target_type = revinclude['target_type']
            
            # For each target resource type
            for resource_type, resource_ids in target_resources.items():
                # Skip if target type specified and doesn't match
                if target_type and resource_type != target_type:
                    continue
                
                if resource_ids:
                    task = self._search_referring_resources(
                        source_type,
                        search_param,
                        resource_type,
                        list(resource_ids)
                    )
                    tasks.append(task)
        
        # Wait for all searches to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect all results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Error in revinclude search: {result}")
                continue
            
            all_referring.extend(result)
        
        return all_referring
    
    async def _search_referring_resources(
        self,
        source_type: str,
        search_param: str,
        target_type: str,
        target_ids: List[str]
    ) -> List[Dict]:
        """Search for resources that reference the given targets."""
        try:
            # Build search parameters for batch reference search
            # Use OR logic to find resources referencing any of the targets
            search_params = {
                search_param: {
                    'name': search_param,
                    'type': 'reference',
                    'modifier': None,
                    'values': [
                        {'type': target_type, 'id': target_id}
                        for target_id in target_ids
                    ]
                }
            }
            
            # Search for referring resources
            resources, total = await self.storage.search_resources(
                source_type,
                search_params,
                offset=0,
                limit=1000  # Reasonable limit for revinclude
            )
            
            return resources
        except Exception as e:
            logger.error(f"Error searching {source_type} referencing {target_type}: {e}")
            return []
    
    def _extract_reference_values(self, resource: dict, search_param: str) -> List[str]:
        """Extract reference values from a resource based on the search parameter name."""
        references = []
        
        # Map search parameters to FHIR paths
        param_to_paths = {
            'patient': ['subject', 'patient'],
            'subject': ['subject'],
            'encounter': ['encounter', 'context'],
            'requester': ['requester'],
            'performer': ['performer', 'performer[*].actor'],
            'author': ['author'],
            'medication': ['medicationReference', 'medication'],
            'prescription': ['prescription', 'authorizingPrescription'],
            'location': ['location'],
            'organization': ['organization', 'managingOrganization'],
            'practitioner': ['practitioner', 'generalPractitioner'],
            'general-practitioner': ['generalPractitioner'],
            'based-on': ['basedOn'],
            'part-of': ['partOf'],
            'context': ['context', 'encounter']
        }
        
        # Get potential paths for this search parameter
        paths = param_to_paths.get(search_param, [search_param])
        
        for path in paths:
            if '[*]' in path:
                # Handle array notation
                base_path = path.split('[*]')[0]
                sub_path = path.split('[*].')[1] if '[*].' in path else None
                
                if base_path in resource and isinstance(resource[base_path], list):
                    for item in resource[base_path]:
                        if sub_path and isinstance(item, dict) and sub_path in item:
                            ref_obj = item[sub_path]
                        elif isinstance(item, dict) and 'reference' in item:
                            ref_obj = item
                        else:
                            continue
                        
                        if isinstance(ref_obj, dict) and 'reference' in ref_obj:
                            references.append(ref_obj['reference'])
            else:
                # Direct path
                if path in resource:
                    value = resource[path]
                    if isinstance(value, dict) and 'reference' in value:
                        references.append(value['reference'])
                    elif isinstance(value, list):
                        # Handle arrays of references
                        for item in value:
                            if isinstance(item, dict) and 'reference' in item:
                                references.append(item['reference'])
        
        return references
    
    def _parse_reference(
        self,
        ref_value: str,
        search_param: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """Parse a reference value into resource type and ID."""
        if ref_value.startswith('urn:uuid:'):
            # Handle urn:uuid references
            ref_id = ref_value.replace('urn:uuid:', '')
            # Try to infer type from parameter name
            ref_type = self._infer_resource_type_from_param(search_param)
            return ref_type, ref_id
        elif '/' in ref_value:
            # Handle ResourceType/id format
            ref_parts = ref_value.split('/', 1)
            if len(ref_parts) == 2:
                return ref_parts[0], ref_parts[1]
        
        return None, None
    
    def _infer_resource_type_from_param(self, search_param: str) -> Optional[str]:
        """Infer the likely resource type from a search parameter name."""
        param_to_type = {
            'patient': 'Patient',
            'subject': 'Patient',
            'encounter': 'Encounter',
            'practitioner': 'Practitioner',
            'organization': 'Organization',
            'location': 'Location',
            'medication': 'Medication',
            'requester': 'Practitioner',
            'performer': 'Practitioner',
            'author': 'Practitioner',
            'prescription': 'MedicationRequest',
            'context': 'Encounter',
            'general-practitioner': 'Practitioner'
        }
        
        return param_to_type.get(search_param)