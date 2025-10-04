"""
FHIR R4 API Router - HAPI FHIR Proxy

Proxies all FHIR requests to HAPI FHIR server while maintaining
WintEHR's middleware layer (authentication, logging, etc.)
"""

from fastapi import APIRouter, Request, Response, Depends
from fastapi.responses import JSONResponse, Response as FastAPIResponse
from typing import Optional
import os
import httpx
import logging
import json
from datetime import datetime

# Import notification service for real-time updates
from api.websocket.fhir_notifications import notification_service

logger = logging.getLogger(__name__)

# HAPI FHIR server configuration
HAPI_FHIR_BASE_URL = os.getenv('HAPI_FHIR_URL', 'http://hapi-fhir:8080/fhir')

# Create main FHIR router with /fhir/R4 prefix
fhir_router = APIRouter(prefix="/fhir/R4", tags=["FHIR"])

# Map resource types to clinical event types for WebSocket notifications
RESOURCE_EVENT_MAP = {
    "Condition": {
        "created": "CONDITION_DIAGNOSED",
        "updated": "CONDITION_UPDATED",
        "deleted": "CONDITION_RESOLVED"
    },
    "MedicationRequest": {
        "created": "MEDICATION_PRESCRIBED",
        "updated": "MEDICATION_UPDATED",
        "deleted": "MEDICATION_DISCONTINUED"
    },
    "Observation": {
        "created": "OBSERVATION_RECORDED",
        "updated": "OBSERVATION_UPDATED"
    },
    "ServiceRequest": {
        "created": "ORDER_PLACED",
        "updated": "ORDER_UPDATED",
        "deleted": "ORDER_CANCELLED"
    },
    "DiagnosticReport": {
        "created": "RESULT_RECEIVED",
        "updated": "RESULT_UPDATED"
    },
    "Encounter": {
        "created": "ENCOUNTER_CREATED",
        "updated": "ENCOUNTER_UPDATED",
        "deleted": "ENCOUNTER_DELETED"
    }
}


async def send_websocket_notification(resource_type: str, operation: str, resource: dict):
    """Send WebSocket notification for FHIR resource changes"""
    try:
        event_map = RESOURCE_EVENT_MAP.get(resource_type)
        if not event_map:
            return

        event_type = event_map.get(operation)
        if not event_type:
            return

        # Extract patient ID for targeted notifications
        patient_id = None
        if "subject" in resource and resource["subject"].get("reference"):
            ref = resource["subject"]["reference"]
            if ref.startswith("Patient/"):
                patient_id = ref.split("/")[1]
        elif "patient" in resource and resource["patient"].get("reference"):
            ref = resource["patient"]["reference"]
            if ref.startswith("Patient/"):
                patient_id = ref.split("/")[1]

        # Send notification
        await notification_service.notify_resource_change(
            resource_type=resource_type,
            resource_id=resource.get("id"),
            patient_id=patient_id,
            event_type=event_type,
            resource_data=resource
        )
    except Exception as e:
        logger.error(f"Failed to send WebSocket notification: {e}")


async def proxy_to_hapi_fhir(
    request: Request,
    path: str = "",
    method: str = "GET",
    body: Optional[bytes] = None
) -> Response:
    """Proxy requests to HAPI FHIR server"""

    # Build HAPI FHIR URL
    url = f"{HAPI_FHIR_BASE_URL}/{path}"

    # Get query parameters
    query_params = dict(request.query_params)

    # Prepare headers
    headers = {
        "Content-Type": "application/fhir+json",
        "Accept": "application/fhir+json"
    }

    # Copy authorization header if present
    if "authorization" in request.headers:
        headers["Authorization"] = request.headers["authorization"]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Make request to HAPI FHIR
            if method == "GET":
                response = await client.get(url, params=query_params, headers=headers)
            elif method == "POST":
                response = await client.post(url, params=query_params, content=body, headers=headers)
            elif method == "PUT":
                response = await client.put(url, params=query_params, content=body, headers=headers)
            elif method == "DELETE":
                response = await client.delete(url, params=query_params, headers=headers)
            elif method == "PATCH":
                response = await client.patch(url, params=query_params, content=body, headers=headers)
            else:
                return JSONResponse(
                    status_code=405,
                    content={"error": f"Method {method} not supported"}
                )

            # Parse response for WebSocket notifications
            if response.status_code in (200, 201) and method in ("POST", "PUT", "PATCH", "DELETE"):
                try:
                    resource_data = response.json()
                    resource_type = resource_data.get("resourceType")

                    if resource_type:
                        operation_map = {
                            "POST": "created",
                            "PUT": "updated",
                            "PATCH": "updated",
                            "DELETE": "deleted"
                        }
                        operation = operation_map.get(method, "updated")

                        # Send WebSocket notification
                        await send_websocket_notification(resource_type, operation, resource_data)
                except Exception as e:
                    logger.error(f"Failed to parse response for notifications: {e}")

            # Return HAPI FHIR response
            # Remove compression headers since httpx automatically decompresses
            response_headers = dict(response.headers)
            response_headers.pop('content-encoding', None)
            response_headers.pop('content-length', None)  # May be incorrect after decompression

            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=response_headers,
                media_type="application/fhir+json"
            )

    except httpx.ConnectError:
        logger.error(f"Failed to connect to HAPI FHIR server at {HAPI_FHIR_BASE_URL}")
        return JSONResponse(
            status_code=503,
            content={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "exception",
                    "diagnostics": "FHIR server unavailable"
                }]
            }
        )
    except httpx.TimeoutException:
        logger.error(f"Timeout connecting to HAPI FHIR server")
        return JSONResponse(
            status_code=504,
            content={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "timeout",
                    "diagnostics": "FHIR server timeout"
                }]
            }
        )
    except Exception as e:
        logger.error(f"Error proxying to HAPI FHIR: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "exception",
                    "diagnostics": str(e)
                }]
            }
        )


