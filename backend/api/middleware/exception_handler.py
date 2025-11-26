"""
Global Exception Handler Middleware for WintEHR

This module provides centralized exception handling for the FastAPI application.
It catches all WintEHRException subclasses and converts them to consistent JSON responses.

Usage:
    from api.middleware import register_exception_handlers

    app = FastAPI()
    register_exception_handlers(app)

Features:
- Consistent JSON error response format
- Proper HTTP status code mapping
- Structured logging with context
- Exception chaining preservation
- Development vs production mode (stack traces)
"""

from __future__ import annotations

import logging
import traceback
import os
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from shared.exceptions import WintEHRException, ErrorCode

logger = logging.getLogger(__name__)

# Check if we're in development mode
IS_DEVELOPMENT = os.getenv("ENVIRONMENT", "development").lower() == "development"


def create_error_response(
    error_code: str,
    message: str,
    status_code: int,
    details: dict[str, Any] | None = None,
    request_id: str | None = None,
    stack_trace: str | None = None
) -> dict[str, Any]:
    """
    Create a standardized error response dictionary.

    Args:
        error_code: Categorized error code (e.g., "FHIR_RESOURCE_NOT_FOUND")
        message: Human-readable error message
        status_code: HTTP status code
        details: Additional context as key-value pairs
        request_id: Optional request identifier for tracing
        stack_trace: Optional stack trace (development mode only)

    Returns:
        Standardized error response dictionary
    """
    response = {
        "error": {
            "code": error_code,
            "message": message,
            "status": status_code,
        }
    }

    if details:
        response["error"]["details"] = details

    if request_id:
        response["error"]["request_id"] = request_id

    # Only include stack trace in development mode
    if stack_trace and IS_DEVELOPMENT:
        response["error"]["stack_trace"] = stack_trace

    return response


async def wintehr_exception_handler(
    request: Request,
    exc: WintEHRException
) -> JSONResponse:
    """
    Handle WintEHRException and its subclasses.

    Converts structured exceptions to JSON responses with proper status codes
    and logs the error with full context.

    Args:
        request: The FastAPI request object
        exc: The WintEHRException instance

    Returns:
        JSONResponse with standardized error format
    """
    # Extract request context for logging
    request_id = request.headers.get("X-Request-ID", "unknown")
    client_ip = request.client.host if request.client else "unknown"

    # Log the exception with context
    log_context = {
        "error_code": exc.error_code.value,
        "status_code": exc.status_code,
        "request_id": request_id,
        "client_ip": client_ip,
        "path": request.url.path,
        "method": request.method,
        "details": exc.details,
    }

    # Log at appropriate level based on status code
    if exc.status_code >= 500:
        logger.error(
            f"Server error: {exc.message}",
            extra=log_context,
            exc_info=exc.cause if exc.cause else exc
        )
    elif exc.status_code >= 400:
        logger.warning(
            f"Client error: {exc.message}",
            extra=log_context
        )
    else:
        logger.info(
            f"Handled exception: {exc.message}",
            extra=log_context
        )

    # Get stack trace for development mode
    stack_trace = None
    if IS_DEVELOPMENT and exc.cause:
        stack_trace = "".join(traceback.format_exception(
            type(exc.cause), exc.cause, exc.cause.__traceback__
        ))

    # Create response
    response_body = create_error_response(
        error_code=exc.error_code.value,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
        request_id=request_id,
        stack_trace=stack_trace
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=response_body
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
) -> JSONResponse:
    """
    Handle Pydantic validation errors from FastAPI.

    Converts validation errors to a standardized format consistent
    with WintEHRException responses.

    Args:
        request: The FastAPI request object
        exc: The RequestValidationError instance

    Returns:
        JSONResponse with validation error details
    """
    request_id = request.headers.get("X-Request-ID", "unknown")

    # Extract validation error details
    validation_errors = []
    for error in exc.errors():
        field_path = ".".join(str(loc) for loc in error["loc"])
        validation_errors.append({
            "field": field_path,
            "message": error["msg"],
            "type": error["type"]
        })

    logger.warning(
        f"Validation error on {request.method} {request.url.path}",
        extra={
            "request_id": request_id,
            "validation_errors": validation_errors,
            "path": request.url.path,
            "method": request.method,
        }
    )

    response_body = create_error_response(
        error_code=ErrorCode.VALIDATION_ERROR.value,
        message="Request validation failed",
        status_code=422,
        details={"validation_errors": validation_errors},
        request_id=request_id
    )

    return JSONResponse(
        status_code=422,
        content=response_body
    )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException
) -> JSONResponse:
    """
    Handle standard HTTP exceptions from Starlette/FastAPI.

    Converts HTTPException to standardized format for consistency.

    Args:
        request: The FastAPI request object
        exc: The HTTPException instance

    Returns:
        JSONResponse with standardized error format
    """
    request_id = request.headers.get("X-Request-ID", "unknown")

    # Map status codes to error codes
    error_code_map = {
        400: ErrorCode.VALIDATION_ERROR,
        401: ErrorCode.EXTERNAL_SERVICE_AUTH_ERROR,
        403: ErrorCode.EXTERNAL_SERVICE_AUTH_ERROR,
        404: ErrorCode.FHIR_RESOURCE_NOT_FOUND,
        422: ErrorCode.VALIDATION_ERROR,
        500: ErrorCode.INTERNAL_ERROR,
        502: ErrorCode.EXTERNAL_SERVICE_ERROR,
        503: ErrorCode.DATABASE_CONNECTION_ERROR,
        504: ErrorCode.EXTERNAL_SERVICE_TIMEOUT,
    }

    error_code = error_code_map.get(exc.status_code, ErrorCode.INTERNAL_ERROR)

    if exc.status_code >= 500:
        logger.error(
            f"HTTP {exc.status_code}: {exc.detail}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
            }
        )

    response_body = create_error_response(
        error_code=error_code.value,
        message=str(exc.detail) if exc.detail else f"HTTP {exc.status_code} Error",
        status_code=exc.status_code,
        request_id=request_id
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=response_body
    )


