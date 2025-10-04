"""
FHIR Core Utilities

Shared utility functions for FHIR operations.
"""

from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)


async def search_all_resources(
    storage,  # FHIRStorageEngine - avoid circular import
    resource_type: str,
    search_params: Dict[str, Any],
    page_size: int = 1000,
    max_resources: int = 100000
) -> List[Dict[str, Any]]:
    """
    Search for all resources matching criteria, handling pagination automatically.
    
    Args:
        storage: FHIR storage engine instance
        resource_type: Type of resource to search
        search_params: Parsed search parameters
        page_size: Number of resources to fetch per page (default 1000)
        max_resources: Maximum total resources to return (safety limit, default 100000)
        
    Returns:
        List of all matching resources
    """
    all_resources = []
    offset = 0
    
    while True:
        resources, total_count = await storage.search_resources(
            resource_type,
            search_params,
            offset=offset,
            limit=page_size
        )
        
        all_resources.extend(resources)
        
        # Check if we have all resources
        if offset + len(resources) >= total_count:
            break
            
        offset += page_size
        
        # Safety check to prevent excessive memory usage
        if offset >= max_resources:
            logger.warning(
                f"Stopping search at {offset} resources (limit: {max_resources}) "
                f"out of {total_count} total to prevent excessive memory usage"
            )
            break
    
    logger.debug(f"Retrieved {len(all_resources)} {resource_type} resources")
    return all_resources