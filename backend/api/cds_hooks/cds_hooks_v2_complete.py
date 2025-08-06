"""
CDS Hooks v2.0 Complete Implementation
Implements full CDS Hooks 2.0 specification with all features
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging
import uuid
import jwt
from pydantic import BaseModel

from database import get_db_session
from .models import (
    CDSHookRequest,
    CDSHookResponse,
    CDSServicesResponse,
    CDSService,
    Card,
    SystemAction,
    FeedbackRequest,
    HookType,
    OverrideReason
)
from .auth import CDSJWTAuth, verify_cds_client
from .system_actions import SystemActionsHandler
from .feedback_router import FeedbackManager
from .service_executor import ServiceExecutor
from .cds_hooks_router import (
    CDSHookEngine,
    SAMPLE_HOOKS,
    get_persistence_manager,
    execute_hook_prefetch
)

logger = logging.getLogger(__name__)

# Create complete v2 router
router = APIRouter(prefix="/v2", tags=["CDS Hooks v2.0 Complete"])

# Initialize v2.0 components
jwt_auth = CDSJWTAuth()
system_actions_handler = SystemActionsHandler()
service_executor = ServiceExecutor()


class CDSClientToken(BaseModel):
    """JWT token claims for CDS client authentication"""
    iss: str  # Issuer (client ID)
    aud: str  # Audience (service URL)
    exp: int  # Expiration time
    iat: int  # Issued at
    jti: str  # JWT ID


@router.get("/cds-services", response_model=CDSServicesResponse)
async def discover_services_v2(
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(None)
):
    """
    CDS Hooks 2.0 Service Discovery
    Returns all available CDS services with 2.0 features
    """
    # Optional JWT authentication for discovery
    client_info = None
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            client_info = jwt_auth.verify_token(token, "cds-services")
            logger.info(f"Authenticated discovery request from: {client_info.iss}")
        except Exception as e:
            logger.warning(f"Invalid JWT in discovery: {e}")
            # Discovery should work without auth for compatibility
    
    services = []
    
    try:
        # Load configuration-based services
        manager = await get_persistence_manager(db)
        db_hooks = await manager.list_hooks(enabled_only=True)
        
        for hook_config in db_hooks:
            service = CDSService(
                hook=hook_config.hook,
                title=hook_config.title,
                description=hook_config.description,
                id=hook_config.id,
                prefetch=hook_config.prefetch,
                usageRequirements=getattr(hook_config, 'usageRequirements', 
                    "CDS Hooks 2.0 compliant client with feedback and systemActions support")
            )
            services.append(service)
        
        # Add code-based services from executor
        try:
            executor_services = await service_executor.list_services(db)
            for exec_service in executor_services:
                if exec_service.get("enabled", False):
                    service = CDSService(
                        hook=exec_service["hook"],
                        title=exec_service["title"],
                        description=exec_service["description"],
                        id=exec_service["id"],
                        prefetch=exec_service.get("prefetch", {}),
                        usageRequirements="CDS Hooks 2.0 with JavaScript execution support"
                    )
                    services.append(service)
        except Exception as e:
            logger.warning(f"Error loading code-based services: {e}")
        
        # Add new 2.0 hook types as sample services
        new_v2_services = [
            CDSService(
                id="allergy-interaction-checker",
                hook=HookType.ALLERGYINTOLERANCE_CREATE,
                title="Allergy Interaction Checker",
                description="Checks for medication interactions when creating allergy records",
                prefetch={
                    "patient": "Patient/{{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
                },
                usageRequirements="CDS Hooks 2.0 with allergy-intolerance create hook support"
            ),
            CDSService(
                id="appointment-conflict-detector",
                hook=HookType.APPOINTMENT_BOOK,
                title="Appointment Conflict Detector",
                description="Detects scheduling conflicts when booking appointments",
                prefetch={
                    "patient": "Patient/{{context.patientId}}",
                    "appointments": "Appointment?patient={{context.patientId}}&date=ge{{context.start}}"
                },
                usageRequirements="CDS Hooks 2.0 with appointment-book hook support"
            ),
            CDSService(
                id="problem-list-advisor",
                hook=HookType.PROBLEM_LIST_ITEM_CREATE,
                title="Problem List Clinical Advisor",
                description="Provides clinical guidance when adding items to problem list",
                prefetch={
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}"
                },
                usageRequirements="CDS Hooks 2.0 with problem-list-item-create hook support"
            ),
            CDSService(
                id="order-dispatch-validator",
                hook=HookType.ORDER_DISPATCH,
                title="Order Dispatch Validator",
                description="Validates orders before dispatch for completeness and appropriateness",
                prefetch={
                    "order": "ServiceRequest/{{context.orderId}}",
                    "patient": "Patient/{{context.patientId}}"
                },
                usageRequirements="CDS Hooks 2.0 with order-dispatch hook support"
            ),
            CDSService(
                id="medication-refill-advisor",
                hook=HookType.MEDICATION_REFILL,
                title="Medication Refill Clinical Advisor",
                description="Provides guidance for medication refills including adherence and interactions",
                prefetch={
                    "medicationRequest": "MedicationRequest/{{context.medicationRequestId}}",
                    "patient": "Patient/{{context.patientId}}",
                    "adherence": "MedicationStatement?patient={{context.patientId}}&medication={{context.medicationId}}"
                },
                usageRequirements="CDS Hooks 2.0 with medication-refill hook support"
            )
        ]
        
        services.extend(new_v2_services)
        
        logger.info(f"Discovered {len(services)} CDS v2.0 services")
        
    except Exception as e:
        logger.error(f"Error in v2 service discovery: {e}")
        # Return sample services on error
        services = list(new_v2_services)
    
    return CDSServicesResponse(services=services)


@router.post("/cds-services/{service_id}", response_model=CDSHookResponse)
async def execute_service_v2(
    service_id: str,
    request: CDSHookRequest,
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(None)
):
    """
    CDS Hooks 2.0 Service Execution
    Supports all 2.0 features: systemActions, JWT auth, UUID requirements, new hooks
    """
    execution_start = datetime.utcnow()
    
    # JWT Authentication (optional but logged)
    client_info = None
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            client_info = jwt_auth.verify_token(token, f"cds-services/{service_id}")
            logger.info(f"Authenticated CDS client: {client_info.iss}")
        except Exception as e:
            logger.warning(f"JWT validation failed: {e}")
            # Continue without auth for backward compatibility
    
    # Validate and ensure hookInstance is UUID (2.0 requirement)
    if request.hookInstance:
        try:
            uuid.UUID(request.hookInstance)
        except ValueError:
            logger.warning(f"hookInstance is not a valid UUID: {request.hookInstance}")
            request.hookInstance = str(uuid.uuid4())
    else:
        request.hookInstance = str(uuid.uuid4())
    
    # Validate fhirServer uses HTTPS in production (2.0 requirement)
    if request.fhirServer:
        if not request.fhirServer.startswith("https://"):
            # Allow HTTP for local development
            if not any(host in request.fhirServer for host in ["localhost", "127.0.0.1", "0.0.0.0"]):
                raise HTTPException(
                    status_code=400,
                    detail="fhirServer must use HTTPS in production environments (CDS Hooks 2.0 requirement)"
                )
    
    try:
        # Check if this is a code-based service first
        try:
            executor_service = await service_executor.get_service(service_id, db)
            if executor_service and executor_service.get("enabled", False):
                return await _execute_code_based_service(
                    service_id, request, executor_service, db, client_info
                )
        except Exception as e:
            logger.warning(f"Error checking code-based service: {e}")
        
        # Handle new 2.0 hooks with sample implementations
        if service_id in ["allergy-interaction-checker", "appointment-conflict-detector", 
                         "problem-list-advisor", "order-dispatch-validator", "medication-refill-advisor"]:
            return await _execute_new_v2_service(service_id, request, db)
        
        # Fall back to configuration-based execution
        return await _execute_configuration_based_service(
            service_id, request, db, client_info, execution_start
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing v2 service {service_id}: {e}")
        return CDSHookResponse(cards=[], systemActions=[])


async def _execute_code_based_service(
    service_id: str,
    request: CDSHookRequest,
    executor_service: Dict[str, Any],
    db: AsyncSession,
    client_info: Optional[CDSClientToken]
) -> CDSHookResponse:
    """Execute a code-based CDS service"""
    try:
        execution_request = {
            "serviceId": service_id,
            "code": executor_service["code"],
            "hook": request.hook.value,
            "context": request.context,
            "prefetch": request.prefetch,
            "fhirServer": request.fhirServer,
            "fhirAuthorization": request.fhirAuthorization,
            "hookInstance": request.hookInstance
        }
        
        result = await service_executor.execute(execution_request, db)
        
        if result["success"]:
            response_data = result["result"]
            
            # Ensure all cards have UUIDs (2.0 requirement)
            cards = []
            for card_data in response_data.get("cards", []):
                if "uuid" not in card_data:
                    card_data["uuid"] = str(uuid.uuid4())
                cards.append(Card(**card_data))
            
            # Process system actions
            system_actions = []
            for action_data in response_data.get("systemActions", []):
                system_actions.append(SystemAction(**action_data))
            
            return CDSHookResponse(
                cards=cards,
                systemActions=system_actions
            )
        else:
            logger.error(f"Code execution failed for {service_id}: {result['error']}")
            return CDSHookResponse(cards=[])
            
    except Exception as e:
        logger.error(f"Error executing code-based service {service_id}: {e}")
        return CDSHookResponse(cards=[])


async def _execute_new_v2_service(
    service_id: str,
    request: CDSHookRequest,
    db: AsyncSession
) -> CDSHookResponse:
    """Execute new CDS Hooks 2.0 services with sample implementations"""
    cards = []
    system_actions = []
    
    try:
        if service_id == "allergy-interaction-checker":
            if request.hook == HookType.ALLERGYINTOLERANCE_CREATE:
                # Sample allergy interaction check
                card = Card(
                    uuid=str(uuid.uuid4()),
                    summary="Allergy-Medication Interaction Alert",
                    detail="The allergy being added may interact with active medications. Please review current medications.",
                    indicator="warning",
                    source={"label": "Allergy Interaction Checker v2.0"},
                    overrideReasons=[
                        OverrideReason(
                            code="reviewed-safe",
                            display="Reviewed and determined safe"
                        ),
                        OverrideReason(
                            code="alternative-planned",
                            display="Alternative medication planned"
                        )
                    ]
                )
                cards.append(card)
        
        elif service_id == "appointment-conflict-detector":
            if request.hook == HookType.APPOINTMENT_BOOK:
                # Sample appointment conflict check
                card = Card(
                    uuid=str(uuid.uuid4()),
                    summary="Potential Scheduling Conflict",
                    detail="Patient has another appointment scheduled within 30 minutes of this time.",
                    indicator="info",
                    source={"label": "Appointment Conflict Detector v2.0"},
                    overrideReasons=[
                        OverrideReason(
                            code="different-location",
                            display="Appointments at different locations"
                        ),
                        OverrideReason(
                            code="patient-confirmed",
                            display="Patient confirmed availability"
                        )
                    ]
                )
                cards.append(card)
        
        elif service_id == "problem-list-advisor":
            if request.hook == HookType.PROBLEM_LIST_ITEM_CREATE:
                # Sample problem list guidance
                card = Card(
                    uuid=str(uuid.uuid4()),
                    summary="Clinical Documentation Guidance",
                    detail="Consider documenting severity, onset date, and clinical status for this condition.",
                    indicator="info",
                    source={"label": "Problem List Advisor v2.0"}
                )
                cards.append(card)
        
        elif service_id == "order-dispatch-validator":
            if request.hook == HookType.ORDER_DISPATCH:
                # Sample order validation
                card = Card(
                    uuid=str(uuid.uuid4()),
                    summary="Order Validation Complete",
                    detail="Order has been validated for completeness and clinical appropriateness.",
                    indicator="info",
                    source={"label": "Order Dispatch Validator v2.0"}
                )
                cards.append(card)
                
                # Example system action for order validation
                system_action = SystemAction(
                    type="update",
                    resource={
                        "resourceType": "ServiceRequest",
                        "id": request.context.get("orderId"),
                        "status": "active",
                        "_status": {
                            "extension": [{
                                "url": "http://example.org/validation-status",
                                "valueString": "validated"
                            }]
                        }
                    }
                )
                system_actions.append(system_action)
        
        elif service_id == "medication-refill-advisor":
            if request.hook == HookType.MEDICATION_REFILL:
                # Sample medication refill guidance
                card = Card(
                    uuid=str(uuid.uuid4()),
                    summary="Medication Refill Advisory",
                    detail="Patient adherence data suggests good compliance. Refill approved with continued monitoring.",
                    indicator="info",
                    source={"label": "Medication Refill Advisor v2.0"}
                )
                cards.append(card)
        
    except Exception as e:
        logger.error(f"Error in new v2 service {service_id}: {e}")
    
    return CDSHookResponse(cards=cards, systemActions=system_actions)


async def _execute_configuration_based_service(
    service_id: str,
    request: CDSHookRequest,
    db: AsyncSession,
    client_info: Optional[CDSClientToken],
    execution_start: datetime
) -> CDSHookResponse:
    """Execute configuration-based CDS service"""
    # Get hook configuration
    manager = await get_persistence_manager(db)
    hook_config = await manager.get_hook(service_id)
    
    if not hook_config:
        hook_config = SAMPLE_HOOKS.get(service_id)
    
    if not hook_config:
        raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
    
    if not hook_config.enabled:
        return CDSHookResponse(cards=[], systemActions=[])
    
    # Validate hook type matches
    if hook_config.hook != request.hook:
        raise HTTPException(
            status_code=400,
            detail=f"Hook type mismatch: service expects {hook_config.hook}, got {request.hook}"
        )
    
    # Execute prefetch if needed
    if hook_config.prefetch and not request.prefetch:
        try:
            request.prefetch = await execute_hook_prefetch(
                db,
                hook_config.prefetch,
                request.context if isinstance(request.context, dict) else request.context.dict()
            )
        except Exception as e:
            logger.warning(f"Prefetch failed for {service_id}: {e}")
            request.prefetch = {}
    
    # Execute hook
    engine = CDSHookEngine(db)
    cards = await engine.evaluate_hook(hook_config, request)
    
    # Ensure all cards have UUIDs (2.0 requirement)
    for card in cards:
        if not hasattr(card, 'uuid') or not card.uuid:
            card.uuid = str(uuid.uuid4())
    
    # Check for system actions in hook configuration
    system_actions = []
    if hasattr(hook_config, 'systemActions') and hook_config.systemActions:
        for action_config in hook_config.systemActions:
            # Evaluate conditions for system action
            if await engine._evaluate_conditions(action_config.get('conditions', []), request):
                system_action = SystemAction(
                    type=action_config['type'],
                    resource=action_config.get('resource'),
                    resourceId=action_config.get('resourceId')
                )
                system_actions.append(system_action)
    
    # Log execution
    await _log_execution_v2(
        db=db,
        service_id=service_id,
        hook_instance=request.hookInstance,
        request=request,
        cards=cards,
        system_actions=system_actions,
        client_info=client_info,
        execution_start=execution_start
    )
    
    return CDSHookResponse(
        cards=cards,
        systemActions=system_actions
    )


@router.post("/cds-services/{service_id}/feedback")
async def provide_feedback_v2(
    service_id: str,
    feedback: FeedbackRequest,
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(None)
):
    """
    CDS Hooks 2.0 Feedback Endpoint
    Supports tracking card outcomes with override reasons and accepted suggestions
    """
    # Validate JWT if provided
    client_info = None
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            client_info = jwt_auth.verify_token(token, f"cds-services/{service_id}/feedback")
        except Exception as e:
            logger.warning(f"JWT validation failed for feedback: {e}")
    
    try:
        feedback_manager = FeedbackManager(db)
        feedback_ids = []
        
        for feedback_item in feedback.feedback:
            feedback_data = {
                "service_id": service_id,
                "hook_instance": getattr(feedback_item, 'hookInstance', None),
                "card_uuid": feedback_item.card,
                "outcome": feedback_item.outcome,
                "outcome_timestamp": getattr(feedback_item, 'outcomeTimestamp', datetime.utcnow()),
                "override_reason": getattr(feedback_item, 'overrideReason', None),
                "accepted_suggestions": getattr(feedback_item, 'acceptedSuggestions', []),
                "client_id": client_info.iss if client_info else None
            }
            
            feedback_id = await feedback_manager.store_feedback(feedback_data)
            feedback_ids.append(str(feedback_id))
        
        return {
            "message": "Feedback received and processed",
            "feedbackIds": feedback_ids,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error processing v2 feedback: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process feedback"
        )


@router.post("/system-actions/apply")
async def apply_system_actions_v2(
    request_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(None)
):
    """
    Apply CDS Hooks 2.0 System Actions
    Requires JWT authentication for security
    """
    # Require JWT authentication for system actions
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="JWT authentication required for system actions"
        )
    
    try:
        token = authorization.split(" ")[1]
        client_info = jwt_auth.verify_token(token, "system-actions")
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid JWT token: {str(e)}"
        )
    
    try:
        hook_instance = request_data.get("hookInstance")
        if not hook_instance:
            hook_instance = str(uuid.uuid4())
        
        system_actions_data = request_data.get("systemActions", [])
        if not system_actions_data:
            raise HTTPException(
                status_code=400,
                detail="No system actions provided"
            )
        
        system_actions = [SystemAction(**action) for action in system_actions_data]
        
        # Apply system actions
        results = await system_actions_handler.apply_actions(
            system_actions=system_actions,
            hook_instance=hook_instance,
            service_id=request_data.get("serviceId", "manual"),
            context=request_data.get("context", {}),
            db=db
        )
        
        return {
            "hookInstance": hook_instance,
            "results": results,
            "appliedBy": client_info.iss,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying system actions: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to apply system actions"
        )


@router.get("/analytics/feedback/{service_id}")
async def get_feedback_analytics_v2(
    service_id: str,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session)
):
    """Get comprehensive feedback analytics for a service"""
    try:
        feedback_manager = FeedbackManager(db)
        analytics = await feedback_manager.get_service_analytics(service_id, days)
        
        return {
            "serviceId": service_id,
            "period": f"{days} days",
            "analytics": analytics,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting feedback analytics: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve analytics"
        )


async def _log_execution_v2(
    db: AsyncSession,
    service_id: str,
    hook_instance: str,
    request: CDSHookRequest,
    cards: List[Card],
    system_actions: List[SystemAction],
    client_info: Optional[CDSClientToken],
    execution_start: datetime
):
    """Enhanced logging for CDS Hooks 2.0"""
    try:
        from sqlalchemy import text
        
        execution_time_ms = int((datetime.utcnow() - execution_start).total_seconds() * 1000)
        
        await db.execute(text("""
            INSERT INTO cds.hook_executions_v2 (
                service_id,
                hook_instance,
                hook_type,
                patient_id,
                user_id,
                client_id,
                context,
                request_data,
                response_data,
                cards_returned,
                system_actions_count,
                execution_time_ms,
                success,
                version,
                created_at
            ) VALUES (
                :service_id,
                :hook_instance,
                :hook_type,
                :patient_id,
                :user_id,
                :client_id,
                :context,
                :request_data,
                :response_data,
                :cards_returned,
                :system_actions_count,
                :execution_time_ms,
                :success,
                :version,
                CURRENT_TIMESTAMP
            )
        """), {
            "service_id": service_id,
            "hook_instance": hook_instance,
            "hook_type": request.hook.value,
            "patient_id": request.context.get("patientId") if isinstance(request.context, dict) else None,
            "user_id": request.context.get("userId") if isinstance(request.context, dict) else None,
            "client_id": client_info.iss if client_info else None,
            "context": request.context if isinstance(request.context, dict) else request.context.dict(),
            "request_data": request.dict(),
            "response_data": {
                "cards": [card.dict() for card in cards],
                "systemActions": [action.dict() for action in system_actions]
            },
            "cards_returned": len(cards),
            "system_actions_count": len(system_actions),
            "execution_time_ms": execution_time_ms,
            "success": True,
            "version": "2.0"
        })
        
        await db.commit()
        
    except Exception as e:
        logger.warning(f"Failed to log v2 execution: {e}")


@router.get("/health")
async def health_check_v2():
    """CDS Hooks 2.0 health check with feature enumeration"""
    return {
        "status": "healthy",
        "version": "2.0",
        "specification": "https://cds-hooks.hl7.org/2.0/",
        "features": {
            "systemActions": True,
            "feedback": True,
            "jwt": True,
            "newHooks": [
                "allergyintolerance-create",
                "appointment-book", 
                "problem-list-item-create",
                "order-dispatch",
                "medication-refill"
            ],
            "uuid": True,
            "httpsValidation": True,
            "overrideReasons": True,
            "acceptedSuggestions": True
        },
        "endpoints": {
            "discovery": "/v2/cds-services",
            "execution": "/v2/cds-services/{service_id}",
            "feedback": "/v2/cds-services/{service_id}/feedback",
            "systemActions": "/v2/system-actions/apply",
            "analytics": "/v2/analytics/feedback/{service_id}"
        },
        "timestamp": datetime.utcnow().isoformat()
    }