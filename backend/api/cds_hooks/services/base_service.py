"""
CDS Hooks Service Base Class

Unified base class for all CDS Hook service implementations.
Consolidates patterns from service_implementations.py and service_registry.py.

Educational Focus:
- Demonstrates clean abstract base class pattern
- Shows async service execution model
- Illustrates CDS Hooks 2.0 compliance
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from enum import Enum
import logging

from ..models import Card, IndicatorType, Source, Suggestion, Link

logger = logging.getLogger(__name__)


class HookType(str, Enum):
    """
    CDS Hooks 2.0 hook types.

    Each hook type corresponds to a specific clinical workflow trigger point.
    """
    PATIENT_VIEW = "patient-view"
    ORDER_SELECT = "order-select"
    ORDER_SIGN = "order-sign"
    MEDICATION_PRESCRIBE = "medication-prescribe"
    ORDER_DISPATCH = "order-dispatch"
    ENCOUNTER_START = "encounter-start"
    ENCOUNTER_DISCHARGE = "encounter-discharge"
    APPOINTMENT_BOOK = "appointment-book"
    ORDER_REVIEW = "order-review"
    PROBLEM_LIST_UPDATE = "problem-list-update"
    CUSTOM = "custom"


class CDSService(ABC):
    """
    Abstract base class for CDS Hook services.

    All CDS services should inherit from this class and implement:
    - should_execute(): Determine if service should run for given context
    - execute(): Generate recommendation cards

    Class Attributes:
        service_id: Unique identifier for the service (used in URLs)
        hook_type: The CDS Hook type this service responds to
        title: Human-readable service name
        description: Detailed description of what the service does
        prefetch_templates: FHIR query templates for prefetch data
        usageRequirements: Optional usage guidance for the service

    Educational Notes:
        - Services are registered in the ServiceRegistry
        - The orchestrator handles parallel execution of multiple services
        - Prefetch templates use {{context.patientId}} syntax for variable substitution
    """

    # Class-level metadata (override in subclasses)
    service_id: str = ""
    hook_type: HookType = HookType.PATIENT_VIEW
    title: str = ""
    description: str = ""
    prefetch_templates: Dict[str, str] = {}
    usageRequirements: Optional[str] = None

    def __init__(self, service_id: Optional[str] = None):
        """
        Initialize the CDS service.

        Args:
            service_id: Optional override for the service ID. If not provided,
                       uses the class-level service_id attribute.
        """
        if service_id:
            self.service_id = service_id

        if not self.service_id:
            raise ValueError(
                f"{self.__class__.__name__} must have a service_id defined"
            )

    @abstractmethod
    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> bool:
        """
        Determine if this service should execute for the given context.

        Override this method to implement conditional execution logic.
        Return False to skip service execution (e.g., wrong patient demographics,
        missing required data, etc.)

        Args:
            context: CDS Hooks context object containing:
                - patientId: FHIR Patient ID
                - userId: FHIR Practitioner ID
                - Additional hook-specific context fields
            prefetch: Pre-fetched FHIR resources based on prefetch_templates

        Returns:
            True if the service should execute, False to skip

        Educational Notes:
            - Use this for early filtering to avoid unnecessary processing
            - Check for required prefetch data availability
            - Implement demographic or clinical filtering here
        """
        pass

    @abstractmethod
    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> List[Card]:
        """
        Execute the CDS service and generate recommendation cards.

        This is the main service logic. Analyze the context and prefetch data
        to generate clinical decision support cards.

        Args:
            context: CDS Hooks context object
            prefetch: Pre-fetched FHIR resources

        Returns:
            List of Card objects representing clinical recommendations

        Educational Notes:
            - Each card represents a distinct clinical recommendation
            - Cards can have different indicator levels (info, warning, critical)
            - Include suggestions for actionable recommendations
            - Always include source attribution
        """
        pass

    def create_card(
        self,
        summary: str,
        indicator: str = "info",
        detail: Optional[str] = None,
        source_label: Optional[str] = None,
        source_url: Optional[str] = None,
        suggestions: Optional[List[Dict[str, Any]]] = None,
        links: Optional[List[Dict[str, Any]]] = None,
        override_reasons: Optional[List[Dict[str, str]]] = None,
        selection_behavior: Optional[str] = None
    ) -> Card:
        """
        Create a CDS Hooks compliant Card object.

        Helper method to construct properly formatted recommendation cards.

        Args:
            summary: One-sentence summary of the recommendation (required)
            indicator: Urgency level - "info", "warning", or "critical"
            detail: Optional detailed markdown content
            source_label: Name of the source/guideline (defaults to service title)
            source_url: Optional URL to the source guideline
            suggestions: List of suggested actions (FHIR resource operations)
            links: List of external links for more information
            override_reasons: List of coded reasons to override the card
            selection_behavior: How multiple suggestions should be handled

        Returns:
            Card object ready for inclusion in CDS response

        Educational Notes:
            - summary should be clear and actionable
            - indicator should match clinical urgency
            - Always provide source attribution for trust
            - suggestions enable "one-click" actions in the EMR
        """
        # Validate indicator
        try:
            indicator_type = IndicatorType(indicator)
        except ValueError:
            logger.warning(
                f"Invalid indicator '{indicator}' for service {self.service_id}, "
                f"defaulting to 'info'"
            )
            indicator_type = IndicatorType.INFO

        # Build source object
        source = Source(
            label=source_label or self.title or self.service_id,
            url=source_url
        )

        # Convert suggestion dicts to Suggestion objects if provided
        suggestion_objects = None
        if suggestions:
            suggestion_objects = [
                Suggestion(
                    label=s.get("label", ""),
                    uuid=s.get("uuid"),
                    isRecommended=s.get("isRecommended", False),
                    actions=s.get("actions", [])
                )
                for s in suggestions
            ]

        # Convert link dicts to Link objects if provided
        link_objects = None
        if links:
            link_objects = [
                Link(
                    label=l.get("label", ""),
                    url=l.get("url", ""),
                    type=l.get("type", "absolute"),
                    appContext=l.get("appContext")
                )
                for l in links
            ]

        return Card(
            summary=summary,
            indicator=indicator_type,
            detail=detail,
            source=source,
            suggestions=suggestion_objects,
            links=link_objects,
            overrideReasons=override_reasons,
            selectionBehavior=selection_behavior
        )

    def get_service_definition(self) -> Dict[str, Any]:
        """
        Generate CDS Hooks service discovery definition.

        Returns the service metadata in the format required by
        the CDS Hooks discovery endpoint (/cds-services).

        Returns:
            Dictionary containing service definition for discovery

        Educational Notes:
            - This is what EMRs see when they query /cds-services
            - prefetch templates tell the EMR what data to include
            - hook tells the EMR when to call this service
        """
        definition = {
            "id": self.service_id,
            "hook": self.hook_type.value,
            "title": self.title,
            "description": self.description,
        }

        if self.prefetch_templates:
            definition["prefetch"] = self.prefetch_templates

        if self.usageRequirements:
            definition["usageRequirements"] = self.usageRequirements

        return definition

    async def validate_context(self, context: Dict[str, Any]) -> bool:
        """
        Validate that required context fields are present.

        Override this method to add custom validation logic.

        Args:
            context: CDS Hooks context object

        Returns:
            True if context is valid, False otherwise
        """
        # Basic validation - patientId is typically required
        if "patientId" not in context:
            logger.warning(
                f"Service {self.service_id}: Missing patientId in context"
            )
            return False
        return True

    async def validate_prefetch(self, prefetch: Dict[str, Any]) -> bool:
        """
        Validate that required prefetch data is present.

        Override this method to add custom prefetch validation.

        Args:
            prefetch: Pre-fetched FHIR resources

        Returns:
            True if prefetch data is valid, False otherwise
        """
        # Check that all required prefetch keys have data
        for key in self.prefetch_templates:
            if key not in prefetch or prefetch[key] is None:
                logger.debug(
                    f"Service {self.service_id}: Missing prefetch data for '{key}'"
                )
                # Missing prefetch is often OK - service should handle gracefully
        return True

    def __repr__(self) -> str:
        return (
            f"<{self.__class__.__name__}("
            f"service_id='{self.service_id}', "
            f"hook_type='{self.hook_type.value}')>"
        )


class SimpleCDSService(CDSService):
    """
    Simplified CDS service base class with default should_execute implementation.

    Use this base class for services that should always execute when called
    (i.e., no conditional filtering needed).

    Educational Notes:
        - Inherits all CDSService functionality
        - Provides default should_execute that returns True
        - Still requires implementing execute()
    """

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> bool:
        """
        Default implementation that always returns True.

        Override if you need conditional execution logic.
        """
        # Validate context first
        if not await self.validate_context(context):
            return False
        return True
