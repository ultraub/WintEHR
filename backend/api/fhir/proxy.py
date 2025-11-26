"""
HAPI FHIR Proxy Router

Proxies FHIR R4 requests from the backend to the HAPI FHIR JPA Server.
This allows the frontend to continue using the same /fhir/R4 endpoints
while the actual FHIR operations are handled by HAPI FHIR.
"""

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
import httpx
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter()

# HAPI FHIR base URL - use Docker service name in containers, localhost for development
HAPI_FHIR_BASE_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080")


@router.api_route("/fhir/R4/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_hapi_fhir(path: str, request: Request):
    """
    Proxy all FHIR R4 requests to HAPI FHIR JPA Server.

    This maintains backward compatibility with the frontend while using
    the industry-standard HAPI FHIR server for FHIR operations.
    """
    # Build HAPI FHIR URL
    hapi_url = f"{HAPI_FHIR_BASE_URL}/fhir/{path}"

    # Add query parameters
    if request.url.query:
        hapi_url = f"{hapi_url}?{request.url.query}"

    # Get request body if present
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        body = await request.body()

    # Forward headers (exclude host header)
    headers = dict(request.headers)
    headers.pop("host", None)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Forward request to HAPI FHIR
            response = await client.request(
                method=request.method,
                url=hapi_url,
                headers=headers,
                content=body
            )

            # Prepare response headers (exclude compression headers - httpx handles decompression)
            response_headers = dict(response.headers)
            # Remove content-encoding headers since httpx already decompressed the response
            response_headers.pop("content-encoding", None)
            response_headers.pop("content-length", None)  # Length may be wrong after decompression

            # Return HAPI FHIR response
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get("content-type", "application/json")
            )

    except httpx.RequestError as e:
        logger.error(f"Error proxying request to HAPI FHIR: {e}")
        return Response(
            content=f'{{"error": "Failed to connect to FHIR server", "detail": "{str(e)}"}}',
            status_code=503,
            media_type="application/json"
        )
    except Exception as e:
        logger.error(f"Unexpected error in HAPI FHIR proxy: {e}")
        return Response(
            content=f'{{"error": "Internal server error", "detail": "{str(e)}"}}',
            status_code=500,
            media_type="application/json"
        )


@router.get("/fhir/metadata")
async def proxy_fhir_metadata(request: Request):
    """Proxy FHIR metadata/CapabilityStatement request"""
    return await proxy_to_hapi_fhir("metadata", request)
