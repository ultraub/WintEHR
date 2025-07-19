"""
Performance monitoring middleware for FastAPI.

Tracks request processing time, database query time, and other metrics.
"""

import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


class PerformanceMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track API performance metrics.
    
    Adds headers:
    - X-Process-Time: Total request processing time
    - X-DB-Time: Database query time (if available)
    - X-Cache-Hit: Whether response was served from cache
    """
    
    def __init__(self, app: ASGIApp, enable_logging: bool = True):
        super().__init__(app)
        self.enable_logging = enable_logging
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process the request and add performance headers."""
        # Start timing
        start_time = time.time()
        
        # Initialize request state for tracking
        request.state.db_time = 0.0
        request.state.cache_hits = 0
        request.state.cache_misses = 0
        
        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            # Log slow requests even on error
            process_time = time.time() - start_time
            if process_time > 1.0:  # Log requests taking more than 1 second
                logger.warning(
                    f"Slow request (error): {request.method} {request.url.path} "
                    f"took {process_time:.3f}s - Error: {str(e)}"
                )
            raise
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Add performance headers
        response.headers["X-Process-Time"] = f"{process_time:.3f}"
        
        # Add database time if tracked
        if hasattr(request.state, "db_time") and request.state.db_time > 0:
            response.headers["X-DB-Time"] = f"{request.state.db_time:.3f}"
            response.headers["X-DB-Queries"] = str(getattr(request.state, "db_queries", 0))
        
        # Add cache statistics
        if hasattr(request.state, "cache_hits"):
            total_cache_requests = request.state.cache_hits + request.state.cache_misses
            if total_cache_requests > 0:
                hit_rate = request.state.cache_hits / total_cache_requests
                response.headers["X-Cache-Hit-Rate"] = f"{hit_rate:.2%}"
                response.headers["X-Cache-Hits"] = str(request.state.cache_hits)
        
        # Log slow requests
        if self.enable_logging and process_time > 1.0:
            logger.warning(
                f"Slow request: {request.method} {request.url.path} "
                f"took {process_time:.3f}s (DB: {request.state.db_time:.3f}s)"
            )
        
        # Log extremely slow requests with more detail
        if process_time > 5.0:
            logger.error(
                f"Very slow request: {request.method} {request.url.path}\n"
                f"  Total time: {process_time:.3f}s\n"
                f"  DB time: {request.state.db_time:.3f}s\n"
                f"  DB queries: {getattr(request.state, 'db_queries', 0)}\n"
                f"  Cache hits: {request.state.cache_hits}\n"
                f"  Query params: {dict(request.query_params)}"
            )
        
        return response


class DatabaseTimingMiddleware:
    """
    Middleware to track database query timing.
    
    This should be used with SQLAlchemy event listeners to track actual DB time.
    """
    
    def __init__(self, app: ASGIApp):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Initialize timing in scope
            scope["state"] = getattr(scope, "state", {})
            scope["state"]["db_start_time"] = None
            scope["state"]["db_total_time"] = 0.0
            scope["state"]["db_query_count"] = 0
        
        await self.app(scope, receive, send)


def setup_performance_monitoring(app):
    """
    Set up performance monitoring for the FastAPI app.
    
    Args:
        app: FastAPI application instance
    """
    # Add performance middleware
    app.add_middleware(PerformanceMiddleware, enable_logging=True)
    
    # Add route timing
    @app.middleware("http")
    async def add_route_timing(request: Request, call_next):
        """Add route-specific timing."""
        route_start = time.time()
        
        # Store route info in request state
        if request.url.path.startswith("/fhir/R4/"):
            request.state.is_fhir_request = True
            # Extract resource type
            path_parts = request.url.path.split("/")
            if len(path_parts) >= 4:
                request.state.resource_type = path_parts[3]
        
        response = await call_next(request)
        
        # Add route timing header for FHIR requests
        if getattr(request.state, "is_fhir_request", False):
            route_time = time.time() - route_start
            response.headers["X-FHIR-Route-Time"] = f"{route_time:.3f}"
        
        return response
    
    return app