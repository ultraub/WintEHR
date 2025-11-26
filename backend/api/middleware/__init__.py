"""
WintEHR API Middleware

This module provides middleware components for the FastAPI application.
"""

from .exception_handler import (
    register_exception_handlers,
    wintehr_exception_handler,
    generic_exception_handler,
)

__all__ = [
    "register_exception_handlers",
    "wintehr_exception_handler",
    "generic_exception_handler",
]
