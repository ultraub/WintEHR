"""
HAPI FHIR Communication Notification Service

This service creates FHIR Communication resources and posts them to HAPI FHIR
to replace the deprecated notification system that wrote to fhir.resources table.

Created: 2025-10-05
Migration: Part of HAPI FHIR migration from custom FHIR backend
Updated: 2025-11 - Migrated to HAPIFHIRClient for async non-blocking operations
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import logging
from sqlalchemy.ext.asyncio import AsyncSession

# HAPI FHIR client for creating Communication resources
from services.hapi_fhir_client import HAPIFHIRClient

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
    ) -> Optional[Dict[str, Any]]:
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
            Created Communication resource dict or None on error
        """
        try:
            hapi_client = HAPIFHIRClient()

            # Build Communication resource as dictionary
            communication = {
                "resourceType": "Communication",
                "status": "in-progress",
                "priority": self.PRIORITY_MAP.get(priority.lower(), "routine"),
                "category": [
                    {
                        "coding": [
                            {
                                "system": self.CATEGORY_SYSTEM,
                                "code": category,
                                "display": category.title()
                            }
                        ]
                    }
                ],
                "recipient": [
                    {"reference": f"Practitioner/{recipient_id}"}
                ],
                "sender": {
                    "reference": "Organization/system",
                    "display": "EMR System"
                },
                "sent": datetime.utcnow().isoformat() + "Z",
                "payload": [
                    {"contentString": f"{subject}\n\n{message}"}
                ]
            }

            # Add patient subject if provided
            if patient_id:
                communication["subject"] = {"reference": f"Patient/{patient_id}"}

            # Create resource in HAPI FHIR
            result = await hapi_client.create("Communication", communication)

            if result and result.get("id"):
                logger.info(
                    f"Created Communication notification: "
                    f"ID={result.get('id')}, "
                    f"priority={priority}, "
                    f"category={category}, "
                    f"recipient={recipient_id}"
                )
                return result
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
            hapi_client = HAPIFHIRClient()

            # Read existing Communication
            communication = await hapi_client.read("Communication", communication_id)
            if not communication:
                logger.error(f"Communication {communication_id} not found")
                return False

            # Update status to completed
            communication["status"] = "completed"

            # Add note about who read it
            note = {
                "text": f"Read by {user_id}",
                "time": datetime.utcnow().isoformat() + "Z",
                "authorReference": {"reference": f"Practitioner/{user_id}"}
            }

            if communication.get("note"):
                communication["note"].append(note)
            else:
                communication["note"] = [note]

            # Update in HAPI FHIR
            result = await hapi_client.update("Communication", communication_id, communication)

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
    ) -> List[Dict[str, Any]]:
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
            hapi_client = HAPIFHIRClient()

            # Build search parameters
            search_params = {
                "recipient": f"Practitioner/{recipient_id}",
                "_count": limit,
                "_sort": "-sent"  # Most recent first
            }

            if status:
                search_params["status"] = status

            # Search for Communications
            bundle = await hapi_client.search("Communication", search_params)

            if isinstance(bundle, dict) and bundle.get("entry"):
                return [entry.get("resource", entry) for entry in bundle["entry"]]
            return []

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
