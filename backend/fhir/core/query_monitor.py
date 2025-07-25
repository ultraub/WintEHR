"""
Query Performance Monitor

Tracks and analyzes database query performance to identify bottlenecks
and optimization opportunities.

Author: WintEHR Team
Date: 2025-01-24
"""

import asyncio
import logging
import time
import json
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import Pool
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class QueryMetrics:
    """Metrics for a single query execution."""
    query_hash: str
    query_template: str
    resource_type: Optional[str]
    operation: str  # search, read, create, update, delete
    execution_time_ms: float
    rows_returned: int
    timestamp: datetime
    params: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    slow_query: bool = False


class QueryPerformanceMonitor:
    """Monitor and analyze query performance."""
    
    def __init__(
        self,
        slow_query_threshold_ms: float = 1000,
        max_history_size: int = 10000,
        enable_param_logging: bool = False
    ):
        """
        Initialize query monitor.
        
        Args:
            slow_query_threshold_ms: Threshold for slow query alerts (milliseconds)
            max_history_size: Maximum number of queries to keep in history
            enable_param_logging: Whether to log query parameters (careful with PHI)
        """
        self.slow_query_threshold_ms = slow_query_threshold_ms
        self.max_history_size = max_history_size
        self.enable_param_logging = enable_param_logging
        
        # Query history (newest first)
        self.query_history: deque = deque(maxlen=max_history_size)
        
        # Aggregate metrics by query template
        self.query_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'count': 0,
            'total_time_ms': 0,
            'min_time_ms': float('inf'),
            'max_time_ms': 0,
            'avg_time_ms': 0,
            'slow_count': 0,
            'error_count': 0,
            'last_seen': None,
            'query_template': ''
        })
        
        # Real-time metrics
        self.current_metrics = {
            'queries_per_minute': 0,
            'avg_response_time_ms': 0,
            'slow_query_rate': 0,
            'error_rate': 0,
            'monitoring_started': datetime.utcnow()
        }
        
        # Alert callbacks
        self.alert_callbacks: List[Callable] = []
        
        # Background monitoring task
        self._monitoring_task = None
    
    def _hash_query(self, query: str) -> str:
        """Generate a hash for query deduplication."""
        # Normalize query for hashing
        normalized = ' '.join(query.split())
        normalized = normalized.lower()
        
        # Remove specific values to create a template
        # This is a simplified approach - more sophisticated normalization could be added
        import re
        # Replace quoted strings
        normalized = re.sub(r"'[^']*'", "'?'", normalized)
        # Replace numbers
        normalized = re.sub(r'\b\d+\b', '?', normalized)
        
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _extract_resource_type(self, query: str) -> Optional[str]:
        """Extract FHIR resource type from query if possible."""
        import re
        
        # Look for resource_type in WHERE clause
        match = re.search(r"resource_type\s*=\s*[':\"]*(\w+)", query, re.IGNORECASE)
        if match:
            return match.group(1).strip(":'\"")
        
        # Look for table name
        match = re.search(r"FROM\s+fhir\.resources", query, re.IGNORECASE)
        if match:
            # Try to find resource type in WHERE clause
            where_match = re.search(r"WHERE.*resource_type.*?['\"](\w+)['\"]", query, re.IGNORECASE | re.DOTALL)
            if where_match:
                return where_match.group(1)
        
        return None
    
    def _determine_operation(self, query: str) -> str:
        """Determine the type of operation from query."""
        query_upper = query.upper().strip()
        
        if query_upper.startswith('SELECT'):
            if 'COUNT(*)' in query_upper:
                return 'count'
            elif 'LIMIT 1' in query or 'fhir_id =' in query:
                return 'read'
            else:
                return 'search'
        elif query_upper.startswith('INSERT'):
            return 'create'
        elif query_upper.startswith('UPDATE'):
            return 'update'
        elif query_upper.startswith('DELETE'):
            return 'delete'
        else:
            return 'other'
    
    def record_query(
        self,
        query: str,
        execution_time_ms: float,
        rows_returned: int = 0,
        params: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> QueryMetrics:
        """
        Record a query execution.
        
        Args:
            query: SQL query string
            execution_time_ms: Execution time in milliseconds
            rows_returned: Number of rows returned
            params: Query parameters (optional)
            error: Error message if query failed
            
        Returns:
            QueryMetrics object
        """
        query_hash = self._hash_query(query)
        resource_type = self._extract_resource_type(query)
        operation = self._determine_operation(query)
        slow_query = execution_time_ms > self.slow_query_threshold_ms
        
        # Create metrics object
        metrics = QueryMetrics(
            query_hash=query_hash,
            query_template=query[:500],  # Truncate for storage
            resource_type=resource_type,
            operation=operation,
            execution_time_ms=execution_time_ms,
            rows_returned=rows_returned,
            timestamp=datetime.utcnow(),
            params=params if self.enable_param_logging else None,
            error=error,
            slow_query=slow_query
        )
        
        # Add to history
        self.query_history.append(metrics)
        
        # Update aggregate stats
        stats = self.query_stats[query_hash]
        stats['count'] += 1
        stats['total_time_ms'] += execution_time_ms
        stats['min_time_ms'] = min(stats['min_time_ms'], execution_time_ms)
        stats['max_time_ms'] = max(stats['max_time_ms'], execution_time_ms)
        stats['avg_time_ms'] = stats['total_time_ms'] / stats['count']
        stats['slow_count'] += 1 if slow_query else 0
        stats['error_count'] += 1 if error else 0
        stats['last_seen'] = metrics.timestamp
        stats['query_template'] = metrics.query_template
        
        # Alert on slow queries
        if slow_query and not error:
            self._trigger_slow_query_alert(metrics)
        
        # Alert on errors
        if error:
            self._trigger_error_alert(metrics)
        
        return metrics
    
    def _trigger_slow_query_alert(self, metrics: QueryMetrics):
        """Trigger alert for slow query."""
        logger.warning(
            f"Slow query detected: {metrics.execution_time_ms:.1f}ms "
            f"(threshold: {self.slow_query_threshold_ms}ms)\n"
            f"Resource: {metrics.resource_type}, Operation: {metrics.operation}\n"
            f"Query: {metrics.query_template[:200]}..."
        )
        
        for callback in self.alert_callbacks:
            try:
                callback('slow_query', metrics)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")
    
    def _trigger_error_alert(self, metrics: QueryMetrics):
        """Trigger alert for query error."""
        logger.error(
            f"Query error: {metrics.error}\n"
            f"Resource: {metrics.resource_type}, Operation: {metrics.operation}\n"
            f"Query: {metrics.query_template[:200]}..."
        )
        
        for callback in self.alert_callbacks:
            try:
                callback('query_error', metrics)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")
    
    def add_alert_callback(self, callback: Callable):
        """Add a callback for alerts."""
        self.alert_callbacks.append(callback)
    
    def get_slow_queries(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get the slowest queries.
        
        Args:
            limit: Maximum number of queries to return
            
        Returns:
            List of slow query information
        """
        # Get queries sorted by average execution time
        sorted_queries = sorted(
            self.query_stats.items(),
            key=lambda x: x[1]['avg_time_ms'],
            reverse=True
        )
        
        results = []
        for query_hash, stats in sorted_queries[:limit]:
            if stats['count'] > 0:
                results.append({
                    'query_hash': query_hash,
                    'query_template': stats['query_template'],
                    'count': stats['count'],
                    'avg_time_ms': stats['avg_time_ms'],
                    'min_time_ms': stats['min_time_ms'],
                    'max_time_ms': stats['max_time_ms'],
                    'slow_count': stats['slow_count'],
                    'slow_rate': stats['slow_count'] / stats['count'],
                    'last_seen': stats['last_seen'].isoformat() if stats['last_seen'] else None
                })
        
        return results
    
    def get_query_stats_by_resource(self) -> Dict[str, Dict[str, Any]]:
        """Get query statistics grouped by resource type."""
        resource_stats = defaultdict(lambda: {
            'count': 0,
            'total_time_ms': 0,
            'avg_time_ms': 0,
            'slow_count': 0,
            'error_count': 0,
            'operations': defaultdict(int)
        })
        
        # Aggregate from recent history
        for metrics in self.query_history:
            if metrics.resource_type:
                stats = resource_stats[metrics.resource_type]
                stats['count'] += 1
                stats['total_time_ms'] += metrics.execution_time_ms
                stats['slow_count'] += 1 if metrics.slow_query else 0
                stats['error_count'] += 1 if metrics.error else 0
                stats['operations'][metrics.operation] += 1
        
        # Calculate averages
        for resource_type, stats in resource_stats.items():
            if stats['count'] > 0:
                stats['avg_time_ms'] = stats['total_time_ms'] / stats['count']
                stats['slow_rate'] = stats['slow_count'] / stats['count']
                stats['error_rate'] = stats['error_count'] / stats['count']
        
        return dict(resource_stats)
    
    def get_real_time_metrics(self) -> Dict[str, Any]:
        """Get real-time performance metrics."""
        # Calculate metrics from recent queries (last minute)
        one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
        recent_queries = [
            m for m in self.query_history 
            if m.timestamp > one_minute_ago
        ]
        
        if recent_queries:
            total_time = sum(m.execution_time_ms for m in recent_queries)
            slow_count = sum(1 for m in recent_queries if m.slow_query)
            error_count = sum(1 for m in recent_queries if m.error)
            
            self.current_metrics.update({
                'queries_per_minute': len(recent_queries),
                'avg_response_time_ms': total_time / len(recent_queries),
                'slow_query_rate': slow_count / len(recent_queries),
                'error_rate': error_count / len(recent_queries),
                'last_updated': datetime.utcnow()
            })
        
        return self.current_metrics.copy()
    
    def export_metrics(self) -> Dict[str, Any]:
        """Export all metrics for analysis."""
        return {
            'summary': {
                'total_queries': len(self.query_history),
                'unique_queries': len(self.query_stats),
                'monitoring_duration': str(
                    datetime.utcnow() - self.current_metrics['monitoring_started']
                ),
                'slow_query_threshold_ms': self.slow_query_threshold_ms
            },
            'real_time_metrics': self.get_real_time_metrics(),
            'slow_queries': self.get_slow_queries(20),
            'resource_stats': self.get_query_stats_by_resource(),
            'recent_queries': [
                asdict(m) for m in list(self.query_history)[-100:]
            ]
        }
    
    async def start_monitoring(self, interval: int = 60):
        """
        Start background monitoring task.
        
        Args:
            interval: Monitoring interval in seconds
        """
        if self._monitoring_task and not self._monitoring_task.done():
            logger.warning("Query monitoring already running")
            return
        
        self._monitoring_task = asyncio.create_task(
            self._monitor_loop(interval)
        )
        logger.info(f"Started query performance monitoring (interval: {interval}s)")
    
    async def stop_monitoring(self):
        """Stop background monitoring."""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            logger.info("Stopped query performance monitoring")
    
    async def _monitor_loop(self, interval: int):
        """Background monitoring loop."""
        while True:
            try:
                metrics = self.get_real_time_metrics()
                
                # Log summary
                logger.info(
                    f"Query metrics: {metrics['queries_per_minute']} qpm, "
                    f"avg: {metrics['avg_response_time_ms']:.1f}ms, "
                    f"slow rate: {metrics['slow_query_rate']:.1%}"
                )
                
                # Check for concerning patterns
                if metrics['slow_query_rate'] > 0.1:  # More than 10% slow
                    logger.warning(f"High slow query rate: {metrics['slow_query_rate']:.1%}")
                
                if metrics['error_rate'] > 0.01:  # More than 1% errors
                    logger.error(f"High query error rate: {metrics['error_rate']:.1%}")
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Query monitoring error: {e}")
                await asyncio.sleep(interval)


# Global monitor instance
_query_monitor: Optional[QueryPerformanceMonitor] = None


def get_query_monitor() -> QueryPerformanceMonitor:
    """Get or create the global query monitor instance."""
    global _query_monitor
    if _query_monitor is None:
        _query_monitor = QueryPerformanceMonitor()
    return _query_monitor


# SQLAlchemy event listeners for automatic query tracking
def setup_sqlalchemy_monitoring(engine: Engine):
    """
    Set up SQLAlchemy event listeners for automatic query monitoring.
    
    Args:
        engine: SQLAlchemy engine to monitor
    """
    monitor = get_query_monitor()
    
    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Record query start time."""
        context._query_start_time = time.time()
    
    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Record query execution metrics."""
        execution_time_ms = (time.time() - context._query_start_time) * 1000
        
        # Get row count (approximate for some queries)
        try:
            rows_returned = cursor.rowcount if cursor.rowcount > 0 else 0
        except:
            rows_returned = 0
        
        # Record the query
        monitor.record_query(
            query=statement,
            execution_time_ms=execution_time_ms,
            rows_returned=rows_returned,
            params=parameters if isinstance(parameters, dict) else None
        )
    
    @event.listens_for(engine, "handle_error")
    def handle_error(exception_context):
        """Record query errors."""
        if hasattr(exception_context.context, '_query_start_time'):
            execution_time_ms = (time.time() - exception_context.context._query_start_time) * 1000
        else:
            execution_time_ms = 0
        
        monitor.record_query(
            query=exception_context.statement,
            execution_time_ms=execution_time_ms,
            error=str(exception_context.original_exception)
        )
    
    logger.info("SQLAlchemy query monitoring configured")