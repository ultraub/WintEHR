"""
Structured Logging Configuration for WintEHR

This module provides centralized logging configuration with:
- Structured JSON logging for production
- Human-readable console output for development
- Request context tracking (request_id, user_id)
- Performance timing logs
- Appropriate log levels per environment

Usage:
    from shared.logging_config import setup_logging, get_logger

    # At application startup
    setup_logging()

    # In modules
    logger = get_logger(__name__)
    logger.info("Operation completed", extra={"patient_id": "123", "operation": "create"})
"""

import logging
import logging.handlers
import sys
import os
import json
from datetime import datetime
from typing import Any, Optional
from contextvars import ContextVar
from functools import wraps
import time

# =============================================================================
# Context Variables for Request Tracking
# =============================================================================

# These allow passing request context to all log messages
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar('user_id', default=None)
correlation_id_var: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)


def set_request_context(
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    correlation_id: Optional[str] = None
) -> None:
    """Set request context for logging."""
    if request_id:
        request_id_var.set(request_id)
    if user_id:
        user_id_var.set(user_id)
    if correlation_id:
        correlation_id_var.set(correlation_id)


def clear_request_context() -> None:
    """Clear request context after request completes."""
    request_id_var.set(None)
    user_id_var.set(None)
    correlation_id_var.set(None)


# =============================================================================
# Custom Formatters
# =============================================================================

class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging in production.

    Produces machine-readable logs suitable for log aggregation systems
    like ELK, Splunk, or CloudWatch.
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add request context if available
        request_id = request_id_var.get()
        if request_id:
            log_data["request_id"] = request_id

        user_id = user_id_var.get()
        if user_id:
            log_data["user_id"] = user_id

        correlation_id = correlation_id_var.get()
        if correlation_id:
            log_data["correlation_id"] = correlation_id

        # Add extra fields from record
        if hasattr(record, '__dict__'):
            for key, value in record.__dict__.items():
                if key not in (
                    'name', 'msg', 'args', 'created', 'filename', 'funcName',
                    'levelname', 'levelno', 'lineno', 'module', 'msecs',
                    'pathname', 'process', 'processName', 'relativeCreated',
                    'stack_info', 'exc_info', 'exc_text', 'thread', 'threadName',
                    'message', 'taskName'
                ):
                    # Serialize the value if it's not JSON-serializable
                    try:
                        json.dumps(value)
                        log_data[key] = value
                    except (TypeError, ValueError):
                        log_data[key] = str(value)

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, default=str)


class ColoredConsoleFormatter(logging.Formatter):
    """
    Colored formatter for development console output.

    Makes logs easy to read during development with color-coded levels.
    """

    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
    }
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

    def format(self, record: logging.LogRecord) -> str:
        """Format log record with colors."""
        # Get color for level
        color = self.COLORS.get(record.levelname, '')

        # Format timestamp
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S.%f')[:-3]

        # Build the log message
        parts = [
            f"{self.DIM}{timestamp}{self.RESET}",
            f"{color}{self.BOLD}{record.levelname:8}{self.RESET}",
            f"{self.DIM}{record.name}{self.RESET}",
        ]

        # Add request context if available
        request_id = request_id_var.get()
        if request_id:
            parts.append(f"{self.DIM}[{request_id[:8]}]{self.RESET}")

        # Add the message
        parts.append(record.getMessage())

        # Add extra fields
        extras = []
        for key, value in record.__dict__.items():
            if key not in (
                'name', 'msg', 'args', 'created', 'filename', 'funcName',
                'levelname', 'levelno', 'lineno', 'module', 'msecs',
                'pathname', 'process', 'processName', 'relativeCreated',
                'stack_info', 'exc_info', 'exc_text', 'thread', 'threadName',
                'message', 'taskName'
            ):
                extras.append(f"{key}={value}")

        if extras:
            parts.append(f"{self.DIM}({', '.join(extras)}){self.RESET}")

        result = " | ".join(parts)

        # Add exception if present
        if record.exc_info:
            result += f"\n{self.formatException(record.exc_info)}"

        return result


# =============================================================================
# Log Filters
# =============================================================================

class ContextFilter(logging.Filter):
    """
    Filter that adds request context to all log records.

    This ensures context variables are available even when using
    standard logging calls without explicit extra fields.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add context to record."""
        record.request_id = request_id_var.get() or "no-request"
        record.user_id = user_id_var.get() or "anonymous"
        record.correlation_id = correlation_id_var.get()
        return True


