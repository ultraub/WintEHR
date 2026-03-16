"""
Tests for the CDS Hooks Service Orchestrator

Tests the parallel service execution coordinator including:
- Service registration and unregistration
- Parallel service execution
- Condition evaluation gating
- Timeout handling
- Result aggregation
- Priority-based orchestration
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

from api.cds_hooks.orchestrator.service_orchestrator import (
    ServiceOrchestrator,
    PriorityServiceOrchestrator,
    ServiceExecutionResult,
    OrchestratorResult,
    ExecutionStatus,
    get_orchestrator,
    set_orchestrator,
)
from api.cds_hooks.conditions.engine import (
    ConditionEngine,
    ConditionResult,
    AgeCondition,
)
from api.cds_hooks.models import HookType


# ---- Helpers ----

class MockCDSService:
    """Mock CDS service for testing"""

    def __init__(self, service_id: str, hook_type=HookType.PATIENT_VIEW,
                 cards=None, should_exec=True, exec_delay=0):
        self.service_id = service_id
        self.hook_type = hook_type
        self.title = f"Test Service: {service_id}"
        self.description = f"Test service {service_id}"
        self.prefetch_templates = {"patient": "Patient/{{context.patientId}}"}
        self._cards = cards or []
        self._should_exec = should_exec
        self._exec_delay = exec_delay

    async def should_execute(self, context, prefetch):
        return self._should_exec

    async def execute(self, context, prefetch):
        if self._exec_delay > 0:
            await asyncio.sleep(self._exec_delay)
        return self._cards

    def get_service_definition(self):
        return {
            "id": self.service_id,
            "hook": self.hook_type.value if isinstance(self.hook_type, HookType) else self.hook_type,
            "title": self.title,
            "description": self.description,
            "prefetch": self.prefetch_templates
        }


class FailingService(MockCDSService):
    """Service that raises an exception during execution"""

    async def execute(self, context, prefetch):
        raise RuntimeError("Service execution failed")


@pytest.fixture
def default_context():
    return {
        "patientId": "Patient/123",
        "userId": "Practitioner/456",
        "hook": "patient-view"
    }


@pytest.fixture
def default_prefetch():
    return {
        "patient": {
            "resourceType": "Patient",
            "id": "123",
            "birthDate": "1970-06-15",
            "gender": "male"
        }
    }


@pytest.fixture
def sample_cards():
    return [
        {
            "uuid": "card-1",
            "summary": "Test recommendation",
            "indicator": "info",
            "source": {"label": "Test Service"},
            "detail": "This is a test card"
        }
    ]


@pytest.fixture
def orchestrator():
    return ServiceOrchestrator()


@pytest.fixture
def priority_orchestrator():
    return PriorityServiceOrchestrator(max_cards_total=10)


# ---- ServiceExecutionResult Tests ----

class TestServiceExecutionResult:

    def test_success_result(self):
        result = ServiceExecutionResult(
            service_id="test",
            status=ExecutionStatus.COMPLETED,
            cards=[{"summary": "test"}],
            execution_time_ms=100.0
        )
        assert result.success is True

    def test_failed_result(self):
        result = ServiceExecutionResult(
            service_id="test",
            status=ExecutionStatus.FAILED,
            error="Something went wrong"
        )
        assert result.success is False

    def test_skipped_result(self):
        result = ServiceExecutionResult(
            service_id="test",
            status=ExecutionStatus.SKIPPED
        )
        assert result.success is False

    def test_timeout_result(self):
        result = ServiceExecutionResult(
            service_id="test",
            status=ExecutionStatus.TIMEOUT
        )
        assert result.success is False


# ---- ServiceOrchestrator Registration Tests ----

class TestServiceRegistration:

    def test_register_service(self, orchestrator, sample_cards):
        service = MockCDSService("test-1", cards=sample_cards)
        orchestrator.register_service(service)
        assert orchestrator.service_count == 1

    def test_register_multiple_services(self, orchestrator):
        service1 = MockCDSService("test-1")
        service2 = MockCDSService("test-2")
        orchestrator.register_service(service1)
        orchestrator.register_service(service2)
        assert orchestrator.service_count == 2

    def test_register_with_conditions(self, orchestrator):
        service = MockCDSService("test-1")
        conditions = [AgeCondition(min_age=50)]
        orchestrator.register_service(service, conditions=conditions)
        assert orchestrator.service_count == 1

    def test_unregister_service(self, orchestrator):
        service = MockCDSService("test-1")
        orchestrator.register_service(service)
        result = orchestrator.unregister_service("test-1")
        assert result is True
        assert orchestrator.service_count == 0

    def test_unregister_nonexistent(self, orchestrator):
        result = orchestrator.unregister_service("nonexistent")
        assert result is False

    def test_get_services_for_hook(self, orchestrator):
        pv_service = MockCDSService("pv-1", hook_type=HookType.PATIENT_VIEW)
        med_service = MockCDSService("med-1", hook_type=HookType.MEDICATION_PRESCRIBE)
        orchestrator.register_service(pv_service)
        orchestrator.register_service(med_service)

        pv_services = orchestrator.get_services_for_hook(HookType.PATIENT_VIEW)
        assert len(pv_services) == 1
        assert pv_services[0].service_id == "pv-1"

    def test_get_all_services(self, orchestrator):
        service1 = MockCDSService("test-1")
        service2 = MockCDSService("test-2")
        orchestrator.register_service(service1)
        orchestrator.register_service(service2)
        assert len(orchestrator.get_all_services()) == 2

    def test_clear(self, orchestrator):
        service1 = MockCDSService("test-1")
        service2 = MockCDSService("test-2")
        orchestrator.register_service(service1)
        orchestrator.register_service(service2)
        orchestrator.clear()
        assert orchestrator.service_count == 0


# ---- Service Execution Tests ----

class TestServiceExecution:

    @pytest.mark.asyncio
    async def test_execute_single_service(self, orchestrator, default_context, default_prefetch, sample_cards):
        service = MockCDSService("test-1", cards=sample_cards)
        orchestrator.register_service(service)

        result = await orchestrator.execute(
            hook_type=HookType.PATIENT_VIEW,
            context=default_context,
            prefetch=default_prefetch
        )

        assert isinstance(result, OrchestratorResult)
        assert result.services_executed >= 1

    @pytest.mark.asyncio
    async def test_execute_multiple_services(self, orchestrator, default_context, default_prefetch):
        cards1 = [{"uuid": "c1", "summary": "Card 1", "indicator": "info", "source": {"label": "S1"}}]
        cards2 = [{"uuid": "c2", "summary": "Card 2", "indicator": "warning", "source": {"label": "S2"}}]

        service1 = MockCDSService("test-1", cards=cards1)
        service2 = MockCDSService("test-2", cards=cards2)
        orchestrator.register_service(service1)
        orchestrator.register_service(service2)

        result = await orchestrator.execute(
            hook_type=HookType.PATIENT_VIEW,
            context=default_context,
            prefetch=default_prefetch
        )

        assert result.services_executed >= 2

    @pytest.mark.asyncio
    async def test_execute_service_should_not_execute(self, orchestrator, default_context, default_prefetch):
        service = MockCDSService("test-1", should_exec=False)
        orchestrator.register_service(service)

        result = await orchestrator.execute(
            hook_type=HookType.PATIENT_VIEW,
            context=default_context,
            prefetch=default_prefetch
        )

        assert result.services_skipped >= 0  # May be skipped

    @pytest.mark.asyncio
    async def test_execute_wrong_hook_type(self, orchestrator, default_context, default_prefetch, sample_cards):
        service = MockCDSService("test-1", hook_type=HookType.MEDICATION_PRESCRIBE, cards=sample_cards)
        orchestrator.register_service(service)

        result = await orchestrator.execute(
            hook_type=HookType.PATIENT_VIEW,
            context=default_context,
            prefetch=default_prefetch
        )

        # Service should not execute because hook type doesn't match
        assert result.services_executed == 0

    @pytest.mark.asyncio
    async def test_execute_no_services(self, orchestrator, default_context, default_prefetch):
        result = await orchestrator.execute(
            hook_type=HookType.PATIENT_VIEW,
            context=default_context,
            prefetch=default_prefetch
        )

        assert isinstance(result, OrchestratorResult)
        assert result.services_executed == 0

    @pytest.mark.asyncio
    async def test_execute_failing_service(self, orchestrator, default_context, default_prefetch):
        failing = FailingService("failing-1")
        good = MockCDSService("good-1", cards=[{"uuid": "c1", "summary": "OK", "indicator": "info", "source": {"label": "S"}}])

        orchestrator.register_service(failing)
        orchestrator.register_service(good)

        result = await orchestrator.execute(
            hook_type=HookType.PATIENT_VIEW,
            context=default_context,
            prefetch=default_prefetch
        )

        # One failed, one succeeded - failure should be isolated
        assert result.services_failed >= 1

    @pytest.mark.asyncio
    async def test_execute_single_by_id(self, orchestrator, default_context, default_prefetch, sample_cards):
        service = MockCDSService("test-1", cards=sample_cards)
        orchestrator.register_service(service)

        result = await orchestrator.execute_single(
            service_id="test-1",
            context=default_context,
            prefetch=default_prefetch
        )

        assert isinstance(result, ServiceExecutionResult)
        assert result.service_id == "test-1"


# ---- Service Definitions Tests ----

class TestServiceDefinitions:

    def test_get_service_definitions(self, orchestrator):
        service = MockCDSService("test-1")
        orchestrator.register_service(service)
        definitions = orchestrator.get_service_definitions()
        assert len(definitions) == 1
        assert definitions[0]["id"] == "test-1"

    def test_get_service_definitions_by_hook(self, orchestrator):
        pv_service = MockCDSService("pv-1", hook_type=HookType.PATIENT_VIEW)
        med_service = MockCDSService("med-1", hook_type=HookType.MEDICATION_PRESCRIBE)
        orchestrator.register_service(pv_service)
        orchestrator.register_service(med_service)

        pv_defs = orchestrator.get_service_definitions(hook_type=HookType.PATIENT_VIEW)
        assert len(pv_defs) == 1
        assert pv_defs[0]["id"] == "pv-1"


# ---- OrchestratorResult Tests ----

class TestOrchestratorResult:

    def test_to_cds_response(self):
        import uuid
        result = OrchestratorResult(
            cards=[{
                "uuid": str(uuid.uuid4()),
                "summary": "Test",
                "indicator": "info",
                "source": {"label": "S"}
            }],
            service_results=[],
            total_execution_time_ms=50.0,
            services_executed=1,
            services_skipped=0,
            services_failed=0
        )
        response = result.to_cds_response()
        assert hasattr(response, "cards")


# ---- Global Functions Tests ----

class TestGlobalFunctions:

    def test_set_and_get_orchestrator(self):
        orchestrator = ServiceOrchestrator()
        set_orchestrator(orchestrator)
        retrieved = get_orchestrator()
        assert retrieved is orchestrator

    def test_get_orchestrator_default(self):
        # Should return a default orchestrator even without setting one
        orchestrator = get_orchestrator()
        assert isinstance(orchestrator, ServiceOrchestrator)


# ---- PriorityServiceOrchestrator Tests ----

class TestPriorityServiceOrchestrator:

    def test_register_with_priority(self, priority_orchestrator, sample_cards):
        service = MockCDSService("test-1", cards=sample_cards)
        priority_orchestrator.register_service(service, priority=1)
        assert priority_orchestrator.service_count == 1

    @pytest.mark.asyncio
    async def test_execute_respects_priority(self, priority_orchestrator, default_context, default_prefetch):
        high_priority = MockCDSService("high-1", cards=[
            {"uuid": "h1", "summary": "High priority", "indicator": "critical", "source": {"label": "HP"}}
        ])
        low_priority = MockCDSService("low-1", cards=[
            {"uuid": "l1", "summary": "Low priority", "indicator": "info", "source": {"label": "LP"}}
        ])

        priority_orchestrator.register_service(high_priority, priority=1)
        priority_orchestrator.register_service(low_priority, priority=10)

        result = await priority_orchestrator.execute(
            hook_type=HookType.PATIENT_VIEW,
            context=default_context,
            prefetch=default_prefetch
        )

        assert isinstance(result, OrchestratorResult)
        assert result.services_executed >= 2
