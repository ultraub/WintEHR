"""
External Services Business Logic

Handles registration, management, and execution of external FHIR services.
Integrates with HAPI FHIR for standards-compliant resource management.
"""

from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.sql import text
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError
from datetime import datetime, timedelta
import httpx
import logging
import json
import hashlib
import hmac
from cryptography.fernet import Fernet, InvalidToken
import base64
import os

from shared.exceptions import (
    DatabaseQueryError,
    FHIRConnectionError,
    FHIRResourceNotFoundError,
)

from .models import (
    ExternalServiceCreate,
    ExternalServiceUpdate,
    ExternalServiceResponse,
    ServiceType,
    ServiceStatus,
    HealthStatus,
    CDSHooksServiceCreate,
    CDSHooksServiceResponse,
    SMARTAppCreate,
    SubscriptionCreate,
    ServiceListFilter,
    HealthCheckResult,
    ServiceExecutionLog,
    # Multi-hook registration models
    BatchCDSHooksServiceCreate,
    BatchCDSHooksServiceResponse,
    IncrementalHookAdd,
    CDSHookConfig
)

logger = logging.getLogger(__name__)


class EncryptionService:
    """Handle encryption/decryption of sensitive credentials"""

    def __init__(self):
        # Get encryption key from environment or generate one
        key = os.getenv('ENCRYPTION_KEY')
        if not key:
            # Generate a key for development (in production, use proper key management)
            key = Fernet.generate_key().decode()
            logger.warning("No ENCRYPTION_KEY set, using generated key (not suitable for production)")
        self.cipher = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, data: Dict[str, Any]) -> str:
        """Encrypt dictionary to encrypted string"""
        json_data = json.dumps(data)
        return self.cipher.encrypt(json_data.encode()).decode()

    def decrypt(self, encrypted_data: str) -> Dict[str, Any]:
        """Decrypt string to dictionary"""
        decrypted = self.cipher.decrypt(encrypted_data.encode()).decode()
        return json.loads(decrypted)


