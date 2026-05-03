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
    CDSPrefetchError,
    CDSServiceNotFoundError,
    DatabaseQueryError,
)

from database import get_db_session

# v3.0 Architecture imports
from .services import CDSService as CDSServiceBase, HookType as ServiceHookType
from .conditions import ConditionEngine
from .orchestrator import ServiceOrchestrator, get_orchestrator, execute_hook
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
from services.hapi_fhir_client import HAPIFHIRClient
from .hapi_cds_integration import get_hapi_cds_integrator
from .actions.executor import ActionExecutor, ActionExecutionRequest

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["CDS Hooks"])

# Initialize v3.0 service registry
# Built-in services will be registered via services/builtin/ module
_registry = get_registry()
_orchestrator = get_orchestrator()
# Alias for backward compatibility with code using service_registry name
service_registry = _registry

# Register built-in services at module load time
from .services.builtin import register_builtin_services
register_builtin_services(_registry)
logger.info(f"CDS Hooks: Registered {len(_registry.list_services())} built-in services")

# Include action execution router
from .actions import router as action_router
router.include_router(action_router, prefix="", tags=["CDS Actions"])

# Include audit trail router
from .audit import router as audit_router
router.include_router(audit_router, prefix="", tags=["CDS Audit"])

# Sample hook configurations - loaded from hooks/default_hooks.py
# In production, these would be stored in database
SAMPLE_HOOKS = get_default_hooks()




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

                # Include external and visual-builder services from HAPI
                # (built-in services are already in the registry above)
                if origin in ("external", "visual-builder"):
                    service = _plan_definition_to_cds_service(plan_def)
                    if service:
                        services.append(service)
                        hapi_count += 1

            logger.info(f"Discovered {hapi_count} external/visual-builder services from HAPI FHIR")

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

            # If prefetch is empty and service has prefetch_templates, resolve them
            # This ensures services receive the data they need even when client doesn't provide prefetch
            if not prefetch and hasattr(registered_service, 'prefetch_templates') and registered_service.prefetch_templates:
                try:
                    logger.info(f"Resolving prefetch templates for service {service_id}: {list(registered_service.prefetch_templates.keys())}")
                    # Wrap context in {"context": ...} structure as templates use {{context.patientId}} format
                    prefetch_context = {"context": context}
                    prefetch = await execute_prefetch(registered_service.prefetch_templates, prefetch_context)
                    logger.info(f"Resolved prefetch keys: {list(prefetch.keys())}")
                except Exception as e:
                    logger.warning(f"Failed to resolve prefetch for {service_id}: {e}")
                    # Continue with empty prefetch - service may still work

            # Execute the single service
            result = await orchestrator.execute_single(
                service_id=service_id,
                context=context,
                prefetch=prefetch
            )

            if result.success:
                cards = result.cards
            else:
                logger.warning(f"Service {service_id} execution failed: {result.error}")

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
            except Exception as e:
                # HAPIFHIRClient re-raises 404 as generic Exception with "not found" message
                if "not found" in str(e).lower():
                    logger.info(f"Direct read failed for {service_id}, trying extension search")
                else:
                    logger.warning(f"Unexpected error reading {service_id}: {e}")

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

                # Resolve prefetch for external services
                # External services often require prefetch data to function correctly
                resolved_prefetch = request.prefetch or {}
                if not resolved_prefetch:
                    # Get prefetch template from PlanDefinition extension
                    prefetch_template = _build_prefetch_from_plan_definition(plan_definition)
                    if prefetch_template:
                        try:
                            logger.info(f"Resolving prefetch for external service {service_id}: {list(prefetch_template.keys())}")
                            context = request.context if isinstance(request.context, dict) else request.context.dict()
                            prefetch_context = {"context": context}
                            resolved_prefetch = await execute_prefetch(prefetch_template, prefetch_context)
                            logger.info(f"Resolved prefetch keys for external service: {list(resolved_prefetch.keys())}")
                        except Exception as e:
                            logger.warning(f"Failed to resolve prefetch for external service {service_id}: {e}")

                # Create updated request with resolved prefetch
                updated_request = CDSHookRequest(
                    hook=request.hook,
                    hookInstance=request.hookInstance,
                    fhirServer=request.fhirServer,
                    fhirAuthorization=request.fhirAuthorization,
                    context=request.context,
                    prefetch=resolved_prefetch
                )

                provider = RemoteServiceProvider(db)
                response = await provider.execute(
                    plan_definition,
                    updated_request,
                    service_metadata=dict(service_metadata)
                )
                cards = response.cards

            elif service_origin == "visual-builder":
                # Visual-builder services come in two flavors:
                #   - service_type='cql-based'   → CQLBackedServiceProvider ($apply)
                #   - everything else (condition-based, …) → VisualServiceProvider
                # The discriminator is on the VisualServiceConfig row, not the
                # PlanDefinition extensions, so we always load it first.
                visual_service_id = _extract_extension_value(
                    plan_definition,
                    "http://wintehr.local/fhir/StructureDefinition/visual-service-id"
                )

                if not visual_service_id:
                    logger.error(f"Visual service {service_id} missing visual-service-id extension")
                    raise HTTPException(status_code=500, detail="Invalid visual service configuration")

                from api.cds_studio.visual_service_config import VisualServiceConfig, is_cql_service_type
                from sqlalchemy import select

                query = select(VisualServiceConfig).where(
                    VisualServiceConfig.id == int(visual_service_id)
                )
                result = await db.execute(query)
                visual_config = result.scalar_one_or_none()

                if not visual_config:
                    logger.error(f"Visual service configuration not found: {visual_service_id}")
                    raise HTTPException(status_code=500, detail="Visual service not configured")

                if is_cql_service_type(visual_config.service_type):
                    # CQL-based: hand off to the bridge.
                    from .providers import CQLBackedServiceProvider
                    provider = CQLBackedServiceProvider(db)
                    response = await provider.execute(
                        plan_definition,
                        request,
                        service_metadata={
                            "name": visual_config.name,
                            "service_id": visual_config.service_id,
                            "id": visual_config.id,
                        },
                    )
                    cards = response.cards
                else:
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
    except Exception as e:
        # Catch-all for any other errors (e.g., external service failures)
        # CDS Hooks should be non-blocking - return empty cards on error
        logger.error(f"Unexpected error executing CDS service {service_id}: {e}")
        return CDSHookResponse(cards=[])


