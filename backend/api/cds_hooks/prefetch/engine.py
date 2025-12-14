"""
CDS Hooks Prefetch Query Execution Engine

Handles parsing and executing FHIR prefetch templates for CDS Hooks optimization.
Moved from prefetch_engine.py to prefetch/engine.py as part of architecture cleanup.

Educational Focus:
- Demonstrates FHIR query template resolution
- Shows parallel prefetch execution for performance
- Illustrates CDS Hooks prefetch specification compliance
"""

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import re
import json
import logging
import asyncio
from urllib.parse import quote

logger = logging.getLogger(__name__)


class PrefetchTemplates:
    """
    Common prefetch templates for CDS Hooks.

    Educational Notes:
        - Templates use {{context.field}} syntax for variable substitution
        - Patient is the most common prefetch (almost always needed)
        - Templates are hook-type specific for optimization
    """

    # Common prefetch patterns
    PATIENT = "Patient/{{context.patientId}}"
    MEDICATIONS = "MedicationRequest?patient={{context.patientId}}&status=active"
    CONDITIONS = "Condition?patient={{context.patientId}}&clinical-status=active"
    ALLERGIES = "AllergyIntolerance?patient={{context.patientId}}"
    VITAL_SIGNS = "Observation?patient={{context.patientId}}&category=vital-signs&_count=10"
    LAB_RESULTS = "Observation?patient={{context.patientId}}&category=laboratory&_count=20"
    ENCOUNTERS = "Encounter?patient={{context.patientId}}&_count=5&_sort=-date"
    PROCEDURES = "Procedure?patient={{context.patientId}}&_count=10"
    IMMUNIZATIONS = "Immunization?patient={{context.patientId}}"
    CARE_PLANS = "CarePlan?patient={{context.patientId}}&status=active"

    # Hook-specific recommended prefetch configurations
    HOOK_RECOMMENDATIONS = {
        "patient-view": {
            "patient": PATIENT,
            "conditions": CONDITIONS,
            "medications": MEDICATIONS,
            "allergies": ALLERGIES,
            "recentLabs": LAB_RESULTS
        },
        "medication-prescribe": {
            "patient": PATIENT,
            "medications": MEDICATIONS,
            "allergies": ALLERGIES,
            "conditions": CONDITIONS
        },
        "order-select": {
            "patient": PATIENT,
            "recentOrders": "ServiceRequest?patient={{context.patientId}}&_count=10&_sort=-authored"
        },
        "order-sign": {
            "patient": PATIENT,
            "draftOrders": "ServiceRequest?patient={{context.patientId}}&status=draft"
        },
        "encounter-start": {
            "patient": PATIENT,
            "encounter": "Encounter/{{context.encounterId}}",
            "conditions": CONDITIONS,
            "medications": MEDICATIONS
        },
        "encounter-discharge": {
            "patient": PATIENT,
            "encounter": "Encounter/{{context.encounterId}}",
            "medications": MEDICATIONS,
            "procedures": "Procedure?encounter={{context.encounterId}}"
        }
    }

    @classmethod
    def get_for_hook(cls, hook_type: str) -> Dict[str, str]:
        """Get recommended prefetch templates for a hook type."""
        return cls.HOOK_RECOMMENDATIONS.get(hook_type, {})


class PrefetchResolver:
    """
    Resolves prefetch template variables.

    Educational Notes:
        - {{context.patientId}} extracts from context["patientId"]
        - Nested paths like {{context.user.id}} are supported
        - Missing values leave the template unchanged (for debugging)
    """

    TOKEN_PATTERN = re.compile(r"\{\{([^}]+)\}\}")

    @classmethod
    def resolve_template(cls, template: str, context: Dict[str, Any]) -> str:
        """
        Replace template tokens with actual values from context.

        Args:
            template: FHIR query template with {{variable}} placeholders
            context: CDS Hooks context containing values

        Returns:
            Resolved FHIR query string
        """
        def replace_token(match):
            token_path = match.group(1)
            parts = token_path.split(".")

            # Navigate through context to find value
            value = context
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    logger.warning(f"Token path '{token_path}' not found in context")
                    return match.group(0)  # Return original if not found

            return str(value)

        return cls.TOKEN_PATTERN.sub(replace_token, template)

    @classmethod
    def parse_query(cls, query: str) -> Tuple[str, Dict[str, str]]:
        """
        Parse FHIR query into resource type and parameters.

        Args:
            query: FHIR query string (e.g., "Patient/123" or "Observation?patient=123")

        Returns:
            Tuple of (resource_type/path, parameters dict)
        """
        if "?" in query:
            resource_part, param_part = query.split("?", 1)
            params = {}

            for param in param_part.split("&"):
                if "=" in param:
                    key, value = param.split("=", 1)
                    params[key] = value

            return resource_part, params
        else:
            return query, {}


