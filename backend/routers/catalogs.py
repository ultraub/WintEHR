"""
Catalog API endpoints for medications, lab tests, and imaging studies.
These endpoints provide searchable catalogs for CPOE (Computerized Provider Order Entry).
"""

from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import json
import os

router = APIRouter(prefix="/api/catalogs", tags=["catalogs"])

# Pydantic models for responses
class MedicationCatalogItem(BaseModel):
    id: str
    generic_name: str
    brand_name: Optional[str] = None
    strength: str
    dosage_form: str
    route: str
    frequency_options: List[str]
    rxnorm_code: Optional[str] = None

class LabTestCatalogItem(BaseModel):
    id: str
    test_name: str
    test_code: str
    test_description: Optional[str] = None
    specimen_type: str
    loinc_code: Optional[str] = None
    fasting_required: bool = False
    special_instructions: Optional[str] = None

class ImagingStudyCatalogItem(BaseModel):
    id: str
    study_name: str
    study_code: str
    study_description: Optional[str] = None
    modality: str
    body_site: Optional[str] = None
    contrast_required: bool = False
    prep_instructions: Optional[str] = None

# Load catalog data from JSON files
def load_catalog_data():
    """Load catalog data from JSON files."""
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Common medications catalog
    medications = [
        {
            "id": "med_1",
            "generic_name": "Aspirin",
            "brand_name": "Bayer",
            "strength": "81 mg",
            "dosage_form": "Tablet",
            "route": "Oral",
            "frequency_options": ["Once daily", "Twice daily", "As needed"],
            "rxnorm_code": "1191"
        },
        {
            "id": "med_2",
            "generic_name": "Metformin",
            "brand_name": "Glucophage",
            "strength": "500 mg",
            "dosage_form": "Tablet",
            "route": "Oral",
            "frequency_options": ["Once daily", "Twice daily", "Three times daily"],
            "rxnorm_code": "6809"
        },
        {
            "id": "med_3",
            "generic_name": "Lisinopril",
            "strength": "10 mg",
            "dosage_form": "Tablet",
            "route": "Oral",
            "frequency_options": ["Once daily"],
            "rxnorm_code": "29046"
        },
        {
            "id": "med_4",
            "generic_name": "Amoxicillin",
            "strength": "500 mg",
            "dosage_form": "Capsule",
            "route": "Oral",
            "frequency_options": ["Three times daily", "Twice daily"],
            "rxnorm_code": "723"
        },
        {
            "id": "med_5",
            "generic_name": "Omeprazole",
            "brand_name": "Prilosec",
            "strength": "20 mg",
            "dosage_form": "Capsule",
            "route": "Oral",
            "frequency_options": ["Once daily", "Twice daily"],
            "rxnorm_code": "7646"
        }
    ]
    
    # Common lab tests catalog
    lab_tests = [
        {
            "id": "lab_1",
            "test_name": "Complete Blood Count (CBC)",
            "test_code": "CBC",
            "test_description": "Measures different components of blood",
            "specimen_type": "Blood",
            "loinc_code": "58410-2",
            "fasting_required": False
        },
        {
            "id": "lab_2",
            "test_name": "Basic Metabolic Panel",
            "test_code": "BMP",
            "test_description": "Tests kidney function, blood sugar, and electrolytes",
            "specimen_type": "Blood",
            "loinc_code": "51990-0",
            "fasting_required": True,
            "special_instructions": "Patient must fast for 8-12 hours"
        },
        {
            "id": "lab_3",
            "test_name": "Lipid Panel",
            "test_code": "LIPID",
            "test_description": "Measures cholesterol and triglycerides",
            "specimen_type": "Blood",
            "loinc_code": "57698-3",
            "fasting_required": True,
            "special_instructions": "Patient must fast for 9-12 hours"
        },
        {
            "id": "lab_4",
            "test_name": "Hemoglobin A1c",
            "test_code": "HBA1C",
            "test_description": "Average blood sugar over 3 months",
            "specimen_type": "Blood",
            "loinc_code": "4548-4",
            "fasting_required": False
        },
        {
            "id": "lab_5",
            "test_name": "Urinalysis",
            "test_code": "UA",
            "test_description": "Tests various components of urine",
            "specimen_type": "Urine",
            "loinc_code": "24356-8",
            "fasting_required": False
        }
    ]
    
    # Common imaging studies catalog
    imaging_studies = [
        {
            "id": "img_1",
            "study_name": "Chest X-Ray PA/LAT",
            "study_code": "CXR",
            "study_description": "Standard chest radiograph",
            "modality": "XR",
            "body_site": "Chest",
            "contrast_required": False
        },
        {
            "id": "img_2",
            "study_name": "CT Head without Contrast",
            "study_code": "CTH",
            "study_description": "Computed tomography of head",
            "modality": "CT",
            "body_site": "Head",
            "contrast_required": False
        },
        {
            "id": "img_3",
            "study_name": "MRI Brain with/without Contrast",
            "study_code": "MRIB",
            "study_description": "Magnetic resonance imaging of brain",
            "modality": "MR",
            "body_site": "Brain",
            "contrast_required": True,
            "prep_instructions": "Remove all metal objects. Inform staff of any implants."
        },
        {
            "id": "img_4",
            "study_name": "Abdominal Ultrasound",
            "study_code": "USABD",
            "study_description": "Ultrasound examination of abdomen",
            "modality": "US",
            "body_site": "Abdomen",
            "contrast_required": False,
            "prep_instructions": "Nothing by mouth for 8 hours before exam"
        },
        {
            "id": "img_5",
            "study_name": "CT Chest with Contrast",
            "study_code": "CTC",
            "study_description": "CT scan of chest with IV contrast",
            "modality": "CT",
            "body_site": "Chest",
            "contrast_required": True,
            "prep_instructions": "Check creatinine level. NPO 4 hours before exam."
        }
    ]
    
    return medications, lab_tests, imaging_studies

