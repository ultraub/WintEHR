"""
CDS Clinical Data API endpoints
Provides clinical reference data, lab catalogs with reference ranges,
and vital sign references for CDS Hooks condition evaluation
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from database import get_db_session
from api.services.clinical.dynamic_catalog_service import DynamicCatalogService

router = APIRouter(prefix="/api/clinical", tags=["CDS Clinical Data"])


# Pydantic models
class LabReferenceRange(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    unit: str
    interpretation: Optional[str] = None


class LabCatalogItem(BaseModel):
    id: str
    name: str
    display: str
    loinc_code: str
    category: str
    specimen_type: str
    reference_range: LabReferenceRange
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None
    common_conditions: List[str] = []


class VitalSignReference(BaseModel):
    id: str
    name: str
    display: str
    loinc_code: str
    unit: str
    normal_ranges: Dict[str, Dict[str, Any]]  # age_group -> {min, max}
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None


class ConditionCatalogItem(BaseModel):
    id: str
    display: str
    icd10_code: Optional[str] = None
    snomed_code: Optional[str] = None
    category: str
    severity_levels: List[str] = []
    common_symptoms: List[str] = []
    risk_factors: List[str] = []


# Lab catalog with reference ranges
LAB_CATALOG = [
    {
        "id": "glucose",
        "name": "glucose",
        "display": "Glucose",
        "loinc_code": "2339-0",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_range": {
            "min": 70,
            "max": 100,
            "unit": "mg/dL",
            "interpretation": "fasting"
        },
        "critical_low": 40,
        "critical_high": 500,
        "common_conditions": ["diabetes", "hypoglycemia", "hyperglycemia"]
    },
    {
        "id": "hemoglobin",
        "name": "hemoglobin",
        "display": "Hemoglobin",
        "loinc_code": "718-7",
        "category": "hematology",
        "specimen_type": "blood",
        "reference_range": {
            "min": 13.5,
            "max": 17.5,
            "unit": "g/dL",
            "interpretation": "adult male"
        },
        "critical_low": 7.0,
        "critical_high": 20.0,
        "common_conditions": ["anemia", "polycythemia"]
    },
    {
        "id": "hba1c",
        "name": "hba1c",
        "display": "Hemoglobin A1c",
        "loinc_code": "4548-4",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_range": {
            "min": 4.0,
            "max": 5.6,
            "unit": "%",
            "interpretation": "non-diabetic"
        },
        "critical_low": None,
        "critical_high": 14.0,
        "common_conditions": ["diabetes", "prediabetes"]
    },
    {
        "id": "creatinine",
        "name": "creatinine",
        "display": "Creatinine",
        "loinc_code": "2160-0",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0.7,
            "max": 1.3,
            "unit": "mg/dL",
            "interpretation": "adult"
        },
        "critical_low": None,
        "critical_high": 10.0,
        "common_conditions": ["kidney disease", "renal failure"]
    },
    {
        "id": "potassium",
        "name": "potassium",
        "display": "Potassium",
        "loinc_code": "2823-3",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_range": {
            "min": 3.5,
            "max": 5.0,
            "unit": "mmol/L"
        },
        "critical_low": 2.5,
        "critical_high": 6.5,
        "common_conditions": ["hyperkalemia", "hypokalemia"]
    },
    {
        "id": "sodium",
        "name": "sodium",
        "display": "Sodium",
        "loinc_code": "2951-2",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_range": {
            "min": 136,
            "max": 145,
            "unit": "mmol/L"
        },
        "critical_low": 120,
        "critical_high": 160,
        "common_conditions": ["hypernatremia", "hyponatremia"]
    },
    {
        "id": "tsh",
        "name": "tsh",
        "display": "Thyroid Stimulating Hormone",
        "loinc_code": "3016-3",
        "category": "endocrine",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0.4,
            "max": 4.0,
            "unit": "mIU/L"
        },
        "critical_low": None,
        "critical_high": None,
        "common_conditions": ["hypothyroidism", "hyperthyroidism"]
    },
    {
        "id": "cholesterol-total",
        "name": "cholesterol_total",
        "display": "Total Cholesterol",
        "loinc_code": "2093-3",
        "category": "lipids",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0,
            "max": 200,
            "unit": "mg/dL",
            "interpretation": "desirable"
        },
        "critical_low": None,
        "critical_high": None,
        "common_conditions": ["hyperlipidemia", "cardiovascular disease"]
    },
    {
        "id": "ldl",
        "name": "ldl_cholesterol",
        "display": "LDL Cholesterol",
        "loinc_code": "13457-7",
        "category": "lipids",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0,
            "max": 100,
            "unit": "mg/dL",
            "interpretation": "optimal"
        },
        "critical_low": None,
        "critical_high": None,
        "common_conditions": ["hyperlipidemia", "cardiovascular disease"]
    },
    {
        "id": "hdl",
        "name": "hdl_cholesterol",
        "display": "HDL Cholesterol",
        "loinc_code": "2085-9",
        "category": "lipids",
        "specimen_type": "blood",
        "reference_range": {
            "min": 40,
            "max": None,
            "unit": "mg/dL",
            "interpretation": "protective level"
        },
        "critical_low": None,
        "critical_high": None,
        "common_conditions": ["cardiovascular disease", "metabolic syndrome"]
    },
    {
        "id": "triglycerides",
        "name": "triglycerides",
        "display": "Triglycerides",
        "loinc_code": "2571-8",
        "category": "lipids",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0,
            "max": 150,
            "unit": "mg/dL",
            "interpretation": "normal"
        },
        "critical_low": None,
        "critical_high": 1000,
        "common_conditions": ["hypertriglyceridemia", "pancreatitis risk"]
    },
    {
        "id": "wbc",
        "name": "white_blood_cells",
        "display": "White Blood Cell Count",
        "loinc_code": "6690-2",
        "category": "hematology",
        "specimen_type": "blood",
        "reference_range": {
            "min": 4.5,
            "max": 11.0,
            "unit": "10^3/μL"
        },
        "critical_low": 2.0,
        "critical_high": 30.0,
        "common_conditions": ["infection", "leukemia", "immunosuppression"]
    },
    {
        "id": "platelet",
        "name": "platelet_count",
        "display": "Platelet Count",
        "loinc_code": "777-3",
        "category": "hematology",
        "specimen_type": "blood",
        "reference_range": {
            "min": 150,
            "max": 400,
            "unit": "10^3/μL"
        },
        "critical_low": 50,
        "critical_high": 1000,
        "common_conditions": ["thrombocytopenia", "thrombocytosis"]
    },
    {
        "id": "inr",
        "name": "inr",
        "display": "INR",
        "loinc_code": "5902-2",
        "category": "coagulation",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0.8,
            "max": 1.2,
            "unit": "ratio",
            "interpretation": "not on anticoagulation"
        },
        "critical_low": None,
        "critical_high": 5.0,
        "common_conditions": ["anticoagulation monitoring", "bleeding risk"]
    },
    {
        "id": "bun",
        "name": "blood_urea_nitrogen",
        "display": "Blood Urea Nitrogen",
        "loinc_code": "3094-0",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_range": {
            "min": 7,
            "max": 20,
            "unit": "mg/dL"
        },
        "critical_low": None,
        "critical_high": 100,
        "common_conditions": ["kidney disease", "dehydration"]
    },
    {
        "id": "alt",
        "name": "alt",
        "display": "Alanine Aminotransferase (ALT)",
        "loinc_code": "1742-6",
        "category": "liver",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0,
            "max": 45,
            "unit": "U/L"
        },
        "critical_low": None,
        "critical_high": 1000,
        "common_conditions": ["hepatitis", "liver disease"]
    },
    {
        "id": "ast",
        "name": "ast",
        "display": "Aspartate Aminotransferase (AST)",
        "loinc_code": "1920-8",
        "category": "liver",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0,
            "max": 40,
            "unit": "U/L"
        },
        "critical_low": None,
        "critical_high": 1000,
        "common_conditions": ["hepatitis", "liver disease", "muscle injury"]
    },
    {
        "id": "calcium",
        "name": "calcium",
        "display": "Calcium",
        "loinc_code": "17861-6",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_range": {
            "min": 8.5,
            "max": 10.5,
            "unit": "mg/dL"
        },
        "critical_low": 6.0,
        "critical_high": 13.0,
        "common_conditions": ["hypercalcemia", "hypocalcemia", "parathyroid disorders"]
    },
    {
        "id": "magnesium",
        "name": "magnesium",
        "display": "Magnesium",
        "loinc_code": "2601-3",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_range": {
            "min": 1.7,
            "max": 2.2,
            "unit": "mg/dL"
        },
        "critical_low": 1.0,
        "critical_high": 4.0,
        "common_conditions": ["hypomagnesemia", "hypermagnesemia"]
    },
    {
        "id": "troponin",
        "name": "troponin_i",
        "display": "Troponin I",
        "loinc_code": "42757-5",
        "category": "cardiac",
        "specimen_type": "blood",
        "reference_range": {
            "min": 0,
            "max": 0.04,
            "unit": "ng/mL",
            "interpretation": "normal"
        },
        "critical_low": None,
        "critical_high": 0.5,
        "common_conditions": ["myocardial infarction", "acute coronary syndrome"]
    }
]

# Vital sign references with age-adjusted ranges
VITAL_SIGN_REFERENCES = [
    {
        "id": "blood-pressure",
        "name": "Blood Pressure",
        "display": "Blood Pressure",
        "loinc_code": "85354-9",
        "unit": "mmHg",
        "normal_ranges": {
            "adult": {"systolic_min": 90, "systolic_max": 120, "diastolic_min": 60, "diastolic_max": 80},
            "elderly": {"systolic_min": 90, "systolic_max": 140, "diastolic_min": 60, "diastolic_max": 90},
            "pediatric": {"systolic_min": 70, "systolic_max": 110, "diastolic_min": 50, "diastolic_max": 70}
        },
        "critical_low": 70,  # systolic
        "critical_high": 180  # systolic
    },
    {
        "id": "heart-rate",
        "name": "Heart Rate",
        "display": "Heart Rate",
        "loinc_code": "8867-4",
        "unit": "bpm",
        "normal_ranges": {
            "adult": {"min": 60, "max": 100},
            "athlete": {"min": 40, "max": 60},
            "pediatric": {"min": 70, "max": 120},
            "infant": {"min": 100, "max": 160}
        },
        "critical_low": 40,
        "critical_high": 150
    },
    {
        "id": "temperature",
        "name": "Body Temperature",
        "display": "Body Temperature",
        "loinc_code": "8310-5",
        "unit": "°F",
        "normal_ranges": {
            "all": {"min": 97.0, "max": 99.0}
        },
        "critical_low": 95.0,
        "critical_high": 103.0
    },
    {
        "id": "respiratory-rate",
        "name": "Respiratory Rate",
        "display": "Respiratory Rate",
        "loinc_code": "9279-1",
        "unit": "breaths/min",
        "normal_ranges": {
            "adult": {"min": 12, "max": 20},
            "pediatric": {"min": 20, "max": 30},
            "infant": {"min": 30, "max": 60}
        },
        "critical_low": 8,
        "critical_high": 30
    },
    {
        "id": "oxygen-saturation",
        "name": "Oxygen Saturation",
        "display": "Oxygen Saturation",
        "loinc_code": "2708-6",
        "unit": "%",
        "normal_ranges": {
            "all": {"min": 95, "max": 100},
            "copd": {"min": 88, "max": 92}
        },
        "critical_low": 88,
        "critical_high": None
    },
    {
        "id": "weight",
        "name": "Body Weight",
        "display": "Body Weight",
        "loinc_code": "29463-7",
        "unit": "kg",
        "normal_ranges": {
            "adult": {"min": 45, "max": 120}  # Very broad range
        },
        "critical_low": None,
        "critical_high": None
    },
    {
        "id": "height",
        "name": "Body Height",
        "display": "Body Height",
        "loinc_code": "8302-2",
        "unit": "cm",
        "normal_ranges": {
            "adult": {"min": 150, "max": 200}  # Very broad range
        },
        "critical_low": None,
        "critical_high": None
    },
    {
        "id": "bmi",
        "name": "Body Mass Index",
        "display": "Body Mass Index",
        "loinc_code": "39156-5",
        "unit": "kg/m²",
        "normal_ranges": {
            "adult": {"min": 18.5, "max": 24.9},
            "overweight": {"min": 25, "max": 29.9},
            "obese": {"min": 30, "max": 100}
        },
        "critical_low": 16,
        "critical_high": 40
    },
    {
        "id": "pain-scale",
        "name": "Pain Scale",
        "display": "Pain Scale",
        "loinc_code": "38208-5",
        "unit": "score",
        "normal_ranges": {
            "all": {"min": 0, "max": 3}
        },
        "critical_low": None,
        "critical_high": 8
    }
]

# Medical conditions catalog
CONDITION_CATALOG = [
    {
        "id": "diabetes-type2",
        "display": "Type 2 Diabetes Mellitus",
        "icd10_code": "E11.9",
        "snomed_code": "44054006",
        "category": "endocrine",
        "severity_levels": ["mild", "moderate", "severe", "with complications"],
        "common_symptoms": ["polyuria", "polydipsia", "weight loss", "fatigue"],
        "risk_factors": ["obesity", "family history", "sedentary lifestyle"]
    },
    {
        "id": "hypertension",
        "display": "Essential Hypertension",
        "icd10_code": "I10",
        "snomed_code": "59621000",
        "category": "cardiovascular",
        "severity_levels": ["stage 1", "stage 2", "hypertensive crisis"],
        "common_symptoms": ["headache", "dizziness", "chest pain"],
        "risk_factors": ["obesity", "high sodium diet", "stress", "family history"]
    },
    {
        "id": "copd",
        "display": "Chronic Obstructive Pulmonary Disease",
        "icd10_code": "J44.0",
        "snomed_code": "13645005",
        "category": "respiratory",
        "severity_levels": ["mild", "moderate", "severe", "very severe"],
        "common_symptoms": ["dyspnea", "chronic cough", "sputum production"],
        "risk_factors": ["smoking", "air pollution", "occupational exposure"]
    },
    {
        "id": "asthma",
        "display": "Asthma",
        "icd10_code": "J45.909",
        "snomed_code": "195967001",
        "category": "respiratory",
        "severity_levels": ["intermittent", "mild persistent", "moderate persistent", "severe persistent"],
        "common_symptoms": ["wheezing", "shortness of breath", "chest tightness", "cough"],
        "risk_factors": ["allergies", "family history", "environmental triggers"]
    },
    {
        "id": "heart-failure",
        "display": "Congestive Heart Failure",
        "icd10_code": "I50.9",
        "snomed_code": "42343007",
        "category": "cardiovascular",
        "severity_levels": ["NYHA Class I", "NYHA Class II", "NYHA Class III", "NYHA Class IV"],
        "common_symptoms": ["dyspnea", "edema", "fatigue", "orthopnea"],
        "risk_factors": ["coronary artery disease", "hypertension", "diabetes"]
    }
]


@router.get("/lab-catalog", response_model=List[LabCatalogItem])
async def get_lab_catalog(
    search: Optional[str] = Query(None, description="Search term for lab test"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session)
):
    """Get lab test catalog with reference ranges for CDS Hooks - DYNAMIC ONLY."""
    
    # Use dynamic catalog from actual patient data - NO FALLBACK
    dynamic_service = DynamicCatalogService(db)
    dynamic_labs = await dynamic_service.extract_lab_test_catalog(limit)
    
    # Convert to the expected format
    results = []
    for lab in dynamic_labs:
        # Calculate critical values from statistics if available
        critical_low = None
        critical_high = None
        if lab.get("value_statistics"):
            stats = lab["value_statistics"]
            if stats["min"] is not None and stats["max"] is not None:
                # Use 1st percentile as critical low, 99th percentile as critical high
                range_span = stats["max"] - stats["min"]
                critical_low = stats["min"] - (range_span * 0.1)  # 10% below minimum
                critical_high = stats["max"] + (range_span * 0.1)  # 10% above maximum
        
        lab_item = {
            "id": lab["id"],
            "name": lab["name"],
            "display": lab["display"],
            "loinc_code": lab["loinc_code"],
            "category": lab["category"],
            "specimen_type": lab["specimen_type"],
            "reference_range": lab["reference_range"] or {
                "min": None,
                "max": None,
                "unit": "",
                "interpretation": "insufficient data"
            },
            "critical_low": critical_low,
            "critical_high": critical_high,
            "common_conditions": []  # Could be enhanced by analyzing conditions with these lab values
        }
        results.append(lab_item)
    
    # Apply filters
    if category:
        results = [lab for lab in results if lab["category"].lower() == category.lower()]
    
    if search:
        search_lower = search.lower()
        results = [
            lab for lab in results
            if search_lower in lab["name"].lower() or 
            search_lower in lab["display"].lower() or
            search_lower in lab["loinc_code"].lower()
        ]
    
    return results[:limit]


@router.get("/lab-catalog/{lab_id}", response_model=LabCatalogItem)
async def get_lab_details(lab_id: str):
    """Get detailed lab test information including reference ranges."""
    lab = next((lab for lab in LAB_CATALOG if lab["id"] == lab_id), None)
    if not lab:
        raise HTTPException(status_code=404, detail="Lab test not found")
    return lab


@router.get("/vital-references", response_model=List[VitalSignReference])
async def get_vital_sign_references(
    vital_type: Optional[str] = Query(None, description="Filter by vital sign type")
):
    """Get vital sign reference ranges for CDS Hooks."""
    if vital_type:
        results = [vs for vs in VITAL_SIGN_REFERENCES if vs["id"] == vital_type]
        return results
    
    return VITAL_SIGN_REFERENCES


@router.get("/vital-references/{vital_id}", response_model=VitalSignReference)
async def get_vital_sign_details(vital_id: str):
    """Get detailed vital sign reference information."""
    vital = next((vs for vs in VITAL_SIGN_REFERENCES if vs["id"] == vital_id), None)
    if not vital:
        raise HTTPException(status_code=404, detail="Vital sign reference not found")
    return vital


@router.get("/condition-catalog", response_model=List[ConditionCatalogItem])
async def get_condition_catalog(
    search: Optional[str] = Query(None, description="Search term for condition"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session)
):
    """Get medical condition catalog for CDS Hooks - DYNAMIC ONLY."""
    
    # Use dynamic catalog from actual patient data - NO FALLBACK
    dynamic_service = DynamicCatalogService(db)
    dynamic_conditions = await dynamic_service.extract_condition_catalog(limit)
    
    # Convert to the expected format
    results = []
    for cond in dynamic_conditions:
        condition_item = {
            "id": cond["id"],
            "display": cond["display"],
            "icd10_code": None,  # Could be extracted if present in system
            "snomed_code": cond["code"] if cond.get("system") == "http://snomed.info/sct" else None,
            "category": cond["categories"][0] if cond.get("categories") else "general",
            "severity_levels": cond.get("common_severities", []),
            "common_symptoms": [],  # Could be enhanced with symptom analysis
            "risk_factors": []  # Could be enhanced with risk factor analysis
        }
        results.append(condition_item)
    
    # Apply filters
    if category:
        results = [cond for cond in results if cond["category"].lower() == category.lower()]
    
    if search:
        search_lower = search.lower()
        results = [
            cond for cond in results
            if search_lower in cond["display"].lower() or
            (cond["snomed_code"] and search_lower in cond["snomed_code"].lower())
        ]
    
    return results[:limit]


@router.get("/condition-catalog/{condition_id}", response_model=ConditionCatalogItem)
async def get_condition_details(condition_id: str):
    """Get detailed condition information."""
    condition = next((cond for cond in CONDITION_CATALOG if cond["id"] == condition_id), None)
    if not condition:
        raise HTTPException(status_code=404, detail="Condition not found")
    return condition


@router.get("/lab-categories")
async def get_lab_categories():
    """Get list of available lab test categories."""
    categories = list(set(lab["category"] for lab in LAB_CATALOG))
    return sorted(categories)


@router.get("/condition-categories")
async def get_condition_categories():
    """Get list of available condition categories."""
    categories = list(set(cond["category"] for cond in CONDITION_CATALOG))
    return sorted(categories)