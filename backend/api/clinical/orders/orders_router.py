"""CPOE orders HTTP surface — thin stubs over OrdersService.

Business logic lives in service.py, models in models.py (extracted from
the original 1,567-line router; docs/ARCHITECTURE_DEBT.md opportunity #5).
Each handler parses the request via Depends and delegates; nothing else.
"""
from fastapi import APIRouter, Depends, Query
from typing import List, Optional, Dict, Any

from api.auth.service import get_current_user
from api.auth.models import User

from .models import (
    ImagingOrderCreate,
    LaboratoryOrderCreate,
    MedicationOrderCreate,
    OrderResponse,
    OrderResultSummary,
    OrderSetCreateRequest,
    OrderSetSummary,
)
from .service import OrdersService, get_orders_service

router = APIRouter(prefix="/api/clinical/orders", tags=["clinical-orders"])


@router.post("/medications", response_model=Dict[str, Any])
async def create_medication_order(
    order: MedicationOrderCreate,
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Create a new medication order using FHIR MedicationRequest.

    This endpoint:
    1. Runs medication safety checks (allergies, interactions)
    2. Creates FHIR MedicationRequest resource in HAPI FHIR
    3. Returns alerts and order confirmation

    Pure FHIR implementation - no custom database tables.
    """
    return await service.create_medication_order(order=order, current_user=current_user)


@router.post("/laboratory", response_model=OrderResponse)
async def create_laboratory_order(
    order: LaboratoryOrderCreate,
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Create a new laboratory order using FHIR ServiceRequest.

    Pure FHIR implementation - no custom database tables.
    """
    return await service.create_laboratory_order(order=order, current_user=current_user)


@router.post("/imaging", response_model=OrderResponse)
async def create_imaging_order(
    order: ImagingOrderCreate,
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Create a new imaging order using FHIR ServiceRequest.

    Pure FHIR implementation - no custom database tables.
    """
    return await service.create_imaging_order(order=order, current_user=current_user)


@router.get("/", response_model=List[OrderResponse])
async def get_orders(
    patient_id: Optional[str] = Query(None),
    encounter_id: Optional[str] = Query(None),
    order_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Get orders using FHIR search.

    Queries both MedicationRequest and ServiceRequest resources.
    Pure FHIR implementation - no custom database tables.
    """
    return await service.get_orders(patient_id=patient_id, encounter_id=encounter_id, order_type=order_type, status=status, priority=priority, skip=skip, limit=limit, current_user=current_user)


@router.get("/active", response_model=List[OrderResponse])
async def get_active_orders(
    patient_id: Optional[str] = Query(None),
    order_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """Get active orders (status=active)"""
    return await service.get_active_orders(patient_id=patient_id, order_type=order_type, current_user=current_user)


# =============================================================================
# Order-Result Linking - Bidirectional Navigation
# =============================================================================


@router.get("/{order_id}/results", response_model=OrderResultSummary)
async def get_order_results(
    order_id: str,
    resource_type: str = Query("ServiceRequest", description="ServiceRequest or MedicationRequest"),
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Get results linked to an order via FHIR basedOn reference.

    FHIR R4 Order-Result Linking:
    - DiagnosticReport.basedOn references the originating ServiceRequest
    - Observation.basedOn can also reference ServiceRequest
    - This enables bidirectional navigation between orders and results

    Educational notes:
    - FHIR R4 uses basedOn for order-result traceability
    - Results may arrive at different times (partial results)
    - Complete status is determined by result availability
    """
    return await service.get_order_results(order_id=order_id, resource_type=resource_type, current_user=current_user)


@router.put("/{order_id}/discontinue")
async def discontinue_order(
    order_id: str,
    resource_type: str = Query(..., description="MedicationRequest or ServiceRequest"),
    reason: str = Query(..., description="Reason for discontinuation"),
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Discontinue an order by updating the FHIR resource status.

    Pure FHIR implementation - updates resource in HAPI FHIR.
    """
    return await service.discontinue_order(order_id=order_id, resource_type=resource_type, reason=reason, current_user=current_user)


# =============================================================================
# Order Sets - FHIR PlanDefinition Implementation
# =============================================================================


@router.get("/order-sets/", response_model=List[OrderSetSummary])
async def get_order_sets(
    category: Optional[str] = Query(None, description="Filter by category"),
    specialty: Optional[str] = Query(None, description="Filter by specialty"),
    status: str = Query("active", description="Filter by status"),
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Get available order sets using FHIR PlanDefinition resources.
    
    FHIR Implementation:
    - Queries PlanDefinition resources from HAPI FHIR
    - PlanDefinition.type indicates this is an order-set
    - PlanDefinition.action contains the individual orders
    
    Educational notes:
    - FHIR PlanDefinition is the standard for clinical protocols and order sets
    - Each action in the PlanDefinition represents an order template
    """
    return await service.get_order_sets(category=category, specialty=specialty, status=status, current_user=current_user)


@router.get("/order-sets/{set_id}")
async def get_order_set_detail(
    set_id: str,
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Get detailed information about an order set including all items.
    
    FHIR Implementation:
    - Reads PlanDefinition resource
    - Parses action elements to extract order templates
    """
    return await service.get_order_set_detail(set_id=set_id, current_user=current_user)


@router.post("/order-sets/")
async def create_order_set(
    order_set: OrderSetCreateRequest,
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Create a new order set using FHIR PlanDefinition.
    
    FHIR Implementation:
    - Creates PlanDefinition resource with type 'order-set'
    - Each order item becomes an action element
    - Uses FHIR extensions for medication-specific details
    
    Educational notes:
    - PlanDefinition.action can be nested for complex protocols
    - Each action can reference ActivityDefinition for detailed specs
    """
    return await service.create_order_set(order_set=order_set, current_user=current_user)


@router.post("/order-sets/{set_id}/apply")
async def apply_order_set(
    set_id: str,
    patient_id: str = Query(..., description="Patient to apply orders to"),
    encounter_id: Optional[str] = Query(None, description="Encounter context"),
    current_user: User = Depends(get_current_user),
    service: OrdersService = Depends(get_orders_service),
):
    """
    Apply an order set to a patient, creating individual orders.
    
    FHIR Implementation:
    - Reads PlanDefinition and extracts actions
    - Creates MedicationRequest or ServiceRequest for each action
    - Links created resources back to the PlanDefinition via basedOn
    
    Educational notes:
    - This implements a simplified version of PlanDefinition $apply
    - In production, consider using HAPI FHIR's $apply operation if available
    """
    return await service.apply_order_set(set_id=set_id, patient_id=patient_id, encounter_id=encounter_id, current_user=current_user)
