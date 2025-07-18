"""
Teaching EMR System - Main Application
A lightweight EMR for educational purposes with FHIR and CDS Hooks support
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Import database lifecycle functions
from database import init_db, close_db

# Import all routers
from api.routers import register_all_routers

# Initialize FastAPI app
app = FastAPI(
    title="Teaching EMR System",
    description="A modern EMR system for teaching clinical workflows, FHIR, and CDS Hooks",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
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

# Health check endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Teaching EMR API"}

@app.get("/api/health") 
async def api_health_check():
    return {"status": "healthy", "service": "Teaching EMR API"}

# Startup event
@app.on_event("startup")
async def startup_event():
    await init_db()

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    await close_db()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )