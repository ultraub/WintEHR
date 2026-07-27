"""
Pharmacy Workflow API Router - Pure FHIR Implementation
Handles medication dispensing, status tracking, and pharmacy queue management using HAPI FHIR
"""

from fastapi import APIRouter, Depends, HTTPException, status as http_status, Query
from typing import List, Optional, Dict, Any
import logging

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
from .service import (
    PharmacyService,
    _build_pharmacy_queue_item,
    _calculate_priority,
    _extract_pharmacy_notes,
    _get_pharmacy_status,
    get_pharmacy_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/clinical/pharmacy", tags=["pharmacy"])








@router.get("/queue", response_model=List[PharmacyQueueItem])
async def get_pharmacy_queue(
    status: Optional[str] = None,
    patient_id: Optional[str] = None,
    priority: Optional[int] = None,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Get pharmacy queue with optional filtering using HAPI FHIR

    Educational notes:
    - Queries MedicationRequest resources created by orders router
    - Supports filtering by patient, status, and priority
    - Automatically prioritizes based on urgency and age
    """
    try:
        return await service.get_queue(status=status, patient_id=patient_id, priority=priority)
    except Exception as e:
        logger.error(f"Failed to retrieve pharmacy queue: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve pharmacy queue: {str(e)}"
        )


@router.post("/dispense")
async def dispense_medication(dispense_request: MedicationDispenseRequest,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Dispense medication and create MedicationDispense resource using HAPI FHIR

    Educational notes:
    - Creates complete FHIR-compliant MedicationDispense resource
    - Links to originating MedicationRequest via authorizingPrescription
    - Updates MedicationRequest status to completed
    - Tracks lot number and expiration for inventory management
    """
    return await service.dispense_medication(dispense_request=dispense_request)


@router.put("/status/{medication_request_id}")
async def update_pharmacy_status(
    medication_request_id: str,
    status_update: PharmacyStatusUpdate,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Update pharmacy workflow status for a medication request using HAPI FHIR

    Educational notes:
    - Uses FHIR extensions to track pharmacy-specific workflow status
    - Maintains audit trail of status changes with timestamps
    - Preserves standard FHIR MedicationRequest status separately
    """
    return await service.update_pharmacy_status(medication_request_id=medication_request_id, status_update=status_update)


@router.get("/metrics")
async def get_pharmacy_metrics(date_range: int = 7,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Get pharmacy workflow metrics and statistics using HAPI FHIR

    Educational notes:
    - Aggregates metrics across MedicationRequest and MedicationDispense resources
    - Calculates completion rates and status breakdowns
    - Uses FHIR search with date filtering
    """
    return await service.get_pharmacy_metrics(date_range=date_range)


@router.get("/inventory/check/{medication_code}")
async def check_medication_inventory(medication_code: str,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Check medication inventory levels (mock implementation)
    """
    return await service.check_medication_inventory(medication_code=medication_code)















@router.get("/refills", response_model=List[Dict[str, Any]])
async def get_pending_refills(
    patient_id: Optional[str] = None,
    status: str = "requested",
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Get pending refill requests using FHIR Task resources.
    
    FHIR Implementation:
    - Uses Task resources with code 'fulfill' to represent refill requests
    - Task.focus references the original MedicationRequest
    - Task.status tracks the refill workflow state
    
    Educational notes:
    - FHIR Task is the standard way to represent workflow items
    - Task.businessStatus can track pharmacy-specific states
    """
    return await service.get_pending_refills(patient_id=patient_id, status=status)


@router.post("/refills/request", response_model=RefillResponse)
async def request_refill(refill_request: RefillRequest,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Create a new refill request using FHIR Task resource.
    
    FHIR Implementation:
    - Creates a Task resource with intent 'order' and code 'fulfill'
    - Task.focus references the original MedicationRequest to be refilled
    - Task.for references the patient
    - Uses extensions to track refill-specific data
    
    Educational notes:
    - This follows the FHIR workflow pattern for pharmacy operations
    - Task resources are the standard way to request actions on other resources
    """
    return await service.request_refill(refill_request=refill_request)


@router.post("/refills/{task_id}/approve", response_model=RefillResponse)
async def approve_refill(task_id: str, decision: RefillDecision,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Approve a refill request and create a new MedicationRequest.
    
    FHIR Implementation:
    - Updates Task status to 'completed'
    - Creates a new MedicationRequest based on the original
    - Links the new request to the original via priorPrescription
    - Updates Task.output with reference to new MedicationRequest
    
    Educational notes:
    - FHIR MedicationRequest.priorPrescription links refills to originals
    - This maintains the prescription chain for audit purposes
    """
    return await service.approve_refill(task_id=task_id, decision=decision)


@router.post("/refills/{task_id}/reject", response_model=RefillResponse)
async def reject_refill(task_id: str, decision: RefillDecision,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Reject a refill request.
    
    FHIR Implementation:
    - Updates Task status to 'rejected'
    - Records rejection reason in Task.statusReason
    - Maintains audit trail via Task.note
    
    Educational notes:
    - FHIR Task.statusReason captures why a task was rejected
    - This is important for clinical documentation and appeals
    """
    return await service.reject_refill(task_id=task_id, decision=decision)


# =============================================================================
# Medication Administration Record (MAR) - FHIR MedicationAdministration
# =============================================================================





@router.get("/mar/{patient_id}", response_model=List[MAREntry])
async def get_medication_administration_record(
    patient_id: str,
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    medication_request_id: Optional[str] = Query(None, description="Filter by specific medication"),
    status: Optional[str] = Query(None, description="Filter by status"),
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Get Medication Administration Record (MAR) for a patient.
    
    FHIR Implementation:
    - Queries MedicationAdministration resources from HAPI FHIR
    - Links to MedicationRequest via request reference
    - Returns chronological administration history
    
    Educational notes:
    - FHIR MedicationAdministration tracks actual medication given
    - This is distinct from MedicationRequest (the order) and MedicationDispense (pharmacy)
    - MAR is critical for inpatient medication safety
    """
    return await service.get_medication_administration_record(patient_id=patient_id, date=date, medication_request_id=medication_request_id, status=status)


@router.post("/mar/administer", response_model=Dict[str, Any])
async def record_medication_administration(admin_request: MedicationAdministrationRequest,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Record a medication administration event.
    
    FHIR Implementation:
    - Creates MedicationAdministration resource in HAPI FHIR
    - Links to the authorizing MedicationRequest
    - Records who administered, when, and dosage details
    
    Educational notes:
    - MedicationAdministration is a key safety record
    - Status can be 'completed', 'not-done', or 'entered-in-error'
    - 'not-done' requires a reason (patient refused, held, etc.)
    """
    return await service.record_medication_administration(admin_request=admin_request)


@router.get("/mar/schedule/{patient_id}")
async def get_medication_schedule(
    patient_id: str,
    date: Optional[str] = Query(None, description="Date for schedule (YYYY-MM-DD), defaults to today"),
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    Get medication administration schedule for a patient.
    
    FHIR Implementation:
    - Queries active MedicationRequests for the patient
    - Parses timing/frequency to generate scheduled times
    - Cross-references with MedicationAdministration to show given/due status
    
    Educational notes:
    - This combines order data with administration data
    - Helps nurses see what's due and what's been given
    """
    return await service.get_medication_schedule(patient_id=patient_id, date=date)
