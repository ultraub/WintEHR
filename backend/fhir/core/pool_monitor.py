"""
Database Connection Pool Monitor

Provides monitoring and optimization for database connection pooling
to ensure optimal performance and resource utilization.

Author: WintEHR Team
Date: 2025-01-24
"""

import asyncio
import logging
import os
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.pool import Pool
from sqlalchemy.ext.asyncio import AsyncEngine
import psutil

logger = logging.getLogger(__name__)


class ConnectionPoolMonitor:
    """Monitor and optimize database connection pool performance."""
    
    def __init__(self, engine: AsyncEngine):
        """
        Initialize pool monitor.
        
        Args:
            engine: SQLAlchemy async engine with connection pool
        """
        self.engine = engine
        self.pool = engine.pool
        self.metrics = {
            'connections_created': 0,
            'connections_recycled': 0,
            'connections_failed': 0,
            'wait_time_total': 0,
            'queries_executed': 0,
            'slow_queries': 0,
            'monitoring_started': datetime.utcnow()
        }
        self._monitoring_task = None
    
    async def get_pool_status(self) -> Dict[str, Any]:
        """
        Get current connection pool status.
        
        Returns:
            Dictionary with pool metrics
        """
        pool = self.pool
        
        # Get PostgreSQL connection stats
        pg_stats = await self._get_postgres_stats()
        
        # Get system resource usage
        system_stats = self._get_system_stats()
        
        return {
            'pool_config': {
                'size': getattr(pool, '_pool_size', 20),
                'max_overflow': getattr(pool, '_max_overflow', 40),
                'timeout': getattr(pool, '_timeout', 30),
                'recycle': getattr(pool, '_recycle', 3600),
                'pre_ping': getattr(pool, '_pre_ping', True)
            },
            'pool_status': {
                'size': pool.size() if hasattr(pool, 'size') else 'N/A',
                'checked_in': pool.checkedin() if hasattr(pool, 'checkedin') else 'N/A',
                'checked_out': pool.checkedout() if hasattr(pool, 'checkedout') else 'N/A',
                'total': pool.total() if hasattr(pool, 'total') else 'N/A',
                'overflow': pool.overflow() if hasattr(pool, 'overflow') else 'N/A'
            },
            'database_stats': pg_stats,
            'system_stats': system_stats,
            'monitor_metrics': self.metrics,
            'health_score': self._calculate_health_score(pg_stats, system_stats)
        }
    
    async def _get_postgres_stats(self) -> Dict[str, Any]:
        """Get PostgreSQL connection statistics."""
        stats = {}
        
        try:
            async with self.engine.connect() as conn:
                # Get connection count by state
                result = await conn.execute(text("""
                    SELECT state, COUNT(*) 
                    FROM pg_stat_activity 
                    WHERE datname = current_database()
                    GROUP BY state
                """))
                
                state_counts = {row[0]: row[1] for row in result if row[0]}
                stats['connections_by_state'] = state_counts
                stats['total_connections'] = sum(state_counts.values())
                
                # Get connection limit
                result = await conn.execute(text("""
                    SELECT setting::int 
                    FROM pg_settings 
                    WHERE name = 'max_connections'
                """))
                stats['max_connections'] = result.scalar()
                
                # Get long-running queries
                result = await conn.execute(text("""
                    SELECT COUNT(*) 
                    FROM pg_stat_activity 
                    WHERE datname = current_database()
                    AND state = 'active'
                    AND query_start < NOW() - INTERVAL '30 seconds'
                    AND query NOT LIKE '%pg_stat_activity%'
                """))
                stats['long_running_queries'] = result.scalar()
                
                # Get database size
                result = await conn.execute(text("""
                    SELECT pg_database_size(current_database())
                """))
                db_size = result.scalar()
                stats['database_size_mb'] = db_size / (1024 * 1024) if db_size else 0
                
                # Get cache hit ratio
                result = await conn.execute(text("""
                    SELECT 
                        sum(heap_blks_hit) / 
                        NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) AS ratio
                    FROM pg_statio_user_tables
                """))
                stats['cache_hit_ratio'] = result.scalar() or 0
                
        except Exception as e:
            logger.error(f"Failed to get PostgreSQL stats: {e}")
            stats['error'] = str(e)
        
        return stats
    
    def _get_system_stats(self) -> Dict[str, Any]:
        """Get system resource statistics."""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            
            # Disk I/O
            disk_io = psutil.disk_io_counters()
            
            return {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_available_gb': memory.available / (1024**3),
                'disk_read_mb_s': 0,  # Would need to track deltas
                'disk_write_mb_s': 0  # Would need to track deltas
            }
        except Exception as e:
            logger.error(f"Failed to get system stats: {e}")
            return {'error': str(e)}
    
    def _calculate_health_score(
        self, 
        pg_stats: Dict[str, Any], 
        system_stats: Dict[str, Any]
    ) -> float:
        """
        Calculate connection pool health score (0-100).
        
        Args:
            pg_stats: PostgreSQL statistics
            system_stats: System resource statistics
            
        Returns:
            Health score from 0 to 100
        """
        score = 100.0
        
        # Check connection usage
        if 'total_connections' in pg_stats and 'max_connections' in pg_stats:
            conn_usage = pg_stats['total_connections'] / pg_stats['max_connections']
            if conn_usage > 0.8:
                score -= 20
            elif conn_usage > 0.6:
                score -= 10
        
        # Check for long-running queries
        if pg_stats.get('long_running_queries', 0) > 5:
            score -= 15
        elif pg_stats.get('long_running_queries', 0) > 2:
            score -= 5
        
        # Check cache hit ratio
        cache_hit_ratio = pg_stats.get('cache_hit_ratio', 0)
        if cache_hit_ratio < 0.8:
            score -= 15
        elif cache_hit_ratio < 0.9:
            score -= 5
        
        # Check system resources
        if system_stats.get('cpu_percent', 0) > 80:
            score -= 10
        if system_stats.get('memory_percent', 0) > 85:
            score -= 10
        
        return max(0, score)
    
    async def optimize_pool_settings(self) -> Dict[str, Any]:
        """
        Analyze and suggest pool optimization settings.
        
        Returns:
            Dictionary with optimization recommendations
        """
        status = await self.get_pool_status()
        recommendations = []
        
        # Analyze current pool usage
        pool_status = status.get('pool_status', {})
        checked_out = pool_status.get('checked_out', 0)
        total = pool_status.get('total', 0)
        
        # Database statistics
        db_stats = status.get('database_stats', {})
        total_connections = db_stats.get('total_connections', 0)
        max_connections = db_stats.get('max_connections', 100)
        
        # Pool configuration
        pool_config = status.get('pool_config', {})
        current_size = pool_config.get('size', 20)
        current_overflow = pool_config.get('max_overflow', 40)
        
        # Make recommendations
        if checked_out == total and total > 0:
            recommendations.append({
                'issue': 'Pool exhaustion detected',
                'recommendation': f'Increase pool_size from {current_size} to {min(current_size * 2, 50)}',
                'priority': 'high'
            })
        
        if total_connections > max_connections * 0.7:
            recommendations.append({
                'issue': 'High database connection usage',
                'recommendation': 'Consider increasing PostgreSQL max_connections',
                'priority': 'medium'
            })
        
        if db_stats.get('long_running_queries', 0) > 2:
            recommendations.append({
                'issue': 'Long-running queries detected',
                'recommendation': 'Optimize slow queries or add statement_timeout',
                'priority': 'high'
            })
        
        if db_stats.get('cache_hit_ratio', 0) < 0.9:
            recommendations.append({
                'issue': 'Low cache hit ratio',
                'recommendation': 'Increase shared_buffers in PostgreSQL',
                'priority': 'medium'
            })
        
        # Calculate optimal settings
        optimal_pool_size = min(
            int(max_connections * 0.2),  # 20% of max connections
            50  # Reasonable upper limit
        )
        
        optimal_max_overflow = min(
            int(max_connections * 0.3),  # 30% of max connections
            100  # Reasonable upper limit
        )
        
        return {
            'current_health_score': status.get('health_score', 0),
            'recommendations': recommendations,
            'optimal_settings': {
                'pool_size': optimal_pool_size,
                'max_overflow': optimal_max_overflow,
                'pool_timeout': 30,
                'pool_recycle': 3600,
                'pool_pre_ping': True
            },
            'current_settings': pool_config
        }
    
    async def start_monitoring(self, interval: int = 60):
        """
        Start continuous monitoring of connection pool.
        
        Args:
            interval: Monitoring interval in seconds
        """
        if self._monitoring_task and not self._monitoring_task.done():
            logger.warning("Monitoring already running")
            return
        
        self._monitoring_task = asyncio.create_task(
            self._monitor_loop(interval)
        )
        logger.info(f"Started connection pool monitoring (interval: {interval}s)")
    
    async def stop_monitoring(self):
        """Stop connection pool monitoring."""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            logger.info("Stopped connection pool monitoring")
    
    async def _monitor_loop(self, interval: int):
        """Continuous monitoring loop."""
        while True:
            try:
                status = await self.get_pool_status()
                health_score = status.get('health_score', 0)
                
                # Log status
                logger.info(f"Pool health: {health_score:.1f}%, "
                          f"Connections: {status['pool_status']['checked_out']}/{status['pool_status']['total']}")
                
                # Alert on issues
                if health_score < 70:
                    logger.warning(f"Pool health degraded: {health_score:.1f}%")
                    
                    # Get optimization recommendations
                    optimizations = await self.optimize_pool_settings()
                    for rec in optimizations['recommendations']:
                        if rec['priority'] == 'high':
                            logger.error(f"CRITICAL: {rec['issue']} - {rec['recommendation']}")
                        else:
                            logger.warning(f"{rec['issue']} - {rec['recommendation']}")
                
                # Update metrics
                self.metrics['queries_executed'] += 1
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                await asyncio.sleep(interval)


# Global monitor instance (initialized when needed)
_pool_monitor: Optional[ConnectionPoolMonitor] = None


def get_pool_monitor(engine: AsyncEngine) -> ConnectionPoolMonitor:
    """
    Get or create the global pool monitor instance.
    
    Args:
        engine: SQLAlchemy async engine
        
    Returns:
        ConnectionPoolMonitor instance
    """
    global _pool_monitor
    if _pool_monitor is None:
        _pool_monitor = ConnectionPoolMonitor(engine)
    return _pool_monitor