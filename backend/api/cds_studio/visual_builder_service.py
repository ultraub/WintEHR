"""
CDS visual-builder business logic, extracted from the 1,539-line
visual_builder_router (docs/ARCHITECTURE_DEBT.md opportunity #5, last of
the four god routers).

VisualBuilderService takes the request-scoped AsyncSession plus one
injected HAPI client (default resolved via module attribute at
construction time, matching the cds_hooks service). current_user and the
ServiceCodeGenerator stay per-method parameters supplied by the router's
Depends. Bodies moved verbatim, HTTPException raises included — the same
documented fidelity compromise as the other three splits.
"""

from fastapi import Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
import logging
import re
import uuid
import json

from database import get_db_session
from api.auth.service import get_current_user_or_demo
from api.external_services.registration import insert_cds_hook_service_records
from api.auth.models import User

from .visual_service_config import (
    VisualServiceConfig,
    VisualServiceConfigCreate,
    VisualServiceConfigUpdate,
    VisualServiceConfigResponse,
    VisualValueSet,
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

from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)


async def get_code_generator() -> ServiceCodeGenerator:
    """Get service code generator instance"""
    return ServiceCodeGenerator()


# Matches `valueset "Name": '<url>'` or `valueset "Name" : "<url>"` —
# accepts single or double quotes around the URL since CQL allows both.
_VALUESET_DECL_RE = re.compile(
    r'valueset\s+"[^"]+"\s*:\s*[\'"]([^\'"]+)[\'"]'
)


async def _validate_cql_valueset_urls(cql_source: str, db: AsyncSession) -> None:
    """Reject CQL whose `valueset` declarations point at canonical URLs we
    don't have ValueSet rows for.

    The Studio derives canonical URLs as kebab-case from the ValueSet name
    (e.g. `Diabetes Mellitus` → `.../diabetes-mellitus`). LLM-generated CQL
    routinely produces no-separator forms (`.../diabetesmellitus`) following
    the prior prompt example. Without this check, the save succeeds, the
    hook fires at runtime, and the CQL retrieve resolves to an empty set —
    user-visible symptom is a silent `{"cards": []}` with no log line
    indicating the URL didn't resolve. Fail loudly at save time instead.
    """
    declared = _VALUESET_DECL_RE.findall(cql_source or "")
    if not declared:
        return

    result = await db.execute(
        select(VisualValueSet.hapi_canonical_url).where(VisualValueSet.deleted_at.is_(None))
    )
    known = {row[0] for row in result.all()}

    unresolved = [url for url in declared if url not in known]
    if unresolved:
        raise HTTPException(
            status_code=400,
            detail=(
                "CQL references ValueSet canonical URL(s) that don't match any "
                f"composed ValueSet: {unresolved}. Canonical URLs are kebab-case "
                "from the ValueSet name (e.g. 'Diabetes Mellitus' → "
                "'http://wintehr.example.org/ValueSet/diabetes-mellitus'). "
                "Compose the missing ValueSet first, or correct the URL in the CQL."
            ),
        )


# Match `valueset "Some Name": 'http://canonical/url'` declarations in CQL.
# Whitespace-tolerant; only captures the quoted name and the single-quoted URL.
_VALUESET_DECLARATION_RE = re.compile(
    r"""valueset \s+ "([^"]+)" \s* : \s* '([^']+)'""",
    re.VERBOSE,
)


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


class _FHIRPreviewResponse(BaseModel):
    library: Optional[Dict[str, Any]]
    plan_definition: Dict[str, Any]


