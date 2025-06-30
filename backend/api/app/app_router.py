"""Application-specific API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, date, timedelta
import uuid

from database.database import get_db
from models.models import Patient, Encounter, Provider, Organization, Observation, Condition, Medication
from ..auth import get_current_user_optional
from .schemas import (
    PatientCreate, PatientUpdate, PatientResponse,
    EncounterCreate, EncounterResponse,
    ObservationCreate, ObservationResponse,
    ConditionCreate, ConditionResponse,
    MedicationCreate, MedicationResponse,
    ProviderResponse, LocationResponse
)

router = APIRouter()

# Patient endpoints
@router.get("/patients", response_model=List[PatientResponse])
async def list_patients(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """List all patients with optional search"""
    query = db.query(Patient)
    
    if search:
        search_filter = or_(
            Patient.first_name.ilike(f"%{search}%"),
            Patient.last_name.ilike(f"%{search}%"),
            Patient.mrn.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    patients = query.offset(skip).limit(limit).all()
    return patients

@router.get("/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: str, db: Session = Depends(get_db)):
    """Get a specific patient"""
    from sqlalchemy.orm import joinedload
    
    patient = db.query(Patient).options(
        joinedload(Patient.conditions),
        joinedload(Patient.medications),
        joinedload(Patient.allergies)
    ).filter(Patient.id == patient_id).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.post("/patients", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    """Create a new patient"""
    db_patient = Patient(
        id=str(uuid.uuid4()),
        mrn=f"MRN{datetime.now().strftime('%Y%m%d%H%M%S')}",
        **patient.dict()
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.put("/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    patient: PatientUpdate,
    db: Session = Depends(get_db)
):
    """Update a patient"""
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    for field, value in patient.dict(exclude_unset=True).items():
        setattr(db_patient, field, value)
    
    db.commit()
    db.refresh(db_patient)
    return db_patient

# Encounter endpoints
@router.get("/encounters")
async def list_encounters(
    patient_id: Optional[str] = Query(None),
    provider_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """List encounters with filters"""
    query = db.query(Encounter)
    
    if patient_id:
        query = query.filter(Encounter.patient_id == patient_id)
    if provider_id:
        query = query.filter(Encounter.provider_id == provider_id)
    if date_from:
        query = query.filter(Encounter.encounter_date >= date_from)
    if date_to:
        query = query.filter(Encounter.encounter_date <= date_to)
    
    encounters = query.order_by(Encounter.encounter_date.desc()).offset(skip).limit(limit).all()
    return encounters

@router.get("/encounters/{encounter_id}", response_model=EncounterResponse)
async def get_encounter(encounter_id: str, db: Session = Depends(get_db)):
    """Get a specific encounter"""
    encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter

@router.post("/encounters", response_model=EncounterResponse)
async def create_encounter(encounter: EncounterCreate, db: Session = Depends(get_db)):
    """Create a new encounter"""
    db_encounter = Encounter(
        id=str(uuid.uuid4()),
        **encounter.dict()
    )
    db.add(db_encounter)
    db.commit()
    db.refresh(db_encounter)
    return db_encounter

@router.put("/encounters/{encounter_id}", response_model=EncounterResponse)
async def update_encounter(
    encounter_id: str,
    encounter_data: dict,
    db: Session = Depends(get_db)
):
    """Update an encounter (especially clinical notes)"""
    db_encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not db_encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    
    # Allow updating specific fields
    allowed_fields = ["notes", "chief_complaint", "status"]
    for field in allowed_fields:
        if field in encounter_data:
            setattr(db_encounter, field, encounter_data[field])
    
    db.commit()
    db.refresh(db_encounter)
    return db_encounter

# Observation endpoints
@router.get("/observations", response_model=List[ObservationResponse])
async def list_observations(
    patient_id: Optional[str] = Query(None),
    encounter_id: Optional[str] = Query(None),
    observation_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """List observations with filters"""
    query = db.query(Observation)
    
    if patient_id:
        query = query.filter(Observation.patient_id == patient_id)
    if encounter_id:
        query = query.filter(Observation.encounter_id == encounter_id)
    if observation_type:
        query = query.filter(Observation.observation_type == observation_type)
    
    observations = query.order_by(Observation.observation_date.desc()).offset(skip).limit(limit).all()
    return observations

@router.post("/observations", response_model=ObservationResponse)
async def create_observation(observation: ObservationCreate, db: Session = Depends(get_db)):
    """Create a new observation"""
    # Determine interpretation based on reference ranges
    interpretation = "Normal"
    if observation.value_quantity is not None:
        if observation.reference_range_low and observation.value_quantity < observation.reference_range_low:
            interpretation = "Low"
        elif observation.reference_range_high and observation.value_quantity > observation.reference_range_high:
            interpretation = "High"
    
    db_observation = Observation(
        id=str(uuid.uuid4()),
        interpretation=interpretation,
        **observation.dict()
    )
    db.add(db_observation)
    db.commit()
    db.refresh(db_observation)
    return db_observation

# Condition endpoints
@router.get("/conditions")
async def list_conditions(
    patient_id: Optional[str] = Query(None),
    clinical_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """List conditions with filters"""
    query = db.query(Condition)
    
    if patient_id:
        query = query.filter(Condition.patient_id == patient_id)
    if clinical_status:
        query = query.filter(Condition.clinical_status == clinical_status)
    
    conditions = query.order_by(Condition.recorded_date.desc()).offset(skip).limit(limit).all()
    return conditions

@router.post("/conditions", response_model=ConditionResponse)
async def create_condition(condition: ConditionCreate, db: Session = Depends(get_db)):
    """Create a new condition"""
    db_condition = Condition(
        id=str(uuid.uuid4()),
        recorded_date=datetime.now(),
        **condition.dict()
    )
    db.add(db_condition)
    db.commit()
    db.refresh(db_condition)
    return db_condition

@router.put("/conditions/{condition_id}", response_model=ConditionResponse)
async def update_condition(
    condition_id: str,
    condition_data: dict,
    db: Session = Depends(get_db)
):
    """Update a condition"""
    db_condition = db.query(Condition).filter(Condition.id == condition_id).first()
    if not db_condition:
        raise HTTPException(status_code=404, detail="Condition not found")
    
    # Allow updating specific fields
    allowed_fields = ["clinical_status", "verification_status", "description"]
    for field in allowed_fields:
        if field in condition_data:
            setattr(db_condition, field, condition_data[field])
    
    db.commit()
    db.refresh(db_condition)
    return db_condition

@router.delete("/conditions/{condition_id}")
async def delete_condition(
    condition_id: str,
    db: Session = Depends(get_db)
):
    """Delete a condition"""
    db_condition = db.query(Condition).filter(Condition.id == condition_id).first()
    if not db_condition:
        raise HTTPException(status_code=404, detail="Condition not found")
    
    db.delete(db_condition)
    db.commit()
    return {"message": "Condition deleted successfully"}

# Medication endpoints
@router.get("/medications", response_model=List[MedicationResponse])
async def list_medications(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """List medications with filters"""
    query = db.query(Medication)
    
    if patient_id:
        query = query.filter(Medication.patient_id == patient_id)
    if status:
        query = query.filter(Medication.status == status)
    
    medications = query.order_by(Medication.start_date.desc()).offset(skip).limit(limit).all()
    return medications

@router.post("/medications", response_model=MedicationResponse)
async def create_medication(medication: MedicationCreate, db: Session = Depends(get_db)):
    """Create a new medication"""
    db_medication = Medication(
        id=str(uuid.uuid4()),
        **medication.dict()
    )
    db.add(db_medication)
    db.commit()
    db.refresh(db_medication)
    return db_medication

@router.put("/medications/{medication_id}", response_model=MedicationResponse)
async def update_medication(
    medication_id: str,
    medication_data: dict,
    db: Session = Depends(get_db)
):
    """Update a medication"""
    db_medication = db.query(Medication).filter(Medication.id == medication_id).first()
    if not db_medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # Allow updating specific fields
    allowed_fields = ["status", "dosage", "frequency", "end_date"]
    for field in allowed_fields:
        if field in medication_data:
            # Handle date fields specially
            if field == "end_date" and medication_data[field]:
                setattr(db_medication, field, datetime.fromisoformat(medication_data[field]).date())
            else:
                setattr(db_medication, field, medication_data[field])
    
    db.commit()
    db.refresh(db_medication)
    return db_medication

@router.delete("/medications/{medication_id}")
async def delete_medication(
    medication_id: str,
    db: Session = Depends(get_db)
):
    """Delete a medication"""
    db_medication = db.query(Medication).filter(Medication.id == medication_id).first()
    if not db_medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    db.delete(db_medication)
    db.commit()
    return {"message": "Medication deleted successfully"}

# Provider endpoints
@router.get("/providers", response_model=List[ProviderResponse])
async def list_providers(
    specialty: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """List providers with filters"""
    query = db.query(Provider)
    
    if specialty:
        query = query.filter(Provider.specialty == specialty)
    if active is not None:
        query = query.filter(Provider.active == active)
    
    providers = query.offset(skip).limit(limit).all()
    return providers

@router.get("/providers/{provider_id}", response_model=ProviderResponse)
async def get_provider(provider_id: str, db: Session = Depends(get_db)):
    """Get a specific provider"""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider

# Organization/Location endpoints
@router.get("/locations", response_model=List[LocationResponse])
async def list_locations(
    location_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """List locations/organizations with filters"""
    query = db.query(Organization)
    
    if location_type:
        query = query.filter(Organization.type == location_type)
    
    locations = query.offset(skip).limit(limit).all()
    return locations

@router.get("/locations/{location_id}", response_model=LocationResponse)
async def get_location(location_id: str, db: Session = Depends(get_db)):
    """Get a specific location/organization"""
    location = db.query(Organization).filter(Organization.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location

# Dashboard/Analytics endpoints
@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: Optional[Provider] = Depends(get_current_user_optional)
):
    """Get dashboard statistics"""
    total_patients = db.query(Patient).count()
    total_encounters = db.query(Encounter).count()
    total_providers = db.query(Provider).filter(Provider.active == True).count()
    
    # Recent activity
    recent_encounters = db.query(Encounter).filter(
        Encounter.encounter_date >= datetime.now() - timedelta(days=7)
    ).count()
    
    # Common conditions
    common_conditions = db.query(
        Condition.description,
        db.query(Condition).filter(Condition.description == Condition.description).count()
    ).group_by(Condition.description).limit(5).all()
    
    result = {
        "total_patients": total_patients,
        "total_encounters": total_encounters,
        "active_providers": total_providers,
        "recent_encounters": recent_encounters,
        "common_conditions": [
            {"name": desc, "count": count} for desc, count in common_conditions
        ]
    }
    
    # Add provider-specific stats if logged in
    if current_user:
        from models.session import PatientProviderAssignment
        my_patients = db.query(PatientProviderAssignment).filter(
            PatientProviderAssignment.provider_id == current_user.id,
            PatientProviderAssignment.is_active == True
        ).count()
        result["my_patients"] = my_patients
    
    return result

@router.get("/dashboard/recent-activity")
async def get_recent_activity(db: Session = Depends(get_db)):
    """Get recent activity for dashboard"""
    recent_encounters = db.query(Encounter).order_by(
        Encounter.created_at.desc()
    ).limit(10).all()
    
    activities = []
    for encounter in recent_encounters:
        patient = db.query(Patient).filter(Patient.id == encounter.patient_id).first()
        provider = db.query(Provider).filter(Provider.id == encounter.provider_id).first()
        
        activities.append({
            "type": "encounter",
            "timestamp": encounter.created_at,
            "description": f"{patient.first_name} {patient.last_name} - {encounter.encounter_type}",
            "provider": f"Dr. {provider.last_name}" if provider else "Unknown"
        })
    
    return activities


@router.get("/dashboard/encounter-trends")
async def get_encounter_trends(
    days: int = Query(30, description="Number of days to look back"),
    db: Session = Depends(get_db),
    current_user: Optional[Provider] = Depends(get_current_user_optional)
):
    """Get encounter trends over time"""
    from sqlalchemy import func
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Build query
    query = db.query(
        func.date(Encounter.encounter_date).label('date'),
        func.count(Encounter.id).label('count')
    ).filter(
        Encounter.encounter_date >= start_date,
        Encounter.encounter_date <= end_date
    )
    
    # Filter by provider if logged in
    if current_user:
        query = query.filter(Encounter.provider_id == current_user.id)
    
    # Group by date and order chronologically
    trends = query.group_by(func.date(Encounter.encounter_date)).order_by('date').all()
    
    # Fill in missing dates with zero counts
    date_counts = {trend.date: trend.count for trend in trends}
    result = []
    current_date = start_date.date()
    while current_date <= end_date.date():
        result.append({
            "date": current_date.isoformat(),
            "count": date_counts.get(current_date, 0)
        })
        current_date += timedelta(days=1)
    
    return result

# Clinical Analytics endpoints
@router.get("/analytics/demographics")
async def get_population_demographics(db: Session = Depends(get_db)):
    """Get population demographics analytics"""
    from services.analytics_service import ClinicalAnalyticsService
    analytics = ClinicalAnalyticsService(db)
    return analytics.get_population_demographics()

@router.get("/analytics/disease-prevalence")
async def get_disease_prevalence(db: Session = Depends(get_db)):
    """Get disease prevalence analytics"""
    from services.analytics_service import ClinicalAnalyticsService
    analytics = ClinicalAnalyticsService(db)
    return analytics.get_disease_prevalence()

@router.get("/analytics/diabetes-quality")
async def get_diabetes_quality_measures(db: Session = Depends(get_db)):
    """Get diabetes quality measures"""
    from services.analytics_service import ClinicalAnalyticsService
    analytics = ClinicalAnalyticsService(db)
    return analytics.get_diabetes_quality_measures()

@router.get("/analytics/medication-patterns")
async def get_medication_patterns(db: Session = Depends(get_db)):
    """Get medication usage patterns"""
    from services.analytics_service import ClinicalAnalyticsService
    analytics = ClinicalAnalyticsService(db)
    return analytics.get_medication_usage_patterns()

@router.get("/analytics/utilization")
async def get_encounter_utilization(db: Session = Depends(get_db)):
    """Get healthcare utilization analytics"""
    from services.analytics_service import ClinicalAnalyticsService
    analytics = ClinicalAnalyticsService(db)
    return analytics.get_encounter_utilization()

@router.get("/analytics/lab-distributions")
async def get_lab_distributions(db: Session = Depends(get_db)):
    """Get laboratory value distributions"""
    from services.analytics_service import ClinicalAnalyticsService
    analytics = ClinicalAnalyticsService(db)
    return analytics.get_lab_value_distributions()


@router.get("/analytics/condition-trends")
async def get_condition_trends(
    condition_snomed: str = Query(..., description="SNOMED code of the condition"),
    days: int = Query(90, description="Number of days to look back"),
    db: Session = Depends(get_db)
):
    """Get trends for a specific condition over time"""
    from sqlalchemy import func
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Get new diagnoses by month
    trends = db.query(
        func.date_trunc('month', Condition.onset_date).label('month'),
        func.count(Condition.id).label('new_cases')
    ).filter(
        Condition.snomed_code == condition_snomed,
        Condition.onset_date >= start_date,
        Condition.onset_date <= end_date
    ).group_by('month').order_by('month').all()
    
    # Get condition name
    condition = db.query(Condition).filter(Condition.snomed_code == condition_snomed).first()
    condition_name = condition.description if condition else "Unknown"
    
    return {
        "condition_name": condition_name,
        "snomed_code": condition_snomed,
        "trends": [
            {
                "month": trend.month.strftime("%Y-%m"),
                "new_cases": trend.new_cases
            }
            for trend in trends
        ]
    }

@router.get("/analytics/comprehensive")
async def get_comprehensive_analytics(db: Session = Depends(get_db)):
    """Get comprehensive analytics dashboard"""
    from services.analytics_service import ClinicalAnalyticsService
    analytics = ClinicalAnalyticsService(db)
    return analytics.get_comprehensive_analytics_dashboard()