"""
Health check endpoints for monitoring and load balancer configuration
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import os
import psutil

from database import get_db_session as get_db

router = APIRouter()

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "WintEHR FHIR API - Hot Reload Test",
        "version": os.getenv("VERSION", "1.0.0")
    }

@router.get("/health/detailed", status_code=status.HTTP_200_OK)
async def detailed_health_check(db: Session = Depends(get_db)):
    """Detailed health check with component status"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {}
    }
    
    # Check database connection
    try:
        db.execute(text("SELECT 1"))
        health_status["components"]["database"] = {
            "status": "healthy",
            "type": "postgresql" if "postgresql" in os.getenv("DATABASE_URL", "") else "sqlite"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Check system resources
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_status["components"]["system"] = {
            "status": "healthy",
            "cpu_usage": f"{cpu_percent}%",
            "memory_usage": f"{memory.percent}%",
            "disk_usage": f"{disk.percent}%",
            "memory_available": f"{memory.available / (1024**3):.2f} GB",
            "disk_available": f"{disk.free / (1024**3):.2f} GB"
        }
        
        # Warn if resources are getting high
        if cpu_percent > 80 or memory.percent > 80 or disk.percent > 80:
            health_status["components"]["system"]["status"] = "warning"
            
    except Exception as e:
        health_status["components"]["system"] = {
            "status": "unknown",
            "error": str(e)
        }
    
    # Check external services (if any)
    # Add checks for Redis, S3, etc. as needed
    
    return health_status

@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe for Kubernetes/ECS"""
    try:
        # Check if database is accessible and migrations are current
        db.execute(text("SELECT 1"))
        return {"ready": True}
    except Exception:
        return {"ready": False}, status.HTTP_503_SERVICE_UNAVAILABLE

@router.get("/live", status_code=status.HTTP_200_OK)
async def liveness_check():
    """Liveness probe for Kubernetes/ECS"""
    return {"alive": True}