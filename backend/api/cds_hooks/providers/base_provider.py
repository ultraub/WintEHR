"""
Base Service Provider Interface

Abstract base class defining the interface for CDS service execution providers.
All service providers (local, remote) must implement this interface.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from ..models import CDSHookRequest, CDSHookResponse, Card
from ..utils import extract_extension_value as _extract_ext
from ..constants import ExtensionURLs


class BaseServiceProvider(ABC):
    """
    Abstract base class for CDS service providers

    Providers handle execution of CDS services from different sources:
    - LocalServiceProvider: Python class execution (built-in services)
    - RemoteServiceProvider: HTTP POST to external services

    All providers must implement the execute method for consistent service execution.
    """

    def __init__(self):
        """Initialize the service provider"""
        self.provider_type = "base"  # Override in subclasses

    @abstractmethod
    async def execute(
        self,
        plan_definition: Dict[str, Any],
        hook_request: CDSHookRequest,
        service_metadata: Optional[Dict[str, Any]] = None
    ) -> CDSHookResponse:
        """
        Execute a CDS service and return cards

        Args:
            plan_definition: HAPI FHIR PlanDefinition resource
            hook_request: CDS Hooks request with context and prefetch
            service_metadata: Optional additional service metadata (e.g., DB record for external services)

        Returns:
            CDSHookResponse with cards

        Raises:
            Exception: If service execution fails
        """
        raise NotImplementedError("Subclasses must implement execute method")

    @abstractmethod
    async def should_execute(
        self,
        plan_definition: Dict[str, Any],
        hook_request: CDSHookRequest
    ) -> bool:
        """
        Determine if this provider can execute the given service

        Args:
            plan_definition: HAPI FHIR PlanDefinition resource
            hook_request: CDS Hooks request

        Returns:
            True if this provider can execute the service, False otherwise
        """
        raise NotImplementedError("Subclasses must implement should_execute method")

    def extract_extension_value(
        self,
        resource: Dict[str, Any],
        url: str,
        default: Any = None
    ) -> Any:
        """
        Extract value from FHIR extension

        Args:
            resource: FHIR resource with extensions
            url: Extension URL to find
            default: Default value if extension not found

        Returns:
            Extension value or default
        """
        return _extract_ext(resource, url, default)

    def extract_prefetch_template(
        self,
        plan_definition: Dict[str, Any]
    ) -> Optional[Dict[str, str]]:
        """
        Extract prefetch template from PlanDefinition contained resources

        Args:
            plan_definition: PlanDefinition resource

        Returns:
            Prefetch dictionary or None
        """
        import json
        import base64

        # Look for contained Library with prefetch template
        contained = plan_definition.get("contained", [])
        for resource in contained:
            if resource.get("resourceType") == "Library" and resource.get("id") == "prefetch-template":
                content = resource.get("content", [])
                if content:
                    # Decode base64 data
                    data_base64 = content[0].get("data", "")
                    if data_base64:
                        try:
                            data_json = base64.b64decode(data_base64).decode()
                            return json.loads(data_json)
                        except Exception:
                            return None

        return None

    def get_hook_type(self, plan_definition: Dict[str, Any]) -> str:
        """
        Get hook type from PlanDefinition

        Args:
            plan_definition: PlanDefinition resource

        Returns:
            Hook type (e.g., "patient-view", "medication-prescribe")
        """
        return self.extract_extension_value(
            plan_definition,
            ExtensionURLs.HOOK_TYPE,
            "patient-view"  # Default
        )

    def get_service_origin(self, plan_definition: Dict[str, Any]) -> str:
        """
        Get service origin from PlanDefinition

        Args:
            plan_definition: PlanDefinition resource

        Returns:
            Service origin ("built-in" or "external")
        """
        return self.extract_extension_value(
            plan_definition,
            ExtensionURLs.SERVICE_ORIGIN,
            "built-in"  # Default
        )
