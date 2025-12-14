"""
RelationshipCache - FHIR Resource Relationship Cache Service

Provides cached relationship discovery and traversal for FHIR resources
using FHIR API operations instead of direct database queries.

Architecture:
- Uses HAPIFHIRClient for all FHIR operations (no direct DB access)
- Caches relationship information with TTL for performance
- Extracts references from resources and resolves them through FHIR API
- Uses FHIR reverse chaining (_has) for incoming relationships

Educational Notes:
- FHIR R4 uses Reference type for relationships between resources
- Reverse references can be found using _revinclude or _has search
- This service demonstrates proper FHIR relationship traversal patterns
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set, Tuple
from collections import defaultdict

from services.hapi_fhir_client import HAPIFHIRClient
from shared.exceptions import FHIRConnectionError, FHIRResourceNotFoundError

logger = logging.getLogger(__name__)


# FHIR reference field mappings by resource type
# Maps field names to their target resource types and relationship cardinality
REFERENCE_FIELDS = {
    "Patient": {
        "generalPractitioner": {"targets": ["Practitioner", "Organization", "PractitionerRole"], "cardinality": "0..*"},
        "managingOrganization": {"targets": ["Organization"], "cardinality": "0..1"},
    },
    "Observation": {
        "subject": {"targets": ["Patient", "Group", "Device", "Location"], "cardinality": "0..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization", "CareTeam", "Patient", "RelatedPerson"], "cardinality": "0..*"},
        "basedOn": {"targets": ["CarePlan", "DeviceRequest", "MedicationRequest", "ServiceRequest"], "cardinality": "0..*"},
        "specimen": {"targets": ["Specimen"], "cardinality": "0..1"},
    },
    "Condition": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "1..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "recorder": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "cardinality": "0..1"},
        "asserter": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "cardinality": "0..1"},
    },
    "MedicationRequest": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "1..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "requester": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"], "cardinality": "0..1"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device", "CareTeam"], "cardinality": "0..1"},
        "reasonReference": {"targets": ["Condition", "Observation"], "cardinality": "0..*"},
        "basedOn": {"targets": ["CarePlan", "MedicationRequest", "ServiceRequest"], "cardinality": "0..*"},
    },
    "Encounter": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "0..1"},
        "appointment": {"targets": ["Appointment"], "cardinality": "0..*"},
        "reasonReference": {"targets": ["Condition", "Procedure", "Observation"], "cardinality": "0..*"},
        "serviceProvider": {"targets": ["Organization"], "cardinality": "0..1"},
        "partOf": {"targets": ["Encounter"], "cardinality": "0..1"},
    },
    "Procedure": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "1..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "location": {"targets": ["Location"], "cardinality": "0..1"},
        "reasonReference": {"targets": ["Condition", "Observation", "Procedure", "DiagnosticReport", "DocumentReference"], "cardinality": "0..*"},
        "basedOn": {"targets": ["CarePlan", "ServiceRequest"], "cardinality": "0..*"},
    },
    "DiagnosticReport": {
        "subject": {"targets": ["Patient", "Group", "Device", "Location"], "cardinality": "0..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "basedOn": {"targets": ["CarePlan", "MedicationRequest", "ServiceRequest"], "cardinality": "0..*"},
        "specimen": {"targets": ["Specimen"], "cardinality": "0..*"},
        "result": {"targets": ["Observation"], "cardinality": "0..*"},
    },
    "AllergyIntolerance": {
        "patient": {"targets": ["Patient"], "cardinality": "1..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "recorder": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "cardinality": "0..1"},
        "asserter": {"targets": ["Patient", "RelatedPerson", "Practitioner", "PractitionerRole"], "cardinality": "0..1"},
    },
    "Immunization": {
        "patient": {"targets": ["Patient"], "cardinality": "1..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "location": {"targets": ["Location"], "cardinality": "0..1"},
        "manufacturer": {"targets": ["Organization"], "cardinality": "0..1"},
    },
    "ServiceRequest": {
        "subject": {"targets": ["Patient", "Group", "Location", "Device"], "cardinality": "1..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "requester": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"], "cardinality": "0..1"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization", "CareTeam", "Patient", "Device", "RelatedPerson"], "cardinality": "0..*"},
        "reasonReference": {"targets": ["Condition", "Observation", "DiagnosticReport", "DocumentReference"], "cardinality": "0..*"},
    },
    "CarePlan": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "1..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "author": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson", "Organization", "CareTeam", "Device"], "cardinality": "0..1"},
        "careTeam": {"targets": ["CareTeam"], "cardinality": "0..*"},
        "addresses": {"targets": ["Condition"], "cardinality": "0..*"},
        "goal": {"targets": ["Goal"], "cardinality": "0..*"},
    },
    "ImagingStudy": {
        "subject": {"targets": ["Patient", "Device", "Group"], "cardinality": "1..1"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1"},
        "basedOn": {"targets": ["CarePlan", "ServiceRequest", "Appointment"], "cardinality": "0..*"},
        "referrer": {"targets": ["Practitioner", "PractitionerRole"], "cardinality": "0..1"},
        "location": {"targets": ["Location"], "cardinality": "0..1"},
        "procedureReference": {"targets": ["Procedure"], "cardinality": "0..1"},
    },
    "DocumentReference": {
        "subject": {"targets": ["Patient", "Practitioner", "Group", "Device"], "cardinality": "0..1"},
        "author": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Device", "Patient", "RelatedPerson"], "cardinality": "0..*"},
        "custodian": {"targets": ["Organization"], "cardinality": "0..1"},
    },
}

# Common reverse reference search parameters
# Maps source resource types to the search parameter they use to reference a target
REVERSE_SEARCH_PARAMS = {
    "Patient": {
        "Observation": "subject",
        "Condition": "subject",
        "MedicationRequest": "subject",
        "Encounter": "subject",
        "Procedure": "subject",
        "DiagnosticReport": "subject",
        "AllergyIntolerance": "patient",
        "Immunization": "patient",
        "ServiceRequest": "subject",
        "CarePlan": "subject",
        "ImagingStudy": "subject",
        "DocumentReference": "subject",
    },
    "Encounter": {
        "Observation": "encounter",
        "Condition": "encounter",
        "MedicationRequest": "encounter",
        "Procedure": "encounter",
        "DiagnosticReport": "encounter",
        "AllergyIntolerance": "encounter",
        "Immunization": "encounter",
        "ServiceRequest": "encounter",
        "CarePlan": "encounter",
        "ImagingStudy": "encounter",
    },
    "Practitioner": {
        "Encounter": "participant",
        "Procedure": "performer",
        "Observation": "performer",
    },
}


class RelationshipCache:
    """
    Service for caching and discovering FHIR resource relationships.

    Uses FHIR API operations through HAPIFHIRClient instead of direct database access.
    """

    def __init__(self, cache_ttl_seconds: int = 300):
        """
        Initialize the RelationshipCache.

        Args:
            cache_ttl_seconds: Time-to-live for cached relationships (default: 5 minutes)
        """
        self.hapi_client = HAPIFHIRClient()
        self.cache_ttl = timedelta(seconds=cache_ttl_seconds)
        self._cache: Dict[str, Tuple[datetime, Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

    def _get_cache_key(self, resource_type: str, resource_id: str, depth: int) -> str:
        """Generate cache key for relationship discovery."""
        return f"{resource_type}/{resource_id}:depth={depth}"

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached value is still valid."""
        if cache_key not in self._cache:
            return False
        cached_time, _ = self._cache[cache_key]
        return datetime.utcnow() - cached_time < self.cache_ttl

    def get_relationship_schema(self) -> Dict[str, Any]:
        """
        Get the complete FHIR relationship schema.

        Returns all possible relationships between resource types
        based on FHIR R4 reference field definitions.
        """
        return {
            "resourceTypes": list(REFERENCE_FIELDS.keys()),
            "relationships": REFERENCE_FIELDS,
            "totalResourceTypes": len(REFERENCE_FIELDS)
        }

    async def discover_relationships(
        self,
        resource_type: str,
        resource_id: str,
        depth: int = 1,
        include_counts: bool = True
    ) -> Dict[str, Any]:
        """
        Discover relationships for a specific resource instance.

        Args:
            resource_type: FHIR resource type
            resource_id: Resource identifier
            depth: How many hops to traverse (1-3)
            include_counts: Include relationship counts

        Returns:
            Dict with source resource, nodes, links, and relationships
        """
        depth = min(max(depth, 1), 3)  # Clamp between 1 and 3

        cache_key = self._get_cache_key(resource_type, resource_id, depth)

        # Check cache
        if self._is_cache_valid(cache_key):
            _, cached_result = self._cache[cache_key]
            return {**cached_result, "cached": True}

        async with self._lock:
            # Double-check after acquiring lock
            if self._is_cache_valid(cache_key):
                _, cached_result = self._cache[cache_key]
                return {**cached_result, "cached": True}

            try:
                # Get the source resource
                source_resource = await self.hapi_client.read(resource_type, resource_id)

                # Initialize result structure
                result = {
                    "source": {
                        "resourceType": resource_type,
                        "id": resource_id,
                        "display": self._get_resource_display(source_resource)
                    },
                    "relationships": [],
                    "nodes": [],
                    "links": []
                }

                # Track visited resources to avoid cycles
                visited: Set[str] = set()
                visited.add(f"{resource_type}/{resource_id}")

                # Discover relationships recursively
                await self._discover_recursive(
                    source_resource,
                    resource_type,
                    resource_id,
                    depth,
                    1,
                    visited,
                    result,
                    include_counts
                )

                # Cache the result
                self._cache[cache_key] = (datetime.utcnow(), result)

                return {**result, "cached": False}

            except Exception as e:
                logger.error(f"Error discovering relationships for {resource_type}/{resource_id}: {e}")
                raise

    async def _discover_recursive(
        self,
        resource: Dict[str, Any],
        resource_type: str,
        resource_id: str,
        max_depth: int,
        current_depth: int,
        visited: Set[str],
        result: Dict[str, Any],
        include_counts: bool
    ):
        """Recursively discover relationships from a resource."""
        if current_depth > max_depth:
            return

        node_id = f"{resource_type}/{resource_id}"

        # Add current resource as a node
        result["nodes"].append({
            "id": node_id,
            "resourceType": resource_type,
            "display": self._get_resource_display(resource),
            "depth": current_depth - 1
        })

        # Get reference fields for this resource type
        reference_fields = REFERENCE_FIELDS.get(resource_type, {})

        # Check each reference field (forward references)
        for field_name, field_config in reference_fields.items():
            references = self._extract_references(resource, field_name)

            for ref_string in references:
                target_type, target_id = self._parse_reference(ref_string)
                if not target_type or not target_id:
                    continue

                target_node_id = f"{target_type}/{target_id}"

                # Verify target exists and fetch it
                if target_node_id not in visited and current_depth < max_depth:
                    try:
                        target_resource = await self.hapi_client.read(target_type, target_id)
                        if not target_resource:
                            continue
                    except Exception as e:
                        logger.debug(f"Could not fetch {target_node_id}: {e}")
                        continue

                    # Add link
                    result["links"].append({
                        "source": node_id,
                        "target": target_node_id,
                        "field": field_name,
                        "type": "forward"
                    })

                    # Recursively explore
                    visited.add(target_node_id)
                    await self._discover_recursive(
                        target_resource,
                        target_type,
                        target_id,
                        max_depth,
                        current_depth + 1,
                        visited,
                        result,
                        include_counts
                    )
                elif target_node_id not in visited:
                    # At max depth, just add the link
                    result["links"].append({
                        "source": node_id,
                        "target": target_node_id,
                        "field": field_name,
                        "type": "forward"
                    })

        # Find reverse references (resources that point to this one)
        if include_counts and current_depth < max_depth:
            await self._discover_reverse_references(
                resource_type,
                resource_id,
                node_id,
                current_depth,
                max_depth,
                visited,
                result,
                include_counts
            )

    async def _discover_reverse_references(
        self,
        resource_type: str,
        resource_id: str,
        node_id: str,
        current_depth: int,
        max_depth: int,
        visited: Set[str],
        result: Dict[str, Any],
        include_counts: bool
    ):
        """Find resources that reference this resource using FHIR search."""
        # Get reverse search params for this resource type
        reverse_params = REVERSE_SEARCH_PARAMS.get(resource_type, {})

        for source_type, search_param in reverse_params.items():
            try:
                # Search for resources that reference this one
                bundle = await self.hapi_client.search(
                    source_type,
                    {
                        search_param: f"{resource_type}/{resource_id}",
                        "_count": "50"  # Limit to avoid too many results
                    }
                )

                for entry in bundle.get("entry", []):
                    source_resource = entry.get("resource", {})
                    source_id = source_resource.get("id")
                    if not source_id:
                        continue

                    source_node_id = f"{source_type}/{source_id}"

                    if source_node_id not in visited:
                        # Add link
                        result["links"].append({
                            "source": source_node_id,
                            "target": node_id,
                            "field": search_param,
                            "type": "reverse"
                        })

                        # Recursively explore if not at max depth
                        if current_depth < max_depth:
                            visited.add(source_node_id)
                            await self._discover_recursive(
                                source_resource,
                                source_type,
                                source_id,
                                max_depth,
                                current_depth + 1,
                                visited,
                                result,
                                include_counts
                            )

            except Exception as e:
                logger.debug(f"Error searching for reverse references from {source_type}: {e}")
                continue

    async def get_relationship_statistics(
        self,
        resource_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get statistical information about relationships.

        Uses FHIR searches to count resources and relationships.
        """
        stats = {
            "totalResources": 0,
            "resourceTypeCounts": {},
            "mostConnectedTypes": []
        }

        # Define resource types to check
        resource_types_to_check = [resource_type] if resource_type else list(REFERENCE_FIELDS.keys())

        for res_type in resource_types_to_check:
            try:
                # Get count for this resource type
                bundle = await self.hapi_client.search(
                    res_type,
                    {"_summary": "count"}
                )
                count = bundle.get("total", 0)
                stats["resourceTypeCounts"][res_type] = count
                stats["totalResources"] += count
            except Exception as e:
                logger.debug(f"Could not get count for {res_type}: {e}")
                stats["resourceTypeCounts"][res_type] = 0

        # Sort by count to find most connected types
        sorted_types = sorted(
            stats["resourceTypeCounts"].items(),
            key=lambda x: -x[1]
        )[:10]

        stats["mostConnectedTypes"] = [
            {"resourceType": rt, "count": count}
            for rt, count in sorted_types
        ]

        return stats

    async def find_relationship_paths(
        self,
        source_type: str,
        source_id: str,
        target_type: str,
        target_id: str,
        max_depth: int = 3
    ) -> Dict[str, Any]:
        """
        Find paths between two resources.

        Uses breadth-first search through FHIR references.
        """
        # Verify both resources exist
        try:
            source = await self.hapi_client.read(source_type, source_id)
            target = await self.hapi_client.read(target_type, target_id)
        except Exception as e:
            raise FHIRResourceNotFoundError(
                message="Source or target resource not found",
                resource_type=source_type if "source" in str(e) else target_type,
                resource_id=source_id if "source" in str(e) else target_id
            )

        paths = []
        source_ref = f"{source_type}/{source_id}"
        target_ref = f"{target_type}/{target_id}"

        # BFS to find paths
        queue: List[Tuple[str, List[str]]] = [(source_ref, [source_ref])]
        visited: Set[str] = set()

        while queue and len(paths) < 10:  # Limit to 10 paths
            current, path = queue.pop(0)

            if len(path) > max_depth + 1:
                continue

            if current == target_ref:
                # Found a path
                path_details = []
                for i in range(len(path) - 1):
                    path_details.append({
                        "from": path[i],
                        "to": path[i + 1],
                        "step": i + 1
                    })
                paths.append(path_details)
                continue

            if current in visited:
                continue
            visited.add(current)

            # Get connected resources
            current_type, current_id = current.split("/")
            try:
                resource = await self.hapi_client.read(current_type, current_id)
                connected = self._get_all_references(resource, current_type)
                for next_ref in connected:
                    if next_ref not in path:
                        queue.append((next_ref, path + [next_ref]))
            except Exception:
                continue

        return {
            "source": {
                "resourceType": source_type,
                "id": source_id,
                "display": self._get_resource_display(source)
            },
            "target": {
                "resourceType": target_type,
                "id": target_id,
                "display": self._get_resource_display(target)
            },
            "paths": paths,
            "pathCount": len(paths)
        }

    def _extract_references(
        self,
        resource: Dict[str, Any],
        field_name: str
    ) -> List[str]:
        """Extract reference strings from a field."""
        if field_name not in resource:
            return []

        value = resource[field_name]
        references = []

        if isinstance(value, dict) and "reference" in value:
            references.append(value["reference"])
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict) and "reference" in item:
                    references.append(item["reference"])

        return references

    def _get_all_references(
        self,
        resource: Dict[str, Any],
        resource_type: str
    ) -> List[str]:
        """Get all reference strings from a resource."""
        references = []
        ref_fields = REFERENCE_FIELDS.get(resource_type, {})

        for field_name in ref_fields.keys():
            references.extend(self._extract_references(resource, field_name))

        return references

    def _parse_reference(self, ref_string: str) -> Tuple[Optional[str], Optional[str]]:
        """Parse a reference string into (resource_type, resource_id)."""
        if not ref_string:
            return None, None

        # Handle URN format
        if ref_string.startswith("urn:uuid:"):
            return None, None  # Can't determine type from URN alone

        # Standard format: ResourceType/ResourceId
        parts = ref_string.split("/")
        if len(parts) == 2:
            return parts[0], parts[1]

        return None, None

    def _get_resource_display(self, resource: Dict[str, Any]) -> str:
        """Extract a display name from a FHIR resource."""
        # Try name field (Patient, Practitioner, Organization)
        if "name" in resource:
            names = resource["name"]
            if isinstance(names, list) and names:
                name = names[0]
                if "text" in name:
                    return name["text"]
                if "family" in name:
                    given = " ".join(name.get("given", []))
                    return f"{given} {name['family']}".strip()
            elif isinstance(names, str):
                return names

        # Try display field
        if "display" in resource:
            return resource["display"]

        # Try code.text (Observation, Condition, etc.)
        if "code" in resource:
            code = resource["code"]
            if isinstance(code, dict):
                if "text" in code:
                    return code["text"]
                if "coding" in code and code["coding"]:
                    for coding in code["coding"]:
                        if "display" in coding:
                            return coding["display"]

        # Fallback to resourceType/id
        return f"{resource.get('resourceType', 'Resource')} {resource.get('id', '')}"

    def invalidate_cache(
        self,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None
    ):
        """
        Invalidate cached relationships.

        Args:
            resource_type: Optional - invalidate all cache for this resource type
            resource_id: Optional - if resource_type also given, invalidate specific resource
        """
        if resource_type is None:
            self._cache.clear()
        elif resource_id:
            # Clear entries starting with this resource
            prefix = f"{resource_type}/{resource_id}:"
            keys_to_remove = [k for k in self._cache.keys() if k.startswith(prefix)]
            for key in keys_to_remove:
                self._cache.pop(key, None)
        else:
            # Clear all entries for resource type
            prefix = f"{resource_type}/"
            keys_to_remove = [k for k in self._cache.keys() if k.startswith(prefix)]
            for key in keys_to_remove:
                self._cache.pop(key, None)


# Module-level singleton for shared cache
_relationship_cache: Optional[RelationshipCache] = None


def get_relationship_cache() -> RelationshipCache:
    """Get or create the singleton RelationshipCache instance."""
    global _relationship_cache
    if _relationship_cache is None:
        _relationship_cache = RelationshipCache()
    return _relationship_cache
