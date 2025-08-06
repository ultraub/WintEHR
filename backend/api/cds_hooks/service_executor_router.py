"""
CDS Hooks Service Executor Router
API endpoints for executing and validating user-written CDS services
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from database import get_db_session
from api.auth.jwt_handler import verify_token
from .service_executor import (
    execute_user_service,
    validate_service_code,
    ServiceExecutionRequest,
    ServiceExecutionResult
)
from .models import CDSHookRequest

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cds-services/executor",
    tags=["cds-executor"],
    responses={404: {"description": "Not found"}}
)

# Security scheme
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Verify JWT token and return user info"""
    try:
        token = credentials.credentials
        payload = verify_token(token)
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/execute", response_model=ServiceExecutionResult)
async def execute_service(
    request: ServiceExecutionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> ServiceExecutionResult:
    """
    Execute a CDS service in a sandboxed environment
    
    This endpoint allows authorized users to test their CDS service implementations
    in a secure sandbox before deployment.
    """
    try:
        # Log execution attempt
        logger.info(f"User {current_user.get('sub')} executing CDS service")
        
        # Execute the service
        result = await execute_user_service(
            code=request.code,
            request=request.request,
            timeout=request.timeout,
            debug=request.debug
        )
        
        # Log result
        if result.success:
            logger.info(f"Service execution successful: {len(result.response.cards)} cards returned")
        else:
            logger.warning(f"Service execution failed: {result.error}")
        
        return result
        
    except Exception as e:
        logger.exception("Service execution error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Service execution failed: {str(e)}"
        )

@router.post("/validate")
async def validate_service(
    code: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Validate CDS service code without executing it
    
    Checks for:
    - Required service structure (class, metadata, execute method)
    - Forbidden patterns (eval, require, import, network access)
    - Syntax errors
    - Code size limits
    """
    try:
        result = await validate_service_code(code)
        return result
        
    except Exception as e:
        logger.exception("Service validation error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )

@router.post("/test")
async def test_service_with_data(
    code: str,
    hook: str,
    context: Dict[str, Any],
    prefetch: Optional[Dict[str, Any]] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Test a CDS service with specific hook context and prefetch data
    
    This is useful for testing services against real patient data
    before deploying them to production.
    """
    try:
        # Create CDS Hook request
        request = {
            "hook": hook,
            "hookInstance": f"test-{current_user.get('sub')}-{hash(code) % 10000}",
            "fhirServer": "http://localhost:8000/fhir/R4",  # TODO: Get from config
            "context": context,
            "prefetch": prefetch or {}
        }
        
        # Execute the service
        result = await execute_user_service(
            code=code,
            request=request,
            timeout=10,
            debug=True
        )
        
        if result.success:
            return {
                "success": True,
                "response": result.response.dict(),
                "logs": result.logs,
                "executionTime": result.execution_time
            }
        else:
            return {
                "success": False,
                "error": result.error,
                "logs": result.logs,
                "executionTime": result.execution_time
            }
            
    except Exception as e:
        logger.exception("Service test error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test failed: {str(e)}"
        )

@router.get("/sandbox/status")
async def get_sandbox_status(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get sandbox environment status"""
    try:
        # Check if Node.js is available
        import subprocess
        node_version = subprocess.check_output(["node", "--version"]).decode().strip()
        
        return {
            "status": "healthy",
            "nodeVersion": node_version,
            "sandboxEnabled": True,
            "maxExecutionTime": 10,
            "maxCodeSize": 50000
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "sandboxEnabled": False
        }