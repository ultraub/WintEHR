"""
Optimized database connection and session management.

Provides enhanced async database connections with performance-tuned pooling,
connection health monitoring, and adaptive pool sizing.
"""

import os
import asyncio
import logging
import time
from typing import AsyncGenerator, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool, AsyncAdaptedQueuePool, StaticPool
from sqlalchemy import event, pool
from contextlib import asynccontextmanager
import psutil

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"
)

class OptimizedConnectionPool:
    """
    Enhanced connection pool with monitoring and adaptive sizing.
    """
    
    def __init__(self):
        self.pool_stats = {
            "connections_created": 0,
            "connections_closed": 0,
            "connections_recycled": 0,
            "active_connections": 0,
            "idle_connections": 0,
            "wait_time_total": 0.0,
            "wait_count": 0,
            "errors": 0,
            "last_adjustment": datetime.now()
        }
        
        # Determine optimal pool size based on system resources
        cpu_count = psutil.cpu_count()
        memory_gb = psutil.virtual_memory().total / (1024**3)
        
        # Base pool size on CPU cores and available memory
        # Formula: 2-4 connections per CPU core, limited by memory
        self.min_pool_size = max(5, cpu_count * 2)
        self.max_pool_size = min(100, cpu_count * 4, int(memory_gb * 10))
        self.pool_size = min(20, self.max_pool_size)  # Start conservative
        
        # Overflow connections for burst traffic
        self.max_overflow = min(40, self.pool_size * 2)
        
        logger.info(f"Connection pool sizing - CPUs: {cpu_count}, Memory: {memory_gb:.1f}GB")
        logger.info(f"Pool configuration - Size: {self.pool_size}, Max: {self.max_pool_size}, Overflow: {self.max_overflow}")
    
    def get_pool_config(self) -> Dict[str, Any]:
        """Get optimized pool configuration."""
        return {
            "poolclass": AsyncAdaptedQueuePool,
            "pool_size": self.pool_size,
            "max_overflow": self.max_overflow,
            "pool_timeout": 10,  # Reduced from 30 for faster failure detection
            "pool_recycle": 1800,  # 30 minutes (reduced from 3600)
            "pool_pre_ping": True,
            "echo_pool": os.getenv("SQL_ECHO_POOL", "false").lower() == "true",
            "pool_use_lifo": True,  # Use LIFO to keep connections warm
        }
    
    def update_stats(self, event_type: str, duration: Optional[float] = None):
        """Update pool statistics."""
        if event_type == "connect":
            self.pool_stats["connections_created"] += 1
        elif event_type == "close":
            self.pool_stats["connections_closed"] += 1
        elif event_type == "recycle":
            self.pool_stats["connections_recycled"] += 1
        elif event_type == "wait" and duration:
            self.pool_stats["wait_time_total"] += duration
            self.pool_stats["wait_count"] += 1
        elif event_type == "error":
            self.pool_stats["errors"] += 1
    
    def should_adjust_pool(self) -> bool:
        """Check if pool size should be adjusted based on usage patterns."""
        now = datetime.now()
        if now - self.pool_stats["last_adjustment"] < timedelta(minutes=5):
            return False
        
        # Calculate average wait time
        avg_wait = 0
        if self.pool_stats["wait_count"] > 0:
            avg_wait = self.pool_stats["wait_time_total"] / self.pool_stats["wait_count"]
        
        # Adjust based on wait times and error rate
        if avg_wait > 0.5 or self.pool_stats["errors"] > 10:
            # Consider increasing pool size
            if self.pool_size < self.max_pool_size:
                return True
        elif avg_wait < 0.1 and self.pool_stats["wait_count"] < 10:
            # Consider decreasing pool size
            if self.pool_size > self.min_pool_size:
                return True
        
        return False
    
    def adjust_pool_size(self) -> Optional[int]:
        """Adjust pool size based on usage patterns."""
        if not self.should_adjust_pool():
            return None
        
        avg_wait = 0
        if self.pool_stats["wait_count"] > 0:
            avg_wait = self.pool_stats["wait_time_total"] / self.pool_stats["wait_count"]
        
        old_size = self.pool_size
        
        if avg_wait > 0.5 or self.pool_stats["errors"] > 10:
            # Increase pool size by 20%
            self.pool_size = min(self.max_pool_size, int(self.pool_size * 1.2))
            self.max_overflow = min(40, self.pool_size * 2)
        else:
            # Decrease pool size by 10%
            self.pool_size = max(self.min_pool_size, int(self.pool_size * 0.9))
            self.max_overflow = min(40, self.pool_size * 2)
        
        if old_size != self.pool_size:
            logger.info(f"Adjusted pool size from {old_size} to {self.pool_size}")
            self.pool_stats["last_adjustment"] = datetime.now()
            # Reset counters
            self.pool_stats["wait_time_total"] = 0.0
            self.pool_stats["wait_count"] = 0
            self.pool_stats["errors"] = 0
            return self.pool_size
        
        return None

# Global pool manager
pool_manager = OptimizedConnectionPool()

