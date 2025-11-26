"""
CDS Hooks Router v3.0
Implements CDS Hooks 2.0 specification compliant endpoints

Architecture:
- Uses CDSService base class for all services
- ConditionEngine for declarative condition evaluation
- ServiceOrchestrator for parallel service execution
- ServiceRegistry for service discovery
- PrefetchEngine for FHIR query template resolution
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import uuid
import logging
import httpx

# WintEHR custom exceptions for structured error handling
from shared.exceptions import (
    FHIRConnectionError,
    FHIRResourceNotFoundError,
    CDSExecutionError,
    CDSRuleEvaluationError,
    CDSPrefetchError,
    CDSServiceNotFoundError,
    DatabaseQueryError,
)

from database import get_db_session

# v3.0 Architecture imports
from .services import CDSService as CDSServiceBase, HookType as ServiceHookType
from .conditions import ConditionEngine
from .orchestrator import ServiceOrchestrator, get_orchestrator, execute_hook, CDSHookEngine, get_hook_engine
from .registry import ServiceRegistry, get_registry, register_service, get_discovery_response
from .prefetch import PrefetchEngine, get_prefetch_engine, execute_prefetch

# Hook persistence imports
from .hooks import (
    get_persistence_manager,
    load_hooks_from_database,
    save_sample_hooks_to_database,
    get_default_hooks,
)
from .feedback import (
    get_feedback_manager,
    process_cds_feedback,
    get_service_analytics,
    log_hook_execution
)
from .models import (
    CDSHookRequest,
    CDSHookResponse,
    CDSServicesResponse,
    CDSService,
    Card,
    Source,
    Suggestion,
    Action,
    Link,
    FeedbackRequest,
    HookType,
    IndicatorType,
    ActionType,
    PatientViewContext,
    MedicationPrescribeContext,
    OrderSignContext,
    HookConfiguration,
    HookCondition,
    HookAction
)
from .hooks import medication_prescribe_hooks
from .rules_engine.integration import cds_integration
from .rules_engine.safety import safety_manager, FeatureFlag
from services.hapi_fhir_client import HAPIFHIRClient
from .hapi_cds_integration import get_hapi_cds_integrator

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["CDS Hooks"])

# Initialize v3.0 service registry
# Built-in services will be registered via services/builtin/ module
_registry = get_registry()
_orchestrator = get_orchestrator()

# Include action execution router
from .actions import router as action_router
router.include_router(action_router, prefix="", tags=["CDS Actions"])

# Include audit trail router
from .audit import router as audit_router
router.include_router(audit_router, prefix="", tags=["CDS Audit"])

# Sample hook configurations - loaded from hooks/default_hooks.py
# In production, these would be stored in database
SAMPLE_HOOKS = get_default_hooks()


# CDSHookEngine has been moved to orchestrator/hook_engine.py
# Import: from .orchestrator import CDSHookEngine, get_hook_engine


# Helper functions for HAPI FHIR PlanDefinition conversion

def _extract_extension_value(
    resource: Dict[str, Any],
    url: str,
    default: Any = None
) -> Any:
    """
    Extract value from FHIR extension

    Args:
        resource: FHIR resource with extensions
        url: Extension URL to find
        default: Default value if extension not found

    Returns:
        Extension value or default
    """
    extensions = resource.get("extension", [])
    for ext in extensions:
        if ext.get("url") == url:
            # Try different value types
            return (
                ext.get("valueString") or
                ext.get("valueBoolean") or
                ext.get("valueCode") or
                ext.get("valueInteger") or
                default
            )
    return default


def _plan_definition_to_cds_service(plan_def: Dict[str, Any]) -> Optional[CDSService]:
    """
    Convert HAPI FHIR PlanDefinition to CDS Hooks service definition

    Args:
        plan_def: PlanDefinition resource from HAPI FHIR

    Returns:
        CDSService object, or None if conversion fails
    """
    try:
        # Extract hook-service-id (CDS service identifier)
        service_id = _extract_extension_value(
            plan_def,
            "http://wintehr.local/fhir/StructureDefinition/hook-service-id",
            plan_def.get("id")  # Fallback to PlanDefinition ID
        )

        # Extract hook-type (CDS hook type)
        hook_type = _extract_extension_value(
            plan_def,
            "http://wintehr.local/fhir/StructureDefinition/hook-type",
            "patient-view"  # Default hook type
        )

        # Build prefetch template from action inputs
        prefetch = _build_prefetch_from_plan_definition(plan_def)

        # Create CDS service definition
        return CDSService(
            id=service_id,
            hook=hook_type,
            title=plan_def.get("title", service_id),
            description=plan_def.get("description", ""),
            prefetch=prefetch,
            usageRequirements=plan_def.get("usage", "")
        )

    except (KeyError, TypeError, ValueError, AttributeError) as e:
        logger.error(f"Error converting PlanDefinition to CDS service: {e}")
        return None


def _build_prefetch_from_plan_definition(plan_def: Dict[str, Any]) -> Dict[str, str]:
    """
    Build CDS Hooks prefetch template from PlanDefinition

    Extracts prefetch templates from custom extension or action inputs

    Args:
        plan_def: PlanDefinition resource

    Returns:
        Prefetch dictionary mapping keys to FHIR query templates
    """
    # First, try to get prefetch from custom extension
    prefetch_extension = None
    for ext in plan_def.get("extension", []):
        if ext.get("url") == "http://wintehr.local/fhir/StructureDefinition/prefetch-template":
            prefetch_extension = ext.get("valueString")
            break

    if prefetch_extension:
        # Parse JSON prefetch template
        try:
            import json
            return json.loads(prefetch_extension)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to parse prefetch extension: {e}")

    # Fallback: Build prefetch from action inputs (legacy approach)
    prefetch = {}
    actions = plan_def.get("action", [])
    if not actions:
        return prefetch

    # Get first action's inputs
    inputs = actions[0].get("input", [])
    for i, input_req in enumerate(inputs):
        if input_req.get("type") == "DataRequirement":
            # Extract resource type from profile
            profiles = input_req.get("profile", [])
            if profiles:
                resource_type = profiles[0].split("/")[-1]
                # Create prefetch key and template
                prefetch[f"input{i}"] = f"{resource_type}/{{{{context.patientId}}}}"

    return prefetch


# CDS Hooks Discovery Endpoint
@router.get("/cds-services", response_model=CDSServicesResponse)
async def discover_services(
    db: AsyncSession = Depends(get_db_session),
    service_origin: Optional[str] = None  # Filter: "built-in", "external", or None for all
):
    """
    CDS Hooks discovery endpoint - v3.0 architecture

    **Hybrid Architecture**:
    - Built-in services: Registered via ServiceRegistry (v3.0 pattern)
    - External services: Stored as PlanDefinitions in HAPI FHIR

    Args:
        service_origin: Optional filter by service origin ("built-in", "external", or None for all)

    Returns:
        CDSServicesResponse with all discovered services
    """
    from services.hapi_fhir_client import HAPIFHIRClient

    services = []

    # 1. Get built-in services from v3.0 ServiceRegistry
    if service_origin is None or service_origin == "built-in":
        try:
            registry = get_registry()
            hook_type_filter = None  # Get all hook types

            # Get discovery response from registry
            registry_services = registry.list_services(enabled_only=True)
            for svc in registry_services:
                # Convert CDSServiceBase to CDSService model for response
                service_def = svc.get_service_definition()
                services.append(CDSService(
                    id=service_def.get("id", svc.service_id),
                    hook=service_def.get("hook", svc.hook_type.value),
                    title=service_def.get("title", svc.title),
                    description=service_def.get("description", svc.description),
                    prefetch=service_def.get("prefetch", svc.prefetch_templates),
                    usageRequirements=service_def.get("usageRequirements", "")
                ))

            logger.info(f"Discovered {len(services)} built-in services from ServiceRegistry")

        except Exception as e:
            logger.warning(f"Error getting services from registry: {e}")

    # 2. Get external services from HAPI FHIR PlanDefinitions
    if service_origin is None or service_origin == "external":
        try:
            hapi_client = HAPIFHIRClient()

            # Build search parameters for PlanDefinitions
            search_params = {
                "status": "active",
                "_count": 500
            }

            # Query HAPI FHIR for all PlanDefinitions
            bundle = await hapi_client.search("PlanDefinition", search_params)

            hapi_count = 0
            for entry in bundle.get("entry", []):
                plan_def = entry.get("resource", {})

                # Extract service-origin extension
                origin = _extract_extension_value(
                    plan_def,
                    "http://wintehr.local/fhir/StructureDefinition/service-origin"
                )

                # Only include external services from HAPI (built-in are in registry)
                if origin == "external" or (service_origin == "external" and origin == service_origin):
                    service = _plan_definition_to_cds_service(plan_def)
                    if service:
                        services.append(service)
                        hapi_count += 1

            logger.info(f"Discovered {hapi_count} external services from HAPI FHIR")

        except httpx.HTTPStatusError as e:
            logger.warning(f"FHIR server error discovering services: {e.response.status_code}")
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning(f"Cannot connect to FHIR server for service discovery: {e}")
        except (KeyError, TypeError, ValueError) as e:
            logger.warning(f"Error parsing HAPI service data: {e}")

    logger.info(f"Total CDS services discovered: {len(services)}")
    return CDSServicesResponse(services=services)


# CDS Service Execution Endpoint
@router.post("/cds-services/{service_id}", response_model=CDSHookResponse)
async def execute_service(
    service_id: str,
    request: CDSHookRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Execute a specific CDS service - v3.0 architecture

    **Routing Logic**:
    1. Check v3.0 ServiceRegistry for built-in services (preferred)
    2. Fall back to HAPI FHIR PlanDefinition for external/visual-builder services

    **Service Origins**:
    - "built-in" → ServiceOrchestrator (v3.0 pattern)
    - "external" → RemoteServiceProvider (HTTP POST with failure tracking)
    - "visual-builder" → VisualServiceProvider
    """
    from services.hapi_fhir_client import HAPIFHIRClient
    from .providers import RemoteServiceProvider

    start_time = datetime.now()
    cards = []

    try:
        logger.info(f"Executing CDS service: {service_id}")

        # 1. First check v3.0 ServiceRegistry for built-in services
        registry = get_registry()
        registered_service = registry.get(service_id)

        if registered_service:
            logger.info(f"Found service {service_id} in v3.0 ServiceRegistry")

            # Execute via ServiceOrchestrator
            orchestrator = get_orchestrator()

            # Prepare context and prefetch
            context = request.context if isinstance(request.context, dict) else request.context.dict()
            prefetch = request.prefetch or {}

            # Execute the single service
            result = await orchestrator.execute_single(
                service_id=service_id,
                context=context,
                prefetch=prefetch
            )

            if result.success:
                cards = result.cards
            else:
                logger.warning(f"Service {service_id} execution failed: {result.error_message}")

        else:
            # 2. Fall back to HAPI FHIR PlanDefinition lookup
            logger.info(f"Service {service_id} not in registry, checking HAPI FHIR")

            hapi_client = HAPIFHIRClient()
            plan_definition = None

            # Try direct read by ID
            try:
                plan_definition = await hapi_client.read("PlanDefinition", service_id)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    logger.info(f"Direct read failed for {service_id}, trying extension search")
                else:
                    logger.warning(f"FHIR server error reading {service_id}: {e.response.status_code}")
            except (httpx.RequestError, httpx.TimeoutException) as e:
                logger.warning(f"Connection error reading {service_id}: {e}")
            except (KeyError, TypeError, ValueError) as e:
                logger.info(f"Data parsing error for {service_id}, trying extension search: {e}")

            # Try extension search if direct read failed
            if not plan_definition:
                try:
                    bundle = await hapi_client.search("PlanDefinition", {"status": "active"})
                    for entry in bundle.get("entry", []):
                        resource = entry.get("resource", {})
                        for ext in resource.get("extension", []):
                            if ext.get("url") == "http://wintehr.local/fhir/StructureDefinition/hook-service-id":
                                if ext.get("valueString") == service_id:
                                    plan_definition = resource
                                    logger.info(f"Found service {service_id} via extension search")
                                    break
                        if plan_definition:
                            break
                except Exception as e:
                    logger.warning(f"Extension search failed for {service_id}: {e}")

            if not plan_definition:
                logger.error(f"Service '{service_id}' not found")
                raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")

            # Extract service-origin from extension
            service_origin = "built-in"
            for ext in plan_definition.get("extension", []):
                if ext.get("url") == "http://wintehr.local/fhir/StructureDefinition/service-origin":
                    service_origin = ext.get("valueString", "built-in")
                    break

            logger.info(f"Service {service_id} has origin: {service_origin}")

            # Route to appropriate provider based on origin
            if service_origin == "external":
                # Use RemoteServiceProvider for external services
                external_service_id = _extract_extension_value(
                    plan_definition,
                    "http://wintehr.local/fhir/StructureDefinition/external-service-id"
                )

                if not external_service_id:
                    logger.error(f"External service {service_id} missing external-service-id extension")
                    raise HTTPException(status_code=500, detail="Invalid external service configuration")

                query = text("""
                    SELECT
                        s.id,
                        s.base_url,
                        s.auth_type,
                        s.credentials_encrypted,
                        s.auto_disabled,
                        s.consecutive_failures,
                        s.last_error_message,
                        h.hook_service_id,
                        s.base_url || '/cds-services/' || h.hook_service_id AS service_url
                    FROM external_services.services s
                    JOIN external_services.cds_hooks h ON s.id = h.service_id
                    WHERE s.id = :service_id
                    LIMIT 1
                """)
                result = await db.execute(query, {"service_id": external_service_id})
                service_metadata = result.mappings().first()

                if not service_metadata:
                    logger.error(f"External service metadata not found: {external_service_id}")
                    raise HTTPException(status_code=500, detail="External service not registered")

                provider = RemoteServiceProvider(db)
                response = await provider.execute(
                    plan_definition,
                    request,
                    service_metadata=dict(service_metadata)
                )
                cards = response.cards

            elif service_origin == "visual-builder":
                # Use VisualServiceProvider for visual builder services
                visual_service_id = _extract_extension_value(
                    plan_definition,
                    "http://wintehr.local/fhir/StructureDefinition/visual-service-id"
                )

                if not visual_service_id:
                    logger.error(f"Visual service {service_id} missing visual-service-id extension")
                    raise HTTPException(status_code=500, detail="Invalid visual service configuration")

                from api.cds_studio.visual_service_config import VisualServiceConfig
                from sqlalchemy import select

                query = select(VisualServiceConfig).where(
                    VisualServiceConfig.id == int(visual_service_id)
                )
                result = await db.execute(query)
                visual_config = result.scalar_one_or_none()

                if not visual_config:
                    logger.error(f"Visual service configuration not found: {visual_service_id}")
                    raise HTTPException(status_code=500, detail="Visual service not configured")

                from api.cds_studio.visual_service_provider import VisualServiceProvider
                provider = VisualServiceProvider(db)
                response = await provider.execute(
                    visual_config,
                    request,
                    plan_definition
                )
                cards = response.cards

            else:
                # For built-in services found in HAPI but not in registry (legacy)
                # Use legacy LocalServiceProvider
                from .providers import LocalServiceProvider
                provider = LocalServiceProvider()
                response = await provider.execute(plan_definition, request, None)
                cards = response.cards

        # Calculate execution time
        execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # Log execution (fire and forget)
        try:
            patient_id = request.context.get('patientId') if isinstance(request.context, dict) else None
            user_id = request.context.get('userId') if isinstance(request.context, dict) else None

            await log_hook_execution(
                db=db,
                service_id=service_id,
                hook_type=request.hook.value,
                patient_id=patient_id,
                user_id=user_id,
                context=request.context if isinstance(request.context, dict) else request.context.dict(),
                request_data=request.dict(),
                response_data={"cards": [c.dict() for c in cards]},
                cards_returned=len(cards),
                execution_time_ms=execution_time_ms,
                success=True,
                error_message=None
            )
        except Exception as log_error:
            logger.warning(f"Failed to log hook execution: {log_error}")

        return CDSHookResponse(cards=cards)

    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        logger.error(f"FHIR server error executing CDS service {service_id}: {e.response.status_code}")
        return CDSHookResponse(cards=[])
    except (httpx.RequestError, httpx.TimeoutException) as e:
        logger.error(f"Connection error executing CDS service {service_id}: {e}")
        return CDSHookResponse(cards=[])
    except CDSExecutionError as e:
        logger.error(f"CDS execution error for service {service_id}: {e.message}")
        return CDSHookResponse(cards=[])
    except DatabaseQueryError as e:
        logger.error(f"Database error executing CDS service {service_id}: {e.message}")
        return CDSHookResponse(cards=[])
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error executing CDS service {service_id}: {e}")
        # CDS Hooks should be non-blocking - return empty cards on error
        return CDSHookResponse(cards=[])


