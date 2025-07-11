"""
Catalog Extraction API Router

Provides endpoints to extract and retrieve catalogs from patient FHIR data.
"""

from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db_session
from services.catalog_extractor import CatalogExtractor
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/catalogs/extracted", tags=["Extracted Catalogs"])

# Cache for extracted data to avoid re-extraction on every request
_extracted_cache: Optional[Dict[str, Any]] = None
_cache_timestamp: Optional[datetime] = None
_cache_duration_minutes = 60  # Cache for 1 hour


# Pydantic models for responses
class ExtractedMedication(BaseModel):
    id: str
    rxnorm_code: str
    display_name: str
    generic_name: str
    strength: str
    dosage_form: str
    occurrence_count: int
    last_seen: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "med_313820",
                "rxnorm_code": "313820",
                "display_name": "Acetaminophen 160 MG Chewable Tablet",
                "generic_name": "Acetaminophen",
                "strength": "160 MG",
                "dosage_form": "Chewable Tablet",
                "occurrence_count": 5,
                "last_seen": "2024-01-15T10:30:00Z"
            }
        }


class ExtractedCondition(BaseModel):
    id: str
    snomed_code: str
    display_name: str
    condition_name: str
    is_disorder: bool
    is_finding: bool
    occurrence_count: int
    active_count: int
    last_seen: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "cond_44054006",
                "snomed_code": "44054006",
                "display_name": "Diabetes mellitus type 2 (disorder)",
                "condition_name": "Diabetes mellitus type 2",
                "is_disorder": True,
                "is_finding": False,
                "occurrence_count": 10,
                "active_count": 8,
                "last_seen": "2024-01-15T10:30:00Z"
            }
        }


class ExtractedLabTest(BaseModel):
    id: str
    loinc_code: str
    display_name: str
    test_name: str
    specimen_type: str
    unit: str
    reference_range: Optional[Dict[str, Any]] = None
    occurrence_count: int
    has_values: bool
    last_seen: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "lab_2160-0",
                "loinc_code": "2160-0",
                "display_name": "Creatinine [Mass/volume] in Serum or Plasma",
                "test_name": "Creatinine [Mass/volume] in Serum or Plasma",
                "specimen_type": "Serum or Plasma",
                "unit": "mg/dL",
                "reference_range": {"low": 0.6, "high": 1.2, "text": "0.6-1.2 mg/dL"},
                "occurrence_count": 25,
                "has_values": True,
                "last_seen": "2024-01-15T10:30:00Z"
            }
        }


class ExtractionSummary(BaseModel):
    medications: Dict[str, int]
    conditions: Dict[str, int]
    lab_tests: Dict[str, int]
    metadata: Dict[str, Any]
    
    class Config:
        json_schema_extra = {
            "example": {
                "medications": {
                    "total": 50,
                    "unique_rxnorm_codes": 50,
                    "total_occurrences": 250
                },
                "conditions": {
                    "total": 30,
                    "unique_snomed_codes": 30,
                    "total_occurrences": 150,
                    "active_conditions": 20
                },
                "lab_tests": {
                    "total": 40,
                    "unique_loinc_codes": 40,
                    "total_occurrences": 500,
                    "tests_with_values": 35
                },
                "metadata": {
                    "last_extraction": "2024-01-15T10:30:00Z",
                    "patient_count": 100,
                    "resource_counts": {
                        "MedicationRequest": 50,
                        "Condition": 30,
                        "Observation": 40
                    }
                }
            }
        }


class ExtractionStatus(BaseModel):
    status: str
    message: str
    last_extraction: Optional[str] = None
    cache_expires_at: Optional[str] = None


