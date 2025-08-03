"""
Security Middleware for WintEHR
Implements HTTPS enforcement, security headers, and other protections
"""

from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import os
import logging
from typing import Callable
from datetime import datetime

logger = logging.getLogger(__name__)


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce HTTPS in production environments.
    Redirects all HTTP requests to HTTPS.
    """
    
    def __init__(self, app: ASGIApp, force_https: bool = None):
        super().__init__(app)
        # Allow override via parameter or environment variable
        if force_https is not None:
            self.force_https = force_https
        else:
            # Enable HTTPS redirect in production or when explicitly set
            self.force_https = (
                os.getenv("ENVIRONMENT", "development").lower() == "production" or
                os.getenv("FORCE_HTTPS", "false").lower() == "true"
            )
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip enforcement for local development
        if not self.force_https:
            return await call_next(request)
        
        # Check if request is already HTTPS
        # Handle various proxy headers
        proto = (
            request.headers.get("x-forwarded-proto") or
            request.headers.get("x-forwarded-protocol") or
            request.headers.get("x-url-scheme") or
            request.url.scheme
        )
        
        if proto != "https":
            # Build HTTPS URL
            url = request.url.replace(scheme="https")
            
            # Log the redirect for monitoring
            logger.info(f"Redirecting HTTP to HTTPS: {request.url} -> {url}")
            
            # Return permanent redirect
            return RedirectResponse(url=str(url), status_code=301)
        
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    Implements OWASP recommended security headers.
    """
    
    def __init__(self, app: ASGIApp, config: dict = None):
        super().__init__(app)
        self.config = config or {}
        
        # Default security headers
        self.default_headers = {
            # Prevent clickjacking
            "X-Frame-Options": "DENY",
            
            # Prevent MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            
            # Enable XSS filter in browsers
            "X-XSS-Protection": "1; mode=block",
            
            # Control referrer information
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # Permissions Policy (formerly Feature Policy)
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
            
            # Remove server header value (set to generic)
            "Server": "HealthcareServer",
        }
        
        # Content Security Policy - customize based on your needs
        self.csp = self.config.get("csp", {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],  # Tighten in production
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": ["'self'", "data:", "blob:"],
            "connect-src": ["'self'", "ws:", "wss:"],
            "frame-ancestors": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"]
        })
        
        # HSTS configuration
        self.hsts_enabled = self.config.get("hsts_enabled", 
            os.getenv("ENVIRONMENT", "development").lower() == "production"
        )
        self.hsts_max_age = self.config.get("hsts_max_age", 31536000)  # 1 year
        self.hsts_include_subdomains = self.config.get("hsts_include_subdomains", True)
        self.hsts_preload = self.config.get("hsts_preload", False)
    
    def build_csp_header(self) -> str:
        """Build Content Security Policy header value."""
        directives = []
        for directive, sources in self.csp.items():
            if sources:
                sources_str = " ".join(sources)
                directives.append(f"{directive} {sources_str}")
        return "; ".join(directives)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Process request
        response = await call_next(request)
        
        # Add security headers
        for header, value in self.default_headers.items():
            response.headers[header] = value
        
        # Add CSP header
        response.headers["Content-Security-Policy"] = self.build_csp_header()
        
        # Add HSTS header in production
        if self.hsts_enabled:
            hsts_value = f"max-age={self.hsts_max_age}"
            if self.hsts_include_subdomains:
                hsts_value += "; includeSubDomains"
            if self.hsts_preload:
                hsts_value += "; preload"
            response.headers["Strict-Transport-Security"] = hsts_value
        
        # Add cache control for sensitive endpoints
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
        
        return response


