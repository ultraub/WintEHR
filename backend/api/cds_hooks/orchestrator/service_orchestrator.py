"""
CDS Hooks Service Orchestrator

Coordinates execution of CDS services with parallel processing,
prefetch resolution, and response aggregation.

Educational Focus:
- Demonstrates async orchestration patterns
- Shows parallel service execution with asyncio
- Illustrates timeout handling and error recovery
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple, Type
from enum import Enum

from ..services.base_service import CDSService, HookType
from ..conditions.engine import ConditionEngine, Condition
from ..models import Card, CDSHookResponse

logger = logging.getLogger(__name__)


class ExecutionStatus(str, Enum):
    """Status of service execution."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class ServiceExecutionResult:
    """Result of a single service execution."""
    service_id: str
    status: ExecutionStatus
    cards: List[Card] = field(default_factory=list)
    execution_time_ms: float = 0.0
    error: Optional[str] = None
    condition_details: Optional[Dict[str, Any]] = None

    @property
    def success(self) -> bool:
        return self.status == ExecutionStatus.COMPLETED


@dataclass
class OrchestratorResult:
    """Result of orchestrating multiple services."""
    cards: List[Card]
    service_results: List[ServiceExecutionResult]
    total_execution_time_ms: float
    services_executed: int
    services_skipped: int
    services_failed: int

    def to_cds_response(self) -> CDSHookResponse:
        """Convert to CDS Hooks response format."""
        return CDSHookResponse(cards=self.cards)


