"""
Patient Data API for CDS Hooks and clinical workflows
Provides essential patient data endpoints that are referenced by frontend and CDS hooks
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import json

from database import get_db_session as get_db
from models.models import Patient, Encounter, Observation
from models.synthea_models import Provider, Organization

router = APIRouter(tags=["Patient Data"])

@router.get("/patient-data/{patient_id}/summary")
async def get_patient_summary(
    patient_id: str,
    db: Session = Depends(get_db)
):
    """Get comprehensive patient summary for CDS Hooks and clinical decision support"""
    
    # Get patient
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Get recent vitals (last 30 days)
    recent_vitals = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.observation_type == 'vital-signs',
            Observation.observation_date >= datetime.now().date() - timedelta(days=30)
        )
    ).order_by(desc(Observation.observation_date)).limit(10).all()
    
    # Get recent labs (last 90 days)
    recent_labs = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.observation_type == 'laboratory',
            Observation.observation_date >= datetime.now().date() - timedelta(days=90)
        )
    ).order_by(desc(Observation.observation_date)).limit(20).all()
    
    # Get active conditions
    active_conditions = db.query(Condition).filter(
        and_(
            Condition.patient_id == patient_id,
            Condition.clinical_status == 'active'
        )
    ).all()
    
    # Get active medications
    active_medications = db.query(Medication).filter(
        and_(
            Medication.patient_id == patient_id,
            Medication.status == 'active'
        )
    ).all()
    
    # Get recent encounters (last 12 months)
    recent_encounters = db.query(Encounter).filter(
        and_(
            Encounter.patient_id == patient_id,
            Encounter.start_time >= datetime.now() - timedelta(days=365)
        )
    ).order_by(desc(Encounter.start_time)).limit(10).all()
    
    # Calculate age
    age = None
    if patient.date_of_birth:
        age = (datetime.now().date() - patient.date_of_birth).days / 365.25
    
    return {
        "patient": {
            "id": patient.id,
            "mrn": patient.mrn,
            "firstName": patient.first_name,
            "lastName": patient.last_name,
            "dateOfBirth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            "age": int(age) if age else None,
            "gender": patient.gender,
            "address": patient.address,
            "phone": patient.phone,
            "email": patient.email
        },
        "vitals": [
            {
                "id": vital.id,
                "date": vital.observation_date.isoformat() if vital.observation_date else None,
                "code": vital.loinc_code,
                "name": vital.observation_name,
                "value": vital.value,
                "unit": vital.unit,
                "valueQuantity": vital.value_quantity
            }
            for vital in recent_vitals
        ],
        "labs": [
            {
                "id": lab.id,
                "date": lab.observation_date.isoformat() if lab.observation_date else None,
                "code": lab.loinc_code,
                "name": lab.observation_name,
                "value": lab.value,
                "unit": lab.unit,
                "valueQuantity": lab.value_quantity,
                "status": lab.status
            }
            for lab in recent_labs
        ],
        "conditions": [
            {
                "id": condition.id,
                "code": condition.snomed_code,
                "icd10Code": condition.icd10_code,
                "description": condition.description,
                "clinicalStatus": condition.clinical_status,
                "onsetDate": condition.onset_date.isoformat() if condition.onset_date else None
            }
            for condition in active_conditions
        ],
        "medications": [
            {
                "id": medication.id,
                "name": medication.medication_name,
                "dosage": medication.dosage,
                "frequency": medication.frequency,
                "status": medication.status,
                "startDate": medication.start_date.isoformat() if medication.start_date else None,
                "prescriber": medication.provider_id
            }
            for medication in active_medications
        ],
        "encounters": [
            {
                "id": encounter.id,
                "date": encounter.start_time.isoformat() if encounter.start_time else None,
                "type": encounter.encounter_type,
                "class": encounter.encounter_class,
                "status": encounter.status,
                "provider": encounter.provider_id
            }
            for encounter in recent_encounters
        ]
    }

@router.get("/patient-data/{patient_id}/conditions")
async def get_patient_conditions(
    patient_id: str,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get patient conditions with filtering options"""
    
    query = db.query(Condition).filter(Condition.patient_id == patient_id)
    
    if active_only:
        query = query.filter(Condition.clinical_status == 'active')
    
    conditions = query.order_by(desc(Condition.onset_date)).all()
    
    return [
        {
            "id": condition.id,
            "code": condition.snomed_code,
            "icd10Code": condition.icd10_code,
            "description": condition.description,
            "clinicalStatus": condition.clinical_status,
            "verificationStatus": condition.verification_status,
            "onsetDate": condition.onset_date.isoformat() if condition.onset_date else None,
            "abatementDate": condition.abatement_date.isoformat() if condition.abatement_date else None
        }
        for condition in conditions
    ]

