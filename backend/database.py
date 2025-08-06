"""
Database connection and session management.

Provides async database connections using SQLAlchemy with PostgreSQL.
"""

import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool, AsyncAdaptedQueuePool
from contextlib import asynccontextmanager

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"
)

# Create async engine with proper connection pooling
# Connection pooling dramatically improves performance by reusing connections
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    poolclass=AsyncAdaptedQueuePool,  # Proper async connection pooling
    pool_size=20,                      # Number of connections to maintain
    max_overflow=40,                   # Maximum overflow connections
    pool_timeout=30,                   # Timeout waiting for connection
    pool_recycle=3600,                 # Recycle connections after 1 hour
    pool_pre_ping=True,                # Test connections before use
    future=True,
    connect_args={
        "server_settings": {
            "search_path": "fhir,cds_hooks,public"
        },
        "command_timeout": 60,
        "prepared_statement_cache_size": 0,  # Disable prepared statements for pooling compatibility
        "statement_cache_size": 0  # This is the correct parameter name for asyncpg
    }
)

# Create session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Base class for models (if needed for EMR extensions)
Base = declarative_base()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session.
    
    Usage in FastAPI:
        @app.get("/example")
        async def example(db: AsyncSession = Depends(get_db_session)):
            # Use db session
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncSession:
    """
    Context manager for database session.
    
    Usage:
        async with get_db_context() as db:
            # Use db session
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database (create tables if needed)."""
    # This is handled by Alembic migrations
    pass


async def close_db():
    """Close database connections."""
    await engine.dispose()