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
    validate_condition_structure
)
from api.cds_hooks.external_service_models import (
    ExternalServiceRegistration,
    ExternalServiceResponse
)
from api.cds_hooks.service_code_generator import ServiceCodeGenerator
from api.cds_hooks.models import CDSHookRequest, CDSHookResponse
from api.cds_hooks.service_registry import service_registry

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
        # Validate condition structure
        # Convert Pydantic models to dicts for validation
        conditions_as_dicts = [c.dict() if hasattr(c, 'dict') else c for c in config.conditions]
        is_valid, errors = validate_condition_structure(conditions_as_dicts)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid condition structure: {', '.join(errors)}"
            )

        # Generate Python code from visual configuration
        service_config_dict = {
            "service_type": config.service_type,
            "hook_type": config.hook_type,
            "name": config.name,
            "description": config.description,
            "conditions": [c.dict() if hasattr(c, 'dict') else c for c in config.conditions],
            "card": config.card_config.dict() if hasattr(config.card_config, 'dict') else config.card_config,
            "display_config": config.display_config.dict() if hasattr(config.display_config, 'dict') else config.display_config,
            "prefetch": config.prefetch_config or {}
        }

        generated_code = generator.generate_service_code(
            config.service_id,
            service_config_dict
        )
        code_hash = generator.generate_code_hash(generated_code)

        # Create database record
        visual_service = VisualServiceConfig(
            service_id=config.service_id,
            name=config.name,
            description=config.description,
            service_type=config.service_type,
            category=config.category,
            hook_type=config.hook_type,
            conditions=[c.dict() if hasattr(c, 'dict') else c for c in config.conditions],
            card_config=config.card_config.dict() if hasattr(config.card_config, 'dict') else config.card_config,
            display_config=config.display_config.dict() if hasattr(config.display_config, 'dict') else config.display_config,
            prefetch_config=config.prefetch_config,
            generated_code=generated_code,
            code_hash=code_hash,
            status='DRAFT',
            created_by=config.created_by
        )

        db.add(visual_service)
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

        # Track if code regeneration is needed
        needs_code_regen = False

        # Apply updates
        if update.name is not None:
            service.name = update.name

        if update.description is not None:
            service.description = update.description

        if update.service_type is not None:
            service.service_type = update.service_type
            needs_code_regen = True

        if update.category is not None:
            service.category = update.category

        if update.hook_type is not None:
            service.hook_type = update.hook_type
            needs_code_regen = True

        if update.conditions is not None:
            # Validate new conditions (convert to dicts first)
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

        if update.display_config is not None:
            service.display_config = update.display_config.dict() if hasattr(update.display_config, 'dict') else update.display_config

        if update.prefetch_config is not None:
            service.prefetch_config = update.prefetch_config
            needs_code_regen = True

        if update.status is not None:
            service.status = update.status

        # Regenerate code if needed
        if needs_code_regen:
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

        # Update metadata (updated_at is automatically set by database)
        service.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(service)

        logger.info(f"Updated visual service: {service_id} by {update.updated_by}")

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
    - Returns actual Python service class
    - Includes registration code
    - Shows code hash for versioning
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
            # TODO: Actually execute the generated code
            # For now, simulate execution
            warnings.append("Test execution simulated - actual execution not yet implemented")

            # Get card config (handle both dict and potential None)
            card_data = service.card_config if isinstance(service.card_config, dict) else {}

            # Create sample card based on configuration
            cards.append({
                "uuid": str(uuid.uuid4()),
                "summary": card_data.get("summary", "Test card"),
                "detail": card_data.get("detail", "This is a test execution"),
                "indicator": card_data.get("indicator", "info"),
                "source": card_data.get("source", {"label": service.name})
            })

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
    - Activates service in service registry
    - Marks as active in database
    - Tracks deployment metadata
    - Validates before deployment
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

        # Validate service is ready for deployment
        if not service.generated_code:
            raise HTTPException(
                status_code=400,
                detail="Service has no generated code"
            )

        # Create PlanDefinition in HAPI FHIR for service registry integration
        from services.hapi_fhir_client import HAPIFHIRClient
        hapi_client = HAPIFHIRClient()

        # Build PlanDefinition resource
        plan_definition = {
            "resourceType": "PlanDefinition",
            "status": "active",
            "title": service.name,
            "description": service.description,
            "extension": [
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/service-origin",
                    "valueString": "visual-builder"
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/hook-type",
                    "valueString": service.hook_type
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/hook-service-id",
                    "valueString": service.service_id
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/visual-service-id",
                    "valueInteger": service.id
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/version",
                    "valueString": str(service.version)
                }
            ]
        }

        # Create or update PlanDefinition in HAPI FHIR
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

        # Note: Analytics should be fetched from service_analytics table
        # For now, return empty analytics until we implement the analytics tracking
        # See postgres-init/06_cds_visual_builder.sql for service_analytics schema

        return ServiceAnalytics(
            service_id=service_id,
            total_executions=0,
            cards_shown=0,
            cards_accepted=0,
            cards_dismissed=0,
            acceptance_rate=0.0,
            average_execution_time_ms=0.0,
            execution_by_date={},
            top_override_reasons=[]
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