async def get_or_extract_catalogs(db: AsyncSession, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Get extracted catalogs from cache or extract if needed.
    
    Args:
        db: Database session
        force_refresh: Force re-extraction even if cache is valid
    
    Returns:
        Dictionary containing extracted catalog data
    """
    global _extracted_cache, _cache_timestamp
    
    # Check if we need to extract
    need_extraction = (
        force_refresh or
        _extracted_cache is None or
        _cache_timestamp is None or
        (datetime.utcnow() - _cache_timestamp).total_seconds() > (_cache_duration_minutes * 60)
    )
    
    if need_extraction:
        logger.info("Extracting catalogs from FHIR resources...")
        extractor = CatalogExtractor(db)
        _extracted_cache = await extractor.extract_all_catalogs()
        _cache_timestamp = datetime.utcnow()
        logger.info("Catalog extraction complete")
    
    return _extracted_cache


@router.post("/extract", response_model=ExtractionStatus)
async def trigger_extraction(
    background_tasks: BackgroundTasks,
    force: bool = Query(False, description="Force re-extraction even if cache is valid"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Trigger extraction of catalogs from patient FHIR data.
    
    The extraction runs in the background and results are cached.
    """
    global _cache_timestamp
    
    # Check if extraction is needed
    if not force and _cache_timestamp and (datetime.utcnow() - _cache_timestamp).total_seconds() < (_cache_duration_minutes * 60):
        cache_expires = _cache_timestamp.replace(microsecond=0) + timedelta(minutes=_cache_duration_minutes)
        return ExtractionStatus(
            status="cached",
            message=f"Using cached data. Cache expires in {int((cache_expires - datetime.utcnow()).total_seconds() / 60)} minutes.",
            last_extraction=_cache_timestamp.isoformat() if _cache_timestamp else None,
            cache_expires_at=cache_expires.isoformat()
        )
    
    # Trigger extraction
    async def extract_in_background():
        await get_or_extract_catalogs(db, force_refresh=True)
    
    background_tasks.add_task(extract_in_background)
    
    return ExtractionStatus(
        status="extracting",
        message="Catalog extraction started in background. Results will be available shortly.",
        last_extraction=_cache_timestamp.isoformat() if _cache_timestamp else None
    )


@router.get("/summary", response_model=ExtractionSummary)
async def get_extraction_summary(
    db: AsyncSession = Depends(get_db_session)
):
    """Get summary of extracted catalog data."""
    data = await get_or_extract_catalogs(db)
    extractor = CatalogExtractor(db)
    extractor.extracted_data = data
    return extractor.get_extraction_summary()


@router.get("/medications", response_model=List[ExtractedMedication])
async def get_extracted_medications(
    search: Optional[str] = Query(None, description="Search term for medication name"),
    min_occurrences: int = Query(1, ge=1, description="Minimum number of occurrences"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get extracted medications from patient data.
    
    Medications are sorted by occurrence count (most common first).
    """
    data = await get_or_extract_catalogs(db)
    extractor = CatalogExtractor(db)
    extractor.extracted_data = data
    
    medications = extractor.get_medications_list(
        search_term=search,
        min_occurrences=min_occurrences,
        limit=limit
    )
    
    return medications


@router.get("/conditions", response_model=List[ExtractedCondition])
async def get_extracted_conditions(
    search: Optional[str] = Query(None, description="Search term for condition name"),
    active_only: bool = Query(False, description="Only show conditions with active cases"),
    min_occurrences: int = Query(1, ge=1, description="Minimum number of occurrences"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get extracted conditions from patient data.
    
    Conditions are sorted by occurrence count (most common first).
    """
    data = await get_or_extract_catalogs(db)
    extractor = CatalogExtractor(db)
    extractor.extracted_data = data
    
    conditions = extractor.get_conditions_list(
        search_term=search,
        active_only=active_only,
        min_occurrences=min_occurrences,
        limit=limit
    )
    
    return conditions


@router.get("/lab-tests", response_model=List[ExtractedLabTest])
async def get_extracted_lab_tests(
    search: Optional[str] = Query(None, description="Search term for lab test name"),
    specimen_type: Optional[str] = Query(None, description="Filter by specimen type (e.g., Blood, Urine)"),
    min_occurrences: int = Query(1, ge=1, description="Minimum number of occurrences"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get extracted lab tests from patient data.
    
    Lab tests are sorted by occurrence count (most common first).
    """
    data = await get_or_extract_catalogs(db)
    extractor = CatalogExtractor(db)
    extractor.extracted_data = data
    
    lab_tests = extractor.get_lab_tests_list(
        search_term=search,
        specimen_type=specimen_type,
        min_occurrences=min_occurrences,
        limit=limit
    )
    
    return lab_tests


@router.get("/specimen-types")
async def get_specimen_types(
    db: AsyncSession = Depends(get_db_session)
):
    """Get list of unique specimen types from extracted lab tests."""
    data = await get_or_extract_catalogs(db)
    
    specimen_types = set()
    for test in data.get("lab_tests", {}).values():
        if test.get("specimen_type") and test["specimen_type"] != "Unknown":
            specimen_types.add(test["specimen_type"])
    
    return sorted(list(specimen_types))


@router.get("/dosage-forms")
async def get_dosage_forms(
    db: AsyncSession = Depends(get_db_session)
):
    """Get list of unique dosage forms from extracted medications."""
    data = await get_or_extract_catalogs(db)
    
    dosage_forms = set()
    for med in data.get("medications", {}).values():
        if med.get("dosage_form") and med["dosage_form"] != "Unknown":
            dosage_forms.add(med["dosage_form"])
    
    return sorted(list(dosage_forms))


@router.delete("/cache")
async def clear_extraction_cache():
    """Clear the extraction cache to force re-extraction on next request."""
    global _extracted_cache, _cache_timestamp
    
    _extracted_cache = None
    _cache_timestamp = None
    
    return {
        "status": "success",
        "message": "Extraction cache cleared. Next request will trigger fresh extraction."
    }