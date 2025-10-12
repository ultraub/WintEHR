"""
API Services Module

Audit Services:
- audit_service.py (database table approach) -> uses audit.events table
- audit_event_service.py (FHIR resource approach) -> uses HAPI FHIR AuditEvent resources
"""

from .audit_event_service import AuditEventService, AuditEventType

# Legacy import for backward compatibility - will be removed after migration
from .audit_service import AuditService

__all__ = ['AuditEventService', 'AuditEventType', 'AuditService']