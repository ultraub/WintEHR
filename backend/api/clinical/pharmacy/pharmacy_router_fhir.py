"""
Pharmacy Workflow API Router - HAPI FHIR Migration
Handles medication dispensing, status tracking, and pharmacy queue management using fhirclient
"""

from fastapi import APIRouter, HTTPException, status as http_status
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import uuid
import logging

from services.fhir_client_config import (
    search_resources,
    get_resource,
    create_resource,
    update_resource
)
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/clinical/pharmacy", tags=["pharmacy"])


class MedicationDispenseRequest(BaseModel):
    """Request model for medication dispensing"""
    medication_request_id: str
    quantity: float
    lot_number: str
    expiration_date: str
    pharmacist_notes: Optional[str] = None
    pharmacist_id: Optional[str] = None


class PharmacyStatusUpdate(BaseModel):
    """Request model for pharmacy status updates"""
    status: str  # pending, verified, dispensed, ready, completed
    notes: Optional[str] = None
    updated_by: Optional[str] = None


class PharmacyQueueItem(BaseModel):
    """Pharmacy queue item model"""
    medication_request_id: str
    patient_id: str
    patient_name: Optional[str] = None
    medication_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    status: str
    priority: int
    prescribed_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    prescriber: Optional[str] = None
    pharmacy_notes: Optional[str] = None


@router.get("/queue", response_model=List[PharmacyQueueItem])
async def get_pharmacy_queue(
    status: Optional[str] = None,
    patient_id: Optional[str] = None,
    priority: Optional[int] = None
):
    """
    Get pharmacy queue with optional filtering using HAPI FHIR
    """
    try:
        # Build search parameters
        search_params = {}
        if patient_id:
            search_params['patient'] = patient_id
        if status:
            search_params['status'] = status

        # Get medication requests from HAPI FHIR
        med_requests = search_resources('MedicationRequest', search_params)

        queue_items = []
        for resource in med_requests:
            # Convert fhirclient resource to dict
            resource_dict = resource.as_json()

            # Extract pharmacy queue information
            queue_item = _build_pharmacy_queue_item(resource_dict)

            # Apply additional filters
            if priority and queue_item.priority != priority:
                continue

            queue_items.append(queue_item)

        # Sort by priority and date
        queue_items.sort(key=lambda x: (
            x.priority,
            x.prescribed_date or datetime.min.replace(tzinfo=timezone.utc)
        ))

        return queue_items

    except Exception as e:
        logger.error(f"Failed to retrieve pharmacy queue: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve pharmacy queue: {str(e)}"
        )


