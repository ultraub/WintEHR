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
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status as http_status

from api.cds_hooks.constants import ExtensionURLs
from api.websocket.fhir_notifications import notification_service
from services.hapi_fhir_client import HAPIFHIRClient

from .models import (
    MAREntry,
    MedicationAdministrationRequest,
    MedicationDispenseRequest,
    PharmacyQueueItem,
    PharmacyStatusUpdate,
    RefillDecision,
    RefillRequest,
    RefillResponse,
)

# NOTE: service methods raise fastapi.HTTPException directly. That is a
# deliberate fidelity compromise for this extraction: the write paths carry
# patient-safety gates whose exact status codes and messages are pinned by
# tests, and translating every raise into domain exceptions in the same
# change would multiply the diff on the most safety-critical code in the
# module. Migrate to domain exceptions in a dedicated pass if desired.

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
            # HAPI's MedicationRequest sort parameter is "authoredon" —
            # "authored" is ServiceRequest's name and makes HAPI 400, which
            # this endpoint had been returning as a 500 since it was written
            # (the '-authored-on' vs 'authoredon' family, PR #234). The
            # refills query below sorts Task, where "-authored-on" IS valid.
            "_sort": "-authoredon",  # Most recent first
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


    async def dispense_medication(self, dispense_request: MedicationDispenseRequest):
        """Dispense medication and create MedicationDispense resource using HAPI FHIR (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi

            # Get the medication request from HAPI FHIR
            med_request = await hapi_client.read('MedicationRequest', dispense_request.medication_request_id)
            if not med_request:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail="Medication request not found"
                )

            # FHIR R4 lifecycle gate: only signed orders may be dispensed.
            # Order creation dialogs land orders as `draft`; the encounter
            # signing dialog (PR #85) flips them to `active` after the
            # prescriber explicitly Signs. Dispensing a draft would bypass
            # that signature step entirely — a real patient-safety risk.
            # `entered-in-error`, `cancelled`, `stopped`, `unknown` are also
            # non-dispensable terminal/error states.
            DISPENSABLE_STATUSES = {"active", "on-hold", "completed"}
            order_status = med_request.get("status")
            if order_status not in DISPENSABLE_STATUSES:
                raise HTTPException(
                    status_code=http_status.HTTP_409_CONFLICT,
                    detail=(
                        f"Cannot dispense MedicationRequest in status '{order_status}'. "
                        f"The order must be signed (status='active') before dispensing."
                    ),
                )

            # FHIR R4: subject is required (1..1) - validate it exists in the request
            if not med_request.get("subject") or not med_request.get("subject", {}).get("reference"):
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="MedicationRequest is missing required subject reference"
                )

            # FHIR R4: performer is required - pharmacist_id must be provided
            if not dispense_request.pharmacist_id:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="pharmacist_id is required for medication dispensing"
                )

            # Extract patient_id from the medication request subject
            patient_ref = med_request["subject"]["reference"]

            # Create complete MedicationDispense FHIR resource
            dispense_id = str(uuid.uuid4())
            current_time = datetime.now(timezone.utc)

            # Get dispense unit from request or default
            dispense_unit = med_request.get("dispenseRequest", {}).get("quantity", {}).get("unit", "units")
            dispense_unit_code = med_request.get("dispenseRequest", {}).get("quantity", {}).get("code", "{Unit}")

            # Build MedicationDispense resource (dict format)
            # Note: id and versionId are managed by HAPI FHIR server
            dispense_resource = {
                "resourceType": "MedicationDispense",
                "meta": {
                    "profile": ["http://hl7.org/fhir/StructureDefinition/MedicationDispense"]
                },
                "identifier": [{
                    "system": f"{ExtensionURLs.BASE_URL}/pharmacy/dispense-id",
                    "value": f"DISP-{dispense_id[:8].upper()}"
                }],
                "status": "completed",
                # FHIR R4: subject is required (1..1)
                "subject": med_request["subject"],
                "authorizingPrescription": [{
                    "reference": f"MedicationRequest/{dispense_request.medication_request_id}"
                }],
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": "FF",
                        "display": "First Fill"
                    }]
                },
                "quantity": {
                    "value": dispense_request.quantity,
                    "unit": dispense_unit,
                    "system": "http://unitsofmeasure.org",
                    "code": dispense_unit_code
                },
                "daysSupply": {
                    "value": 30,
                    "unit": "days",
                    "system": "http://unitsofmeasure.org",
                    "code": "d"
                },
                "whenPrepared": current_time.isoformat(),
                "whenHandedOver": current_time.isoformat(),
                "performer": [{
                    "actor": {
                        "reference": f"Practitioner/{dispense_request.pharmacist_id}",
                        "display": "Pharmacist"
                    }
                }]
            }

            # Copy medication from request
            if med_request.get("medicationCodeableConcept"):
                dispense_resource["medicationCodeableConcept"] = med_request["medicationCodeableConcept"]

            # Copy subject (patient) from request
            if med_request.get("subject"):
                dispense_resource["subject"] = med_request["subject"]

            # Copy encounter/context from request
            if med_request.get("encounter"):
                dispense_resource["context"] = med_request["encounter"]

            # Copy dosage instructions from request
            if med_request.get("dosageInstruction"):
                dispense_resource["dosageInstruction"] = med_request["dosageInstruction"]

            # Add lot number and expiration as extensions
            dispense_resource["extension"] = [
                {
                    "url": f"{ExtensionURLs.BASE_URL}/lot-number",
                    "valueString": dispense_request.lot_number
                },
                {
                    "url": f"{ExtensionURLs.BASE_URL}/expiration-date",
                    "valueDate": dispense_request.expiration_date
                }
            ]

            # Add pharmacist notes
            if dispense_request.pharmacist_notes:
                dispense_resource["note"] = [{
                    "text": dispense_request.pharmacist_notes,
                    "time": current_time.isoformat()
                }]

            # Create the dispense resource in HAPI FHIR
            created_dispense = await hapi_client.create("MedicationDispense", dispense_resource)

            # Refill accounting: numberOfRepeatsAllowed counts REFILLS, so the
            # order authorizes repeats+1 total fills. Complete the order only
            # when the authorized fills are used up — and never mutate the
            # ordered refill count. The fill count comes from MedicationDispense
            # resources (including the one just created).
            repeats = (med_request.get("dispenseRequest") or {}).get("numberOfRepeatsAllowed") or 0
            fills = 1
            try:
                existing = await hapi_client.search("MedicationDispense", {
                    "prescription": f"MedicationRequest/{dispense_request.medication_request_id}",
                    "status": "completed",
                    "_summary": "count",
                })
                fills = max(existing.get("total", 1), 1)
            except Exception as exc:
                logger.warning(f"Could not count prior dispenses, assuming first fill: {exc}")

            if fills >= repeats + 1:
                med_request["status"] = "completed"
                await hapi_client.update("MedicationRequest", dispense_request.medication_request_id, med_request)

            # Broadcast so open pharmacy queues refresh live (failure-proof —
            # notification_service never raises into the write path)
            patient_ref = (med_request.get("subject") or {}).get("reference", "")
            await notification_service.notify_clinical_event(
                event_type="medication.dispensed",
                resource_type="MedicationDispense",
                resource_id=created_dispense.get("id"),
                patient_id=patient_ref.replace("Patient/", "") or None,
                details={"medication_request_id": dispense_request.medication_request_id},
            )

            # Broadcast so open pharmacy queues refresh live (failure-proof —
            # notification_service never raises into the write path)
            patient_ref = (med_request.get("subject") or {}).get("reference", "")
            await notification_service.notify_clinical_event(
                event_type="medication.dispensed",
                resource_type="MedicationDispense",
                resource_id=created_dispense.get("id"),
                patient_id=patient_ref.replace("Patient/", "") or None,
                details={"medication_request_id": dispense_request.medication_request_id},
            )

            return {
                "message": "Medication dispensed successfully",
                "dispense_id": created_dispense.get("id"),
                "medication_request_id": dispense_request.medication_request_id
            }

        except HTTPException:
            # Re-raise FastAPI HTTPExceptions verbatim so the specific status
            # codes (404 missing, 400 invalid, 409 signing-gate) reach the
            # client unchanged. Without this, the catch-all below wrapped
            # everything as 500 and swallowed the intended response codes.
            raise
        except Exception as e:
            logger.error(f"Failed to dispense medication: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to dispense medication: {str(e)}"
            )

    async def update_pharmacy_status(self, medication_request_id: str, status_update: PharmacyStatusUpdate):
        """Update pharmacy workflow status for a medication request using HAPI FHIR (moved verbatim from the router)."""
        logger.info(f"Updating pharmacy status for MedicationRequest ID: {medication_request_id}")
        logger.info(f"New status: {status_update.status}")

        try:
            hapi_client = self.hapi

            # Get the medication request from HAPI FHIR
            med_request = await hapi_client.read('MedicationRequest', medication_request_id)
            if not med_request:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail="Medication request not found"
                )

            # Initialize extensions array if needed
            if "extension" not in med_request:
                med_request["extension"] = []

            # Find or create pharmacy status extension
            pharmacy_ext = None
            for ext in med_request["extension"]:
                if ext.get("url") == ExtensionURLs.PHARMACY_STATUS:
                    pharmacy_ext = ext
                    break

            if not pharmacy_ext:
                pharmacy_ext = {
                    "url": ExtensionURLs.PHARMACY_STATUS,
                    "extension": []
                }
                med_request["extension"].append(pharmacy_ext)

            # Update status extension
            pharmacy_ext["extension"] = [
                {
                    "url": "status",
                    "valueString": status_update.status
                },
                {
                    "url": "lastUpdated",
                    "valueDateTime": datetime.now().isoformat()
                }
            ]

            if status_update.updated_by:
                pharmacy_ext["extension"].append({
                    "url": "updatedBy",
                    "valueString": status_update.updated_by
                })

            # Add notes if provided
            if status_update.notes:
                if "note" not in med_request:
                    med_request["note"] = []

                med_request["note"].append({
                    "text": f"Pharmacy: {status_update.notes}",
                    "time": datetime.now().isoformat()
                })

            # Update the resource in HAPI FHIR
            await hapi_client.update("MedicationRequest", medication_request_id, med_request)

            # Broadcast the status change (failure-proof)
            patient_ref = (med_request.get("subject") or {}).get("reference", "")
            await notification_service.notify_clinical_event(
                event_type="medication.status.changed",
                resource_type="MedicationRequest",
                resource_id=medication_request_id,
                patient_id=patient_ref.replace("Patient/", "") or None,
                details={"status": status_update.status},
            )

            return {
                "message": f"Pharmacy status updated to {status_update.status}",
                "medication_request_id": medication_request_id,
                "status": status_update.status
            }

        except Exception as e:
            logger.error(f"Failed to update pharmacy status: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update pharmacy status: {str(e)}"
            )

    async def get_pharmacy_metrics(self, date_range: int = 7):
        """Get pharmacy workflow metrics and statistics using HAPI FHIR (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi

            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=date_range)

            # Get medication requests in date range
            search_params = {
                'date': f"ge{start_date.strftime('%Y-%m-%d')}",
                "_count": 1000  # Large limit for metrics
            }

            med_requests_bundle = await hapi_client.search('MedicationRequest', search_params)

            # Calculate metrics
            status_counts = {}
            pharmacy_status_counts = {}

            med_requests_entries = med_requests_bundle.get("entry", [])
            total_requests = len(med_requests_entries)

            for entry in med_requests_entries:
                request_dict = entry.get("resource", {})

                # Medication request status
                req_status = request_dict.get('status', 'unknown')
                status_counts[req_status] = status_counts.get(req_status, 0) + 1

                # Pharmacy status (from extension)
                pharmacy_status = _get_pharmacy_status(request_dict)
                pharmacy_status_counts[pharmacy_status] = pharmacy_status_counts.get(pharmacy_status, 0) + 1

            # Get dispensed medications
            dispense_search_params = {
                'whenhandedover': f"ge{start_date.strftime('%Y-%m-%d')}",
                "_count": 1000
            }
            dispense_bundle = await hapi_client.search('MedicationDispense', dispense_search_params)
            dispensed_count = len(dispense_bundle.get("entry", []))

            return {
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "days": date_range
                },
                "metrics": {
                    "total_requests": total_requests,
                    "dispensed_medications": dispensed_count,
                    "completion_rate": (dispensed_count / total_requests * 100) if total_requests > 0 else 0,
                    "status_breakdown": status_counts,
                    "pharmacy_status_breakdown": pharmacy_status_counts
                }
            }

        except Exception as e:
            logger.error(f"Failed to retrieve pharmacy metrics: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve pharmacy metrics: {str(e)}"
            )

    async def check_medication_inventory(self, medication_code: str):
        """Check medication inventory levels (mock implementation) (moved verbatim from the router)."""
        mock_inventory = {
            "medication_code": medication_code,
            "medication_name": "Sample Medication",
            "current_stock": 150,
            "minimum_stock": 50,
            "unit": "tablets",
            "lot_numbers": [
                {
                    "lot": "LOT123456",
                    "quantity": 75,
                    "expiration": "2025-12-31"
                },
                {
                    "lot": "LOT789012",
                    "quantity": 75,
                    "expiration": "2026-06-30"
                }
            ],
            "status": "in_stock",
            "last_updated": datetime.now().isoformat()
        }

        return mock_inventory

    async def get_pending_refills(self, patient_id: Optional[str] = None, status: str = "requested"):
        """Get pending refill requests using FHIR Task resources. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Search for refill tasks
            search_params = {
                "code": "fulfill",  # FHIR task code for fulfillment requests
                "status": status,
                "_sort": "-authored-on",
                "_count": 100
            }
        
            if patient_id:
                search_params["patient"] = f"Patient/{patient_id}" if not patient_id.startswith("Patient/") else patient_id
        
            # Search for Tasks that represent refill requests
            task_bundle = await hapi_client.search("Task", search_params)
        
            refills = []
            for entry in task_bundle.get("entry", []):
                task = entry.get("resource", {})
            
                # Only include tasks that are refill requests (check extension or description)
                task_description = task.get("description", "")
                if "refill" not in task_description.lower():
                    # Check extension for refill type
                    is_refill = False
                    for ext in task.get("extension", []):
                        if ext.get("url") == f"{ExtensionURLs.BASE_URL}/task-type" and ext.get("valueString") == "refill":
                            is_refill = True
                            break
                    if not is_refill:
                        continue
            
                # Extract medication request reference
                focus_ref = task.get("focus", {}).get("reference", "")
                med_request_id = focus_ref.replace("MedicationRequest/", "") if focus_ref.startswith("MedicationRequest/") else None
            
                # Extract patient reference
                for_ref = task.get("for", {}).get("reference", "")
                task_patient_id = for_ref.replace("Patient/", "") if for_ref.startswith("Patient/") else None
            
                refill_info = {
                    "task_id": task.get("id"),
                    "medication_request_id": med_request_id,
                    "patient_id": task_patient_id,
                    "status": task.get("status"),
                    "business_status": task.get("businessStatus", {}).get("text"),
                    "priority": task.get("priority", "routine"),
                    "authored_on": task.get("authoredOn"),
                    "description": task.get("description"),
                    "notes": [note.get("text") for note in task.get("note", [])]
                }
            
                refills.append(refill_info)
        
            return refills
        
        except Exception as e:
            logger.error(f"Failed to get refill requests: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get refill requests: {str(e)}"
            )

    async def request_refill(self, refill_request: RefillRequest):
        """Create a new refill request using FHIR Task resource. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Verify the original medication request exists
            original_med_request = await hapi_client.read("MedicationRequest", refill_request.medication_request_id)
            if not original_med_request:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail="Original medication request not found"
                )
        
            # Check if refills are allowed
            dispense_request = original_med_request.get("dispenseRequest", {})
            repeats_allowed = dispense_request.get("numberOfRepeatsAllowed", 0)
        
            # Count existing refills (completed Tasks referencing this MedicationRequest)
            existing_refills = await hapi_client.search("Task", {
                "focus": f"MedicationRequest/{refill_request.medication_request_id}",
                "status": "completed",
                "code": "fulfill"
            })
            completed_refills = len(existing_refills.get("entry", []))
        
            if completed_refills >= repeats_allowed:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=f"No refills remaining. {completed_refills}/{repeats_allowed} refills used."
                )
        
            # Create FHIR Task for refill request
            current_time = datetime.now(timezone.utc)
            task_id = str(uuid.uuid4())
        
            medication_name = (
                original_med_request.get("medicationCodeableConcept", {}).get("text") or
                original_med_request.get("medicationCodeableConcept", {}).get("coding", [{}])[0].get("display") or
                "Unknown Medication"
            )
        
            refill_task = {
                "resourceType": "Task",
                "identifier": [{
                    "system": f"{ExtensionURLs.BASE_URL}/pharmacy/refill-id",
                    "value": f"REFILL-{task_id[:8].upper()}"
                }],
                "status": "requested",
                "businessStatus": {
                    "coding": [{
                        "system": f"{ExtensionURLs.BASE_URL}/pharmacy/refill-status",
                        "code": "pending-review",
                        "display": "Pending Pharmacist Review"
                    }],
                    "text": "Pending Pharmacist Review"
                },
                "intent": "order",
                "priority": original_med_request.get("priority", "routine"),
                "code": {
                    "coding": [{
                        "system": "http://hl7.org/fhir/CodeSystem/task-code",
                        "code": "fulfill",
                        "display": "Fulfill the focal request"
                    }],
                    "text": "Medication Refill Request"
                },
                "description": f"Refill request for {medication_name}",
                "focus": {
                    "reference": f"MedicationRequest/{refill_request.medication_request_id}",
                    "display": medication_name
                },
                "for": {
                    "reference": f"Patient/{refill_request.patient_id}"
                },
                "authoredOn": current_time.isoformat(),
                "lastModified": current_time.isoformat(),
                "extension": [
                    {
                        "url": f"{ExtensionURLs.BASE_URL}/task-type",
                        "valueString": "refill"
                    },
                    {
                        "url": f"{ExtensionURLs.BASE_URL}/refills-remaining",
                        "valueInteger": repeats_allowed - completed_refills - 1
                    }
                ]
            }
        
            # Add requested quantity if specified
            if refill_request.requested_quantity:
                refill_task["extension"].append({
                    "url": f"{ExtensionURLs.BASE_URL}/requested-quantity",
                    "valueQuantity": {
                        "value": refill_request.requested_quantity,
                        "unit": dispense_request.get("quantity", {}).get("unit", "units")
                    }
                })
        
            # Add reason and notes
            if refill_request.reason:
                refill_task["reasonCode"] = {
                    "text": refill_request.reason
                }
        
            if refill_request.notes:
                refill_task["note"] = [{
                    "text": refill_request.notes,
                    "time": current_time.isoformat()
                }]
        
            # Create the task in HAPI FHIR
            created_task = await hapi_client.create("Task", refill_task)
        
            logger.info(f"Created refill request Task/{created_task.get('id')} for MedicationRequest/{refill_request.medication_request_id}")
        
            return RefillResponse(
                refill_task_id=created_task.get("id"),
                medication_request_id=refill_request.medication_request_id,
                status="requested",
                message=f"Refill request created successfully. {repeats_allowed - completed_refills - 1} refills remaining after this one."
            )
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create refill request: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create refill request: {str(e)}"
            )

    async def approve_refill(self, task_id: str, decision: RefillDecision):
        """Approve a refill request and create a new MedicationRequest. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Get the refill task
            task = await hapi_client.read("Task", task_id)
            if not task:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail="Refill request not found"
                )
        
            # Verify task is in correct state
            if task.get("status") not in ["requested", "received", "accepted"]:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot approve refill in status '{task.get('status')}'"
                )
        
            # Get the original medication request
            focus_ref = task.get("focus", {}).get("reference", "")
            original_med_request_id = focus_ref.replace("MedicationRequest/", "")
        
            original_med_request = await hapi_client.read("MedicationRequest", original_med_request_id)
            if not original_med_request:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail="Original medication request not found"
                )
        
            current_time = datetime.now(timezone.utc)
        
            # Create new MedicationRequest for the refill
            new_med_request = {
                "resourceType": "MedicationRequest",
                "status": "active",
                "intent": "reflex-order",  # Indicates this is a refill
                "priority": original_med_request.get("priority", "routine"),
                "medicationCodeableConcept": original_med_request.get("medicationCodeableConcept"),
                "subject": original_med_request.get("subject"),
                "authoredOn": current_time.isoformat(),
                "requester": {
                    "reference": f"Practitioner/{decision.pharmacist_id}",
                    "display": "Pharmacist"
                },
                # FHIR R4: priorPrescription links to the original prescription
                "priorPrescription": {
                    "reference": f"MedicationRequest/{original_med_request_id}"
                },
                "dosageInstruction": original_med_request.get("dosageInstruction", []),
                "dispenseRequest": original_med_request.get("dispenseRequest", {}),
                "substitution": original_med_request.get("substitution"),
                "extension": [
                    {
                        "url": f"{ExtensionURLs.BASE_URL}/refill-of",
                        "valueReference": {
                            "reference": f"MedicationRequest/{original_med_request_id}"
                        }
                    },
                    {
                        "url": f"{ExtensionURLs.BASE_URL}/approved-by",
                        "valueReference": {
                            "reference": f"Practitioner/{decision.pharmacist_id}"
                        }
                    }
                ]
            }
        
            # Copy encounter if present
            if original_med_request.get("encounter"):
                new_med_request["encounter"] = original_med_request["encounter"]
        
            # Modify quantity if pharmacist specified different amount
            if decision.modified_quantity:
                new_med_request["dispenseRequest"]["quantity"]["value"] = decision.modified_quantity
        
            # Add pharmacist notes
            if decision.decision_notes:
                new_med_request["note"] = [{
                    "text": f"Refill approved: {decision.decision_notes}",
                    "time": current_time.isoformat()
                }]
        
            # Create the new medication request
            created_med_request = await hapi_client.create("MedicationRequest", new_med_request)
        
            # Update the task to completed
            task["status"] = "completed"
            task["businessStatus"] = {
                "coding": [{
                    "system": f"{ExtensionURLs.BASE_URL}/pharmacy/refill-status",
                    "code": "approved",
                    "display": "Approved"
                }],
                "text": "Approved"
            }
            task["lastModified"] = current_time.isoformat()
            task["output"] = [{
                "type": {
                    "text": "New MedicationRequest"
                },
                "valueReference": {
                    "reference": f"MedicationRequest/{created_med_request.get('id')}"
                }
            }]
        
            if decision.decision_notes:
                if "note" not in task:
                    task["note"] = []
                task["note"].append({
                    "text": f"Approved by pharmacist: {decision.decision_notes}",
                    "time": current_time.isoformat()
                })
        
            await hapi_client.update("Task", task_id, task)
        
            logger.info(f"Approved refill Task/{task_id}, created MedicationRequest/{created_med_request.get('id')}")
        
            return RefillResponse(
                refill_task_id=task_id,
                medication_request_id=original_med_request_id,
                status="approved",
                message="Refill approved successfully",
                new_medication_request_id=created_med_request.get("id")
            )
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to approve refill: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to approve refill: {str(e)}"
            )

    async def reject_refill(self, task_id: str, decision: RefillDecision):
        """Reject a refill request. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Get the refill task
            task = await hapi_client.read("Task", task_id)
            if not task:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail="Refill request not found"
                )
        
            # Verify task is in correct state
            if task.get("status") not in ["requested", "received", "accepted"]:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot reject refill in status '{task.get('status')}'"
                )
        
            current_time = datetime.now(timezone.utc)
        
            # Update task to rejected
            task["status"] = "rejected"
            task["businessStatus"] = {
                "coding": [{
                    "system": f"{ExtensionURLs.BASE_URL}/pharmacy/refill-status",
                    "code": "rejected",
                    "display": "Rejected"
                }],
                "text": "Rejected"
            }
            task["lastModified"] = current_time.isoformat()
        
            # Add rejection reason
            if decision.decision_notes:
                task["statusReason"] = {
                    "text": decision.decision_notes
                }
            
                if "note" not in task:
                    task["note"] = []
                task["note"].append({
                    "text": f"Rejected by pharmacist: {decision.decision_notes}",
                    "time": current_time.isoformat()
                })
        
            # Record who rejected it
            if "extension" not in task:
                task["extension"] = []
            task["extension"].append({
                "url": f"{ExtensionURLs.BASE_URL}/rejected-by",
                "valueReference": {
                    "reference": f"Practitioner/{decision.pharmacist_id}"
                }
            })
        
            await hapi_client.update("Task", task_id, task)
        
            # Get original medication request ID for response
            focus_ref = task.get("focus", {}).get("reference", "")
            original_med_request_id = focus_ref.replace("MedicationRequest/", "")
        
            logger.info(f"Rejected refill Task/{task_id}")
        
            return RefillResponse(
                refill_task_id=task_id,
                medication_request_id=original_med_request_id,
                status="rejected",
                message=f"Refill rejected: {decision.decision_notes or 'No reason provided'}"
            )
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to reject refill: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to reject refill: {str(e)}"
            )

    async def get_medication_administration_record(self, patient_id: str, date: Optional[str] = None, medication_request_id: Optional[str] = None, status: Optional[str] = None):
        """Get Medication Administration Record (MAR) for a patient. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Build search parameters
            search_params = {
                "patient": f"Patient/{patient_id}" if not patient_id.startswith("Patient/") else patient_id,
                "_sort": "-effective-time",
                "_count": 200
            }
        
            if date:
                search_params["effective-time"] = date
            if medication_request_id:
                search_params["request"] = f"MedicationRequest/{medication_request_id}"
            if status:
                search_params["status"] = status
        
            # Query HAPI FHIR for MedicationAdministration resources
            bundle = await hapi_client.search("MedicationAdministration", search_params)
        
            mar_entries = []
            for entry in bundle.get("entry", []):
                admin = entry.get("resource", {})
            
                # Extract medication name
                medication_name = (
                    admin.get("medicationCodeableConcept", {}).get("text") or
                    admin.get("medicationCodeableConcept", {}).get("coding", [{}])[0].get("display") or
                    "Unknown Medication"
                )
            
                # Extract medication request ID
                request_ref = admin.get("request", {}).get("reference", "")
                med_request_id = request_ref.replace("MedicationRequest/", "") if request_ref.startswith("MedicationRequest/") else None
            
                # Extract administered time
                administered_at = None
                if admin.get("effectiveDateTime"):
                    try:
                        administered_at = datetime.fromisoformat(admin["effectiveDateTime"].replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        pass
                elif admin.get("effectivePeriod", {}).get("start"):
                    try:
                        administered_at = datetime.fromisoformat(admin["effectivePeriod"]["start"].replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        pass
            
                # Extract performer (who administered)
                administered_by = None
                for performer in admin.get("performer", []):
                    actor_ref = performer.get("actor", {}).get("reference", "")
                    if actor_ref.startswith("Practitioner/"):
                        administered_by = performer.get("actor", {}).get("display") or actor_ref.replace("Practitioner/", "")
                        break
            
                # Extract dosage
                dosage = admin.get("dosage", {})
                dose_given = dosage.get("dose", {}).get("value")
                dose_unit = dosage.get("dose", {}).get("unit", "")
                route = dosage.get("route", {}).get("text") or dosage.get("route", {}).get("coding", [{}])[0].get("display")
            
                # Extract notes
                notes = None
                if admin.get("note"):
                    notes = admin["note"][0].get("text")
            
                mar_entries.append(MAREntry(
                    administration_id=admin.get("id"),
                    medication_request_id=med_request_id,
                    patient_id=patient_id,
                    medication_name=medication_name,
                    scheduled_time=None,  # Would come from MedicationRequest timing
                    administered_at=administered_at,
                    administered_by=administered_by,
                    dose_given=dose_given,
                    dose_unit=dose_unit,
                    route=route,
                    status=admin.get("status", "unknown"),
                    notes=notes
                ))
        
            return mar_entries
        
        except Exception as e:
            logger.error(f"Failed to get MAR: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get medication administration record: {str(e)}"
            )

    async def record_medication_administration(self, admin_request: MedicationAdministrationRequest):
        """Record a medication administration event. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Get the medication request to copy medication details
            med_request = await hapi_client.read("MedicationRequest", admin_request.medication_request_id)
            if not med_request:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail="Medication request not found"
                )

            # Same signature gate as the MAR module (ADMINISTRABLE_STATUSES in
            # administration/service.py): charting a dose against an unsigned
            # (draft) order bypasses the prescriber's signature. Without this,
            # PharmacyTab's administer dialog could chart what the MAR refuses.
            order_status = med_request.get("status")
            if order_status not in {"active", "completed"}:
                raise HTTPException(
                    status_code=http_status.HTTP_409_CONFLICT,
                    detail=(
                        f"Cannot record administration for MedicationRequest in status "
                        f"'{order_status}'. The order must be signed (status='active') first."
                    ),
                )

            current_time = admin_request.administered_at or datetime.now(timezone.utc)
        
            # Build FHIR MedicationAdministration resource
            med_admin = {
                "resourceType": "MedicationAdministration",
                "status": admin_request.status,
                "medicationCodeableConcept": med_request.get("medicationCodeableConcept"),
                "subject": {
                    "reference": f"Patient/{admin_request.patient_id}"
                },
                "effectiveDateTime": current_time.isoformat(),
                "performer": [{
                    "actor": {
                        "reference": f"Practitioner/{admin_request.administered_by}",
                        "display": "Nurse"  # Would look up actual name
                    }
                }],
                "request": {
                    "reference": f"MedicationRequest/{admin_request.medication_request_id}"
                },
                "dosage": {
                    "dose": {
                        "value": admin_request.dose_given,
                        "unit": admin_request.dose_unit,
                        "system": "http://unitsofmeasure.org",
                        "code": admin_request.dose_unit
                    }
                }
            }
        
            # Add route if provided
            if admin_request.route:
                med_admin["dosage"]["route"] = {
                    "text": admin_request.route
                }
        
            # Add site if provided
            if admin_request.site:
                med_admin["dosage"]["site"] = {
                    "text": admin_request.site
                }
        
            # Add encounter context if available from medication request
            if med_request.get("encounter"):
                med_admin["context"] = med_request["encounter"]
        
            # Handle not-done status
            if admin_request.status == "not-done":
                if not admin_request.reason_not_given:
                    raise HTTPException(
                        status_code=http_status.HTTP_400_BAD_REQUEST,
                        detail="Reason is required when medication is not given"
                    )
                med_admin["statusReason"] = [{
                    "text": admin_request.reason_not_given
                }]
        
            # Add notes if provided
            if admin_request.notes:
                med_admin["note"] = [{
                    "text": admin_request.notes,
                    "time": current_time.isoformat()
                }]
        
            # Create the resource in HAPI FHIR
            created_admin = await hapi_client.create("MedicationAdministration", med_admin)
        
            logger.info(f"Created MedicationAdministration/{created_admin.get('id')} for MedicationRequest/{admin_request.medication_request_id}")
        
            return {
                "message": "Medication administration recorded successfully",
                "administration_id": created_admin.get("id"),
                "medication_request_id": admin_request.medication_request_id,
                "status": admin_request.status,
                "administered_at": current_time.isoformat()
            }
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to record medication administration: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to record medication administration: {str(e)}"
            )

    async def get_medication_schedule(self, patient_id: str, date: Optional[str] = None):
        """Get medication administration schedule for a patient. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Default to today
            if not date:
                date = datetime.now().strftime("%Y-%m-%d")
        
            # Get active medication requests
            med_requests = await hapi_client.search("MedicationRequest", {
                "patient": f"Patient/{patient_id}",
                "status": "active",
                "_count": 100
            })
        
            # Get today's administrations
            administrations = await hapi_client.search("MedicationAdministration", {
                "patient": f"Patient/{patient_id}",
                "effective-time": date,
                "_count": 200
            })
        
            # Build administration lookup by medication request
            admin_by_request = {}
            for entry in administrations.get("entry", []):
                admin = entry.get("resource", {})
                request_ref = admin.get("request", {}).get("reference", "")
                med_request_id = request_ref.replace("MedicationRequest/", "")
                if med_request_id not in admin_by_request:
                    admin_by_request[med_request_id] = []
                admin_by_request[med_request_id].append(admin)
        
            schedule = []
            for entry in med_requests.get("entry", []):
                med_request = entry.get("resource", {})
                med_request_id = med_request.get("id")
            
                medication_name = (
                    med_request.get("medicationCodeableConcept", {}).get("text") or
                    med_request.get("medicationCodeableConcept", {}).get("coding", [{}])[0].get("display") or
                    "Unknown Medication"
                )
            
                # Parse frequency from dosage instruction
                dosage = med_request.get("dosageInstruction", [{}])[0] if med_request.get("dosageInstruction") else {}
                frequency = dosage.get("timing", {}).get("code", {}).get("text") or "As directed"
                dose_text = dosage.get("text", "")
            
                # Get administrations for this medication
                given_times = []
                for admin in admin_by_request.get(med_request_id, []):
                    if admin.get("status") == "completed":
                        admin_time = admin.get("effectiveDateTime")
                        if admin_time:
                            given_times.append(admin_time)
            
                schedule.append({
                    "medication_request_id": med_request_id,
                    "medication_name": medication_name,
                    "dose": dose_text,
                    "frequency": frequency,
                    "route": dosage.get("route", {}).get("text"),
                    "times_given_today": len(given_times),
                    "given_times": given_times,
                    "prn": dosage.get("asNeededBoolean", False)
                })
        
            return {
                "patient_id": patient_id,
                "date": date,
                "medications": schedule
            }
        
        except Exception as e:
            logger.error(f"Failed to get medication schedule: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get medication schedule: {str(e)}"
            )

def get_pharmacy_service() -> PharmacyService:
    """FastAPI dependency — one service per request."""
    return PharmacyService()
