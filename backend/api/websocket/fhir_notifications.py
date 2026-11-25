"""FHIR notification service for broadcasting resource updates."""

import asyncio
import logging
from typing import Optional, Dict, Any
from .connection_manager import manager

logger = logging.getLogger(__name__)


# Written on nearly every request and shown in no live view — broadcasting
# them would only add traffic.
SILENT_RESOURCE_TYPES = frozenset({"AuditEvent", "Provenance"})


def patient_id_of(resource: Optional[Dict[str, Any]]) -> Optional[str]:
    """Best-effort patient id from a FHIR resource (itself, or its subject/patient)."""
    if not isinstance(resource, dict):
        return None
    if resource.get("resourceType") == "Patient":
        return resource.get("id")
    for field in ("subject", "patient"):
        ref = resource.get(field)
        reference = ref.get("reference", "") if isinstance(ref, dict) else ""
        if reference.startswith("Patient/"):
            return reference.split("/", 1)[1].split("/", 1)[0]
    return None


class FHIRNotificationService:
    """Service for sending FHIR resource notifications via WebSocket.

    Every notify method is failure-proof: a broadcast problem is logged and
    swallowed, because notifying must never break the write path that
    triggered it.
    """

    async def _safe_broadcast(self, **kwargs):
        try:
            await manager.broadcast_resource_update(**kwargs)
            return True
        except Exception as exc:  # noqa: BLE001 — never break the caller's write
            logger.warning(f"WebSocket broadcast failed (ignored): {exc}")
            return False

    async def notify_resource_created(
        self,
        resource_type: str,
        resource_id: str,
        resource_data: Dict[str, Any],
        patient_id: Optional[str] = None
    ):
        """Notify clients about a newly created FHIR resource."""
        if not patient_id:
            patient_id = resource_id if resource_type == "Patient" else patient_id_of(resource_data)
                
        await self._safe_broadcast(
            resource_type=resource_type,
            resource_id=resource_id,
            action="created",
            resource_data=resource_data,
            patient_id=patient_id
        )
        logger.debug("Notified clients about a new %s", resource_type)
        
    async def notify_resource_updated(
        self,
        resource_type: str,
        resource_id: str,
        resource_data: Dict[str, Any],
        patient_id: Optional[str] = None
    ):
        """Notify clients about an updated FHIR resource."""
        if not patient_id:
            patient_id = resource_id if resource_type == "Patient" else patient_id_of(resource_data)
                
        await self._safe_broadcast(
            resource_type=resource_type,
            resource_id=resource_id,
            action="updated",
            resource_data=resource_data,
            patient_id=patient_id
        )
        logger.debug("Notified clients about an updated %s", resource_type)
        
    async def notify_resource_deleted(
        self,
        resource_type: str,
        resource_id: str,
        patient_id: Optional[str] = None
    ):
        """Notify clients about a deleted FHIR resource.

        The resource is gone, so the caller supplies the patient (read before
        deleting). The message still names the resource — type and id — so a
        client can drop that one item from its list.
        """
        if not patient_id and resource_type == "Patient":
            patient_id = resource_id
        await self._safe_broadcast(
            resource_type=resource_type,
            resource_id=resource_id,
            action="deleted",
            resource_data={"resourceType": resource_type, "id": resource_id},
            patient_id=patient_id
        )
        logger.debug("Notified clients about a deleted %s", resource_type)

    def schedule_write(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[str],
        resource_data: Optional[Dict[str, Any]] = None,
        patient_id: Optional[str] = None,
    ) -> bool:
        """Broadcast a completed write without making the caller wait.

        The single entry point for "a resource was just written": used by the
        FHIR proxy (browser writes) and by HAPIFHIRClient (backend writes).
        Fire-and-forget, and never raises into the write path.
        """
        try:
            if not resource_id or resource_type in SILENT_RESOURCE_TYPES:
                return False
            if action == "created":
                coro = self.notify_resource_created(resource_type, resource_id, resource_data or {}, patient_id)
            elif action == "updated":
                coro = self.notify_resource_updated(resource_type, resource_id, resource_data or {}, patient_id)
            elif action == "deleted":
                coro = self.notify_resource_deleted(resource_type, resource_id, patient_id)
            else:
                return False
            try:
                asyncio.get_running_loop().create_task(coro)
            except RuntimeError:
                coro.close()  # no event loop (a sync script) — nothing to notify
                return False
            return True
        except Exception as exc:  # noqa: BLE001 — broadcasting must never break a write
            logger.warning(f"FHIR write broadcast skipped: {exc}")
            return False

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
        await self._safe_broadcast(
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