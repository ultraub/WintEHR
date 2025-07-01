"""
API endpoints for diagnosis code lookup
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import List, Optional
from pydantic import BaseModel

from database.database import get_db
from models.models import Condition
from api.auth import get_current_user

router = APIRouter()


class DiagnosisCode(BaseModel):
    code: str
    display: str
    count: int
    system: str = "SNOMED CT"


@router.get("/diagnosis-codes", response_model=List[DiagnosisCode])
async def get_diagnosis_codes(
    search: Optional[str] = Query(None, description="Search term for code or description"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get available diagnosis codes from the database"""
    
    # Query to get unique diagnosis codes with counts
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
    
    return [
        DiagnosisCode(
            code=result.code,
            display=result.display,
            count=result.count
        )
        for result in results
    ]


@router.get("/diagnosis-codes/top-categories")
async def get_top_diagnosis_categories(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get top diagnosis categories for quick selection"""
    
    # Common diagnosis categories with their SNOMED codes
    categories = [
        {
            "category": "Cardiovascular",
            "codes": [
                {"code": "38341003", "display": "Hypertension"},
                {"code": "53741008", "display": "Coronary artery disease"},
                {"code": "49436004", "display": "Atrial fibrillation"},
                {"code": "84114007", "display": "Heart failure"},
                {"code": "22298006", "display": "Myocardial infarction"}
            ]
        },
        {
            "category": "Diabetes & Metabolic",
            "codes": [
                {"code": "44054006", "display": "Diabetes mellitus type 2"},
                {"code": "46635009", "display": "Diabetes mellitus type 1"},
                {"code": "15777000", "display": "Prediabetes"},
                {"code": "267432004", "display": "Hyperlipidemia"},
                {"code": "14140009", "display": "Hyperglycemia"}
            ]
        },
        {
            "category": "Respiratory",
            "codes": [
                {"code": "195967001", "display": "Asthma"},
                {"code": "13645005", "display": "COPD"},
                {"code": "233604007", "display": "Pneumonia"},
                {"code": "195951007", "display": "Acute bronchitis"},
                {"code": "36971009", "display": "Sinusitis"}
            ]
        },
        {
            "category": "Mental Health",
            "codes": [
                {"code": "73595000", "display": "Stress"},
                {"code": "35489007", "display": "Depression"},
                {"code": "41497008", "display": "Anxiety disorder"},
                {"code": "396275006", "display": "Generalized anxiety disorder"},
                {"code": "1023001", "display": "Insomnia"}
            ]
        },
        {
            "category": "Common Conditions",
            "codes": [
                {"code": "314529007", "display": "Medication review due"},
                {"code": "66383009", "display": "Gingivitis"},
                {"code": "444814009", "display": "Viral infection"},
                {"code": "62106007", "display": "Acute pain"},
                {"code": "82423001", "display": "Chronic pain"}
            ]
        }
    ]
    
    # Check which codes actually exist in the database
    all_codes = []
    for cat in categories:
        for code_info in cat["codes"]:
            all_codes.append(code_info["code"])
    
    existing_codes = db.query(Condition.snomed_code).filter(
        Condition.snomed_code.in_(all_codes)
    ).distinct().all()
    
    existing_code_set = {code[0] for code in existing_codes}
    
    # Filter categories to only include existing codes
    filtered_categories = []
    for cat in categories:
        filtered_codes = [
            code_info for code_info in cat["codes"] 
            if code_info["code"] in existing_code_set
        ]
        if filtered_codes:
            filtered_categories.append({
                "category": cat["category"],
                "codes": filtered_codes
            })
    
    return filtered_categories