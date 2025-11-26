"""
WintEHR Shared Utilities

This module provides shared utilities used across the WintEHR backend:
- Exception hierarchy for standardized error handling
- Async I/O utilities for non-blocking file operations
- Logging configuration for structured logging

Usage:
    from shared.exceptions import FHIRResourceNotFoundError, CDSExecutionError
    from shared.async_io import read_json_file, write_json_file
    from shared.logging_config import setup_logging, get_logger
"""

# Exception hierarchy
from .exceptions import (
    # Base classes
    WintEHRException,
    ErrorCode,

    # FHIR exceptions
    FHIRException,
    FHIRResourceNotFoundError,
    FHIRValidationError,
    FHIRConnectionError,
    FHIRSearchError,
    FHIROperationError,

    # CDS exceptions
    CDSException,
    CDSExecutionError,
    CDSPrefetchError,
    CDSServiceNotFoundError,
    CDSConfigurationError,

    # Database exceptions
    DatabaseException,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseIntegrityError,

    # External service exceptions
    ExternalServiceException,
    ExternalServiceConnectionError,
    ExternalServiceTimeoutError,
    ExternalServiceAuthError,

    # Validation exceptions
    ValidationException,
    InputValidationError,
    ConfigurationError,
    SchemaValidationError,
)

# Async I/O utilities
from .async_io import (
    # JSON operations
    read_json_file,
    write_json_file,

    # Text operations
    read_text_file,
    write_text_file,

    # Binary operations
    read_binary_file,
    write_binary_file,

    # File system utilities
    file_exists,
    ensure_directory,
    get_file_size,

    # Cache management
    FileCache,
    get_file_cache,
    clear_file_cache,
    get_cache_stats,

    # Sync fallback (startup only)
    read_json_file_sync,
)

# Logging configuration
from .logging_config import (
    # Core configuration
    setup_logging,
    get_logger,

    # Context management
    set_request_context,
    clear_request_context,
    LogContext,

    # Decorators
    log_execution_time,

    # Specialized loggers
    AuditLogger,
    PerformanceLogger,

    # Context variables (for middleware)
    request_id_var,
    user_id_var,
    correlation_id_var,
)

__all__ = [
    # Exception hierarchy
    "WintEHRException",
    "ErrorCode",
    "FHIRException",
    "FHIRResourceNotFoundError",
    "FHIRValidationError",
    "FHIRConnectionError",
    "FHIRSearchError",
    "FHIROperationError",
    "CDSException",
    "CDSExecutionError",
    "CDSPrefetchError",
    "CDSServiceNotFoundError",
    "CDSConfigurationError",
    "DatabaseException",
    "DatabaseConnectionError",
    "DatabaseQueryError",
    "DatabaseIntegrityError",
    "ExternalServiceException",
    "ExternalServiceConnectionError",
    "ExternalServiceTimeoutError",
    "ExternalServiceAuthError",
    "ValidationException",
    "InputValidationError",
    "ConfigurationError",
    "SchemaValidationError",

    # Async I/O
    "read_json_file",
    "write_json_file",
    "read_text_file",
    "write_text_file",
    "read_binary_file",
    "write_binary_file",
    "file_exists",
    "ensure_directory",
    "get_file_size",
    "FileCache",
    "get_file_cache",
    "clear_file_cache",
    "get_cache_stats",
    "read_json_file_sync",

    # Logging
    "setup_logging",
    "get_logger",
    "set_request_context",
    "clear_request_context",
    "LogContext",
    "log_execution_time",
    "AuditLogger",
    "PerformanceLogger",
    "request_id_var",
    "user_id_var",
    "correlation_id_var",
]