class VisualBuilderService:
    """Visual CDS service CRUD, code generation, test/deploy, analytics."""

    def __init__(self, db: AsyncSession, hapi_client: Optional[HAPIFHIRClient] = None):
        self.db = db
        if hapi_client is None:
            from services import hapi_fhir_client as _hapi_module
            hapi_client = _hapi_module.HAPIFHIRClient()
        self.hapi = hapi_client

    async def create_visual_service(self, *, config: VisualServiceConfigCreate, current_user: User, generator: ServiceCodeGenerator):
        """Create a new visual CDS service configuration (moved verbatim from the router)."""
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
                await _validate_cql_valueset_urls(config.cql_source, self.db)
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

            self.db.add(visual_service)
            await self.db.commit()
            await self.db.refresh(visual_service)

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
                    await self.db.delete(visual_service)
                    await self.db.commit()
                    logger.error("CQL materialization failed for %s: %s", config.service_id, exc)
                    raise HTTPException(
                        status_code=502,
                        detail=f"Failed to upload CQL artifacts to HAPI: {exc}",
                    )
                visual_service.library_canonical_url = artifacts.library_canonical_url
                visual_service.plan_definition_canonical_url = artifacts.plan_definition_canonical_url
                await self.db.commit()
                await self.db.refresh(visual_service)

            logger.info(f"Created visual service: {config.service_id} by {config.created_by}")

            return visual_service

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating visual service: {e}", exc_info=True)
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    async def list_visual_services(self, *, status: Optional[ServiceStatus] = None, service_type: Optional[ServiceType] = None, search: Optional[str] = None, is_active: Optional[bool] = None, skip: int = 0, limit: int = 50, current_user: User):
        """List visual CDS service configurations with filtering (moved verbatim from the router)."""
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

            result = await self.db.execute(query)
            services = result.scalars().all()

            return services

        except Exception as e:
            logger.error(f"Error listing visual services: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))
    async def get_visual_service(self, *, service_id: str, current_user: User):
        """Get a specific visual CDS service configuration (moved verbatim from the router)."""
        try:
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await self.db.execute(query)
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
    async def get_full_edit_state(self, *, service_id: str, current_user: User):
        """Return everything the wizard needs to re-load a deployed service. (moved verbatim from the router)."""
        query = select(VisualServiceConfig).where(
            VisualServiceConfig.service_id == service_id
        )
        result = await self.db.execute(query)
        service = result.scalar_one_or_none()
        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Visual service '{service_id}' not found",
            )

        referenced: List[Dict[str, Any]] = []
        if service.cql_source:
            from .visual_service_config import VisualValueSet
            seen_urls: set = set()
            for name, canonical_url in _VALUESET_DECLARATION_RE.findall(service.cql_source):
                if canonical_url in seen_urls:
                    continue
                seen_urls.add(canonical_url)
                vs_query = select(VisualValueSet).where(
                    VisualValueSet.hapi_canonical_url == canonical_url,
                    VisualValueSet.deleted_at.is_(None),
                )
                vs_row = (await self.db.execute(vs_query)).scalar_one_or_none()
                if vs_row is not None:
                    referenced.append({
                        "name": name,
                        "canonical_url": canonical_url,
                        "vs_id": vs_row.vs_id,
                        "title": vs_row.title,
                        "description": vs_row.description,
                        "codes": vs_row.codes or [],
                    })
                else:
                    # Declared but not in our local mirror — surface it so the
                    # wizard lists it; Edit button stays disabled (vs_id null).
                    referenced.append({
                        "name": name,
                        "canonical_url": canonical_url,
                        "vs_id": None,
                        "title": None,
                        "description": None,
                        "codes": [],
                    })

        return {
            # Pydantic v2 — `model_validate` replaces v1's `from_orm`. Pairs with
            # `from_attributes=True` on VisualServiceConfigResponse.Config to read
            # the SQLAlchemy ORM object's attributes.
            "service": VisualServiceConfigResponse.model_validate(service),
            "value_sets": referenced,
        }
    async def update_visual_service(self, *, service_id: str, update: VisualServiceConfigUpdate, current_user: User, generator: ServiceCodeGenerator):
        """Update a visual CDS service configuration (moved verbatim from the router)."""
        try:
            # Get existing service
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await self.db.execute(query)
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
                await _validate_cql_valueset_urls(update.cql_source, self.db)
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

            await self.db.commit()
            await self.db.refresh(service)

            logger.info("Updated visual service: %s", service_id)

            return service

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating visual service: {e}", exc_info=True)
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    async def delete_visual_service(self, *, service_id: str, current_user: User):
        """Delete a visual CDS service configuration (moved verbatim from the router)."""
        try:
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await self.db.execute(query)
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

            # Snapshot HAPI canonicals BEFORE the commit; we'll need them after.
            plan_def_url = service.plan_definition_canonical_url
            library_url = service.library_canonical_url

            await self.db.commit()

            # Retire the corresponding HAPI artifacts so the discovery query
            # (`PlanDefinition?status=active`) stops returning this service.
            # Without this, soft-deleted services keep appearing in the
            # `/api/cds-services` listing and continue to fire — the runtime
            # never reads the local `deleted_at` column.
            #
            # Failures here are non-fatal: the DB soft-delete already happened,
            # so re-running the DELETE picks up the orphan retirement on retry.
            # An offline cleanup script can also reconcile.
            if plan_def_url or library_url:
                from services.hapi_fhir_client import HAPIFHIRClient

                hapi = self.hapi
                for resource_type, canonical_url in (
                    ("PlanDefinition", plan_def_url),
                    ("Library", library_url),
                ):
                    if not canonical_url:
                        continue
                    resource_id = canonical_url.rsplit("/", 1)[-1]
                    try:
                        resource = await hapi.read(resource_type, resource_id)
                        if resource.get("status") != "retired":
                            resource["status"] = "retired"
                            await hapi.update(resource_type, resource_id, resource)
                    except Exception as exc:
                        logger.warning(
                            "Failed to retire HAPI %s/%s for deleted service %s: %s. "
                            "DB soft-delete completed; resource may still appear in "
                            "discovery until retried or manually retired.",
                            resource_type, resource_id, service_id, exc,
                        )

            logger.info(f"Archived visual service: {service_id}")

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting visual service: {e}", exc_info=True)
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    async def get_generated_code(self, *, service_id: str, current_user: User):
        """Get the generated Python code for a visual service (moved verbatim from the router)."""
        try:
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await self.db.execute(query)
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
    async def regenerate_service_code(self, *, service_id: str, current_user: User, generator: ServiceCodeGenerator):
        """Force regeneration of service code (moved verbatim from the router)."""
        try:
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await self.db.execute(query)
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

            await self.db.commit()

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
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    async def test_visual_service(self, *, service_id: str, test_request: ServiceTestRequest, current_user: User):
        """Test a visual service with synthetic patient data (moved verbatim from the router)."""
        try:
            import time

            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await self.db.execute(query)
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

                    provider = VisualServiceProvider(self.db)
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
            # await self.db.commit()  # No changes to commit

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
    async def deploy_visual_service(self, *, service_id: str, deployment: ServiceDeploymentRequest, current_user: User):
        """Deploy a visual service to production (moved verbatim from the router)."""
        try:
            # Try to find service by ID (integer) or service_id (string)
            # Frontend passes database ID, so try that first
            service = None

            # First attempt: treat as database ID (integer)
            if service_id.isdigit():
                query = select(VisualServiceConfig).where(
                    VisualServiceConfig.id == int(service_id)
                )
                result = await self.db.execute(query)
                service = result.scalar_one_or_none()

            # Second attempt: treat as service_id (string identifier)
            if not service:
                query = select(VisualServiceConfig).where(
                    VisualServiceConfig.service_id == service_id
                )
                result = await self.db.execute(query)
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
                #
                # Use PUT to a stable id derived from service_id so each deploy
                # replaces in place rather than creating a new PlanDefinition.
                # The previous `create` path stacked one PlanDefinition per
                # deploy in HAPI, and discovery returned all of them — that's
                # why services appeared 3× on the patient chart after a few
                # redeploys. FHIR resource ids accept [A-Za-z0-9-.]{1,64}; a
                # `vb-` prefix keeps these distinct from PlanDefinitions
                # registered through other paths.
                from services.hapi_fhir_client import HAPIFHIRClient
                hapi_client = self.hapi

                plan_def_id = f"vb-{service.service_id}"
                plan_definition = {
                    "resourceType": "PlanDefinition",
                    "id": plan_def_id,
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
                    # HAPI's PUT to a known id is upsert: creates if absent,
                    # replaces if present. Same pattern as the CQL deploy path
                    # uses for its stable-identifier Library names.
                    upserted = await hapi_client.update("PlanDefinition", plan_def_id, plan_definition)
                    logger.info(
                        "Upserted PlanDefinition %s for visual service %s",
                        upserted.get('id', plan_def_id), service.service_id,
                    )
                except Exception as e:
                    logger.error(f"Failed to upsert PlanDefinition: {e}")
                    # Continue deployment even if HAPI FHIR creation fails

            # Update deployment status
            service.status = 'ACTIVE'
            service.last_deployed_at = datetime.utcnow()
            # Note: deployed_by field doesn't exist in schema - using deployment notes instead

            await self.db.commit()

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
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    async def deactivate_visual_service(self, *, service_id: str, current_user: User):
        """Deactivate a deployed visual service (moved verbatim from the router)."""
        try:
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await self.db.execute(query)
            service = result.scalar_one_or_none()

            if not service:
                raise HTTPException(
                    status_code=404,
                    detail=f"Visual service '{service_id}' not found"
                )

            service.status = 'INACTIVE'

            await self.db.commit()

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
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    async def get_service_analytics(self, *, service_id: str, current_user: User):
        """Get analytics for a visual service (moved verbatim from the router)."""
        try:
            query = select(VisualServiceConfig).where(
                VisualServiceConfig.service_id == service_id
            )
            result = await self.db.execute(query)
            service = result.scalar_one_or_none()

            if not service:
                raise HTTPException(
                    status_code=404,
                    detail=f"Visual service '{service_id}' not found"
                )

            # Aggregate everything from execution_logs — single source of truth
            # for service execution metrics. The legacy `service_analytics`
            # rollup table was dropped because nothing wrote to it.
            exec_aggregate_query = text("""
                SELECT
                    COUNT(*) AS total_executions,
                    COALESCE(SUM(cards_returned), 0) AS cards_shown,
                    COALESCE(AVG(execution_time_ms), 0)::numeric(10, 2) AS avg_execution_time_ms
                FROM cds_visual_builder.execution_logs
                WHERE service_id = :service_id
            """)
            aggregate_result = await self.db.execute(exec_aggregate_query, {"service_id": service_id})
            aggregate_row = aggregate_result.first()

            total_executions = aggregate_row.total_executions if aggregate_row else 0
            cards_shown = aggregate_row.cards_shown if aggregate_row else 0
            avg_exec_time = float(aggregate_row.avg_execution_time_ms) if aggregate_row else 0.0

            # Card-feedback counts come from cds_hooks.feedback — kept separate
            # because the feedback table tracks per-card outcomes whereas
            # execution_logs only knows how many cards were returned.
            feedback_query = text("""
                SELECT
                    COUNT(*) FILTER (WHERE outcome = 'accepted') AS cards_accepted,
                    COUNT(*) FILTER (WHERE outcome = 'overridden') AS cards_dismissed
                FROM cds_hooks.feedback
                WHERE service_id = :service_id
            """)
            cards_accepted = 0
            cards_dismissed = 0
            try:
                feedback_result = await self.db.execute(feedback_query, {"service_id": service_id})
                feedback_row = feedback_result.first()
                if feedback_row:
                    cards_accepted = feedback_row.cards_accepted or 0
                    cards_dismissed = feedback_row.cards_dismissed or 0
            except Exception:
                pass  # Feedback table may not exist yet — degrade gracefully.

            acceptance_rate = 0.0
            if cards_shown > 0:
                acceptance_rate = round((cards_accepted / cards_shown) * 100, 2)

            # Daily execution counts for the last 30 days
            exec_by_date_query = text("""
                SELECT DATE(executed_at) as exec_date, COUNT(*) as count
                FROM cds_visual_builder.execution_logs
                WHERE service_id = :service_id
                GROUP BY DATE(executed_at)
                ORDER BY exec_date DESC
                LIMIT 30
            """)
            exec_by_date_result = await self.db.execute(exec_by_date_query, {"service_id": service_id})
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
                override_result = await self.db.execute(override_query, {"service_id": service_id})
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
    async def register_external_service(self, *, registration: ExternalServiceRegistration, current_user: User):
        """Register an external CDS Hooks service discovered from a remote server (moved verbatim from the router)."""
        try:
            # Both external_services rows via the shared helper (also sets
            # status='active' — the raw insert here used to leave the schema
            # default 'pending')
            service_uuid, _ = await insert_cds_hook_service_records(
                self.db,
                name=registration.title,
                base_url=registration.base_url,  # Auto-derived by Pydantic validator
                hook_type=registration.hook_type,
                hook_service_id=registration.service_id,
                description=registration.description,
                prefetch_template=registration.prefetch_template,
                has_credentials=bool(registration.credentials_id),
            )

            await self.db.commit()

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
            await self.db.rollback()
            logger.error(f"Error registering external service: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to register external service: {str(e)}")
    async def validate_cql_text(self, *, body: _CQLValidateRequest, bridge: CQLBridge, current_user: User):
        """Run student CQL through HAPI's `$cql` to surface compile/runtime errors. (moved verbatim from the router)."""
        result = await bridge.validate_cql(body.cql, subject_ref=body.subject_ref)
        return _CQLValidateResponse(
            ok=result.ok,
            issues=[
                _CQLValidateIssue(severity=i.severity, diagnostics=i.diagnostics)
                for i in result.issues
            ],
        )
    async def derive_prefetch_from_cql(self, *, body: _CQLDataReqRequest, bridge: CQLBridge, current_user: User):
        """Upload student CQL as an ephemeral library, ask HAPI for its data needs, (moved verbatim from the router)."""
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
    async def get_service_fhir_preview(self, *, service_id: str, current_user: User):
        """Show what the generated FHIR Library + PlanDefinition look like. (moved verbatim from the router)."""
        query = select(VisualServiceConfig).where(VisualServiceConfig.service_id == service_id)
        result = await self.db.execute(query)
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


def get_visual_builder_service(db: AsyncSession = Depends(get_db_session)) -> VisualBuilderService:
    """FastAPI dependency — one service per request, sharing the request's DB session."""
    return VisualBuilderService(db=db)
