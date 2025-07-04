"""
FHIR Resource Converters Module

This module contains converters for various FHIR resources.
"""

from .document_reference import DocumentReferenceConverter
from .service_request import ServiceRequestConverter
from .task import TaskConverter
from .appointment import appointment_to_fhir, fhir_to_appointment, participant_to_fhir, fhir_to_participant
from .audit_event import audit_log_to_fhir, create_audit_event, search_audit_events

__all__ = [
    'DocumentReferenceConverter',
    'ServiceRequestConverter',
    'TaskConverter',
    'appointment_to_fhir',
    'fhir_to_appointment',
    'participant_to_fhir',
    'fhir_to_participant',
    'audit_log_to_fhir',
    'create_audit_event',
    'search_audit_events'
]