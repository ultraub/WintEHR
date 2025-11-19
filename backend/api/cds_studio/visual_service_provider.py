"""
Visual Service Provider - Execute visual builder CDS services

Educational aspects:
- Evaluates condition trees from visual builder
- Generates cards from visual configuration
- Integrates with FHIR data sources
- Demonstrates rule-based decision support
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from api.cds_hooks.models import CDSHookRequest, CDSHookResponse, Card, IndicatorType, Source
from api.cds_studio.visual_service_config import VisualServiceConfig
from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)


class VisualServiceProvider:
    """
    Provider for executing visual builder CDS services

    Educational notes:
    - Visual services use condition trees to determine when to show cards
    - Conditions are evaluated against FHIR data
    - Cards are constructed from visual builder configuration
    - Supports complex nested conditions (AND, OR, NOT)
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.hapi_client = HAPIFHIRClient()

    async def execute(
        self,
        visual_config: VisualServiceConfig,
        request: CDSHookRequest,
        plan_definition: Dict[str, Any]
    ) -> CDSHookResponse:
        """
        Execute visual service and generate cards

        Args:
            visual_config: Visual service configuration from database
            request: CDS Hooks request with context and prefetch
            plan_definition: FHIR PlanDefinition resource

        Returns:
            CDSHooksResponse with generated cards
        """
        try:
            logger.info(f"Executing visual service: {visual_config.service_id}")

            # Extract patient ID from context
            patient_id = self._extract_patient_id(request)
            if not patient_id:
                logger.warning("No patient ID in context")
                return CDSHooksResponse(cards=[])

            # Evaluate conditions
            conditions_met = await self._evaluate_conditions(
                visual_config.conditions,
                request,
                patient_id
            )

            # Generate cards if conditions met
            cards = []
            if conditions_met:
                card = await self._generate_card(
                    visual_config.card_config,
                    visual_config.display_config,
                    request,
                    patient_id
                )
                if card:
                    cards.append(card)

            logger.info(f"Visual service {visual_config.service_id} returned {len(cards)} cards")
            return CDSHookResponse(cards=cards)

        except Exception as e:
            logger.error(f"Error executing visual service {visual_config.service_id}: {e}")
            # Return empty response on error (fail gracefully)
            return CDSHookResponse(cards=[])

    def _extract_patient_id(self, request: CDSHookRequest) -> Optional[str]:
        """Extract patient ID from CDS Hooks context"""
        context = request.context if isinstance(request.context, dict) else request.context.dict()
        patient_id = context.get("patientId")

        # Handle FHIR reference format (Patient/123 -> 123)
        if patient_id and patient_id.startswith("Patient/"):
            patient_id = patient_id.replace("Patient/", "")

        return patient_id

    async def _evaluate_conditions(
        self,
        conditions: List[Dict[str, Any]],
        request: CDSHookRequest,
        patient_id: str
    ) -> bool:
        """
        Evaluate visual builder condition tree

        Educational notes:
        - Supports nested conditions (groups with AND/OR/NOT)
        - Each condition checks FHIR data against criteria
        - Returns True if all conditions are satisfied
        """
        if not conditions:
            # No conditions = always show card
            return True

        try:
            # Evaluate all top-level conditions
            results = []
            for condition in conditions:
                result = await self._evaluate_condition_node(
                    condition,
                    request,
                    patient_id
                )
                results.append(result)

            # All top-level conditions must be True
            return all(results)

        except Exception as e:
            logger.error(f"Error evaluating conditions: {e}")
            return False

    async def _evaluate_condition_node(
        self,
        node: Dict[str, Any],
        request: CDSHookRequest,
        patient_id: str
    ) -> bool:
        """
        Evaluate a single condition node (condition or group)

        Args:
            node: Condition node from visual builder
            request: CDS Hooks request
            patient_id: Patient ID

        Returns:
            True if condition is met, False otherwise
        """
        node_type = node.get("type")

        if node_type == "condition":
            # Evaluate single condition
            return await self._evaluate_single_condition(node, request, patient_id)

        elif node_type == "group":
            # Evaluate condition group (AND/OR/NOT)
            operator = node.get("operator", "AND")
            # Visual builder uses "conditions" not "children"
            children = node.get("conditions", node.get("children", []))

            if not children:
                return True

            # Recursively evaluate children
            results = []
            for child in children:
                result = await self._evaluate_condition_node(child, request, patient_id)
                results.append(result)

            # Apply logical operator
            if operator == "AND":
                return all(results)
            elif operator == "OR":
                return any(results)
            elif operator == "NOT":
                return not any(results)
            else:
                logger.warning(f"Unknown operator: {operator}")
                return False

        else:
            logger.warning(f"Unknown condition node type: {node_type}")
            return False

    async def _evaluate_single_condition(
        self,
        condition: Dict[str, Any],
        request: CDSHookRequest,
        patient_id: str
    ) -> bool:
        """
        Evaluate a single condition against FHIR data

        Educational notes:
        - Fetches data from HAPI FHIR based on dataSource
        - Applies operator to compare with value
        - Supports various data sources (age, conditions, medications, etc.)
        """
        try:
            data_source = condition.get("dataSource")
            operator = condition.get("operator")
            expected_value = condition.get("value")

            if not data_source or not operator:
                logger.warning("Condition missing dataSource or operator")
                return False

            # Fetch actual value from FHIR data
            actual_value = await self._fetch_data_source_value(
                data_source,
                patient_id,
                request
            )

            # Compare actual vs expected
            result = self._apply_operator(actual_value, operator, expected_value)

            # Debug logging
            logger.info(f"Condition evaluation: {data_source} {operator} {expected_value} | actual={actual_value} | result={result}")

            return result

        except Exception as e:
            logger.error(f"Error evaluating condition: {e}")
            return False

    async def _fetch_data_source_value(
        self,
        data_source: str,
        patient_id: str,
        request: CDSHookRequest
    ) -> Any:
        """
        Fetch value from FHIR data source

        Supported data sources:
        - patient.age: Patient age in years
        - conditions: Active conditions
        - medications: Active medications
        - observations: Recent observations
        - allergies: Allergy intolerances
        """
        try:
            if data_source == "patient.age":
                # Get patient age
                patient = await self.hapi_client.read("Patient", patient_id)
                birth_date = patient.get("birthDate")
                if birth_date:
                    from datetime import date
                    birth = datetime.fromisoformat(birth_date).date()
                    today = date.today()
                    age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                    return age
                return None

            elif data_source.startswith("conditions"):
                # Get active conditions
                bundle = await self.hapi_client.search("Condition", {
                    "patient": patient_id,
                    "clinical-status": "active"
                })
                return bundle.get("entry", [])

            elif data_source.startswith("medications"):
                # Get active medications
                bundle = await self.hapi_client.search("MedicationRequest", {
                    "patient": patient_id,
                    "status": "active"
                })
                return bundle.get("entry", [])

            elif data_source.startswith("observations"):
                # Get recent observations
                bundle = await self.hapi_client.search("Observation", {
                    "patient": patient_id,
                    "_count": "10",
                    "_sort": "-date"
                })
                return bundle.get("entry", [])

            elif data_source.startswith("allergies"):
                # Get allergies
                bundle = await self.hapi_client.search("AllergyIntolerance", {
                    "patient": patient_id
                })
                return bundle.get("entry", [])

            else:
                logger.warning(f"Unknown data source: {data_source}")
                return None

        except Exception as e:
            logger.error(f"Error fetching data source {data_source}: {e}")
            return None

    def _apply_operator(
        self,
        actual_value: Any,
        operator: str,
        expected_value: Any
    ) -> bool:
        """
        Apply comparison operator

        Supported operators:
        - equals, not_equals, =, ==, !=
        - greater_than, less_than, >, <
        - greater_than_or_equal, less_than_or_equal, >=, <=
        - contains, not_contains
        - exists, not_exists
        """
        try:
            if operator == "exists":
                return actual_value is not None and actual_value != []

            if operator == "not_exists":
                return actual_value is None or actual_value == []

            # Support both symbolic and named operators
            if operator in ["equals", "=", "=="]:
                return actual_value == expected_value

            if operator in ["not_equals", "!="]:
                return actual_value != expected_value

            if operator in ["greater_than", ">"]:
                return float(actual_value) > float(expected_value)

            if operator in ["less_than", "<"]:
                return float(actual_value) < float(expected_value)

            if operator in ["greater_than_or_equal", ">="]:
                return float(actual_value) >= float(expected_value)

            if operator in ["less_than_or_equal", "<="]:
                return float(actual_value) <= float(expected_value)

            if operator == "contains":
                # For lists, check if any item contains the value
                if isinstance(actual_value, list):
                    return any(expected_value in str(item) for item in actual_value)
                return expected_value in str(actual_value)

            if operator == "not_contains":
                if isinstance(actual_value, list):
                    return all(expected_value not in str(item) for item in actual_value)
                return expected_value not in str(actual_value)

            logger.warning(f"Unknown operator: {operator}")
            return False

        except Exception as e:
            logger.error(f"Error applying operator {operator}: {e}")
            return False

    async def _generate_card(
        self,
        card_config: Dict[str, Any],
        display_config: Dict[str, Any],
        request: CDSHookRequest,
        patient_id: str
    ) -> Optional[Card]:
        """
        Generate CDS card from visual builder configuration

        Educational notes:
        - Uses card_config for summary, detail, indicator
        - Applies display_config for behavior settings
        - Returns standardized CDS Hooks Card format
        """
        try:
            import uuid

            # Extract card configuration
            summary = card_config.get("summary", "Clinical Alert")
            detail = card_config.get("detail", "")
            indicator_str = card_config.get("indicator", "info")

            # Map string indicator to IndicatorType enum
            indicator_map = {
                "info": IndicatorType.INFO,
                "warning": IndicatorType.WARNING,
                "critical": IndicatorType.CRITICAL,
                "success": IndicatorType.INFO  # Fallback
            }
            indicator = indicator_map.get(indicator_str.lower(), IndicatorType.INFO)

            # Create source
            source = Source(
                label=card_config.get("source", {}).get("label", "Visual Service"),
                url=card_config.get("source", {}).get("url"),
                icon=card_config.get("source", {}).get("icon")
            )

            # Create card with required UUID
            card = Card(
                uuid=str(uuid.uuid4()),  # Generate UUID for card
                summary=summary,
                detail=detail,
                indicator=indicator,
                source=source,
                suggestions=[]  # TODO: Add suggestions support
            )

            return card

        except Exception as e:
            logger.error(f"Error generating card: {e}")
            return None
