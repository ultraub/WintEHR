"""
Teaching EMR System - Main Application
A lightweight EMR for educational purposes with FHIR and CDS Hooks support
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os

# Import database lifecycle functions
from database import init_db, close_db

# Import all routers
from api.routers import register_all_routers

# Import performance monitoring
from api.middleware.performance import setup_performance_monitoring

# Import security middleware
from api.middleware.security_middleware import setup_security_middleware

# Initialize FastAPI app
app = FastAPI(
    title="Teaching EMR System",
    description="A modern EMR system for teaching clinical workflows, FHIR, and CDS Hooks",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False  # Disable automatic slash redirects
)

# Set up security middleware (includes HTTPS enforcement, security headers, and secure CORS)
# NOTE: In production, this will enforce HTTPS and add security headers
setup_security_middleware(app)

# Set up performance monitoring
setup_performance_monitoring(app)

# Set up SMART on FHIR token validation middleware
# Controlled by SMART_ENABLED env var (default: true)
# SMART_ALLOW_UNPROTECTED=true allows unauthenticated reads for demo mode
from api.smart.middleware import setup_smart_middleware
setup_smart_middleware(app)

# Add default CORS for development if security middleware is disabled
if os.getenv("DISABLE_SECURITY_MIDDLEWARE", "false").lower() == "true":
    cors_origins = [
        o.strip() for o in
        os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
        if o.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register all routers using centralized registration
register_all_routers(app)

# Serve static files (if directory exists)
import os
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static", html=True), name="static")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Teaching EMR System API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# Health check endpoints.
# /health stays minimal and dependency-free — docker-compose and deploy.sh
# gate on it. /api/health is the detailed one: it reports routers that
# failed to register (FAILED_ROUTERS), so a feature that silently 404s
# shows up here instead of looking like a frontend bug. (This route was
# shadowed by the CDS Hooks router's generic /health for months — that
# route now lives at /api/cds-hooks/health.)
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Teaching EMR API"}

@app.get("/api/health")
async def api_health_check():
    from api.routers import DISABLED_MODULES, FAILED_ROUTERS, MODULE_ROUTERS, ROUTERS
    module_router_count = sum(
        len(entries) for key, entries in MODULE_ROUTERS.items()
        if key not in DISABLED_MODULES
    )
    return {
        "status": "degraded" if FAILED_ROUTERS else "healthy",
        "service": "Teaching EMR API",
        "routers": {
            "registered": len(ROUTERS) + module_router_count - len(FAILED_ROUTERS),
            "failed": FAILED_ROUTERS,
            # Module keys switched off via WINTEHR_DISABLED_MODULES — a
            # deliberately absent feature, distinct from a failed one.
            "disabled_modules": DISABLED_MODULES,
        },
    }

from api.websocket.connection_pool import connection_pool

# Startup event
@app.on_event("startup")
async def startup_event():
    await init_db()
    connection_pool.start_background_tasks()

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    await close_db()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        # Security middleware already sets "Server: HealthcareServer";
        # uvicorn's own header duplicated it (nginx warned on every response).
        server_header=False,
        port=8000,
        reload=True
    )