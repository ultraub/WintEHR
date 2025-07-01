"""
API endpoints for querying actual patient data patterns
Returns real data from observations, medications, conditions, etc.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database.database import get_db
from models.models import Observation, Medication, Condition
from api.auth import get_current_user

router = APIRouter()


class LabTestData(BaseModel):
    code: str
    display: str
    count: int
    category: str
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    avg_value: Optional[float] = None
    example_values: List[float] = []


class VitalSignData(BaseModel):
    code: str
    display: str
    count: int
    category: str
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    avg_value: Optional[float] = None
    normal_range: Optional[dict] = None


class MedicationData(BaseModel):
    code: str
    display: str
    count: int
    category: Optional[str] = None
    common_dosages: List[str] = []
    common_routes: List[str] = []


class ConditionData(BaseModel):
    code: str
    display: str
    count: int
    category: str = "Clinical"
    avg_duration_days: Optional[float] = None
    active_count: int = 0


@router.get("/actual-data/lab-tests", response_model=List[LabTestData])
async def get_actual_lab_tests(
    search: Optional[str] = Query(None, description="Search term for code or description"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get distinct lab tests actually performed with statistics"""
    
    # Query for lab tests (observations where type is 'laboratory')
    query = db.query(
        Observation.loinc_code.label('code'),
        Observation.display.label('display'),
        Observation.value_unit.label('unit'),
        func.count(Observation.id).label('count'),
        func.min(Observation.value_quantity).label('min_value'),
        func.max(Observation.value_quantity).label('max_value'),
        func.avg(Observation.value_quantity).label('avg_value')
    ).filter(
        Observation.observation_type == 'laboratory',
        Observation.loinc_code.isnot(None),
        Observation.display.isnot(None)
    ).group_by(
        Observation.loinc_code,
        Observation.display,
        Observation.value_unit
    )
    
    # Apply search filter if provided
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                Observation.loinc_code.ilike(search_term),
                Observation.display.ilike(search_term)
            )
        )
    
    # Order by count (most common first) and limit
    results = query.order_by(func.count(Observation.id).desc()).limit(limit).all()
    
    lab_tests = []
    for result in results:
        # Get a few example values for this lab test
        example_values = db.query(Observation.value_quantity).filter(
            Observation.loinc_code == result.code,
            Observation.value_quantity.isnot(None)
        ).limit(5).all()
        
        lab_tests.append(LabTestData(
            code=result.code,
            display=result.display,
            count=result.count,
            category="Laboratory",
            unit=result.unit,
            min_value=result.min_value,
            max_value=result.max_value,
            avg_value=round(result.avg_value, 2) if result.avg_value else None,
            example_values=[round(v[0], 2) for v in example_values if v[0] is not None]
        ))
    
    return lab_tests


