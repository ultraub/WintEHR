"""
CDS Hooks Service Registry Module

Central registry for service definitions and implementations.
Handles service discovery and CDS Hooks discovery endpoint.

Educational Focus:
- ServiceRegistry: Main registry for CDS services
- RegisteredService: Metadata wrapper for registered services
- Global registry functions for convenience
"""

from .registry import (
    ServiceRegistry,
    RegisteredService,
    get_registry,
    set_registry,
    register_service,
    get_discovery_response,
)

__all__ = [
    "ServiceRegistry",
    "RegisteredService",
    "get_registry",
    "set_registry",
    "register_service",
    "get_discovery_response",
]
