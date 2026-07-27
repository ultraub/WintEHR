"""
CPOE order request/response models.

Extracted from orders_router.py (one 1,567-line file holding HTTP surface,
14 model classes, and all business logic — docs/ARCHITECTURE_DEBT.md F4).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class MedicationDetails(BaseModel):
    medication_name: str
    medication_code: Optional[str] = None
    dose: float
    dose_unit: str
    route: str
    frequency: str
    duration: Optional[str] = None
    prn: bool = False
    prn_reason: Optional[str] = None
    dispense_quantity: Optional[int] = None
    dispense_unit: Optional[str] = None
    refills: int = 0
    generic_allowed: bool = True
    pharmacy_notes: Optional[str] = None


class LaboratoryDetails(BaseModel):
    test_name: str
    test_code: Optional[str] = None
    specimen_type: Optional[str] = None
    specimen_source: Optional[str] = None
    collection_datetime: Optional[datetime] = None
    fasting_required: bool = False
    special_instructions: Optional[str] = None


class ImagingDetails(BaseModel):
    modality: str
    body_site: Optional[str] = None
    laterality: Optional[str] = None
    contrast: bool = False
    reason_for_exam: Optional[str] = None
    transport_mode: Optional[str] = "ambulatory"
    preferred_datetime: Optional[datetime] = None


class OrderCreate(BaseModel):
    patient_id: str
    encounter_id: Optional[str] = None
    order_type: str  # medication, laboratory, imaging, procedure
    priority: str = "routine"  # routine, urgent, stat
    indication: Optional[str] = None
    clinical_information: Optional[str] = None


class MedicationOrderCreate(OrderCreate):
    medication_details: MedicationDetails
    override_alerts: bool = False


class LaboratoryOrderCreate(OrderCreate):
    laboratory_details: LaboratoryDetails


class ImagingOrderCreate(OrderCreate):
    imaging_details: ImagingDetails


class OrderResponse(BaseModel):
    id: str
    patient_id: str
    encounter_id: Optional[str]
    ordering_provider_id: str
    order_type: str
    order_date: datetime
    priority: str
    status: str
    indication: Optional[str]
    clinical_information: Optional[str]
    created_at: datetime
    updated_at: datetime


class OrderSetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    specialty: Optional[str] = None
    orders: List[Dict[str, Any]]


class OrderSetResponse(OrderSetCreate):
    id: str
    created_by: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class OrderResultSummary(BaseModel):
    """Summary of results linked to an order"""
    order_id: str
    order_type: str  # ServiceRequest or MedicationRequest
    has_results: bool
    diagnostic_reports: List[Dict[str, Any]] = []
    observations: List[Dict[str, Any]] = []
    total_results: int = 0
    result_status: str = "pending"  # pending, partial, complete


class OrderSetItem(BaseModel):
    """Individual item within an order set"""
    order_type: str  # medication, laboratory, imaging
    display: str
    code: Optional[str] = None
    code_system: Optional[str] = None
    priority: str = "routine"
    # Medication-specific
    dose: Optional[float] = None
    dose_unit: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    # Lab/Imaging-specific
    reason: Optional[str] = None
    instructions: Optional[str] = None


class OrderSetCreateRequest(BaseModel):
    """Request to create an order set"""
    name: str
    description: Optional[str] = None
    category: Optional[str] = None  # e.g., "admission", "discharge", "procedure"
    specialty: Optional[str] = None  # e.g., "cardiology", "oncology"
    items: List[OrderSetItem]


class OrderSetSummary(BaseModel):
    """Summary of an order set"""
    id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    specialty: Optional[str]
    item_count: int
    status: str
    last_updated: Optional[datetime]
