"""
API Services Module

Audit: `audit_event_service.py` — writes FHIR R4 `AuditEvent` resources into
HAPI. (The legacy `audit_service.py` SQL writer to `audit.events` was removed;
the `audit.*` schema still exists in postgres-init but has no writers.)
"""

from .audit_event_service import AuditEventService, AuditEventType

__all__ = ['AuditEventService', 'AuditEventType']