@router.post("/dispense")
async def dispense_medication(dispense_request: MedicationDispenseRequest):
    """
    Dispense medication and create MedicationDispense resource using HAPI FHIR
    """
    try:
        # Get the medication request from HAPI FHIR
        med_request = get_resource('MedicationRequest', dispense_request.medication_request_id)
        if not med_request:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Medication request not found"
            )

        # Convert to dict
        med_request_dict = med_request.as_json()

        # Create complete MedicationDispense FHIR resource
        dispense_id = str(uuid.uuid4())
        current_time = datetime.now(timezone.utc)

        from fhirclient.models.medicationdispense import MedicationDispense
        from fhirclient.models.codeableconcept import CodeableConcept
        from fhirclient.models.reference import Reference
        from fhirclient.models.quantity import Quantity
        from fhirclient.models.annotation import Annotation
        from fhirclient.models.meta import Meta
        from fhirclient.models.identifier import Identifier

        # Build MedicationDispense using fhirclient models
        dispense = MedicationDispense()
        dispense.id = dispense_id

        # Meta
        meta = Meta()
        meta.versionId = "1"
        meta.lastUpdated = current_time.isoformat()
        meta.profile = ["http://hl7.org/fhir/StructureDefinition/MedicationDispense"]
        dispense.meta = meta

        # Identifier
        identifier = Identifier()
        identifier.system = "http://example.org/pharmacy/dispense-id"
        identifier.value = f"DISP-{dispense_id[:8].upper()}"
        dispense.identifier = [identifier]

        # Status
        dispense.status = "completed"

        # Medication
        if hasattr(med_request, 'medicationCodeableConcept'):
            dispense.medicationCodeableConcept = med_request.medicationCodeableConcept

        # Subject and context
        if hasattr(med_request, 'subject'):
            dispense.subject = med_request.subject

        if hasattr(med_request, 'encounter'):
            dispense.context = med_request.encounter

        # Performer (pharmacist)
        from fhirclient.models.medicationdispense import MedicationDispensePerformer
        performer = MedicationDispensePerformer()
        actor_ref = Reference()
        actor_ref.reference = f"Practitioner/{dispense_request.pharmacist_id or 'default-pharmacist'}"
        actor_ref.display = "Pharmacist"
        performer.actor = actor_ref
        dispense.performer = [performer]

        # Authorizing prescription
        auth_ref = Reference()
        auth_ref.reference = f"MedicationRequest/{dispense_request.medication_request_id}"
        dispense.authorizingPrescription = [auth_ref]

        # Type
        from fhirclient.models.coding import Coding
        type_concept = CodeableConcept()
        type_coding = Coding()
        type_coding.system = "http://terminology.hl7.org/CodeSystem/v3-ActCode"
        type_coding.code = "FF"
        type_coding.display = "First Fill"
        type_concept.coding = [type_coding]
        dispense.type = type_concept

        # Quantity
        quantity = Quantity()
        quantity.value = dispense_request.quantity
        if hasattr(med_request, 'dispenseRequest') and med_request.dispenseRequest:
            if hasattr(med_request.dispenseRequest, 'quantity') and med_request.dispenseRequest.quantity:
                quantity.unit = med_request.dispenseRequest.quantity.unit or 'units'
            else:
                quantity.unit = 'units'
        else:
            quantity.unit = 'units'
        quantity.system = "http://unitsofmeasure.org"
        dispense.quantity = quantity

        # Days supply
        days_supply = Quantity()
        days_supply.value = 30
        days_supply.unit = "days"
        days_supply.system = "http://unitsofmeasure.org"
        days_supply.code = "d"
        dispense.daysSupply = days_supply

        # When prepared/handed over
        from fhirclient.models.fhirdate import FHIRDate
        dispense.whenPrepared = FHIRDate(current_time.isoformat())
        dispense.whenHandedOver = FHIRDate(current_time.isoformat())

        # Dosage instruction
        if hasattr(med_request, 'dosageInstruction'):
            dispense.dosageInstruction = med_request.dosageInstruction

        # Notes
        if dispense_request.pharmacist_notes:
            note = Annotation()
            note.text = dispense_request.pharmacist_notes
            note.time = FHIRDate(datetime.now().isoformat())
            dispense.note = [note]

        # Create the dispense resource in HAPI FHIR
        created_dispense = create_resource(dispense)

        # Update medication request status to completed
        med_request.status = "completed"

        # Add dispense event reference
        if not hasattr(med_request, 'dispenseRequest') or not med_request.dispenseRequest:
            from fhirclient.models.medicationrequest import MedicationRequestDispenseRequest
            med_request.dispenseRequest = MedicationRequestDispenseRequest()

        # Note: dispenseEvent is not a standard FHIR field in MedicationRequest.dispenseRequest
        # We'll track this relationship through the MedicationDispense.authorizingPrescription

        # Update the medication request
        update_resource(med_request)

        return {
            "message": "Medication dispensed successfully",
            "dispense_id": created_dispense.id,
            "medication_request_id": dispense_request.medication_request_id
        }

    except Exception as e:
        logger.error(f"Failed to dispense medication: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to dispense medication: {str(e)}"
        )


