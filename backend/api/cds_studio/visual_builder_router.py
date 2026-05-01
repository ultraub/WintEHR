"""
Visual CDS Builder API Router

Provides REST API endpoints for creating, managing, and deploying
visually-built CDS services. Integrates with the service code generator
to convert visual configurations into executable Python services.

Educational notes:
- RESTful API design patterns
- Visual-to-code workflow
- Service lifecycle management
- Code generation and deployment
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
import logging
import uuid
import json

from database import get_db_session
from api.auth.service import get_current_user_or_demo
from api.auth.models import User

from .visual_service_config import (
    VisualServiceConfig,
    VisualServiceConfigCreate,
    VisualServiceConfigUpdate,
    VisualServiceConfigResponse,
    ServiceStatus,
    ServiceType,
    ServiceDeploymentRequest,
    ServiceTestRequest,
    ServiceTestResponse,
    ServiceAnalytics,
    is_cql_service_type,
    validate_condition_structure,
)
from .cql_artifact_builder import (
    APPLICABILITY_DEFINE,
    build_plan_definition,
    detect_cql_defines,
    materialize_cql_service,
)
from api.cds_hooks.cql_bridge import CQLBridge, get_cql_bridge
from api.cds_hooks.external_service_models import (
    ExternalServiceRegistration,
    ExternalServiceResponse
)
from api.cds_hooks.service_code_generator import ServiceCodeGenerator
from api.cds_hooks.models import CDSHookRequest, CDSHookResponse
# v3.0: Use new registry module
from api.cds_hooks.registry import get_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cds-visual-builder", tags=["CDS Visual Builder"])


# Dependency injection for service instances
async def get_code_generator() -> ServiceCodeGenerator:
    """Get service code generator instance"""
    return ServiceCodeGenerator()


# Visual Service CRUD Endpoints

@router.post("/services", response_model=VisualServiceConfigResponse, status_code=201)
async def create_visual_service(
    config: VisualServiceConfigCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
    generator: ServiceCodeGenerator = Depends(get_code_generator)
):
    """
    Create a new visual CDS service configuration

    Educational aspects:
    - Validates service configuration
    - Generates Python code automatically
    - Stores in database with metadata
    - Returns created configuration
    """
    try:
        cql_mode = is_cql_service_type(config.service_type)
        conditions_as_dicts = [c.dict() if hasattr(c, 'dict') else c for c in config.conditions]

        if cql_mode:
            # CQL path: cql_source is required, condition tree must be empty.
            if not config.cql_source or not config.cql_source.strip():
                raise HTTPException(
                    status_code=400,
                    detail="cql_source is required when service_type is 'cql-based'",
                )
            detected = detect_cql_defines(config.cql_source)
            if APPLICABILITY_DEFINE not in detected:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"CQL is missing a `define {APPLICABILITY_DEFINE}:` "
                        "boolean expression. Every CQL service needs an "
                        "applicability gate that decides when to fire."
                    ),
                )
            # No condition-tree validation, no Python codegen for CQL services.
            generated_code = None
            code_hash = None
        else:
            # Visual path: validate the condition tree and generate the Python
            # reference implementation.
            is_valid, errors = validate_condition_structure(conditions_as_dicts)
            if not is_valid:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid condition structure: {', '.join(errors)}"
                )

            service_config_dict = {
                "service_type": config.service_type,
                "hook_type": config.hook_type,
                "name": config.name,
                "description": config.description,
                "conditions": conditions_as_dicts,
                "card": config.card_config.dict() if hasattr(config.card_config, 'dict') else config.card_config,
                "display_config": config.display_config.dict() if hasattr(config.display_config, 'dict') else config.display_config,
                "prefetch": config.prefetch_config or {}
            }

            generated_code = generator.generate_service_code(
                config.service_id,
                service_config_dict
            )
            code_hash = generator.generate_code_hash(generated_code)

        # Create database record (CQL fields filled in below after HAPI upload)
        visual_service = VisualServiceConfig(
            service_id=config.service_id,
            name=config.name,
            description=config.description,
            service_type=config.service_type,
            category=config.category,
            hook_type=config.hook_type,
            conditions=conditions_as_dicts,
            card_config=config.card_config.dict() if hasattr(config.card_config, 'dict') else config.card_config,
            display_config=config.display_config.dict() if hasattr(config.display_config, 'dict') else config.display_config,
            prefetch_config=config.prefetch_config,
            cql_source=config.cql_source if cql_mode else None,
            generated_code=generated_code,
            code_hash=code_hash,
            status='DRAFT',
            created_by=config.created_by
        )

        db.add(visual_service)
        await db.commit()
        await db.refresh(visual_service)

        # For CQL services, materialize FHIR Library + PlanDefinition in HAPI
        # so the runtime dispatcher can call $apply against them. Failures here
        # surface to the user — the service config is rolled back so we never
        # leave behind a CQL row without the corresponding HAPI artifacts.
        if cql_mode:
            try:
                artifacts = await materialize_cql_service(
                    service_id=config.service_id,
                    name=config.name,
                    description=config.description,
                    hook_type=config.hook_type,
                    cql_source=config.cql_source,
                    card_config=visual_service.card_config,
                    prefetch_config=config.prefetch_config,
                    visual_service_db_id=visual_service.id,
                )
            except Exception as exc:
                # Roll back the DB row so the user can retry without orphaning.
                await db.delete(visual_service)
                await db.commit()
                logger.error("CQL materialization failed for %s: %s", config.service_id, exc)
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to upload CQL artifacts to HAPI: {exc}",
                )
            visual_service.library_canonical_url = artifacts.library_canonical_url
            visual_service.plan_definition_canonical_url = artifacts.plan_definition_canonical_url
            await db.commit()
            await db.refresh(visual_service)

        logger.info(f"Created visual service: {config.service_id} by {config.created_by}")

        return visual_service

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating visual service: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services", response_model=List[VisualServiceConfigResponse])
async def list_visual_services(
    status: Optional[ServiceStatus] = Query(None, description="Filter by status"),
    service_type: Optional[ServiceType] = Query(None, description="Filter by service type"),
    search: Optional[str] = Query(None, description="Search in name or description"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of records"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    List visual CDS service configurations with filtering

    Educational aspects:
    - Pagination support
    - Multiple filter options
    - Search functionality
    - Ordered by creation date
    """
    try:
        query = select(VisualServiceConfig)

        # Apply filters
        if status:
            query = query.where(VisualServiceConfig.status == status)

        if service_type:
            query = query.where(VisualServiceConfig.service_type == service_type)

        if is_active is not None:
            query = query.where(VisualServiceConfig.is_active == is_active)

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    VisualServiceConfig.name.ilike(search_pattern),
                    VisualServiceConfig.description.ilike(search_pattern)
                )
            )

        # Order by creation date (newest first)
        query = query.order_by(VisualServiceConfig.created_at.desc())

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        services = result.scalars().all()

        return services

    except Exception as e:
        logger.error(f"Error listing visual services: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services/{service_id}", response_model=VisualServiceConfigResponse)
