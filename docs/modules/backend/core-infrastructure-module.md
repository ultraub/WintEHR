# Core Infrastructure Module

## Overview
The Core Infrastructure Module provides the foundational services and utilities that support all other modules in WintEHR. This includes database connectivity, configuration management, logging, error handling, and system-wide utilities.

## Architecture
```
Core Infrastructure Module
├── Database Layer/
│   ├── database.py
│   ├── models.py
│   └── connection_pool.py
├── Configuration/
│   ├── config.py
│   ├── settings.py
│   └── environment.py
├── Middleware/
│   ├── error_handler.py
│   ├── request_logger.py
│   └── cors_middleware.py
├── Utilities/
│   ├── datetime_utils.py
│   ├── json_encoder.py
│   └── validators.py
└── Application Core/
    ├── main.py
    ├── dependencies.py
    └── startup.py
```

## Core Components

### Application Entry Point (main.py)
**Purpose**: FastAPI application initialization and configuration

**Application Setup**:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    # Startup
    logger.info("Starting WintEHR application")
    
    # Initialize database
    await init_database()
    
    # Load reference data
    await load_reference_data()
    
    # Start background tasks
    asyncio.create_task(health_check_monitor())
    
    yield
    
    # Shutdown
    logger.info("Shutting down WintEHR application")
    
    # Close database connections
    await close_database_connections()
    
    # Cancel background tasks
    await cancel_background_tasks()

