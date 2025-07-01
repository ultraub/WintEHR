"""
API endpoints for clinical data lookup (lab tests, medications, vital signs)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import List, Optional
from pydantic import BaseModel

from database.database import get_db
from models.models import Observation, Medication as MedicationRequest
from api.auth import get_current_user

router = APIRouter()


class LabTestOption(BaseModel):
    code: str
    display: str
    unit: Optional[str]
    category: str
    normalRange: Optional[dict] = None
    count: int


class MedicationOption(BaseModel):
    code: Optional[str]
    display: str
    category: str
    count: int


@router.get("/lab-tests", response_model=List[LabTestOption])
async def get_lab_tests(
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get available lab tests from the database"""
    
    # Query unique lab tests with their codes and units
    query = db.query(
        Observation.code.label('code'),
        Observation.display.label('display'),
        Observation.unit.label('unit'),
        func.count(Observation.id).label('count')
    ).filter(
        Observation.observation_type == 'laboratory',
        Observation.code.isnot(None),
        Observation.display.isnot(None)
    ).group_by(
        Observation.code,
        Observation.display,
        Observation.unit
    )
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                Observation.code.ilike(search_term),
                Observation.display.ilike(search_term)
            )
        )
    
    results = query.order_by(func.count(Observation.id).desc()).limit(limit).all()
    
    # Map common LOINC codes to categories and normal ranges
    lab_categories = {
        # Chemistry
        '2339-0': ('Chemistry', {'min': 70, 'max': 100}),  # Glucose
        '2160-0': ('Chemistry', {'min': 2.5, 'max': 8.0}),  # Creatinine
        '17861-6': ('Chemistry', {'min': 136, 'max': 145}),  # Sodium
        '2823-3': ('Chemistry', {'min': 3.5, 'max': 5.1}),  # Potassium
        
        # Hematology
        '718-7': ('Hematology', {'min': 12.0, 'max': 17.5}),  # Hemoglobin
        '787-2': ('Hematology', {'min': 4.5, 'max': 11.0}),  # WBC
        '777-3': ('Hematology', {'min': 150, 'max': 400}),  # Platelets
        
        # Lipids
        '2093-3': ('Lipids', {'max': 200}),  # Total cholesterol
        '18262-6': ('Lipids', {'max': 100}),  # LDL
        '2085-9': ('Lipids', {'min': 40}),  # HDL
        
        # Liver
        '1742-6': ('Liver', {'max': 40}),  # ALT
        '1920-8': ('Liver', {'max': 40}),  # AST
        
        # Cardiac
        '2157-6': ('Cardiac', {'max': 0.04}),  # Troponin
        '13457-7': ('Cardiac', {'max': 100}),  # BNP
        
        # Diabetes
        '4548-4': ('Diabetes', {'max': 7.0}),  # HbA1c
        
        # Kidney
        '33914-3': ('Kidney', {'min': 60}),  # eGFR
        '14682-9': ('Kidney', {'max': 20}),  # Microalbumin
        
        # Thyroid
        '3016-3': ('Thyroid', {'min': 0.4, 'max': 4.0}),  # TSH
    }
    
    lab_tests = []
    for result in results:
        category, normal_range = lab_categories.get(result.code, ('Other', None))
        
        lab_tests.append(LabTestOption(
            code=result.code,
            display=result.display,
            unit=result.unit,
            category=category,
            normalRange=normal_range,
            count=result.count
        ))
    
    # If no results, provide common defaults
    if not lab_tests and not search:
        common_tests = [
            LabTestOption(code='2339-0', display='Glucose', unit='mg/dL', category='Chemistry', 
                         normalRange={'min': 70, 'max': 100}, count=0),
            LabTestOption(code='718-7', display='Hemoglobin', unit='g/dL', category='Hematology',
                         normalRange={'min': 12.0, 'max': 17.5}, count=0),
            LabTestOption(code='2093-3', display='Total Cholesterol', unit='mg/dL', category='Lipids',
                         normalRange={'max': 200}, count=0),
            LabTestOption(code='4548-4', display='Hemoglobin A1c', unit='%', category='Diabetes',
                         normalRange={'max': 7.0}, count=0),
            LabTestOption(code='2160-0', display='Creatinine', unit='mg/dL', category='Chemistry',
                         normalRange={'min': 0.5, 'max': 1.2}, count=0),
        ]
        return common_tests
    
    return lab_tests


