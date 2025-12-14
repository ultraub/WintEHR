"""
WintEHR Custom Exception Hierarchy

This module provides a comprehensive exception hierarchy for the WintEHR application.
All exceptions inherit from WintEHRException and include:
- Structured error information (message, code, details)
- HTTP status code mapping for FastAPI integration
- Original exception chaining via `cause` parameter
- Structured logging support

Usage:
    from shared.exceptions import FHIRResourceNotFoundError, CDSExecutionError

    try:
        resource = await fhir_client.get("Patient", patient_id)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise FHIRResourceNotFoundError(
                message=f"Patient {patient_id} not found",
                details={"patient_id": patient_id},
                cause=e
            )
"""

from typing import Any, Optional
from enum import Enum


class ErrorCode(str, Enum):
    """Standardized error codes for categorization and client handling."""

    # General errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR"

    # FHIR errors
    FHIR_RESOURCE_NOT_FOUND = "FHIR_RESOURCE_NOT_FOUND"
    FHIR_VALIDATION_ERROR = "FHIR_VALIDATION_ERROR"
    FHIR_CONNECTION_ERROR = "FHIR_CONNECTION_ERROR"
    FHIR_OPERATION_ERROR = "FHIR_OPERATION_ERROR"

    # CDS errors
    CDS_EXECUTION_ERROR = "CDS_EXECUTION_ERROR"
    CDS_PREFETCH_ERROR = "CDS_PREFETCH_ERROR"
    CDS_RULE_ERROR = "CDS_RULE_ERROR"
    CDS_SERVICE_NOT_FOUND = "CDS_SERVICE_NOT_FOUND"

    # Database errors
    DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR"
    DATABASE_QUERY_ERROR = "DATABASE_QUERY_ERROR"
    DATABASE_TRANSACTION_ERROR = "DATABASE_TRANSACTION_ERROR"

    # External service errors
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    EXTERNAL_SERVICE_TIMEOUT = "EXTERNAL_SERVICE_TIMEOUT"
    EXTERNAL_SERVICE_AUTH_ERROR = "EXTERNAL_SERVICE_AUTH_ERROR"


class WintEHRException(Exception):
    """
    Base exception for all WintEHR application errors.

    Provides structured error information including:
    - Human-readable message
    - HTTP status code for API responses
    - Error code for categorization
    - Additional details dict for context
    - Original exception chaining

    Attributes:
        message: Human-readable error description
        status_code: HTTP status code (default 500)
        error_code: Categorized error code from ErrorCode enum
        details: Additional context as key-value pairs
        cause: Original exception that triggered this error
    """

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        self.cause = cause

        # Set the __cause__ for proper exception chaining
        if cause:
            self.__cause__ = cause

        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for JSON serialization."""
        result = {
            "error": self.error_code.value,
            "message": self.message,
            "status_code": self.status_code,
        }
        if self.details:
            result["details"] = self.details
        return result

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"message={self.message!r}, "
            f"status_code={self.status_code}, "
            f"error_code={self.error_code.value})"
        )


# =============================================================================
# FHIR Exceptions
# =============================================================================

class FHIRException(WintEHRException):
    """Base exception for FHIR-related errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: ErrorCode = ErrorCode.FHIR_OPERATION_ERROR,
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None
    ):
        if resource_type:
            details = details or {}
            details["resource_type"] = resource_type
        if resource_id:
            details = details or {}
            details["resource_id"] = resource_id

        super().__init__(
            message=message,
            status_code=status_code,
            error_code=error_code,
            details=details,
            cause=cause
        )
        self.resource_type = resource_type
        self.resource_id = resource_id


class FHIRResourceNotFoundError(FHIRException):
    """Raised when a FHIR resource cannot be found."""

    def __init__(
        self,
        message: str = "FHIR resource not found",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=404,
            error_code=ErrorCode.FHIR_RESOURCE_NOT_FOUND,
            details=details,
            cause=cause,
            resource_type=resource_type,
            resource_id=resource_id
        )