# === FHIR METADATA ENDPOINT ===
@fhir_router.get("/metadata")
async def get_capability_statement(request: Request):
    """Get FHIR capability statement from HAPI FHIR"""
    return await proxy_to_hapi_fhir(request, "metadata", "GET")


# === RESOURCE TYPE OPERATIONS ===

@fhir_router.get("/{resource_type}")
async def search_resources(resource_type: str, request: Request):
    """Search FHIR resources"""
    return await proxy_to_hapi_fhir(request, resource_type, "GET")


@fhir_router.post("/{resource_type}")
async def create_resource(resource_type: str, request: Request):
    """Create FHIR resource"""
    body = await request.body()
    return await proxy_to_hapi_fhir(request, resource_type, "POST", body)


@fhir_router.get("/{resource_type}/{resource_id}")
async def read_resource(resource_type: str, resource_id: str, request: Request):
    """Read FHIR resource"""
    path = f"{resource_type}/{resource_id}"
    return await proxy_to_hapi_fhir(request, path, "GET")


@fhir_router.put("/{resource_type}/{resource_id}")
async def update_resource(resource_type: str, resource_id: str, request: Request):
    """Update FHIR resource"""
    path = f"{resource_type}/{resource_id}"
    body = await request.body()
    return await proxy_to_hapi_fhir(request, path, "PUT", body)


@fhir_router.delete("/{resource_type}/{resource_id}")
async def delete_resource(resource_type: str, resource_id: str, request: Request):
    """Delete FHIR resource"""
    path = f"{resource_type}/{resource_id}"
    return await proxy_to_hapi_fhir(request, path, "DELETE")


@fhir_router.patch("/{resource_type}/{resource_id}")
async def patch_resource(resource_type: str, resource_id: str, request: Request):
    """Patch FHIR resource"""
    path = f"{resource_type}/{resource_id}"
    body = await request.body()
    return await proxy_to_hapi_fhir(request, path, "PATCH", body)


# === HISTORY OPERATIONS ===

@fhir_router.get("/{resource_type}/{resource_id}/_history")
async def get_resource_history(resource_type: str, resource_id: str, request: Request):
    """Get resource history"""
    path = f"{resource_type}/{resource_id}/_history"
    return await proxy_to_hapi_fhir(request, path, "GET")


@fhir_router.get("/{resource_type}/{resource_id}/_history/{version_id}")
async def get_resource_version(resource_type: str, resource_id: str, version_id: str, request: Request):
    """Get specific resource version"""
    path = f"{resource_type}/{resource_id}/_history/{version_id}"
    return await proxy_to_hapi_fhir(request, path, "GET")


# === FHIR OPERATIONS ===

@fhir_router.get("/Patient/{patient_id}/$everything")
async def patient_everything(patient_id: str, request: Request):
    """Patient $everything operation"""
    path = f"Patient/{patient_id}/$everything"
    return await proxy_to_hapi_fhir(request, path, "GET")


@fhir_router.get("/Observation/$lastn")
async def observation_lastn(request: Request):
    """Observation $lastn operation"""
    return await proxy_to_hapi_fhir(request, "Observation/$lastn", "GET")


@fhir_router.post("/Patient/$match")
async def patient_match(request: Request):
    """Patient $match operation"""
    body = await request.body()
    return await proxy_to_hapi_fhir(request, "Patient/$match", "POST", body)


# === BUNDLE OPERATIONS ===

@fhir_router.post("/")
async def process_bundle(request: Request):
    """Process transaction/batch bundle"""
    body = await request.body()
    return await proxy_to_hapi_fhir(request, "", "POST", body)


# === SEARCH OPERATIONS ===

@fhir_router.post("/{resource_type}/_search")
async def search_post(resource_type: str, request: Request):
    """POST-based search"""
    path = f"{resource_type}/_search"
    body = await request.body()
    return await proxy_to_hapi_fhir(request, path, "POST", body)


# === CROSS-RESOURCE SEARCH ===

@fhir_router.get("/")
async def search_all_resources(request: Request):
    """Search across all resource types"""
    return await proxy_to_hapi_fhir(request, "", "GET")


# === NOTIFICATION ENDPOINTS (Keep for frontend compatibility) ===

@fhir_router.get("/notifications/count")
async def get_notifications_count(request: Request):
    """Get notification count - proxied for compatibility"""
    # This could be implemented locally or proxied to a notifications service
    return JSONResponse(content={"count": 0})


@fhir_router.get("/notifications")
async def get_notifications(request: Request):
    """Get notifications - proxied for compatibility"""
    return JSONResponse(content={"notifications": []})


@fhir_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark notification as read"""
    return JSONResponse(content={"success": True})


@fhir_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read"""
    return JSONResponse(content={"success": True})


# === HEALTH CHECK ===

@fhir_router.get("/health")
async def health_check():
    """FHIR proxy health check"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{HAPI_FHIR_BASE_URL}/metadata")
            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "hapi_fhir": "connected",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return JSONResponse(
                    status_code=503,
                    content={
                        "status": "unhealthy",
                        "hapi_fhir": "error",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "hapi_fhir": "unavailable",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