# Load catalog data on startup
MEDICATIONS, LAB_TESTS, IMAGING_STUDIES = load_catalog_data()

@router.get("/medications", response_model=List[MedicationCatalogItem])
async def search_medications(
    search: Optional[str] = Query(None, description="Search term for medication name"),
    limit: int = Query(20, ge=1, le=100)
):
    """Search medication catalog."""
    if not search:
        return MEDICATIONS[:limit]
    
    # Simple case-insensitive search
    search_lower = search.lower()
    results = [
        med for med in MEDICATIONS
        if search_lower in med["generic_name"].lower() or 
        (med.get("brand_name") and search_lower in med["brand_name"].lower())
    ]
    
    return results[:limit]

@router.get("/lab-tests", response_model=List[LabTestCatalogItem])
async def search_lab_tests(
    search: Optional[str] = Query(None, description="Search term for lab test"),
    limit: int = Query(20, ge=1, le=100)
):
    """Search lab test catalog."""
    if not search:
        return LAB_TESTS[:limit]
    
    # Simple case-insensitive search
    search_lower = search.lower()
    results = [
        test for test in LAB_TESTS
        if search_lower in test["test_name"].lower() or 
        search_lower in test["test_code"].lower()
    ]
    
    return results[:limit]

@router.get("/imaging-studies", response_model=List[ImagingStudyCatalogItem])
async def search_imaging_studies(
    search: Optional[str] = Query(None, description="Search term for imaging study"),
    modality: Optional[str] = Query(None, description="Filter by modality (XR, CT, MR, US)")
):
    """Search imaging studies catalog."""
    results = IMAGING_STUDIES
    
    # Filter by modality if provided
    if modality:
        results = [study for study in results if study["modality"] == modality.upper()]
    
    # Search if term provided
    if search:
        search_lower = search.lower()
        results = [
            study for study in results
            if search_lower in study["study_name"].lower() or 
            search_lower in study["study_code"].lower() or
            (study.get("body_site") and search_lower in study["body_site"].lower())
        ]
    
    return results

@router.get("/medications/{medication_id}", response_model=MedicationCatalogItem)
async def get_medication_details(medication_id: str):
    """Get detailed information about a specific medication."""
    medication = next((med for med in MEDICATIONS if med["id"] == medication_id), None)
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    return medication

@router.get("/lab-tests/{test_id}", response_model=LabTestCatalogItem)
async def get_lab_test_details(test_id: str):
    """Get detailed information about a specific lab test."""
    test = next((test for test in LAB_TESTS if test["id"] == test_id), None)
    if not test:
        raise HTTPException(status_code=404, detail="Lab test not found")
    return test

@router.get("/imaging-studies/{study_id}", response_model=ImagingStudyCatalogItem)
async def get_imaging_study_details(study_id: str):
    """Get detailed information about a specific imaging study."""
    study = next((study for study in IMAGING_STUDIES if study["id"] == study_id), None)
    if not study:
        raise HTTPException(status_code=404, detail="Imaging study not found")
    return study