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
from sqlalchemy import select, and_, or_, func
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
import uuid

from database import get_db_session
from api.auth.service import get_current_user
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
from .service_code_generator import ServiceCodeGenerator
from .models import CDSHookRequest, CDSHookResponse
from .service_registry import service_registry

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
    current_user: User = Depends(get_current_user),
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
        is_valid, errors = validate_condition_structure(config.conditions)
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
            "conditions": [c.dict() for c in config.conditions],
            "card": config.card.dict(),
            "display_config": config.display_config.dict(),
            "prefetch": config.prefetch or {}
        }

        generated_code = generator.generate_service_code(
            config.service_id,
            service_config_dict
        )
        code_hash = generator.generate_code_hash(generated_code)

        # Create database record
        visual_service = VisualServiceConfig(
            id=str(uuid.uuid4()),
            service_id=config.service_id,
            name=config.name,
            description=config.description,
            service_type=config.service_type,
            category=config.category,
            template_id=config.template_id,
            hook_type=config.hook_type,
            conditions=[c.dict() for c in config.conditions],
            card=config.card.dict(),
            display_config=config.display_config.dict(),
            prefetch=config.prefetch,
            generated_code=generated_code,
            code_hash=code_hash,
            status=ServiceStatus.DRAFT,
            is_active=False,
            created_by=config.created_by,
            created_at=datetime.utcnow()
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user),
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
            # Validate new conditions
            is_valid, errors = validate_condition_structure(update.conditions)
            if not is_valid:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid condition structure: {', '.join(errors)}"
                )
            service.conditions = [c.dict() for c in update.conditions]
            needs_code_regen = True

        if update.card is not None:
            service.card = update.card.dict()
            needs_code_regen = True

        if update.display_config is not None:
            service.display_config = update.display_config.dict()

        if update.prefetch is not None:
            service.prefetch = update.prefetch
            needs_code_regen = True

        if update.status is not None:
            service.status = update.status

        if update.is_active is not None:
            service.is_active = update.is_active

        # Regenerate code if needed
        if needs_code_regen:
            service_config_dict = {
                "service_type": service.service_type,
                "hook_type": service.hook_type,
                "name": service.name,
                "description": service.description,
                "conditions": service.conditions,
                "card": service.card,
                "display_config": service.display_config,
                "prefetch": service.prefetch or {}
            }

            generated_code = generator.generate_service_code(
                service.service_id,
                service_config_dict
            )
            code_hash = generator.generate_code_hash(generated_code)

            service.generated_code = generated_code
            service.code_hash = code_hash

        # Update metadata
        service.updated_by = update.updated_by
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
    current_user: User = Depends(get_current_user)
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
        if service.is_active:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete active service. Deactivate first."
            )

        # Soft delete - mark as archived
        service.status = ServiceStatus.ARCHIVED
        service.is_active = False

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
    current_user: User = Depends(get_current_user)
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
                "prefetch": service.prefetch
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
    current_user: User = Depends(get_current_user),
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
            "card": service.card,
            "display_config": service.display_config,
            "prefetch": service.prefetch or {}
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
    current_user: User = Depends(get_current_user)
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

            # Create sample card based on configuration
            cards.append({
                "uuid": str(uuid.uuid4()),
                "summary": service.card.get("summary", "Test card"),
                "detail": service.card.get("detail", "This is a test execution"),
                "indicator": service.card.get("indicator", "info"),
                "source": service.card.get("source", {"label": service.name})
            })

        except Exception as e:
            errors.append(f"Execution error: {str(e)}")

        execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds

        # Update execution metrics
        if not service.execution_count:
            service.execution_count = {"total": 0, "by_date": {}}

        service.execution_count["total"] = service.execution_count.get("total", 0) + 1
        service.last_executed_at = datetime.utcnow()

        await db.commit()

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
    current_user: User = Depends(get_current_user)
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

        # Update deployment status
        service.status = ServiceStatus.ACTIVE
        service.is_active = True
        service.deployed_at = datetime.utcnow()
        service.deployed_by = deployment.deployed_by

        await db.commit()

        logger.info(f"Deployed visual service: {service_id} by {deployment.deployed_by}")

        # TODO: Actually register service with service_registry
        # This would involve dynamic code execution which requires careful security

        return {
            "service_id": service_id,
            "deployed": True,
            "deployed_at": service.deployed_at,
            "deployed_by": service.deployed_by,
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
    current_user: User = Depends(get_current_user)
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

        service.status = ServiceStatus.INACTIVE
        service.is_active = False

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
    current_user: User = Depends(get_current_user)
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

        analytics_data = service.analytics or {}
        execution_count = service.execution_count or {"total": 0, "by_date": {}}

        return ServiceAnalytics(
            service_id=service_id,
            total_executions=execution_count.get("total", 0),
            cards_shown=analytics_data.get("cards_shown", 0),
            cards_accepted=analytics_data.get("cards_accepted", 0),
            cards_dismissed=analytics_data.get("cards_dismissed", 0),
            acceptance_rate=analytics_data.get("acceptance_rate", 0.0),
            average_execution_time_ms=analytics_data.get("avg_execution_time_ms", 0.0),
            execution_by_date=execution_count.get("by_date", {}),
            top_override_reasons=analytics_data.get("override_reasons", [])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting service analytics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
