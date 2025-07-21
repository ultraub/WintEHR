"""
Performance monitoring endpoints for database and cache systems.

Provides real-time metrics and health checks for connection pools,
caching systems, and query performance.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import asyncio
import psutil
import time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database_optimized import get_db_session, get_pool_status, health_check, pool_manager
from fhir.api.redis_cache import get_redis_cache
from fhir.api.cache import get_search_cache

import logging

logger = logging.getLogger(__name__)

# Create monitoring router
monitoring_router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@monitoring_router.get("/health")
async def get_system_health():
    """
    Get overall system health status.
    
    Returns health status for all critical components:
    - Database connection pool
    - Redis cache
    - Memory cache
    - System resources
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {}
    }
    
    # Check database health
    try:
        db_healthy = await health_check()
        pool_status = await get_pool_status()
        
        health_status["components"]["database"] = {
            "status": "healthy" if db_healthy else "unhealthy",
            "pool_utilization": pool_status.get("utilization", 0),
            "active_connections": pool_status.get("checked_out", 0),
            "recommendation": pool_status.get("recommendation", "")
        }
    except Exception as e:
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Check Redis cache health
    try:
        redis_cache = await get_redis_cache()
        redis_stats = await redis_cache.get_stats()
        
        health_status["components"]["redis_cache"] = {
            "status": "healthy" if redis_stats["redis_cache"]["available"] else "unavailable",
            "connected": redis_stats["redis_cache"].get("connected", False),
            "hit_rate": redis_stats.get("hit_rate", 0),
            "errors": redis_stats["redis_cache"].get("errors", 0)
        }
    except Exception as e:
        health_status["components"]["redis_cache"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Check memory cache health
    try:
        memory_cache = get_search_cache()
        memory_stats = memory_cache.get_stats()
        
        health_status["components"]["memory_cache"] = {
            "status": "healthy",
            "size": memory_stats.get("size", 0),
            "hit_rate": memory_stats.get("hit_rate", 0)
        }
    except Exception as e:
        health_status["components"]["memory_cache"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Check system resources
    health_status["components"]["system"] = {
        "status": "healthy",
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent
    }
    
    # Determine overall status
    unhealthy_components = [
        name for name, comp in health_status["components"].items()
        if comp.get("status") != "healthy"
    ]
    
    if unhealthy_components:
        if "database" in unhealthy_components:
            health_status["status"] = "unhealthy"
        else:
            health_status["status"] = "degraded"
    
    return health_status


@monitoring_router.get("/pool/status")
async def get_connection_pool_status():
    """
    Get detailed connection pool statistics.
    
    Returns current pool configuration, usage statistics,
    and performance metrics.
    """
    try:
        pool_status = await get_pool_status()
        
        # Add additional metrics
        pool_status["metrics"] = {
            "avg_wait_time": 0,
            "connections_per_second": 0,
            "error_rate": 0
        }
        
        stats = pool_status.get("stats", {})
        if stats.get("wait_count", 0) > 0:
            pool_status["metrics"]["avg_wait_time"] = stats["wait_time_total"] / stats["wait_count"]
        
        # Calculate rates (simplified - in production you'd track over time windows)
        total_connections = stats.get("connections_created", 0)
        if total_connections > 0:
            pool_status["metrics"]["error_rate"] = stats.get("errors", 0) / total_connections
        
        return pool_status
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pool status: {str(e)}")


@monitoring_router.get("/cache/stats")
async def get_cache_statistics():
    """
    Get cache performance statistics for both Redis and memory caches.
    
    Returns hit rates, sizes, and performance metrics.
    """
    cache_stats = {
        "timestamp": datetime.now().isoformat(),
        "redis": {},
        "memory": {}
    }
    
    # Get Redis cache stats
    try:
        redis_cache = await get_redis_cache()
        redis_stats = await redis_cache.get_stats()
        
        cache_stats["redis"] = {
            "available": redis_stats["redis_cache"]["available"],
            "connected": redis_stats["redis_cache"].get("connected", False),
            "hits": redis_stats.get("hits", 0),
            "misses": redis_stats.get("misses", 0),
            "hit_rate": redis_stats.get("hit_rate", 0),
            "total_requests": redis_stats.get("total_requests", 0),
            "errors": redis_stats["redis_cache"].get("errors", 0),
            "cache_keys": redis_stats["redis_cache"].get("cache_keys", 0),
            "memory_usage": redis_stats["redis_cache"].get("used_memory", "N/A")
        }
    except Exception as e:
        cache_stats["redis"]["error"] = str(e)
    
    # Get memory cache stats
    try:
        memory_cache = get_search_cache()
        memory_stats = memory_cache.get_stats()
        
        cache_stats["memory"] = memory_stats
    except Exception as e:
        cache_stats["memory"]["error"] = str(e)
    
    # Calculate combined metrics
    total_hits = cache_stats["redis"].get("hits", 0) + cache_stats["memory"].get("hits", 0)
    total_misses = cache_stats["redis"].get("misses", 0) + cache_stats["memory"].get("misses", 0)
    total_requests = total_hits + total_misses
    
    cache_stats["combined"] = {
        "total_hits": total_hits,
        "total_misses": total_misses,
        "total_requests": total_requests,
        "combined_hit_rate": total_hits / total_requests if total_requests > 0 else 0
    }
    
    return cache_stats


@monitoring_router.get("/queries/slow")
async def get_slow_queries(
    db: AsyncSession = Depends(get_db_session),
    threshold_ms: int = 1000,
    limit: int = 10
):
    """
    Get slow queries from PostgreSQL.
    
    Args:
        threshold_ms: Minimum query duration in milliseconds
        limit: Maximum number of queries to return
    
    Returns list of slow queries with execution statistics.
    """
    try:
        # Query pg_stat_statements for slow queries
        query = text("""
            SELECT 
                query,
                calls,
                total_exec_time as total_time,
                mean_exec_time as mean_time,
                max_exec_time as max_time,
                stddev_exec_time as stddev_time
            FROM pg_stat_statements
            WHERE mean_exec_time > :threshold
                AND query NOT LIKE '%pg_stat_statements%'
            ORDER BY mean_exec_time DESC
            LIMIT :limit
        """)
        
        result = await db.execute(
            query,
            {"threshold": threshold_ms, "limit": limit}
        )
        
        slow_queries = []
        for row in result:
            slow_queries.append({
                "query": row.query[:200] + "..." if len(row.query) > 200 else row.query,
                "calls": row.calls,
                "total_time_ms": round(row.total_time, 2),
                "mean_time_ms": round(row.mean_time, 2),
                "max_time_ms": round(row.max_time, 2),
                "stddev_time_ms": round(row.stddev_time, 2)
            })
        
        return {
            "threshold_ms": threshold_ms,
            "count": len(slow_queries),
            "queries": slow_queries
        }
        
    except Exception as e:
        # pg_stat_statements might not be enabled
        logger.warning(f"Failed to get slow queries: {e}")
        
        # Fallback to current activity
        try:
            query = text("""
                SELECT 
                    pid,
                    usename,
                    state,
                    query,
                    EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as duration_ms
                FROM pg_stat_activity
                WHERE state != 'idle'
                    AND query NOT LIKE '%pg_stat_activity%'
                    AND EXTRACT(EPOCH FROM (now() - query_start)) * 1000 > :threshold
                ORDER BY duration_ms DESC
                LIMIT :limit
            """)
            
            result = await db.execute(
                query,
                {"threshold": threshold_ms, "limit": limit}
            )
            
            active_queries = []
            for row in result:
                active_queries.append({
                    "pid": row.pid,
                    "user": row.usename,
                    "state": row.state,
                    "query": row.query[:200] + "..." if len(row.query) > 200 else row.query,
                    "duration_ms": round(row.duration_ms, 2)
                })
            
            return {
                "threshold_ms": threshold_ms,
                "count": len(active_queries),
                "queries": active_queries,
                "note": "pg_stat_statements not available, showing current activity"
            }
            
        except Exception as e2:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get query statistics: {str(e2)}"
            )


@monitoring_router.get("/performance/summary")
async def get_performance_summary():
    """
    Get a comprehensive performance summary.
    
    Returns aggregated metrics for database, cache, and system performance.
    """
    summary = {
        "timestamp": datetime.now().isoformat(),
        "period": "last_5_minutes",
        "database": {},
        "cache": {},
        "system": {},
        "recommendations": []
    }
    
    # Database performance
    try:
        pool_status = await get_pool_status()
        summary["database"] = {
            "pool_utilization": pool_status.get("utilization", 0),
            "active_connections": pool_status.get("checked_out", 0),
            "wait_time_avg": 0,
            "error_rate": 0
        }
        
        stats = pool_status.get("stats", {})
        if stats.get("wait_count", 0) > 0:
            summary["database"]["wait_time_avg"] = stats["wait_time_total"] / stats["wait_count"]
        
        if stats.get("connections_created", 0) > 0:
            summary["database"]["error_rate"] = stats.get("errors", 0) / stats["connections_created"]
        
        # Add recommendations
        if summary["database"]["pool_utilization"] > 0.8:
            summary["recommendations"].append({
                "component": "database",
                "severity": "warning",
                "message": "High pool utilization. Consider increasing pool size.",
                "action": "Increase pool_size configuration"
            })
            
    except Exception as e:
        summary["database"]["error"] = str(e)
    
    # Cache performance
    try:
        redis_cache = await get_redis_cache()
        redis_stats = await redis_cache.get_stats()
        
        memory_cache = get_search_cache()
        memory_stats = memory_cache.get_stats()
        
        summary["cache"] = {
            "redis_hit_rate": redis_stats.get("hit_rate", 0),
            "memory_hit_rate": memory_stats.get("hit_rate", 0),
            "redis_available": redis_stats["redis_cache"]["available"],
            "total_cached_items": memory_stats.get("size", 0) + redis_stats["redis_cache"].get("cache_keys", 0)
        }
        
        # Add recommendations
        if summary["cache"]["redis_hit_rate"] < 0.5 and redis_stats.get("total_requests", 0) > 100:
            summary["recommendations"].append({
                "component": "cache",
                "severity": "info",
                "message": "Low Redis cache hit rate. Consider adjusting cache TTL.",
                "action": "Review cache key generation and TTL settings"
            })
            
    except Exception as e:
        summary["cache"]["error"] = str(e)
    
    # System performance
    summary["system"] = {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_io_read_mb": psutil.disk_io_counters().read_bytes / (1024 * 1024),
        "disk_io_write_mb": psutil.disk_io_counters().write_bytes / (1024 * 1024)
    }
    
    # Add system recommendations
    if summary["system"]["cpu_percent"] > 80:
        summary["recommendations"].append({
            "component": "system",
            "severity": "warning",
            "message": "High CPU usage detected.",
            "action": "Consider scaling horizontally or optimizing queries"
        })
    
    if summary["system"]["memory_percent"] > 85:
        summary["recommendations"].append({
            "component": "system",
            "severity": "warning",
            "message": "High memory usage detected.",
            "action": "Consider increasing memory or optimizing cache sizes"
        })
    
    return summary


@monitoring_router.post("/pool/optimize")
async def optimize_connection_pool():
    """
    Trigger connection pool optimization.
    
    Analyzes current usage patterns and adjusts pool size if needed.
    """
    try:
        # In a real implementation, this would dynamically adjust the pool
        new_size = pool_manager.adjust_pool_size()
        
        if new_size:
            return {
                "status": "optimized",
                "new_pool_size": new_size,
                "message": f"Pool size adjusted to {new_size}"
            }
        else:
            return {
                "status": "no_change",
                "current_pool_size": pool_manager.pool_size,
                "message": "Pool size is already optimal"
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to optimize pool: {str(e)}"
        )