async def generic_exception_handler(
    request: Request,
    exc: Exception
) -> JSONResponse:
    """
    Handle any unhandled exceptions as a fallback.

    This catches all exceptions not handled by more specific handlers
    and returns a generic 500 error. Full details are logged but not
    exposed to clients (except in development mode).

    Args:
        request: The FastAPI request object
        exc: The unhandled Exception instance

    Returns:
        JSONResponse with generic error (500)
    """
    request_id = request.headers.get("X-Request-ID", "unknown")

    # Log full exception details
    logger.exception(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "exception_type": type(exc).__name__,
        }
    )

    # Get stack trace for development mode
    stack_trace = None
    if IS_DEVELOPMENT:
        stack_trace = traceback.format_exc()

    # Create sanitized response (don't expose internal details in production)
    message = str(exc) if IS_DEVELOPMENT else "An internal server error occurred"

    response_body = create_error_response(
        error_code=ErrorCode.INTERNAL_ERROR.value,
        message=message,
        status_code=500,
        details={"exception_type": type(exc).__name__} if IS_DEVELOPMENT else None,
        request_id=request_id,
        stack_trace=stack_trace
    )

    return JSONResponse(
        status_code=500,
        content=response_body
    )


def register_exception_handlers(app: FastAPI) -> None:
    """
    Register all exception handlers with the FastAPI application.

    This function should be called during application startup to ensure
    all exceptions are handled consistently.

    Args:
        app: The FastAPI application instance

    Example:
        app = FastAPI()
        register_exception_handlers(app)
    """
    # Register handler for WintEHR custom exceptions
    app.add_exception_handler(WintEHRException, wintehr_exception_handler)

    # Register handler for Pydantic validation errors
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    # Register handler for standard HTTP exceptions
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    # Register fallback handler for any unhandled exceptions
    app.add_exception_handler(Exception, generic_exception_handler)

    logger.info("Exception handlers registered successfully")


# =============================================================================
# Utility Functions for Exception Handling
# =============================================================================

def wrap_external_error(
    exc: Exception,
    service_name: str,
    operation: str
) -> WintEHRException:
    """
    Wrap an external exception in a WintEHRException with context.

    Useful for wrapping third-party library exceptions (httpx, asyncpg, etc.)
    with proper context and categorization.

    Args:
        exc: The original exception
        service_name: Name of the external service (e.g., "HAPI FHIR", "Redis")
        operation: Description of the operation being performed

    Returns:
        Appropriate WintEHRException subclass

    Example:
        try:
            result = await httpx_client.get(url)
        except httpx.TimeoutException as e:
            raise wrap_external_error(e, "HAPI FHIR", "fetch patient")
    """
    from shared.exceptions import (
        ExternalServiceConnectionError,
        ExternalServiceTimeoutError,
        FHIRConnectionError,
    )

    # Import here to avoid circular imports
    import httpx

    error_message = f"Error during {operation} with {service_name}: {str(exc)}"

    # Handle httpx-specific exceptions
    if isinstance(exc, httpx.TimeoutException):
        return ExternalServiceTimeoutError(
            message=f"Timeout during {operation}",
            service_name=service_name,
            cause=exc
        )
    elif isinstance(exc, httpx.ConnectError):
        # Check if it's a FHIR server
        if "fhir" in service_name.lower() or "hapi" in service_name.lower():
            return FHIRConnectionError(
                message=f"Failed to connect to FHIR server during {operation}",
                cause=exc
            )
        return ExternalServiceConnectionError(
            message=f"Failed to connect to {service_name}",
            service_name=service_name,
            cause=exc
        )
    elif isinstance(exc, httpx.HTTPStatusError):
        return ExternalServiceConnectionError(
            message=f"HTTP error from {service_name}: {exc.response.status_code}",
            service_name=service_name,
            details={"status_code": exc.response.status_code},
            cause=exc
        )

    # Generic fallback
    return ExternalServiceConnectionError(
        message=error_message,
        service_name=service_name,
        cause=exc
    )
