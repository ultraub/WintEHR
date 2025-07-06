"""FHIR notification service for broadcasting resource updates."""

import logging
from typing import Optional, Dict, Any
from .connection_manager import manager

logger = logging.getLogger(__name__)


class FHIRNotificationService:
    """Service for sending FHIR resource notifications via WebSocket."""
    
    async def notify_resource_created(
        self,
        resource_type: str,
        resource_id: str,
        resource_data: Dict[str, Any],
        patient_id: Optional[str] = None
    ):
        """Notify clients about a newly created FHIR resource."""
        # Extract patient ID from resource if not provided
        if not patient_id and resource_type == "Patient":
            patient_id = resource_id
        elif not patient_id and "subject" in resource_data:
            # Extract patient ID from subject reference
            subject_ref = resource_data.get("subject", {}).get("reference", "")
            if subject_ref.startswith("Patient/"):
                patient_id = subject_ref.replace("Patient/", "")
                
        await manager.broadcast_resource_update(
            resource_type=resource_type,
            resource_id=resource_id,
            action="created",
            resource_data=resource_data,
            patient_id=patient_id
        )
        logger.info(f"Notified clients about new {resource_type}/{resource_id}")
        
    async def notify_resource_updated(
        self,
        resource_type: str,
        resource_id: str,
        resource_data: Dict[str, Any],
        patient_id: Optional[str] = None
    ):
        """Notify clients about an updated FHIR resource."""
        # Extract patient ID from resource if not provided
        if not patient_id and resource_type == "Patient":
            patient_id = resource_id
        elif not patient_id and "subject" in resource_data:
            # Extract patient ID from subject reference
            subject_ref = resource_data.get("subject", {}).get("reference", "")
            if subject_ref.startswith("Patient/"):
                patient_id = subject_ref.replace("Patient/", "")
                
        await manager.broadcast_resource_update(
            resource_type=resource_type,
            resource_id=resource_id,
            action="updated",
            resource_data=resource_data,
            patient_id=patient_id
        )
        logger.info(f"Notified clients about updated {resource_type}/{resource_id}")
        
    async def notify_resource_deleted(
        self,
        resource_type: str,
        resource_id: str,
        patient_id: Optional[str] = None
    ):
        """Notify clients about a deleted FHIR resource."""
        await manager.broadcast_resource_update(
            resource_type=resource_type,
            resource_id=resource_id,
            action="deleted",
            resource_data=None,
            patient_id=patient_id
        )
        logger.info(f"Notified clients about deleted {resource_type}/{resource_id}")
        
    async def notify_clinical_event(
        self,
        event_type: str,
        resource_type: str,
        resource_id: str,
        patient_id: str,
        details: Dict[str, Any]
    ):
        """Notify clients about clinical events (e.g., critical lab results)."""
        # This is a specialized notification for clinical use cases
        await manager.broadcast_resource_update(
            resource_type=resource_type,
            resource_id=resource_id,
            action="clinical_event",
            resource_data={
                "event_type": event_type,
                "details": details
            },
            patient_id=patient_id
        )
        logger.info(f"Notified clients about clinical event: {event_type}")


# Global notification service instance
notification_service = FHIRNotificationService()