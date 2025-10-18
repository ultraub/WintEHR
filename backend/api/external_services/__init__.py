"""
External Services API Module

Enables registration and management of external FHIR services:
- CDS Hooks services
- SMART on FHIR applications
- FHIR Subscription webhooks
- CQL Library providers

Leverages HAPI FHIR's built-in capabilities for standards-compliant integration.
"""

from .router import router

__all__ = ['router']
