"""
FHIR Relationships API Router

Provides endpoints for discovering and analyzing relationships between FHIR resources.
Used by the FHIR Explorer RelationshipMapper component.

Architecture:
- Uses RelationshipCache service for all relationship operations
- RelationshipCache uses HAPIFHIRClient for FHIR API operations (no direct DB access)
- Results are cached with TTL for performance
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Optional, Any
import logging

from api.services.fhir.relationship_cache import (
    get_relationship_cache,
    RelationshipCache,
)
from shared.exceptions import FHIRConnectionError, FHIRResourceNotFoundError

from api.fhir.reference_fields import REFERENCE_FIELDS as CANONICAL_REFERENCE_FIELDS

logger = logging.getLogger(__name__)

relationships_router = APIRouter(
    prefix="/api/fhir-relationships",
    tags=["fhir-relationships"]
)


# FHIR reference field mappings by resource type
# Comprehensive schema for the /schema endpoint
# Derived from the shared canonical map (api/fhir/reference_fields.py —
# bug B5): this endpoint's schema shape, one entry per canonical field.
REFERENCE_FIELDS = {
    rt: {f: {"target": m["targets"], "type": m["type"]} for f, m in fields.items()}
    for rt, fields in CANONICAL_REFERENCE_FIELDS.items()
}



def get_cache() -> RelationshipCache:
    """Get the relationship cache service instance."""
    return get_relationship_cache()


@relationships_router.get("/schema")
async def get_relationship_schema():
    """
    Get the complete FHIR relationship schema.

    Returns all possible relationships between resource types.
    Uses the comprehensive schema defined in this router.
    """
    return {
        "resourceTypes": list(REFERENCE_FIELDS.keys()),
        "relationships": REFERENCE_FIELDS,
        "totalResourceTypes": len(REFERENCE_FIELDS)
    }


@relationships_router.get("/discover/{resource_type}/{resource_id}")
async def discover_relationships(
    resource_type: str,
    resource_id: str,
    depth: int = Query(1, ge=1, le=3, description="How many hops to traverse"),
    include_counts: bool = Query(True, description="Include relationship counts"),
    cache: RelationshipCache = Depends(get_cache)
):
    """
    Discover actual relationships for a specific resource instance.

    Returns connected resources with relationship metadata.
    Uses FHIR API operations through RelationshipCache service.

    Args:
        resource_type: FHIR resource type (e.g., "Patient", "Observation")
        resource_id: Resource identifier
        depth: How many relationship hops to traverse (1-3)
        include_counts: Include relationship counts in results

    Returns:
        Dict with source resource, nodes, links, and relationships
    """
    try:
        result = await cache.discover_relationships(
            resource_type=resource_type,
            resource_id=resource_id,
            depth=depth,
            include_counts=include_counts
        )
        return result

    except FHIRResourceNotFoundError:
        logger.warning(f"Resource not found: {resource_type}/{resource_id}")
        raise HTTPException(
            status_code=404,
            detail=f"{resource_type}/{resource_id} not found"
        )
    except FHIRConnectionError as e:
        logger.error(f"FHIR connection error discovering relationships: {e}")
        raise HTTPException(
            status_code=503,
            detail="FHIR server unavailable"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error discovering relationships: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@relationships_router.get("/statistics")
async def get_relationship_statistics(
    resource_type: Optional[str] = None,
    cache: RelationshipCache = Depends(get_cache)
):
    """
    Get statistical information about relationships.

    Uses FHIR API searches to count resources and analyze connectivity.
    Useful for understanding data patterns and resource distribution.

    Args:
        resource_type: Optional - filter statistics to specific resource type

    Returns:
        Dict with totalResources, resourceTypeCounts, and mostConnectedTypes
    """
    try:
        stats = await cache.get_relationship_statistics(resource_type=resource_type)
        return stats

    except FHIRConnectionError as e:
        logger.error(f"FHIR connection error getting statistics: {e}")
        raise HTTPException(
            status_code=503,
            detail="FHIR server unavailable"
        )
    except Exception as e:
        logger.error(f"Error getting relationship statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@relationships_router.get("/paths")
async def find_relationship_paths(
    source_type: str,
    source_id: str,
    target_type: str,
    target_id: str,
    max_depth: int = Query(3, ge=1, le=5),
    cache: RelationshipCache = Depends(get_cache)
):
    """
    Find all paths between two resources.

    Uses breadth-first search through FHIR references to discover
    how resources are connected. Useful for understanding relationships.

    Args:
        source_type: Source resource type
        source_id: Source resource identifier
        target_type: Target resource type
        target_id: Target resource identifier
        max_depth: Maximum path length to search (1-5)

    Returns:
        Dict with source, target, paths list, and pathCount
    """
    try:
        result = await cache.find_relationship_paths(
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
            max_depth=max_depth
        )
        return result

    except FHIRResourceNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Source or target resource not found"
        )
    except FHIRConnectionError as e:
        logger.error(f"FHIR connection error finding paths: {e}")
        raise HTTPException(
            status_code=503,
            detail="FHIR server unavailable"
        )
    except Exception as e:
        logger.error(f"Error finding relationship paths: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@relationships_router.post("/cache/invalidate")
async def invalidate_relationship_cache(
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    cache: RelationshipCache = Depends(get_cache)
):
    """
    Invalidate cached relationship data.

    Use this endpoint when data has changed and cached relationships
    need to be refreshed.

    Args:
        resource_type: Optional - invalidate all cache for this resource type
        resource_id: Optional - if resource_type also given, invalidate specific resource

    Returns:
        Confirmation message
    """
    cache.invalidate_cache(resource_type=resource_type, resource_id=resource_id)

    if resource_type and resource_id:
        return {"message": f"Cache invalidated for {resource_type}/{resource_id}"}
    elif resource_type:
        return {"message": f"Cache invalidated for all {resource_type} resources"}
    else:
        return {"message": "All relationship cache cleared"}
