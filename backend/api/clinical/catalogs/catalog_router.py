"""
Clinical catalog API endpoints for CPOE
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from pydantic import BaseModel

from database.database import get_db
from models.clinical.catalogs import MedicationCatalog, LabTestCatalog, ImagingStudyCatalog, ClinicalOrderSet

router = APIRouter()


# Pydantic models for responses
class MedicationCatalogResponse(BaseModel):
    id: str
    generic_name: str
    brand_name: Optional[str]
    strength: Optional[str]
    dosage_form: Optional[str]
    drug_class: Optional[str]
    route: Optional[str]
    frequency_options: Optional[List[str]]
    standard_doses: Optional[List[str]]
    is_controlled_substance: bool
    requires_authorization: bool
    is_formulary: bool
    
    class Config:
        from_attributes = True


class LabTestCatalogResponse(BaseModel):
    id: str
    test_name: str
    test_code: str
    test_description: Optional[str]
    test_category: Optional[str]
    test_panel: Optional[str]
    specimen_type: Optional[str]
    loinc_code: Optional[str]
    fasting_required: bool
    stat_available: bool
    typical_turnaround_time: Optional[str]
    
    class Config:
        from_attributes = True


class ImagingStudyCatalogResponse(BaseModel):
    id: str
    study_name: str
    study_code: str
    study_description: Optional[str]
    modality: Optional[str]
    body_part: Optional[str]
    study_type: Optional[str]
    contrast_required: bool
    prep_instructions: Optional[str]
    typical_duration: Optional[str]
    
    class Config:
        from_attributes = True


class ClinicalOrderSetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    clinical_indication: Optional[str]
    specialty: Optional[str]
    orders: dict
    usage_count: int
    
    class Config:
        from_attributes = True


@router.get("/medications", response_model=List[MedicationCatalogResponse])
async def search_medications(
    search: Optional[str] = Query(None, description="Search term for medication name"),
    drug_class: Optional[str] = Query(None, description="Filter by drug class"),
    formulary_only: bool = Query(True, description="Show only formulary medications"),
    limit: int = Query(50, le=100, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """Search medication catalog for CPOE"""
    query = db.query(MedicationCatalog).filter(
        MedicationCatalog.is_active == True
    )
    
    if formulary_only:
        query = query.filter(MedicationCatalog.is_formulary == True)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(MedicationCatalog.generic_name).like(search_term),
                func.lower(MedicationCatalog.brand_name).like(search_term)
            )
        )
    
    if drug_class:
        query = query.filter(
            func.lower(MedicationCatalog.drug_class).like(f"%{drug_class.lower()}%")
        )
    
    medications = query.limit(limit).all()
    return medications


@router.get("/lab-tests", response_model=List[LabTestCatalogResponse])
async def search_lab_tests(
    search: Optional[str] = Query(None, description="Search term for test name"),
    category: Optional[str] = Query(None, description="Filter by test category"),
    stat_only: bool = Query(False, description="Show only STAT available tests"),
    limit: int = Query(50, le=100, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """Search lab test catalog for CPOE"""
    query = db.query(LabTestCatalog).filter(
        LabTestCatalog.is_active == True
    )
    
    if stat_only:
        query = query.filter(LabTestCatalog.stat_available == True)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(LabTestCatalog.test_name).like(search_term),
                func.lower(LabTestCatalog.test_code).like(search_term),
                func.lower(LabTestCatalog.loinc_code).like(search_term)
            )
        )
    
    if category:
        query = query.filter(
            func.lower(LabTestCatalog.test_category).like(f"%{category.lower()}%")
        )
    
    tests = query.limit(limit).all()
    return tests


@router.get("/imaging-studies", response_model=List[ImagingStudyCatalogResponse])
async def search_imaging_studies(
    search: Optional[str] = Query(None, description="Search term for study name"),
    modality: Optional[str] = Query(None, description="Filter by modality (CT, MRI, etc.)"),
    body_part: Optional[str] = Query(None, description="Filter by body part"),
    limit: int = Query(50, le=100, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """Search imaging study catalog for CPOE"""
    query = db.query(ImagingStudyCatalog).filter(
        ImagingStudyCatalog.is_active == True
    )
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(ImagingStudyCatalog.study_name).like(search_term),
                func.lower(ImagingStudyCatalog.study_description).like(search_term)
            )
        )
    
    if modality:
        query = query.filter(
            func.lower(ImagingStudyCatalog.modality).like(f"%{modality.lower()}%")
        )
    
    if body_part:
        query = query.filter(
            func.lower(ImagingStudyCatalog.body_part).like(f"%{body_part.lower()}%")
        )
    
    studies = query.limit(limit).all()
    return studies


@router.get("/order-sets", response_model=List[ClinicalOrderSetResponse])
async def get_order_sets(
    indication: Optional[str] = Query(None, description="Filter by clinical indication"),
    specialty: Optional[str] = Query(None, description="Filter by specialty"),
    limit: int = Query(20, le=50, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """Get available order sets"""
    query = db.query(ClinicalOrderSet).filter(
        ClinicalOrderSet.is_active == True
    )
    
    if indication:
        query = query.filter(
            func.lower(ClinicalOrderSet.clinical_indication).like(f"%{indication.lower()}%")
        )
    
    if specialty:
        query = query.filter(
            func.lower(ClinicalOrderSet.specialty).like(f"%{specialty.lower()}%")
        )
    
    # Order by usage count (most popular first) and name
    order_sets = query.order_by(
        ClinicalOrderSet.usage_count.desc(),
        ClinicalOrderSet.name
    ).limit(limit).all()
    
    return order_sets


@router.get("/drug-classes")
async def get_drug_classes(db: Session = Depends(get_db)):
    """Get list of available drug classes"""
    classes = db.query(
        MedicationCatalog.drug_class
    ).filter(
        MedicationCatalog.drug_class.isnot(None),
        MedicationCatalog.is_active == True
    ).distinct().all()
    
    return [cls[0] for cls in classes if cls[0]]


@router.get("/test-categories")
async def get_test_categories(db: Session = Depends(get_db)):
    """Get list of available lab test categories"""
    categories = db.query(
        LabTestCatalog.test_category
    ).filter(
        LabTestCatalog.test_category.isnot(None),
        LabTestCatalog.is_active == True
    ).distinct().all()
    
    return [cat[0] for cat in categories if cat[0]]


@router.get("/imaging-modalities")
async def get_imaging_modalities(db: Session = Depends(get_db)):
    """Get list of available imaging modalities"""
    modalities = db.query(
        ImagingStudyCatalog.modality
    ).filter(
        ImagingStudyCatalog.modality.isnot(None),
        ImagingStudyCatalog.is_active == True
    ).distinct().all()
    
    return [mod[0] for mod in modalities if mod[0]]