# Create FastAPI app
app = FastAPI(
    title="WintEHR",
    description="FHIR-native Electronic Medical Record System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(DatabaseSessionMiddleware)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(fhir_router, prefix="/fhir/R4", tags=["fhir"])
app.include_router(clinical_router, prefix="/api/clinical", tags=["clinical"])
app.include_router(pharmacy_router, prefix="/api/pharmacy", tags=["pharmacy"])
app.include_router(dicom_router, prefix="/api/dicom", tags=["imaging"])
```

### Database Layer (database.py)
**Purpose**: PostgreSQL connection management with async support

**Connection Pool**:
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
import asyncpg

# Database URL construction
DATABASE_URL = (
    f"postgresql+asyncpg://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
)

# Create async engine with connection pooling
engine = create_async_engine(
    DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,  # Verify connections before use
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base for models
Base = declarative_base()

# Dependency for FastAPI
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide database session for requests"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Connection management
class DatabaseManager:
    @staticmethod
    async def init_db():
        """Initialize database tables"""
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    
    @staticmethod
    async def check_connection() -> bool:
        """Health check for database"""
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    @staticmethod
    async def close():
        """Close all database connections"""
        await engine.dispose()
```

### Configuration Management (config.py)
**Purpose**: Centralized configuration with environment variable support

**Settings Management**:
```python
from pydantic import BaseSettings, Field, validator
from typing import List, Optional
import os

class Settings(BaseSettings):
    """Application settings with validation"""
    
    # Application
    APP_NAME: str = "WintEHR"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, env="DEBUG")
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    
    # Database
    DB_HOST: str = Field(default="localhost", env="DB_HOST")
    DB_PORT: int = Field(default=5432, env="DB_PORT")
    DB_NAME: str = Field(default="wintehr", env="DB_NAME")
    DB_USER: str = Field(default="postgres", env="DB_USER")
    DB_PASSWORD: str = Field(default="postgres", env="DB_PASSWORD")
    DB_POOL_SIZE: int = Field(default=20, env="DB_POOL_SIZE")
    DB_MAX_OVERFLOW: int = Field(default=10, env="DB_MAX_OVERFLOW")
    
    # Security
    JWT_SECRET_KEY: str = Field(..., env="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = Field(default="HS256", env="JWT_ALGORITHM")
    JWT_EXPIRATION_MINUTES: int = Field(default=30, env="JWT_EXPIRATION_MINUTES")
    JWT_ENABLED: bool = Field(default=False, env="JWT_ENABLED")
    
    # CORS
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000"],
        env="CORS_ORIGINS"
    )
    
    # Redis (optional)
    REDIS_URL: Optional[str] = Field(default=None, env="REDIS_URL")
    CACHE_TTL: int = Field(default=300, env="CACHE_TTL")
    
    # External Services
    TERMINOLOGY_SERVER_URL: Optional[str] = Field(
        default=None,
        env="TERMINOLOGY_SERVER_URL"
    )
    
    # File Storage
    UPLOAD_DIR: str = Field(default="/tmp/uploads", env="UPLOAD_DIR")
    MAX_UPLOAD_SIZE: int = Field(default=10485760, env="MAX_UPLOAD_SIZE")  # 10MB
    
    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("JWT_SECRET_KEY")
    def validate_jwt_secret(cls, v, values):
        if values.get("JWT_ENABLED") and not v:
            raise ValueError("JWT_SECRET_KEY required when JWT_ENABLED=true")
        return v or "development-secret-key"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

# Singleton instance
settings = Settings()

# Environment-specific configuration
def get_environment_config():
    """Load environment-specific configuration"""
    env = settings.ENVIRONMENT.lower()
    
    if env == "production":
        return ProductionConfig()
    elif env == "staging":
        return StagingConfig()
    elif env == "testing":
        return TestingConfig()
    else:
        return DevelopmentConfig()

class DevelopmentConfig:
    LOG_LEVEL = "DEBUG"
    ALLOW_SWAGGER = True
    USE_CACHE = False
    
class ProductionConfig:
    LOG_LEVEL = "INFO"
    ALLOW_SWAGGER = False
    USE_CACHE = True
    FORCE_HTTPS = True
```

### Error Handling Middleware
**Purpose**: Consistent error responses and logging

**Error Handler Implementation**:
```python
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
import traceback

class ErrorHandlingMiddleware:
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            return await self.handle_exception(request, exc)
    
    async def handle_exception(self, request: Request, exc: Exception):
        """Convert exceptions to JSON responses"""
        
        # Request validation errors
        if isinstance(exc, RequestValidationError):
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "error": "Validation Error",
                    "details": exc.errors(),
                    "body": exc.body
                }
            )
        
        # HTTP exceptions
        elif isinstance(exc, HTTPException):
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": exc.detail,
                    "status_code": exc.status_code
                }
            )
        
        # FHIR-specific exceptions
        elif isinstance(exc, FHIRException):
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "resourceType": "OperationOutcome",
                    "issue": [{
                        "severity": exc.severity,
                        "code": exc.code,
                        "details": {
                            "text": str(exc)
                        }
                    }]
                }
            )
        
        # Unhandled exceptions
        else:
            # Log full traceback
            logger.error(
                f"Unhandled exception: {type(exc).__name__}: {exc}\n"
                f"Traceback: {traceback.format_exc()}"
            )
            
            # Return generic error in production
            if settings.ENVIRONMENT == "production":
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "error": "Internal Server Error",
                        "message": "An unexpected error occurred"
                    }
                )
            else:
                # Include details in development
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "error": "Internal Server Error",
                        "type": type(exc).__name__,
                        "message": str(exc),
                        "traceback": traceback.format_exc().split("\n")
                    }
                )
```

### Request Logging Middleware
**Purpose**: Comprehensive request/response logging

```python
import time
import uuid
from fastapi import Request

class RequestLoggingMiddleware:
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, request: Request, call_next):
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Log request
        logger.info(
            f"Request {request_id}: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_host": request.client.host if request.client else None
            }
        )
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log response
        logger.info(
            f"Response {request_id}: {response.status_code} in {duration:.3f}s",
            extra={
                "request_id": request_id,
                "status_code": response.status_code,
                "duration": duration
            }
        )
        
        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(duration)
        
        return response
```

### Utility Functions

**DateTime Utilities**:
```python
from datetime import datetime, timezone
import pytz

class DateTimeUtils:
    @staticmethod
    def utc_now() -> datetime:
        """Get current UTC datetime"""
        return datetime.now(timezone.utc)
    
    @staticmethod
    def parse_fhir_datetime(dt_string: str) -> datetime:
        """Parse FHIR datetime string"""
        # Handle various FHIR datetime formats
        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d"
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_string, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"Unable to parse datetime: {dt_string}")
    
    @staticmethod
    def to_fhir_instant(dt: datetime) -> str:
        """Convert datetime to FHIR instant format"""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
```

**JSON Encoder**:
```python
import json
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID

class FHIRJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for FHIR resources"""
    
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, date):
            return obj.isoformat()
        elif isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, UUID):
            return str(obj)
        elif hasattr(obj, "to_dict"):
            return obj.to_dict()
        elif hasattr(obj, "__dict__"):
            return obj.__dict__
        
        return super().default(obj)
```

### Dependency Injection
**Purpose**: Provide common dependencies for FastAPI routes

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Security scheme
security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    if not settings.JWT_ENABLED:
        # Training mode - return mock user
        return User(
            id="training-user",
            username="doctor",
            role="physician",
            permissions=["all"]
        )
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Validate token
    try:
        payload = validate_token(credentials.credentials)
        user = await get_user_by_id(db, payload.sub)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

# Permission checker
def require_permission(resource: str, action: str):
    """Decorator to check permissions"""
    async def permission_checker(
        user: User = Depends(get_current_user)
    ):
        if not has_permission(user, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {action} on {resource}"
            )
        return user
    return permission_checker
```

## System Monitoring

### Health Checks
```python
@app.get("/health")
async def health_check():
    """System health check endpoint"""
    checks = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }
    
    # Database check
    db_healthy = await DatabaseManager.check_connection()
    checks["checks"]["database"] = {
        "status": "healthy" if db_healthy else "unhealthy",
        "response_time": 0  # Add actual timing
    }
    
    # Redis check (if enabled)
    if settings.REDIS_URL:
        redis_healthy = await check_redis_connection()
        checks["checks"]["cache"] = {
            "status": "healthy" if redis_healthy else "unhealthy"
        }
    
    # Determine overall status
    if not all(c["status"] == "healthy" for c in checks["checks"].values()):
        checks["status"] = "degraded"
    
    return checks