class ExternalServiceRegistry:
    """External service registration and management"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.encryption = EncryptionService()
        self.hapi_base_url = os.getenv('HAPI_FHIR_URL', 'http://hapi-fhir:8080/fhir')

    async def register_service(
        self,
        service_data: ExternalServiceCreate,
        user_id: Optional[str] = None
    ) -> Tuple[str, Optional[str]]:
        """
        Register new external service

        Returns:
            Tuple of (service_id, fhir_resource_id)
        """
        try:
            # Encrypt credentials if provided
            credentials_encrypted = None
            if service_data.credentials:
                credentials_encrypted = self.encryption.encrypt(service_data.credentials)

            # Create service record
            service_id = await self._create_service_record(
                service_data,
                credentials_encrypted,
                user_id
            )

            # Create corresponding FHIR resource in HAPI if applicable
            fhir_resource_id = None
            if service_data.service_type == ServiceType.CDS_HOOKS:
                fhir_resource_id = await self._create_plan_definition(service_id, service_data)
            elif service_data.service_type == ServiceType.CQL_LIBRARY:
                fhir_resource_id = await self._create_library_resource(service_id, service_data)
            elif service_data.service_type == ServiceType.SUBSCRIPTION:
                fhir_resource_id = await self._create_subscription_resource(service_id, service_data)

            # Update service with FHIR resource ID
            if fhir_resource_id:
                await self._update_fhir_resource_link(service_id, fhir_resource_id)

            logger.info(f"Registered external service: {service_id}, FHIR resource: {fhir_resource_id}")
            return service_id, fhir_resource_id

        except (SQLAlchemyError, OperationalError, IntegrityError) as e:
            logger.error(f"Database error registering external service: {e}")
            raise DatabaseQueryError(message="Failed to register external service", cause=e)
        except httpx.HTTPStatusError as e:
            logger.error(f"FHIR server error registering external service: {e.response.status_code}")
            raise FHIRConnectionError(message="FHIR server error during registration", cause=e)
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Connection error registering external service: {e}")
            raise FHIRConnectionError(message="Connection error during registration", cause=e)
        except InvalidToken as e:
            logger.error(f"Encryption error registering external service: {e}")
            raise ValueError(f"Invalid encryption credentials: {e}")
        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error(f"Data error registering external service: {e}")
            raise

    async def _create_service_record(
        self,
        service_data: ExternalServiceCreate,
        credentials_encrypted: Optional[str],
        user_id: Optional[str]
    ) -> str:
        """Create service record in database"""
        query = text("""
            INSERT INTO external_services.services (
                name, description, service_type, base_url, auth_type,
                credentials_encrypted, owner_user_id, tags, version, status
            ) VALUES (
                :name, :description, :service_type, :base_url, :auth_type,
                :credentials, :owner_user_id, :tags, :version, :status
            )
            RETURNING id
        """)

        result = await self.db.execute(query, {
            "name": service_data.name,
            "description": service_data.description,
            "service_type": service_data.service_type.value,
            "base_url": str(service_data.base_url) if service_data.base_url else None,
            "auth_type": service_data.auth_type.value,
            "credentials": credentials_encrypted,
            "owner_user_id": user_id or service_data.owner_user_id,
            "tags": service_data.tags or [],
            "version": service_data.version,
            "status": ServiceStatus.PENDING.value
        })

        await self.db.commit()
        service_id = result.scalar_one()
        return str(service_id)

    async def _create_plan_definition(
        self,
        service_id: str,
        service_data: CDSHooksServiceCreate
    ) -> Optional[str]:
        """Create PlanDefinition resource in HAPI FHIR for CDS Hooks service"""
        try:
            cds_config = service_data.cds_config

            plan_definition = {
                "resourceType": "PlanDefinition",
                "url": f"{service_data.base_url}/{cds_config.hook_service_id}",
                "name": service_data.name.replace(" ", "_"),
                "title": cds_config.title or service_data.name,
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/plan-definition-type",
                        "code": "eca-rule",
                        "display": "ECA Rule"
                    }]
                },
                "status": "draft",
                "description": cds_config.description or service_data.description,
                "purpose": cds_config.usage_requirements,
                "usage": f"CDS Hooks service: {cds_config.hook_type}",
                # Store service metadata in extension
                "extension": [{
                    "url": "http://wintehr.com/fhir/StructureDefinition/external-service",
                    "valueString": service_id
                }, {
                    "url": "http://wintehr.com/fhir/StructureDefinition/hook-type",
                    "valueString": cds_config.hook_type
                }, {
                    "url": "http://wintehr.com/fhir/StructureDefinition/hook-service-id",
                    "valueString": cds_config.hook_service_id
                }],
                # Store prefetch template in extension
                "action": [{
                    "trigger": [{
                        "type": "named-event",
                        "name": cds_config.hook_type
                    }],
                    "title": "Execute CDS Hook",
                    "description": f"Invoke external service at {service_data.base_url}"
                }]
            }

            # Add prefetch template if provided
            if cds_config.prefetch_template:
                plan_definition["extension"].append({
                    "url": "http://wintehr.com/fhir/StructureDefinition/prefetch-template",
                    "valueString": json.dumps(cds_config.prefetch_template)
                })

            # POST to HAPI FHIR
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.hapi_base_url}/PlanDefinition",
                    json=plan_definition,
                    headers={"Content-Type": "application/fhir+json"},
                    timeout=10.0
                )

                if response.status_code in [200, 201]:
                    created_resource = response.json()
                    return created_resource.get("id")
                else:
                    logger.error(f"Failed to create PlanDefinition: {response.status_code} {response.text}")
                    return None

        except httpx.HTTPStatusError as e:
            logger.error(f"FHIR server error creating PlanDefinition: {e.response.status_code}")
            return None
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Connection error creating PlanDefinition: {e}")
            return None
        except (ValueError, TypeError, KeyError, AttributeError, json.JSONDecodeError) as e:
            logger.error(f"Data error creating PlanDefinition: {e}")
            return None

    async def _create_library_resource(
        self,
        service_id: str,
        service_data: ExternalServiceCreate
    ) -> Optional[str]:
        """Create Library resource in HAPI FHIR for CQL library"""
        # Placeholder for CQL Library creation
        # Implementation depends on specific requirements
        logger.info(f"CQL Library creation not yet implemented for service {service_id}")
        return None

    async def _create_subscription_resource(
        self,
        service_id: str,
        service_data: SubscriptionCreate
    ) -> Optional[str]:
        """Create Subscription resource in HAPI FHIR"""
        try:
            sub_config = service_data.subscription_config

            subscription = {
                "resourceType": "Subscription",
                "status": "requested",
                "reason": service_data.description or f"External service subscription: {service_data.name}",
                "criteria": sub_config.criteria or f"SubscriptionTopic/{sub_config.subscription_topic}",
                "channel": {
                    "type": sub_config.channel_type.value,
                    "endpoint": str(sub_config.webhook_url),
                    "payload": "application/fhir+json",
                    "header": []
                },
                "extension": [{
                    "url": "http://wintehr.com/fhir/StructureDefinition/external-service",
                    "valueString": service_id
                }]
            }

            # Add authentication header if configured
            if service_data.auth_type != "none" and service_data.credentials:
                # Add authorization header based on auth type
                if service_data.auth_type == "api_key":
                    subscription["channel"]["header"].append(
                        f"Authorization: Bearer {service_data.credentials.get('api_key', '')}"
                    )

            # POST to HAPI FHIR
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.hapi_base_url}/Subscription",
                    json=subscription,
                    headers={"Content-Type": "application/fhir+json"},
                    timeout=10.0
                )

                if response.status_code in [200, 201]:
                    created_resource = response.json()
                    return created_resource.get("id")
                else:
                    logger.error(f"Failed to create Subscription: {response.status_code} {response.text}")
                    return None

        except httpx.HTTPStatusError as e:
            logger.error(f"FHIR server error creating Subscription: {e.response.status_code}")
            return None
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Connection error creating Subscription: {e}")
            return None
        except (ValueError, TypeError, KeyError, AttributeError, json.JSONDecodeError) as e:
            logger.error(f"Data error creating Subscription: {e}")
            return None

    async def _update_fhir_resource_link(self, service_id: str, fhir_resource_id: str):
        """Update service record with FHIR resource ID"""
        query = text("""
            UPDATE external_services.services
            SET fhir_resource_id = :fhir_id
            WHERE id = :service_id
        """)

        await self.db.execute(query, {
            "service_id": service_id,
            "fhir_id": fhir_resource_id
        })
        await self.db.commit()

    async def get_service(self, service_id: str) -> Optional[Dict[str, Any]]:
        """Get service by ID"""
        query = text("""
            SELECT * FROM external_services.services
            WHERE id = :service_id
        """)

        result = await self.db.execute(query, {"service_id": service_id})
        row = result.fetchone()

        if row:
            return dict(row._mapping)
        return None

    async def list_services(
        self,
        filters: Optional[ServiceListFilter] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        List services with optional filters

        Returns:
            Tuple of (services, total_count)
        """
        conditions = []
        params = {}

        if filters:
            if filters.service_type:
                conditions.append("service_type = :service_type")
                params["service_type"] = filters.service_type.value

            if filters.status:
                conditions.append("status = :status")
                params["status"] = filters.status.value

            if filters.health_status:
                conditions.append("health_status = :health_status")
                params["health_status"] = filters.health_status.value

            if filters.search:
                conditions.append("(name ILIKE :search OR description ILIKE :search)")
                params["search"] = f"%{filters.search}%"

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        # Get total count
        count_query = text(f"""
            SELECT COUNT(*) FROM external_services.services
            WHERE {where_clause}
        """)

        count_result = await self.db.execute(count_query, params)
        total = count_result.scalar_one()

        # Get paginated results
        offset = (page - 1) * page_size
        params["limit"] = page_size
        params["offset"] = offset

        query = text(f"""
            SELECT * FROM external_services.services
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await self.db.execute(query, params)
        services = [dict(row._mapping) for row in result.fetchall()]

        return services, total

    async def update_service(
        self,
        service_id: str,
        update_data: ExternalServiceUpdate
    ) -> bool:
        """Update service"""
        update_fields = []
        params = {"service_id": service_id}

        if update_data.name is not None:
            update_fields.append("name = :name")
            params["name"] = update_data.name

        if update_data.description is not None:
            update_fields.append("description = :description")
            params["description"] = update_data.description

        if update_data.base_url is not None:
            update_fields.append("base_url = :base_url")
            params["base_url"] = str(update_data.base_url)

        if update_data.status is not None:
            update_fields.append("status = :status")
            params["status"] = update_data.status.value

        if update_data.credentials is not None:
            credentials_encrypted = self.encryption.encrypt(update_data.credentials)
            update_fields.append("credentials_encrypted = :credentials")
            params["credentials"] = credentials_encrypted

        if not update_fields:
            return False

        update_fields.append("updated_at = CURRENT_TIMESTAMP")

        query = text(f"""
            UPDATE external_services.services
            SET {', '.join(update_fields)}
            WHERE id = :service_id
        """)

        await self.db.execute(query, params)
        await self.db.commit()
        return True

    async def delete_service(self, service_id: str) -> bool:
        """Delete service and associated FHIR resource"""
        try:
            # Get service info
            service = await self.get_service(service_id)
            if not service:
                return False

            # Delete FHIR resource if exists
            if service.get('fhir_resource_id') and service.get('fhir_resource_type'):
                await self._delete_fhir_resource(
                    service['fhir_resource_type'],
                    service['fhir_resource_id']
                )

            # Delete service record (cascade will delete related records)
            query = text("""
                DELETE FROM external_services.services
                WHERE id = :service_id
            """)

            await self.db.execute(query, {"service_id": service_id})
            await self.db.commit()
            return True

        except (SQLAlchemyError, OperationalError, IntegrityError) as e:
            logger.error(f"Database error deleting service {service_id}: {e}")
            return False
        except httpx.HTTPStatusError as e:
            logger.error(f"FHIR server error deleting service {service_id}: {e.response.status_code}")
            return False
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Connection error deleting service {service_id}: {e}")
            return False

    async def _delete_fhir_resource(self, resource_type: str, resource_id: str):
        """Delete FHIR resource from HAPI"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.hapi_base_url}/{resource_type}/{resource_id}",
                    timeout=10.0
                )

                if response.status_code not in [200, 204]:
                    logger.warning(f"Failed to delete FHIR resource {resource_type}/{resource_id}: {response.status_code}")

        except httpx.HTTPStatusError as e:
            logger.error(f"FHIR server error deleting resource {resource_type}/{resource_id}: {e.response.status_code}")
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Connection error deleting FHIR resource {resource_type}/{resource_id}: {e}")

    async def health_check(self, service_id: str) -> HealthCheckResult:
        """Perform health check on external service"""
        service = await self.get_service(service_id)
        if not service:
            return HealthCheckResult(
                service_id=service_id,
                status=HealthStatus.UNKNOWN,
                timestamp=datetime.utcnow(),
                error_message="Service not found"
            )

        start_time = datetime.utcnow()

        try:
            # Attempt to connect to service
            base_url = service.get('base_url')
            if not base_url:
                return HealthCheckResult(
                    service_id=service_id,
                    status=HealthStatus.UNKNOWN,
                    timestamp=datetime.utcnow(),
                    error_message="No base URL configured"
                )

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{base_url}/health",
                    timeout=5.0
                )

                response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                if response.status_code == 200:
                    status = HealthStatus.HEALTHY
                elif 200 <= response.status_code < 300:
                    status = HealthStatus.HEALTHY
                elif 500 <= response.status_code < 600:
                    status = HealthStatus.UNHEALTHY
                else:
                    status = HealthStatus.DEGRADED

                # Update health status in database
                await self._update_health_status(service_id, status)

                return HealthCheckResult(
                    service_id=service_id,
                    status=status,
                    response_time_ms=response_time_ms,
                    timestamp=datetime.utcnow()
                )

        except httpx.TimeoutException:
            await self._update_health_status(service_id, HealthStatus.UNHEALTHY)
            return HealthCheckResult(
                service_id=service_id,
                status=HealthStatus.UNHEALTHY,
                timestamp=datetime.utcnow(),
                error_message="Health check timeout"
            )
        except httpx.HTTPStatusError as e:
            await self._update_health_status(service_id, HealthStatus.UNHEALTHY)
            return HealthCheckResult(
                service_id=service_id,
                status=HealthStatus.UNHEALTHY,
                timestamp=datetime.utcnow(),
                error_message=f"HTTP error: {e.response.status_code}"
            )
        except httpx.RequestError as e:
            await self._update_health_status(service_id, HealthStatus.UNHEALTHY)
            return HealthCheckResult(
                service_id=service_id,
                status=HealthStatus.UNHEALTHY,
                timestamp=datetime.utcnow(),
                error_message=f"Connection error: {e}"
            )
        except (SQLAlchemyError, OperationalError, IntegrityError) as e:
            logger.error(f"Database error during health check for service {service_id}: {e}")
            return HealthCheckResult(
                service_id=service_id,
                status=HealthStatus.UNKNOWN,
                timestamp=datetime.utcnow(),
                error_message=f"Database error: {e}"
            )

    async def _update_health_status(self, service_id: str, status: HealthStatus):
        """Update service health status"""
        query = text("""
            UPDATE external_services.services
            SET health_status = :status, last_health_check = CURRENT_TIMESTAMP
            WHERE id = :service_id
        """)

        await self.db.execute(query, {
            "service_id": service_id,
            "status": status.value
        })
        await self.db.commit()

    # ========================================================================
    # Multi-Hook Registration Methods
    # ========================================================================

    async def register_batch_cds_service(
        self,
        service_data: BatchCDSHooksServiceCreate,
        user_id: Optional[str] = None
    ) -> Tuple[str, List[str]]:
        """
        Register CDS Hooks service with multiple hook types (batch registration)

        Creates:
        1. One database service record
        2. Multiple PlanDefinition resources in HAPI (one per hook)
        3. Multiple cds_hooks table entries

        Args:
            service_data: Batch service creation data with multiple hooks
            user_id: User registering the service

        Returns:
            Tuple of (service_id, list of HAPI PlanDefinition IDs)
        """
        try:
            logger.info(f"Batch registering service: {service_data.name} with {len(service_data.cds_configs)} hooks")

            # Encrypt credentials if provided
            credentials_encrypted = None
            if service_data.credentials:
                credentials_encrypted = self.encryption.encrypt(service_data.credentials)

            # Create main service record
            service_id = await self._create_service_record(
                service_data,
                credentials_encrypted,
                user_id
            )

            # Store discovery endpoint if provided
            if service_data.discovery_endpoint:
                await self._store_discovery_endpoint(service_id, str(service_data.discovery_endpoint))

            # Create PlanDefinition and hook record for each hook type
            plan_definition_ids = []

            for cds_config in service_data.cds_configs:
                # Create PlanDefinition in HAPI FHIR
                plan_def_id = await self._create_plan_definition_for_hook(
                    service_id,
                    service_data,
                    cds_config
                )

                if plan_def_id:
                    plan_definition_ids.append(plan_def_id)

                    # Store hook configuration in database
                    await self._store_cds_hook_config(
                        service_id,
                        cds_config,
                        plan_def_id
                    )

            # Update service with first FHIR resource ID (for legacy compatibility)
            if plan_definition_ids:
                await self._update_fhir_resource_link(service_id, plan_definition_ids[0])

            # Update service status to active
            await self._update_service_status(service_id, ServiceStatus.ACTIVE)

            logger.info(
                f"Successfully batch registered service {service_id} "
                f"with {len(plan_definition_ids)} PlanDefinitions"
            )

            return service_id, plan_definition_ids

        except (SQLAlchemyError, OperationalError, IntegrityError) as e:
            logger.error(f"Database error in batch CDS registration: {e}")
            raise DatabaseQueryError(message="Failed to register batch CDS service", cause=e)
        except httpx.HTTPStatusError as e:
            logger.error(f"FHIR server error in batch CDS registration: {e.response.status_code}")
            raise FHIRConnectionError(message="FHIR server error during batch registration", cause=e)
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Connection error in batch CDS registration: {e}")
            raise FHIRConnectionError(message="Connection error during batch registration", cause=e)
        except InvalidToken as e:
            logger.error(f"Encryption error in batch CDS registration: {e}")
            raise ValueError(f"Invalid encryption credentials: {e}")
        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error(f"Data error in batch CDS registration: {e}")
            raise

    async def add_hook_to_service(
        self,
        service_id: str,
        hook_config: CDSHookConfig,
        user_id: Optional[str] = None
    ) -> str:
        """
        Add new hook to existing CDS Hooks service (incremental registration)

        Args:
            service_id: Existing service ID
            hook_config: New hook configuration
            user_id: User adding the hook

        Returns:
            PlanDefinition ID in HAPI FHIR
        """
        try:
            logger.info(f"Adding hook {hook_config.hook_type} to service {service_id}")

            # Get service record
            service = await self.get_service(service_id)
            if not service:
                raise ValueError(f"Service {service_id} not found")

            # Check if hook already exists
            existing_hook = await self._check_existing_hook(service_id, hook_config.hook_service_id)
            if existing_hook:
                raise ValueError(
                    f"Hook {hook_config.hook_service_id} already exists for service {service_id}"
                )

            # Create minimal service data for PlanDefinition creation
            service_data = CDSHooksServiceCreate(
                name=service.name,
                description=service.description,
                service_type=ServiceType.CDS_HOOKS,
                base_url=service.base_url,
                auth_type=service.auth_type,
                cds_config=hook_config
            )

            # Create PlanDefinition in HAPI FHIR
            plan_def_id = await self._create_plan_definition_for_hook(
                service_id,
                service_data,
                hook_config
            )

            if not plan_def_id:
                raise FHIRConnectionError(message="Failed to create PlanDefinition in HAPI FHIR")

            # Store hook configuration in database
            await self._store_cds_hook_config(
                service_id,
                hook_config,
                plan_def_id
            )

            logger.info(f"Successfully added hook {hook_config.hook_type} to service {service_id}")

            return plan_def_id

        except (SQLAlchemyError, OperationalError, IntegrityError) as e:
            logger.error(f"Database error adding hook to service: {e}")
            raise DatabaseQueryError(message="Failed to add hook to service", cause=e)
        except (FHIRConnectionError, FHIRResourceNotFoundError):
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"FHIR server error adding hook to service: {e.response.status_code}")
            raise FHIRConnectionError(message="FHIR server error adding hook", cause=e)
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Connection error adding hook to service: {e}")
            raise FHIRConnectionError(message="Connection error adding hook", cause=e)
        except ValueError:
            raise
        except (TypeError, KeyError, AttributeError) as e:
            logger.error(f"Data error adding hook to service: {e}")
            raise ValueError(f"Invalid hook configuration: {e}")

    async def list_service_hooks(self, service_id: str) -> List[CDSHooksServiceResponse]:
        """
        List all hooks registered for a CDS Hooks service

        Args:
            service_id: Service ID

        Returns:
            List of CDS Hooks service responses (one per hook)
        """
        try:
            # Get all hooks for service from database
            query = text("""
                SELECT
                    h.id, h.hook_type, h.hook_service_id, h.title, h.description,
                    h.prefetch_template, h.usage_requirements,
                    s.name, s.base_url, s.discovery_endpoint, s.status, s.health_status,
                    s.created_at, s.updated_at
                FROM external_services.cds_hooks h
                JOIN external_services.services s ON h.service_id = s.id
                WHERE h.service_id = :service_id
                ORDER BY h.created_at
            """)

            result = await self.db.execute(query, {"service_id": service_id})
            rows = result.fetchall()

            if not rows:
                return []

            # Build response for each hook
            hooks = []
            for row in rows:
                hook_response = CDSHooksServiceResponse(
                    id=service_id,
                    name=row.name,
                    description=row.description,
                    service_type=ServiceType.CDS_HOOKS,
                    base_url=row.base_url,
                    status=ServiceStatus(row.status),
                    health_status=HealthStatus(row.health_status),
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                    fhir_resource_type="PlanDefinition",
                    fhir_resource_id=None,  # TODO: Link to specific PlanDefinition
                    last_health_check=None,
                    owner_user_id=None,
                    last_used_at=None,
                    auth_type=None,
                    discovery_endpoint=row.discovery_endpoint,
                    cds_config=CDSHookConfig(
                        hook_type=row.hook_type,
                        hook_service_id=row.hook_service_id,
                        title=row.title,
                        description=row.description,
                        prefetch_template=row.prefetch_template,
                        usage_requirements=row.usage_requirements
                    )
                )
                hooks.append(hook_response)

            return hooks

        except (SQLAlchemyError, OperationalError, IntegrityError) as e:
            logger.error(f"Database error listing service hooks: {e}")
            raise DatabaseQueryError(message="Failed to list service hooks", cause=e)
        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error(f"Data error listing service hooks: {e}")
            raise

    async def get_batch_cds_service(self, service_id: str) -> BatchCDSHooksServiceResponse:
        """
        Get batch CDS service with all hooks

        Args:
            service_id: Service ID

        Returns:
            Batch CDS service response with all hook configurations
        """
        try:
            # Get service base information
            service = await self.get_service(service_id)
            if not service:
                raise ValueError(f"Service {service_id} not found")

            # Get all hooks for this service
            hooks = await self.list_service_hooks(service_id)

            # Extract CDS configs from hooks
            cds_configs = [hook.cds_config for hook in hooks]

            # Build batch response
            batch_response = BatchCDSHooksServiceResponse(
                id=service.id,
                name=service.name,
                description=service.description,
                service_type=service.service_type,
                base_url=service.base_url,
                status=service.status,
                health_status=service.health_status,
                created_at=service.created_at,
                updated_at=service.updated_at,
                fhir_resource_type=service.fhir_resource_type,
                fhir_resource_id=service.fhir_resource_id,
                last_health_check=service.last_health_check,
                owner_user_id=service.owner_user_id,
                last_used_at=service.last_used_at,
                auth_type=service.auth_type,
                discovery_endpoint=None,  # TODO: Get from service
                cds_configs=cds_configs,
                hook_count=len(cds_configs)
            )

            return batch_response

        except DatabaseQueryError:
            raise
        except (SQLAlchemyError, OperationalError, IntegrityError) as e:
            logger.error(f"Database error getting batch CDS service: {e}")
            raise DatabaseQueryError(message="Failed to get batch CDS service", cause=e)
        except ValueError:
            raise
        except (TypeError, KeyError, AttributeError) as e:
            logger.error(f"Data error getting batch CDS service: {e}")
            raise ValueError(f"Invalid service data: {e}")

    async def get_cds_service(
        self,
        service_id: str,
        hook_service_id: str
    ) -> CDSHooksServiceResponse:
        """
        Get specific CDS hook by service ID and hook service ID

        Args:
            service_id: Main service ID
            hook_service_id: Specific hook service ID

        Returns:
            CDS Hooks service response for specific hook
        """
        try:
            query = text("""
                SELECT
                    h.id, h.hook_type, h.hook_service_id, h.title, h.description,
                    h.prefetch_template, h.usage_requirements,
                    s.name, s.base_url, s.discovery_endpoint, s.status, s.health_status,
                    s.auth_type, s.created_at, s.updated_at, s.owner_user_id
                FROM external_services.cds_hooks h
                JOIN external_services.services s ON h.service_id = s.id
                WHERE h.service_id = :service_id AND h.hook_service_id = :hook_service_id
            """)

            result = await self.db.execute(query, {
                "service_id": service_id,
                "hook_service_id": hook_service_id
            })
            row = result.fetchone()

            if not row:
                raise ValueError(f"Hook {hook_service_id} not found for service {service_id}")

            return CDSHooksServiceResponse(
                id=service_id,
                name=row.name,
                description=row.description,
                service_type=ServiceType.CDS_HOOKS,
                base_url=row.base_url,
                status=ServiceStatus(row.status),
                health_status=HealthStatus(row.health_status),
                created_at=row.created_at,
                updated_at=row.updated_at,
                fhir_resource_type="PlanDefinition",
                fhir_resource_id=None,
                last_health_check=None,
                owner_user_id=row.owner_user_id,
                last_used_at=None,
                auth_type=row.auth_type,
                discovery_endpoint=row.discovery_endpoint,
                cds_config=CDSHookConfig(
                    hook_type=row.hook_type,
                    hook_service_id=row.hook_service_id,
                    title=row.title,
                    description=row.description,
                    prefetch_template=row.prefetch_template,
                    usage_requirements=row.usage_requirements
                )
            )

        except (SQLAlchemyError, OperationalError, IntegrityError) as e:
            logger.error(f"Database error getting CDS service hook: {e}")
            raise DatabaseQueryError(message="Failed to get CDS service hook", cause=e)
        except ValueError:
            raise
        except (TypeError, KeyError, AttributeError) as e:
            logger.error(f"Data error getting CDS service hook: {e}")
            raise ValueError(f"Invalid hook data: {e}")

    # ========================================================================
    # Helper Methods for Multi-Hook Registration
    # ========================================================================

    async def _create_plan_definition_for_hook(
        self,
        service_id: str,
        service_data,
        hook_config: CDSHookConfig
    ) -> Optional[str]:
        """Create PlanDefinition in HAPI FHIR for a specific hook"""
        try:
            plan_definition = {
                "resourceType": "PlanDefinition",
                "url": f"{service_data.base_url}/{hook_config.hook_service_id}",
                "name": f"{service_data.name}_{hook_config.hook_type}".replace(" ", "_").replace("-", "_"),
                "title": hook_config.title or f"{service_data.name} - {hook_config.hook_type}",
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/plan-definition-type",
                        "code": "eca-rule",
                        "display": "ECA Rule"
                    }]
                },
                "status": "active",
                "description": hook_config.description or service_data.description,
                "purpose": hook_config.usage_requirements,
                "usage": f"CDS Hooks service: {hook_config.hook_type}",
                "extension": [
                    {
                        "url": "http://wintehr.local/fhir/StructureDefinition/service-origin",
                        "valueCode": "external"
                    },
                    {
                        "url": "http://wintehr.local/fhir/StructureDefinition/external-service-id",
                        "valueString": service_id
                    },
                    {
                        "url": "http://wintehr.local/fhir/StructureDefinition/hook-type",
                        "valueCode": hook_config.hook_type
                    },
                    {
                        "url": "http://wintehr.local/fhir/StructureDefinition/hook-service-id",
                        "valueString": hook_config.hook_service_id
                    }
                ],
                "action": [{
                    "trigger": [{
                        "type": "named-event",
                        "name": hook_config.hook_type
                    }],
                    "title": "Execute CDS Hook",
                    "description": f"Invoke external service at {service_data.base_url}"
                }]
            }

            # Add prefetch template if provided
            if hook_config.prefetch_template:
                import base64
                prefetch_json = json.dumps(hook_config.prefetch_template)
                prefetch_base64 = base64.b64encode(prefetch_json.encode()).decode()

                plan_definition["contained"] = [{
                    "resourceType": "Library",
                    "id": "prefetch-template",
                    "status": "active",
                    "type": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/library-type",
                            "code": "logic-library"
                        }]
                    },
                    "content": [{
                        "contentType": "application/json",
                        "data": prefetch_base64,
                        "title": "CDS Hooks Prefetch Template"
                    }]
                }]
                plan_definition["action"][0]["definitionCanonical"] = "#prefetch-template"

            # POST to HAPI FHIR
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.hapi_base_url}/PlanDefinition",
                    json=plan_definition,
                    headers={"Content-Type": "application/fhir+json"},
                    timeout=10.0
                )

                if response.status_code in [200, 201]:
                    created_resource = response.json()
                    logger.info(f"Created PlanDefinition {created_resource.get('id')} for hook {hook_config.hook_type}")
                    return created_resource.get("id")
                else:
                    logger.error(f"Failed to create PlanDefinition: {response.status_code} {response.text}")
                    return None

        except httpx.HTTPStatusError as e:
            logger.error(f"FHIR server error creating PlanDefinition for hook: {e.response.status_code}")
            return None
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Connection error creating PlanDefinition for hook: {e}")
            return None
        except (ValueError, TypeError, KeyError, AttributeError, json.JSONDecodeError) as e:
            logger.error(f"Data error creating PlanDefinition for hook: {e}")
            return None

    async def _store_cds_hook_config(
        self,
        service_id: str,
        hook_config: CDSHookConfig,
        plan_def_id: str
    ):
        """Store CDS hook configuration in database"""
        query = text("""
            INSERT INTO external_services.cds_hooks (
                service_id, hook_type, hook_service_id, title, description,
                prefetch_template, usage_requirements
            ) VALUES (
                :service_id, :hook_type, :hook_service_id, :title, :description,
                :prefetch_template, :usage_requirements
            )
        """)

        await self.db.execute(query, {
            "service_id": service_id,
            "hook_type": hook_config.hook_type,
            "hook_service_id": hook_config.hook_service_id,
            "title": hook_config.title,
            "description": hook_config.description,
            "prefetch_template": hook_config.prefetch_template,
            "usage_requirements": hook_config.usage_requirements
        })
        await self.db.commit()

    async def _check_existing_hook(self, service_id: str, hook_service_id: str) -> bool:
        """Check if hook already exists for service"""
        query = text("""
            SELECT COUNT(*) FROM external_services.cds_hooks
            WHERE service_id = :service_id AND hook_service_id = :hook_service_id
        """)

        result = await self.db.execute(query, {
            "service_id": service_id,
            "hook_service_id": hook_service_id
        })
        count = result.scalar()
        return count > 0

    async def _store_discovery_endpoint(self, service_id: str, discovery_endpoint: str):
        """Store discovery endpoint for CDS service"""
        query = text("""
            UPDATE external_services.services
            SET discovery_endpoint = :endpoint
            WHERE id = :service_id
        """)

        await self.db.execute(query, {
            "service_id": service_id,
            "endpoint": discovery_endpoint
        })
        await self.db.commit()

    async def _update_service_status(self, service_id: str, status: ServiceStatus):
        """Update service status"""
        query = text("""
            UPDATE external_services.services
            SET status = :status
            WHERE id = :service_id
        """)

        await self.db.execute(query, {
            "service_id": service_id,
            "status": status.value
        })
        await self.db.commit()