class FHIRValidationError(FHIRException):
    """Raised when FHIR resource validation fails."""

    def __init__(
        self,
        message: str = "FHIR resource validation failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        resource_type: Optional[str] = None,
        validation_errors: Optional[list[str]] = None
    ):
        if validation_errors:
            details = details or {}
            details["validation_errors"] = validation_errors

        super().__init__(
            message=message,
            status_code=422,
            error_code=ErrorCode.FHIR_VALIDATION_ERROR,
            details=details,
            cause=cause,
            resource_type=resource_type
        )


class FHIRConnectionError(FHIRException):
    """Raised when connection to FHIR server fails."""

    def __init__(
        self,
        message: str = "Failed to connect to FHIR server",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        server_url: Optional[str] = None
    ):
        if server_url:
            details = details or {}
            details["server_url"] = server_url

        super().__init__(
            message=message,
            status_code=503,
            error_code=ErrorCode.FHIR_CONNECTION_ERROR,
            details=details,
            cause=cause
        )


class FHIRSearchError(FHIRException):
    """Raised when a FHIR search operation fails."""

    def __init__(
        self,
        message: str = "FHIR search failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        resource_type: Optional[str] = None,
        search_params: Optional[dict] = None
    ):
        if search_params:
            details = details or {}
            details["search_params"] = search_params

        super().__init__(
            message=message,
            status_code=400,
            error_code=ErrorCode.FHIR_OPERATION_ERROR,
            details=details,
            cause=cause,
            resource_type=resource_type
        )


class FHIROperationError(FHIRException):
    """Raised when a FHIR operation fails."""

    def __init__(
        self,
        message: str = "FHIR operation failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        resource_type: Optional[str] = None,
        operation: Optional[str] = None
    ):
        if operation:
            details = details or {}
            details["operation"] = operation

        super().__init__(
            message=message,
            status_code=500,
            error_code=ErrorCode.FHIR_OPERATION_ERROR,
            details=details,
            cause=cause,
            resource_type=resource_type
        )


# =============================================================================
# CDS (Clinical Decision Support) Exceptions
# =============================================================================

class CDSException(WintEHRException):
    """Base exception for CDS-related errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: ErrorCode = ErrorCode.CDS_EXECUTION_ERROR,
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_id: Optional[str] = None,
        hook_type: Optional[str] = None
    ):
        if service_id:
            details = details or {}
            details["service_id"] = service_id
        if hook_type:
            details = details or {}
            details["hook_type"] = hook_type

        super().__init__(
            message=message,
            status_code=status_code,
            error_code=error_code,
            details=details,
            cause=cause
        )
        self.service_id = service_id
        self.hook_type = hook_type


class CDSExecutionError(CDSException):
    """Raised when CDS service execution fails."""

    def __init__(
        self,
        message: str = "CDS service execution failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_id: Optional[str] = None,
        hook_type: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=500,
            error_code=ErrorCode.CDS_EXECUTION_ERROR,
            details=details,
            cause=cause,
            service_id=service_id,
            hook_type=hook_type
        )


class CDSPrefetchError(CDSException):
    """Raised when CDS prefetch data retrieval fails."""

    def __init__(
        self,
        message: str = "Failed to retrieve CDS prefetch data",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_id: Optional[str] = None,
        prefetch_key: Optional[str] = None
    ):
        if prefetch_key:
            details = details or {}
            details["prefetch_key"] = prefetch_key

        super().__init__(
            message=message,
            status_code=500,
            error_code=ErrorCode.CDS_PREFETCH_ERROR,
            details=details,
            cause=cause,
            service_id=service_id
        )


class CDSRuleEvaluationError(CDSException):
    """Raised when CDS rule evaluation fails."""

    def __init__(
        self,
        message: str = "CDS rule evaluation failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_id: Optional[str] = None,
        rule_name: Optional[str] = None
    ):
        if rule_name:
            details = details or {}
            details["rule_name"] = rule_name

        super().__init__(
            message=message,
            status_code=500,
            error_code=ErrorCode.CDS_RULE_ERROR,
            details=details,
            cause=cause,
            service_id=service_id
        )


class CDSServiceNotFoundError(CDSException):
    """Raised when a CDS service cannot be found."""

    def __init__(
        self,
        message: str = "CDS service not found",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_id: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=404,
            error_code=ErrorCode.CDS_SERVICE_NOT_FOUND,
            details=details,
            cause=cause,
            service_id=service_id
        )


class CDSConfigurationError(CDSException):
    """Raised when CDS service configuration is invalid."""

    def __init__(
        self,
        message: str = "CDS configuration error",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_id: Optional[str] = None,
        config_key: Optional[str] = None
    ):
        if config_key:
            details = details or {}
            details["config_key"] = config_key

        super().__init__(
            message=message,
            status_code=500,
            error_code=ErrorCode.CDS_EXECUTION_ERROR,
            details=details,
            cause=cause,
            service_id=service_id
        )


# =============================================================================
# Database Exceptions
# =============================================================================

class DatabaseException(WintEHRException):
    """Base exception for database-related errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: ErrorCode = ErrorCode.DATABASE_QUERY_ERROR,
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        query: Optional[str] = None
    ):
        # Don't include full query in production for security
        if query:
            details = details or {}
            details["query_hint"] = query[:100] + "..." if len(query) > 100 else query

        super().__init__(
            message=message,
            status_code=status_code,
            error_code=error_code,
            details=details,
            cause=cause
        )