@router.get("/actual-data/vital-signs", response_model=List[VitalSignData])
async def get_actual_vital_signs(
    search: Optional[str] = Query(None, description="Search term for code or description"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get distinct vital signs actually recorded with statistics"""
    
    # Query for vital signs
    query = db.query(
        Observation.loinc_code.label('code'),
        Observation.display.label('display'),
        Observation.value_unit.label('unit'),
        func.count(Observation.id).label('count'),
        func.min(Observation.value_quantity).label('min_value'),
        func.max(Observation.value_quantity).label('max_value'),
        func.avg(Observation.value_quantity).label('avg_value')
    ).filter(
        Observation.observation_type == 'vital-signs',
        Observation.loinc_code.isnot(None),
        Observation.display.isnot(None)
    ).group_by(
        Observation.loinc_code,
        Observation.display,
        Observation.value_unit
    )
    
    # Apply search filter if provided
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                Observation.loinc_code.ilike(search_term),
                Observation.display.ilike(search_term)
            )
        )
    
    # Order by count (most common first) and limit
    results = query.order_by(func.count(Observation.id).desc()).limit(limit).all()
    
    # Define normal ranges for common vital signs
    normal_ranges = {
        '8480-6': {'min': 90, 'max': 120},      # Systolic BP
        '8462-4': {'min': 60, 'max': 80},       # Diastolic BP
        '8867-4': {'min': 60, 'max': 100},      # Heart rate
        '9279-1': {'min': 12, 'max': 20},       # Respiratory rate
        '8310-5': {'min': 97.8, 'max': 99.1},   # Body temperature (F)
        '2708-6': {'min': 95, 'max': 100},      # Oxygen saturation
        '39156-5': {'min': 18.5, 'max': 24.9}   # BMI
    }
    
    vital_signs = []
    for result in results:
        vital_signs.append(VitalSignData(
            code=result.code,
            display=result.display,
            count=result.count,
            category="Vital Signs",
            unit=result.unit,
            min_value=round(result.min_value, 2) if result.min_value else None,
            max_value=round(result.max_value, 2) if result.max_value else None,
            avg_value=round(result.avg_value, 2) if result.avg_value else None,
            normal_range=normal_ranges.get(result.code)
        ))
    
    return vital_signs


@router.get("/actual-data/medications", response_model=List[MedicationData])
async def get_actual_medications(
    search: Optional[str] = Query(None, description="Search term for code or medication name"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get distinct medications actually prescribed with statistics"""
    
    # Query for medications
    query = db.query(
        Medication.rxnorm_code.label('code'),
        Medication.medication_name.label('display'),
        func.count(Medication.id).label('count')
    ).filter(
        Medication.rxnorm_code.isnot(None),
        Medication.medication_name.isnot(None)
    ).group_by(
        Medication.rxnorm_code,
        Medication.medication_name
    )
    
    # Apply search filter if provided
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                Medication.rxnorm_code.ilike(search_term),
                Medication.medication_name.ilike(search_term)
            )
        )
    
    # Order by count (most common first) and limit
    results = query.order_by(func.count(Medication.id).desc()).limit(limit).all()
    
    medications = []
    for result in results:
        # Get common dosages and routes for this medication
        dosage_data = db.query(
            Medication.dosage,
            Medication.route,
            func.count(Medication.id).label('count')
        ).filter(
            Medication.rxnorm_code == result.code
        ).group_by(
            Medication.dosage,
            Medication.route
        ).order_by(func.count(Medication.id).desc()).limit(5).all()
        
        common_dosages = []
        common_routes = []
        
        for dosage, route, count in dosage_data:
            if dosage and dosage not in common_dosages:
                common_dosages.append(dosage)
            if route and route not in common_routes:
                common_routes.append(route)
        
        # Try to categorize medication based on name
        med_name_lower = result.display.lower()
        category = None
        
        if any(term in med_name_lower for term in ['lisinopril', 'metoprolol', 'amlodipine', 'losartan']):
            category = "Cardiovascular"
        elif any(term in med_name_lower for term in ['metformin', 'insulin', 'glipizide', 'januvia']):
            category = "Diabetes"
        elif any(term in med_name_lower for term in ['atorvastatin', 'simvastatin', 'rosuvastatin']):
            category = "Lipid Management"
        elif any(term in med_name_lower for term in ['albuterol', 'fluticasone', 'budesonide']):
            category = "Respiratory"
        elif any(term in med_name_lower for term in ['ibuprofen', 'acetaminophen', 'naproxen']):
            category = "Pain/Inflammation"
        elif any(term in med_name_lower for term in ['sertraline', 'fluoxetine', 'citalopram', 'escitalopram']):
            category = "Mental Health"
        elif any(term in med_name_lower for term in ['amoxicillin', 'azithromycin', 'cephalexin']):
            category = "Antibiotic"
        else:
            category = "Other"
        
        medications.append(MedicationData(
            code=result.code,
            display=result.display,
            count=result.count,
            category=category,
            common_dosages=common_dosages[:3],  # Top 3 dosages
            common_routes=common_routes[:2]     # Top 2 routes
        ))
    
    return medications


