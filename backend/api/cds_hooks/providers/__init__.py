"""
CDS Hooks Service Providers

Service provider abstraction for executing CDS services from different sources:
- LocalServiceProvider: Built-in Python class execution
- RemoteServiceProvider: External HTTP service calls

Architecture:
- HAPI FHIR stores all PlanDefinitions with service-origin extension
- Providers handle execution based on origin
- Unified interface for all service types
"""

from .base_provider import BaseServiceProvider
from .local_provider import LocalServiceProvider
from .remote_provider import RemoteServiceProvider

__all__ = [
    "BaseServiceProvider",
    "LocalServiceProvider",
    "RemoteServiceProvider"
]
