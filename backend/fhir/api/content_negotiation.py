"""
FHIR Content Negotiation Middleware

Handles Accept and Content-Type header validation for FHIR endpoints.
Returns appropriate HTTP status codes for unsupported media types.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from typing import Set, Optional
import re

# Supported FHIR media types
SUPPORTED_ACCEPT_TYPES: Set[str] = {
    "application/json",
    "application/fhir+json",
    "*/*",  # Accept all
}

SUPPORTED_CONTENT_TYPES: Set[str] = {
    "application/json",
    "application/fhir+json",
}

def parse_media_type(media_type_header: Optional[str]) -> str:
    """
    Parse media type from header, ignoring parameters like charset.
    
    Args:
        media_type_header: The raw media type header value
        
    Returns:
        The media type without parameters
    """
    if not media_type_header:
        return ""
    
    # Split by semicolon to remove parameters
    return media_type_header.split(";")[0].strip().lower()

def parse_accept_header(accept_header: Optional[str]) -> list[str]:
    """
    Parse Accept header and return list of media types in preference order.
    
    Args:
        accept_header: The raw Accept header value
        
    Returns:
        List of media types ordered by preference
    """
    if not accept_header:
        return ["*/*"]
    
    # Parse accept header with quality values
    accept_types = []
    for part in accept_header.split(","):
        parts = part.strip().split(";")
        media_type = parts[0].strip().lower()
        
        # Extract quality value if present
        quality = 1.0
        for param in parts[1:]:
            if param.strip().startswith("q="):
                try:
                    quality = float(param.strip()[2:])
                except ValueError:
                    quality = 1.0
                break
        
        accept_types.append((media_type, quality))
    
    # Sort by quality value (descending)
    accept_types.sort(key=lambda x: x[1], reverse=True)
    
    return [media_type for media_type, _ in accept_types]

def is_accept_supported(accept_header: Optional[str]) -> bool:
    """
    Check if at least one of the Accept header media types is supported.
    
    Args:
        accept_header: The raw Accept header value
        
    Returns:
        True if at least one media type is supported, False otherwise
    """
    accept_types = parse_accept_header(accept_header)
    
    for media_type in accept_types:
        if media_type in SUPPORTED_ACCEPT_TYPES:
            return True
        # Check for wildcard patterns
        if "/" in media_type:
            type_part, subtype_part = media_type.split("/", 1)
            if subtype_part == "*" and type_part == "application":
                return True
    
    return False

def validate_content_type(content_type_header: Optional[str], method: str) -> None:
    """
    Validate Content-Type header for requests with body.
    
    Args:
        content_type_header: The raw Content-Type header value
        method: HTTP method
        
    Raises:
        HTTPException: 415 if Content-Type is unsupported
    """
    # Only validate Content-Type for methods that have a body
    if method not in ["POST", "PUT", "PATCH"]:
        return
    
    # If no Content-Type is provided for methods that require a body, that's an error
    if not content_type_header:
        raise HTTPException(
            status_code=415,
            detail={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "not-supported",
                    "details": {
                        "text": "Content-Type header is required for requests with a body"
                    }
                }]
            }
        )
    
    content_type = parse_media_type(content_type_header)
    
    if content_type not in SUPPORTED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "not-supported",
                    "details": {
                        "text": f"Unsupported Content-Type: {content_type}. Supported types are: {', '.join(SUPPORTED_CONTENT_TYPES)}"
                    }
                }]
            }
        )

def validate_accept_header(accept_header: Optional[str]) -> None:
    """
    Validate Accept header.
    
    Args:
        accept_header: The raw Accept header value
        
    Raises:
        HTTPException: 406 if none of the Accept types are supported
    """
    if not is_accept_supported(accept_header):
        accept_types = parse_accept_header(accept_header)
        raise HTTPException(
            status_code=406,
            detail={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "not-acceptable",
                    "details": {
                        "text": f"None of the requested media types are supported: {', '.join(accept_types)}. Supported types are: {', '.join(SUPPORTED_ACCEPT_TYPES)}"
                    }
                }]
            }
        )

async def content_negotiation_middleware(request: Request, call_next):
    """
    Middleware to handle FHIR content negotiation.
    
    This middleware checks:
    1. Accept header - returns 406 if unsupported
    2. Content-Type header - returns 415 if unsupported (for requests with body)
    """
    # Only apply to FHIR endpoints
    if not request.url.path.startswith("/fhir/R4"):
        return await call_next(request)
    
    # Skip middleware for metadata endpoint (capability statement)
    if request.url.path == "/fhir/R4/metadata":
        return await call_next(request)
    
    try:
        # Validate Accept header
        accept_header = request.headers.get("accept")
        validate_accept_header(accept_header)
        
        # Validate Content-Type header
        content_type_header = request.headers.get("content-type")
        validate_content_type(content_type_header, request.method)
        
    except HTTPException as e:
        # Return FHIR OperationOutcome for content negotiation errors
        return JSONResponse(
            status_code=e.status_code,
            content=e.detail,
            headers={"Content-Type": "application/fhir+json"}
        )
    
    # Process the request
    response = await call_next(request)
    
    # Add Content-Type header to response if not present
    if "content-type" not in response.headers:
        response.headers["content-type"] = "application/fhir+json"
    
    return response