"""
FHIR Resource Validation Cache

Implements a high-performance caching layer for FHIR resource validation.
Reduces validation overhead by caching validation results for identical resource structures.
"""

import hashlib
import json
import time
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime, timedelta
import asyncio
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)


class ValidationResult:
    """Container for validation results with metadata."""
    
    def __init__(self, is_valid: bool, errors: List[Dict[str, Any]] = None):
        self.is_valid = is_valid
        self.errors = errors or []
        self.timestamp = time.time()
        self.hit_count = 0
    
    def is_expired(self, ttl_seconds: int) -> bool:
        """Check if this result has expired."""
        return (time.time() - self.timestamp) > ttl_seconds
    
    def increment_hits(self):
        """Increment the hit counter."""
        self.hit_count += 1


class ValidationCache:
    """
    Thread-safe FHIR validation cache with LRU eviction and TTL support.
    
    Features:
    - LRU (Least Recently Used) eviction policy
    - TTL (Time To Live) for cache entries
    - Resource type specific caching
    - Memory usage limits
    - Cache statistics and monitoring
    """
    
    def __init__(
        self,
        max_size: int = 10000,
        ttl_seconds: int = 3600,  # 1 hour default
        enable_stats: bool = True
    ):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.enable_stats = enable_stats
        
        # Separate caches for each resource type
        self._caches: Dict[str, OrderedDict[str, ValidationResult]] = {}
        self._lock = asyncio.Lock()
        
        # Statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "expirations": 0,
            "total_validations_saved": 0
        }
        
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_expired())
    
    def _generate_cache_key(self, resource: Dict[str, Any]) -> str:
        """
        Generate a cache key for a resource based on its structure.
        
        Excludes volatile fields like ids, timestamps, and metadata.
        """
        # Create a normalized copy without volatile fields
        normalized = self._normalize_resource(resource)
        
        # Generate hash from normalized JSON
        json_str = json.dumps(normalized, sort_keys=True)
        return hashlib.sha256(json_str.encode()).hexdigest()
    
    def _normalize_resource(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize a resource for caching by removing volatile fields.
        """
        # Fields to exclude from cache key
        volatile_fields = {
            "id", "meta", "implicitRules", "language",
            "_id", "_revinclude", "_include", "_summary"
        }
        
        # Create a copy without volatile fields
        normalized = {}
        for key, value in resource.items():
            if key not in volatile_fields:
                if isinstance(value, dict):
                    normalized[key] = self._normalize_resource(value)
                elif isinstance(value, list):
                    normalized[key] = [
                        self._normalize_resource(item) if isinstance(item, dict) else item
                        for item in value
                    ]
                else:
                    normalized[key] = value
        
        return normalized
    
    async def get(
        self,
        resource_type: str,
        resource: Dict[str, Any]
    ) -> Optional[Tuple[bool, List[Dict[str, Any]]]]:
        """
        Get validation result from cache if available.
        
        Returns:
            Tuple of (is_valid, errors) if cached, None if not found
        """
        cache_key = self._generate_cache_key(resource)
        
        async with self._lock:
            # Get or create cache for resource type
            if resource_type not in self._caches:
                return None
            
            type_cache = self._caches[resource_type]
            
            # Check if key exists
            if cache_key not in type_cache:
                self._stats["misses"] += 1
                return None
            
            # Get result and check expiration
            result = type_cache[cache_key]
            if result.is_expired(self.ttl_seconds):
                del type_cache[cache_key]
                self._stats["expirations"] += 1
                self._stats["misses"] += 1
                return None
            
            # Move to end (most recently used)
            type_cache.move_to_end(cache_key)
            
            # Update statistics
            result.increment_hits()
            self._stats["hits"] += 1
            self._stats["total_validations_saved"] += 1
            
            return (result.is_valid, result.errors)
    
    async def set(
        self,
        resource_type: str,
        resource: Dict[str, Any],
        is_valid: bool,
        errors: List[Dict[str, Any]] = None
    ):
        """Store validation result in cache."""
        cache_key = self._generate_cache_key(resource)
        
        async with self._lock:
            # Get or create cache for resource type
            if resource_type not in self._caches:
                self._caches[resource_type] = OrderedDict()
            
            type_cache = self._caches[resource_type]
            
            # Check if we need to evict
            if len(type_cache) >= self.max_size // len(self._caches):
                # Evict least recently used
                type_cache.popitem(last=False)
                self._stats["evictions"] += 1
            
            # Store result
            type_cache[cache_key] = ValidationResult(is_valid, errors)
    
    async def clear(self, resource_type: Optional[str] = None):
        """Clear cache for a specific resource type or all caches."""
        async with self._lock:
            if resource_type:
                if resource_type in self._caches:
                    self._caches[resource_type].clear()
            else:
                self._caches.clear()
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.enable_stats:
            return {}
        
        async with self._lock:
            total_entries = sum(len(cache) for cache in self._caches.values())
            hit_rate = (
                self._stats["hits"] / (self._stats["hits"] + self._stats["misses"])
                if (self._stats["hits"] + self._stats["misses"]) > 0
                else 0
            )
            
            # Calculate memory usage (approximate)
            avg_entry_size = 1024  # 1KB average per entry
            memory_usage_mb = (total_entries * avg_entry_size) / (1024 * 1024)
            
            return {
                "total_entries": total_entries,
                "entries_by_type": {
                    rtype: len(cache) for rtype, cache in self._caches.items()
                },
                "hit_rate": hit_rate,
                "hits": self._stats["hits"],
                "misses": self._stats["misses"],
                "evictions": self._stats["evictions"],
                "expirations": self._stats["expirations"],
                "total_validations_saved": self._stats["total_validations_saved"],
                "estimated_memory_mb": round(memory_usage_mb, 2),
                "cache_efficiency": self._calculate_efficiency()
            }
    
    def _calculate_efficiency(self) -> float:
        """Calculate cache efficiency score (0-1)."""
        if self._stats["hits"] == 0:
            return 0.0
        
        # Factors: hit rate, eviction rate, expiration rate
        hit_rate = self._stats["hits"] / (self._stats["hits"] + self._stats["misses"])
        
        total_ops = self._stats["hits"] + self._stats["misses"]
        eviction_rate = self._stats["evictions"] / total_ops if total_ops > 0 else 0
        expiration_rate = self._stats["expirations"] / total_ops if total_ops > 0 else 0
        
        # Higher hit rate is good, lower eviction/expiration rates are good
        efficiency = hit_rate * (1 - eviction_rate * 0.5) * (1 - expiration_rate * 0.3)
        
        return round(efficiency, 3)
    
    async def _cleanup_expired(self):
        """Background task to clean up expired entries."""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                async with self._lock:
                    for resource_type, type_cache in self._caches.items():
                        expired_keys = [
                            key for key, result in type_cache.items()
                            if result.is_expired(self.ttl_seconds)
                        ]
                        
                        for key in expired_keys:
                            del type_cache[key]
                            self._stats["expirations"] += 1
                
                logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cache cleanup task: {e}")
    
    async def close(self):
        """Clean up resources."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass


# Global cache instance
validation_cache = ValidationCache()


# Validation cache decorator for easy integration
def cached_validation(resource_type: str):
    """
    Decorator to add caching to validation functions.
    
    Usage:
        @cached_validation("Patient")
        async def validate_patient(resource: dict) -> Tuple[bool, List[dict]]:
            # validation logic
            return is_valid, errors
    """
    def decorator(func):
        async def wrapper(resource: Dict[str, Any], *args, **kwargs):
            # Try to get from cache
            cached_result = await validation_cache.get(resource_type, resource)
            if cached_result is not None:
                return cached_result
            
            # Perform validation
            result = await func(resource, *args, **kwargs)
            
            # Cache the result
            if isinstance(result, tuple) and len(result) == 2:
                is_valid, errors = result
                await validation_cache.set(resource_type, resource, is_valid, errors)
            
            return result
        
        return wrapper
    return decorator