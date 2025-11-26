"""
HAPI FHIR Proxy Router

Proxies FHIR R4 requests from the backend to the HAPI FHIR JPA Server.
This allows the frontend to continue using the same /fhir/R4 endpoints
while the actual FHIR operations are handled by HAPI FHIR.

All error responses are returned as FHIR OperationOutcome resources
for R4 compliance.
"""

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
import httpx
import logging
import os
import json
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

router = APIRouter()


def create_operation_outcome(
    severity: str,
    code: str,
    diagnostics: str,
    details_text: Optional[str] = None,
    expression: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Create a FHIR R4 OperationOutcome resource for error responses.

    Args:
        severity: One of 'fatal', 'error', 'warning', 'information'
        code: Issue type code from http://hl7.org/fhir/issue-type
        diagnostics: Additional diagnostic information (human-readable)
        details_text: Optional detailed text description
        expression: Optional FHIRPath expressions to locate issue

    Returns:
        FHIR OperationOutcome resource as dict

    Educational notes:
    - OperationOutcome is the standard FHIR response for errors
    - severity indicates how serious the issue is
    - code is from a fixed value set (exception, not-found, timeout, etc.)
    - diagnostics provides human-readable debugging info
    """
    issue = {
        "severity": severity,
        "code": code,
        "diagnostics": diagnostics
    }

    if details_text:
        issue["details"] = {"text": details_text}

    if expression:
        issue["expression"] = expression

    return {
        "resourceType": "OperationOutcome",
        "issue": [issue]
    }


def create_error_response(
    status_code: int,
    severity: str,
    code: str,
    diagnostics: str,
    details_text: Optional[str] = None
) -> Response:
    """
    Create a FHIR-compliant error response with OperationOutcome.

    Args:
        status_code: HTTP status code
        severity: OperationOutcome severity
        code: OperationOutcome issue code
        diagnostics: Human-readable diagnostic message
        details_text: Optional additional details

    Returns:
        FastAPI Response with OperationOutcome JSON
    """
    outcome = create_operation_outcome(
        severity=severity,
        code=code,
        diagnostics=diagnostics,
        details_text=details_text
    )

    return Response(
        content=json.dumps(outcome),
        status_code=status_code,
        media_type="application/fhir+json"
    )

# HAPI FHIR base URL - use Docker service name in containers, localhost for development
# Note: HAPI_FHIR_URL may include /fhir suffix - strip it to avoid double path
_raw_hapi_url = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")
HAPI_FHIR_BASE_URL = _raw_hapi_url.rstrip("/fhir").rstrip("/")


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

    except httpx.TimeoutException as e:
        logger.error(f"Timeout proxying request to HAPI FHIR: {e}")
        return create_error_response(
            status_code=504,
            severity="error",
            code="timeout",
            diagnostics="Request to FHIR server timed out",
            details_text=str(e)
        )
    except httpx.ConnectError as e:
        logger.error(f"Connection error to HAPI FHIR: {e}")
        return create_error_response(
            status_code=503,
            severity="fatal",
            code="transient",
            diagnostics="Unable to connect to FHIR server",
            details_text=str(e)
        )
    except httpx.RequestError as e:
        logger.error(f"Error proxying request to HAPI FHIR: {e}")
        return create_error_response(
            status_code=503,
            severity="error",
            code="transient",
            diagnostics="Failed to communicate with FHIR server",
            details_text=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error in HAPI FHIR proxy: {e}")
        return create_error_response(
            status_code=500,
            severity="fatal",
            code="exception",
            diagnostics="Internal server error occurred",
            details_text=str(e)
        )


@router.get("/fhir/metadata")
async def proxy_fhir_metadata(request: Request):
    """Proxy FHIR metadata/CapabilityStatement request"""
    return await proxy_to_hapi_fhir("metadata", request)
