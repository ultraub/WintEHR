"""
Redis Caching Layer for FHIR Resources

Provides high-performance caching for FHIR search results and individual resources
to reduce database load and improve response times.

Author: WintEHR Team
Date: 2025-01-24
"""

import json
import logging
import hashlib
import redis
from redis import Redis
from typing import Any, Dict, Optional, List, Union
from datetime import datetime, timedelta
import pickle
import os

logger = logging.getLogger(__name__)


class FHIRCacheService:
    """Redis-based caching service for FHIR resources."""
    
    def __init__(
        self,
        redis_url: str = None,
        default_ttl: int = 300,  # 5 minutes default
        enabled: bool = True
    ):
        """
        Initialize cache service.
        
        Args:
            redis_url: Redis connection URL
            default_ttl: Default time-to-live in seconds
            enabled: Whether caching is enabled
        """
        self.enabled = enabled and os.getenv('ENABLE_REDIS_CACHE', 'true').lower() == 'true'
        self.default_ttl = default_ttl
        
        if self.enabled:
            try:
                if not redis_url:
                    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
                
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=False,  # We'll handle encoding/decoding
                    socket_keepalive=True,
                    socket_keepalive_options={
                        1: 1,  # TCP_KEEPIDLE
                        2: 1,  # TCP_KEEPINTVL
                        3: 3,  # TCP_KEEPCNT
                    }
                )
                
                # Test connection
                self.redis_client.ping()
                logger.info("Redis cache service initialized successfully")
                
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e}. Caching disabled.")
                self.enabled = False
                self.redis_client = None
        else:
            self.redis_client = None
            logger.info("Redis cache service disabled")
    
    def _generate_cache_key(
        self,
        resource_type: str,
        operation: str,
        params: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a unique cache key for the request.
        
        Args:
            resource_type: FHIR resource type
            operation: Operation type (search, get, etc.)
            params: Parameters for the operation
            
        Returns:
            Cache key string
        """
        # Create a deterministic string from parameters
        if params:
            # Sort parameters for consistent hashing
            param_str = json.dumps(params, sort_keys=True)
            param_hash = hashlib.md5(param_str.encode()).hexdigest()
        else:
            param_hash = "none"
        
        return f"fhir:{resource_type}:{operation}:{param_hash}"
    
    async def get_cached_search(
        self,
        resource_type: str,
        search_params: Dict[str, Any],
        offset: int,
        limit: int
    ) -> Optional[tuple]:
        """
        Get cached search results.
        
        Returns:
            Tuple of (resources, total_count) if cached, None otherwise
        """
        if not self.enabled:
            return None
        
        # Include pagination in cache key
        cache_params = {
            **search_params,
            '_offset': offset,
            '_limit': limit
        }
        
        cache_key = self._generate_cache_key(resource_type, 'search', cache_params)
        
        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                data = pickle.loads(cached_data)
                logger.debug(f"Cache hit for search: {cache_key}")
                return data['resources'], data['total_count']
            
            logger.debug(f"Cache miss for search: {cache_key}")
            return None
            
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    async def cache_search_results(
        self,
        resource_type: str,
        search_params: Dict[str, Any],
        offset: int,
        limit: int,
        resources: List[Dict[str, Any]],
        total_count: int,
        ttl: Optional[int] = None
    ) -> None:
        """
        Cache search results.
        
        Args:
            resource_type: FHIR resource type
            search_params: Search parameters used
            offset: Result offset
            limit: Result limit
            resources: List of resources
            total_count: Total count of matching resources
            ttl: Time-to-live in seconds
        """
        if not self.enabled:
            return
        
        # Include pagination in cache key
        cache_params = {
            **search_params,
            '_offset': offset,
            '_limit': limit
        }
        
        cache_key = self._generate_cache_key(resource_type, 'search', cache_params)
        
        try:
            # Cache the results
            cache_data = {
                'resources': resources,
                'total_count': total_count,
                'cached_at': datetime.utcnow().isoformat()
            }
            
            serialized_data = pickle.dumps(cache_data)
            
            # Use provided TTL or default
            ttl = ttl or self.default_ttl
            
            # Also cache individual resources
            pipeline = self.redis_client.pipeline()
            
            # Cache search results
            pipeline.setex(cache_key, ttl, serialized_data)
            
            # Cache individual resources with longer TTL
            resource_ttl = ttl * 2  # Individual resources can be cached longer
            for resource in resources:
                if 'id' in resource and 'resourceType' in resource:
                    resource_key = self._generate_cache_key(
                        resource['resourceType'],
                        'get',
                        {'id': resource['id']}
                    )
                    resource_data = pickle.dumps(resource)
                    pipeline.setex(resource_key, resource_ttl, resource_data)
            
            pipeline.execute()
            
            logger.debug(f"Cached search results: {cache_key} (TTL: {ttl}s)")
            
        except Exception as e:
            logger.error(f"Cache set error: {e}")
    
    async def get_cached_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get a cached individual resource.
        
        Returns:
            Resource dict if cached, None otherwise
        """
        if not self.enabled:
            return None
        
        cache_key = self._generate_cache_key(
            resource_type,
            'get',
            {'id': resource_id}
        )
        
        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                resource = pickle.loads(cached_data)
                logger.debug(f"Cache hit for resource: {cache_key}")
                return resource
            
            logger.debug(f"Cache miss for resource: {cache_key}")
            return None
            
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    async def cache_resource(
        self,
        resource: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> None:
        """
        Cache an individual resource.
        
        Args:
            resource: FHIR resource to cache
            ttl: Time-to-live in seconds
        """
        if not self.enabled:
            return
        
        if 'id' not in resource or 'resourceType' not in resource:
            return
        
        cache_key = self._generate_cache_key(
            resource['resourceType'],
            'get',
            {'id': resource['id']}
        )
        
        try:
            serialized_data = pickle.dumps(resource)
            ttl = ttl or self.default_ttl * 2  # Individual resources cached longer
            
            self.redis_client.setex(cache_key, ttl, serialized_data)
            logger.debug(f"Cached resource: {cache_key} (TTL: {ttl}s)")
            
        except Exception as e:
            logger.error(f"Cache set error: {e}")
    
    async def invalidate_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> None:
        """
        Invalidate cached resource and related search results.
        
        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID
        """
        if not self.enabled:
            return
        
        try:
            # Delete the individual resource
            resource_key = self._generate_cache_key(
                resource_type,
                'get',
                {'id': resource_id}
            )
            self.redis_client.delete(resource_key)
            
            # Delete all search results for this resource type
            # This is a simple approach - more sophisticated invalidation
            # could track which searches include which resources
            pattern = f"fhir:{resource_type}:search:*"
            
            # Use SCAN to find and delete matching keys
            cursor = 0
            while True:
                cursor, keys = self.redis_client.scan(
                    cursor, 
                    match=pattern,
                    count=100
                )
                
                if keys:
                    self.redis_client.delete(*keys)
                
                if cursor == 0:
                    break
            
            logger.debug(f"Invalidated cache for {resource_type}/{resource_id}")
            
        except Exception as e:
            logger.error(f"Cache invalidation error: {e}")
    
    async def clear_cache(self, resource_type: Optional[str] = None) -> None:
        """
        Clear cache for a specific resource type or all cached data.
        
        Args:
            resource_type: Optional resource type to clear
        """
        if not self.enabled:
            return
        
        try:
            if resource_type:
                # Clear specific resource type
                pattern = f"fhir:{resource_type}:*"
                
                cursor = 0
                deleted_count = 0
                
                while True:
                    cursor, keys = self.redis_client.scan(
                        cursor,
                        match=pattern,
                        count=100
                    )
                    
                    if keys:
                        deleted_count += len(keys)
                        self.redis_client.delete(*keys)
                    
                    if cursor == 0:
                        break
                
                logger.info(f"Cleared {deleted_count} cache entries for {resource_type}")
            else:
                # Clear all FHIR cache
                self.redis_client.flushdb()
                logger.info("Cleared all FHIR cache")
                
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        if not self.enabled:
            return {"enabled": False}
        
        try:
            info = self.redis_client.info()
            
            # Count FHIR keys by type
            resource_types = {}
            cursor = 0
            
            while True:
                cursor, keys = self.redis_client.scan(
                    cursor,
                    match="fhir:*",
                    count=100
                )
                
                for key in keys:
                    parts = key.decode().split(':')
                    if len(parts) >= 3:
                        resource_type = parts[1]
                        operation = parts[2]
                        
                        if resource_type not in resource_types:
                            resource_types[resource_type] = {
                                'search': 0,
                                'get': 0
                            }
                        
                        if operation in resource_types[resource_type]:
                            resource_types[resource_type][operation] += 1
                
                if cursor == 0:
                    break
            
            return {
                "enabled": True,
                "connected": True,
                "memory_used": info.get('used_memory_human', 'Unknown'),
                "total_keys": info.get('db0', {}).get('keys', 0),
                "hit_rate": info.get('keyspace_hit_ratio', 0),
                "resource_types": resource_types,
                "uptime_seconds": info.get('uptime_in_seconds', 0)
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {
                "enabled": True,
                "connected": False,
                "error": str(e)
            }
    
    def close(self) -> None:
        """Close Redis connection."""
        if self.redis_client:
            self.redis_client.close()