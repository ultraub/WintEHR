"""
SearchValueCache - FHIR Search Parameter Value Cache Service

Provides cached distinct values for FHIR search parameters using FHIR API
operations instead of direct database queries to HAPI FHIR internal tables.

Architecture:
- Uses HAPIFHIRClient for all FHIR operations (no direct DB access)
- Caches results with TTL for performance
- Extracts values from search results and aggregates them
- Falls back to standard value sets for well-known parameters

Educational Notes:
- This service demonstrates proper FHIR API usage patterns
- FHIR doesn't have a native "get distinct values" operation
- We use search with _summary=count and extract values from results
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

from services.hapi_fhir_client import HAPIFHIRClient
from shared.exceptions import FHIRConnectionError

logger = logging.getLogger(__name__)


# Standard value sets for well-known FHIR parameters
STANDARD_VALUE_SETS = {
    "gender": [
        {"value": "male", "display": "Male", "system": "http://hl7.org/fhir/administrative-gender"},
        {"value": "female", "display": "Female", "system": "http://hl7.org/fhir/administrative-gender"},
        {"value": "other", "display": "Other", "system": "http://hl7.org/fhir/administrative-gender"},
        {"value": "unknown", "display": "Unknown", "system": "http://hl7.org/fhir/administrative-gender"},
    ],
    "status": {
        "Patient": [
            {"value": "active", "display": "Active"},
            {"value": "inactive", "display": "Inactive"},
        ],
        "Observation": [
            {"value": "registered", "display": "Registered"},
            {"value": "preliminary", "display": "Preliminary"},
            {"value": "final", "display": "Final"},
            {"value": "amended", "display": "Amended"},
            {"value": "corrected", "display": "Corrected"},
            {"value": "cancelled", "display": "Cancelled"},
            {"value": "entered-in-error", "display": "Entered in Error"},
        ],
        "MedicationRequest": [
            {"value": "active", "display": "Active"},
            {"value": "on-hold", "display": "On Hold"},
            {"value": "cancelled", "display": "Cancelled"},
            {"value": "completed", "display": "Completed"},
            {"value": "entered-in-error", "display": "Entered in Error"},
            {"value": "stopped", "display": "Stopped"},
            {"value": "draft", "display": "Draft"},
        ],
        "Condition": [
            {"value": "active", "display": "Active"},
            {"value": "recurrence", "display": "Recurrence"},
            {"value": "relapse", "display": "Relapse"},
            {"value": "inactive", "display": "Inactive"},
            {"value": "remission", "display": "Remission"},
            {"value": "resolved", "display": "Resolved"},
        ],
        "Encounter": [
            {"value": "planned", "display": "Planned"},
            {"value": "arrived", "display": "Arrived"},
            {"value": "triaged", "display": "Triaged"},
            {"value": "in-progress", "display": "In Progress"},
            {"value": "onleave", "display": "On Leave"},
            {"value": "finished", "display": "Finished"},
            {"value": "cancelled", "display": "Cancelled"},
        ],
    },
    "clinical-status": [
        {"value": "active", "display": "Active"},
        {"value": "recurrence", "display": "Recurrence"},
        {"value": "relapse", "display": "Relapse"},
        {"value": "inactive", "display": "Inactive"},
        {"value": "remission", "display": "Remission"},
        {"value": "resolved", "display": "Resolved"},
    ],
    "verification-status": [
        {"value": "unconfirmed", "display": "Unconfirmed"},
        {"value": "provisional", "display": "Provisional"},
        {"value": "differential", "display": "Differential"},
        {"value": "confirmed", "display": "Confirmed"},
        {"value": "refuted", "display": "Refuted"},
        {"value": "entered-in-error", "display": "Entered in Error"},
    ],
}

# Search parameter to resource field mappings
PARAMETER_FIELD_MAPPINGS = {
    "gender": "gender",
    "status": "status",
    "clinical-status": "clinicalStatus.coding[0].code",
    "verification-status": "verificationStatus.coding[0].code",
    "category": "category[0].coding[0].code",
    "code": "code.coding[0].code",
    "class": "class.code",
    "type": "type[0].coding[0].code",
}


class SearchValueCache:
    """
    Service for caching and retrieving distinct values for FHIR search parameters.

    Uses FHIR API operations through HAPIFHIRClient instead of direct database access.
    """

    def __init__(self, cache_ttl_seconds: int = 300):
        """
        Initialize the SearchValueCache.

        Args:
            cache_ttl_seconds: Time-to-live for cached values (default: 5 minutes)
        """
        self.hapi_client = HAPIFHIRClient()
        self.cache_ttl = timedelta(seconds=cache_ttl_seconds)
        self._cache: Dict[str, Tuple[datetime, List[Dict[str, Any]]]] = {}
        self._lock = asyncio.Lock()

    def _get_cache_key(self, resource_type: str, parameter_name: str) -> str:
        """Generate cache key for resource type and parameter."""
        return f"{resource_type}:{parameter_name}"

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached value is still valid."""
        if cache_key not in self._cache:
            return False
        cached_time, _ = self._cache[cache_key]
        return datetime.utcnow() - cached_time < self.cache_ttl

    async def get_distinct_values(
        self,
        resource_type: str,
        parameter_name: str,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Get distinct values for a search parameter.

        Uses FHIR API search with pagination to gather values, then extracts
        and aggregates distinct values from the results.

        Args:
            resource_type: FHIR resource type (e.g., "Patient", "Observation")
            parameter_name: Search parameter name (e.g., "gender", "status")
            limit: Maximum number of distinct values to return

        Returns:
            Dict with resource_type, parameter, values list, and total count
        """
        cache_key = self._get_cache_key(resource_type, parameter_name)

        # Check cache first
        if self._is_cache_valid(cache_key):
            _, cached_values = self._cache[cache_key]
            return {
                "resource_type": resource_type,
                "parameter": parameter_name,
                "values": cached_values[:limit],
                "total": len(cached_values),
                "cached": True
            }

        async with self._lock:
            # Double-check after acquiring lock
            if self._is_cache_valid(cache_key):
                _, cached_values = self._cache[cache_key]
                return {
                    "resource_type": resource_type,
                    "parameter": parameter_name,
                    "values": cached_values[:limit],
                    "total": len(cached_values),
                    "cached": True
                }

            try:
                # Fetch values using FHIR API
                values = await self._fetch_values_from_fhir(
                    resource_type, parameter_name, limit
                )

                # Merge with standard values if applicable
                values = self._merge_with_standard_values(
                    resource_type, parameter_name, values
                )

                # Cache the results
                self._cache[cache_key] = (datetime.utcnow(), values)

                return {
                    "resource_type": resource_type,
                    "parameter": parameter_name,
                    "values": values[:limit],
                    "total": len(values),
                    "cached": False
                }

            except FHIRConnectionError as e:
                logger.error(f"FHIR connection error fetching values: {e}")
                # Fall back to standard values if available
                fallback_values = self._get_standard_values(resource_type, parameter_name)
                if fallback_values:
                    return {
                        "resource_type": resource_type,
                        "parameter": parameter_name,
                        "values": fallback_values[:limit],
                        "total": len(fallback_values),
                        "fallback": True
                    }
                raise
            except Exception as e:
                logger.error(f"Error fetching distinct values for {resource_type}.{parameter_name}: {e}")
                raise

    async def _fetch_values_from_fhir(
        self,
        resource_type: str,
        parameter_name: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Fetch distinct values by searching FHIR resources and extracting values.

        This method searches for resources and aggregates the values from
        the specified parameter field.
        """
        value_counts: Dict[str, int] = defaultdict(int)

        try:
            # Search for resources with _count and extract values
            # Use _elements to limit returned fields for efficiency
            search_params = {
                "_count": str(min(500, limit * 5)),  # Get enough resources to find distinct values
                "_sort": "-_lastUpdated",  # Get most recent first
            }

            bundle = await self.hapi_client.search(resource_type, search_params)

            # Extract values from each resource
            for entry in bundle.get("entry", []):
                resource = entry.get("resource", {})
                value = self._extract_parameter_value(resource, parameter_name)
                if value:
                    value_counts[value] += 1

            # Convert to list format sorted by count
            values = []
            for value, count in sorted(value_counts.items(), key=lambda x: -x[1]):
                values.append({
                    "value": value,
                    "display": self._format_display(value),
                    "count": count
                })

            return values

        except Exception as e:
            logger.warning(f"Error fetching FHIR values for {resource_type}.{parameter_name}: {e}")
            return []

    def _extract_parameter_value(
        self,
        resource: Dict[str, Any],
        parameter_name: str
    ) -> Optional[str]:
        """
        Extract the value for a search parameter from a resource.

        Handles various FHIR data types including simple values, CodeableConcepts,
        and nested structures.
        """
        # Direct field mapping
        if parameter_name in PARAMETER_FIELD_MAPPINGS:
            field_path = PARAMETER_FIELD_MAPPINGS[parameter_name]
            return self._get_nested_value(resource, field_path)

        # Try direct field access
        if parameter_name in resource:
            value = resource[parameter_name]
            if isinstance(value, str):
                return value
            elif isinstance(value, dict):
                # CodeableConcept or similar
                if "coding" in value and value["coding"]:
                    return value["coding"][0].get("code")
                return value.get("code") or value.get("value")
            elif isinstance(value, list) and value:
                first = value[0]
                if isinstance(first, dict):
                    if "coding" in first and first["coding"]:
                        return first["coding"][0].get("code")
                    return first.get("code") or first.get("value")
                return str(first)

        return None

    def _get_nested_value(self, obj: Dict[str, Any], path: str) -> Optional[str]:
        """Get a value from a nested path like 'clinicalStatus.coding[0].code'."""
        try:
            parts = path.replace("[", ".").replace("]", "").split(".")
            current = obj
            for part in parts:
                if part.isdigit():
                    current = current[int(part)]
                else:
                    current = current.get(part)
                if current is None:
                    return None
            return str(current) if current is not None else None
        except (KeyError, IndexError, TypeError):
            return None

    def _format_display(self, value: str) -> str:
        """Format a value for display."""
        # Convert hyphenated/underscored codes to title case
        return value.replace("-", " ").replace("_", " ").title()

    def _merge_with_standard_values(
        self,
        resource_type: str,
        parameter_name: str,
        fetched_values: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Merge fetched values with standard value sets."""
        standard_values = self._get_standard_values(resource_type, parameter_name)
        if not standard_values:
            return fetched_values

        # Create map of existing values
        existing = {v["value"]: v for v in fetched_values}

        # Add standard values that aren't present
        for std_val in standard_values:
            if std_val["value"] not in existing:
                fetched_values.append({
                    "value": std_val["value"],
                    "display": std_val["display"],
                    "count": 0
                })

        return fetched_values

    def _get_standard_values(
        self,
        resource_type: str,
        parameter_name: str
    ) -> List[Dict[str, Any]]:
        """Get standard values for a parameter if defined."""
        if parameter_name in STANDARD_VALUE_SETS:
            values = STANDARD_VALUE_SETS[parameter_name]
            if isinstance(values, dict):
                # Resource-type-specific values
                return values.get(resource_type, [])
            return values
        return []

    async def get_searchable_parameters(
        self,
        resource_type: str
    ) -> Dict[str, Any]:
        """
        Get searchable parameters for a resource type using FHIR capabilities.

        Queries the FHIR server's CapabilityStatement to get supported
        search parameters for the resource type.
        """
        try:
            # Get CapabilityStatement from FHIR server
            metadata = await self.hapi_client.read("metadata", "")

            # Find rest server entry
            rest_servers = metadata.get("rest", [])
            for server in rest_servers:
                if server.get("mode") == "server":
                    # Find resource entry
                    for resource_entry in server.get("resource", []):
                        if resource_entry.get("type") == resource_type:
                            search_params = resource_entry.get("searchParam", [])
                            parameters = [
                                {
                                    "name": sp.get("name"),
                                    "type": sp.get("type"),
                                    "documentation": sp.get("documentation")
                                }
                                for sp in search_params
                            ]
                            return {
                                "resource_type": resource_type,
                                "parameters": parameters,
                                "total": len(parameters)
                            }

            # Resource type not found in capability statement
            return {
                "resource_type": resource_type,
                "parameters": [],
                "total": 0
            }

        except Exception as e:
            logger.error(f"Error fetching searchable parameters for {resource_type}: {e}")
            # Return common parameters as fallback
            common_params = ["_id", "_lastUpdated", "identifier"]
            return {
                "resource_type": resource_type,
                "parameters": [{"name": p, "type": "token"} for p in common_params],
                "total": len(common_params),
                "fallback": True
            }

    def invalidate_cache(
        self,
        resource_type: Optional[str] = None,
        parameter_name: Optional[str] = None
    ):
        """
        Invalidate cached values.

        Args:
            resource_type: Optional - invalidate all cache for this resource type
            parameter_name: Optional - if resource_type also given, invalidate specific entry
        """
        if resource_type is None:
            # Clear all cache
            self._cache.clear()
        elif parameter_name:
            # Clear specific entry
            cache_key = self._get_cache_key(resource_type, parameter_name)
            self._cache.pop(cache_key, None)
        else:
            # Clear all entries for resource type
            keys_to_remove = [
                k for k in self._cache.keys()
                if k.startswith(f"{resource_type}:")
            ]
            for key in keys_to_remove:
                self._cache.pop(key, None)


# Module-level singleton for shared cache
_search_value_cache: Optional[SearchValueCache] = None


def get_search_value_cache() -> SearchValueCache:
    """Get or create the singleton SearchValueCache instance."""
    global _search_value_cache
    if _search_value_cache is None:
        _search_value_cache = SearchValueCache()
    return _search_value_cache