@router.get("/actual-data/conditions", response_model=List[ConditionData])
async def get_actual_conditions(
    search: Optional[str] = Query(None, description="Search term for code or description"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get distinct conditions actually diagnosed with statistics"""
    
    # Query for conditions
    query = db.query(
        Condition.snomed_code.label('code'),
        Condition.description.label('display'),
        func.count(Condition.id).label('count')
    ).filter(
        Condition.snomed_code.isnot(None),
        Condition.description.isnot(None)
    ).group_by(
        Condition.snomed_code,
        Condition.description
    )
    
    # Apply search filter if provided
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                Condition.snomed_code.ilike(search_term),
                Condition.description.ilike(search_term)
            )
        )
    
    # Order by count (most common first) and limit
    results = query.order_by(func.count(Condition.id).desc()).limit(limit).all()
    
    conditions = []
    for result in results:
        # Calculate active count (conditions without resolution date)
        active_count = db.query(func.count(Condition.id)).filter(
            Condition.snomed_code == result.code,
            Condition.abatement_date.is_(None)  # Use abatement_date instead of resolution_date
        ).scalar() or 0
        
        # Calculate average duration for resolved conditions (using SQLite datetime functions)
        # Convert to days by subtracting timestamps
        avg_duration = None
        try:
            resolved_conditions = db.query(
                Condition.onset_date,
                Condition.abatement_date
            ).filter(
                Condition.snomed_code == result.code,
                Condition.abatement_date.isnot(None),
                Condition.onset_date.isnot(None)
            ).all()
            
            if resolved_conditions:
                durations = []
                for onset, abatement in resolved_conditions:
                    if onset and abatement:
                        duration = (abatement - onset).days
                        durations.append(duration)
                
                if durations:
                    avg_duration = sum(durations) / len(durations)
        except Exception:
            avg_duration = None
        
        conditions.append(ConditionData(
            code=result.code,
            display=result.display,
            count=result.count,
            active_count=active_count,
            avg_duration_days=round(avg_duration, 1) if avg_duration else None
        ))
    
    return conditions


# New endpoints for CDS Hooks Builder - using expected URL patterns
@router.get("/patient-data/lab-tests", response_model=List[LabTestData])
async def get_patient_data_lab_tests(
    search: Optional[str] = Query(None, description="Search term for code or description"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get distinct lab tests actually performed with statistics - for CDS Hooks Builder"""
    return await get_actual_lab_tests(search, limit, db, current_user)


@router.get("/patient-data/medications", response_model=List[MedicationData])
async def get_patient_data_medications(
    search: Optional[str] = Query(None, description="Search term for code or medication name"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get distinct medications actually prescribed with statistics - for CDS Hooks Builder"""
    return await get_actual_medications(search, limit, db, current_user)


@router.get("/patient-data/vital-signs", response_model=List[VitalSignData])
async def get_patient_data_vital_signs(
    search: Optional[str] = Query(None, description="Search term for code or description"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get distinct vital signs actually recorded with statistics - for CDS Hooks Builder"""
    return await get_actual_vital_signs(search, limit, db, current_user)


@router.get("/patient-data/conditions", response_model=List[ConditionData])
async def get_patient_data_conditions(
    search: Optional[str] = Query(None, description="Search term for code or description"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get distinct conditions actually diagnosed with statistics - for CDS Hooks Builder"""
    return await get_actual_conditions(search, limit, db, current_user)


@router.get("/actual-data/summary")
async def get_data_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get summary statistics of available clinical data"""
    
    # Count distinct items in each category
    lab_count = db.query(func.count(distinct(Observation.loinc_code))).filter(
        Observation.observation_type == 'laboratory'
    ).scalar()
    
    vital_count = db.query(func.count(distinct(Observation.loinc_code))).filter(
        Observation.observation_type == 'vital-signs'
    ).scalar()
    
    med_count = db.query(func.count(distinct(Medication.rxnorm_code))).scalar()
    
    condition_count = db.query(func.count(distinct(Condition.snomed_code))).scalar()
    
    # Total records
    total_labs = db.query(func.count(Observation.id)).filter(
        Observation.observation_type == 'laboratory'
    ).scalar()
    
    total_vitals = db.query(func.count(Observation.id)).filter(
        Observation.observation_type == 'vital-signs'
    ).scalar()
    
    total_meds = db.query(func.count(Medication.id)).scalar()
    
    total_conditions = db.query(func.count(Condition.id)).scalar()
    
    return {
        "lab_tests": {
            "distinct_tests": lab_count,
            "total_observations": total_labs
        },
        "vital_signs": {
            "distinct_vitals": vital_count,
            "total_observations": total_vitals
        },
        "medications": {
            "distinct_medications": med_count,
            "total_prescriptions": total_meds
        },
        "conditions": {
            "distinct_conditions": condition_count,
            "total_diagnoses": total_conditions
        }
    }