class DatabaseConnectionError(DatabaseException):
    """Raised when database connection fails."""

    def __init__(
        self,
        message: str = "Failed to connect to database",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None
    ):
        super().__init__(
            message=message,
            status_code=503,
            error_code=ErrorCode.DATABASE_CONNECTION_ERROR,
            details=details,
            cause=cause
        )


class DatabaseQueryError(DatabaseException):
    """Raised when a database query fails."""

    def __init__(
        self,
        message: str = "Database query failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        query: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=500,
            error_code=ErrorCode.DATABASE_QUERY_ERROR,
            details=details,
            cause=cause,
            query=query
        )


class DatabaseTransactionError(DatabaseException):
    """Raised when a database transaction fails."""

    def __init__(
        self,
        message: str = "Database transaction failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        operation: Optional[str] = None
    ):
        if operation:
            details = details or {}
            details["operation"] = operation

        super().__init__(
            message=message,
            status_code=500,
            error_code=ErrorCode.DATABASE_TRANSACTION_ERROR,
            details=details,
            cause=cause
        )


class DatabaseIntegrityError(DatabaseException):
    """Raised when database integrity constraint is violated."""

    def __init__(
        self,
        message: str = "Database integrity constraint violated",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        constraint: Optional[str] = None
    ):
        if constraint:
            details = details or {}
            details["constraint"] = constraint

        super().__init__(
            message=message,
            status_code=409,
            error_code=ErrorCode.DATABASE_QUERY_ERROR,
            details=details,
            cause=cause
        )


# =============================================================================
# External Service Exceptions
# =============================================================================

