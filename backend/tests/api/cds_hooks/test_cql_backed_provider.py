"""Tests for CQLBackedServiceProvider — runs cql-based services through the bridge."""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

from api.cds_hooks.providers.cql_backed_provider import CQLBackedServiceProvider
from api.cds_hooks.models import CDSHookRequest, CDSHookResponse, HookType


@pytest.fixture
def hook_request():
    return CDSHookRequest(
        hook=HookType.PATIENT_VIEW,
        hookInstance=str(uuid.uuid4()),
        context={"patientId": "p1", "userId": "Practitioner/demo"},
    )


@pytest.fixture
def plan_definition():
    return {
        "resourceType": "PlanDefinition",
        "id": "patient-greeter-cql",
        "title": "Patient Greeter",
        "status": "active",
    }


class TestCQLBackedServiceProvider:

    @pytest.mark.asyncio
    async def test_should_execute_always_true(self, plan_definition, hook_request):
        provider = CQLBackedServiceProvider(db=AsyncMock(), bridge=MagicMock())
        assert await provider.should_execute(plan_definition, hook_request) is True

    @pytest.mark.asyncio
    async def test_execute_delegates_to_bridge(self, plan_definition, hook_request):
        bridge = MagicMock()
        expected = CDSHookResponse(cards=[])
        bridge.execute_for_hook = AsyncMock(return_value=expected)

        provider = CQLBackedServiceProvider(db=AsyncMock(), bridge=bridge)
        response = await provider.execute(plan_definition, hook_request)

        assert response is expected
        bridge.execute_for_hook.assert_awaited_once()
        kwargs = bridge.execute_for_hook.call_args.kwargs
        # call_args.args holds positional, kwargs holds keyword
        called_args = bridge.execute_for_hook.call_args.args
        assert "patient-greeter-cql" in called_args  # plan_definition_id passed
        assert kwargs.get("source_label") == "Patient Greeter"  # from PlanDefinition.title

    @pytest.mark.asyncio
    async def test_uses_metadata_name_when_provided(self, plan_definition, hook_request):
        bridge = MagicMock()
        bridge.execute_for_hook = AsyncMock(return_value=CDSHookResponse(cards=[]))

        provider = CQLBackedServiceProvider(db=AsyncMock(), bridge=bridge)
        await provider.execute(
            plan_definition,
            hook_request,
            service_metadata={"name": "Custom Service Name", "service_id": "x", "id": 1},
        )

        kwargs = bridge.execute_for_hook.call_args.kwargs
        assert kwargs["source_label"] == "Custom Service Name"

    @pytest.mark.asyncio
    async def test_falls_back_when_plan_def_lacks_title(self, hook_request):
        bridge = MagicMock()
        bridge.execute_for_hook = AsyncMock(return_value=CDSHookResponse(cards=[]))
        plan_definition = {"resourceType": "PlanDefinition", "id": "x", "name": "FallbackName"}

        provider = CQLBackedServiceProvider(db=AsyncMock(), bridge=bridge)
        await provider.execute(plan_definition, hook_request)

        kwargs = bridge.execute_for_hook.call_args.kwargs
        assert kwargs["source_label"] == "FallbackName"

    @pytest.mark.asyncio
    async def test_raises_when_plan_definition_id_missing(self, hook_request):
        bridge = MagicMock()
        provider = CQLBackedServiceProvider(db=AsyncMock(), bridge=bridge)
        with pytest.raises(ValueError, match="id"):
            await provider.execute({"resourceType": "PlanDefinition"}, hook_request)
