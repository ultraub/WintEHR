"""
Visual Service Provider - Execute visual builder CDS services

Educational aspects:
- Evaluates condition trees from visual builder
- Generates cards from visual configuration
- Integrates with FHIR data sources
- Demonstrates rule-based decision support
"""

import logging
import uuid
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession

from api.cds_hooks.models import (
    CDSHookRequest, CDSHookResponse, Card, IndicatorType, Source,
    Suggestion, Action, ActionType, Link, LinkType
)
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

            # Per-execution cache to avoid duplicate FHIR reads
            self._cache: Dict[str, Any] = {}

            # Extract patient ID from context
            patient_id = self._extract_patient_id(request)
            if not patient_id:
                logger.warning("No patient ID in context")
                return CDSHookResponse(cards=[])

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
        - catalogSelection provides LOINC/SNOMED codes for lab/vital lookups
        """
        try:
            data_source = condition.get("dataSource")
            operator = condition.get("operator")
            expected_value = condition.get("value")
            catalog_selection = condition.get("catalogSelection")

            if not data_source or not operator:
                logger.warning("Condition missing dataSource or operator")
                return False

            # Fetch actual value from FHIR data
            actual_value = await self._fetch_data_source_value(
                data_source,
                patient_id,
                request,
                catalog_selection=catalog_selection
            )

            # Compare actual vs expected
            result = self._apply_operator(actual_value, operator, expected_value)

            logger.info(
                f"Condition evaluation: {data_source} {operator} {expected_value} "
                f"| actual={actual_value} | result={result}"
            )

            return result

        except Exception as e:
            logger.error(f"Error evaluating condition: {e}")
            return False

    async def _get_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Get Patient resource with per-execution caching"""
        cache_key = f"Patient/{patient_id}"
        if cache_key not in self._cache:
            self._cache[cache_key] = await self.hapi_client.read("Patient", patient_id)
        return self._cache[cache_key]

    async def _search_cached(
        self, resource_type: str, params: Dict[str, str]
    ) -> Dict[str, Any]:
        """Search FHIR resources with per-execution caching"""
        cache_key = f"{resource_type}?{'&'.join(f'{k}={v}' for k, v in sorted(params.items()))}"
        if cache_key not in self._cache:
            self._cache[cache_key] = await self.hapi_client.search(resource_type, params)
        return self._cache[cache_key]

    def _extract_display_names(
        self, bundle: Dict[str, Any], code_paths: List[str]
    ) -> Set[str]:
        """
        Extract human-readable display names from FHIR bundle entries.

        Args:
            bundle: FHIR Bundle response
            code_paths: Dot-notation paths to CodeableConcept fields
                        e.g. ["code", "medicationCodeableConcept"]
        """
        names: Set[str] = set()
        for entry in bundle.get("entry", []):
            resource = entry.get("resource", {})
            for path in code_paths:
                cc = resource
                for segment in path.split("."):
                    cc = cc.get(segment, {}) if isinstance(cc, dict) else {}
                # CodeableConcept → text or coding[0].display
                if isinstance(cc, dict):
                    text = cc.get("text")
                    if text:
                        names.add(text)
                    for coding in cc.get("coding", []):
                        display = coding.get("display")
                        if display:
                            names.add(display)
        return names

    async def _fetch_data_source_value(
        self,
        data_source: str,
        patient_id: str,
        request: CDSHookRequest,
        catalog_selection: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Fetch value from FHIR data source

        Supported data sources:
        - patient.age: Patient age in years (int)
        - patient.gender: Patient gender string
        - conditions: Set of active condition display names
        - medications: Set of active medication display names
        - allergies: Set of allergy substance display names
        - lab.value: Most recent lab result value (float) for a given LOINC code
        - vital.value: Most recent vital sign value (float) for a given LOINC code
        - encounter.lastDate: Date string of most recent encounter
        - screening.gap: Days since last observation matching a code (int)
        """
        try:
            if data_source == "patient.age":
                patient = await self._get_patient(patient_id)
                birth_date = patient.get("birthDate") if patient else None
                if birth_date:
                    birth = datetime.fromisoformat(birth_date).date()
                    today = date.today()
                    age = today.year - birth.year - (
                        (today.month, today.day) < (birth.month, birth.day)
                    )
                    return age
                return None

            elif data_source == "patient.gender":
                patient = await self._get_patient(patient_id)
                return patient.get("gender") if patient else None

            elif data_source == "conditions":
                bundle = await self._search_cached("Condition", {
                    "patient": patient_id,
                    "clinical-status": "active"
                })
                return self._extract_display_names(bundle, ["code"])

            elif data_source == "medications":
                bundle = await self._search_cached("MedicationRequest", {
                    "patient": patient_id,
                    "status": "active"
                })
                return self._extract_display_names(
                    bundle, ["medicationCodeableConcept", "medicationReference.display"]
                )

            elif data_source == "allergies":
                bundle = await self._search_cached("AllergyIntolerance", {
                    "patient": patient_id
                })
                # AllergyIntolerance uses code for the substance
                return self._extract_display_names(bundle, ["code"])

            elif data_source == "lab.value":
                code = self._get_catalog_code(catalog_selection)
                if not code:
                    logger.warning("lab.value requires catalogSelection with code")
                    return None
                bundle = await self._search_cached("Observation", {
                    "patient": patient_id,
                    "code": code,
                    "_sort": "-date",
                    "_count": "1"
                })
                return self._extract_observation_value(bundle)

            elif data_source == "vital.value":
                code = self._get_catalog_code(catalog_selection)
                if not code:
                    logger.warning("vital.value requires catalogSelection with code")
                    return None
                bundle = await self._search_cached("Observation", {
                    "patient": patient_id,
                    "code": code,
                    "category": "vital-signs",
                    "_sort": "-date",
                    "_count": "1"
                })
                return self._extract_observation_value(bundle)

            elif data_source == "encounter.lastDate":
                bundle = await self._search_cached("Encounter", {
                    "patient": patient_id,
                    "_sort": "-date",
                    "_count": "1"
                })
                entries = bundle.get("entry", [])
                if entries:
                    encounter = entries[0].get("resource", {})
                    period = encounter.get("period", {})
                    return period.get("start")
                return None

            elif data_source == "screening.gap":
                code = self._get_catalog_code(catalog_selection)
                if not code:
                    logger.warning("screening.gap requires catalogSelection with code")
                    return None
                bundle = await self._search_cached("Observation", {
                    "patient": patient_id,
                    "code": code,
                    "_sort": "-date",
                    "_count": "1"
                })
                entries = bundle.get("entry", [])
                if entries:
                    obs = entries[0].get("resource", {})
                    effective = obs.get("effectiveDateTime") or obs.get("issued")
                    if effective:
                        obs_date = datetime.fromisoformat(
                            effective.replace("Z", "+00:00")
                        ).date()
                        return (date.today() - obs_date).days
                return None

            else:
                logger.warning(f"Unknown data source: {data_source}")
                return None

        except Exception as e:
            logger.error(f"Error fetching data source {data_source}: {e}")
            return None

    def _get_catalog_code(self, catalog_selection: Optional[Dict[str, Any]]) -> Optional[str]:
        """Extract LOINC/SNOMED code from catalog selection"""
        if not catalog_selection:
            return None
        return catalog_selection.get("code")

    def _extract_observation_value(self, bundle: Dict[str, Any]) -> Optional[float]:
        """Extract numeric value from most recent Observation in bundle"""
        entries = bundle.get("entry", [])
        if not entries:
            return None
        obs = entries[0].get("resource", {})
        # Try valueQuantity first (most common)
        vq = obs.get("valueQuantity")
        if vq and "value" in vq:
            return float(vq["value"])
        # Try valueString as numeric fallback
        vs = obs.get("valueString")
        if vs:
            try:
                return float(vs)
            except (ValueError, TypeError):
                return vs
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
        - equals, =, ==, != (equality)
        - >, <, >=, <= (numeric comparison)
        - contains, not_contains (substring/set membership)
        - startsWith, endsWith (string prefix/suffix)
        - exists, notExists (presence check)
        - in, notIn (value in comma-separated list)
        - withinDays, olderThanDays (temporal comparison)
        """
        try:
            # Existence checks (work on None and empty sets)
            if operator in ["exists", "notEmpty"]:
                if actual_value is None:
                    return False
                if isinstance(actual_value, (set, list)):
                    return len(actual_value) > 0
                return True

            if operator in ["notExists", "not_exists", "empty"]:
                if actual_value is None:
                    return True
                if isinstance(actual_value, (set, list)):
                    return len(actual_value) == 0
                return False

            # For remaining operators, coerce types for fair comparison
            # String equality - coerce both to string for comparison
            if operator in ["equals", "=", "=="]:
                if isinstance(actual_value, set):
                    return str(expected_value).lower() in {s.lower() for s in actual_value}
                if isinstance(actual_value, (int, float)) or isinstance(expected_value, (int, float)):
                    try:
                        return float(actual_value) == float(expected_value)
                    except (ValueError, TypeError):
                        pass
                return str(actual_value).lower() == str(expected_value).lower()

            if operator in ["not_equals", "!="]:
                if isinstance(actual_value, set):
                    return str(expected_value).lower() not in {s.lower() for s in actual_value}
                if isinstance(actual_value, (int, float)) or isinstance(expected_value, (int, float)):
                    try:
                        return float(actual_value) != float(expected_value)
                    except (ValueError, TypeError):
                        pass
                return str(actual_value).lower() != str(expected_value).lower()

            # Numeric comparisons
            if operator in ["greater_than", ">"]:
                return float(actual_value) > float(expected_value)

            if operator in ["less_than", "<"]:
                return float(actual_value) < float(expected_value)

            if operator in ["greater_than_or_equal", ">="]:
                return float(actual_value) >= float(expected_value)

            if operator in ["less_than_or_equal", "<="]:
                return float(actual_value) <= float(expected_value)

            # String/set containment
            if operator == "contains":
                if isinstance(actual_value, set):
                    # Check if any item in the set contains the expected substring
                    return any(
                        str(expected_value).lower() in item.lower()
                        for item in actual_value
                    )
                if isinstance(actual_value, list):
                    return any(
                        str(expected_value).lower() in str(item).lower()
                        for item in actual_value
                    )
                return str(expected_value).lower() in str(actual_value).lower()

            if operator == "not_contains":
                if isinstance(actual_value, set):
                    return all(
                        str(expected_value).lower() not in item.lower()
                        for item in actual_value
                    )
                if isinstance(actual_value, list):
                    return all(
                        str(expected_value).lower() not in str(item).lower()
                        for item in actual_value
                    )
                return str(expected_value).lower() not in str(actual_value).lower()

            # String prefix/suffix
            if operator == "startsWith":
                return str(actual_value).lower().startswith(str(expected_value).lower())

            if operator == "endsWith":
                return str(actual_value).lower().endswith(str(expected_value).lower())

            # Value in list (expected_value is comma-separated)
            if operator == "in":
                values = [v.strip().lower() for v in str(expected_value).split(",")]
                return str(actual_value).lower() in values

            if operator == "notIn":
                values = [v.strip().lower() for v in str(expected_value).split(",")]
                return str(actual_value).lower() not in values

            # Temporal operators (actual_value should be days as int)
            if operator == "withinDays":
                if actual_value is None:
                    return False
                return int(actual_value) <= int(expected_value)

            if operator == "olderThanDays":
                if actual_value is None:
                    return True  # No observation = older than any threshold
                return int(actual_value) > int(expected_value)

            logger.warning(f"Unknown operator: {operator}")
            return False

        except (ValueError, TypeError) as e:
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
        - Maps suggestions to CDS Hooks Suggestion models with Actions
        - Maps links to CDS Hooks Link models
        - Returns standardized CDS Hooks 2.0 Card format
        """
        try:
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

            # Build suggestions from card config
            suggestions = self._build_suggestions(card_config.get("suggestions", []))

            # Build links from card config
            links = self._build_links(card_config.get("links", []))

            # Create card with required UUID
            card = Card(
                uuid=str(uuid.uuid4()),
                summary=summary,
                detail=detail,
                indicator=indicator,
                source=source,
                suggestions=suggestions if suggestions else None,
                links=links if links else None
            )

            return card

        except Exception as e:
            logger.error(f"Error generating card: {e}")
            return None

    def _build_suggestions(
        self, suggestion_configs: List[Dict[str, Any]]
    ) -> List[Suggestion]:
        """
        Build CDS Hooks Suggestion models from visual builder config.

        Each suggestion can contain actions that create/update/delete FHIR resources.
        """
        suggestions = []
        for cfg in suggestion_configs:
            label = cfg.get("label")
            if not label:
                continue

            # Build actions from the suggestion's action list
            actions = []
            for action_cfg in cfg.get("actions", []):
                action_type_str = action_cfg.get("type", "create").lower()
                action_type_map = {
                    "create": ActionType.CREATE,
                    "update": ActionType.UPDATE,
                    "delete": ActionType.DELETE,
                }
                action_type = action_type_map.get(action_type_str, ActionType.CREATE)

                actions.append(Action(
                    type=action_type,
                    description=action_cfg.get("description"),
                    resource=action_cfg.get("resource")
                ))

            suggestions.append(Suggestion(
                label=label,
                uuid=str(uuid.uuid4()),
                actions=actions if actions else None
            ))

        return suggestions

    def _build_links(self, link_configs: List[Dict[str, Any]]) -> List[Link]:
        """Build CDS Hooks Link models from visual builder config."""
        links = []
        for cfg in link_configs:
            label = cfg.get("label")
            url = cfg.get("url")
            if not label or not url:
                continue

            link_type_str = cfg.get("type", "absolute").lower()
            link_type = LinkType.SMART if link_type_str == "smart" else LinkType.ABSOLUTE

            links.append(Link(
                label=label,
                url=url,
                type=link_type,
                appContext=cfg.get("appContext")
            ))

        return links