class CORSSecurityMiddleware(BaseHTTPMiddleware):
    """
    Enhanced CORS middleware with security considerations.
    More restrictive than default FastAPI CORS middleware.
    """
    
    def __init__(
        self, 
        app: ASGIApp,
        allowed_origins: list = None,
        allowed_methods: list = None,
        allowed_headers: list = None,
        allow_credentials: bool = True,
        max_age: int = 3600
    ):
        super().__init__(app)
        
        # Configure allowed origins - be restrictive in production
        self.allowed_origins = allowed_origins or self._get_default_origins()
        self.allowed_methods = allowed_methods or ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        self.allowed_headers = allowed_headers or [
            "Authorization",
            "Content-Type",
            "X-Requested-With",
            "X-CSRF-Token"
        ]
        self.allow_credentials = allow_credentials
        self.max_age = max_age
    
    def _get_default_origins(self) -> list:
        """Get default allowed origins based on environment."""
        env = os.getenv("ENVIRONMENT", "development").lower()
        
        if env == "production":
            # In production, explicitly list allowed origins
            return [
                os.getenv("FRONTEND_URL", "https://app.wintehr.com"),
                # Add other production origins as needed
            ]
        else:
            # Development allows localhost
            return [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001"
            ]
    
    def is_allowed_origin(self, origin: str) -> bool:
        """Check if origin is allowed."""
        if "*" in self.allowed_origins:
            return True
        return origin in self.allowed_origins
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get origin header
        origin = request.headers.get("origin")
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response(status_code=200)
            
            if origin and self.is_allowed_origin(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allowed_methods)
                response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allowed_headers)
                response.headers["Access-Control-Max-Age"] = str(self.max_age)
                
                if self.allow_credentials:
                    response.headers["Access-Control-Allow-Credentials"] = "true"
            
            return response
        
        # Process actual request
        response = await call_next(request)
        
        # Add CORS headers if origin is allowed
        if origin and self.is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            
            if self.allow_credentials:
                response.headers["Access-Control-Allow-Credentials"] = "true"
            
            # Expose specific headers to frontend
            response.headers["Access-Control-Expose-Headers"] = "Content-Length, X-Request-ID"
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging requests for security monitoring.
    Logs suspicious patterns and security-relevant events.
    """
    
    def __init__(self, app: ASGIApp, log_bodies: bool = False):
        super().__init__(app)
        self.log_bodies = log_bodies
        
        # Patterns that might indicate attacks
        self.suspicious_patterns = [
            "../",  # Path traversal
            "<script",  # XSS attempt
            "union select",  # SQL injection
            "exec(",  # Code injection
            "${",  # Template injection
            "{{",  # Template injection
            "%00",  # Null byte injection
            "\x00",  # Null byte
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID for tracking
        request_id = request.headers.get("X-Request-ID", datetime.utcnow().timestamp())
        
        # Log request
        logger.info(f"Request {request_id}: {request.method} {request.url.path}")
        
        # Check for suspicious patterns in URL
        url_str = str(request.url)
        for pattern in self.suspicious_patterns:
            if pattern.lower() in url_str.lower():
                logger.warning(
                    f"Suspicious pattern detected in request {request_id}: "
                    f"Pattern '{pattern}' in URL: {url_str}"
                )
        
        # Process request
        start_time = datetime.utcnow()
        response = await call_next(request)
        duration = (datetime.utcnow() - start_time).total_seconds()
        
        # Log response
        logger.info(
            f"Response {request_id}: Status {response.status_code}, "
            f"Duration: {duration:.3f}s"
        )
        
        # Log slow requests
        if duration > 5.0:
            logger.warning(f"Slow request {request_id}: {duration:.3f}s for {request.url.path}")
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = str(request_id)
        
        return response


def setup_security_middleware(app):
    """
    Configure all security middleware for the application.
    Call this in your main FastAPI app setup.
    """
    
    # 1. HTTPS Redirect (outermost - redirects before other processing)
    app.add_middleware(HTTPSRedirectMiddleware)
    
    # 2. Security Headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    # 3. CORS with security
    app.add_middleware(
        CORSSecurityMiddleware,
        allowed_origins=None,  # Uses environment-based defaults
        allow_credentials=True,
        max_age=3600
    )
    
    # 4. Request Logging for security monitoring
    app.add_middleware(RequestLoggingMiddleware)
    
    logger.info("Security middleware configured successfully")