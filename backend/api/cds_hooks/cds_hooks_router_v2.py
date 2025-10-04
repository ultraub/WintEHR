"""
CDS Hooks Router v2
Implements CDS Hooks 2.0 specification compliant endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import uuid
import logging

from database import get_db_session
from .models import (
    CDSHookRequest,
    CDSHookResponse,
    CDSServicesResponse,
    CDSService,
    Card,
    Source,
    Suggestion,
    SystemAction,
    Link,
    OverrideReason,
    HookType,
    IndicatorType,
)
from .system_actions import SystemActionsHandler
from .service_registry import service_registry, ServiceDefinition
from .database_models import CDSExecution
from sqlalchemy import insert

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["CDS Hooks 2.0"])

# Include sub-routers
from .feedback_router import router as feedback_router
router.include_router(feedback_router, tags=["CDS Hooks Feedback"])


@router.get("/", response_model=CDSServicesResponse)
async def discover_services(
    db: AsyncSession = Depends(get_db_session)
) -> CDSServicesResponse:
    """
    CDS Service discovery endpoint
    Returns a list of all available CDS services
    """
    try:
        # Get all enabled services from registry
        services = await service_registry.get_all_services()
        
        # Convert to CDS Service format
        cds_services = []
        for service_def in services:
            if service_def.enabled:
                cds_service = CDSService(
                    id=service_def.id,
                    hook=service_def.hook,
                    title=service_def.title,
                    description=service_def.description,
                    prefetch=service_def.prefetch,
                    usageRequirements=service_def.usage_requirements
                )
                cds_services.append(cds_service)
        
        return CDSServicesResponse(services=cds_services)
        
    except Exception as e:
        logger.error(f"Error discovering services: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to discover services")


@router.post("/{service_id}", response_model=CDSHookResponse)
async def invoke_service(
    service_id: str,
    request: CDSHookRequest,
    db: AsyncSession = Depends(get_db_session)
) -> CDSHookResponse:
    """
    Invoke a specific CDS service
    
    This endpoint receives hook context and returns cards with clinical decision support
    """
    execution_start = datetime.utcnow()
    
    try:
        # Get the service definition
        service_def = await service_registry.get_service(service_id)
        if not service_def:
            raise HTTPException(status_code=404, detail=f"Service {service_id} not found")
        
        if not service_def.enabled:
            raise HTTPException(status_code=403, detail=f"Service {service_id} is disabled")
        
        # Validate hook type matches
        if service_def.hook != request.hook:
            raise HTTPException(
                status_code=400, 
                detail=f"Service {service_id} expects hook {service_def.hook}, got {request.hook}"
            )
        
        # Get service implementation
        implementation = service_registry.get_implementation(service_id)
        if not implementation:
            logger.warning(f"No implementation found for service {service_id}")
            return CDSHookResponse(cards=[], systemActions=None)
        
        # Prepare prefetch data if not provided
        prefetch = request.prefetch or {}
        if not prefetch and service_def.prefetch:
            # TODO: Implement prefetch resolution
            logger.info(f"No prefetch data provided for service {service_id}")
        
        # Check if service should execute
        should_execute = await implementation.should_execute(request.context, prefetch)
        if not should_execute:
            logger.info(f"Service {service_id} conditions not met")
            return CDSHookResponse(cards=[], systemActions=None)
        
        # Execute the service
        cards = await implementation.execute(request.context, prefetch)
        
        # Ensure all cards have UUIDs
        for card in cards:
            if not card.uuid:
                card.uuid = str(uuid.uuid4())
        
        # Process system actions if any
        system_actions = None
        if hasattr(implementation, 'get_system_actions'):
            system_actions_handler = SystemActionsHandler()
            system_actions_list = await implementation.get_system_actions(request.context, prefetch)
            if system_actions_list:
                # Validate but don't apply in dry run mode
                validation_results = await system_actions_handler.process_system_actions(
                    system_actions_list,
                    {
                        **request.context,
                        "serviceId": service_id,
                        "hookInstance": request.hookInstance
                    },
                    db,
                    dry_run=True
                )
                
                # Only include valid system actions
                if validation_results["processed"]:
                    system_actions = system_actions_list
        
        # Create response
        response = CDSHookResponse(
            cards=cards,
            systemActions=system_actions
        )
        
        # Log execution for analytics
        execution_time = int((datetime.utcnow() - execution_start).total_seconds() * 1000)
        await _log_execution(
            db,
            service_id,
            request,
            response,
            execution_time
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error invoking service {service_id}: {str(e)}")
        
        # Log failed execution
        execution_time = int((datetime.utcnow() - execution_start).total_seconds() * 1000)
        await _log_execution(
            db,
            service_id,
            request,
            None,
            execution_time,
            error_message=str(e)
        )
        
        # Return empty response on error (fail gracefully)
        return CDSHookResponse(cards=[], systemActions=None)


@router.post("/{service_id}/apply-system-actions")
async def apply_system_actions(
    service_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Apply system actions from a CDS service response
    
    This endpoint is used when the EHR is ready to apply the auto-suggested changes
    """
    try:
        # Parse request body
        body = await request.json()
        hook_instance = body.get("hookInstance")
        system_actions_data = body.get("systemActions", [])
        context = body.get("context", {})
        
        if not hook_instance:
            raise HTTPException(status_code=400, detail="hookInstance is required")
        
        if not system_actions_data:
            raise HTTPException(status_code=400, detail="No system actions to apply")
        
        # Convert to SystemAction objects
        system_actions = [SystemAction(**action) for action in system_actions_data]
        
        # Process system actions
        handler = SystemActionsHandler()
        results = await handler.process_system_actions(
            system_actions,
            {
                **context,
                "serviceId": service_id,
                "hookInstance": hook_instance
            },
            db,
            dry_run=False
        )
        
        return {
            "status": "success",
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying system actions for service {service_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to apply system actions")


async def _log_execution(
    db: AsyncSession,
    service_id: str,
    request: CDSHookRequest,
    response: Optional[CDSHookResponse],
    execution_time: int,
    error_message: Optional[str] = None
):
    """Log CDS service execution for analytics"""
    try:
        execution_data = {
            "service_id": service_id,
            "hook_instance": request.hookInstance,
            "hook": request.hook.value,
            "patient_id": request.context.get("patientId"),
            "user_id": request.context.get("userId"),
            "encounter_id": request.context.get("encounterId"),
            "fhir_server": request.fhirServer,
            "execution_time_ms": execution_time,
            "executed_at": datetime.utcnow(),
            "error_message": error_message
        }
        
        if response:
            execution_data["cards_returned"] = len(response.cards)
            execution_data["system_actions_returned"] = len(response.systemActions) if response.systemActions else 0
            
            # Store card UUIDs for feedback tracking
            execution_data["response_cards"] = [
                {"uuid": card.uuid, "summary": card.summary} 
                for card in response.cards
            ]
        
        stmt = insert(CDSExecution).values(**execution_data)
        await db.execute(stmt)
        await db.commit()
        
    except Exception as e:
        logger.error(f"Failed to log execution: {str(e)}")
        # Don't fail the request if logging fails


# Health check endpoint
@router.get("/health")
async def health_check() -> dict:
    """CDS Hooks service health check"""
    return {
        "status": "healthy",
        "version": "2.0",
        "timestamp": datetime.utcnow().isoformat()
    }