class PrefetchEngine:
    """
    Executes FHIR prefetch queries for CDS Hooks.

    This engine handles:
    - Template variable resolution
    - Parallel query execution
    - FHIR resource fetching and searching
    - Error handling and logging

    Educational Notes:
        - Prefetch improves CDS service performance by loading data upfront
        - Queries execute in parallel using asyncio.gather
        - Results are cached per-request, not globally
    """

    def __init__(self, fhir_client=None):
        """
        Initialize the prefetch engine.

        Args:
            fhir_client: Optional FHIR client for making requests.
                        If not provided, will attempt to use the global client.
        """
        self._fhir_client = fhir_client

    @property
    def fhir_client(self):
        """Get the FHIR client, lazily loading if needed."""
        if self._fhir_client is None:
            # Use HAPIFHIRPrefetchClient for async HAPI FHIR integration
            self._fhir_client = HAPIFHIRPrefetchClient()
        return self._fhir_client

    async def execute_prefetch(
        self,
        prefetch_config: Dict[str, str],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute all prefetch queries defined in the configuration.

        Args:
            prefetch_config: Map of prefetch key to FHIR query template
            context: CDS Hooks context with values for template resolution

        Returns:
            Map of prefetch key to FHIR resource/bundle result
        """
        if not prefetch_config:
            return {}

        # Execute queries in parallel for performance
        tasks = []
        keys = list(prefetch_config.keys())

        for key in keys:
            template = prefetch_config[key]
            task = self._execute_single_prefetch(key, template, context)
            tasks.append(task)

        completed_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine results
        results = {}
        for idx, key in enumerate(keys):
            result = completed_results[idx]
            if isinstance(result, Exception):
                logger.error(f"Prefetch error for '{key}': {result}")
                results[key] = None
            else:
                results[key] = result

        return results

    async def _execute_single_prefetch(
        self,
        key: str,
        template: str,
        context: Dict[str, Any]
    ) -> Any:
        """Execute a single prefetch query."""
        try:
            # Replace tokens in template
            query = PrefetchResolver.resolve_template(template, context)

            # Parse query to determine resource type and parameters
            resource_path, params = PrefetchResolver.parse_query(query)

            # Execute appropriate query based on resource type
            if "/" in resource_path and not params:
                # Direct resource fetch (e.g., Patient/123)
                return await self._fetch_resource_by_id(resource_path)
            else:
                # Search query
                return await self._search_resources(resource_path, params)

        except Exception as e:
            logger.error(f"Error executing prefetch for '{key}': {e}")
            raise

    async def _fetch_resource_by_id(self, resource_path: str) -> Optional[Dict[str, Any]]:
        """Fetch a specific resource by ID using FHIR client."""
        try:
            parts = resource_path.split("/")
            if len(parts) != 2:
                logger.warning(f"Invalid resource path: {resource_path}")
                return None

            resource_type, resource_id = parts
            return await self.fhir_client.get_resource(resource_type, resource_id)

        except Exception as e:
            logger.error(f"Error fetching resource {resource_path}: {e}")
            return None

    async def _search_resources(
        self,
        resource_type: str,
        params: Dict[str, str]
    ) -> Dict[str, Any]:
        """Search for resources based on parameters."""
        try:
            resources = await self.fhir_client.search_resources(resource_type, params)

            # Create bundle response
            bundle = {
                "resourceType": "Bundle",
                "type": "searchset",
                "total": len(resources) if resources else 0,
                "entry": [
                    {
                        "resource": resource,
                        "fullUrl": f"{resource_type}/{resource.get('id', 'unknown')}"
                    }
                    for resource in (resources or [])
                ]
            }

            return bundle

        except Exception as e:
            logger.error(f"Error searching resources: {e}")
            return {
                "resourceType": "Bundle",
                "type": "searchset",
                "total": 0,
                "entry": []
            }

    def get_recommended_prefetch(self, hook_type: str) -> Dict[str, str]:
        """Get recommended prefetch configuration for a hook type."""
        return PrefetchTemplates.get_for_hook(hook_type)


class FHIRClientWrapper:
    """
    Wrapper around FHIR client functions for consistent interface.

    Educational Notes:
        - Adapts different FHIR client implementations
        - Provides async interface for sync clients
        - Handles resource conversion to dict format
    """

    def __init__(self, get_resource_fn, search_resources_fn):
        self._get_resource = get_resource_fn
        self._search_resources = search_resources_fn

    async def get_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a specific resource by type and ID."""
        try:
            # Run sync function in executor if needed
            loop = asyncio.get_event_loop()
            resource = await loop.run_in_executor(
                None,
                lambda: self._get_resource(resource_type, resource_id)
            )

            if resource:
                # Convert to dict if needed
                if hasattr(resource, "as_json"):
                    return resource.as_json()
                elif isinstance(resource, dict):
                    return resource
            return None

        except Exception as e:
            logger.error(f"Error fetching {resource_type}/{resource_id}: {e}")
            return None

    async def search_resources(
        self,
        resource_type: str,
        params: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Search for resources."""
        try:
            loop = asyncio.get_event_loop()
            resources = await loop.run_in_executor(
                None,
                lambda: self._search_resources(resource_type, params)
            )

            if resources:
                # Convert to list of dicts
                result = []
                for resource in resources:
                    if hasattr(resource, "as_json"):
                        result.append(resource.as_json())
                    elif isinstance(resource, dict):
                        result.append(resource)
                return result
            return []

        except Exception as e:
            logger.error(f"Error searching {resource_type}: {e}")
            return []


class NoOpFHIRClient:
    """No-op FHIR client for when no client is available."""

    async def get_resource(self, resource_type: str, resource_id: str) -> None:
        return None

    async def search_resources(
        self,
        resource_type: str,
        params: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        return []


class HAPIFHIRPrefetchClient:
    """
    FHIR client implementation using HAPI FHIR server.

    Educational Notes:
        - Direct HTTP calls to HAPI FHIR JPA Server
        - Supports all FHIR R4 search parameters
        - Production-ready implementation
    """

    def __init__(self, base_url: str = "http://hapi-fhir:8080/fhir"):
        self.base_url = base_url.rstrip("/")

    async def get_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a specific resource from HAPI FHIR."""
        try:
            import httpx

            async with httpx.AsyncClient() as client:
                url = f"{self.base_url}/{resource_type}/{resource_id}"
                response = await client.get(url, timeout=10.0)

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return None
                else:
                    logger.error(
                        f"HAPI FHIR error: {response.status_code} for {url}"
                    )
                    return None

        except Exception as e:
            logger.error(f"Error fetching from HAPI FHIR: {e}")
            return None

    async def search_resources(
        self,
        resource_type: str,
        params: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Search resources in HAPI FHIR."""
        try:
            import httpx

            async with httpx.AsyncClient() as client:
                url = f"{self.base_url}/{resource_type}"
                response = await client.get(url, params=params, timeout=10.0)

                if response.status_code == 200:
                    bundle = response.json()
                    return [
                        entry.get("resource", {})
                        for entry in bundle.get("entry", [])
                    ]
                else:
                    logger.error(
                        f"HAPI FHIR search error: {response.status_code}"
                    )
                    return []

        except Exception as e:
            logger.error(f"Error searching HAPI FHIR: {e}")
            return []


# Global engine instance
_engine: Optional[PrefetchEngine] = None


def get_prefetch_engine(fhir_client=None) -> PrefetchEngine:
    """Get or create the global prefetch engine."""
    global _engine
    if _engine is None or fhir_client is not None:
        _engine = PrefetchEngine(fhir_client)
    return _engine


async def execute_prefetch(
    prefetch_config: Dict[str, str],
    context: Dict[str, Any],
    fhir_client=None
) -> Dict[str, Any]:
    """
    Convenience function to execute prefetch queries.

    Args:
        prefetch_config: Map of prefetch key to FHIR query template
        context: CDS Hooks context
        fhir_client: Optional FHIR client

    Returns:
        Map of prefetch key to result
    """
    engine = get_prefetch_engine(fhir_client)
    return await engine.execute_prefetch(prefetch_config, context)
