"""
API Services Module

Migration Note (2025-10-06):
- audit_service.py (deprecated) -> uses fhir.audit_logs table
- audit_event_service.py (current) -> uses HAPI FHIR AuditEvent resources
"""

from .audit_event_service import AuditEventService, AuditEventType

# Legacy import for backward compatibility - will be removed after migration
from .audit_service import AuditService

__all__ = ['AuditEventService', 'AuditEventType', 'AuditService']