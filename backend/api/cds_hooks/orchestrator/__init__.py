"""
CDS Hooks Service Orchestrator Module

Coordinates service lifecycle, routing, and execution.

Educational Focus:
- ServiceOrchestrator: Main orchestrator for parallel service execution
- PriorityServiceOrchestrator: Extended orchestrator with priority support
- CDSHookEngine: Hook evaluation and condition checking engine
- Convenience functions for global orchestrator access
"""

from .service_orchestrator import (
    ServiceOrchestrator,
    PriorityServiceOrchestrator,
    ServiceExecutionResult,
    OrchestratorResult,
    ExecutionStatus,
    get_orchestrator,
    set_orchestrator,
    execute_hook,
)
from .hook_engine import (
    CDSHookEngine,
    get_hook_engine,
)

__all__ = [
    # Service Orchestrator
    "ServiceOrchestrator",
    "PriorityServiceOrchestrator",
    "ServiceExecutionResult",
    "OrchestratorResult",
    "ExecutionStatus",
    "get_orchestrator",
    "set_orchestrator",
    "execute_hook",
    # Hook Engine
    "CDSHookEngine",
    "get_hook_engine",
]
