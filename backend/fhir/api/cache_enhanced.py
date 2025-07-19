"""
Enhanced caching system with Redis support and fallback to in-memory cache.

This provides a unified caching interface that automatically uses Redis if available,
otherwise falls back to the in-memory LRU cache.
"""

import os
import time
import json
import hashlib
import logging
from typing import Dict, Any, Optional, Tuple, List, Union
from collections import OrderedDict
from abc import ABC, abstractmethod
import asyncio

logger = logging.getLogger(__name__)

# Try to import Redis
try:
    import aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.info("Redis not available, using in-memory cache only")


class CacheBackend(ABC):
    """Abstract base class for cache backends."""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        pass
    
    @abstractmethod
    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache with optional TTL."""
        pass
    
    @abstractmethod
    async def delete(self, key: str):
        """Delete key from cache."""
        pass
    
    @abstractmethod
    async def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern."""
        pass
    
    @abstractmethod
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        pass


class InMemoryCacheBackend(CacheBackend):
    """In-memory LRU cache backend."""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, Tuple[Any, float]] = OrderedDict()
        self._hits = 0
        self._misses = 0
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        async with self._lock:
            if key in self._cache:
                value, expiry = self._cache[key]
                if time.time() < expiry:
                    # Move to end (most recently used)
                    self._cache.move_to_end(key)
                    self._hits += 1
                    return value
                else:
                    # Expired
                    del self._cache[key]
            
            self._misses += 1
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache."""
        async with self._lock:
            expiry = time.time() + (ttl or self.default_ttl)
            self._cache[key] = (value, expiry)
            self._cache.move_to_end(key)
            
            # Evict oldest if over size limit
            while len(self._cache) > self.max_size:
                self._cache.popitem(last=False)
    
    async def delete(self, key: str):
        """Delete key from cache."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
    
    async def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern."""
        async with self._lock:
            # Simple pattern matching for in-memory cache
            keys_to_delete = [k for k in self._cache.keys() if pattern in k]
            for key in keys_to_delete:
                del self._cache[key]
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total = self._hits + self._misses
        hit_rate = self._hits / total if total > 0 else 0
        
        return {
            "backend": "in-memory",
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": hit_rate,
            "total_requests": total
        }


class RedisCacheBackend(CacheBackend):
    """Redis cache backend."""
    
    def __init__(self, redis_url: str = None, default_ttl: int = 300):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self.default_ttl = default_ttl
        self.redis = None
        self._hits = 0
        self._misses = 0
    
    async def connect(self):
        """Connect to Redis."""
        if not self.redis:
            self.redis = await aioredis.create_redis_pool(self.redis_url, encoding='utf-8')
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis:
            self.redis.close()
            await self.redis.wait_closed()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        await self.connect()
        
        value = await self.redis.get(key)
        if value:
            self._hits += 1
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        else:
            self._misses += 1
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache."""
        await self.connect()
        
        # Serialize value
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        
        # Set with TTL
        expire = ttl or self.default_ttl
        await self.redis.setex(key, expire, value)
    
    async def delete(self, key: str):
        """Delete key from cache."""
        await self.connect()
        await self.redis.delete(key)
    
    async def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern."""
        await self.connect()
        
        # Use SCAN to find matching keys
        cursor = b'0'
        while cursor:
            cursor, keys = await self.redis.scan(cursor, match=f"*{pattern}*")
            if keys:
                await self.redis.delete(*keys)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        await self.connect()
        
        info = await self.redis.info('stats')
        total = self._hits + self._misses
        hit_rate = self._hits / total if total > 0 else 0
        
        return {
            "backend": "redis",
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": hit_rate,
            "total_requests": total,
            "redis_info": {
                "used_memory": info.get('used_memory_human', 'N/A'),
                "connected_clients": info.get('connected_clients', 0),
                "total_commands": info.get('total_commands_processed', 0)
            }
        }


class EnhancedSearchCache:
    """
    Enhanced cache system with automatic backend selection.
    
    Features:
    - Automatic Redis/in-memory selection
    - Unified interface
    - Cache warming
    - Batch operations
    - Metrics tracking
    """
    
    def __init__(self, 
                 max_size: int = 1000,
                 default_ttl: int = 300,
                 use_redis: Optional[bool] = None,
                 redis_url: Optional[str] = None):
        """
        Initialize enhanced cache.
        
        Args:
            max_size: Maximum entries for in-memory cache
            default_ttl: Default TTL in seconds
            use_redis: Force Redis usage (None = auto-detect)
            redis_url: Redis connection URL
        """
        self.default_ttl = default_ttl
        
        # Determine which backend to use
        if use_redis is False:
            self._backend = InMemoryCacheBackend(max_size, default_ttl)
            logger.info("Using in-memory cache backend")
        elif use_redis is True or (use_redis is None and REDIS_AVAILABLE):
            # Try Redis first
            try:
                self._backend = RedisCacheBackend(redis_url, default_ttl)
                logger.info("Using Redis cache backend")
            except Exception as e:
                logger.warning(f"Failed to initialize Redis: {e}, falling back to in-memory cache")
                self._backend = InMemoryCacheBackend(max_size, default_ttl)
        else:
            self._backend = InMemoryCacheBackend(max_size, default_ttl)
            logger.info("Using in-memory cache backend")
    
    def _make_key(self, resource_type: str, params: Dict[str, Any], prefix: str = "fhir") -> str:
        """Generate a cache key from resource type and parameters."""
        # Sort params for consistent keys
        sorted_params = sorted(params.items())
        key_data = f"{resource_type}:{json.dumps(sorted_params, sort_keys=True)}"
        
        # Create a readable but unique key
        param_str = "_".join([f"{k}={v}" for k, v in sorted_params[:3]])  # First 3 params
        hash_suffix = hashlib.md5(key_data.encode()).hexdigest()[:8]
        
        return f"{prefix}:{resource_type}:{param_str}:{hash_suffix}"
    
    async def get_search_results(self, 
                                resource_type: str, 
                                params: Dict[str, Any]) -> Optional[Tuple[List[dict], int]]:
        """Get cached search results."""
        key = self._make_key(resource_type, params)
        return await self._backend.get(key)
    
    async def set_search_results(self,
                                resource_type: str,
                                params: Dict[str, Any],
                                resources: List[dict],
                                total: int,
                                ttl: Optional[int] = None):
        """Cache search results."""
        key = self._make_key(resource_type, params)
        value = (resources, total)
        await self._backend.set(key, value, ttl)
    
    async def get_resource(self, resource_type: str, resource_id: str) -> Optional[dict]:
        """Get cached individual resource."""
        key = f"fhir:resource:{resource_type}:{resource_id}"
        return await self._backend.get(key)
    
    async def set_resource(self, 
                          resource_type: str, 
                          resource_id: str, 
                          resource: dict,
                          ttl: Optional[int] = None):
        """Cache individual resource."""
        key = f"fhir:resource:{resource_type}:{resource_id}"
        await self._backend.set(key, resource, ttl)
    
    async def invalidate_resource_type(self, resource_type: str):
        """Invalidate all cache entries for a resource type."""
        # Clear search results
        await self._backend.clear_pattern(f"fhir:{resource_type}:")
        # Clear individual resources
        await self._backend.clear_pattern(f"fhir:resource:{resource_type}:")
        
        logger.info(f"Invalidated cache for resource type: {resource_type}")
    
    async def invalidate_resource(self, resource_type: str, resource_id: str):
        """Invalidate cache for a specific resource."""
        # Clear the individual resource
        key = f"fhir:resource:{resource_type}:{resource_id}"
        await self._backend.delete(key)
        
        # Also clear search results that might include this resource
        await self._backend.clear_pattern(f"fhir:{resource_type}:")
    
    async def warm_cache(self, common_queries: List[Tuple[str, Dict[str, Any], Any]]):
        """
        Warm cache with common queries.
        
        Args:
            common_queries: List of (resource_type, params, result) tuples
        """
        for resource_type, params, result in common_queries:
            if result and len(result) == 2:  # (resources, total)
                await self.set_search_results(resource_type, params, result[0], result[1])
        
        logger.info(f"Warmed cache with {len(common_queries)} queries")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return await self._backend.get_stats()
    
    async def clear(self):
        """Clear all cache entries."""
        await self._backend.clear_pattern("fhir:")
        logger.info("Cache cleared")


# Global enhanced cache instance
_enhanced_cache: Optional[EnhancedSearchCache] = None


def get_enhanced_cache() -> EnhancedSearchCache:
    """Get the global enhanced cache instance."""
    global _enhanced_cache
    if _enhanced_cache is None:
        _enhanced_cache = EnhancedSearchCache()
    return _enhanced_cache


async def init_cache(use_redis: Optional[bool] = None, redis_url: Optional[str] = None):
    """
    Initialize the cache system.
    
    Args:
        use_redis: Force Redis usage (None = auto-detect)
        redis_url: Redis connection URL
    """
    global _enhanced_cache
    _enhanced_cache = EnhancedSearchCache(use_redis=use_redis, redis_url=redis_url)
    logger.info("Cache system initialized")


async def cleanup_cache():
    """Cleanup cache connections."""
    if _enhanced_cache and isinstance(_enhanced_cache._backend, RedisCacheBackend):
        await _enhanced_cache._backend.disconnect()