@router.put("/status/{medication_request_id}")
async def update_pharmacy_status(
    medication_request_id: str,
    status_update: PharmacyStatusUpdate
):
    """
    Update pharmacy workflow status for a medication request using HAPI FHIR
    """
    logger.info(f"Updating pharmacy status for MedicationRequest ID: {medication_request_id}")
    logger.info(f"New status: {status_update.status}")

    try:
        # Get the medication request from HAPI FHIR
        med_request = get_resource('MedicationRequest', medication_request_id)
        if not med_request:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Medication request not found"
            )

        # Update pharmacy status using extension
        from fhirclient.models.extension import Extension

        # Find or create pharmacy status extension
        if not hasattr(med_request, 'extension') or not med_request.extension:
            med_request.extension = []

        pharmacy_ext = None
        for ext in med_request.extension:
            if ext.url == 'http://wintehr.com/fhir/StructureDefinition/pharmacy-status':
                pharmacy_ext = ext
                break

        if not pharmacy_ext:
            pharmacy_ext = Extension()
            pharmacy_ext.url = 'http://wintehr.com/fhir/StructureDefinition/pharmacy-status'
            pharmacy_ext.extension = []
            med_request.extension.append(pharmacy_ext)

        # Update status extension
        pharmacy_ext.extension = []

        status_ext = Extension()
        status_ext.url = "status"
        status_ext.valueString = status_update.status
        pharmacy_ext.extension.append(status_ext)

        timestamp_ext = Extension()
        timestamp_ext.url = "lastUpdated"
        timestamp_ext.valueDateTime = datetime.now().isoformat()
        pharmacy_ext.extension.append(timestamp_ext)

        if status_update.updated_by:
            updated_by_ext = Extension()
            updated_by_ext.url = "updatedBy"
            updated_by_ext.valueString = status_update.updated_by
            pharmacy_ext.extension.append(updated_by_ext)

        # Add notes if provided
        if status_update.notes:
            from fhirclient.models.annotation import Annotation
            note = Annotation()
            note.text = f"Pharmacy: {status_update.notes}"
            note.time = datetime.now().isoformat()

            if not hasattr(med_request, 'note') or not med_request.note:
                med_request.note = []
            med_request.note.append(note)

        # Update the resource in HAPI FHIR
        update_resource(med_request)

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


@router.get("/metrics")
async def get_pharmacy_metrics(date_range: int = 7):  # days
    """
    Get pharmacy workflow metrics and statistics using HAPI FHIR
    """
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=date_range)

        # Get medication requests in date range
        search_params = {
            'date': f"ge{start_date.strftime('%Y-%m-%d')}"
        }

        med_requests = search_resources('MedicationRequest', search_params)

        # Calculate metrics
        total_requests = len(med_requests)

        status_counts = {}
        pharmacy_status_counts = {}

        for request in med_requests:
            request_dict = request.as_json()

            # Medication request status
            req_status = request_dict.get('status', 'unknown')
            status_counts[req_status] = status_counts.get(req_status, 0) + 1

            # Pharmacy status (from extension)
            pharmacy_status = _get_pharmacy_status(request_dict)
            pharmacy_status_counts[pharmacy_status] = pharmacy_status_counts.get(pharmacy_status, 0) + 1

        # Get dispensed medications
        dispense_search_params = {
            'whenhandedover': f"ge{start_date.strftime('%Y-%m-%d')}"
        }
        dispense_resources = search_resources('MedicationDispense', dispense_search_params)
        dispensed_count = len(dispense_resources)

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


@router.get("/inventory/check/{medication_code}")
async def check_medication_inventory(medication_code: str):
    """
    Check medication inventory levels (mock implementation)
    """
    # This would integrate with actual pharmacy inventory system
    # For demo purposes, return mock data

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
        except:
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
        if ext.get('url') == 'http://wintehr.com/fhir/StructureDefinition/pharmacy-status':
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
        except:
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
        except:
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