async def _execute_accepted_suggestion_actions(
    db: AsyncSession,
    *,
    service_id: str,
    feedback_item_data: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Execute the FHIR-mutating actions of an accepted CDS suggestion.

    Idempotent on (hookInstance, suggestion_uuid): a UNIQUE constraint on
    cds_hooks.executed_actions claims the lock via INSERT ... ON CONFLICT
    DO NOTHING. If another request already inserted the row, this call
    returns the previous result (read-after-write). The first writer wins;
    subsequent writers (retries, double-clicks, dup feedback) become no-ops.

    Returns a list of "what was executed" summaries — one per accepted
    suggestion that had actions[].
    """
    if feedback_item_data.get("outcome") != "accepted":
        return []

    suggestions = feedback_item_data.get("acceptedSuggestions") or []
    if not suggestions:
        return []

    hook_instance = feedback_item_data.get("hookInstance") or ""
    if not hook_instance:
        # Without a hookInstance we have no idempotency key — bail out
        # rather than risk creating duplicate FHIR resources on retry.
        logger.warning(
            "Skipping action execution for service %s: feedback has no hookInstance",
            service_id,
        )
        return []

    patient_id = feedback_item_data.get("patientId") or ""
    user_id = feedback_item_data.get("userId") or ""
    encounter_id = feedback_item_data.get("encounterId")
    card_uuid = feedback_item_data.get("card") or ""

    executor = ActionExecutor(db)
    summaries: List[Dict[str, Any]] = []

    for suggestion in suggestions:
        # Frontend sends acceptedSuggestions as either:
        #   {id: "<uuid>"} (CDS Hooks 2.0 spec — actions unknown to backend)
        #   {id: "<uuid>", actions: [...]} (our extension — see CDSCard.js)
        if not isinstance(suggestion, dict):
            continue
        suggestion_uuid = suggestion.get("id") or suggestion.get("uuid") or ""
        actions = suggestion.get("actions") or []
        if not suggestion_uuid or not actions:
            continue

        # Claim the idempotency lock. If another process already executed
        # this (hookInstance, suggestion) pair, ON CONFLICT skips and
        # returns 0 rows — we then read the prior result.
        claim = await db.execute(
            text("""
                INSERT INTO cds_hooks.executed_actions (
                    hook_instance_id, suggestion_uuid, service_id, card_uuid,
                    patient_id, user_id, actions_count, success
                ) VALUES (
                    :hook_instance_id, :suggestion_uuid, :service_id, :card_uuid,
                    :patient_id, :user_id, :actions_count, FALSE
                )
                ON CONFLICT (hook_instance_id, suggestion_uuid) DO NOTHING
                RETURNING id
            """),
            {
                "hook_instance_id": hook_instance,
                "suggestion_uuid": suggestion_uuid,
                "service_id": service_id,
                "card_uuid": card_uuid,
                "patient_id": patient_id,
                "user_id": user_id,
                "actions_count": len(actions),
            },
        )
        row_id = claim.scalar()
        if row_id is None:
            # Already executed previously — read prior outcome and skip.
            prior = await db.execute(
                text("""
                    SELECT id, success, resources_created, error_message
                    FROM cds_hooks.executed_actions
                    WHERE hook_instance_id = :hi AND suggestion_uuid = :su
                """),
                {"hi": hook_instance, "su": suggestion_uuid},
            )
            row = prior.first()
            if row:
                summaries.append({
                    "suggestionUuid": suggestion_uuid,
                    "alreadyExecuted": True,
                    "success": bool(row.success),
                    "resourcesCreated": row.resources_created or [],
                    "errorMessage": row.error_message,
                })
            await db.commit()
            continue

        # We own the lock — execute each action, then update the row.
        resources_created: List[Dict[str, str]] = []
        action_errors: List[str] = []
        for action in actions:
            if not isinstance(action, dict):
                continue
            action_uuid = action.get("uuid") or str(uuid.uuid4())
            try:
                result = await executor.execute_action(
                    ActionExecutionRequest(
                        hook_instance=hook_instance,
                        service_id=service_id,
                        card_uuid=card_uuid,
                        suggestion_uuid=suggestion_uuid,
                        action_uuid=action_uuid,
                        patient_id=patient_id,
                        user_id=user_id,
                        encounter_id=encounter_id,
                    ),
                    action,
                )
                if result.success:
                    # Different action types report what they wrote either via
                    # `created_resources` (a list) or via the scalar
                    # `resource_id`/`resource_type`. Merge both into one list
                    # and dedup on (resourceType, id) so callers see each
                    # resource once.
                    seen = {(r.get("resourceType"), r.get("id"))
                            for r in resources_created}
                    for r in result.created_resources:
                        key = (r.get("resourceType"), r.get("id"))
                        if key not in seen:
                            resources_created.append(r)
                            seen.add(key)
                    if result.resource_id and result.resource_type:
                        key = (result.resource_type, result.resource_id)
                        if key not in seen:
                            resources_created.append({
                                "resourceType": result.resource_type,
                                "id": result.resource_id,
                            })
                            seen.add(key)
                else:
                    action_errors.extend(result.errors or ["unknown failure"])
            except Exception as exc:  # noqa: BLE001 — log + continue
                logger.exception(
                    "Action execution failed for suggestion %s of service %s",
                    suggestion_uuid, service_id,
                )
                action_errors.append(str(exc))

        success = not action_errors
        await db.execute(
            text("""
                UPDATE cds_hooks.executed_actions
                SET success = :success,
                    resources_created = :resources_created,
                    error_message = :error_message
                WHERE id = :id
            """),
            {
                "id": row_id,
                "success": success,
                "resources_created": json.dumps(resources_created),
                "error_message": "; ".join(action_errors) if action_errors else None,
            },
        )
        await db.commit()

        summaries.append({
            "suggestionUuid": suggestion_uuid,
            "alreadyExecuted": False,
            "success": success,
            "resourcesCreated": resources_created,
            "errorMessage": "; ".join(action_errors) if action_errors else None,
        })

    return summaries


# CDS Service Feedback Endpoint
@router.post("/cds-services/{service_id}/feedback")
async def provide_feedback(
    service_id: str,
    feedback: FeedbackRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Provide feedback on CDS service recommendations - CDS Hooks v2.0 compliant"""
    try:
        # We don't 404 on unknown service_id here. The legacy lookup only
        # consulted `cds_hooks.hook_configurations` + SAMPLE_HOOKS, which
        # misses visual-builder and CQL-based services entirely (those
        # live in cds_visual_builder.service_configs and the in-memory
        # registry). Rejecting their feedback was a false negative: the
        # service produced the card the user just acknowledged. Log a
        # warning if the id is unknown to the legacy stores, but accept
        # the feedback regardless — it carries the analytics + (for
        # accepted suggestions) the actions to execute.
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config and service_id not in SAMPLE_HOOKS:
            logger.info(
                "Feedback for service '%s' not found in legacy stores — accepting "
                "anyway (likely a visual-builder or CQL-based service)",
                service_id,
            )

        # Process and store the feedback
        # The feedback request contains an array of feedback items
        if not feedback.feedback or len(feedback.feedback) == 0:
            raise HTTPException(status_code=400, detail="No feedback items provided")
        
        # Process each feedback item
        feedback_ids = []
        executed_actions: List[Dict[str, Any]] = []
        for feedback_item in feedback.feedback:
            # Coerce Pydantic models to dicts so downstream JSON
            # serialization (in persistence.store_feedback and our
            # action-execution helper) works on plain data.
            raw_accepted = getattr(feedback_item, 'acceptedSuggestions', None)
            accepted_suggestions = (
                [s.dict() if hasattr(s, 'dict') else s for s in raw_accepted]
                if raw_accepted else None
            )
            raw_override = (
                getattr(feedback_item, 'overrideReason', None)
                or getattr(feedback_item, 'overrideReasons', None)
            )
            override_reason = (
                raw_override.dict() if hasattr(raw_override, 'dict') else raw_override
            )
            feedback_data = {
                'hookInstance': getattr(feedback_item, 'hookInstance', None),
                'service': service_id,
                'card': feedback_item.card,
                'outcome': feedback_item.outcome,
                'overrideReason': override_reason,
                'acceptedSuggestions': accepted_suggestions,
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

            # If the user accepted a suggestion that carries actions[], execute
            # those actions now. Idempotent on (hookInstance, suggestion uuid).
            try:
                summaries = await _execute_accepted_suggestion_actions(
                    db, service_id=service_id, feedback_item_data=feedback_data,
                )
                executed_actions.extend(summaries)
            except Exception as exec_err:  # noqa: BLE001 — surface but don't fail feedback
                logger.exception(
                    "Failed to execute accepted-suggestion actions for service %s: %s",
                    service_id, exec_err,
                )

        # Return success response per CDS Hooks specification, plus a
        # WintEHR-specific `executedActions` field summarizing any FHIR
        # writes the accepted suggestions triggered (so the UI can refresh
        # the affected resource lists immediately).
        return {
            "status": "success",
            "feedbackIds": feedback_ids,
            "executedActions": executed_actions,
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


# Debug / Diagnostic Endpoint
@router.get("/cds-debug/{service_id}")
async def diagnose_service(
    service_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Read-only triage for a CDS service that isn't producing cards.

    Walks the same path execute_service walks and reports what was found
    at each stage. Always returns 200 — the response body is the report,
    not the result of executing the service. Safe to call on prod since
    no PHI is touched and no resource is mutated.

    Stages reported:
      - registry          v3.0 ServiceRegistry hit?
      - hapi_plan_definition  Direct read by id, then extension search
      - duplicates        Count of PlanDefinitions sharing this hook-service-id
      - external_service  metadata row in external_services.services (when origin=external)
      - visual_config     VisualServiceConfig row (when origin=visual-builder)
      - cql_libraries     For cql-based: each library reference is resolved
                          against HAPI to see if it still exists
      - diagnosis         Human-readable summary
    """
    from services.hapi_fhir_client import HAPIFHIRClient
    from sqlalchemy import select

    report: Dict[str, Any] = {
        "service_id": service_id,
        "checks": {
            "registry": {"found": False, "title": None},
            "hapi_plan_definition": {
                "found": False,
                "id": None,
                "method": None,  # "direct_read" | "extension_search"
                "service_origin": None,
                "hook_type": None,
                "library_refs": [],
            },
            "duplicates": {"count": 0, "ids": []},
            "external_service": None,
            "visual_config": None,
            "cql_libraries": None,
        },
        "diagnosis": None,
    }
    diagnosis_parts: List[str] = []

    # 1. Registry lookup
    registry = get_registry()
    registered = registry.get(service_id)
    if registered is not None:
        report["checks"]["registry"]["found"] = True
        report["checks"]["registry"]["title"] = getattr(registered, "title", None)

    # 2. HAPI lookup (direct read first, then extension search) +
    #    duplicate count.
    hapi_client = HAPIFHIRClient()
    plan_definition: Optional[Dict[str, Any]] = None

    try:
        plan_definition = await hapi_client.read("PlanDefinition", service_id)
        report["checks"]["hapi_plan_definition"]["method"] = "direct_read"
    except Exception:
        # 404 / other read errors fall through to the search path.
        pass

    # Extension search runs unconditionally so we can also count duplicates.
    try:
        bundle = await hapi_client.search(
            "PlanDefinition", {"status": "active", "_count": 200}
        )
        matches: List[Dict[str, Any]] = []
        for entry in bundle.get("entry", []) or []:
            resource = entry.get("resource") or {}
            ext_id = _extract_extension_value(
                resource,
                "http://wintehr.local/fhir/StructureDefinition/hook-service-id",
            )
            if ext_id == service_id:
                matches.append(resource)

        if matches:
            # Sort by lastUpdated descending so the freshest one wins for the
            # primary report (matches what discover_services dedup picks).
            matches.sort(
                key=lambda r: (r.get("meta") or {}).get("lastUpdated") or "",
                reverse=True,
            )
            if plan_definition is None:
                plan_definition = matches[0]
                report["checks"]["hapi_plan_definition"]["method"] = "extension_search"
            report["checks"]["duplicates"]["count"] = len(matches)
            report["checks"]["duplicates"]["ids"] = [r.get("id") for r in matches]
    except Exception as exc:
        diagnosis_parts.append(f"HAPI extension search failed: {exc}")

    if plan_definition is not None:
        report["checks"]["hapi_plan_definition"]["found"] = True
        report["checks"]["hapi_plan_definition"]["id"] = plan_definition.get("id")
        report["checks"]["hapi_plan_definition"]["service_origin"] = (
            _extract_extension_value(
                plan_definition,
                "http://wintehr.local/fhir/StructureDefinition/service-origin",
            )
        )
        report["checks"]["hapi_plan_definition"]["hook_type"] = (
            _extract_extension_value(
                plan_definition,
                "http://wintehr.local/fhir/StructureDefinition/hook-type",
            )
        )
        report["checks"]["hapi_plan_definition"]["library_refs"] = list(
            plan_definition.get("library") or []
        )

    # 3. Origin-specific deeper checks. Mirror execute_service's routing.
    origin = report["checks"]["hapi_plan_definition"]["service_origin"]

    if origin == "external" and plan_definition is not None:
        external_service_id = _extract_extension_value(
            plan_definition,
            "http://wintehr.local/fhir/StructureDefinition/external-service-id",
        )
        report["checks"]["external_service"] = {
            "external_service_id": external_service_id,
            "metadata_row_found": False,
            "auto_disabled": None,
            "consecutive_failures": None,
            "last_error_message": None,
        }
        if external_service_id:
            try:
                row = (
                    await db.execute(
                        text(
                            "SELECT auto_disabled, consecutive_failures, "
                            "last_error_message "
                            "FROM external_services.services "
                            "WHERE id = :id LIMIT 1"
                        ),
                        {"id": external_service_id},
                    )
                ).mappings().first()
                if row:
                    report["checks"]["external_service"]["metadata_row_found"] = True
                    report["checks"]["external_service"]["auto_disabled"] = row[
                        "auto_disabled"
                    ]
                    report["checks"]["external_service"]["consecutive_failures"] = row[
                        "consecutive_failures"
                    ]
                    report["checks"]["external_service"]["last_error_message"] = row[
                        "last_error_message"
                    ]
                else:
                    diagnosis_parts.append(
                        "External service has no metadata row "
                        "(external_services.services). Likely deleted."
                    )
            except Exception as exc:
                diagnosis_parts.append(f"Could not read external service row: {exc}")
        else:
            diagnosis_parts.append(
                "PlanDefinition is tagged service-origin=external but missing "
                "the external-service-id extension."
            )

    elif origin == "visual-builder" and plan_definition is not None:
        from api.cds_studio.visual_service_config import (
            VisualServiceConfig,
            is_cql_service_type,
        )

        visual_service_id = _extract_extension_value(
            plan_definition,
            "http://wintehr.local/fhir/StructureDefinition/visual-service-id",
        )
        vc_report: Dict[str, Any] = {
            "visual_service_id": visual_service_id,
            "config_row_found": False,
            "service_type": None,
            "is_cql": False,
        }
        if visual_service_id:
            try:
                config = (
                    await db.execute(
                        select(VisualServiceConfig).where(
                            VisualServiceConfig.id == int(visual_service_id)
                        )
                    )
                ).scalar_one_or_none()
                if config is not None:
                    vc_report["config_row_found"] = True
                    vc_report["service_type"] = config.service_type
                    vc_report["is_cql"] = is_cql_service_type(config.service_type)
                else:
                    diagnosis_parts.append(
                        f"VisualServiceConfig row {visual_service_id} not found "
                        "— execute_service would 500 with 'Visual service not configured'."
                    )
            except Exception as exc:
                diagnosis_parts.append(
                    f"Could not read VisualServiceConfig row: {exc}"
                )
        else:
            diagnosis_parts.append(
                "PlanDefinition is tagged service-origin=visual-builder but "
                "missing the visual-service-id extension."
            )
        report["checks"]["visual_config"] = vc_report

        # CQL-specific: check that each library reference resolves.
        if vc_report["is_cql"]:
            library_refs = report["checks"]["hapi_plan_definition"]["library_refs"]
            cql_report: List[Dict[str, Any]] = []
            if not library_refs:
                diagnosis_parts.append(
                    "CQL service but PlanDefinition.library[] is empty — "
                    "$apply will return no actions."
                )
            for ref in library_refs:
                # The reference is a canonical URL. The Library.id is the last
                # path segment. Try to read it directly; fall back to a url
                # search if the canonical doesn't match the id.
                tail = ref.rsplit("/", 1)[-1] if isinstance(ref, str) else None
                resolution: Dict[str, Any] = {
                    "reference": ref,
                    "exists_in_hapi": False,
                    "resolved_id": None,
                }
                if tail:
                    try:
                        lib = await hapi_client.read("Library", tail)
                        if lib:
                            resolution["exists_in_hapi"] = True
                            resolution["resolved_id"] = lib.get("id")
                    except Exception:
                        pass
                if not resolution["exists_in_hapi"] and isinstance(ref, str):
                    try:
                        b = await hapi_client.search("Library", {"url": ref})
                        for e in b.get("entry", []) or []:
                            r = e.get("resource") or {}
                            if r.get("resourceType") == "Library":
                                resolution["exists_in_hapi"] = True
                                resolution["resolved_id"] = r.get("id")
                                break
                    except Exception:
                        pass
                if not resolution["exists_in_hapi"]:
                    diagnosis_parts.append(
                        f"PlanDefinition references Library {ref!r} which does "
                        "not exist in HAPI. $apply will fail; runtime returns "
                        "empty cards via the catch-all."
                    )
                cql_report.append(resolution)
            report["checks"]["cql_libraries"] = cql_report

    elif plan_definition is None and not report["checks"]["registry"]["found"]:
        diagnosis_parts.append(
            "Service not found in either the registry or HAPI. "
            "Discovery would return it as nonexistent; execute returns 404."
        )

    # 4. Pre-PR-79 duplicate stacking warning.
    if report["checks"]["duplicates"]["count"] > 1:
        diagnosis_parts.append(
            f"{report['checks']['duplicates']['count']} PlanDefinitions share "
            "this hook-service-id. Discovery dedupes on read (since "
            "PR #79) but the orphans should be reclaimed via "
            "expunge_orphan_visual_plan_definitions.py --apply."
        )

    if not diagnosis_parts:
        diagnosis_parts.append(
            "No structural problem detected. If the service is still not "
            "producing cards, the issue is in the runtime path — check "
            "backend logs for $apply errors or condition-tree evaluation "
            "warnings during a real hook fire."
        )

    report["diagnosis"] = " ".join(diagnosis_parts)
    return report


# Service Management Endpoints (for CRUD operations)
@router.get("/services", response_model=List[HookConfiguration])
async def list_services(
    hook_type: Optional[str] = None,
    enabled_only: bool = True,
    db: AsyncSession = Depends(get_db_session)
):
    """List all CDS services.

    Combines two sources:

    1. Hooks stored in `cds_hooks.hook_configurations` (built-in / external
       services managed via the legacy hook persistence layer).
    2. Visual-builder services from `cds_hooks.visual_builder_services` —
       these aren't in the legacy table, so without this merge they were
       absent from the list and the EMR's `CDSHookManager` could never
       look up their `displayBehavior`. That's why every wizard-built
       service rendered as POPUP regardless of its `display_config`.

    For the visual-builder rows we project `display_config.presentationMode`
    onto `HookConfiguration.displayBehavior.defaultMode` so the existing
    frontend mode-picker code path (CDSHookManager.js:222-234) just works.
    """
    try:
        manager = await get_persistence_manager(db)
        legacy_hooks = await manager.list_hooks(
            hook_type=hook_type, enabled_only=enabled_only
        )
    except DatabaseQueryError as e:
        logger.error(f"Database error listing hooks: {e.message}")
        legacy_hooks = list(SAMPLE_HOOKS.values())
        if hook_type:
            legacy_hooks = [h for h in legacy_hooks if h.hook.value == hook_type]
        if enabled_only:
            legacy_hooks = [h for h in legacy_hooks if h.enabled]
    except (ValueError, TypeError, KeyError, AttributeError) as e:
        logger.error(f"Data error listing hooks: {e}")
        legacy_hooks = list(SAMPLE_HOOKS.values())
        if hook_type:
            legacy_hooks = [h for h in legacy_hooks if h.hook.value == hook_type]
        if enabled_only:
            legacy_hooks = [h for h in legacy_hooks if h.enabled]

    # Merge in visual-builder services with displayBehavior derived from
    # their wizard-set `display_config`.
    visual_hooks: List[HookConfiguration] = []
    try:
        from sqlalchemy import select as _select
        from api.cds_studio.visual_service_config import VisualServiceConfig

        vquery = _select(VisualServiceConfig)
        if hook_type:
            vquery = vquery.where(VisualServiceConfig.hook_type == hook_type)
        if enabled_only:
            vquery = vquery.where(VisualServiceConfig.status == "ACTIVE")

        vresult = await db.execute(vquery)
        for v in vresult.scalars().all():
            display_cfg = v.display_config or {}
            presentation = (display_cfg.get("presentationMode")
                            if isinstance(display_cfg, dict) else None)
            display_behavior = (
                {"defaultMode": presentation} if presentation else None
            )
            try:
                hook_enum = HookType(v.hook_type)
            except ValueError:
                # Unknown hook types are skipped — same as the legacy path.
                continue
            visual_hooks.append(HookConfiguration(
                id=v.service_id,
                hook=hook_enum,
                title=v.name,
                description=v.description or "",
                enabled=(v.status == "ACTIVE"),
                conditions=[],
                actions=[],
                prefetch=v.prefetch_config or None,
                usageRequirements=None,
                displayBehavior=display_behavior,
                created_at=v.created_at,
                updated_at=v.updated_at,
            ))
    except Exception as exc:  # noqa: BLE001 — non-fatal: legacy hooks still list
        logger.warning(
            "Failed to merge visual-builder services into hook list: %s", exc
        )

    # De-dupe in case both sources have a row for the same service_id.
    # Visual-builder is the source of truth for display behavior.
    seen = {h.id for h in visual_hooks}
    merged = visual_hooks + [h for h in legacy_hooks if h.id not in seen]
    return merged

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


# Service Registry Management Endpoints (below)

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
    except DatabaseQueryError:
        logger.exception("CDS Hooks health check: database error")
        db_status = "database error"
        db_hooks_count = 0
    except (ValueError, TypeError, KeyError, AttributeError):
        logger.exception("CDS Hooks health check: data error")
        db_status = "data error"
        db_hooks_count = 0

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
        "service_registry": {
            "status": "active",
            "services": [s.service_id for s in registry_services]
        },
        "timestamp": datetime.now().isoformat()
    }