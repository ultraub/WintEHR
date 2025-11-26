"""
FHIR Search Parameter Distinct Values API

Provides distinct values for token-type search parameters using FHIR API operations.

Architecture:
- Uses SearchValueCache service for all search value operations
- SearchValueCache uses HAPIFHIRClient for FHIR API operations (no direct DB access)
- Results are cached with TTL for performance
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import logging

from api.services.fhir.search_value_cache import (
    get_search_value_cache,
    SearchValueCache,
)
from shared.exceptions import FHIRConnectionError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fhir/search-values", tags=["fhir-search-values"])


def get_cache() -> SearchValueCache:
    """Get the search value cache service instance."""
    return get_search_value_cache()


@router.get("/{resource_type}/{parameter_name}")
async def get_distinct_values(
    resource_type: str,
    parameter_name: str,
    limit: int = Query(default=100, description="Maximum number of distinct values to return"),
    cache: SearchValueCache = Depends(get_cache)
):
    """
    Get distinct values for a specific search parameter.

    This is particularly useful for token-type parameters like gender, status, etc.
    Uses FHIR API operations through SearchValueCache service.

    Args:
        resource_type: FHIR resource type (e.g., "Patient", "Observation")
        parameter_name: Search parameter name (e.g., "gender", "status")
        limit: Maximum number of distinct values to return (default: 100)

    Returns:
        Dict with resource_type, parameter, values list, and total count
    """
    try:
        result = await cache.get_distinct_values(
            resource_type=resource_type,
            parameter_name=parameter_name,
            limit=limit
        )
        return result

    except FHIRConnectionError as e:
        logger.error(f"FHIR connection error getting distinct values: {e}")
        raise HTTPException(
            status_code=503,
            detail="FHIR server unavailable"
        )
    except Exception as e:
        logger.error(f"Error getting distinct values: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get distinct values: {str(e)}"
        )


@router.get("/{resource_type}")
async def get_searchable_parameters(
    resource_type: str,
    cache: SearchValueCache = Depends(get_cache)
):
    """
    Get all searchable parameters for a resource type.

    Queries the FHIR server's CapabilityStatement to get supported
    search parameters for the specified resource type.

    Args:
        resource_type: FHIR resource type (e.g., "Patient", "Observation")

    Returns:
        Dict with resource_type, parameters list, and total count
    """
    try:
        result = await cache.get_searchable_parameters(resource_type=resource_type)
        return result

    except FHIRConnectionError as e:
        logger.error(f"FHIR connection error getting searchable parameters: {e}")
        raise HTTPException(
            status_code=503,
            detail="FHIR server unavailable"
        )
    except Exception as e:
        logger.error(f"Error getting searchable parameters: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get searchable parameters: {str(e)}"
        )


@router.post("/cache/invalidate")
async def invalidate_search_value_cache(
    resource_type: Optional[str] = None,
    parameter_name: Optional[str] = None,
    cache: SearchValueCache = Depends(get_cache)
):
    """
    Invalidate cached search values.

    Use this endpoint when data has changed and cached values
    need to be refreshed.

    Args:
        resource_type: Optional - invalidate all cache for this resource type
        parameter_name: Optional - if resource_type also given, invalidate specific parameter

    Returns:
        Confirmation message
    """
    cache.invalidate_cache(resource_type=resource_type, parameter_name=parameter_name)

    if resource_type and parameter_name:
        return {"message": f"Cache invalidated for {resource_type}.{parameter_name}"}
    elif resource_type:
        return {"message": f"Cache invalidated for all {resource_type} parameters"}
    else:
        return {"message": "All search value cache cleared"}