class ExternalServiceException(WintEHRException):
    """Base exception for external service errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 502,
        error_code: ErrorCode = ErrorCode.EXTERNAL_SERVICE_ERROR,
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_name: Optional[str] = None,
        service_url: Optional[str] = None
    ):
        if service_name:
            details = details or {}
            details["service_name"] = service_name
        if service_url:
            details = details or {}
            details["service_url"] = service_url

        super().__init__(
            message=message,
            status_code=status_code,
            error_code=error_code,
            details=details,
            cause=cause
        )
        self.service_name = service_name
        self.service_url = service_url


class ExternalServiceConnectionError(ExternalServiceException):
    """Raised when connection to external service fails."""

    def __init__(
        self,
        message: str = "Failed to connect to external service",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_name: Optional[str] = None,
        service_url: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=502,
            error_code=ErrorCode.EXTERNAL_SERVICE_ERROR,
            details=details,
            cause=cause,
            service_name=service_name,
            service_url=service_url
        )


class ExternalServiceTimeoutError(ExternalServiceException):
    """Raised when external service request times out."""

    def __init__(
        self,
        message: str = "External service request timed out",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_name: Optional[str] = None,
        timeout_seconds: Optional[float] = None
    ):
        if timeout_seconds:
            details = details or {}
            details["timeout_seconds"] = timeout_seconds

        super().__init__(
            message=message,
            status_code=504,
            error_code=ErrorCode.EXTERNAL_SERVICE_TIMEOUT,
            details=details,
            cause=cause,
            service_name=service_name
        )


class ExternalServiceAuthError(ExternalServiceException):
    """Raised when authentication with external service fails."""

    def __init__(
        self,
        message: str = "External service authentication failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        service_name: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=401,
            error_code=ErrorCode.EXTERNAL_SERVICE_AUTH_ERROR,
            details=details,
            cause=cause,
            service_name=service_name
        )


# =============================================================================
# Validation Exceptions
# =============================================================================

class ValidationException(WintEHRException):
    """Base exception for validation errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: ErrorCode = ErrorCode.VALIDATION_ERROR,
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        field: Optional[str] = None,
        value: Optional[Any] = None
    ):
        if field:
            details = details or {}
            details["field"] = field
        if value is not None:
            details = details or {}
            details["invalid_value"] = str(value)[:100]  # Truncate for safety

        super().__init__(
            message=message,
            status_code=status_code,
            error_code=error_code,
            details=details,
            cause=cause
        )


class InputValidationError(ValidationException):
    """Raised when input validation fails."""

    def __init__(
        self,
        message: str = "Input validation failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        field: Optional[str] = None,
        value: Optional[Any] = None,
        expected: Optional[str] = None
    ):
        if expected:
            details = details or {}
            details["expected"] = expected

        super().__init__(
            message=message,
            status_code=400,
            error_code=ErrorCode.VALIDATION_ERROR,
            details=details,
            cause=cause,
            field=field,
            value=value
        )


class ConfigurationError(ValidationException):
    """Raised when configuration is invalid or missing."""

    def __init__(
        self,
        message: str = "Configuration error",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        config_key: Optional[str] = None
    ):
        if config_key:
            details = details or {}
            details["config_key"] = config_key

        super().__init__(
            message=message,
            status_code=500,
            error_code=ErrorCode.CONFIGURATION_ERROR,
            details=details,
            cause=cause
        )


class SchemaValidationError(ValidationException):
    """Raised when data fails schema validation."""

    def __init__(
        self,
        message: str = "Schema validation failed",
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        schema_name: Optional[str] = None,
        validation_errors: Optional[list[str]] = None
    ):
        if schema_name:
            details = details or {}
            details["schema_name"] = schema_name
        if validation_errors:
            details = details or {}
            details["validation_errors"] = validation_errors

        super().__init__(
            message=message,
            status_code=422,
            error_code=ErrorCode.VALIDATION_ERROR,
            details=details,
            cause=cause
        )


# =============================================================================
# Convenience Exports
# =============================================================================

__all__ = [
    # Base
    "WintEHRException",
    "ErrorCode",

    # FHIR
    "FHIRException",
    "FHIRResourceNotFoundError",
    "FHIRValidationError",
    "FHIRConnectionError",
    "FHIRSearchError",
    "FHIROperationError",

    # CDS
    "CDSException",
    "CDSExecutionError",
    "CDSPrefetchError",
    "CDSRuleEvaluationError",
    "CDSServiceNotFoundError",
    "CDSConfigurationError",

    # Database
    "DatabaseException",
    "DatabaseConnectionError",
    "DatabaseQueryError",
    "DatabaseTransactionError",
    "DatabaseIntegrityError",

    # External Services
    "ExternalServiceException",
    "ExternalServiceConnectionError",
    "ExternalServiceTimeoutError",
    "ExternalServiceAuthError",

    # Validation
    "ValidationException",
    "InputValidationError",
    "ConfigurationError",
    "SchemaValidationError",
]