@router.get("/medications", response_model=List[MedicationOption])
async def get_medications(
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get available medications from the database"""
    
    # Query unique medications
    query = db.query(
        MedicationRequest.medication_name.label('display'),
        MedicationRequest.rxnorm_code.label('code'),
        func.count(MedicationRequest.id).label('count')
    ).filter(
        MedicationRequest.medication_name.isnot(None)
    ).group_by(
        MedicationRequest.medication_name,
        MedicationRequest.rxnorm_code
    )
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            MedicationRequest.medication_name.ilike(search_term)
        )
    
    results = query.order_by(func.count(MedicationRequest.id).desc()).limit(limit).all()
    
    # Categorize medications
    medication_categories = {
        # Antibiotics
        'amoxicillin': 'Antibiotics',
        'azithromycin': 'Antibiotics',
        'cephalexin': 'Antibiotics',
        'ciprofloxacin': 'Antibiotics',
        'doxycycline': 'Antibiotics',
        
        # Cardiovascular
        'lisinopril': 'Cardiovascular',
        'amlodipine': 'Cardiovascular',
        'metoprolol': 'Cardiovascular',
        'atenolol': 'Cardiovascular',
        'losartan': 'Cardiovascular',
        'hydrochlorothiazide': 'Cardiovascular',
        'furosemide': 'Cardiovascular',
        'warfarin': 'Cardiovascular',
        'clopidogrel': 'Cardiovascular',
        'aspirin': 'Cardiovascular',
        
        # Diabetes
        'metformin': 'Diabetes',
        'glipizide': 'Diabetes',
        'insulin': 'Diabetes',
        'sitagliptin': 'Diabetes',
        
        # Pain/Inflammation
        'ibuprofen': 'Pain/Inflammation',
        'acetaminophen': 'Pain/Inflammation',
        'naproxen': 'Pain/Inflammation',
        'tramadol': 'Pain/Inflammation',
        'gabapentin': 'Pain/Inflammation',
        
        # Respiratory
        'albuterol': 'Respiratory',
        'fluticasone': 'Respiratory',
        'montelukast': 'Respiratory',
        'budesonide': 'Respiratory',
        
        # GI
        'omeprazole': 'Gastrointestinal',
        'pantoprazole': 'Gastrointestinal',
        'ranitidine': 'Gastrointestinal',
        
        # Psychiatric
        'sertraline': 'Psychiatric',
        'escitalopram': 'Psychiatric',
        'fluoxetine': 'Psychiatric',
        'bupropion': 'Psychiatric',
        'trazodone': 'Psychiatric',
        
        # Cholesterol
        'atorvastatin': 'Cholesterol',
        'simvastatin': 'Cholesterol',
        'rosuvastatin': 'Cholesterol',
        'pravastatin': 'Cholesterol',
    }
    
    medications = []
    for result in results:
        # Determine category based on medication name
        category = 'Other'
        med_name_lower = result.display.lower()
        for key, cat in medication_categories.items():
            if key in med_name_lower:
                category = cat
                break
        
        medications.append(MedicationOption(
            code=result.code,
            display=result.display,
            category=category,
            count=result.count
        ))
    
    # If no results, provide common defaults
    if not medications and not search:
        common_meds = [
            MedicationOption(display='Metformin 500mg', category='Diabetes', count=0, code=None),
            MedicationOption(display='Lisinopril 10mg', category='Cardiovascular', count=0, code=None),
            MedicationOption(display='Atorvastatin 20mg', category='Cholesterol', count=0, code=None),
            MedicationOption(display='Amlodipine 5mg', category='Cardiovascular', count=0, code=None),
            MedicationOption(display='Metoprolol 50mg', category='Cardiovascular', count=0, code=None),
        ]
        return common_meds
    
    return medications


@router.get("/vital-signs")
async def get_vital_signs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get standard vital signs with LOINC codes"""
    
    # Standard vital signs always available
    vital_signs = [
        {
            "code": "8480-6",
            "display": "Systolic Blood Pressure",
            "unit": "mmHg",
            "category": "Vitals",
            "normalRange": {"min": 90, "max": 140}
        },
        {
            "code": "8462-4",
            "display": "Diastolic Blood Pressure",
            "unit": "mmHg",
            "category": "Vitals",
            "normalRange": {"min": 60, "max": 90}
        },
        {
            "code": "8867-4",
            "display": "Heart Rate",
            "unit": "bpm",
            "category": "Vitals",
            "normalRange": {"min": 60, "max": 100}
        },
        {
            "code": "9279-1",
            "display": "Respiratory Rate",
            "unit": "/min",
            "category": "Vitals",
            "normalRange": {"min": 12, "max": 20}
        },
        {
            "code": "8310-5",
            "display": "Body Temperature",
            "unit": "°F",
            "category": "Vitals",
            "normalRange": {"min": 97.0, "max": 99.0}
        },
        {
            "code": "2708-6",
            "display": "Oxygen Saturation",
            "unit": "%",
            "category": "Vitals",
            "normalRange": {"min": 95, "max": 100}
        },
        {
            "code": "29463-7",
            "display": "Body Weight",
            "unit": "kg",
            "category": "Vitals",
            "normalRange": None
        },
        {
            "code": "8302-2",
            "display": "Body Height",
            "unit": "cm",
            "category": "Vitals", 
            "normalRange": None
        },
        {
            "code": "39156-5",
            "display": "BMI",
            "unit": "kg/m²",
            "category": "Vitals",
            "normalRange": {"min": 18.5, "max": 25}
        },
        {
            "code": "72514-3",
            "display": "Pain Severity",
            "unit": "0-10",
            "category": "Vitals",
            "normalRange": {"max": 3}
        }
    ]
    
    return vital_signs