# CDS Service Feedback Endpoint
@router.post("/cds-services/{service_id}/feedback")
async def provide_feedback(
    service_id: str,
    feedback: FeedbackRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Provide feedback on CDS service recommendations - CDS Hooks v2.0 compliant"""
    try:
        # Verify the service exists
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config and service_id not in SAMPLE_HOOKS:
            raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
        
        # Process and store the feedback
        # The feedback request contains an array of feedback items
        if not feedback.feedback or len(feedback.feedback) == 0:
            raise HTTPException(status_code=400, detail="No feedback items provided")
        
        # Process each feedback item
        feedback_ids = []
        for feedback_item in feedback.feedback:
            feedback_data = {
                'hookInstance': getattr(feedback_item, 'hookInstance', None),
                'service': service_id,
                'card': feedback_item.card,
                'outcome': feedback_item.outcome,
                'overrideReason': getattr(feedback_item, 'overrideReason', None) or getattr(feedback_item, 'overrideReasons', None),
                'acceptedSuggestions': getattr(feedback_item, 'acceptedSuggestions', None),
                # Extract additional context if available from the request
                'userId': getattr(feedback, 'userId', None),
                'patientId': getattr(feedback, 'patientId', None),
                'encounterId': getattr(feedback, 'encounterId', None),
                'context': getattr(feedback, 'context', None),
                'outcomeTimestamp': getattr(feedback_item, 'outcomeTimestamp', None)
            }
            
            feedback_id = await process_cds_feedback(db, feedback_data)
            feedback_ids.append(feedback_id)
            
            logger.info(f"Stored feedback {feedback_id} for service {service_id}: outcome={feedback_item.outcome}")
        
        # Return success response per CDS Hooks specification
        return {
            "status": "success",
            "feedbackIds": feedback_ids,
            "message": f"Feedback received and stored successfully ({len(feedback_ids)} items)"
        }
        
    except HTTPException:
        raise
    except DatabaseQueryError as e:
        logger.error(f"Database error processing feedback for service {service_id}: {e.message}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process feedback. The feedback has been logged for manual review."
        )
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error processing feedback for service {service_id}: {e}")
        # CDS Hooks specification allows for graceful error handling
        raise HTTPException(
            status_code=500,
            detail="Failed to process feedback. The feedback has been logged for manual review."
        )


# CDS Analytics Endpoint
@router.get("/cds-services/{service_id}/analytics")
async def get_feedback_analytics(
    service_id: str,
    days: int = 30,
    db: AsyncSession = Depends(get_db_session)
):
    """Get analytics for a specific CDS service"""
    try:
        # Verify the service exists
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config and service_id not in SAMPLE_HOOKS:
            raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
        
        # Get analytics
        analytics = await get_service_analytics(db, service_id, days)
        
        return {
            "status": "success",
            "service_id": service_id,
            "analytics": analytics,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except DatabaseQueryError as e:
        logger.error(f"Database error getting analytics for service {service_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error getting analytics for service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")


# Global Analytics Endpoint
@router.get("/cds-services/analytics/summary")
async def get_global_analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_db_session)
):
    """Get analytics summary for all CDS services"""
    try:
        feedback_manager = await get_feedback_manager(db)
        summary = await feedback_manager.get_analytics_summary(period_days=days)
        
        return {
            "status": "success",
            "period_days": days,
            "summary": summary,
            "timestamp": datetime.now().isoformat()
        }
        
    except DatabaseQueryError as e:
        logger.error(f"Database error getting global analytics: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics summary")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error getting global analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics summary")


# Prefetch Analysis Endpoint
@router.get("/cds-services/{service_id}/prefetch-analysis")
async def analyze_prefetch_patterns(
    service_id: str,
    days: int = 30,
    db: AsyncSession = Depends(get_db_session)
):
    """Analyze prefetch patterns for optimization"""
    try:
        # Verify the service exists
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config and service_id not in SAMPLE_HOOKS:
            raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
        
        # Get prefetch analysis
        engine = await get_prefetch_engine(db)
        analysis = await engine.analyze_prefetch_patterns(service_id, days)
        
        # Add current prefetch configuration
        if hook_config and hook_config.prefetch:
            analysis['current_prefetch_config'] = hook_config.prefetch
        
        # Add recommended prefetch based on hook type
        if hook_config:
            analysis['recommended_prefetch'] = engine.get_recommended_prefetch(
                hook_config.hook.value
            )
        
        return {
            "status": "success",
            "service_id": service_id,
            "analysis": analysis,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except DatabaseQueryError as e:
        logger.error(f"Database error analyzing prefetch patterns for service {service_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to analyze prefetch patterns")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error analyzing prefetch patterns for service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze prefetch patterns")


# Service Management Endpoints (for CRUD operations)
@router.get("/services", response_model=List[HookConfiguration])
async def list_services(
    hook_type: Optional[str] = None,
    enabled_only: bool = True,
    db: AsyncSession = Depends(get_db_session)
):
    """List all CDS services"""
    try:
        manager = await get_persistence_manager(db)
        return await manager.list_hooks(hook_type=hook_type, enabled_only=enabled_only)
    except DatabaseQueryError as e:
        logger.error(f"Database error listing hooks: {e.message}")
        # Fallback to sample hooks
        hooks = list(SAMPLE_HOOKS.values())
        if hook_type:
            hooks = [h for h in hooks if h.hook.value == hook_type]
        if enabled_only:
            hooks = [h for h in hooks if h.enabled]
        return hooks
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error listing hooks: {e}")
        # Fallback to sample hooks
        hooks = list(SAMPLE_HOOKS.values())
        if hook_type:
            hooks = [h for h in hooks if h.hook.value == hook_type]
        if enabled_only:
            hooks = [h for h in hooks if h.enabled]
        return hooks

# Alias endpoint for CDS Builder compatibility
@router.get("/cds-services/services", response_model=List[HookConfiguration])
async def list_services_alias(
    hook_type: Optional[str] = None,
    enabled_only: bool = True,
    db: AsyncSession = Depends(get_db_session)
):
    """List all CDS services (alias for /services endpoint for CDS Builder compatibility)"""
    return await list_services(hook_type=hook_type, enabled_only=enabled_only, db=db)


@router.post("/services", response_model=HookConfiguration)
async def create_service(
    hook_config: HookConfiguration, 
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new CDS service"""
    try:
        manager = await get_persistence_manager(db)
        
        # Check if hook already exists
        existing = await manager.get_hook(hook_config.id)
        if existing:
            raise HTTPException(status_code=409, detail="Hook ID already exists")
        
        # Save to database
        return await manager.save_hook(hook_config, "api-user")
        
    except HTTPException:
        raise
    except DatabaseQueryError as e:
        logger.error(f"Database error creating hook: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to create hook")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error creating hook: {e}")
        raise HTTPException(status_code=500, detail="Failed to create hook")

# Alias endpoint for CDS Builder compatibility
@router.post("/cds-services/services", response_model=HookConfiguration)
async def create_service_alias(
    hook_config: HookConfiguration,
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new CDS service (alias for CDS Builder compatibility)"""
    return await create_service(hook_config=hook_config, db=db)

# Service Management Endpoints (specific routes before parameterized routes)
@router.get("/services/backup")
async def backup_services(db: AsyncSession = Depends(get_db_session)):
    """Create a backup of all service configurations"""
    try:
        manager = await get_persistence_manager(db)
        backup = await manager.backup_hooks()
        
        # Include sample hooks in backup
        backup['sample_hooks'] = {k: v.dict() for k, v in SAMPLE_HOOKS.items()}
        
        return backup
        
    except DatabaseQueryError as e:
        logger.error(f"Database error creating services backup: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to create backup")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error creating services backup: {e}")
        raise HTTPException(status_code=500, detail="Failed to create backup")

@router.post("/services/restore")
async def restore_services(backup_data: Dict[str, Any], db: AsyncSession = Depends(get_db_session)):
    """Restore services from backup data"""
    try:
        manager = await get_persistence_manager(db)
        restored_count = await manager.restore_hooks(backup_data)
        
        return {
            "message": f"Successfully restored {restored_count} services",
            "restored_count": restored_count
        }
        
    except DatabaseQueryError as e:
        logger.error(f"Database error restoring services: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to restore services")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error restoring services: {e}")
        raise HTTPException(status_code=500, detail="Failed to restore services")

@router.post("/services/sync-samples")
async def sync_sample_services(db: AsyncSession = Depends(get_db_session)):
    """Sync sample services to database"""
    try:
        await save_sample_hooks_to_database(db, SAMPLE_HOOKS)
        db_hooks = await load_hooks_from_database(db)
        
        return {
            "message": f"Successfully synced {len(SAMPLE_HOOKS)} sample services",
            "services_count": len(db_hooks),
            "services": list(db_hooks.keys())
        }
    except DatabaseQueryError as e:
        logger.error(f"Database error syncing sample services: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to sync sample services")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error syncing sample services: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync sample services")

@router.get("/services/{service_id}", response_model=HookConfiguration)
async def get_service(service_id: str, db: AsyncSession = Depends(get_db_session)):
    """Get a specific CDS service"""
    try:
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config:
            # Fallback to sample hooks
            hook_config = SAMPLE_HOOKS.get(service_id)
        if not hook_config:
            raise HTTPException(status_code=404, detail="Service not found")
        return hook_config
    except HTTPException:
        raise
    except DatabaseQueryError as e:
        logger.error(f"Database error retrieving service {service_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to retrieve service")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error retrieving service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve service")

# Alias endpoint for CDS Builder compatibility
@router.get("/cds-services/services/{service_id}", response_model=HookConfiguration)
async def get_service_alias(service_id: str, db: AsyncSession = Depends(get_db_session)):
    """Get a specific CDS service (alias for CDS Builder compatibility)"""
    return await get_service(service_id=service_id, db=db)

@router.put("/services/{service_id}", response_model=HookConfiguration)
async def update_service(
    service_id: str, 
    hook_config: HookConfiguration, 
    db: AsyncSession = Depends(get_db_session)
):
    """Update a CDS service"""
    try:
        manager = await get_persistence_manager(db)
        
        # Check if hook exists
        existing = await manager.get_hook(service_id)
        if not existing and service_id not in SAMPLE_HOOKS:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Ensure the ID matches
        hook_config.id = service_id
        
        # Save to database
        return await manager.save_hook(hook_config, "api-user")
        
    except HTTPException:
        raise
    except DatabaseQueryError as e:
        logger.error(f"Database error updating service {service_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to update service")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error updating service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update service")

# Alias endpoint for CDS Builder compatibility  
@router.put("/cds-services/services/{service_id}", response_model=HookConfiguration)
async def update_service_alias(
    service_id: str,
    hook_config: HookConfiguration,
    db: AsyncSession = Depends(get_db_session)
):
    """Update a CDS service (alias for CDS Builder compatibility)"""
    return await update_service(service_id=service_id, hook_config=hook_config, db=db)

@router.delete("/services/{service_id}")
async def delete_service(service_id: str, db: AsyncSession = Depends(get_db_session)):
    """Delete a CDS service"""
    try:
        manager = await get_persistence_manager(db)
        
        # Try to delete from database first
        deleted = await manager.delete_hook(service_id)
        
        if not deleted:
            # Check if it exists in sample hooks
            if service_id not in SAMPLE_HOOKS:
                raise HTTPException(status_code=404, detail="Service not found")
            # For sample hooks, we can't delete them, just disable
            raise HTTPException(status_code=400, detail="Cannot delete sample services, only disable them")
        
        return {"message": f"Service {service_id} deleted successfully"}
        
    except HTTPException:
        raise
    except DatabaseQueryError as e:
        logger.error(f"Database error deleting service {service_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to delete service")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error deleting service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete service")


# Additional hook management endpoints
@router.patch("/services/{service_id}/toggle")
async def toggle_service(service_id: str, enabled: bool, db: AsyncSession = Depends(get_db_session)):
    """Enable or disable a CDS service"""
    try:
        manager = await get_persistence_manager(db)
        success = await manager.toggle_hook(service_id, enabled)
        
        if not success:
            # Try sample hooks
            if service_id in SAMPLE_HOOKS:
                SAMPLE_HOOKS[service_id].enabled = enabled
                return {"message": f"Service {service_id} {'enabled' if enabled else 'disabled'} successfully"}
            raise HTTPException(status_code=404, detail="Service not found")
        
        return {"message": f"Service {service_id} {'enabled' if enabled else 'disabled'} successfully"}
        
    except HTTPException:
        raise
    except DatabaseQueryError as e:
        logger.error(f"Database error toggling service {service_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to toggle service")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error toggling service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle service")

@router.post("/services/test/{service_id}")
async def test_service(
    service_id: str,
    test_context: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session)
):
    """Test a specific service with provided context"""
    try:
        # Get hook configuration
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config:
            hook_config = SAMPLE_HOOKS.get(service_id)
        
        if not hook_config:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Create test request
        test_request = CDSHookRequest(
            hook=hook_config.hook,
            hookInstance=f"test-{service_id}-{datetime.now().timestamp()}",
            context=test_context
        )
        
        # Execute hook
        engine = CDSHookEngine(db)
        cards = await engine.evaluate_hook(hook_config, test_request)
        
        return {
            "service_id": service_id,
            "test_context": test_context,
            "cards": [card.dict() for card in cards],
            "cards_count": len(cards),
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except CDSExecutionError as e:
        logger.error(f"CDS execution error testing service {service_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to test service")
    except DatabaseQueryError as e:
        logger.error(f"Database error testing service {service_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to test service")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error testing service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to test service")

# Rules Engine Management Endpoints
@router.get("/rules-engine/statistics")
async def get_rules_statistics():
    """Get statistics about the rules engine"""
    try:
        stats = await cds_integration.get_rule_statistics()
        return {
            "status": "success",
            "statistics": stats,
            "timestamp": datetime.now().isoformat()
        }
    except CDSExecutionError as e:
        logger.error(f"CDS execution error getting rules statistics: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to get rules statistics")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error getting rules statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get rules statistics")


@router.post("/rules-engine/evaluate")
async def evaluate_rules(
    context: Dict[str, Any],
    categories: Optional[List[str]] = None,
    priorities: Optional[List[str]] = None
):
    """Directly evaluate rules against provided context"""
    try:
        # Execute rules engine
        response = await cds_integration.rules_engine.evaluate(
            context=context,
            categories=categories,
            priorities=priorities
        )
        
        return {
            "status": "success",
            "response": response,
            "timestamp": datetime.now().isoformat()
        }
    except CDSRuleEvaluationError as e:
        logger.error(f"Rule evaluation error: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to evaluate rules")
    except CDSExecutionError as e:
        logger.error(f"CDS execution error evaluating rules: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to evaluate rules")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error evaluating rules: {e}")
        raise HTTPException(status_code=500, detail="Failed to evaluate rules")


@router.patch("/rules-engine/rules/{rule_set_name}/{rule_id}/toggle")
async def toggle_rule(rule_set_name: str, rule_id: str, enabled: bool):
    """Enable or disable a specific rule"""
    try:
        cds_integration.toggle_rule(rule_set_name, rule_id, enabled)
        return {
            "status": "success",
            "message": f"Rule {rule_id} {'enabled' if enabled else 'disabled'}",
            "rule_set": rule_set_name,
            "rule_id": rule_id,
            "enabled": enabled
        }
    except CDSExecutionError as e:
        logger.error(f"CDS execution error toggling rule: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to toggle rule")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error toggling rule: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle rule")


# Safety and Feature Flag Endpoints
@router.get("/rules-engine/safety/metrics")
async def get_safety_metrics():
    """Get safety metrics and circuit breaker status"""
    try:
        metrics = safety_manager.get_metrics()
        return {
            "status": "success",
            "metrics": metrics,
            "timestamp": datetime.now().isoformat()
        }
    except CDSExecutionError as e:
        logger.error(f"CDS execution error getting safety metrics: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to get safety metrics")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error getting safety metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get safety metrics")


@router.patch("/rules-engine/safety/feature-flags/{flag}")
async def set_feature_flag(flag: str, enabled: bool):
    """Enable or disable a feature flag"""
    try:
        feature_flag = FeatureFlag(flag)
        safety_manager.set_feature_flag(feature_flag, enabled)
        return {
            "status": "success",
            "message": f"Feature flag {flag} set to {enabled}",
            "flag": flag,
            "enabled": enabled
        }
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid feature flag: {flag}")
    except CDSExecutionError as e:
        logger.error(f"CDS execution error setting feature flag: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to set feature flag")
    except (TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error setting feature flag: {e}")
        raise HTTPException(status_code=500, detail="Failed to set feature flag")


@router.get("/rules-engine/safety/health")
async def rules_engine_health():
    """Get rules engine health status including circuit breakers"""
    try:
        health = safety_manager.health_check()
        return health
    except CDSExecutionError as e:
        logger.error(f"CDS execution error checking rules engine health: {e.message}")
        return {"status": "error", "error": e.message, "timestamp": datetime.now().isoformat()}
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error checking rules engine health: {e}")
        return {"status": "error", "error": str(e), "timestamp": datetime.now().isoformat()}


@router.post("/rules-engine/safety/circuit-breaker/{service}/reset")
async def reset_circuit_breaker(service: str):
    """Reset a circuit breaker for a specific service"""
    try:
        if service in safety_manager.circuit_breakers:
            breaker = safety_manager.circuit_breakers[service]
            breaker.state = "closed"
            breaker.failure_count = 0
            breaker.success_count = 0
            breaker.opened_at = None
            
            return {
                "status": "success",
                "message": f"Circuit breaker for {service} reset",
                "service": service,
                "new_state": "closed"
            }
        else:
            raise HTTPException(status_code=404, detail=f"Circuit breaker for {service} not found")
    except HTTPException:
        raise
    except CDSExecutionError as e:
        logger.error(f"CDS execution error resetting circuit breaker: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to reset circuit breaker")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error resetting circuit breaker: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset circuit breaker")


@router.get("/rules-engine/safety/ab-test/results")
async def get_ab_test_results():
    """Get A/B test results comparing rules engine to legacy"""
    try:
        if not safety_manager.is_enabled(FeatureFlag.A_B_TESTING_ENABLED):
            return {
                "status": "disabled",
                "message": "A/B testing is not enabled",
                "timestamp": datetime.now().isoformat()
            }
        
        results = dict(safety_manager.ab_test_results)
        
        # Calculate success rates
        for group in results:
            if results[group]["total"] > 0:
                results[group]["success_rate"] = (
                    results[group]["success"] / results[group]["total"] * 100
                )
            else:
                results[group]["success_rate"] = 0
        
        return {
            "status": "success",
            "results": results,
            "allocation": safety_manager.ab_test_allocation,
            "timestamp": datetime.now().isoformat()
        }
    except CDSExecutionError as e:
        logger.error(f"CDS execution error getting A/B test results: {e.message}")
        raise HTTPException(status_code=500, detail="Failed to get A/B test results")
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error getting A/B test results: {e}")
        raise HTTPException(status_code=500, detail="Failed to get A/B test results")


# Service Registry Management Endpoints
@router.get("/registry/services")
async def list_registry_services():
    """List all services registered in the service registry"""
    services = service_registry.list_services()
    return {
        "status": "success",
        "count": len(services),
        "services": [s.dict() for s in services]
    }


@router.get("/registry/services/{service_id}")
async def get_registry_service(service_id: str):
    """Get details of a specific service from the registry"""
    definition = service_registry.get_service_definition(service_id)
    if not definition:
        raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found in registry")
    
    has_implementation = service_registry.get_service_implementation(service_id) is not None
    
    return {
        "status": "success",
        "service": definition.dict(),
        "has_implementation": has_implementation
    }


# Health check endpoint
@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db_session)):
    """Health check endpoint"""
    try:
        # Test database connectivity
        db_hooks = await load_hooks_from_database(db)
        db_status = "connected"
        db_hooks_count = len(db_hooks)
    except DatabaseQueryError as e:
        db_status = f"database error: {e.message}"
        db_hooks_count = 0
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        db_status = f"data error: {str(e)}"
        db_hooks_count = 0

    # Get rules engine statistics
    try:
        rules_stats = await cds_integration.get_rule_statistics()
        rules_engine_status = "healthy"
    except CDSExecutionError as e:
        rules_stats = {}
        rules_engine_status = f"execution error: {e.message}"
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        rules_stats = {}
        rules_engine_status = f"data error: {str(e)}"
    
    # Get service registry information
    registry_services = service_registry.list_services()
    registry_count = len(registry_services)
    
    return {
        "status": "healthy",
        "service": "CDS Hooks",
        "version": "2.0",
        "sample_hooks_count": len(SAMPLE_HOOKS),
        "database_status": db_status,
        "database_hooks_count": db_hooks_count,
        "registry_services_count": registry_count,
        "total_services": db_hooks_count + len(SAMPLE_HOOKS) + registry_count,
        "rules_engine_status": rules_engine_status,
        "rules_engine_statistics": rules_stats,
        "service_registry": {
            "status": "active",
            "services": [s.id for s in registry_services]
        },
        "timestamp": datetime.now().isoformat()
    }