@router.get("/patient-data/{patient_id}/medications")
async def get_patient_medications(
    patient_id: str,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get patient medications with filtering options"""
    
    query = db.query(Medication).filter(Medication.patient_id == patient_id)
    
    if active_only:
        query = query.filter(Medication.status == 'active')
    
    medications = query.order_by(desc(Medication.start_date)).all()
    
    return [
        {
            "id": medication.id,
            "name": medication.medication_name,
            "dosage": medication.dosage,
            "frequency": medication.frequency,
            "status": medication.status,
            "startDate": medication.start_date.isoformat() if medication.start_date else None,
            "endDate": medication.end_date.isoformat() if medication.end_date else None,
            "prescriber": medication.provider_id,
            "reasonCode": medication.reason_code,
            "instructions": medication.instructions
        }
        for medication in medications
    ]

@router.get("/patient-data/{patient_id}/vitals")
async def get_patient_vitals(
    patient_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get patient vital signs for specified time period"""
    
    cutoff_date = datetime.now().date() - timedelta(days=days)
    
    vitals = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.observation_type == 'vital-signs',
            Observation.observation_date >= cutoff_date
        )
    ).order_by(desc(Observation.observation_date)).all()
    
    return [
        {
            "id": vital.id,
            "date": vital.observation_date.isoformat() if vital.observation_date else None,
            "effectiveDateTime": vital.effective_datetime.isoformat() if vital.effective_datetime else None,
            "code": vital.loinc_code,
            "name": vital.observation_name,
            "value": vital.value,
            "unit": vital.unit,
            "valueQuantity": vital.value_quantity,
            "status": vital.status,
            "category": vital.category
        }
        for vital in vitals
    ]

@router.get("/patient-data/{patient_id}/labs")
async def get_patient_labs(
    patient_id: str,
    days: int = 90,
    db: Session = Depends(get_db)
):
    """Get patient laboratory results for specified time period"""
    
    cutoff_date = datetime.now().date() - timedelta(days=days)
    
    labs = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.observation_type == 'laboratory',
            Observation.observation_date >= cutoff_date
        )
    ).order_by(desc(Observation.observation_date)).all()
    
    return [
        {
            "id": lab.id,
            "date": lab.observation_date.isoformat() if lab.observation_date else None,
            "effectiveDateTime": lab.effective_datetime.isoformat() if lab.effective_datetime else None,
            "code": lab.loinc_code,
            "name": lab.observation_name,
            "value": lab.value,
            "unit": lab.unit,
            "valueQuantity": lab.value_quantity,
            "status": lab.status,
            "referenceRange": lab.reference_range,
            "interpretation": lab.interpretation
        }
        for lab in labs
    ]

