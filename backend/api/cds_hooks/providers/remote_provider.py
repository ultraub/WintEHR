"""
Remote Service Provider

Executes external CDS services via HTTP POST to registered service endpoints.
Used for services with service-origin extension = "external".

Features:
- Authentication support (API key, OAuth2, HMAC)
- Failure tracking and auto-disable after consecutive failures
- Timeout handling and graceful degradation
"""

import logging
import httpx
import hmac
import hashlib
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from .base_provider import BaseServiceProvider
from ..models import CDSHookRequest, CDSHookResponse, Card


logger = logging.getLogger(__name__)


class RemoteServiceProvider(BaseServiceProvider):
    """
    Provider for external HTTP CDS services

    Execution flow:
    1. Check if service is auto-disabled
    2. Retrieve service endpoint from database
    3. Prepare authentication headers
    4. POST CDS Hooks request to external service
    5. Parse response and return cards
    6. Track failures and auto-disable if threshold exceeded

    Educational notes:
    - Implements CDS Hooks 1.0 HTTP request/response specification
    - Handles various authentication mechanisms
    - Provides graceful degradation on failures
    - Prevents cascading failures via auto-disable
    """

    def __init__(self, db_session=None):
        """
        Initialize remote service provider

        Args:
            db_session: SQLAlchemy async session for database operations
        """
        super().__init__()
        self.provider_type = "remote"
        self.db = db_session
        self.http_client = httpx.AsyncClient(
            timeout=30.0,  # 30 second timeout
            follow_redirects=True
        )
        self.failure_threshold = 5  # Auto-disable after 5 consecutive failures

    async def should_execute(
        self,
        plan_definition: Dict[str, Any],
        hook_request: CDSHookRequest
    ) -> bool:
        """
        Check if this is an external service that can be executed remotely

        Args:
            plan_definition: PlanDefinition resource
            hook_request: CDS Hooks request

        Returns:
            True if service-origin is "external"
        """
        origin = self.get_service_origin(plan_definition)
        return origin == "external"

    async def execute(
        self,
        plan_definition: Dict[str, Any],
        hook_request: CDSHookRequest,
        service_metadata: Optional[Dict[str, Any]] = None
    ) -> CDSHookResponse:
        """
        Execute external CDS service via HTTP

        Args:
            plan_definition: PlanDefinition resource
            hook_request: CDS Hooks request
            service_metadata: External service DB record with URL and auth

        Returns:
            CDSHookResponse with cards from external service

        Raises:
            ValueError: If service metadata not provided
            Exception: If HTTP request fails
        """
        try:
            service_id = plan_definition.get("id", "unknown")
            logger.info(f"Executing remote service: {service_id}")

            if not service_metadata:
                raise ValueError("Service metadata required for remote service execution")

            # Check if service is auto-disabled
            if service_metadata.get("auto_disabled", False):
                logger.warning(f"  Service {service_id} is auto-disabled due to consecutive failures")
                return CDSHookResponse(cards=[])

            # Extract service endpoint
            service_url = service_metadata.get("service_url")
            if not service_url:
                raise ValueError(f"No service URL found for service {service_id}")

            logger.debug(f"  Service URL: {service_url}")

            # Prepare authentication
            headers = self._prepare_auth_headers(service_metadata)

            # Prepare request body (CDS Hooks specification)
            request_body = {
                "hook": hook_request.hook,
                "hookInstance": hook_request.hookInstance,
                "fhirServer": hook_request.fhirServer,
                "fhirAuthorization": hook_request.fhirAuthorization,
                "context": hook_request.context,
                "prefetch": hook_request.prefetch or {}
            }

            logger.debug(f"  Sending CDS Hooks request...")

            # POST to external service
            response = await self.http_client.post(
                service_url,
                json=request_body,
                headers=headers
            )

            response.raise_for_status()

            # Parse response
            response_data = response.json()

            logger.info(f"  ✅ Received response from external service")

            # Extract cards from response
            cards = response_data.get("cards", [])

            # Convert dict cards to Card objects
            card_objects = []
            for card in cards:
                if isinstance(card, dict):
                    card_objects.append(Card(**card))
                else:
                    card_objects.append(card)

            logger.info(f"  Generated {len(card_objects)} cards")

            # Reset failure count on success
            if self.db:
                await self._reset_failure_count(service_id)

            return CDSHookResponse(cards=card_objects)

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error from external service: {e.response.status_code}"
            logger.error(f"  ❌ {error_msg}")
            await self._handle_failure(service_id, error_msg)
            raise Exception(error_msg) from e

        except httpx.TimeoutException as e:
            error_msg = f"Timeout calling external service"
            logger.error(f"  ❌ {error_msg}")
            await self._handle_failure(service_id, error_msg)
            raise Exception(error_msg) from e

        except Exception as e:
            error_msg = f"Failed to execute remote service: {str(e)}"
            logger.error(f"  ❌ {error_msg}", exc_info=True)
            await self._handle_failure(service_id, error_msg)
            raise Exception(error_msg) from e

    def _prepare_auth_headers(self, service_metadata: Dict[str, Any]) -> Dict[str, str]:
        """
        Prepare authentication headers based on service auth type

        Args:
            service_metadata: Service database record with auth configuration

        Returns:
            Headers dictionary with authentication
        """
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        auth_config = service_metadata.get("auth_config", {})
        auth_type = auth_config.get("type", "none")

        if auth_type == "api_key":
            # API Key authentication
            api_key = auth_config.get("api_key")
            header_name = auth_config.get("header_name", "Authorization")
            header_value = auth_config.get("header_value_format", "Bearer {api_key}")

            if api_key:
                headers[header_name] = header_value.format(api_key=api_key)

        elif auth_type == "oauth2":
            # OAuth2 Bearer token
            access_token = auth_config.get("access_token")
            if access_token:
                headers["Authorization"] = f"Bearer {access_token}"

        elif auth_type == "hmac":
            # HMAC signature (future implementation)
            logger.warning("HMAC authentication not yet implemented")

        return headers

    async def _handle_failure(self, service_id: str, error_message: str):
        """
        Handle service execution failure

        Increments failure count and auto-disables service if threshold exceeded.

        Args:
            service_id: Service identifier
            error_message: Error message to log
        """
        if not self.db:
            return

        try:
            from sqlalchemy import select, update
            from api.external_services.models import ExternalService

            # Get current service record
            result = await self.db.execute(
                select(ExternalService).where(ExternalService.service_id == service_id)
            )
            service = result.scalar_one_or_none()

            if not service:
                logger.warning(f"  Service {service_id} not found in database")
                return

            # Increment failure count
            new_failure_count = (service.consecutive_failures or 0) + 1

            # Check if threshold exceeded
            auto_disabled = new_failure_count >= self.failure_threshold

            # Update service record
            await self.db.execute(
                update(ExternalService)
                .where(ExternalService.service_id == service_id)
                .values(
                    consecutive_failures=new_failure_count,
                    last_failure_at=datetime.utcnow(),
                    auto_disabled=auto_disabled,
                    auto_disabled_at=datetime.utcnow() if auto_disabled else None,
                    last_error_message=error_message
                )
            )
            await self.db.commit()

            if auto_disabled:
                logger.error(
                    f"  🚨 Service {service_id} auto-disabled after {new_failure_count} consecutive failures"
                )
            else:
                logger.warning(
                    f"  Failure count for {service_id}: {new_failure_count}/{self.failure_threshold}"
                )

        except Exception as e:
            logger.error(f"  Error updating failure count: {e}")

    async def _reset_failure_count(self, service_id: str):
        """
        Reset failure count on successful execution

        Args:
            service_id: Service identifier
        """
        if not self.db:
            return

        try:
            from sqlalchemy import update
            from api.external_services.models import ExternalService

            await self.db.execute(
                update(ExternalService)
                .where(ExternalService.service_id == service_id)
                .values(
                    consecutive_failures=0,
                    last_failure_at=None,
                    last_error_message=None
                )
            )
            await self.db.commit()

            logger.debug(f"  Reset failure count for {service_id}")

        except Exception as e:
            logger.error(f"  Error resetting failure count: {e}")

    async def close(self):
        """Close HTTP client connection"""
        await self.http_client.aclose()