async def get_visual_service(
    service_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    Get a specific visual CDS service configuration

    Educational aspects:
    - Retrieve by service_id (not database ID)
    - Return complete configuration including generated code
    """
    try:
        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await db.execute(query)
        service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        return service

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting visual service: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/services/{service_id}", response_model=VisualServiceConfigResponse)
async def update_visual_service(
    service_id: str,
    update: VisualServiceConfigUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
    generator: ServiceCodeGenerator = Depends(get_code_generator)
):
    """
    Update a visual CDS service configuration

    Educational aspects:
    - Partial updates supported
    - Regenerates code if conditions/card changed
    - Updates code hash for change tracking
    - Version management
    """
    try:
        # Get existing service
        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await db.execute(query)
        service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        # Track whether we need to regenerate the Python code (visual path) or
        # re-materialize the FHIR Library + PlanDefinition (CQL path).
        needs_code_regen = False
        needs_cql_rematerialize = False

        if update.name is not None:
            service.name = update.name
            needs_cql_rematerialize = True  # PlanDefinition.title

        if update.description is not None:
            service.description = update.description
            needs_cql_rematerialize = True

        if update.service_type is not None:
            service.service_type = update.service_type
            needs_code_regen = True
            needs_cql_rematerialize = True

        if update.category is not None:
            service.category = update.category

        if update.hook_type is not None:
            service.hook_type = update.hook_type
            needs_code_regen = True
            needs_cql_rematerialize = True  # PlanDefinition.action.trigger

        if update.conditions is not None and not is_cql_service_type(service.service_type):
            # Visual path only — CQL services don't use the condition tree.
            conditions_as_dicts = [c.dict() if hasattr(c, 'dict') else c for c in update.conditions]
            is_valid, errors = validate_condition_structure(conditions_as_dicts)
            if not is_valid:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid condition structure: {', '.join(errors)}"
                )
            service.conditions = conditions_as_dicts
            needs_code_regen = True

        if update.card_config is not None:
            service.card_config = update.card_config.dict() if hasattr(update.card_config, 'dict') else update.card_config
            needs_code_regen = True
            needs_cql_rematerialize = True  # action.title / description / priority

        if update.display_config is not None:
            service.display_config = update.display_config.dict() if hasattr(update.display_config, 'dict') else update.display_config

        if update.prefetch_config is not None:
            service.prefetch_config = update.prefetch_config
            needs_code_regen = True
            needs_cql_rematerialize = True  # prefetch extension on PlanDefinition

        if update.cql_source is not None:
            if not is_cql_service_type(service.service_type):
                raise HTTPException(
                    status_code=400,
                    detail="cql_source can only be set on cql-based services",
                )
            detected = detect_cql_defines(update.cql_source)
            if APPLICABILITY_DEFINE not in detected:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"CQL is missing a `define {APPLICABILITY_DEFINE}:` "
                        "boolean expression."
                    ),
                )
            service.cql_source = update.cql_source
            needs_cql_rematerialize = True

        if update.status is not None:
            service.status = update.status

        # Regenerate Python code (visual path) — skipped for CQL since it has none.
        if needs_code_regen and not is_cql_service_type(service.service_type):
            service_config_dict = {
                "service_type": service.service_type,
                "hook_type": service.hook_type,
                "name": service.name,
                "description": service.description,
                "conditions": service.conditions,
                "card": service.card_config,
                "display_config": service.display_config,
                "prefetch": service.prefetch_config or {}
            }

            generated_code = generator.generate_service_code(
                service.service_id,
                service_config_dict
            )
            code_hash = generator.generate_code_hash(generated_code)

            service.generated_code = generated_code
            service.code_hash = code_hash

        # Re-upload Library + re-PUT PlanDefinition for CQL services.
        if needs_cql_rematerialize and is_cql_service_type(service.service_type) and service.cql_source:
            try:
                artifacts = await materialize_cql_service(
                    service_id=service.service_id,
                    name=service.name,
                    description=service.description,
                    hook_type=service.hook_type,
                    cql_source=service.cql_source,
                    card_config=service.card_config,
                    prefetch_config=service.prefetch_config,
                    visual_service_db_id=service.id,
                )
            except Exception as exc:
                logger.error("CQL re-materialization failed for %s: %s", service_id, exc)
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to update CQL artifacts in HAPI: {exc}",
                )
            service.library_canonical_url = artifacts.library_canonical_url
            service.plan_definition_canonical_url = artifacts.plan_definition_canonical_url

        # Update metadata (updated_at is automatically set by database)
        service.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(service)

        logger.info("Updated visual service: %s", service_id)

        return service

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating visual service: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/services/{service_id}", status_code=204)
async def delete_visual_service(
    service_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    Delete a visual CDS service configuration

    Educational aspects:
    - Soft delete (marks as archived)
    - Prevents deletion of active services
    - Maintains audit trail
    """
    try:
        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await db.execute(query)
        service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        # Prevent deletion of active services
        if service.status == 'ACTIVE':
            raise HTTPException(
                status_code=400,
                detail="Cannot delete active service. Deactivate first."
            )

        # Soft delete - mark as archived
        service.status = 'ARCHIVED'
        service.deleted_at = datetime.utcnow()
        service.deleted_by = current_user.id

        await db.commit()

        logger.info(f"Archived visual service: {service_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting visual service: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# Code Generation and Preview

@router.get("/services/{service_id}/code")
async def get_generated_code(
    service_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    Get the generated Python code for a visual service

    Educational aspects:
    - Returns Python CDSService class code for display/export reference only
    - This code is NEVER compiled or executed by the system
    - Visual services are executed by VisualServiceProvider which interprets
      the JSON config directly (conditions, card_config, display_config)
    - Code generation shows what a hand-coded equivalent would look like
    """
    try:
        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await db.execute(query)
        service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        generator = ServiceCodeGenerator()
        class_name = generator._to_class_name(service_id)

        registration_code = generator.generate_service_registration(
            service_id,
            {
                "hook_type": service.hook_type,
                "name": service.name,
                "description": service.description,
                "prefetch": service.prefetch_config
            },
            class_name
        )

        return {
            "service_id": service_id,
            "class_name": class_name,
            "code": service.generated_code,
            "code_hash": service.code_hash,
            "registration_code": registration_code,
            "last_generated": service.updated_at or service.created_at
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting generated code: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/services/{service_id}/regenerate-code")
async def regenerate_service_code(
    service_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
    generator: ServiceCodeGenerator = Depends(get_code_generator)
):
    """
    Force regeneration of service code

    Educational aspects:
    - Useful after generator updates
    - Maintains configuration consistency
    - Updates code hash
    """
    try:
        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await db.execute(query)
        service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        # Regenerate code
        service_config_dict = {
            "service_type": service.service_type,
            "hook_type": service.hook_type,
            "name": service.name,
            "description": service.description,
            "conditions": service.conditions,
            "card": service.card_config,
            "display_config": service.display_config,
            "prefetch": service.prefetch_config or {}
        }

        generated_code = generator.generate_service_code(
            service.service_id,
            service_config_dict
        )
        code_hash = generator.generate_code_hash(generated_code)

        old_hash = service.code_hash
        service.generated_code = generated_code
        service.code_hash = code_hash
        service.updated_at = datetime.utcnow()

        await db.commit()

        logger.info(f"Regenerated code for service: {service_id}")

        return {
            "service_id": service_id,
            "code_regenerated": True,
            "old_hash": old_hash,
            "new_hash": code_hash,
            "code_changed": old_hash != code_hash
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error regenerating code: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# Service Testing

@router.post("/services/{service_id}/test", response_model=ServiceTestResponse)
async def test_visual_service(
    service_id: str,
    test_request: ServiceTestRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    Test a visual service with synthetic patient data

    Educational aspects:
    - Executes service in isolated environment
    - Returns cards and execution metrics
    - Validates service logic
    - Provides debugging information
    """
    try:
        import time

        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await db.execute(query)
        service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        # Create CDS Hooks request
        cds_request = CDSHookRequest(
            hook=service.hook_type,
            hookInstance=str(uuid.uuid4()),
            context={
                "patientId": test_request.patient_id,
                "userId": current_user.id,
                **(test_request.context or {})
            },
            prefetch={}
        )

        # Execute service (simulate execution with generated code)
        start_time = time.time()
        errors = []
        warnings = []
        cards = []

        try:
            if is_cql_service_type(service.service_type):
                # CQL services run through the bridge — same path the dispatcher uses.
                if not service.plan_definition_canonical_url:
                    raise RuntimeError(
                        "CQL service has no PlanDefinition URL — re-save the draft to materialize it."
                    )
                bridge = CQLBridge()
                # The bridge's apply() takes a PlanDefinition id, not URL —
                # extract the id from the canonical URL we stored on save.
                pd_id = service.plan_definition_canonical_url.rsplit("/", 1)[-1]
                apply_result = await bridge.apply(
                    pd_id,
                    subject_ref=f"Patient/{test_request.patient_id}",
                    source_label=service.name or service.service_id,
                )
                for card in apply_result.cards:
                    cards.append(card.dict() if hasattr(card, "dict") else card)
                # Surface OperationOutcome warnings to the test panel — useful
                # for catching "Could not resolve identifier X" errors that
                # don't fail $apply but indicate broken dynamicValue refs.
                for issue in apply_result.warnings:
                    if issue.severity in ("fatal", "error"):
                        errors.append(f"[{issue.severity}] {issue.diagnostics}")
                    else:
                        warnings.append(f"[{issue.severity}] {issue.diagnostics}")
                if not apply_result.cards and not errors:
                    warnings.append(
                        "$apply returned no cards — Applicability evaluated false for this patient."
                    )
            else:
                # Visual condition tree — existing path.
                from .visual_service_provider import VisualServiceProvider

                provider = VisualServiceProvider(db)
                response = await provider.execute(
                    visual_config=service,
                    request=cds_request,
                    plan_definition={}  # Not needed for direct test execution
                )

                for card in response.cards:
                    cards.append(card.dict() if hasattr(card, 'dict') else card)

                if not response.cards:
                    warnings.append("No cards generated - conditions may not be met for this patient")

        except Exception as e:
            errors.append(f"Execution error: {str(e)}")

        execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds

        # Note: execution_count and last_executed_at don't exist in database schema
        # Analytics should be tracked in separate service_analytics table
        # For now, skip metrics update
        # await db.commit()  # No changes to commit

        return ServiceTestResponse(
            service_id=service_id,
            patient_id=test_request.patient_id,
            executed=len(errors) == 0,
            cards=cards,
            execution_time_ms=execution_time,
            errors=errors,
            warnings=warnings
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing visual service: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Service Deployment

@router.post("/services/{service_id}/deploy")
async def deploy_visual_service(
    service_id: str,
    deployment: ServiceDeploymentRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    Deploy a visual service to production

    Educational aspects:
    - Creates a PlanDefinition in HAPI FHIR as registry entry
    - VisualServiceProvider interprets the JSON config directly at runtime
      (generated Python code is for display/export only, never executed)
    - Marks service as active in local database
    - Tracks deployment metadata and version
    """
    try:
        # Try to find service by ID (integer) or service_id (string)
        # Frontend passes database ID, so try that first
        service = None

        # First attempt: treat as database ID (integer)
        if service_id.isdigit():
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.id == int(service_id)
            )
            result = await db.execute(query)
            service = result.scalar_one_or_none()

        # Second attempt: treat as service_id (string identifier)
        if not service:
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await db.execute(query)
            service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        cql_mode = is_cql_service_type(service.service_type)

        # Validate service is ready for deployment.
        # CQL services don't have generated_code (Python is never generated for
        # them); their HAPI artifacts were created on save and we re-materialize
        # at a stable canonical URL below.
        if not cql_mode and not service.generated_code:
            raise HTTPException(
                status_code=400,
                detail="Service has no generated code"
            )

        if cql_mode:
            # Re-materialize at a stable canonical URL. Library version uses
            # the service config's `version` (auto-incremented by the trigger
            # on every meaningful edit) so HAPI's CR cache invalidates between
            # deploys — no more cache-stickiness like during draft authoring.
            library_version = f"1.0.{service.version or 0}"
            try:
                artifacts = await materialize_cql_service(
                    service_id=service.service_id,
                    name=service.name,
                    description=service.description,
                    hook_type=service.hook_type,
                    cql_source=service.cql_source or "",
                    card_config=service.card_config or {},
                    prefetch_config=service.prefetch_config,
                    visual_service_db_id=service.id,
                    stable=True,
                    library_version=library_version,
                )
            except Exception as exc:
                logger.error("CQL deploy materialization failed for %s: %s", service_id, exc)
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to publish CQL artifacts to HAPI: {exc}",
                )
            service.library_canonical_url = artifacts.library_canonical_url
            service.plan_definition_canonical_url = artifacts.plan_definition_canonical_url
            logger.info(
                "Deployed CQL service %s — Library at %s (v%s)",
                service.service_id, artifacts.library_canonical_url, library_version,
            )
        else:
            # Visual condition tree — existing flow: create a metadata-only
            # PlanDefinition in HAPI for discovery. The runtime VisualServiceProvider
            # interprets the JSON config directly, so this PlanDefinition is just
            # a registry entry.
            from services.hapi_fhir_client import HAPIFHIRClient
            hapi_client = HAPIFHIRClient()

            plan_definition = {
                "resourceType": "PlanDefinition",
                "status": "active",
                "title": service.name,
                "description": service.description,
                "extension": [
                    {"url": "http://wintehr.local/fhir/StructureDefinition/service-origin", "valueString": "visual-builder"},
                    {"url": "http://wintehr.local/fhir/StructureDefinition/hook-type", "valueString": service.hook_type},
                    {"url": "http://wintehr.local/fhir/StructureDefinition/hook-service-id", "valueString": service.service_id},
                    {"url": "http://wintehr.local/fhir/StructureDefinition/visual-service-id", "valueInteger": service.id},
                    {"url": "http://wintehr.local/fhir/StructureDefinition/version", "valueString": str(service.version)},
                ],
            }

            try:
                created_plan = await hapi_client.create("PlanDefinition", plan_definition)
                logger.info(f"Created PlanDefinition {created_plan.get('id')} for visual service {service.service_id}")
            except Exception as e:
                logger.error(f"Failed to create PlanDefinition: {e}")
                # Continue deployment even if HAPI FHIR creation fails

        # Update deployment status
        service.status = 'ACTIVE'
        service.last_deployed_at = datetime.utcnow()
        # Note: deployed_by field doesn't exist in schema - using deployment notes instead

        await db.commit()

        logger.info(f"Deployed visual service: {service_id} by {deployment.deployed_by}")

        return {
            "service_id": service.service_id,
            "deployed": True,
            "deployed_at": service.last_deployed_at,
            "deployed_by": deployment.deployed_by,
            "status": service.status,
            "notes": deployment.notes
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deploying visual service: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/services/{service_id}/deactivate")
async def deactivate_visual_service(
    service_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    Deactivate a deployed visual service

    Educational aspects:
    - Removes from active service registry
    - Maintains configuration for reactivation
    - Preserves analytics data
    """
    try:
        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await db.execute(query)
        service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        service.status = 'INACTIVE'

        await db.commit()

        logger.info(f"Deactivated visual service: {service_id}")

        return {
            "service_id": service_id,
            "deactivated": True,
            "status": service.status
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating visual service: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# Analytics and Monitoring

@router.get("/services/{service_id}/analytics", response_model=ServiceAnalytics)
async def get_service_analytics(
    service_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    Get analytics for a visual service

    Educational aspects:
    - Execution metrics
    - Card acceptance rates
    - Performance data
    - Usage patterns
    """
    try:
        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await db.execute(query)
        service = result.scalar_one_or_none()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found"
            )

        # Fetch from service_analytics table
        analytics_query = text("""
            SELECT total_executions, total_cards_shown, cards_accepted,
                   cards_dismissed, avg_execution_time_ms
            FROM cds_visual_builder.service_analytics
            WHERE service_id = :service_id
        """)
        analytics_result = await db.execute(analytics_query, {"service_id": service_id})
        analytics_row = analytics_result.first()

        total_executions = 0
        cards_shown = 0
        cards_accepted = 0
        cards_dismissed = 0
        avg_exec_time = 0.0

        if analytics_row:
            total_executions = analytics_row.total_executions or 0
            cards_shown = analytics_row.total_cards_shown or 0
            cards_accepted = analytics_row.cards_accepted or 0
            cards_dismissed = analytics_row.cards_dismissed or 0
            avg_exec_time = float(analytics_row.avg_execution_time_ms or 0)

        acceptance_rate = 0.0
        if cards_shown > 0:
            acceptance_rate = round((cards_accepted / cards_shown) * 100, 2)

        # Get execution counts by date from execution_logs
        exec_by_date_query = text("""
            SELECT DATE(created_at) as exec_date, COUNT(*) as count
            FROM cds_visual_builder.execution_logs
            WHERE service_id = :service_id
            GROUP BY DATE(created_at)
            ORDER BY exec_date DESC
            LIMIT 30
        """)
        exec_by_date_result = await db.execute(exec_by_date_query, {"service_id": service_id})
        execution_by_date = {
            row.exec_date.isoformat(): row.count
            for row in exec_by_date_result.fetchall()
        }

        # Get top override reasons from feedback table
        top_override_reasons = []
        try:
            override_query = text("""
                SELECT override_reason, COUNT(*) as count
                FROM cds_hooks.feedback
                WHERE service_id = :service_id
                AND outcome = 'overridden'
                AND override_reason IS NOT NULL
                GROUP BY override_reason
                ORDER BY count DESC
                LIMIT 5
            """)
            override_result = await db.execute(override_query, {"service_id": service_id})
            for row in override_result.fetchall():
                try:
                    reason = json.loads(row.override_reason) if row.override_reason else {}
                except (json.JSONDecodeError, TypeError):
                    reason = {"text": row.override_reason}
                top_override_reasons.append({"reason": reason, "count": row.count})
        except Exception:
            pass  # Feedback table may not exist yet

        return ServiceAnalytics(
            service_id=service_id,
            total_executions=total_executions,
            cards_shown=cards_shown,
            cards_accepted=cards_accepted,
            cards_dismissed=cards_dismissed,
            acceptance_rate=acceptance_rate,
            average_execution_time_ms=avg_exec_time,
            execution_by_date=execution_by_date,
            top_override_reasons=top_override_reasons
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting service analytics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# External Service Registration

@router.post("/external-services/register", response_model=ExternalServiceResponse)
async def register_external_service(
    registration: ExternalServiceRegistration,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo)
):
    """
    Register an external CDS Hooks service discovered from a remote server

    Educational aspects:
    - External service integration patterns
    - Automatic base_url derivation from full URL
    - Multi-table storage (services + cds_hooks)
    - Service discovery workflow

    The base_url field is automatically derived from the url if not provided,
    allowing frontends to send only the full service URL from discovery.

    Example:
        url: "https://sandbox-services.cds-hooks.org/patient-greeting"
        → base_url: "https://sandbox-services.cds-hooks.org" (auto-derived)
    """
    try:
        # Generate UUIDs for service records
        service_uuid = str(uuid.uuid4())
        cds_hook_uuid = str(uuid.uuid4())

        # Insert into external_services.services table
        service_insert = text("""
            INSERT INTO external_services.services
            (id, name, service_type, base_url, discovery_endpoint, auth_type, created_at)
            VALUES (:id, :name, :service_type, :base_url, :discovery_endpoint, :auth_type, NOW())
        """)

        await db.execute(service_insert, {
            "id": service_uuid,
            "name": registration.title,
            "service_type": "cds_hooks",
            "base_url": registration.base_url,  # Auto-derived by Pydantic validator
            "discovery_endpoint": f"{registration.base_url}/cds-services",
            "auth_type": "none" if not registration.credentials_id else "bearer"
        })

        # Insert into external_services.cds_hooks table
        cds_hook_insert = text("""
            INSERT INTO external_services.cds_hooks
            (id, service_id, hook_type, hook_service_id, title, description, prefetch_template, created_at)
            VALUES (:id, :service_id, :hook_type, :hook_service_id, :title, :description, :prefetch_template, NOW())
        """)

        await db.execute(cds_hook_insert, {
            "id": cds_hook_uuid,
            "service_id": service_uuid,
            "hook_type": registration.hook_type,
            "hook_service_id": registration.service_id,
            "title": registration.title,
            "description": registration.description,
            "prefetch_template": json.dumps(registration.prefetch_template) if registration.prefetch_template else None
        })

        await db.commit()

        logger.info(f"Registered external CDS service: {registration.service_id} from {registration.base_url}")

        return ExternalServiceResponse(
            id=service_uuid,
            service_id=registration.service_id,
            title=registration.title,
            hook_type=registration.hook_type,
            base_url=registration.base_url,
            url=registration.url,
            status=registration.status,
            created_at=datetime.utcnow()
        )

    except Exception as e:
        await db.rollback()
        logger.error(f"Error registering external service: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to register external service: {str(e)}")


# =============================================================================
# CQL Authoring Endpoints (Phase 1 of student CQL feature)
# =============================================================================
# Three small endpoints used by the CQL editor in CDS Studio:
#  - /cql/validate          → live syntax + reference validation via HAPI's $cql
#  - /cql/data-requirements → derive prefetch templates from CQL via $data-requirements
#  - /services/{id}/fhir-preview → show generated Library + PlanDefinition JSON


class _CQLValidateRequest(BaseModel):
    cql: str = Field(..., description="CQL expression or library text to validate")
    subject_ref: Optional[str] = Field(
        None,
        description="Optional Patient/{id} reference. If omitted, syntax-only check.",
    )


class _CQLValidateIssue(BaseModel):
    severity: str
    diagnostics: Optional[str]


class _CQLValidateResponse(BaseModel):
    ok: bool
    issues: List[_CQLValidateIssue]


@router.post("/cql/validate", response_model=_CQLValidateResponse)
async def validate_cql_text(
    body: _CQLValidateRequest,
    bridge: CQLBridge = Depends(get_cql_bridge),
    current_user: User = Depends(get_current_user_or_demo),
):
    """Run student CQL through HAPI's `$cql` to surface compile/runtime errors.

    Used by the editor to mark errors in real time. Pass `subject_ref` if the
    CQL touches FHIR retrieves; otherwise the validator only catches purely
    syntactic problems.
    """
    result = await bridge.validate_cql(body.cql, subject_ref=body.subject_ref)
    return _CQLValidateResponse(
        ok=result.ok,
        issues=[
            _CQLValidateIssue(severity=i.severity, diagnostics=i.diagnostics)
            for i in result.issues
        ],
    )


class _CQLDataReqRequest(BaseModel):
    cql: str = Field(..., description="Full CQL library text")


class _CQLDataReqResponse(BaseModel):
    prefetch: Dict[str, str] = Field(
        ..., description="CDS Hooks prefetch template, keyed by suggested name"
    )
    raw_data_requirements: List[Dict[str, Any]] = Field(
        ..., description="Raw FHIR DataRequirement[] returned by HAPI"
    )


def _data_requirements_to_prefetch(reqs: List[Dict[str, Any]]) -> Dict[str, str]:
    """Translate FHIR DataRequirement[] into CDS Hooks prefetch templates.

    Heuristic: one entry per resource type, keyed by lowercased plural type
    name. Code filters become `&code=<system>|<code>` clauses. We deliberately
    keep this conservative — students can edit the result before saving.
    """
    out: Dict[str, str] = {}
    if any((r.get("type") == "Patient") for r in reqs):
        out["patient"] = "Patient/{{context.patientId}}"

    plural = {
        "Condition": "conditions",
        "MedicationRequest": "medications",
        "MedicationStatement": "medicationStatements",
        "Observation": "observations",
        "Procedure": "procedures",
        "Encounter": "encounters",
        "AllergyIntolerance": "allergies",
        "Immunization": "immunizations",
        "DiagnosticReport": "diagnosticReports",
        "ServiceRequest": "serviceRequests",
        "CarePlan": "carePlans",
        "Goal": "goals",
    }

    for req in reqs:
        rtype = req.get("type")
        if not rtype or rtype == "Patient":
            continue
        key = plural.get(rtype, rtype[0].lower() + rtype[1:] + "s")
        if key in out:
            continue  # one prefetch per resource type, first wins
        query = f"{rtype}?patient={{{{context.patientId}}}}"
        # Append code filter clauses if present (best-effort; real syntax is
        # rich and we intentionally only handle the common shape).
        for cf in req.get("codeFilter", []) or []:
            for coding in (cf.get("code") or []):
                system = coding.get("system")
                code = coding.get("code")
                if system and code:
                    query += f"&code={system}|{code}"
        out[key] = query
    return out


@router.post("/cql/data-requirements", response_model=_CQLDataReqResponse)
async def derive_prefetch_from_cql(
    body: _CQLDataReqRequest,
    bridge: CQLBridge = Depends(get_cql_bridge),
    current_user: User = Depends(get_current_user_or_demo),
):
    """Upload student CQL as an ephemeral library, ask HAPI for its data needs,
    and translate the result into CDS Hooks prefetch templates.

    The ephemeral library uses content-hashed naming so repeated calls don't
    pollute HAPI; the dev-library cleanup script ($expunge_dev_libraries.py)
    sweeps these eventually.
    """
    from api.cds_hooks.cql_dev_helper import upload_dev_library

    try:
        library_id, _ = await upload_dev_library(body.cql, base_name="DataReqProbe")
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not upload CQL for analysis: {exc}",
        )

    try:
        reqs = await bridge.derive_data_requirements(library_id)
    except Exception as exc:
        logger.warning("data-requirements call failed for %s: %s", library_id, exc)
        raise HTTPException(
            status_code=502,
            detail=f"HAPI could not derive data requirements: {exc}",
        )

    return _CQLDataReqResponse(
        prefetch=_data_requirements_to_prefetch(reqs),
        raw_data_requirements=reqs,
    )


class _FHIRPreviewResponse(BaseModel):
    library: Optional[Dict[str, Any]]
    plan_definition: Dict[str, Any]


@router.get("/services/{service_id}/fhir-preview", response_model=_FHIRPreviewResponse)
async def get_service_fhir_preview(
    service_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
):
    """Show what the generated FHIR Library + PlanDefinition look like.

    Used by the "Advanced" tab in the CQL editor. Computed from the stored
    config — does not call HAPI. For visual-only services we skip the Library
    and only return the PlanDefinition shape.
    """
    query = select(VisualServiceConfig).where(VisualServiceConfig.service_id == service_id)
    result = await db.execute(query)
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")

    if not is_cql_service_type(service.service_type):
        raise HTTPException(
            status_code=400,
            detail="FHIR preview is only available for cql-based services",
        )

    cql = service.cql_source or ""
    detected = detect_cql_defines(cql)

    library_resource: Optional[Dict[str, Any]] = None
    if cql:
        from api.cds_hooks.cql_dev_helper import build_dev_library_resource
        library_resource = build_dev_library_resource(
            cql, base_name=f"Draft{service_id.replace('-', '_').title().replace('_', '')}"
        )

    library_canonical_url = service.library_canonical_url or (
        library_resource["url"] if library_resource else ""
    )

    plan_definition = build_plan_definition(
        service_id=service.service_id,
        name=service.name,
        description=service.description,
        hook_type=service.hook_type,
        library_canonical_url=library_canonical_url,
        card_config=service.card_config or {},
        prefetch_config=service.prefetch_config,
        detected_defines=detected,
        visual_service_db_id=service.id,
    )

    return _FHIRPreviewResponse(
        library=library_resource,
        plan_definition=plan_definition,
    )
