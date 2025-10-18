"""
HAPI FHIR CDS Hooks Integration

Aggregates CDS services from HAPI FHIR (PlanDefinitions) with custom WintEHR services.

Educational Focus:
- HAPI FHIR Clinical Reasoning module integration
- PlanDefinition resource handling
- Service discovery aggregation
- Card merging and prioritization
"""

from typing import List, Dict, Any, Optional
import logging
import asyncio

from services.hapi_fhir_client import HAPIFHIRClient
from .models import CDSService, CDSServicesResponse, CDSHookResponse, Card

logger = logging.getLogger(__name__)


class HAPICDSIntegrator:
    """
    Integrate HAPI FHIR CDS services with custom WintEHR services

    Architecture:
    - HAPI FHIR: Industry-standard CDS Hooks via PlanDefinition resources
    - WintEHR: Custom business logic and educational services
    - Aggregation: Combine both sources for comprehensive decision support
    """

    def __init__(self):
        self.hapi_client = HAPIFHIRClient()
        self.cache = {}  # Simple in-memory cache for PlanDefinitions
        self.cache_ttl = 300  # 5 minutes

    async def discover_hapi_services(self, hook_type: Optional[str] = None) -> List[CDSService]:
        """
        Discover CDS services registered as PlanDefinitions in HAPI FHIR

        Args:
            hook_type: Optional filter by hook type (patient-view, medication-prescribe, etc.)

        Returns:
            List of CDSService definitions from HAPI FHIR

        Educational notes:
        - HAPI FHIR stores CDS services as PlanDefinition resources
        - PlanDefinitions include hook type in extensions
        - Discovery follows CDS Hooks 1.0 specification
        """
        try:
            logger.info("Discovering CDS services from HAPI FHIR PlanDefinitions")

            # Build search parameters
            search_params = {
                "status": "active",  # Only active PlanDefinitions
                "type": "eca-rule",  # Event-Condition-Action rules (CDS services)
                "_count": 100  # Reasonable limit
            }

            # Search for PlanDefinitions
            bundle = await self.hapi_client.search("PlanDefinition", search_params)

            # Convert PlanDefinitions to CDS services
            services = []
            for entry in bundle.get("entry", []):
                plan_def = entry.get("resource", {})

                # Extract CDS metadata from PlanDefinition
                service = self._plan_definition_to_cds_service(plan_def)

                # Filter by hook type if specified
                if hook_type and service.hook != hook_type:
                    continue

                services.append(service)

            logger.info(f"Discovered {len(services)} CDS services from HAPI FHIR")
            return services

        except Exception as e:
            logger.error(f"Error discovering HAPI CDS services: {e}")
            return []

    def _plan_definition_to_cds_service(self, plan_def: Dict[str, Any]) -> CDSService:
        """
        Convert HAPI FHIR PlanDefinition to CDS Hooks service definition

        Args:
            plan_def: PlanDefinition resource from HAPI FHIR

        Returns:
            CDSService object
        """
        # Extract service ID from extensions or use PlanDefinition ID
        service_id = self._extract_extension_value(
            plan_def,
            "http://wintehr.com/fhir/StructureDefinition/cds-hooks-service-id",
            plan_def.get("id")
        )

        # Extract hook type from extensions
        hook_type = self._extract_extension_value(
            plan_def,
            "http://wintehr.com/fhir/StructureDefinition/cds-hooks-hook-type",
            "patient-view"  # Default
        )

        # Build prefetch template from action inputs
        prefetch = self._build_prefetch_from_action(plan_def)

        # Create CDS service definition
        return CDSService(
            id=service_id,
            hook=hook_type,
            title=plan_def.get("title", service_id),
            description=plan_def.get("description", ""),
            prefetch=prefetch,
            usageRequirements=plan_def.get("usage", "")
        )

    def _extract_extension_value(
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
        extensions = resource.get("extension", [])
        for ext in extensions:
            if ext.get("url") == url:
                # Try different value types
                return (
                    ext.get("valueString") or
                    ext.get("valueBoolean") or
                    ext.get("valueCode") or
                    ext.get("valueInteger") or
                    default
                )
        return default

    def _build_prefetch_from_action(self, plan_def: Dict[str, Any]) -> Dict[str, str]:
        """
        Build CDS Hooks prefetch template from PlanDefinition action inputs

        Args:
            plan_def: PlanDefinition resource

        Returns:
            Prefetch dictionary
        """
        prefetch = {}

        actions = plan_def.get("action", [])
        if not actions:
            return prefetch

        # Get first action's inputs
        inputs = actions[0].get("input", [])

        for i, input_req in enumerate(inputs):
            if input_req.get("type") == "DataRequirement":
                # Extract resource type from profile
                profiles = input_req.get("profile", [])
                if profiles:
                    resource_type = profiles[0].split("/")[-1]
                    # Create prefetch key and template
                    prefetch[f"input{i}"] = f"{resource_type}/{{{{context.patientId}}}}"

        return prefetch

    async def execute_hapi_service(
        self,
        service_id: str,
        hook_request: Dict[str, Any]
    ) -> Optional[CDSHookResponse]:
        """
        Execute HAPI FHIR CDS service (apply PlanDefinition)

        Args:
            service_id: CDS service identifier
            hook_request: CDS Hooks request context

        Returns:
            CDSHookResponse with cards, or None if service not found

        Educational notes:
        - Uses HAPI FHIR's $apply operation on PlanDefinition
        - $apply evaluates clinical logic and generates recommendations
        - Results are converted to CDS Hooks card format
        """
        try:
            logger.info(f"Executing HAPI CDS service: {service_id}")

            # Find PlanDefinition for this service
            plan_def = await self._find_plan_definition_by_service_id(service_id)

            if not plan_def:
                logger.warning(f"PlanDefinition not found for service {service_id}")
                return None

            plan_def_id = plan_def.get("id")

            # Build $apply operation parameters
            patient_id = hook_request.get("context", {}).get("patientId", "")
            if not patient_id:
                logger.error("No patient ID in hook request context")
                return None

            # Execute $apply operation
            # Format: PlanDefinition/{id}/$apply?subject=Patient/{patientId}
            operation_path = f"PlanDefinition/{plan_def_id}/$apply"
            params = {
                "subject": patient_id
            }

            result = await self.hapi_client.operation(operation_path, params)

            # Convert HAPI result to CDS Hooks cards
            cards = self._hapi_result_to_cards(result, plan_def)

            return CDSHookResponse(cards=cards)

        except Exception as e:
            logger.error(f"Error executing HAPI CDS service {service_id}: {e}")
            return None

    async def _find_plan_definition_by_service_id(
        self,
        service_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Find PlanDefinition resource by CDS service ID

        Args:
            service_id: CDS Hooks service identifier

        Returns:
            PlanDefinition resource or None
        """
        try:
            # Search for PlanDefinition with matching service ID extension
            bundle = await self.hapi_client.search("PlanDefinition", {
                "status": "active",
                "_count": 100
            })

            # Find matching service
            for entry in bundle.get("entry", []):
                plan_def = entry.get("resource", {})
                plan_def_service_id = self._extract_extension_value(
                    plan_def,
                    "http://wintehr.com/fhir/StructureDefinition/cds-hooks-service-id"
                )

                if plan_def_service_id == service_id:
                    return plan_def

            # Also check if service_id is the PlanDefinition ID itself
            try:
                plan_def = await self.hapi_client.read("PlanDefinition", service_id)
                if plan_def.get("status") == "active":
                    return plan_def
            except:
                pass

            return None

        except Exception as e:
            logger.error(f"Error finding PlanDefinition for service {service_id}: {e}")
            return None

    def _hapi_result_to_cards(
        self,
        hapi_result: Dict[str, Any],
        plan_def: Dict[str, Any]
    ) -> List[Card]:
        """
        Convert HAPI $apply result to CDS Hooks cards

        Args:
            hapi_result: Result from PlanDefinition/$apply operation
            plan_def: Original PlanDefinition resource

        Returns:
            List of CDS Hooks cards
        """
        cards = []

        # HAPI $apply returns a CarePlan with activities
        if hapi_result.get("resourceType") == "CarePlan":
            activities = hapi_result.get("activity", [])

            for activity in activities:
                # Convert activity to card
                card = self._activity_to_card(activity, plan_def)
                if card:
                    cards.append(card)

        # If no activities, create info card
        if not cards:
            cards.append(Card(
                summary=plan_def.get("title", "Clinical Decision Support"),
                detail=plan_def.get("description", "No specific recommendations at this time."),
                indicator="info",
                source={
                    "label": plan_def.get("publisher", "HAPI FHIR CDS"),
                    "url": plan_def.get("url", "")
                }
            ))

        return cards

    def _activity_to_card(
        self,
        activity: Dict[str, Any],
        plan_def: Dict[str, Any]
    ) -> Optional[Card]:
        """
        Convert CarePlan activity to CDS Hooks card

        Args:
            activity: CarePlan activity
            plan_def: Original PlanDefinition

        Returns:
            CDS Hooks card or None
        """
        detail = activity.get("detail", {})

        # Determine card indicator from activity status
        status = detail.get("status", "")
        indicator = "info"
        if status in ["on-hold", "stopped"]:
            indicator = "warning"
        elif status == "entered-in-error":
            indicator = "critical"

        # Build card
        return Card(
            summary=detail.get("description", "Clinical Recommendation"),
            detail=detail.get("code", {}).get("text", ""),
            indicator=indicator,
            source={
                "label": plan_def.get("publisher", "HAPI FHIR CDS"),
                "url": plan_def.get("url", "")
            },
            suggestions=[]  # Could add suggestions from activity details
        )

    async def aggregate_services(
        self,
        custom_services: List[CDSService],
        hook_type: Optional[str] = None
    ) -> CDSServicesResponse:
        """
        Aggregate custom WintEHR services with HAPI FHIR services

        Args:
            custom_services: List of custom WintEHR CDS services
            hook_type: Optional filter by hook type

        Returns:
            Combined CDS services discovery response
        """
        try:
            # Get HAPI services
            hapi_services = await self.discover_hapi_services(hook_type)

            # Combine services (custom first, then HAPI)
            all_services = custom_services + hapi_services

            # Remove duplicates by service ID
            seen_ids = set()
            unique_services = []
            for service in all_services:
                if service.id not in seen_ids:
                    seen_ids.add(service.id)
                    unique_services.append(service)

            logger.info(f"Aggregated {len(unique_services)} total CDS services ({len(custom_services)} custom, {len(hapi_services)} HAPI)")

            return CDSServicesResponse(services=unique_services)

        except Exception as e:
            logger.error(f"Error aggregating services: {e}")
            # Return custom services only on error
            return CDSServicesResponse(services=custom_services)

    async def aggregate_cards(
        self,
        custom_cards: List[Card],
        hapi_cards: List[Card]
    ) -> List[Card]:
        """
        Aggregate and prioritize cards from multiple sources

        Args:
            custom_cards: Cards from custom WintEHR services
            hapi_cards: Cards from HAPI FHIR services

        Returns:
            Prioritized, deduplicated list of cards

        Card prioritization:
        1. Critical alerts first
        2. Warnings second
        3. Info cards last
        4. Within each level, custom cards before HAPI cards
        """
        # Priority map
        indicator_priority = {
            "critical": 0,
            "warning": 1,
            "info": 2,
            "success": 3
        }

        # Combine all cards
        all_cards = []

        # Add custom cards with source tagging
        for card in custom_cards:
            card_dict = card.dict() if hasattr(card, 'dict') else card
            card_dict["_source"] = "custom"
            all_cards.append(card_dict)

        # Add HAPI cards with source tagging
        for card in hapi_cards:
            card_dict = card.dict() if hasattr(card, 'dict') else card
            card_dict["_source"] = "hapi"
            all_cards.append(card_dict)

        # Sort by priority
        sorted_cards = sorted(
            all_cards,
            key=lambda c: (
                indicator_priority.get(c.get("indicator", "info"), 999),
                1 if c.get("_source") == "hapi" else 0  # Custom cards first within priority
            )
        )

        # Remove temporary _source field
        for card in sorted_cards:
            card.pop("_source", None)

        logger.info(f"Aggregated {len(sorted_cards)} cards ({len(custom_cards)} custom, {len(hapi_cards)} HAPI)")

        return sorted_cards


# Singleton instance
_integrator = None


def get_hapi_cds_integrator() -> HAPICDSIntegrator:
    """
    Get singleton HAPI CDS integrator instance

    Usage in FastAPI:
        integrator = get_hapi_cds_integrator()
        services = await integrator.discover_hapi_services()
    """
    global _integrator
    if _integrator is None:
        _integrator = HAPICDSIntegrator()
    return _integrator
