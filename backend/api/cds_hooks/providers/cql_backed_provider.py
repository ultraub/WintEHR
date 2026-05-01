"""
CQLBackedServiceProvider — runs `service_type='cql-based'` services through HAPI.

Sits next to the existing LocalServiceProvider / RemoteServiceProvider /
VisualServiceProvider. The dispatch in cds_hooks_router.py picks this provider
when a visual-builder service has `service_type='cql-based'`. The work itself
is delegated to api.cds_hooks.cql_bridge.CQLBridge, which calls
`PlanDefinition/$apply` on HAPI and translates the response to CDS Hooks Cards.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..cql_bridge import CQLBridge
from ..models import CDSHookRequest, CDSHookResponse
from .base_provider import BaseServiceProvider

logger = logging.getLogger(__name__)


class CQLBackedServiceProvider(BaseServiceProvider):
    """Executes CQL-backed visual-builder services via PlanDefinition/$apply."""

    provider_type = "cql-backed"

    def __init__(self, db: AsyncSession, bridge: Optional[CQLBridge] = None) -> None:
        super().__init__()
        self.db = db
        self.bridge = bridge or CQLBridge()

    async def should_execute(
        self,
        plan_definition: Dict[str, Any],
        hook_request: CDSHookRequest,
    ) -> bool:
        """The dispatcher already chose us based on service_type; always True here."""
        return True

    async def execute(
        self,
        plan_definition: Dict[str, Any],
        hook_request: CDSHookRequest,
        service_metadata: Optional[Dict[str, Any]] = None,
    ) -> CDSHookResponse:
        """Run $apply against HAPI and translate the response.

        The PlanDefinition resource passed in is the one already fetched from
        HAPI by the dispatcher; we use its id (FHIR-side) for $apply. The
        VisualServiceConfig (passed via service_metadata, optional) supplies a
        human-readable source label for the card.
        """
        plan_definition_id = plan_definition.get("id")
        if not plan_definition_id:
            raise ValueError("PlanDefinition is missing 'id'; cannot $apply")

        source_label = self._derive_source_label(plan_definition, service_metadata)
        return await self.bridge.execute_for_hook(
            plan_definition_id,
            hook_request,
            source_label=source_label,
        )

    @staticmethod
    def _derive_source_label(
        plan_definition: Dict[str, Any],
        service_metadata: Optional[Dict[str, Any]],
    ) -> str:
        if service_metadata and service_metadata.get("name"):
            return str(service_metadata["name"])
        return plan_definition.get("title") or plan_definition.get("name") or "CQL Service"
