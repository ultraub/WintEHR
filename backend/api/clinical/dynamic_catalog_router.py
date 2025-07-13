"""
Dynamic Catalog API Router
Provides API endpoints for dynamic catalogs extracted from patient FHIR data
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
import logging

from database import get_db_session
from services.dynamic_catalog_service import DynamicCatalogService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/clinical/dynamic-catalog", tags=["Dynamic Clinical Catalogs"])


async def get_catalog_service(db: AsyncSession = Depends(get_db_session)) -> DynamicCatalogService:
    """Dependency to get catalog service instance."""
    return DynamicCatalogService(db)


@router.get("/medications")
async def get_dynamic_medication_catalog(
    search: Optional[str] = Query(None, description="Search term for medication"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    service: DynamicCatalogService = Depends(get_catalog_service)
) -> List[Dict[str, Any]]:
    """
    Get medication catalog extracted from actual patient MedicationRequest/MedicationStatement data.
    
    Returns medications with:
    - Frequency counts from actual usage
    - Common dosing patterns
    - RxNorm codes where available
    """
    try:
        medications = await service.extract_medication_catalog(limit)
        
        # Apply search filter if provided
        if search:
            search_lower = search.lower()
            medications = [
                med for med in medications
                if search_lower in med.get("display", "").lower() or
                   search_lower in med.get("code", "").lower()
            ]
        
        return medications
    except Exception as e:
        logger.error(f"Error extracting medication catalog: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract medication catalog")


@router.get("/conditions")
async def get_dynamic_condition_catalog(
    search: Optional[str] = Query(None, description="Search term for condition"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    service: DynamicCatalogService = Depends(get_catalog_service)
) -> List[Dict[str, Any]]:
    """
    Get condition catalog extracted from actual patient Condition data.
    
    Returns conditions with:
    - Frequency counts from actual diagnoses
    - Common severity levels
    - SNOMED codes where available
    """
    try:
        conditions = await service.extract_condition_catalog(limit)
        
        # Apply search filter if provided
        if search:
            search_lower = search.lower()
            conditions = [
                cond for cond in conditions
                if search_lower in cond.get("display", "").lower() or
                   search_lower in cond.get("code", "").lower()
            ]
        
        return conditions
    except Exception as e:
        logger.error(f"Error extracting condition catalog: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract condition catalog")


@router.get("/lab-tests")
async def get_dynamic_lab_test_catalog(
    search: Optional[str] = Query(None, description="Search term for lab test"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    service: DynamicCatalogService = Depends(get_catalog_service)
) -> List[Dict[str, Any]]:
    """
    Get lab test catalog extracted from actual patient Observation data.
    
    Returns lab tests with:
    - Reference ranges calculated from actual patient data (5th-95th percentile)
    - Frequency counts from actual orders
    - LOINC codes
    - Value statistics (min, max, average)
    """
    try:
        lab_tests = await service.extract_lab_test_catalog(limit)
        
        # Apply search filter if provided
        if search:
            search_lower = search.lower()
            lab_tests = [
                lab for lab in lab_tests
                if search_lower in lab.get("display", "").lower() or
                   search_lower in lab.get("loinc_code", "").lower()
            ]
        
        return lab_tests
    except Exception as e:
        logger.error(f"Error extracting lab test catalog: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract lab test catalog")


@router.get("/procedures")
async def get_dynamic_procedure_catalog(
    search: Optional[str] = Query(None, description="Search term for procedure"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    service: DynamicCatalogService = Depends(get_catalog_service)
) -> List[Dict[str, Any]]:
    """
    Get procedure catalog extracted from actual patient Procedure data.
    
    Returns procedures with:
    - Frequency counts from actual procedures performed
    - Common categories
    - SNOMED codes where available
    """
    try:
        procedures = await service.extract_procedure_catalog(limit)
        
        # Apply search filter if provided
        if search:
            search_lower = search.lower()
            procedures = [
                proc for proc in procedures
                if search_lower in proc.get("display", "").lower() or
                   search_lower in proc.get("code", "").lower()
            ]
        
        return procedures
    except Exception as e:
        logger.error(f"Error extracting procedure catalog: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract procedure catalog")


@router.get("/statistics")
async def get_catalog_statistics(
    service: DynamicCatalogService = Depends(get_catalog_service)
) -> Dict[str, Any]:
    """
    Get statistics about the dynamic catalogs including:
    - Resource counts by type
    - Cache status
    - Last refresh time
    """
    try:
        return await service.get_catalog_statistics()
    except Exception as e:
        logger.error(f"Error getting catalog statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get catalog statistics")


@router.post("/refresh")
async def refresh_all_catalogs(
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Limit for each catalog"),
    service: DynamicCatalogService = Depends(get_catalog_service)
) -> Dict[str, Any]:
    """
    Force refresh of all dynamic catalogs.
    
    This will:
    - Clear existing cache
    - Re-extract all catalogs from current patient data
    - Return summary of refresh results
    """
    try:
        summary = await service.refresh_all_catalogs(limit)
        return {
            "success": True,
            "message": "All dynamic catalogs refreshed successfully",
            **summary
        }
    except Exception as e:
        logger.error(f"Error refreshing catalogs: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh catalogs")


@router.delete("/cache")
async def clear_catalog_cache(
    service: DynamicCatalogService = Depends(get_catalog_service)
) -> Dict[str, str]:
    """Clear the catalog cache."""
    try:
        service.clear_cache()
        return {"success": True, "message": "Catalog cache cleared successfully"}
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")


@router.get("/search")
async def search_all_catalogs(
    query: str = Query(..., min_length=2, description="Search term"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results per category"),
    service: DynamicCatalogService = Depends(get_catalog_service)
) -> Dict[str, Any]:
    """
    Search across all dynamic catalogs simultaneously.
    
    Returns results grouped by catalog type.
    """
    try:
        # Search each catalog type
        medications = await get_dynamic_medication_catalog(search=query, limit=limit, service=service)
        conditions = await get_dynamic_condition_catalog(search=query, limit=limit, service=service)
        lab_tests = await get_dynamic_lab_test_catalog(search=query, limit=limit, service=service)
        procedures = await get_dynamic_procedure_catalog(search=query, limit=limit, service=service)
        
        return {
            "medications": medications[:limit],
            "conditions": conditions[:limit],
            "lab_tests": lab_tests[:limit],
            "procedures": procedures[:limit],
            "query": query,
            "total_results": len(medications) + len(conditions) + len(lab_tests) + len(procedures)
        }
    except Exception as e:
        logger.error(f"Error searching catalogs: {e}")
        raise HTTPException(status_code=500, detail="Failed to search catalogs")