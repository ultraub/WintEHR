"""
Simple in-memory cache for FHIR search results

This provides basic caching to improve performance without requiring Redis.
Cache entries expire after a configurable TTL.
"""

import time
import hashlib
import json
from typing import Dict, Any, Optional, Tuple
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)


class SearchCache:
    """
    Simple LRU cache for search results with TTL support.
    """
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        """
        Initialize the cache.
        
        Args:
            max_size: Maximum number of entries to cache
            default_ttl: Default time-to-live in seconds (5 minutes)
        """
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, Tuple[Any, float]] = OrderedDict()
        self._hits = 0
        self._misses = 0
    
    def _make_key(self, resource_type: str, params: Dict[str, Any]) -> str:
        """
        Generate a cache key from resource type and search parameters.
        """
        # Convert params to a serializable format
        serializable_params = {}
        for k, v in params.items():
            if hasattr(v, 'isoformat'):  # datetime objects
                serializable_params[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                # Convert nested structures
                serializable_params[k] = str(v)
            else:
                serializable_params[k] = v
        
        # Sort params for consistent keys
        sorted_params = sorted(serializable_params.items())
        key_string = f"{resource_type}:{json.dumps(sorted_params, sort_keys=True)}"
        # Use hash for shorter keys
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def get(self, resource_type: str, params: Dict[str, Any]) -> Optional[Tuple[list, int]]:
        """
        Get cached search results if available and not expired.
        
        Returns:
            Tuple of (resources, total) if found and valid, None otherwise
        """
        key = self._make_key(resource_type, params)
        
        if key in self._cache:
            result, expiry = self._cache[key]
            if time.time() < expiry:
                # Move to end (most recently used)
                self._cache.move_to_end(key)
                self._hits += 1
                logger.debug(f"Cache hit for {resource_type} search")
                return result
            else:
                # Expired, remove it
                del self._cache[key]
                logger.debug(f"Cache expired for {resource_type} search")
        
        self._misses += 1
        return None
    
    def set(self, resource_type: str, params: Dict[str, Any], 
            resources: list, total: int, ttl: Optional[int] = None):
        """
        Cache search results.
        
        Args:
            resource_type: FHIR resource type
            params: Search parameters
            resources: List of resources
            total: Total count
            ttl: Time-to-live in seconds (uses default if not specified)
        """
        key = self._make_key(resource_type, params)
        expiry = time.time() + (ttl or self.default_ttl)
        
        # Add to cache
        self._cache[key] = ((resources, total), expiry)
        self._cache.move_to_end(key)
        
        # Remove oldest if over size limit
        while len(self._cache) > self.max_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            logger.debug("Evicted oldest cache entry")
    
    def invalidate_resource_type(self, resource_type: str):
        """
        Invalidate all cache entries for a specific resource type.
        Called when resources are created/updated/deleted.
        """
        keys_to_remove = []
        for key in self._cache:
            # Check if this key is for the given resource type
            # Since we hash keys, we need to track resource types separately
            # For now, we'll clear more aggressively
            keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self._cache[key]
        
        if keys_to_remove:
            logger.info(f"Invalidated {len(keys_to_remove)} cache entries for {resource_type}")
    
    def clear(self):
        """Clear all cache entries."""
        self._cache.clear()
        logger.info("Cache cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self._hits + self._misses
        hit_rate = self._hits / total_requests if total_requests > 0 else 0
        
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": hit_rate,
            "total_requests": total_requests
        }


# Global cache instance
_search_cache = SearchCache()


def get_search_cache() -> SearchCache:
    """Get the global search cache instance."""
    return _search_cache


# Cache decorator for search operations
def cache_search(ttl: Optional[int] = None):
    """
    Decorator to cache search results.
    
    Args:
        ttl: Time-to-live in seconds
    """
    def decorator(func):
        async def wrapper(resource_type: str, params: Dict[str, Any], *args, **kwargs):
            cache = get_search_cache()
            
            # Check cache first
            cached_result = cache.get(resource_type, params)
            if cached_result is not None:
                return cached_result
            
            # Call the actual function
            result = await func(resource_type, params, *args, **kwargs)
            
            # Cache the result
            if result and len(result) == 2:  # (resources, total)
                resources, total = result
                cache.set(resource_type, params, resources, total, ttl)
            
            return result
        
        return wrapper
    return decorator