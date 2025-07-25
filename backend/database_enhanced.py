"""
Enhanced Database Configuration with Advanced Connection Pooling

Provides optimized database connection management with monitoring,
optimization, and automatic tuning capabilities.

Author: WintEHR Team
Date: 2025-01-24
"""

import os
import logging
import asyncio
from typing import AsyncGenerator, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool, AsyncAdaptedQueuePool
from sqlalchemy import text
from contextlib import asynccontextmanager
from fhir.core.pool_monitor import ConnectionPoolMonitor, get_pool_monitor

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"
)

# Get pool configuration from environment with sensible defaults
POOL_CONFIG = {
    'pool_size': int(os.getenv('DB_POOL_SIZE', '20')),
    'max_overflow': int(os.getenv('DB_MAX_OVERFLOW', '40')),
    'pool_timeout': int(os.getenv('DB_POOL_TIMEOUT', '30')),
    'pool_recycle': int(os.getenv('DB_POOL_RECYCLE', '3600')),
    'pool_pre_ping': os.getenv('DB_POOL_PRE_PING', 'true').lower() == 'true',
}

# Performance settings
STATEMENT_TIMEOUT = int(os.getenv('DB_STATEMENT_TIMEOUT', '60000'))  # 60 seconds
LOCK_TIMEOUT = int(os.getenv('DB_LOCK_TIMEOUT', '10000'))  # 10 seconds
IDLE_IN_TRANSACTION_TIMEOUT = int(os.getenv('DB_IDLE_IN_TRANSACTION_TIMEOUT', '60000'))  # 60 seconds

# Create optimized async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    echo_pool=os.getenv("SQL_ECHO_POOL", "false").lower() == "true",
    poolclass=AsyncAdaptedQueuePool,
    pool_size=POOL_CONFIG['pool_size'],
    max_overflow=POOL_CONFIG['max_overflow'],
    pool_timeout=POOL_CONFIG['pool_timeout'],
    pool_recycle=POOL_CONFIG['pool_recycle'],
    pool_pre_ping=POOL_CONFIG['pool_pre_ping'],
    future=True,
    connect_args={
        "server_settings": {
            "search_path": "fhir,cds_hooks,public",
            "statement_timeout": str(STATEMENT_TIMEOUT),
            "lock_timeout": str(LOCK_TIMEOUT),
            "idle_in_transaction_session_timeout": str(IDLE_IN_TRANSACTION_TIMEOUT),
            "jit": "off",  # Disable JIT for more predictable performance
            "work_mem": "8MB",  # Increase work memory for complex queries
            "temp_buffers": "16MB",  # Increase temp buffers
        },
        "command_timeout": 60,
        "prepared_statement_cache_size": 0,  # Disable for pooling compatibility
        "statement_cache_size": 0,
    }
)

# Create session factory with optimized settings
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Base class for models
Base = declarative_base()

# Initialize pool monitor
pool_monitor: Optional[ConnectionPoolMonitor] = None


async def initialize_pool_monitor():
    """Initialize the connection pool monitor."""
    global pool_monitor
    if pool_monitor is None:
        pool_monitor = get_pool_monitor(engine)
        
        # Start monitoring if enabled
        if os.getenv('ENABLE_POOL_MONITORING', 'true').lower() == 'true':
            monitoring_interval = int(os.getenv('POOL_MONITORING_INTERVAL', '60'))
            await pool_monitor.start_monitoring(monitoring_interval)
            logger.info(f"Started connection pool monitoring (interval: {monitoring_interval}s)")


async def get_pool_status() -> Dict[str, Any]:
    """
    Get current connection pool status.
    
    Returns:
        Dictionary with pool metrics and health information
    """
    if pool_monitor:
        return await pool_monitor.get_pool_status()
    else:
        return {
            'error': 'Pool monitor not initialized',
            'hint': 'Call initialize_pool_monitor() first'
        }


async def optimize_pool_settings() -> Dict[str, Any]:
    """
    Get pool optimization recommendations.
    
    Returns:
        Dictionary with optimization suggestions
    """
    if pool_monitor:
        return await pool_monitor.optimize_pool_settings()
    else:
        return {
            'error': 'Pool monitor not initialized',
            'hint': 'Call initialize_pool_monitor() first'
        }


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session with monitoring.
    
    Usage in FastAPI:
        @app.get("/example")
        async def example(db: AsyncSession = Depends(get_db_session)):
            # Use db session
    """
    async with async_session_maker() as session:
        try:
            # Log session creation for monitoring
            if pool_monitor:
                pool_monitor.metrics['queries_executed'] += 1
            
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            
            # Track failed queries
            if pool_monitor:
                pool_monitor.metrics['connections_failed'] += 1
            
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncSession:
    """
    Context manager for database session with monitoring.
    
    Usage:
        async with get_db_context() as db:
            # Use db session
    """
    async with async_session_maker() as session:
        try:
            # Log session creation
            if pool_monitor:
                pool_monitor.metrics['queries_executed'] += 1
            
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            
            # Track failed queries
            if pool_monitor:
                pool_monitor.metrics['connections_failed'] += 1
            
            raise
        finally:
            await session.close()


async def test_connection() -> bool:
    """
    Test database connection and pool health.
    
    Returns:
        True if connection is healthy
    """
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


async def warmup_pool():
    """
    Warm up the connection pool by pre-creating connections.
    
    This can improve initial response times by ensuring connections
    are already established when requests arrive.
    """
    logger.info("Warming up connection pool...")
    
    # Create connections up to pool_size
    tasks = []
    for _ in range(POOL_CONFIG['pool_size']):
        tasks.append(test_connection())
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful = sum(1 for r in results if r is True)
    logger.info(f"Pool warmup complete: {successful}/{len(tasks)} connections established")


async def shutdown_database():
    """
    Gracefully shutdown database connections and monitoring.
    """
    # Stop monitoring
    if pool_monitor:
        await pool_monitor.stop_monitoring()
    
    # Close all connections
    await engine.dispose()
    logger.info("Database connections closed")


# FastAPI lifespan events integration
async def database_lifespan_startup():
    """
    Database startup tasks for FastAPI lifespan.
    
    Usage:
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            await database_lifespan_startup()
            yield
            await database_lifespan_shutdown()
    """
    # Initialize pool monitor
    await initialize_pool_monitor()
    
    # Test connection
    if await test_connection():
        logger.info("Database connection successful")
    else:
        logger.error("Database connection failed!")
    
    # Warm up pool if enabled
    if os.getenv('WARMUP_POOL', 'true').lower() == 'true':
        await warmup_pool()


async def database_lifespan_shutdown():
    """Database shutdown tasks for FastAPI lifespan."""
    await shutdown_database()


# Export for backward compatibility
init_db = test_connection
close_db = shutdown_database