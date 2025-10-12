"""
HAPI FHIR Communication Notification Service

This service creates FHIR Communication resources and posts them to HAPI FHIR
to replace the deprecated notification system that wrote to fhir.resources table.

Created: 2025-10-05
Migration: Part of HAPI FHIR migration from custom FHIR backend
"""

from typing import Optional, Dict, Any
from datetime import datetime
import logging
from sqlalchemy.ext.asyncio import AsyncSession

# HAPI FHIR client for creating Communication resources
from services.fhir_client_config import get_fhir_server
from fhirclient.models.communication import Communication
from fhirclient.models.reference import FHIRReference
from fhirclient.models.codeableconcept import CodeableConcept
from fhirclient.models.coding import Coding

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for creating clinical notifications as FHIR Communication resources"""

    # Priority mapping from clinical terms to FHIR Communication.priority
    PRIORITY_MAP = {
        "stat": "stat",      # STAT - immediate
        "asap": "asap",      # ASAP - as soon as possible
        "urgent": "urgent",  # Urgent
        "routine": "routine" # Routine
    }

    # Category coding system
    CATEGORY_SYSTEM = "http://terminology.hl7.org/CodeSystem/communication-category"

    async def create_system_notification(
        self,
        db: AsyncSession,
        recipient_id: str,
        subject: str,
        message: str,
        priority: str = "routine",
        category: str = "notification",
        patient_id: Optional[str] = None
    ) -> Optional[Communication]:
        """
        Create a system notification as a FHIR Communication resource.

        Args:
            db: Database session (kept for backward compatibility, not used)
            recipient_id: Practitioner ID to receive the notification
            subject: Notification subject/summary
            message: Detailed notification message
            priority: Priority level (stat, asap, urgent, routine)
            category: Communication category (alert, notification, reminder)
            patient_id: Optional patient reference

        Returns:
            Created Communication resource or None on error
        """
        try:
            # Get HAPI FHIR server
            server = get_fhir_server()

            # Create Communication resource
            communication = Communication()

            # Set status (in-progress since it's a new notification)
            communication.status = "in-progress"

            # Set priority
            communication.priority = self.PRIORITY_MAP.get(priority.lower(), "routine")

            # Set category
            category_concept = CodeableConcept()
            category_coding = Coding()
            category_coding.system = self.CATEGORY_SYSTEM
            category_coding.code = category
            category_coding.display = category.title()
            category_concept.coding = [category_coding]
            communication.category = [category_concept]

            # Set recipient (Practitioner)
            recipient_ref = FHIRReference()
            recipient_ref.reference = f"Practitioner/{recipient_id}"
            communication.recipient = [recipient_ref]

            # Set sender (system)
            sender_ref = FHIRReference()
            sender_ref.reference = "Organization/system"
            sender_ref.display = "EMR System"
            communication.sender = sender_ref

            # Set patient subject if provided
            if patient_id:
                subject_ref = FHIRReference()
                subject_ref.reference = f"Patient/{patient_id}"
                communication.subject = subject_ref

            # Set sent timestamp
            communication.sent = datetime.utcnow().isoformat() + "Z"

            # Set payload (message content)
            from fhirclient.models.communication import CommunicationPayload
            payload = CommunicationPayload()
            payload.contentString = f"{subject}\n\n{message}"
            communication.payload = [payload]

            # Create resource in HAPI FHIR
            result = communication.create(server)

            if result:
                logger.info(
                    f"Created Communication notification: "
                    f"ID={communication.id}, "
                    f"priority={priority}, "
                    f"category={category}, "
                    f"recipient={recipient_id}"
                )
                return communication
            else:
                logger.error("Failed to create Communication resource in HAPI FHIR")
                return None

        except Exception as e:
            logger.error(f"Error creating Communication notification: {e}", exc_info=True)
            return None

    async def mark_notification_read(
        self,
        communication_id: str,
        user_id: str
    ) -> bool:
        """
        Mark a notification as read by updating its status.

        Args:
            communication_id: Communication resource ID
            user_id: User who read the notification

        Returns:
            True if successful, False otherwise
        """
        try:
            server = get_fhir_server()

            # Read existing Communication
            communication = Communication.read(communication_id, server)
            if not communication:
                logger.error(f"Communication {communication_id} not found")
                return False

            # Update status to completed
            communication.status = "completed"

            # Add note about who read it
            from fhirclient.models.annotation import Annotation
            note = Annotation()
            note.text = f"Read by {user_id}"
            note.time = datetime.utcnow().isoformat() + "Z"
            note.authorReference = FHIRReference({"reference": f"Practitioner/{user_id}"})

            if communication.note:
                communication.note.append(note)
            else:
                communication.note = [note]

            # Update in HAPI FHIR
            result = communication.update(server)

            if result:
                logger.info(f"Marked Communication {communication_id} as read by {user_id}")
                return True
            else:
                logger.error(f"Failed to update Communication {communication_id}")
                return False

        except Exception as e:
            logger.error(f"Error marking notification as read: {e}", exc_info=True)
            return False

    async def get_notifications_for_user(
        self,
        recipient_id: str,
        status: Optional[str] = None,
        limit: int = 50
    ) -> list:
        """
        Get notifications (Communications) for a specific user.

        Args:
            recipient_id: Practitioner ID
            status: Optional status filter (in-progress, completed)
            limit: Maximum number of results

        Returns:
            List of Communication resources
        """
        try:
            server = get_fhir_server()

            # Build search parameters
            search_params = {
                "recipient": f"Practitioner/{recipient_id}",
                "_count": limit,
                "_sort": "-sent"  # Most recent first
            }

            if status:
                search_params["status"] = status

            # Search for Communications
            search = Communication.where(struct=search_params)
            communications = search.perform_resources(server)

            return communications if communications else []

        except Exception as e:
            logger.error(f"Error retrieving notifications for {recipient_id}: {e}", exc_info=True)
            return []


# Singleton instance
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """Get singleton notification service instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
