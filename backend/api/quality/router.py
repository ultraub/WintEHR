"""
Quality Measures API endpoints.
Provides quality metrics and performance measures for healthcare providers.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
import json

from database import get_db_session
from api.auth import get_current_user
from services.fhir_client_config import search_resources

router = APIRouter(prefix="/api/quality/measures", tags=["quality-measures"])

# Pydantic models
class QualityMeasure(BaseModel):
    id: str
    name: str
    description: str
    numerator: int
    denominator: int
    score: float
    target: float
    status: str  # met, not-met, in-progress
    category: str  # preventive-care, chronic-disease, patient-safety, etc.

class QualitySummary(BaseModel):
    overall_score: float
    total_measures: int
    measures_met: int
    measures_not_met: int
    top_measures: List[QualityMeasure]
    categories: Dict[str, float]

async def calculate_diabetes_care_measure(db: AsyncSession, provider_id: Optional[str] = None) -> QualityMeasure:
    """Calculate diabetes care quality measure (HbA1c testing)."""
    # Get diabetic patients from HAPI FHIR
    # Search for diabetes conditions using SNOMED codes
    diabetic_conditions = search_resources('Condition', {
        'code': '44054006,73211009,714628002,127013003,90781000119102'  # Diabetes SNOMED codes
    })

    # Extract unique patient references
    diabetic_patients = set()
    if diabetic_conditions:
        for condition in diabetic_conditions:
            if hasattr(condition, 'subject') and condition.subject:
                patient_ref = condition.subject.reference if hasattr(condition.subject, 'reference') else str(condition.subject)
                diabetic_patients.add(patient_ref)

    denominator = len(diabetic_patients)
    
    if denominator == 0:
        return QualityMeasure(
            id="diabetes-hba1c",
            name="Diabetes: HbA1c Testing",
            description="Percentage of diabetic patients with HbA1c test in last 6 months",
            numerator=0,
            denominator=0,
            score=0.0,
            target=90.0,
            status="not-applicable",
            category="chronic-disease"
        )
    
    # Check for HbA1c tests in last 6 months from HAPI FHIR
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()

    # Search for HbA1c observations
    hba1c_observations = search_resources('Observation', {
        'code': '4548-4',  # LOINC code for HbA1c
        'date': f'ge{six_months_ago}'
    })

    # Count unique patients with HbA1c tests
    tested_patients = set()
    if hba1c_observations:
        for obs in hba1c_observations:
            if hasattr(obs, 'subject') and obs.subject:
                patient_ref = obs.subject.reference if hasattr(obs.subject, 'reference') else str(obs.subject)
                if patient_ref in diabetic_patients:
                    tested_patients.add(patient_ref)

    numerator = len(tested_patients)
    
    score = (numerator / denominator * 100) if denominator > 0 else 0
    
    return QualityMeasure(
        id="diabetes-hba1c",
        name="Diabetes: HbA1c Testing",
        description="Percentage of diabetic patients with HbA1c test in last 6 months",
        numerator=numerator,
        denominator=denominator,
        score=round(score, 1),
        target=90.0,
        status="met" if score >= 90.0 else "not-met",
        category="chronic-disease"
    )

async def calculate_preventive_screening_measure(db: AsyncSession, provider_id: Optional[str] = None) -> QualityMeasure:
    """Calculate preventive screening measure (mammography)."""
    # Get female patients aged 50-74 from HAPI FHIR
    patients = search_resources('Patient', {
        'gender': 'female'
    })

    # Filter by age 50-74
    eligible_patients = set()
    if patients:
        for patient in patients:
            if hasattr(patient, 'birthDate'):
                birth_date = patient.birthDate.isostring if hasattr(patient.birthDate, 'isostring') else str(patient.birthDate)
                from datetime import date
                try:
                    birth_date_obj = datetime.fromisoformat(birth_date.replace('Z', '+00:00')).date()
                    age = (date.today() - birth_date_obj).days / 365.25
                    if 50 <= age <= 74:
                        patient_id = patient.id if hasattr(patient, 'id') else None
                        if patient_id:
                            # Store patient reference
                            eligible_patients.add(f"Patient/{patient_id}")
                except:
                    pass

    denominator = len(eligible_patients)
    
    if denominator == 0:
        return QualityMeasure(
            id="mammography-screening",
            name="Breast Cancer Screening",
            description="Percentage of women 50-74 with mammography in last 2 years",
            numerator=0,
            denominator=0,
            score=0.0,
            target=80.0,
            status="not-applicable",
            category="preventive-care"
        )
    
    # Check for mammography in last 2 years from HAPI FHIR
    two_years_ago = (datetime.now(timezone.utc) - timedelta(days=730)).isoformat()

    # Search for mammography observations using LOINC codes
    mammography_observations = search_resources('Observation', {
        'code': '24606-6,24605-8,24604-1',  # LOINC codes for mammography
        'date': f'ge{two_years_ago}'
    })

    # Count unique patients screened
    screened_patients = set()
    if mammography_observations:
        for obs in mammography_observations:
            if hasattr(obs, 'subject') and obs.subject:
                patient_ref = obs.subject.reference if hasattr(obs.subject, 'reference') else str(obs.subject)
                if patient_ref in eligible_patients:
                    screened_patients.add(patient_ref)

    numerator = len(screened_patients)
    
    score = (numerator / denominator * 100) if denominator > 0 else 0
    
    return QualityMeasure(
        id="mammography-screening",
        name="Breast Cancer Screening",
        description="Percentage of women 50-74 with mammography in last 2 years",
        numerator=numerator,
        denominator=denominator,
        score=round(score, 1),
        target=80.0,
        status="met" if score >= 80.0 else "not-met",
        category="preventive-care"
    )

async def calculate_medication_adherence_measure(db: AsyncSession, provider_id: Optional[str] = None) -> QualityMeasure:
    """Calculate medication adherence measure."""
    # Get active medications from HAPI FHIR
    active_meds = search_resources('MedicationRequest', {
        'status': 'active'
    })

    denominator = len(active_meds) if active_meds else 0
    
    if denominator == 0:
        return QualityMeasure(
            id="medication-adherence",
            name="Medication Adherence",
            description="Percentage of active medications with documented adherence",
            numerator=0,
            denominator=0,
            score=0.0,
            target=85.0,
            status="not-applicable",
            category="patient-safety"
        )
    
    # For demo purposes, simulate adherence data
    # In production, this would check for adherence documentation
    numerator = int(denominator * 0.87)  # Simulate 87% adherence
    score = (numerator / denominator * 100) if denominator > 0 else 0
    
    return QualityMeasure(
        id="medication-adherence",
        name="Medication Adherence",
        description="Percentage of active medications with documented adherence",
        numerator=numerator,
        denominator=denominator,
        score=round(score, 1),
        target=85.0,
        status="met" if score >= 85.0 else "not-met",
        category="patient-safety"
    )

@router.get("/summary", response_model=QualitySummary)
async def get_quality_measures_summary(
    provider_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    """Get summary of quality measures."""
    # Calculate individual measures
    measures = [
        await calculate_diabetes_care_measure(db, provider_id),
        await calculate_preventive_screening_measure(db, provider_id),
        await calculate_medication_adherence_measure(db, provider_id)
    ]
    
    # Calculate summary statistics
    total_measures = len(measures)
    measures_met = sum(1 for m in measures if m.status == "met")
    measures_not_met = sum(1 for m in measures if m.status == "not-met")
    
    # Calculate overall score (weighted average)
    total_weight = sum(m.denominator for m in measures if m.denominator > 0)
    if total_weight > 0:
        overall_score = sum(m.score * m.denominator for m in measures if m.denominator > 0) / total_weight
    else:
        overall_score = 0.0
    
    # Group by category
    categories = {}
    for measure in measures:
        if measure.category not in categories:
            categories[measure.category] = []
        categories[measure.category].append(measure.score)
    
    # Calculate average score per category
    category_scores = {
        cat: round(sum(scores) / len(scores), 1) if scores else 0.0
        for cat, scores in categories.items()
    }
    
    return QualitySummary(
        overall_score=round(overall_score, 1),
        total_measures=total_measures,
        measures_met=measures_met,
        measures_not_met=measures_not_met,
        top_measures=measures,
        categories=category_scores
    )

@router.get("/", response_model=List[QualityMeasure])
async def get_all_quality_measures(
    provider_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session)
):
    """Get all quality measures with optional filters."""
    # Calculate all measures
    all_measures = [
        await calculate_diabetes_care_measure(db, provider_id),
        await calculate_preventive_screening_measure(db, provider_id),
        await calculate_medication_adherence_measure(db, provider_id)
    ]
    
    # Filter by category if specified
    if category:
        all_measures = [m for m in all_measures if m.category == category]
    
    return all_measures

@router.get("/{measure_id}", response_model=QualityMeasure)
async def get_quality_measure_details(
    measure_id: str,
    provider_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session)
):
    """Get detailed information about a specific quality measure."""
    # Map measure IDs to calculation functions
    measure_calculators = {
        "diabetes-hba1c": calculate_diabetes_care_measure,
        "mammography-screening": calculate_preventive_screening_measure,
        "medication-adherence": calculate_medication_adherence_measure
    }
    
    if measure_id not in measure_calculators:
        raise HTTPException(status_code=404, detail="Quality measure not found")
    
    measure = await measure_calculators[measure_id](db, provider_id)
    return measure