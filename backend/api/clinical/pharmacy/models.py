"""
Pharmacy request/response models.

Extracted from pharmacy_router.py, which held its HTTP surface, its
Pydantic models, and all of its business logic in one 1,526-line file
(docs/ARCHITECTURE_DEBT.md §F4). Models live here so the router and the
service can both use them without either importing the other.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


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


class RefillRequest(BaseModel):
    """Request model for medication refill"""
    medication_request_id: str
    patient_id: str
    reason: Optional[str] = None
    requested_quantity: Optional[float] = None
    notes: Optional[str] = None


class RefillDecision(BaseModel):
    """Request model for refill approval/rejection"""
    pharmacist_id: str
    decision_notes: Optional[str] = None
    modified_quantity: Optional[float] = None


class RefillResponse(BaseModel):
    """Response model for refill operations"""
    refill_task_id: str
    medication_request_id: str
    status: str
    message: str
    new_medication_request_id: Optional[str] = None


class MedicationAdministrationRequest(BaseModel):
    """Request model for recording medication administration"""
    medication_request_id: str
    patient_id: str
    administered_by: str  # Practitioner ID
    administered_at: Optional[datetime] = None
    dose_given: float
    dose_unit: str
    route: Optional[str] = None
    site: Optional[str] = None
    status: str = "completed"  # completed, not-done, entered-in-error
    reason_not_given: Optional[str] = None  # If status is 'not-done'
    notes: Optional[str] = None


class MAREntry(BaseModel):
    """Model for a MAR entry"""
    administration_id: str
    medication_request_id: str
    patient_id: str
    medication_name: str
    scheduled_time: Optional[datetime]
    administered_at: Optional[datetime]
    administered_by: Optional[str]
    dose_given: Optional[float]
    dose_unit: Optional[str]
    route: Optional[str]
    status: str
    notes: Optional[str]
