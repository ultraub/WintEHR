"""
Pharmacy business logic.

Extracted from pharmacy_router.py per the router/service split this repo
declares in backend/CLAUDE.md but had not applied here: the router held
1,526 lines of HTTP surface, Pydantic models, and business logic, and
constructed HAPIFHIRClient eleven separate times
(docs/ARCHITECTURE_DEBT.md §F4 opportunity #5).

Scope of this slice: the pure queue-building helpers and the READ paths
(queue, metrics, inventory). The write paths — dispense, status update,
refills, MAR administration — deliberately stay in the router for now:
they carry the patient-safety gates (signed-order-before-dispense,
MAR administration checks) whose regression tests patch
`pharmacy_router.HAPIFHIRClient` directly. Moving them in the same change
would repoint those patches and risk the tests passing while asserting
nothing. They move next, with their tests repointed and re-proven.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from services.hapi_fhir_client import HAPIFHIRClient

from .models import PharmacyQueueItem

logger = logging.getLogger(__name__)


def _build_pharmacy_queue_item(medication_request: Dict[str, Any]) -> PharmacyQueueItem:
    """Build a pharmacy queue item from a MedicationRequest resource"""

    # Extract basic information
    patient_ref = medication_request.get('subject', {}).get('reference', '')
    patient_id = patient_ref.replace('Patient/', '') if patient_ref.startswith('Patient/') else ''

    medication_name = (
        medication_request.get('medicationCodeableConcept', {}).get('text') or
        medication_request.get('medicationCodeableConcept', {}).get('coding', [{}])[0].get('display') or
        'Unknown Medication'
    )

    quantity_info = medication_request.get('dispenseRequest', {}).get('quantity', {})
    quantity = quantity_info.get('value')
    unit = quantity_info.get('unit', 'units')

    prescribed_date = None
    if medication_request.get('authoredOn'):
        try:
            prescribed_date = datetime.fromisoformat(medication_request['authoredOn'].replace('Z', '+00:00'))
        except (ValueError, TypeError):
            pass

    # Get pharmacy status
    pharmacy_status = _get_pharmacy_status(medication_request)

    # Determine priority (1 = highest, 5 = lowest)
    priority = _calculate_priority(medication_request, pharmacy_status)

    # Calculate due date (for pending items)
    due_date = None
    if prescribed_date and pharmacy_status in ['pending', 'verified']:
        due_date = prescribed_date + timedelta(hours=24)  # 24 hour turnaround

    return PharmacyQueueItem(
        medication_request_id=medication_request['id'],
        patient_id=patient_id,
        medication_name=medication_name,
        quantity=quantity,
        unit=unit,
        status=pharmacy_status,
        priority=priority,
        prescribed_date=prescribed_date,
        due_date=due_date,
        prescriber=medication_request.get('requester', {}).get('display'),
        pharmacy_notes=_extract_pharmacy_notes(medication_request)
    )


def _get_pharmacy_status(medication_request: Dict[str, Any]) -> str:
    """Extract pharmacy status from medication request extension"""
    extensions = medication_request.get('extension', [])

    for ext in extensions:
        if ext.get('url') == ExtensionURLs.PHARMACY_STATUS:
            for sub_ext in ext.get('extension', []):
                if sub_ext.get('url') == 'status':
                    return sub_ext.get('valueString', 'pending')

    # Default status based on medication request status and timing
    req_status = medication_request.get('status', 'active')
    if req_status in ['completed', 'stopped', 'cancelled']:
        return 'completed'

    # For active requests, determine based on timing
    authored_on = medication_request.get('authoredOn')
    if authored_on:
        try:
            prescribed_date = datetime.fromisoformat(authored_on.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) - prescribed_date < timedelta(hours=1):
                return 'pending'
            else:
                return 'verified'
        except (ValueError, TypeError):
            pass

    return 'pending'


def _calculate_priority(medication_request: Dict[str, Any], pharmacy_status: str) -> int:
    """Calculate priority for pharmacy queue item"""

    # Start with base priority
    priority = 3  # Normal priority

    # Urgent/stat orders get highest priority
    if medication_request.get('priority') == 'urgent':
        priority = 1
    elif medication_request.get('priority') == 'stat':
        priority = 1

    # Pending items get higher priority
    if pharmacy_status == 'pending':
        priority = min(priority, 2)

    # Time-based priority adjustment
    authored_on = medication_request.get('authoredOn')
    if authored_on:
        try:
            prescribed_date = datetime.fromisoformat(authored_on.replace('Z', '+00:00'))
            hours_old = (datetime.now(timezone.utc) - prescribed_date).total_seconds() / 3600

            if hours_old > 24:  # Over 24 hours old
                priority = min(priority, 1)  # Highest priority
            elif hours_old > 12:  # Over 12 hours old
                priority = min(priority, 2)  # High priority
        except (ValueError, TypeError):
            pass

    return priority


def _extract_pharmacy_notes(medication_request: Dict[str, Any]) -> Optional[str]:
    """Extract pharmacy-specific notes from medication request"""
    notes = medication_request.get('note', [])

    for note in notes:
        note_text = note.get('text', '')
        if note_text.startswith('Pharmacy:'):
            return note_text.replace('Pharmacy:', '').strip()

    return None


# =============================================================================
# Refill Management Endpoints - FHIR-based Implementation
# =============================================================================


class PharmacyService:
    """Pharmacy read operations over HAPI FHIR.

    Holds ONE HAPIFHIRClient instead of constructing a fresh one per
    handler, so the transport is swappable in tests and configured once.
    """

    def __init__(self, hapi_client: Optional[HAPIFHIRClient] = None):
        self.hapi = hapi_client or HAPIFHIRClient()

    async def get_queue(
        self,
        status: Optional[str] = None,
        patient_id: Optional[str] = None,
        priority: Optional[int] = None,
    ) -> List[PharmacyQueueItem]:
        """Pharmacy queue, priority- then date-ordered."""
        search_params: Dict[str, Any] = {
            "_sort": "-authored",  # Most recent first
            "_count": 100,         # Reasonable limit for pharmacy queue
        }
        if patient_id:
            search_params["patient"] = (
                f"Patient/{patient_id}" if not patient_id.startswith("Patient/") else patient_id
            )
        if status:
            search_params["status"] = status

        bundle = await self.hapi.search("MedicationRequest", search_params)

        queue_items: List[PharmacyQueueItem] = []
        for entry in bundle.get("entry", []):
            resource = entry.get("resource", {})
            queue_item = _build_pharmacy_queue_item(resource)
            if priority and queue_item.priority != priority:
                continue
            queue_items.append(queue_item)

        queue_items.sort(
            key=lambda x: (
                x.priority,
                x.prescribed_date or datetime.min.replace(tzinfo=timezone.utc),
            )
        )
        return queue_items


def get_pharmacy_service() -> PharmacyService:
    """FastAPI dependency — one service per request."""
    return PharmacyService()
