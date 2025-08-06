"""
Unified Catalog Router

Single endpoint for all clinical catalog needs.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from database import get_db_session
from .service import UnifiedCatalogService
from .models import (
    MedicationCatalogItem,
    LabTestCatalogItem,
    ImagingStudyCatalogItem,
    ConditionCatalogItem,
    OrderSetItem,
    ProcedureCatalogItem,
    VaccineCatalogItem,
    AllergyCatalogItem,
    CatalogSearchResult
)

router = APIRouter(prefix="/api/catalogs", tags=["Clinical Catalogs"])


async def get_catalog_service(db: AsyncSession = Depends(get_db_session)) -> UnifiedCatalogService:
    """Get catalog service instance"""
    return UnifiedCatalogService(db)


@router.get("/medications", response_model=List[MedicationCatalogItem])
async def search_medications(
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, ge=1, le=500),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Search medication catalog.
    
    Data sources (in priority order):
    1. Dynamic FHIR data - extracted from actual patient medications
    2. Database catalog - curated medication list
    3. Static catalog - fallback data
    """
    return await service.search_medications(search, limit)


@router.get("/lab-tests", response_model=List[LabTestCatalogItem])
async def search_lab_tests(
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, ge=1, le=500),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Search lab test catalog.
    
    Includes reference ranges calculated from actual patient data when available.
    """
    return await service.search_lab_tests(search, limit)


@router.get("/conditions", response_model=List[ConditionCatalogItem])
async def search_conditions(
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, ge=1, le=500),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Search condition/diagnosis catalog.
    
    Data sources (in priority order):
    1. Dynamic FHIR data - extracted from actual patient conditions
    2. Database catalog - curated condition list
    3. Static catalog - fallback data
    """
    return await service.search_conditions(search, limit)


@router.get("/imaging-studies", response_model=List[ImagingStudyCatalogItem])
async def search_imaging_studies(
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, ge=1, le=500),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """Search imaging study catalog"""
    return await service.search_imaging_studies(search, limit)


@router.get("/order-sets", response_model=List[OrderSetItem])
async def search_order_sets(
    search: Optional[str] = Query(None, description="Search term"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=500),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Search order set catalog.
    
    Data sources (in priority order):
    1. Dynamic FHIR data - extracted from CarePlans and PlanDefinitions
    2. Common order patterns - detected from grouped ServiceRequests
    3. Static catalog - pre-defined common order sets
    
    Filter by:
    - search: Search in name, description, and item names
    - category: Filter by category (Admission, Emergency, Surgical, etc.)
    """
    return await service.search_order_sets(search, category, limit)


@router.get("/procedures", response_model=List[ProcedureCatalogItem])
async def search_procedures(
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, ge=1, le=500),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Search procedure catalog.
    
    Data sources (in priority order):
    1. Dynamic FHIR data - extracted from actual patient procedures
    2. Static catalog - common CPT procedures
    """
    return await service.search_procedures(search, limit)


@router.get("/vaccines", response_model=List[VaccineCatalogItem])
async def search_vaccines(
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, ge=1, le=500),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Search vaccine/immunization catalog.
    
    Data sources (in priority order):
    1. Dynamic FHIR data - extracted from patient immunization records
    2. Static catalog - common vaccines with CVX codes
    """
    return await service.search_vaccines(search, limit)


@router.get("/allergies", response_model=List[AllergyCatalogItem])
async def search_allergies(
    search: Optional[str] = Query(None, description="Search term"),
    allergen_type: Optional[str] = Query(None, description="Filter by type: medication, food, environmental"),
    limit: int = Query(50, ge=1, le=500),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Search allergy catalog.
    
    Data sources (in priority order):
    1. Dynamic FHIR data - extracted from patient allergy records
    2. Static catalog - common allergens
    
    Filter by:
    - search: Search in allergen name
    - allergen_type: medication, food, environmental, or other
    """
    return await service.search_allergies(search, allergen_type, limit)


@router.get("/search", response_model=CatalogSearchResult)
async def search_all_catalogs(
    q: str = Query(..., min_length=2, description="Search query"),
    limit_per_type: int = Query(10, ge=1, le=50),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Search across all catalog types.
    
    Returns results from medications, lab tests, imaging studies, and order sets.
    """
    return await service.search_all_catalogs(q, limit_per_type)


@router.post("/refresh")
async def refresh_dynamic_catalogs(
    limit: int = Query(100, ge=10, le=1000),
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """
    Refresh dynamic catalogs from FHIR data.
    
    This extracts fresh catalog data from patient resources.
    """
    try:
        await service.dynamic_service.refresh_all_catalogs(limit)
        return {"message": "Dynamic catalogs refreshed successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh catalogs: {str(e)}"
        )


@router.get("/stats")
async def get_catalog_stats(
    service: UnifiedCatalogService = Depends(get_catalog_service)
):
    """Get statistics about available catalog data"""
    # TODO: Implement catalog statistics
    return {
        "medications": {
            "dynamic": 0,
            "database": 0,
            "static": len(service._static_catalogs.get('medications', []))
        },
        "lab_tests": {
            "dynamic": 0,
            "database": 0,
            "static": len(service._static_catalogs.get('lab_tests', []))
        },
        "imaging_studies": {
            "dynamic": 0,
            "database": 0,
            "static": len(service._static_catalogs.get('imaging_studies', []))
        }
    }