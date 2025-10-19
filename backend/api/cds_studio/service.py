"""
CDS Studio Service Layer

Business logic for CDS Management Studio operations.
"""

import json
import logging
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncpg

from .models import (
    ServiceListResponse,
    ServiceListItem,
    ServiceConfiguration,
    ServiceMetadata,
    ConfigurationView,
    ServiceBreakdown,
    CreateBuiltInServiceRequest,
    CreateExternalServiceRequest,
    TestServiceRequest,
    TestServiceResponse,
    ServiceMetrics,
    VersionHistoryResponse,
    ServiceVersion,
    RollbackRequest,
    ServiceOrigin,
    ServiceStatus,
    HookType
)
from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)


class CDSStudioService:
    """Service for CDS Studio operations"""

    def __init__(self):
        self.hapi_client = HAPIFHIRClient()

    # ========================================================================
    # Service Registry
    # ========================================================================

    async def list_services(
        self,
        hook_type: Optional[HookType] = None,
        origin: Optional[ServiceOrigin] = None,
        status: Optional[ServiceStatus] = None,
        search: Optional[str] = None
    ) -> ServiceListResponse:
        """
        Get list of all CDS services from HAPI FHIR with optional filtering.
        """
        try:
            # Build FHIR search parameters
            params = {
                "status": "active,draft",
                "_count": "100"
            }

            # Search HAPI FHIR for PlanDefinition resources
            bundle = await self.hapi_client.search("PlanDefinition", params)

            services = []
            for entry in bundle.get("entry", []):
                resource = entry.get("resource", {})

                # Extract extensions
                extensions = {
                    ext["url"].split("/")[-1]: ext.get(f"value{ext['url'].split('value')[-1] if 'value' in ext['url'] else 'String'}", ext.get("valueString", ext.get("valueCode", ext.get("valueInteger"))))
                    for ext in resource.get("extension", [])
                }

                service_origin = ServiceOrigin(extensions.get("service-origin", "built-in"))
                service_hook_type = HookType(extensions.get("hook-type", "patient-view"))
                service_id = extensions.get("hook-service-id", resource.get("id"))

                # Apply filters
                if hook_type and service_hook_type != hook_type:
                    continue
                if origin and service_origin != origin:
                    continue
                if search and search.lower() not in resource.get("title", "").lower() and search.lower() not in service_id.lower():
                    continue

                # Get metrics from database (if available)
                metrics = await self._get_service_metrics_summary(service_id)

                services.append(ServiceListItem(
                    id=int(extensions.get("external-service-id", 0)) or hash(service_id) % 10000,
                    service_id=service_id,
                    title=resource.get("title", service_id),
                    hook_type=service_hook_type,
                    origin=service_origin,
                    status=ServiceStatus(resource.get("status", "active")),
                    version=extensions.get("version", "1.0.0"),
                    last_executed=metrics.get("last_executed"),
                    execution_count_24h=metrics.get("count_24h", 0),
                    success_rate=metrics.get("success_rate", 0.0)
                ))

            return ServiceListResponse(
                services=services,
                total=len(services),
                filters_applied={
                    "hook_type": hook_type,
                    "origin": origin,
                    "status": status,
                    "search": search
                }
            )

        except Exception as e:
            logger.error(f"Failed to list services: {e}")
            raise

    async def get_service_configuration(self, service_id: str) -> Optional[ServiceConfiguration]:
        """
        Get complete configuration for a service.
        """
        try:
            # Get PlanDefinition from HAPI FHIR
            plan_def = await self._get_plan_definition(service_id)
            if not plan_def:
                return None

            # Extract metadata
            extensions = self._extract_extensions(plan_def)
            metadata = ServiceMetadata(
                service_id=service_id,
                title=plan_def.get("title", service_id),
                description=plan_def.get("description"),
                hook_type=HookType(extensions.get("hook-type", "patient-view")),
                origin=ServiceOrigin(extensions.get("service-origin", "built-in")),
                status=ServiceStatus(plan_def.get("status", "active")),
                version=extensions.get("version", "1.0.0")
            )

            # Get prefetch template
            prefetch_str = extensions.get("prefetch-template")
            prefetch_template = json.loads(prefetch_str) if prefetch_str else None

            # Get source code (for built-in services)
            source_code = None
            python_class_path = extensions.get("python-class")
            if python_class_path:
                # Try to fetch source code from database or file system
                source_code = await self._get_service_source_code(service_id)

            return ServiceConfiguration(
                metadata=metadata,
                prefetch_template=prefetch_template,
                python_class_path=python_class_path,
                source_code=source_code,
                plan_definition_id=plan_def.get("id"),
                plan_definition=plan_def
            )

        except Exception as e:
            logger.error(f"Failed to get service configuration for {service_id}: {e}")
            raise

    async def get_configuration_breakdown(self, service_id: str) -> Optional[ConfigurationView]:
        """
        Get configuration view with JSON + human-readable breakdown.
        """
        try:
            plan_def = await self._get_plan_definition(service_id)
            if not plan_def:
                return None

            extensions = self._extract_extensions(plan_def)
            service_origin = extensions.get("service-origin", "built-in")
            hook_type = extensions.get("hook-type", "patient-view")

            # Build breakdown
            breakdown = ServiceBreakdown(
                service_origin=service_origin,
                service_origin_explanation=self._get_origin_explanation(service_origin),
                hook_type=hook_type,
                hook_type_description=self._get_hook_description(hook_type),
                execution_method=self._get_execution_method(service_origin),
                execution_details=self._get_execution_details(service_origin, extensions),
                prefetch_summary=self._get_prefetch_summary(extensions.get("prefetch-template")),
                extensions=[
                    {
                        "url": ext["url"],
                        "value": ext.get("valueString") or ext.get("valueCode") or ext.get("valueInteger"),
                        "description": self._get_extension_description(ext["url"])
                    }
                    for ext in plan_def.get("extension", [])
                ]
            )

            return ConfigurationView(
                plan_definition_json=plan_def,
                breakdown=breakdown
            )

        except Exception as e:
            logger.error(f"Failed to get configuration breakdown for {service_id}: {e}")
            raise

    # ========================================================================
    # Service Creation
    # ========================================================================

    async def create_built_in_service(self, request: CreateBuiltInServiceRequest) -> Dict[str, Any]:
        """
        Create a new built-in CDS service.
        """
        try:
            # Validate service ID uniqueness
            existing = await self._get_plan_definition(request.service_id)
            if existing:
                raise ValueError(f"Service {request.service_id} already exists")

            # Validate Python code syntax
            await self._validate_python_code(request.source_code)

            # Create PlanDefinition
            plan_def = self._build_plan_definition(
                service_id=request.service_id,
                title=request.title,
                description=request.description,
                hook_type=request.hook_type,
                prefetch_template=request.prefetch_template,
                service_origin="built-in",
                python_class_path=f"api.cds_studio.custom_services.{request.service_id}",
                version=request.status.value if request.status == ServiceStatus.ACTIVE else "1.0.0"
            )

            # Save to HAPI FHIR
            created_plan_def = await self.hapi_client.create_resource("PlanDefinition", plan_def)

            # Save source code to database
            await self._save_service_source_code(
                service_id=request.service_id,
                source_code=request.source_code,
                version="1.0.0",
                notes=request.version_notes
            )

            return {
                "service_id": request.service_id,
                "plan_definition_id": created_plan_def.get("id"),
                "version": "1.0.0"
            }

        except Exception as e:
            logger.error(f"Failed to create built-in service: {e}")
            raise

    async def create_external_service(self, request: CreateExternalServiceRequest) -> Dict[str, Any]:
        """
        Register an external CDS service.
        """
        try:
            # Validate service ID uniqueness
            existing = await self._get_plan_definition(request.service_id)
            if existing:
                raise ValueError(f"Service {request.service_id} already exists")

            # Create PlanDefinition with external origin
            plan_def = self._build_plan_definition(
                service_id=request.service_id,
                title=request.title,
                description=request.description,
                hook_type=request.hook_type,
                prefetch_template=request.prefetch_template,
                service_origin="external",
                base_url=request.base_url,
                credential_id=request.credential_id
            )

            # Save to HAPI FHIR
            created_plan_def = await self.hapi_client.create_resource("PlanDefinition", plan_def)

            return {
                "service_id": request.service_id,
                "plan_definition_id": created_plan_def.get("id")
            }

        except Exception as e:
            logger.error(f"Failed to create external service: {e}")
            raise

    # ========================================================================
    # Service Testing
    # ========================================================================

    async def test_service(self, service_id: str, request: TestServiceRequest, db) -> TestServiceResponse:
        """
        Test a CDS service in sandbox mode.

        Args:
            service_id: The CDS service ID to test
            request: Test request with patient context
            db: Database session for CDS hooks execution
        """
        import time
        from api.cds_hooks.models import CDSHookRequest

        try:
            # Get service configuration
            config = await self.get_service_configuration(service_id)
            if not config:
                raise ValueError(f"Service {service_id} not found")

            # Build hook context
            context = {
                "patientId": request.patient_id,
                "userId": request.user_id or "Practitioner/test",
                "encounterId": request.encounter_id
            }
            if request.context_override:
                context.update(request.context_override)

            # Build hook request
            hook_request = CDSHookRequest(
                hook=config.metadata.hook_type.value,
                hookInstance=str(uuid.uuid4()),  # Generate valid UUID
                context=context,
                prefetch=request.prefetch_override
            )

            # Execute service (using existing CDS hooks infrastructure)
            from api.cds_hooks.cds_hooks_router import execute_service

            start_time = time.time()
            logs = []
            errors = []

            try:
                response = await execute_service(service_id, hook_request, db)
                execution_time_ms = int((time.time() - start_time) * 1000)

                # Convert Pydantic model to dict if necessary
                if hasattr(response, 'dict'):
                    response_dict = response.dict()
                    cards = response_dict.get("cards", [])
                elif hasattr(response, 'cards'):
                    cards = response.cards if response.cards else []
                else:
                    cards = response.get("cards", []) if isinstance(response, dict) else []

                return TestServiceResponse(
                    success=True,
                    execution_time_ms=execution_time_ms,
                    cards=cards,
                    prefetch_data=hook_request.prefetch,
                    logs=logs,
                    errors=errors
                )

            except Exception as e:
                execution_time_ms = int((time.time() - start_time) * 1000)
                errors.append(str(e))

                return TestServiceResponse(
                    success=False,
                    execution_time_ms=execution_time_ms,
                    cards=[],
                    prefetch_data=hook_request.prefetch,
                    logs=logs,
                    errors=errors
                )

        except Exception as e:
            logger.error(f"Failed to test service {service_id}: {e}")
            raise

    # ========================================================================
    # Helper Methods
    # ========================================================================

    async def _get_plan_definition(self, service_id: str) -> Optional[Dict[str, Any]]:
        """Get PlanDefinition from HAPI FHIR by service ID"""
        try:
            # Search by service-id extension or by resource ID
            bundle = await self.hapi_client.search("PlanDefinition", {"_id": service_id})
            if bundle.get("total", 0) > 0:
                return bundle["entry"][0]["resource"]
            return None
        except:
            return None

    def _extract_extensions(self, plan_def: Dict[str, Any]) -> Dict[str, Any]:
        """Extract extensions from PlanDefinition into a dict"""
        extensions = {}
        for ext in plan_def.get("extension", []):
            key = ext["url"].split("/")[-1]
            value = (
                ext.get("valueString") or
                ext.get("valueCode") or
                ext.get("valueInteger") or
                ext.get("valueBoolean")
            )
            extensions[key] = value
        return extensions

    def _build_plan_definition(
        self,
        service_id: str,
        title: str,
        description: Optional[str],
        hook_type: HookType,
        prefetch_template: Optional[Dict[str, str]],
        service_origin: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Build a PlanDefinition resource"""
        plan_def = {
            "resourceType": "PlanDefinition",
            "id": service_id,
            "status": "active",
            "title": title,
            "description": description or "",
            "extension": [
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/service-origin",
                    "valueString": service_origin
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/hook-type",
                    "valueCode": hook_type.value
                },
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/hook-service-id",
                    "valueString": service_id
                }
            ]
        }

        # Add prefetch template
        if prefetch_template:
            plan_def["extension"].append({
                "url": "http://wintehr.local/fhir/StructureDefinition/prefetch-template",
                "valueString": json.dumps(prefetch_template)
            })

        # Add origin-specific extensions
        if service_origin == "built-in" and kwargs.get("python_class_path"):
            plan_def["extension"].append({
                "url": "http://wintehr.local/fhir/StructureDefinition/python-class",
                "valueString": kwargs["python_class_path"]
            })

        if service_origin == "external":
            if kwargs.get("base_url"):
                plan_def["extension"].append({
                    "url": "http://wintehr.local/fhir/StructureDefinition/external-url",
                    "valueString": kwargs["base_url"]
                })
            if kwargs.get("credential_id"):
                plan_def["extension"].append({
                    "url": "http://wintehr.local/fhir/StructureDefinition/credential-id",
                    "valueInteger": kwargs["credential_id"]
                })

        return plan_def

    async def _validate_python_code(self, code: str):
        """Validate Python code syntax"""
        import ast
        try:
            ast.parse(code)
        except SyntaxError as e:
            raise ValueError(f"Invalid Python syntax: {str(e)}")

    async def _save_service_source_code(
        self,
        service_id: str,
        source_code: str,
        version: str,
        notes: Optional[str] = None
    ):
        """Save service source code to database"""
        # TODO: Implement database storage
        pass

    async def _get_service_source_code(self, service_id: str) -> Optional[str]:
        """Get service source code from database"""
        # TODO: Implement database retrieval
        return None

    async def _get_service_metrics_summary(self, service_id: str) -> Dict[str, Any]:
        """Get summary metrics for a service"""
        # TODO: Query service_executions table
        return {
            "last_executed": None,
            "count_24h": 0,
            "success_rate": 0.0
        }

    def _get_origin_explanation(self, origin: str) -> str:
        """Get human-readable explanation of service origin"""
        explanations = {
            "built-in": "This service runs within WintEHR using Python code. Executes via LocalServiceProvider.",
            "external": "This service is hosted externally and called via HTTP. Executes via RemoteServiceProvider.",
            "custom": "This is a custom service created in CDS Studio."
        }
        return explanations.get(origin, "Unknown service origin")

    def _get_hook_description(self, hook_type: str) -> str:
        """Get description of hook type"""
        descriptions = {
            "patient-view": "Fires when a clinician opens a patient's chart",
            "medication-prescribe": "Fires when a clinician prescribes a medication",
            "order-select": "Fires when a clinician selects an order",
            "order-sign": "Fires when a clinician signs an order",
            "encounter-start": "Fires when an encounter begins",
            "encounter-discharge": "Fires when a patient is being discharged"
        }
        return descriptions.get(hook_type, "Unknown hook type")

    def _get_execution_method(self, origin: str) -> str:
        """Get execution method description"""
        if origin == "built-in":
            return "LocalServiceProvider"
        elif origin == "external":
            return "RemoteServiceProvider"
        return "Unknown"

    def _get_execution_details(self, origin: str, extensions: Dict[str, Any]) -> str:
        """Get detailed execution information"""
        if origin == "built-in":
            python_class = extensions.get("python-class", "Not specified")
            return f"Python class: {python_class}"
        elif origin == "external":
            base_url = extensions.get("external-url", "Not specified")
            return f"External URL: {base_url}"
        return "No execution details available"

    def _get_prefetch_summary(self, prefetch_str: Optional[str]) -> Optional[str]:
        """Get summary of prefetch template"""
        if not prefetch_str:
            return None
        try:
            prefetch = json.loads(prefetch_str)
            return f"{len(prefetch)} prefetch queries defined: {', '.join(prefetch.keys())}"
        except:
            return "Invalid prefetch template"

    def _get_extension_description(self, url: str) -> str:
        """Get description of FHIR extension"""
        descriptions = {
            "service-origin": "Source of the service (built-in, external, custom)",
            "hook-type": "CDS Hooks hook type that triggers this service",
            "hook-service-id": "Unique identifier for the service",
            "python-class": "Python class path for built-in service execution",
            "external-url": "Base URL for external service HTTP calls",
            "credential-id": "ID of credentials used for authentication",
            "prefetch-template": "FHIR queries to pre-fetch data before service execution"
        }
        key = url.split("/")[-1]
        return descriptions.get(key, "Custom extension")

    # Stub methods for remaining functionality
    async def get_service_metrics(self, service_id: str) -> Optional[ServiceMetrics]:
        """Get detailed metrics - TODO: Implement"""
        return None

    async def update_service_status(self, service_id: str, status: ServiceStatus):
        """Update service status - TODO: Implement"""
        pass

    async def delete_service(self, service_id: str, hard_delete: bool = False):
        """Delete service - TODO: Implement"""
        pass

    async def get_version_history(self, service_id: str) -> Optional[VersionHistoryResponse]:
        """Get version history - TODO: Implement"""
        return None

    async def rollback_service(self, service_id: str, request: RollbackRequest) -> Dict[str, Any]:
        """Rollback to previous version - TODO: Implement"""
        return {"new_version": "1.0.0"}
