"""
Redis-based cache for FHIR search results

Provides distributed caching with Redis for improved performance and scalability.
Falls back to in-memory cache if Redis is unavailable.
"""

import time
import hashlib
import json
import redis.asyncio as redis
from typing import Dict, Any, Optional, Tuple
import logging
import pickle
import os
from contextlib import asynccontextmanager

from .cache import SearchCache, get_search_cache

logger = logging.getLogger(__name__)


class RedisSearchCache:
    """
    Redis-based cache for search results with automatic fallback to in-memory cache.
    """
    
    def __init__(
        self,
        redis_url: Optional[str] = None,
        default_ttl: int = 300,
        key_prefix: str = "fhir:search:",
        max_connections: int = 50
    ):
        """
        Initialize the Redis cache.
        
        Args:
            redis_url: Redis connection URL (defaults to localhost)
            default_ttl: Default time-to-live in seconds (5 minutes)
            key_prefix: Prefix for all cache keys
            max_connections: Maximum Redis connections in pool
        """
        self.redis_url = redis_url or os.getenv(
            'REDIS_URL',
            'redis://localhost:6379/0'
        )
        self.default_ttl = default_ttl
        self.key_prefix = key_prefix
        self.max_connections = max_connections
        
        # Fallback to in-memory cache
        self.memory_cache = get_search_cache()
        
        # Redis client (initialized lazily)
        self._redis_client: Optional[redis.Redis] = None
        self._redis_available = True
        
        # Statistics
        self._hits = 0
        self._misses = 0
        self._redis_errors = 0
    
    async def _get_redis_client(self) -> Optional[redis.Redis]:
        """Get or create Redis client with connection pooling."""
        if not self._redis_available:
            return None
        
        if self._redis_client is None:
            try:
                self._redis_client = await redis.from_url(
                    self.redis_url,
                    encoding="utf-8",
                    decode_responses=False,  # We'll handle encoding/decoding
                    max_connections=self.max_connections
                )
                # Test connection
                await self._redis_client.ping()
                logger.info("Redis cache connected successfully")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}")
                self._redis_available = False
                self._redis_client = None
        
        return self._redis_client
    
    def _make_key(self, resource_type: str, params: Dict[str, Any]) -> str:
        """Generate a cache key from resource type and search parameters."""
        # Convert params to a serializable format
        serializable_params = {}
        for k, v in params.items():
            if hasattr(v, 'isoformat'):  # datetime objects
                serializable_params[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                # Convert nested structures
                serializable_params[k] = json.dumps(v, sort_keys=True)
            else:
                serializable_params[k] = str(v)
        
        # Sort params for consistent keys
        sorted_params = sorted(serializable_params.items())
        key_string = f"{resource_type}:{json.dumps(sorted_params, sort_keys=True)}"
        
        # Use hash for shorter keys
        key_hash = hashlib.md5(key_string.encode()).hexdigest()
        return f"{self.key_prefix}{resource_type}:{key_hash}"
    
    async def get(self, resource_type: str, params: Dict[str, Any]) -> Optional[Tuple[list, int]]:
        """
        Get cached search results if available and not expired.
        
        Returns:
            Tuple of (resources, total) if found and valid, None otherwise
        """
        key = self._make_key(resource_type, params)
        
        # Try Redis first
        client = await self._get_redis_client()
        if client:
            try:
                cached_data = await client.get(key)
                if cached_data:
                    result = pickle.loads(cached_data)
                    self._hits += 1
                    logger.debug(f"Redis cache hit for {resource_type} search")
                    return result
            except Exception as e:
                logger.error(f"Redis get error: {e}")
                self._redis_errors += 1
        
        # Fallback to memory cache
        result = self.memory_cache.get(resource_type, params)
        if result:
            self._hits += 1
            return result
        
        self._misses += 1
        return None
    
    async def set(
        self,
        resource_type: str,
        params: Dict[str, Any],
        resources: list,
        total: int,
        ttl: Optional[int] = None
    ):
        """
        Cache search results in Redis and memory.
        
        Args:
            resource_type: FHIR resource type
            params: Search parameters
            resources: List of resources
            total: Total count
            ttl: Time-to-live in seconds
        """
        key = self._make_key(resource_type, params)
        ttl = ttl or self.default_ttl
        data = (resources, total)
        
        # Try Redis first
        client = await self._get_redis_client()
        if client:
            try:
                serialized_data = pickle.dumps(data)
                await client.setex(key, ttl, serialized_data)
                logger.debug(f"Cached {resource_type} search in Redis")
            except Exception as e:
                logger.error(f"Redis set error: {e}")
                self._redis_errors += 1
        
        # Always set in memory cache as backup
        self.memory_cache.set(resource_type, params, resources, total, ttl)
    
    async def invalidate_resource_type(self, resource_type: str):
        """
        Invalidate all cache entries for a specific resource type.
        Called when resources are created/updated/deleted.
        """
        # Invalidate memory cache
        self.memory_cache.invalidate_resource_type(resource_type)
        
        # Invalidate Redis cache
        client = await self._get_redis_client()
        if client:
            try:
                # Use pattern matching to find all keys for this resource type
                pattern = f"{self.key_prefix}{resource_type}:*"
                cursor = 0
                deleted_count = 0
                
                # Scan and delete in batches
                while True:
                    cursor, keys = await client.scan(
                        cursor,
                        match=pattern,
                        count=100
                    )
                    
                    if keys:
                        # Convert bytes to strings if needed
                        if isinstance(keys[0], bytes):
                            keys = [k.decode('utf-8') for k in keys]
                        
                        await client.delete(*keys)
                        deleted_count += len(keys)
                    
                    if cursor == 0:
                        break
                
                if deleted_count > 0:
                    logger.info(f"Invalidated {deleted_count} Redis cache entries for {resource_type}")
                    
            except Exception as e:
                logger.error(f"Redis invalidation error: {e}")
                self._redis_errors += 1
    
    async def invalidate_specific(self, resource_type: str, resource_id: str):
        """
        Invalidate cache entries that might contain a specific resource.
        More targeted than invalidating all entries for a resource type.
        """
        # For now, invalidate entire resource type
        # Could be optimized to track which searches contain which resources
        await self.invalidate_resource_type(resource_type)
    
    async def clear(self):
        """Clear all cache entries."""
        # Clear memory cache
        self.memory_cache.clear()
        
        # Clear Redis cache
        client = await self._get_redis_client()
        if client:
            try:
                # Delete all keys with our prefix
                pattern = f"{self.key_prefix}*"
                cursor = 0
                deleted_count = 0
                
                while True:
                    cursor, keys = await client.scan(
                        cursor,
                        match=pattern,
                        count=100
                    )
                    
                    if keys:
                        # Convert bytes to strings if needed
                        if isinstance(keys[0], bytes):
                            keys = [k.decode('utf-8') for k in keys]
                        
                        await client.delete(*keys)
                        deleted_count += len(keys)
                    
                    if cursor == 0:
                        break
                
                logger.info(f"Cleared {deleted_count} Redis cache entries")
                
            except Exception as e:
                logger.error(f"Redis clear error: {e}")
                self._redis_errors += 1
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics including Redis info."""
        # Get memory cache stats
        memory_stats = self.memory_cache.get_stats()
        
        # Get Redis stats
        redis_stats = {
            "available": self._redis_available,
            "errors": self._redis_errors
        }
        
        client = await self._get_redis_client()
        if client:
            try:
                info = await client.info()
                redis_stats.update({
                    "connected": True,
                    "used_memory": info.get('used_memory_human', 'N/A'),
                    "connected_clients": info.get('connected_clients', 0),
                    "total_commands": info.get('total_commands_processed', 0)
                })
                
                # Count our cache keys
                pattern = f"{self.key_prefix}*"
                cursor = 0
                key_count = 0
                
                while True:
                    cursor, keys = await client.scan(cursor, match=pattern, count=100)
                    key_count += len(keys)
                    if cursor == 0:
                        break
                
                redis_stats['cache_keys'] = key_count
                
            except Exception as e:
                logger.error(f"Redis stats error: {e}")
                redis_stats['connected'] = False
        else:
            redis_stats['connected'] = False
        
        total_requests = self._hits + self._misses
        hit_rate = self._hits / total_requests if total_requests > 0 else 0
        
        return {
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": hit_rate,
            "total_requests": total_requests,
            "memory_cache": memory_stats,
            "redis_cache": redis_stats
        }
    
    async def close(self):
        """Close Redis connection."""
        if self._redis_client:
            await self._redis_client.close()
            self._redis_client = None
            logger.info("Redis connection closed")


# Global Redis cache instance
_redis_cache: Optional[RedisSearchCache] = None


async def get_redis_cache() -> RedisSearchCache:
    """Get or create the global Redis cache instance."""
    global _redis_cache
    if _redis_cache is None:
        _redis_cache = RedisSearchCache()
    return _redis_cache


# Context manager for cache operations
@asynccontextmanager
async def redis_cache_context():
    """Context manager for Redis cache operations."""
    cache = await get_redis_cache()
    try:
        yield cache
    finally:
        # Could add cleanup here if needed
        pass


# Enhanced cache decorator with Redis support
def cache_search_redis(ttl: Optional[int] = None):
    """
    Decorator to cache search results in Redis.
    
    Args:
        ttl: Time-to-live in seconds
    """
    def decorator(func):
        async def wrapper(resource_type: str, params: Dict[str, Any], *args, **kwargs):
            cache = await get_redis_cache()
            
            # Check cache first
            cached_result = await cache.get(resource_type, params)
            if cached_result is not None:
                return cached_result
            
            # Call the actual function
            result = await func(resource_type, params, *args, **kwargs)
            
            # Cache the result
            if result and len(result) == 2:  # (resources, total)
                resources, total = result
                await cache.set(resource_type, params, resources, total, ttl)
            
            return result
        
        return wrapper
    return decorator


# Cache invalidation helpers
async def invalidate_on_change(resource_type: str, resource_id: Optional[str] = None):
    """
    Invalidate cache entries when a resource changes.
    
    Args:
        resource_type: Type of resource that changed
        resource_id: Optional specific resource ID
    """
    cache = await get_redis_cache()
    
    if resource_id:
        await cache.invalidate_specific(resource_type, resource_id)
    else:
        await cache.invalidate_resource_type(resource_type)