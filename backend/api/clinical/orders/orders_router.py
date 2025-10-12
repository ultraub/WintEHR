"""Clinical orders API endpoints for CPOE"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from database import get_db_session as get_db
from models.clinical.orders import Order, MedicationOrder, LaboratoryOrder, ImagingOrder, OrderSet
from models.models import Provider, Patient
# from api.cds_hooks.cds_services import check_medication_interactions

router = APIRouter(prefix="/clinical/orders", tags=["clinical-orders"])

# Mock get_current_user dependency
async def get_current_user(db: Session = Depends(get_db)):
    """Mock function to get current user - returns first provider"""
    provider = db.query(Provider).first()
    if not provider:
        # Create a default provider if none exists
        provider = Provider(
            id="default-provider",
            first_name="Demo",
            last_name="Provider",
            npi="1234567890",
            email="provider@demo.com"
        )
        db.add(provider)
        db.commit()
    return provider


# Pydantic schemas
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

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


def get_current_user(db: Session = Depends(get_db)) -> Provider:
    """Mock function to get current user - replace with real auth"""
    provider = db.query(Provider).first()
    if not provider:
        raise HTTPException(status_code=404, detail="No provider found")
    return provider


async def check_medication_cds(
    patient_id: str,
    medication: MedicationDetails,
    db: Session
) -> List[Dict[str, Any]]:
    """Check for medication alerts using CDS"""
    # Get patient data
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        return []
    
    # Check for drug interactions
    alerts = []
    
    # Check allergies
    allergies = patient.allergies
    for allergy in allergies:
        if medication.medication_name.lower() in allergy.allergen.lower():
            alerts.append({
                "severity": "high",
                "type": "allergy",
                "message": f"Patient has documented allergy to {allergy.allergen}"
            })
    
    # Check current medications for interactions
    current_meds = db.query(MedicationOrder).join(Order).filter(
        Order.patient_id == patient_id,
        Order.status == "active"
    ).all()
    
    # Simplified interaction check - in production, use a drug database
    interaction_pairs = {
        ("warfarin", "aspirin"): "Increased bleeding risk",
        ("metformin", "contrast"): "Risk of lactic acidosis",
    }
    
    for current_med in current_meds:
        for (drug1, drug2), message in interaction_pairs.items():
            if (drug1 in medication.medication_name.lower() and drug2 in current_med.medication_name.lower()) or \
               (drug2 in medication.medication_name.lower() and drug1 in current_med.medication_name.lower()):
                alerts.append({
                    "severity": "medium",
                    "type": "drug_interaction",
                    "message": f"Interaction with {current_med.medication_name}: {message}"
                })
    
    return alerts


@router.post("/medications", response_model=Dict[str, Any])
async def create_medication_order(
    order: MedicationOrderCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new medication order"""
    # Create base order
    base_order = Order(
        patient_id=order.patient_id,
        encounter_id=order.encounter_id,
        ordering_provider_id=current_user.id,
        order_type="medication",
        order_date=datetime.utcnow(),
        priority=order.priority,
        indication=order.indication,
        clinical_information=order.clinical_information,
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(base_order)
    db.flush()
    
    # Create medication-specific order
    med_order = MedicationOrder(
        order_id=base_order.id,
        **order.medication_details.dict()
    )
    db.add(med_order)
    
    # Run CDS checks
    alerts = await check_medication_cds(
        patient_id=order.patient_id,
        medication=order.medication_details,
        db=db
    )
    
    if alerts and not order.override_alerts:
        db.rollback()
        return {"alerts": alerts, "order_saved": False}
    
    # If overriding alerts, save them
    if alerts and order.override_alerts:
        med_order.override_alerts = alerts
    
    db.commit()
    db.refresh(base_order)
    
    return {
        "order": OrderResponse.from_orm(base_order),
        "alerts": alerts,
        "order_saved": True
    }


@router.post("/laboratory", response_model=OrderResponse)
async def create_laboratory_order(
    order: LaboratoryOrderCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new laboratory order"""
    # Create base order
    base_order = Order(
        patient_id=order.patient_id,
        encounter_id=order.encounter_id,
        ordering_provider_id=current_user.id,
        order_type="laboratory",
        order_date=datetime.utcnow(),
        priority=order.priority,
        indication=order.indication,
        clinical_information=order.clinical_information,
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(base_order)
    db.flush()
    
    # Create laboratory-specific order
    lab_order = LaboratoryOrder(
        order_id=base_order.id,
        **order.laboratory_details.dict()
    )
    db.add(lab_order)
    
    db.commit()
    db.refresh(base_order)
    
    return base_order


@router.post("/imaging", response_model=OrderResponse)
async def create_imaging_order(
    order: ImagingOrderCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new imaging order"""
    # Create base order
    base_order = Order(
        patient_id=order.patient_id,
        encounter_id=order.encounter_id,
        ordering_provider_id=current_user.id,
        order_type="imaging",
        order_date=datetime.utcnow(),
        priority=order.priority,
        indication=order.indication,
        clinical_information=order.clinical_information,
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(base_order)
    db.flush()
    
    # Create imaging-specific order
    imaging_order = ImagingOrder(
        order_id=base_order.id,
        **order.imaging_details.dict()
    )
    db.add(imaging_order)
    
    db.commit()
    db.refresh(base_order)
    
    return base_order


@router.get("/", response_model=List[OrderResponse])
async def get_orders(
    patient_id: Optional[str] = Query(None),
    encounter_id: Optional[str] = Query(None),
    order_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get orders with filters"""
    query = db.query(Order)
    
    if patient_id:
        query = query.filter(Order.patient_id == patient_id)
    if encounter_id:
        query = query.filter(Order.encounter_id == encounter_id)
    if order_type:
        query = query.filter(Order.order_type == order_type)
    if status:
        query = query.filter(Order.status == status)
    if priority:
        query = query.filter(Order.priority == priority)
    
    return query.order_by(Order.order_date.desc()).offset(skip).limit(limit).all()


@router.get("/active", response_model=List[OrderResponse])
async def get_active_orders(
    patient_id: Optional[str] = Query(None),
    order_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get active orders"""
    query = db.query(Order).filter(
        Order.status.in_(["pending", "active"])
    )
    
    if patient_id:
        query = query.filter(Order.patient_id == patient_id)
    if order_type:
        query = query.filter(Order.order_type == order_type)
    
    return query.order_by(Order.order_date.desc()).all()


@router.put("/{order_id}/discontinue")
async def discontinue_order(
    order_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Discontinue an order"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status not in ["pending", "active"]:
        raise HTTPException(status_code=400, detail="Order cannot be discontinued")
    
    order.status = "discontinued"
    order.discontinued_at = datetime.utcnow()
    order.discontinued_by_id = current_user.id
    order.discontinue_reason = reason
    order.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Order discontinued successfully"}


# Order Sets
@router.get("/order-sets/", response_model=List[OrderSetResponse])
async def get_order_sets(
    category: Optional[str] = Query(None),
    specialty: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get available order sets"""
    query = db.query(OrderSet).filter(OrderSet.is_active == True)
    
    if category:
        query = query.filter(OrderSet.category == category)
    if specialty:
        query = query.filter(OrderSet.specialty == specialty)
    
    return query.all()


@router.post("/order-sets/", response_model=OrderSetResponse)
async def create_order_set(
    order_set: OrderSetCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new order set"""
    db_order_set = OrderSet(
        **order_set.dict(),
        created_by=current_user.id,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(db_order_set)
    db.commit()
    db.refresh(db_order_set)
    
    return db_order_set


@router.post("/order-sets/{set_id}/apply")
async def apply_order_set(
    set_id: str,
    patient_id: str,
    encounter_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Apply a predefined order set"""
    order_set = db.query(OrderSet).filter(
        OrderSet.id == set_id,
        OrderSet.is_active == True
    ).first()
    
    if not order_set:
        raise HTTPException(status_code=404, detail="Order set not found")
    
    created_orders = []
    
    for order_template in order_set.orders:
        # Create order based on template
        order_type = order_template.get("order_type")
        
        if order_type == "medication":
            # Create medication order
            order_data = MedicationOrderCreate(
                patient_id=patient_id,
                encounter_id=encounter_id,
                order_type="medication",
                priority=order_template.get("priority", "routine"),
                indication=order_template.get("indication"),
                medication_details=MedicationDetails(**order_template.get("details", {}))
            )
            result = await create_medication_order(order_data, db, current_user)
            if result.get("order_saved"):
                created_orders.append(result["order"])
        
        elif order_type == "laboratory":
            # Create laboratory order
            order_data = LaboratoryOrderCreate(
                patient_id=patient_id,
                encounter_id=encounter_id,
                order_type="laboratory",
                priority=order_template.get("priority", "routine"),
                indication=order_template.get("indication"),
                laboratory_details=LaboratoryDetails(**order_template.get("details", {}))
            )
            order = await create_laboratory_order(order_data, db, current_user)
            created_orders.append(order)
    
    return {
        "message": f"Applied order set: {order_set.name}",
        "orders_created": len(created_orders),
        "orders": created_orders
    }