# Create async engine with optimized settings
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    future=True,
    **pool_manager.get_pool_config(),
    connect_args={
        "server_settings": {
            "search_path": "fhir,cds_hooks,public",
            "jit": "off",  # Disable JIT for more predictable performance
            "random_page_cost": "1.1",  # Optimize for SSD
            "effective_cache_size": "4GB",  # Adjust based on available memory
            "shared_buffers": "256MB"  # PostgreSQL shared buffer optimization
        },
        "command_timeout": 30,  # Reduced from 60 for faster failure detection
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0,
        # Connection-level optimizations
        "ssl": "prefer",  # Use SSL when available
        "connect_timeout": 10,  # Connection timeout
        "tcp_keepalives_idle": 60,  # TCP keepalive settings
        "tcp_keepalives_interval": 10,
        "tcp_keepalives_count": 5
    },
    # Query execution options
    execution_options={
        "isolation_level": "READ COMMITTED",  # Default isolation level
        "postgresql_readonly": False,
        "postgresql_deferrable": False,
        "stream_results": False,  # Fetch all results at once for small queries
        "max_row_buffer": 1000  # Buffer size for result sets
    }
)

# Event listeners for monitoring
@event.listens_for(engine.sync_engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Monitor connection creation."""
    connection_record.info['connect_time'] = time.time()
    pool_manager.update_stats("connect")

@event.listens_for(engine.sync_engine, "close")
def receive_close(dbapi_conn, connection_record):
    """Monitor connection closure."""
    pool_manager.update_stats("close")

@event.listens_for(engine.sync_engine, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    """Monitor connection checkout from pool."""
    checkout_time = time.time()
    if 'connect_time' in connection_record.info:
        wait_time = checkout_time - connection_record.info['connect_time']
        pool_manager.update_stats("wait", wait_time)

# Create session factory with optimized settings
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
    # Additional session options
    info={"pool_manager": pool_manager}
)

# Base class for models
Base = declarative_base()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session with connection pooling optimization.
    
    Usage in FastAPI:
        @app.get("/example")
        async def example(db: AsyncSession = Depends(get_db_session)):
            # Use db session
    """
    start_time = time.time()
    
    async with async_session_maker() as session:
        # Set session-level optimizations
        await session.execute("SET statement_timeout = '30s'")
        await session.execute("SET lock_timeout = '10s'")
        await session.execute("SET idle_in_transaction_session_timeout = '60s'")
        
        try:
            yield session
            await session.commit()
        except Exception as e:
            pool_manager.update_stats("error")
            await session.rollback()
            raise
        finally:
            await session.close()
            
            # Log slow sessions
            duration = time.time() - start_time
            if duration > 1.0:
                logger.warning(f"Slow database session: {duration:.2f}s")


@asynccontextmanager
async def get_db_context() -> AsyncSession:
    """
    Context manager for database session with monitoring.
    
    Usage:
        async with get_db_context() as db:
            # Use db session
    """
    async with async_session_maker() as session:
        # Set session-level optimizations
        await session.execute("SET statement_timeout = '30s'")
        await session.execute("SET lock_timeout = '10s'")
        
        try:
            yield session
            await session.commit()
        except Exception as e:
            pool_manager.update_stats("error")
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_pool_status() -> Dict[str, Any]:
    """Get current connection pool status and statistics."""
    pool = engine.pool
    
    status = {
        "pool_size": pool_manager.pool_size,
        "max_overflow": pool_manager.max_overflow,
        "size": pool.size() if hasattr(pool, 'size') else 0,
        "checked_in": pool.checkedin() if hasattr(pool, 'checkedin') else 0,
        "checked_out": pool.checkedout() if hasattr(pool, 'checkedout') else 0,
        "overflow": pool.overflow() if hasattr(pool, 'overflow') else 0,
        "stats": pool_manager.pool_stats
    }
    
    # Calculate health metrics
    if status["size"] > 0:
        status["utilization"] = status["checked_out"] / status["size"]
    else:
        status["utilization"] = 0
    
    # Add recommendations
    if status["utilization"] > 0.8:
        status["recommendation"] = "Consider increasing pool size"
    elif status["utilization"] < 0.2:
        status["recommendation"] = "Consider decreasing pool size"
    else:
        status["recommendation"] = "Pool size is optimal"
    
    return status


async def optimize_pool_dynamically():
    """
    Background task to dynamically optimize pool size based on usage.
    Should be run periodically (e.g., every 5 minutes).
    """
    new_size = pool_manager.adjust_pool_size()
    if new_size:
        # Note: In production, you would need to recreate the engine
        # with the new pool size. This is a simplified example.
        logger.info(f"Pool size adjustment recommended: {new_size}")
        return True
    return False


async def warmup_pool():
    """
    Warm up the connection pool by pre-creating connections.
    Useful during application startup.
    """
    logger.info("Warming up connection pool...")
    
    tasks = []
    for i in range(min(5, pool_manager.pool_size)):
        async def create_connection():
            async with get_db_context() as db:
                await db.execute("SELECT 1")
        
        tasks.append(create_connection())
    
    await asyncio.gather(*tasks, return_exceptions=True)
    logger.info("Connection pool warmup complete")


async def init_db():
    """Initialize database with connection pool warmup and monitoring."""
    # Set up query monitoring
    try:
        from api.middleware.query_monitoring import setup_sqlalchemy_monitoring
        setup_sqlalchemy_monitoring(engine.sync_engine)
        logger.info("Query monitoring enabled")
    except Exception as e:
        logger.warning(f"Failed to set up query monitoring: {e}")
    
    # Warm up the pool
    await warmup_pool()


async def close_db():
    """Close database connections and cleanup."""
    logger.info("Closing database connections...")
    await engine.dispose()
    logger.info("Database connections closed")


# Health check query for monitoring
async def health_check() -> bool:
    """
    Perform a database health check.
    Returns True if healthy, False otherwise.
    """
    try:
        async with get_db_context() as db:
            result = await db.execute("SELECT 1")
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False