@router.get("/patient-data/{patient_id}/encounters")
async def get_patient_encounters(
    patient_id: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get patient encounters"""
    
    encounters = db.query(Encounter).filter(
        Encounter.patient_id == patient_id
    ).order_by(desc(Encounter.start_time)).limit(limit).all()
    
    return [
        {
            "id": encounter.id,
            "startTime": encounter.start_time.isoformat() if encounter.start_time else None,
            "endTime": encounter.end_time.isoformat() if encounter.end_time else None,
            "type": encounter.encounter_type,
            "class": encounter.encounter_class,
            "status": encounter.status,
            "provider": encounter.provider_id,
            "organization": encounter.organization_id,
            "reasonCode": encounter.reason_code,
            "diagnosis": encounter.diagnosis
        }
        for encounter in encounters
    ]

@router.get("/patient-data/{patient_id}/clinical-summary")
async def get_clinical_summary(
    patient_id: str,
    db: Session = Depends(get_db)
):
    """Get clinical summary for CDS Hooks context"""
    
    # Get basic patient info
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Get key clinical indicators
    # Most recent A1C (for diabetes monitoring)
    a1c = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.loinc_code == '4548-4',  # Hemoglobin A1c
            Observation.observation_date >= datetime.now().date() - timedelta(days=180)
        )
    ).order_by(desc(Observation.observation_date)).first()
    
    # Most recent blood pressure
    bp = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.loinc_code == '85354-9',  # Blood pressure panel
            Observation.observation_date >= datetime.now().date() - timedelta(days=30)
        )
    ).order_by(desc(Observation.observation_date)).first()
    
    # Most recent glucose
    glucose = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.loinc_code == '2339-0',  # Glucose
            Observation.observation_date >= datetime.now().date() - timedelta(days=7)
        )
    ).order_by(desc(Observation.observation_date)).first()
    
    # Check for diabetes diagnosis
    diabetes = db.query(Condition).filter(
        and_(
            Condition.patient_id == patient_id,
            Condition.snomed_code == '44054006',  # Type 2 diabetes
            Condition.clinical_status == 'active'
        )
    ).first()
    
    # Calculate age
    age = None
    if patient.date_of_birth:
        age = (datetime.now().date() - patient.date_of_birth).days / 365.25
    
    return {
        "patientId": patient_id,
        "age": int(age) if age else None,
        "gender": patient.gender,
        "hasDiabetes": diabetes is not None,
        "recentA1C": {
            "value": a1c.value if a1c else None,
            "date": a1c.observation_date.isoformat() if a1c and a1c.observation_date else None,
            "numeric": float(a1c.value) if a1c and a1c.value and a1c.value.replace('.', '').isdigit() else None
        } if a1c else None,
        "recentBloodPressure": {
            "value": bp.value if bp else None,
            "date": bp.observation_date.isoformat() if bp and bp.observation_date else None,
            "systolic": bp.value.split('/')[0] if bp and bp.value and '/' in bp.value else None,
            "diastolic": bp.value.split('/')[1] if bp and bp.value and '/' in bp.value else None
        } if bp else None,
        "recentGlucose": {
            "value": glucose.value if glucose else None,
            "date": glucose.observation_date.isoformat() if glucose and glucose.observation_date else None,
            "numeric": float(glucose.value) if glucose and glucose.value and glucose.value.replace('.', '').isdigit() else None
        } if glucose else None
    }

@router.get("/patient-data/search")
async def search_patients(
    query: str,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Search patients by name, MRN, or other identifiers"""
    
    search_pattern = f"%{query}%"
    
    patients = db.query(Patient).filter(
        or_(
            Patient.first_name.ilike(search_pattern),
            Patient.last_name.ilike(search_pattern),
            Patient.mrn.ilike(search_pattern)
        )
    ).order_by(Patient.last_name, Patient.first_name).limit(limit).all()
    
    # Calculate ages
    results = []
    for patient in patients:
        age = None
        if patient.date_of_birth:
            age = (datetime.now().date() - patient.date_of_birth).days / 365.25
        
        results.append({
            "id": patient.id,
            "mrn": patient.mrn,
            "firstName": patient.first_name,
            "lastName": patient.last_name,
            "fullName": f"{patient.first_name} {patient.last_name}",
            "dateOfBirth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            "age": int(age) if age else None,
            "gender": patient.gender,
            "phone": patient.phone,
            "email": patient.email
        })
    
    return results