```

### Metrics Collection
```python
from prometheus_client import Counter, Histogram, generate_latest

# Define metrics
request_count = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

request_duration = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration",
    ["method", "endpoint"]
)

fhir_operations = Counter(
    "fhir_operations_total",
    "FHIR operations",
    ["resource_type", "operation"]
)

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(
        generate_latest(),
        media_type="text/plain"
    )
```

## Integration Points

### Service Registration
- All modules register with core
- Dependency injection setup
- Middleware configuration
- Event bus integration

### Cross-Cutting Concerns
- Logging configuration
- Error handling
- Security enforcement
- Performance monitoring

### Infrastructure Services
- Database connections
- Cache management
- File storage
- External APIs

## Key Features

### Reliability
- Connection pooling
- Circuit breakers
- Retry logic
- Graceful degradation
- Health monitoring

### Performance
- Async throughout
- Connection reuse
- Response caching
- Lazy loading
- Resource limits

### Security
- Input validation
- SQL injection prevention
- XSS protection
- CORS configuration
- Rate limiting

## Educational Value

### Architecture Patterns
- Dependency injection
- Middleware pipeline
- Configuration management
- Error handling
- Logging strategies

### FastAPI Best Practices
- Application structure
- Async patterns
- Dependency design
- Exception handling
- Testing setup

### Production Readiness
- Health checks
- Monitoring
- Logging
- Configuration
- Deployment

## Missing Features & Improvements

### Planned Enhancements
- Service mesh integration
- Distributed tracing
- Feature flags
- A/B testing
- Blue-green deployment

### Technical Improvements
- Circuit breaker pattern
- Request queuing
- Background jobs
- Event streaming
- GraphQL support

### Operational Features
- Admin dashboard
- System metrics
- Log aggregation
- Alert management
- Backup automation

## Best Practices

### Application Design
- Single responsibility
- Loose coupling
- High cohesion
- Clear boundaries
- Testability

### Configuration
- Environment variables
- Secret management
- Feature toggles
- Graceful defaults
- Validation

### Operations
- Structured logging
- Metric collection
- Error tracking
- Performance monitoring
- Capacity planning

## Module Dependencies
```
Core Infrastructure Module
├── Python Standard Library
├── FastAPI Framework
├── SQLAlchemy (async)
├── Pydantic
└── External Services
    ├── PostgreSQL
    ├── Redis (optional)
    ├── Monitoring (Prometheus)
    └── Logging (ELK Stack)
```

## Testing Strategy
- Unit tests for utilities
- Integration tests for database
- API contract tests
- Load testing
- Chaos engineering