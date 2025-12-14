"""
CDS Hooks Service Registry

Clean registry for managing CDS service definitions and discovery.
Integrates with CDSService base class and ServiceOrchestrator.

Educational Focus:
- Demonstrates service registry pattern
- Shows CDS Hooks discovery endpoint support
- Illustrates clean separation of registration and execution
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Type

from ..services.base_service import CDSService, HookType
from ..conditions.engine import Condition
from ..orchestrator.service_orchestrator import ServiceOrchestrator, get_orchestrator

logger = logging.getLogger(__name__)


@dataclass
class RegisteredService:
    """
    Metadata about a registered CDS service.

    Educational Notes:
        - Combines service instance with registration metadata
        - Tracks conditions for conditional execution
        - Supports service categorization and filtering
    """
    service: CDSService
    conditions: List[Condition] = field(default_factory=list)
    enabled: bool = True
    category: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    registered_at: Optional[str] = None


class ServiceRegistry:
    """
    Registry for CDS Hook services.

    Handles:
    - Service registration and discovery
    - Hook-type filtering
    - Integration with ServiceOrchestrator
    - Discovery endpoint generation

    Educational Notes:
        - Services are registered once at startup
        - Registry provides discovery for /cds-services endpoint
        - Orchestrator handles actual execution
    """

    def __init__(self, orchestrator: Optional[ServiceOrchestrator] = None):
        """
        Initialize the registry.

        Args:
            orchestrator: Optional orchestrator to register services with.
                         If not provided, uses global orchestrator.
        """
        self._services: Dict[str, RegisteredService] = {}
        self._orchestrator = orchestrator

    @property
    def orchestrator(self) -> ServiceOrchestrator:
        """Get the orchestrator, using global if not set."""
        if self._orchestrator is None:
            self._orchestrator = get_orchestrator()
        return self._orchestrator

    def register(
        self,
        service: CDSService,
        conditions: Optional[List[Condition]] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        enabled: bool = True
    ) -> None:
        """
        Register a CDS service.

        Args:
            service: The CDSService instance to register
            conditions: Optional conditions for execution filtering
            category: Optional category for grouping
            tags: Optional tags for filtering
            enabled: Whether the service is enabled (default True)
        """
        if not service.service_id:
            raise ValueError("Service must have a service_id")

        from datetime import datetime

        registered = RegisteredService(
            service=service,
            conditions=conditions or [],
            enabled=enabled,
            category=category,
            tags=tags or [],
            registered_at=datetime.utcnow().isoformat()
        )

        self._services[service.service_id] = registered

        # Also register with orchestrator if enabled
        if enabled:
            self.orchestrator.register_service(service, conditions)

        logger.info(
            f"Registered CDS service: {service.service_id} "
            f"(hook={service.hook_type.value}, enabled={enabled})"
        )

    def unregister(self, service_id: str) -> bool:
        """
        Unregister a service.

        Args:
            service_id: ID of service to remove

        Returns:
            True if service was found and removed
        """
        if service_id in self._services:
            del self._services[service_id]
            self.orchestrator.unregister_service(service_id)
            logger.info(f"Unregistered CDS service: {service_id}")
            return True
        return False

    def get(self, service_id: str) -> Optional[CDSService]:
        """Get a service by ID."""
        registered = self._services.get(service_id)
        return registered.service if registered else None

    def get_registered(self, service_id: str) -> Optional[RegisteredService]:
        """Get full registration info for a service."""
        return self._services.get(service_id)

    def list_services(
        self,
        hook_type: Optional[HookType] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        enabled_only: bool = True
    ) -> List[CDSService]:
        """
        List registered services with optional filtering.

        Args:
            hook_type: Filter by hook type
            category: Filter by category
            tags: Filter by tags (any match)
            enabled_only: Only return enabled services

        Returns:
            List of matching CDSService instances
        """
        results = []

        for registered in self._services.values():
            # Filter by enabled status
            if enabled_only and not registered.enabled:
                continue

            # Filter by hook type
            if hook_type and registered.service.hook_type != hook_type:
                continue

            # Filter by category
            if category and registered.category != category:
                continue

            # Filter by tags
            if tags and not any(t in registered.tags for t in tags):
                continue

            results.append(registered.service)

        return results

    def get_discovery_response(
        self,
        hook_type: Optional[HookType] = None
    ) -> Dict[str, Any]:
        """
        Generate CDS Hooks discovery response.

        This is the response for GET /cds-services endpoint.

        Args:
            hook_type: Optional filter by hook type

        Returns:
            Discovery response dict with services list
        """
        services = self.list_services(hook_type=hook_type, enabled_only=True)

        return {
            "services": [
                service.get_service_definition()
                for service in services
            ]
        }

    def enable(self, service_id: str) -> bool:
        """Enable a service."""
        registered = self._services.get(service_id)
        if registered:
            registered.enabled = True
            self.orchestrator.register_service(
                registered.service,
                registered.conditions
            )
            return True
        return False

    def disable(self, service_id: str) -> bool:
        """Disable a service (keeps registration but excludes from discovery)."""
        registered = self._services.get(service_id)
        if registered:
            registered.enabled = False
            self.orchestrator.unregister_service(service_id)
            return True
        return False

    @property
    def count(self) -> int:
        """Get total number of registered services."""
        return len(self._services)

    @property
    def enabled_count(self) -> int:
        """Get number of enabled services."""
        return sum(1 for r in self._services.values() if r.enabled)

    def clear(self) -> None:
        """Remove all registered services."""
        self._services.clear()
        self.orchestrator.clear()
        logger.info("Cleared all services from registry")

    def get_stats(self) -> Dict[str, Any]:
        """Get registry statistics."""
        by_hook = {}
        by_category = {}

        for registered in self._services.values():
            hook = registered.service.hook_type.value
            by_hook[hook] = by_hook.get(hook, 0) + 1

            cat = registered.category or "uncategorized"
            by_category[cat] = by_category.get(cat, 0) + 1

        return {
            "total_services": self.count,
            "enabled_services": self.enabled_count,
            "by_hook_type": by_hook,
            "by_category": by_category
        }


# Global registry instance
_registry: Optional[ServiceRegistry] = None


def get_registry() -> ServiceRegistry:
    """Get or create the global service registry."""
    global _registry
    if _registry is None:
        _registry = ServiceRegistry()
    return _registry


def set_registry(registry: ServiceRegistry) -> None:
    """Set the global service registry."""
    global _registry
    _registry = registry


def register_service(
    service: CDSService,
    conditions: Optional[List[Condition]] = None,
    **kwargs
) -> None:
    """
    Convenience function to register a service with the global registry.

    Args:
        service: CDSService to register
        conditions: Optional conditions
        **kwargs: Additional registration options
    """
    registry = get_registry()
    registry.register(service, conditions, **kwargs)


def get_discovery_response(hook_type: Optional[HookType] = None) -> Dict[str, Any]:
    """Get discovery response from global registry."""
    return get_registry().get_discovery_response(hook_type)
