"""
Remote Service Provider

Executes external CDS services via HTTP POST to registered service endpoints.
Used for services with service-origin extension = "external".

Features:
- Authentication support (API key, OAuth2, HMAC)
- Failure tracking and auto-disable after consecutive failures
- Timeout handling and graceful degradation
"""

import inspect
import logging
import httpx
import hmac
import hashlib
import json
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from .base_provider import BaseServiceProvider
from ..models import CDSHookRequest, CDSHookResponse, Card


logger = logging.getLogger(__name__)

# One timeout policy for all external calls; a slow external service must
# never hold a hook response open indefinitely.
_HTTP_TIMEOUT_SECONDS = 30.0


class RemoteServiceProvider(BaseServiceProvider):
    """
    Provider for external HTTP CDS services

    Execution flow:
    1. Check if service is auto-disabled
    2. Resolve the service endpoint from metadata
    3. Prepare authentication headers
    4. POST CDS Hooks request to external service
    5. Parse response and return cards
    6. Track failures and auto-disable if threshold exceeded

    Failure contract: `execute()` NEVER raises. Any failure is tracked
    (consecutive-failure counters in external_services.services) and degrades
    to an empty card list — CDS is advisory, and a dead external service must
    not break the clinician-facing hook response. The router keeps its own
    catch-all as a second net, but the contract lives here.
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
            CDSHookResponse with cards from the external service, or an empty
            card list on any failure (after tracking it). Never raises.
        """
        service_id = plan_definition.get("id", "unknown")
        # Failure counters live in external_services.* keyed by hook_service_id
        # ("hfpef-cds"), NOT the HAPI PlanDefinition id this method logs under
        # ("157135"). Tracking under the PD id matched zero rows, so
        # consecutive_failures never moved and auto-disable never engaged in
        # production (observed: 40 fires/hour, counters pinned at 0).
        tracking_id = (service_metadata or {}).get("hook_service_id") or service_id
        try:
            logger.info(f"Executing remote service: {service_id}")

            if not service_metadata:
                raise ValueError("Service metadata required for remote service execution")

            # Check if service is auto-disabled
            if service_metadata.get("auto_disabled", False):
                logger.warning(f"  Service {service_id} is auto-disabled due to consecutive failures")
                return CDSHookResponse(cards=[])

            service_url = self._resolve_service_url(plan_definition, service_metadata)
            if not service_url:
                raise ValueError(f"No service URL found for service {service_id}")

            logger.debug(f"  Service URL: {service_url}")

            # Prepare request body (CDS Hooks specification). fhirAuthorization
            # is a pydantic model — serialize it, or json encoding blows up the
            # first time a caller actually supplies one.
            request_body = {
                "hook": hook_request.hook,
                "hookInstance": hook_request.hookInstance,
                "fhirServer": hook_request.fhirServer,
                "fhirAuthorization": (
                    hook_request.fhirAuthorization.model_dump()
                    if hook_request.fhirAuthorization is not None else None
                ),
                "context": hook_request.context,
                "prefetch": hook_request.prefetch or {}
            }

            # Prepare authentication (HMAC signs the body, so body comes first)
            headers = self._prepare_auth_headers(service_metadata, request_body)

            logger.debug(f"  Sending CDS Hooks request...")

            # One client per call, closed deterministically. The previous
            # long-lived client was created per provider instance and the
            # router constructs a provider per request without ever calling
            # close() — leaking a connection pool on every external hook fire.
            async with httpx.AsyncClient(
                timeout=_HTTP_TIMEOUT_SECONDS,
                follow_redirects=True
            ) as client:
                response = await client.post(
                    service_url,
                    json=request_body,
                    headers=headers
                )

            # Explicit status check (rather than raise_for_status) so the
            # failure path is uniform with every other failure below.
            if response.status_code >= 400:
                raise Exception(f"HTTP error from external service: {response.status_code}")

            response_data = response.json()

            logger.info(f"  ✅ Received response from external service")

            # Extract cards from response
            cards = response_data.get("cards", [])

            # Convert dict cards to Card objects. Card.uuid is optional per the
            # CDS Hooks spec and many external services omit it; generate a stable
            # one so the card validates and downstream feedback has an id.
            card_objects = []
            for card in cards:
                if isinstance(card, dict):
                    card.setdefault("uuid", str(uuid.uuid4()))
                    card_objects.append(Card(**card))
                else:
                    card_objects.append(card)

            logger.info(f"  Generated {len(card_objects)} cards")

            # Reset failure count on success
            if self.db:
                await self._reset_failure_count(tracking_id)

            return CDSHookResponse(cards=card_objects)

        except httpx.TimeoutException:
            return await self._degrade(tracking_id, "Timeout calling external service")
        except httpx.RequestError as e:
            return await self._degrade(tracking_id, f"Connection error calling external service: {e}")
        except Exception as e:
            return await self._degrade(tracking_id, f"Failed to execute remote service: {e}")

    async def _degrade(self, service_id: str, error_msg: str) -> CDSHookResponse:
        """Track the failure, log it, and return an empty (non-blocking) response."""
        logger.error(f"  ❌ {error_msg}")
        await self._handle_failure(service_id, error_msg)
        return CDSHookResponse(cards=[])

    def _resolve_service_url(
        self,
        plan_definition: Dict[str, Any],
        service_metadata: Dict[str, Any]
    ) -> Optional[str]:
        """
        Resolve the endpoint to POST to.

        The production SQL row computes it directly
        (base_url || '/cds-services/' || hook_service_id AS service_url).
        When only base_url is present, derive the same shape the CDS Hooks
        spec defines: {baseUrl}/cds-services/{service.id}, taking the service
        id from the metadata row or the PlanDefinition's hook-service-id
        extension.
        """
        service_url = service_metadata.get("service_url")
        if service_url:
            return service_url

        base_url = service_metadata.get("base_url")
        if not base_url:
            return None

        hook_service_id = service_metadata.get("hook_service_id")
        if not hook_service_id:
            for ext in plan_definition.get("extension", []):
                if ext.get("url") == "http://wintehr.local/fhir/StructureDefinition/hook-service-id":
                    hook_service_id = ext.get("valueString")
                    break
        if not hook_service_id:
            return None

        return f"{base_url.rstrip('/')}/cds-services/{hook_service_id}"

    def _decrypt_credentials(self, service_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recover the credentials dict from external_services.services.credentials_encrypted.

        The registry (api/external_services/service.py) stores Fernet-encrypted
        JSON, so that path is tried first. Plain JSON and bare-string secrets
        are accepted as fallbacks — this is a training platform and fixtures /
        hand-registered services routinely hold unencrypted values.
        """
        raw = service_metadata.get("credentials_encrypted")
        if not raw:
            return {}

        try:
            from api.external_services.service import EncryptionService
            return EncryptionService().decrypt(raw)
        except Exception:
            pass

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except (ValueError, TypeError):
            pass

        # Bare string — treat it as the secret itself.
        return {"secret": raw}

    def _prepare_auth_headers(
        self,
        service_metadata: Dict[str, Any],
        request_body: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """
        Prepare authentication headers from the external_services.services row.

        Reads the columns the production query actually supplies (auth_type +
        credentials_encrypted). The earlier implementation read an "auth_config"
        key that no caller ever passed, so external-service auth silently never
        attached credentials.

        Args:
            service_metadata: Service database record
            request_body: The outgoing CDS Hooks body (HMAC signs it)

        Returns:
            Headers dictionary with authentication
        """
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        auth_type = (service_metadata.get("auth_type") or "none").lower()
        if auth_type == "none":
            return headers

        creds = self._decrypt_credentials(service_metadata)

        if auth_type == "api_key":
            api_key = creds.get("api_key") or creds.get("key") or creds.get("secret")
            header_name = creds.get("header_name", "X-API-Key")
            if api_key:
                headers[header_name] = api_key
            else:
                logger.warning("  api_key auth configured but no key found in credentials")

        elif auth_type == "oauth2":
            token = creds.get("access_token") or creds.get("token") or creds.get("secret")
            if token:
                headers["Authorization"] = f"Bearer {token}"
            else:
                logger.warning("  oauth2 auth configured but no token found in credentials")

        elif auth_type == "hmac":
            secret = creds.get("secret") or creds.get("hmac_secret")
            if secret and request_body is not None:
                payload = json.dumps(request_body, sort_keys=True, default=str).encode()
                signature = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
                headers["X-HMAC-Signature"] = signature
            else:
                logger.warning("  hmac auth configured but no secret found in credentials")

        else:
            logger.warning(f"  Unknown auth_type '{auth_type}' — sending unauthenticated")

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
            from sqlalchemy import text

            # The failure counters live on the parent external_services.services
            # row; service_id here is the CDS service id stored on the child
            # external_services.cds_hooks.hook_service_id. Update via that join.
            row = (await self.db.execute(text("""
                UPDATE external_services.services AS s
                SET consecutive_failures = COALESCE(s.consecutive_failures, 0) + 1,
                    last_failure_at = NOW(),
                    last_error_message = :err,
                    auto_disabled = (COALESCE(s.consecutive_failures, 0) + 1 >= :threshold),
                    auto_disabled_at = CASE
                        WHEN COALESCE(s.consecutive_failures, 0) + 1 >= :threshold THEN NOW()
                        ELSE s.auto_disabled_at END,
                    status = CASE
                        WHEN COALESCE(s.consecutive_failures, 0) + 1 >= :threshold THEN 'suspended'
                        ELSE s.status END,
                    updated_at = NOW()
                FROM external_services.cds_hooks AS ch
                WHERE ch.service_id = s.id AND ch.hook_service_id = :sid
                RETURNING s.consecutive_failures, s.auto_disabled
            """), {"err": error_message, "threshold": self.failure_threshold, "sid": service_id})).first()
            await self.db.commit()

            # Mocked sessions in tests hand back awaitables; unwrap so the
            # logging below never explodes inside an error handler.
            if inspect.isawaitable(row):
                row = None

            if row is None:
                logger.warning(f"  Service {service_id} not found in external_services registry")
            elif row.auto_disabled:
                logger.error(
                    f"  🚨 Service {service_id} auto-disabled after {row.consecutive_failures} consecutive failures"
                )
            else:
                logger.warning(
                    f"  Failure count for {service_id}: {row.consecutive_failures}/{self.failure_threshold}"
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
            from sqlalchemy import text

            await self.db.execute(text("""
                UPDATE external_services.services AS s
                SET consecutive_failures = 0,
                    last_failure_at = NULL,
                    last_error_message = NULL,
                    updated_at = NOW()
                FROM external_services.cds_hooks AS ch
                WHERE ch.service_id = s.id AND ch.hook_service_id = :sid
            """), {"sid": service_id})
            await self.db.commit()

            logger.debug(f"  Reset failure count for {service_id}")

        except Exception as e:
            logger.error(f"  Error resetting failure count: {e}")
