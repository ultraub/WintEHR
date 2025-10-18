"""
Local Service Provider

Executes built-in CDS services by dynamically importing Python classes.
Used for services with service-origin extension = "built-in".
"""

import logging
import importlib
from typing import Dict, Any, List, Optional

from .base_provider import BaseServiceProvider
from ..models import CDSHookRequest, CDSHookResponse, Card


logger = logging.getLogger(__name__)


class LocalServiceProvider(BaseServiceProvider):
    """
    Provider for built-in Python CDS services

    Execution flow:
    1. Extract python-class extension from PlanDefinition
    2. Dynamically import the service class
    3. Instantiate and execute the service
    4. Return CDS Hooks cards

    Educational notes:
    - Uses dynamic import to load service classes at runtime
    - Maintains separation between service definition (HAPI FHIR) and implementation (Python)
    - Enables updating service logic without modifying PlanDefinitions
    """

    def __init__(self):
        """Initialize local service provider"""
        super().__init__()
        self.provider_type = "local"
        self._service_cache = {}  # Cache instantiated services

    async def should_execute(
        self,
        plan_definition: Dict[str, Any],
        hook_request: CDSHookRequest
    ) -> bool:
        """
        Check if this is a built-in service that can be executed locally

        Args:
            plan_definition: PlanDefinition resource
            hook_request: CDS Hooks request

        Returns:
            True if service-origin is "built-in"
        """
        origin = self.get_service_origin(plan_definition)
        return origin == "built-in"

    async def execute(
        self,
        plan_definition: Dict[str, Any],
        hook_request: CDSHookRequest,
        service_metadata: Optional[Dict[str, Any]] = None
    ) -> CDSHookResponse:
        """
        Execute built-in Python CDS service

        Args:
            plan_definition: PlanDefinition with python-class extension
            hook_request: CDS Hooks request with context
            service_metadata: Optional metadata (not used for local services)

        Returns:
            CDSHookResponse with generated cards

        Raises:
            ValueError: If python-class extension not found
            ImportError: If service class cannot be imported
            Exception: If service execution fails
        """
        try:
            service_id = plan_definition.get("id", "unknown")
            logger.info(f"Executing local service: {service_id}")

            # Extract Python class from extension
            python_class = self.extract_extension_value(
                plan_definition,
                "http://wintehr.local/fhir/StructureDefinition/python-class"
            )

            if not python_class:
                raise ValueError(f"No python-class extension found for service {service_id}")

            logger.debug(f"  Python class: {python_class}")

            # Import and instantiate service
            service_instance = self._get_service_instance(python_class, service_id)

            # Execute service
            logger.debug(f"  Executing service logic...")
            result = service_instance.execute(
                context=hook_request.context,
                prefetch=hook_request.prefetch or {}
            )

            # Handle different return types
            if isinstance(result, dict):
                # Service returned {"cards": [...]}
                cards = result.get("cards", [])
            elif isinstance(result, list):
                # Service returned list of cards directly
                cards = result
            else:
                logger.warning(f"  Unexpected return type from service: {type(result)}")
                cards = []

            logger.info(f"  ✅ Generated {len(cards)} cards")

            # Convert dict cards to Card objects if needed
            card_objects = []
            for card in cards:
                if isinstance(card, dict):
                    # Convert dict to Card object
                    card_objects.append(Card(**card))
                else:
                    card_objects.append(card)

            return CDSHookResponse(cards=card_objects)

        except ImportError as e:
            error_msg = f"Failed to import service class: {str(e)}"
            logger.error(f"  ❌ {error_msg}")
            raise ImportError(error_msg) from e

        except Exception as e:
            error_msg = f"Failed to execute local service: {str(e)}"
            logger.error(f"  ❌ {error_msg}", exc_info=True)
            raise Exception(error_msg) from e

    def _get_service_instance(self, python_class: str, service_id: str):
        """
        Import and instantiate service class with caching

        Args:
            python_class: Full Python class path (e.g., "api.cds_hooks.cds_services_fhir.DiabetesManagementService")
            service_id: Service identifier for cache key

        Returns:
            Instantiated service class

        Raises:
            ImportError: If class cannot be imported
        """
        # Check cache first
        if service_id in self._service_cache:
            logger.debug(f"  Using cached service instance")
            return self._service_cache[service_id]

        # Parse module and class name
        parts = python_class.rsplit('.', 1)
        if len(parts) != 2:
            raise ImportError(f"Invalid Python class path: {python_class}")

        module_path, class_name = parts

        logger.debug(f"  Importing module: {module_path}")
        logger.debug(f"  Class name: {class_name}")

        # Dynamically import module
        try:
            module = importlib.import_module(module_path)
        except ModuleNotFoundError as e:
            raise ImportError(f"Module not found: {module_path}") from e

        # Get class from module
        if not hasattr(module, class_name):
            raise ImportError(f"Class {class_name} not found in module {module_path}")

        service_class = getattr(module, class_name)

        # Instantiate service
        service_instance = service_class()

        # Cache instance for reuse
        self._service_cache[service_id] = service_instance

        logger.debug(f"  Service class instantiated and cached")

        return service_instance

    def clear_cache(self):
        """
        Clear the service instance cache

        Useful for testing or when service implementations are updated.
        """
        logger.info("Clearing local service cache")
        self._service_cache.clear()

    def get_cached_services(self) -> List[str]:
        """
        Get list of cached service IDs

        Returns:
            List of service IDs currently in cache
        """
        return list(self._service_cache.keys())