class ServiceOrchestrator:
    """
    Orchestrates CDS service execution.

    Handles:
    - Service discovery and filtering by hook type
    - Parallel service execution with asyncio.gather
    - Prefetch data resolution
    - Condition evaluation
    - Timeout handling
    - Response aggregation

    Educational Notes:
        - Services run in parallel for performance
        - Each service has independent condition evaluation
        - Failed services don't affect others
        - Results are aggregated into a single response
    """

    def __init__(
        self,
        condition_engine: Optional[ConditionEngine] = None,
        default_timeout_ms: int = 5000,
        max_concurrent_services: int = 10
    ):
        """
        Initialize the orchestrator.

        Args:
            condition_engine: Engine for evaluating service conditions
            default_timeout_ms: Default timeout for service execution
            max_concurrent_services: Maximum services to run concurrently
        """
        self.condition_engine = condition_engine or ConditionEngine()
        self.default_timeout_ms = default_timeout_ms
        self.max_concurrent_services = max_concurrent_services
        self._semaphore = asyncio.Semaphore(max_concurrent_services)

        # Service registry - maps service_id to (service_instance, conditions)
        self._services: Dict[str, Tuple[CDSService, List[Condition]]] = {}

    def register_service(
        self,
        service: CDSService,
        conditions: Optional[List[Condition]] = None
    ) -> None:
        """
        Register a CDS service with the orchestrator.

        Args:
            service: The CDS service instance
            conditions: Optional list of conditions for service execution
        """
        if not service.service_id:
            raise ValueError("Service must have a service_id")

        self._services[service.service_id] = (service, conditions or [])
        logger.info(f"Registered CDS service: {service.service_id}")

    def unregister_service(self, service_id: str) -> bool:
        """
        Unregister a CDS service.

        Args:
            service_id: ID of the service to unregister

        Returns:
            True if service was found and removed
        """
        if service_id in self._services:
            del self._services[service_id]
            logger.info(f"Unregistered CDS service: {service_id}")
            return True
        return False

    def get_services_for_hook(self, hook_type: HookType) -> List[CDSService]:
        """
        Get all services registered for a specific hook type.

        Args:
            hook_type: The CDS Hooks hook type

        Returns:
            List of services that respond to this hook
        """
        return [
            service for service, _ in self._services.values()
            if service.hook_type == hook_type
        ]

    def get_all_services(self) -> List[CDSService]:
        """Get all registered services."""
        return [service for service, _ in self._services.values()]

    async def execute(
        self,
        hook_type: HookType,
        context: Dict[str, Any],
        prefetch: Dict[str, Any],
        service_ids: Optional[List[str]] = None,
        timeout_ms: Optional[int] = None
    ) -> OrchestratorResult:
        """
        Execute CDS services for a hook.

        Args:
            hook_type: The CDS Hooks hook type being triggered
            context: CDS Hooks context object
            prefetch: Pre-fetched FHIR resources
            service_ids: Optional list of specific service IDs to execute
            timeout_ms: Optional timeout override

        Returns:
            OrchestratorResult containing all cards and execution details
        """
        start_time = datetime.now()
        timeout = timeout_ms or self.default_timeout_ms

        # Determine which services to execute
        if service_ids:
            services_to_execute = [
                (self._services[sid][0], self._services[sid][1])
                for sid in service_ids
                if sid in self._services
            ]
        else:
            services_to_execute = [
                (service, conditions)
                for service, conditions in self._services.values()
                if service.hook_type == hook_type
            ]

        if not services_to_execute:
            logger.debug(f"No services registered for hook: {hook_type.value}")
            return OrchestratorResult(
                cards=[],
                service_results=[],
                total_execution_time_ms=0,
                services_executed=0,
                services_skipped=0,
                services_failed=0
            )

        # Execute services in parallel
        tasks = [
            self._execute_service(service, conditions, context, prefetch, timeout)
            for service, conditions in services_to_execute
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        service_results: List[ServiceExecutionResult] = []
        all_cards: List[Card] = []
        executed_count = 0
        skipped_count = 0
        failed_count = 0

        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Service execution exception: {result}")
                failed_count += 1
                service_results.append(ServiceExecutionResult(
                    service_id="unknown",
                    status=ExecutionStatus.FAILED,
                    error=str(result)
                ))
            elif isinstance(result, ServiceExecutionResult):
                service_results.append(result)

                if result.status == ExecutionStatus.COMPLETED:
                    executed_count += 1
                    all_cards.extend(result.cards)
                elif result.status == ExecutionStatus.SKIPPED:
                    skipped_count += 1
                else:
                    failed_count += 1

        total_time = (datetime.now() - start_time).total_seconds() * 1000

        return OrchestratorResult(
            cards=all_cards,
            service_results=service_results,
            total_execution_time_ms=total_time,
            services_executed=executed_count,
            services_skipped=skipped_count,
            services_failed=failed_count
        )

    async def _execute_service(
        self,
        service: CDSService,
        conditions: List[Condition],
        context: Dict[str, Any],
        prefetch: Dict[str, Any],
        timeout_ms: int
    ) -> ServiceExecutionResult:
        """
        Execute a single CDS service with conditions and timeout.

        Args:
            service: The service to execute
            conditions: Conditions to evaluate before execution
            context: CDS Hooks context
            prefetch: Prefetch data
            timeout_ms: Execution timeout

        Returns:
            ServiceExecutionResult with cards or error
        """
        start_time = datetime.now()

        async with self._semaphore:
            try:
                # Evaluate conditions first
                if conditions:
                    condition_result = await self.condition_engine.evaluate(
                        conditions, context, prefetch
                    )

                    if not condition_result.satisfied:
                        return ServiceExecutionResult(
                            service_id=service.service_id,
                            status=ExecutionStatus.SKIPPED,
                            condition_details=condition_result.details
                        )

                # Check service's own should_execute
                should_run = await asyncio.wait_for(
                    service.should_execute(context, prefetch),
                    timeout=timeout_ms / 1000
                )

                if not should_run:
                    return ServiceExecutionResult(
                        service_id=service.service_id,
                        status=ExecutionStatus.SKIPPED,
                        condition_details={"reason": "should_execute returned False"}
                    )

                # Execute the service
                cards = await asyncio.wait_for(
                    service.execute(context, prefetch),
                    timeout=timeout_ms / 1000
                )

                execution_time = (datetime.now() - start_time).total_seconds() * 1000

                return ServiceExecutionResult(
                    service_id=service.service_id,
                    status=ExecutionStatus.COMPLETED,
                    cards=cards,
                    execution_time_ms=execution_time
                )

            except asyncio.TimeoutError:
                logger.warning(
                    f"Service {service.service_id} timed out after {timeout_ms}ms"
                )
                return ServiceExecutionResult(
                    service_id=service.service_id,
                    status=ExecutionStatus.TIMEOUT,
                    error=f"Execution timeout ({timeout_ms}ms)"
                )

            except Exception as e:
                logger.exception(f"Error executing service {service.service_id}")
                return ServiceExecutionResult(
                    service_id=service.service_id,
                    status=ExecutionStatus.FAILED,
                    error=str(e)
                )

    async def execute_single(
        self,
        service_id: str,
        context: Dict[str, Any],
        prefetch: Dict[str, Any],
        timeout_ms: Optional[int] = None
    ) -> ServiceExecutionResult:
        """
        Execute a single service by ID.

        Args:
            service_id: ID of the service to execute
            context: CDS Hooks context
            prefetch: Prefetch data
            timeout_ms: Optional timeout override

        Returns:
            ServiceExecutionResult for the single service
        """
        if service_id not in self._services:
            return ServiceExecutionResult(
                service_id=service_id,
                status=ExecutionStatus.FAILED,
                error=f"Service '{service_id}' not found"
            )

        service, conditions = self._services[service_id]
        timeout = timeout_ms or self.default_timeout_ms

        return await self._execute_service(
            service, conditions, context, prefetch, timeout
        )

    def get_service_definitions(
        self,
        hook_type: Optional[HookType] = None
    ) -> List[Dict[str, Any]]:
        """
        Get service definitions for CDS Hooks discovery.

        Args:
            hook_type: Optional filter by hook type

        Returns:
            List of service definitions for /cds-services endpoint
        """
        definitions = []

        for service, _ in self._services.values():
            if hook_type and service.hook_type != hook_type:
                continue

            definitions.append(service.get_service_definition())

        return definitions

    @property
    def service_count(self) -> int:
        """Get count of registered services."""
        return len(self._services)

    def clear(self) -> None:
        """Remove all registered services."""
        self._services.clear()
        logger.info("Cleared all CDS services from orchestrator")


class PriorityServiceOrchestrator(ServiceOrchestrator):
    """
    Extended orchestrator with priority-based execution.

    Services can be assigned priorities, and higher priority
    services execute first. Useful for critical alerts.

    Educational Notes:
        - Priority 1 is highest, 10 is lowest
        - Services with same priority run in parallel
        - Critical services can have card limits enforced
    """

    def __init__(
        self,
        condition_engine: Optional[ConditionEngine] = None,
        default_timeout_ms: int = 5000,
        max_concurrent_services: int = 10,
        max_cards_total: int = 20
    ):
        super().__init__(condition_engine, default_timeout_ms, max_concurrent_services)
        self.max_cards_total = max_cards_total
        self._priorities: Dict[str, int] = {}

    def register_service(
        self,
        service: CDSService,
        conditions: Optional[List[Condition]] = None,
        priority: int = 5
    ) -> None:
        """Register a service with priority."""
        super().register_service(service, conditions)
        self._priorities[service.service_id] = priority

    async def execute(
        self,
        hook_type: HookType,
        context: Dict[str, Any],
        prefetch: Dict[str, Any],
        service_ids: Optional[List[str]] = None,
        timeout_ms: Optional[int] = None
    ) -> OrchestratorResult:
        """Execute services in priority order."""
        # Get services grouped by priority
        priority_groups: Dict[int, List[Tuple[CDSService, List[Condition]]]] = {}

        for service_id, (service, conditions) in self._services.items():
            if service_ids and service_id not in service_ids:
                continue
            if service.hook_type != hook_type:
                continue

            priority = self._priorities.get(service_id, 5)
            if priority not in priority_groups:
                priority_groups[priority] = []
            priority_groups[priority].append((service, conditions))

        # Execute in priority order
        start_time = datetime.now()
        all_cards: List[Card] = []
        all_results: List[ServiceExecutionResult] = []
        timeout = timeout_ms or self.default_timeout_ms

        for priority in sorted(priority_groups.keys()):
            services = priority_groups[priority]

            # Execute this priority group in parallel
            tasks = [
                self._execute_service(service, conditions, context, prefetch, timeout)
                for service, conditions in services
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, ServiceExecutionResult):
                    all_results.append(result)
                    if result.success:
                        all_cards.extend(result.cards)

            # Check if we've hit the card limit
            if len(all_cards) >= self.max_cards_total:
                all_cards = all_cards[:self.max_cards_total]
                break

        total_time = (datetime.now() - start_time).total_seconds() * 1000

        return OrchestratorResult(
            cards=all_cards,
            service_results=all_results,
            total_execution_time_ms=total_time,
            services_executed=sum(1 for r in all_results if r.success),
            services_skipped=sum(1 for r in all_results if r.status == ExecutionStatus.SKIPPED),
            services_failed=sum(1 for r in all_results if r.status == ExecutionStatus.FAILED)
        )


# Global orchestrator instance
_orchestrator: Optional[ServiceOrchestrator] = None


def get_orchestrator() -> ServiceOrchestrator:
    """Get or create the global service orchestrator."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = ServiceOrchestrator()
    return _orchestrator


def set_orchestrator(orchestrator: ServiceOrchestrator) -> None:
    """Set the global service orchestrator."""
    global _orchestrator
    _orchestrator = orchestrator


async def execute_hook(
    hook_type: HookType,
    context: Dict[str, Any],
    prefetch: Dict[str, Any]
) -> OrchestratorResult:
    """
    Convenience function to execute a hook using the global orchestrator.

    Args:
        hook_type: CDS Hooks hook type
        context: CDS Hooks context
        prefetch: Prefetch data

    Returns:
        OrchestratorResult with all cards
    """
    orchestrator = get_orchestrator()
    return await orchestrator.execute(hook_type, context, prefetch)