class SensitiveDataFilter(logging.Filter):
    """
    Filter that redacts sensitive data from log messages.

    Prevents accidental logging of PHI, passwords, or tokens.
    """

    SENSITIVE_PATTERNS = [
        'password', 'passwd', 'pwd',
        'secret', 'token', 'api_key', 'apikey',
        'authorization', 'bearer',
        'ssn', 'social_security',
        'credit_card', 'card_number',
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        """Redact sensitive data from log message."""
        message = record.getMessage().lower()

        # Check if message contains sensitive patterns
        for pattern in self.SENSITIVE_PATTERNS:
            if pattern in message:
                # Log a warning instead of the actual message
                record.msg = f"[REDACTED - contained sensitive pattern: {pattern}]"
                record.args = ()
                break

        return True


# =============================================================================
# Logger Configuration
# =============================================================================

def setup_logging(
    level: Optional[str] = None,
    json_output: Optional[bool] = None,
    log_file: Optional[str] = None
) -> None:
    """
    Configure logging for the application.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_output: Use JSON formatter (auto-detected from ENVIRONMENT)
        log_file: Optional log file path

    Environment Variables:
        LOG_LEVEL: Override default log level
        ENVIRONMENT: 'production' enables JSON output
        LOG_FILE: Path to log file
    """
    # Determine settings from environment or parameters
    env = os.getenv("ENVIRONMENT", "development").lower()
    log_level = level or os.getenv("LOG_LEVEL", "INFO" if env == "production" else "DEBUG")
    use_json = json_output if json_output is not None else (env == "production")
    file_path = log_file or os.getenv("LOG_FILE")

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))

    # Remove existing handlers
    root_logger.handlers.clear()

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)

    # Set formatter based on environment
    if use_json:
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(ColoredConsoleFormatter())

    # Add filters
    console_handler.addFilter(ContextFilter())
    console_handler.addFilter(SensitiveDataFilter())

    root_logger.addHandler(console_handler)

    # Add file handler if specified
    if file_path:
        file_handler = logging.handlers.RotatingFileHandler(
            file_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(JSONFormatter())  # Always JSON for files
        file_handler.addFilter(ContextFilter())
        file_handler.addFilter(SensitiveDataFilter())
        root_logger.addHandler(file_handler)

    # Configure third-party loggers
    _configure_third_party_loggers(log_level)

    # Log startup message
    root_logger.info(
        "Logging configured",
        extra={
            "environment": env,
            "level": log_level,
            "json_output": use_json,
            "file_output": file_path or "none"
        }
    )


def _configure_third_party_loggers(app_level: str) -> None:
    """Configure log levels for third-party libraries."""
    # Reduce noise from verbose libraries
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("aiofiles").setLevel(logging.WARNING)

    # Keep watchfiles quiet except in debug mode
    if app_level.upper() != "DEBUG":
        logging.getLogger("watchfiles").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given name.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured logger instance

    Example:
        logger = get_logger(__name__)
        logger.info("User logged in", extra={"user_id": "123"})
    """
    return logging.getLogger(name)


# =============================================================================
# Performance Logging Utilities
# =============================================================================

def log_execution_time(logger: Optional[logging.Logger] = None, level: int = logging.DEBUG):
    """
    Decorator to log function execution time.

    Args:
        logger: Logger to use (default: logger for decorated function's module)
        level: Log level for timing messages

    Example:
        @log_execution_time()
        async def slow_operation():
            await asyncio.sleep(1)
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            _logger = logger or logging.getLogger(func.__module__)
            start_time = time.perf_counter()

            try:
                result = await func(*args, **kwargs)
                elapsed = (time.perf_counter() - start_time) * 1000

                _logger.log(
                    level,
                    f"{func.__name__} completed",
                    extra={
                        "function": func.__name__,
                        "duration_ms": round(elapsed, 2),
                        "status": "success"
                    }
                )
                return result

            except Exception as e:
                elapsed = (time.perf_counter() - start_time) * 1000
                _logger.log(
                    logging.ERROR,
                    f"{func.__name__} failed",
                    extra={
                        "function": func.__name__,
                        "duration_ms": round(elapsed, 2),
                        "status": "error",
                        "error_type": type(e).__name__
                    }
                )
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            _logger = logger or logging.getLogger(func.__module__)
            start_time = time.perf_counter()

            try:
                result = func(*args, **kwargs)
                elapsed = (time.perf_counter() - start_time) * 1000

                _logger.log(
                    level,
                    f"{func.__name__} completed",
                    extra={
                        "function": func.__name__,
                        "duration_ms": round(elapsed, 2),
                        "status": "success"
                    }
                )
                return result

            except Exception as e:
                elapsed = (time.perf_counter() - start_time) * 1000
                _logger.log(
                    logging.ERROR,
                    f"{func.__name__} failed",
                    extra={
                        "function": func.__name__,
                        "duration_ms": round(elapsed, 2),
                        "status": "error",
                        "error_type": type(e).__name__
                    }
                )
                raise

        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


class LogContext:
    """
    Context manager for adding temporary context to logs.

    Example:
        with LogContext(operation="import_patients", batch_id="123"):
            logger.info("Processing batch")
            # All logs within this block will have operation and batch_id
    """

    def __init__(self, **context):
        self.context = context
        self._old_factory = None

    def __enter__(self):
        # Store the old factory
        self._old_factory = logging.getLogRecordFactory()

        # Create new factory that adds our context
        old_factory = self._old_factory
        context = self.context

        def record_factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            for key, value in context.items():
                setattr(record, key, value)
            return record

        logging.setLogRecordFactory(record_factory)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore the old factory
        logging.setLogRecordFactory(self._old_factory)
        return False


# =============================================================================
# Specialized Loggers
# =============================================================================

class AuditLogger:
    """
    Specialized logger for audit events.

    Provides a structured interface for logging security-relevant events
    with consistent formatting.
    """

    def __init__(self, logger_name: str = "audit"):
        self.logger = get_logger(logger_name)

    def log_access(
        self,
        user_id: str,
        resource_type: str,
        resource_id: str,
        action: str,
        success: bool = True,
        details: Optional[dict[str, Any]] = None
    ) -> None:
        """Log resource access."""
        self.logger.info(
            f"Resource access: {action} {resource_type}/{resource_id}",
            extra={
                "event_type": "access",
                "user_id": user_id,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "action": action,
                "success": success,
                **(details or {})
            }
        )

    def log_authentication(
        self,
        user_id: str,
        event: str,
        success: bool,
        details: Optional[dict[str, Any]] = None
    ) -> None:
        """Log authentication events."""
        level = logging.INFO if success else logging.WARNING
        self.logger.log(
            level,
            f"Authentication: {event}",
            extra={
                "event_type": "authentication",
                "user_id": user_id,
                "event": event,
                "success": success,
                **(details or {})
            }
        )

    def log_security_event(
        self,
        event_type: str,
        severity: str,
        description: str,
        details: Optional[dict[str, Any]] = None
    ) -> None:
        """Log security events."""
        level_map = {
            "low": logging.INFO,
            "medium": logging.WARNING,
            "high": logging.ERROR,
            "critical": logging.CRITICAL
        }
        level = level_map.get(severity.lower(), logging.WARNING)

        self.logger.log(
            level,
            f"Security event: {description}",
            extra={
                "event_type": "security",
                "security_event_type": event_type,
                "severity": severity,
                **(details or {})
            }
        )


class PerformanceLogger:
    """
    Specialized logger for performance metrics.

    Provides a structured interface for logging performance data.
    """

    def __init__(self, logger_name: str = "performance"):
        self.logger = get_logger(logger_name)

    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        details: Optional[dict[str, Any]] = None
    ) -> None:
        """Log HTTP request performance."""
        level = logging.WARNING if duration_ms > 1000 else logging.DEBUG

        self.logger.log(
            level,
            f"{method} {path} -> {status_code} ({duration_ms:.2f}ms)",
            extra={
                "event_type": "request",
                "method": method,
                "path": path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                **(details or {})
            }
        )

    def log_database_query(
        self,
        query_type: str,
        table: str,
        duration_ms: float,
        row_count: Optional[int] = None
    ) -> None:
        """Log database query performance."""
        level = logging.WARNING if duration_ms > 100 else logging.DEBUG

        self.logger.log(
            level,
            f"DB {query_type} on {table}: {duration_ms:.2f}ms",
            extra={
                "event_type": "database",
                "query_type": query_type,
                "table": table,
                "duration_ms": duration_ms,
                "row_count": row_count
            }
        )

    def log_external_call(
        self,
        service: str,
        operation: str,
        duration_ms: float,
        success: bool,
        details: Optional[dict[str, Any]] = None
    ) -> None:
        """Log external service call performance."""
        level = logging.WARNING if not success or duration_ms > 500 else logging.DEBUG

        self.logger.log(
            level,
            f"External call to {service}: {operation} ({duration_ms:.2f}ms)",
            extra={
                "event_type": "external_call",
                "service": service,
                "operation": operation,
                "duration_ms": duration_ms,
                "success": success,
                **(details or {})
            }
        )


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    # Core configuration
    "setup_logging",
    "get_logger",

    # Context management
    "set_request_context",
    "clear_request_context",
    "LogContext",

    # Formatters
    "JSONFormatter",
    "ColoredConsoleFormatter",

    # Filters
    "ContextFilter",
    "SensitiveDataFilter",

    # Decorators
    "log_execution_time",

    # Specialized loggers
    "AuditLogger",
    "PerformanceLogger",

    # Context variables (for middleware)
    "request_id_var",
    "user_id_var",
    "correlation_id_var",
]
