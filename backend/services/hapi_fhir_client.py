"""
HAPI FHIR Client - Async Python client for HAPI FHIR JPA Server

This module provides an async client for interacting with HAPI FHIR server.
All Phase 3+ clinical routers use this client for FHIR operations.

Architecture:
- Async/await compatible with FastAPI
- Dict-based interface (matches HAPI FHIR JSON directly)
- Lightweight proxy to HAPI FHIR server
- HAPI FHIR handles validation, indexing, and storage

Migration Note:
This client has replaced the deprecated fhir_client_config.py (now deleted).
All backend code now uses HAPIFHIRClient for async FHIR operations.
"""

import httpx
import logging
import os
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# HAPI FHIR server configuration
HAPI_FHIR_BASE_URL = os.getenv('HAPI_FHIR_URL', 'http://hapi-fhir:8080/fhir')


class HAPIFHIRClient:
    """
    Async client for HAPI FHIR JPA Server operations.

    Usage:
        hapi_client = HAPIFHIRClient()

        # Search resources
        bundle = await hapi_client.search("Patient", {"name": "Smith"})

        # Read resource
        patient = await hapi_client.read("Patient", "123")

        # Create resource
        created = await hapi_client.create("Patient", patient_data)

        # Update resource
        updated = await hapi_client.update("Patient", "123", patient_data)

        # Delete resource
        await hapi_client.delete("Patient", "123")
    """

    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize HAPI FHIR client.

        Args:
            base_url: Optional override for HAPI FHIR base URL
        """
        self.base_url = base_url or HAPI_FHIR_BASE_URL
        self.timeout = 30.0

    async def search(
        self,
        resource_type: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Search for FHIR resources.

        Args:
            resource_type: FHIR resource type (e.g., "Patient", "Observation")
            params: Search parameters as dict (e.g., {"name": "Smith", "status": "active"})

        Returns:
            FHIR Bundle dict with search results

        Example:
            bundle = await client.search("MedicationRequest", {
                "patient": "Patient/123",
                "status": "active"
            })

            for entry in bundle.get("entry", []):
                resource = entry.get("resource", {})
                print(resource.get("id"))
        """
        url = f"{self.base_url}/{resource_type}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params or {})
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"HAPI FHIR search error for {resource_type}: {e.response.status_code} - {e.response.text}")
            raise Exception(f"FHIR search failed: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"HAPI FHIR connection error: {e}")
            raise Exception(f"Failed to connect to FHIR server: {str(e)}")

    async def read(self, resource_type: str, resource_id: str) -> Dict[str, Any]:
        """
        Read a specific FHIR resource by ID.

        Args:
            resource_type: FHIR resource type
            resource_id: Resource identifier

        Returns:
            FHIR resource dict

        Example:
            patient = await client.read("Patient", "123")
            print(patient.get("name"))
        """
        url = f"{self.base_url}/{resource_type}/{resource_id}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"Resource not found: {resource_type}/{resource_id}")
                raise Exception(f"{resource_type}/{resource_id} not found")
            logger.error(f"HAPI FHIR read error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"FHIR read failed: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"HAPI FHIR connection error: {e}")
            raise Exception(f"Failed to connect to FHIR server: {str(e)}")

    async def create(self, resource_type: str, resource_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new FHIR resource.

        Args:
            resource_type: FHIR resource type
            resource_data: FHIR resource dict (must include "resourceType")

        Returns:
            Created FHIR resource dict with server-assigned ID

        Example:
            patient = {
                "resourceType": "Patient",
                "name": [{"family": "Smith", "given": ["John"]}]
            }
            created = await client.create("Patient", patient)
            patient_id = created.get("id")
        """
        url = f"{self.base_url}/{resource_type}"

        # Ensure resourceType is set
        if "resourceType" not in resource_data:
            resource_data["resourceType"] = resource_type

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=resource_data,
                    headers={"Content-Type": "application/fhir+json"}
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"HAPI FHIR create error for {resource_type}: {e.response.status_code} - {e.response.text}")
            raise Exception(f"FHIR create failed: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"HAPI FHIR connection error: {e}")
            raise Exception(f"Failed to connect to FHIR server: {str(e)}")

    async def update(
        self,
        resource_type: str,
        resource_id: str,
        resource_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update an existing FHIR resource.

        Args:
            resource_type: FHIR resource type
            resource_id: Resource identifier
            resource_data: Updated FHIR resource dict

        Returns:
            Updated FHIR resource dict

        Example:
            patient = await client.read("Patient", "123")
            patient["active"] = True
            updated = await client.update("Patient", "123", patient)
        """
        url = f"{self.base_url}/{resource_type}/{resource_id}"

        # Ensure resourceType and id are set
        if "resourceType" not in resource_data:
            resource_data["resourceType"] = resource_type
        if "id" not in resource_data:
            resource_data["id"] = resource_id

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.put(
                    url,
                    json=resource_data,
                    headers={"Content-Type": "application/fhir+json"}
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"HAPI FHIR update error for {resource_type}/{resource_id}: {e.response.status_code} - {e.response.text}")
            raise Exception(f"FHIR update failed: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"HAPI FHIR connection error: {e}")
            raise Exception(f"Failed to connect to FHIR server: {str(e)}")

    async def delete(self, resource_type: str, resource_id: str) -> bool:
        """
        Delete a FHIR resource.

        Args:
            resource_type: FHIR resource type
            resource_id: Resource identifier

        Returns:
            True if deleted successfully

        Example:
            success = await client.delete("Patient", "123")
        """
        url = f"{self.base_url}/{resource_type}/{resource_id}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.delete(url)
                response.raise_for_status()
                return True

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"Resource not found for deletion: {resource_type}/{resource_id}")
                return False
            logger.error(f"HAPI FHIR delete error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"FHIR delete failed: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"HAPI FHIR connection error: {e}")
            raise Exception(f"Failed to connect to FHIR server: {str(e)}")

    async def operation(
        self,
        operation_path: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a FHIR operation (e.g., $everything, $validate).

        Args:
            operation_path: Operation path (e.g., "Patient/123/$everything")
            params: Optional operation parameters

        Returns:
            Operation result dict

        Example:
            # Get all resources for a patient
            bundle = await client.operation("Patient/123/$everything")
        """
        url = f"{self.base_url}/{operation_path}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params or {})
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"HAPI FHIR operation error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"FHIR operation failed: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"HAPI FHIR connection error: {e}")
            raise Exception(f"Failed to connect to FHIR server: {str(e)}")

    async def bulk_patch(
        self,
        resource_type: str,
        patch_operations: List[Dict[str, Any]],
        query_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute bulk PATCH operation on multiple resources (HAPI FHIR v8.4.0+).

        Uses HAPI FHIR's $hapi.fhir.bulk-patch extended operation for efficient
        mass updates to resources matching a query.

        Args:
            resource_type: FHIR resource type to patch (e.g., "Patient", "Observation")
            patch_operations: List of JSON Patch operations to apply
                Example: [
                    {"op": "replace", "path": "/active", "value": True},
                    {"op": "add", "path": "/meta/tag/-", "value": {"code": "reviewed"}}
                ]
            query_params: Optional search parameters to filter resources to patch

        Returns:
            Operation result dict with count of modified resources

        Example:
            # Mark all observations for a patient as reviewed
            result = await client.bulk_patch("Observation", [
                {"op": "add", "path": "/meta/tag/-", "value": {"code": "reviewed"}}
            ], {"patient": "Patient/123"})

        Educational notes:
        - Added in HAPI FHIR v8.4.0, enhanced in v8.6.0
        - More efficient than individual PATCH calls for mass updates
        - Uses JSON Patch format (RFC 6902)
        - Query params limit which resources are patched
        """
        url = f"{self.base_url}/{resource_type}/$hapi.fhir.bulk-patch"

        # Build request body with patch operations
        request_body = {
            "resourceType": "Parameters",
            "parameter": [
                {
                    "name": "patch",
                    "valueString": str(patch_operations)
                }
            ]
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout * 2) as client:
                response = await client.post(
                    url,
                    json=request_body,
                    params=query_params or {},
                    headers={"Content-Type": "application/fhir+json"}
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"HAPI FHIR bulk patch error for {resource_type}: {e.response.status_code} - {e.response.text}")
            raise Exception(f"FHIR bulk patch failed: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"HAPI FHIR connection error: {e}")
            raise Exception(f"Failed to connect to FHIR server: {str(e)}")

    async def bulk_patch_rewrite_history(
        self,
        resource_type: str,
        patch_operations: List[Dict[str, Any]],
        query_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute bulk PATCH with history rewriting (HAPI FHIR v8.6.0+).

        Similar to bulk_patch but also rewrites historical versions of resources.
        Useful for data corrections that need to apply retroactively.

        Args:
            resource_type: FHIR resource type to patch
            patch_operations: List of JSON Patch operations
            query_params: Optional search parameters to filter resources

        Returns:
            Operation result dict with count of modified resources and versions

        Example:
            # Correct a misspelled name across all historical versions
            result = await client.bulk_patch_rewrite_history("Patient", [
                {"op": "replace", "path": "/name/0/family", "value": "Smith"}
            ], {"identifier": "MRN|12345"})

        Educational notes:
        - Added in HAPI FHIR v8.6.0
        - Use with caution - rewrites audit trail
        - Intended for data correction scenarios
        - More expensive operation than regular bulk_patch
        """
        url = f"{self.base_url}/{resource_type}/$hapi.fhir.bulk-patch"

        # Build request body with rewrite-history flag
        request_body = {
            "resourceType": "Parameters",
            "parameter": [
                {
                    "name": "patch",
                    "valueString": str(patch_operations)
                },
                {
                    "name": "rewrite-history",
                    "valueBoolean": True
                }
            ]
        }

        try:
            # Use longer timeout for history rewriting
            async with httpx.AsyncClient(timeout=self.timeout * 4) as client:
                response = await client.post(
                    url,
                    json=request_body,
                    params=query_params or {},
                    headers={"Content-Type": "application/fhir+json"}
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"HAPI FHIR bulk patch rewrite error for {resource_type}: {e.response.status_code} - {e.response.text}")
            raise Exception(f"FHIR bulk patch rewrite failed: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"HAPI FHIR connection error: {e}")
            raise Exception(f"Failed to connect to FHIR server: {str(e)}")


# Convenience function for dependency injection
def get_hapi_client() -> HAPIFHIRClient:
    """
    Get HAPI FHIR client instance for dependency injection.

    Usage in FastAPI:
        @router.get("/endpoint")
        async def endpoint(client: HAPIFHIRClient = Depends(get_hapi_client)):
            resources = await client.search("Patient", {})
    """
    return HAPIFHIRClient()
