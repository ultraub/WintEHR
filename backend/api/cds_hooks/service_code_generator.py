"""
Service Code Generator - Visual Configuration to Python Service Class

Converts visual CDS service configurations into executable Python service classes.
Generates code following the existing service registry pattern with proper
FHIR integration, condition evaluation, and card generation.

Educational notes:
- Demonstrates code generation patterns
- Shows template-based code construction
- Maintains service registry compatibility
- Generates type-safe Python code
"""

from typing import Dict, List, Any, Optional
import textwrap
import hashlib
from datetime import datetime


class ServiceCodeGenerator:
    """
    Generates executable Python CDS service code from visual configurations

    Educational aspects:
    - Template-based code generation
    - AST-safe code construction
    - FHIR integration patterns
    - Clinical rule code generation
    """

    def __init__(self):
        self.indent_level = 0
        self.indent_size = 4

    def generate_service_code(
        self,
        service_id: str,
        service_config: Dict[str, Any]
    ) -> str:
        """
        Generate complete Python service class code

        Args:
            service_id: Unique service identifier
            service_config: Visual configuration from frontend

        Returns:
            Complete Python code as string
        """
        # Extract configuration sections
        conditions = service_config.get("conditions", [])
        card = service_config.get("card", {})
        service_type = service_config.get("service_type", "condition-based")
        hook_type = service_config.get("hook_type", "patient-view")
        prefetch = service_config.get("prefetch", {})

        # Generate code sections
        imports = self._generate_imports(service_type, conditions)
        class_name = self._to_class_name(service_id)
        class_def = self._generate_class_definition(class_name, service_id)
        should_execute = self._generate_should_execute(conditions, prefetch)
        execute_method = self._generate_execute_method(card, conditions)
        helper_methods = self._generate_helper_methods(service_type, conditions)

        # Combine all sections
        code_sections = [
            imports,
            "",
            class_def,
            should_execute,
            "",
            execute_method,
            "",
            helper_methods
        ]

        return "\n".join(code_sections)

    def _generate_imports(
        self,
        service_type: str,
        conditions: List[Dict[str, Any]]
    ) -> str:
        """Generate required imports based on service configuration"""

        imports = [
            '"""',
            f'Auto-generated CDS service class',
            f'Generated: {datetime.utcnow().isoformat()}',
            f'Service Type: {service_type}',
            '"""',
            '',
            'from typing import Dict, Any, List, Optional',
            'from datetime import datetime, date, timedelta',
            'import uuid',
            'import logging',
            'from services.fhir_client_config import (',
            '    get_patient,',
            '    search_conditions,',
            '    search_medications,',
            '    search_observations,',
            '    search_allergies',
            ')',
            '',
            'logger = logging.getLogger(__name__)'
        ]

        # Add conditional imports based on conditions
        needs_date_parsing = any(
            self._uses_date_operator(cond)
            for cond in self._flatten_conditions(conditions)
        )

        if needs_date_parsing:
            imports.append('from dateutil import parser')

        return '\n'.join(imports)

    def _generate_class_definition(
        self,
        class_name: str,
        service_id: str
    ) -> str:
        """Generate class definition and initialization"""

        return textwrap.dedent(f'''
        class {class_name}:
            """
            Auto-generated CDS service implementation

            Service ID: {service_id}
            Educational aspects:
            - Generated from visual configuration
            - Follows service registry pattern
            - Implements FHIR-based clinical logic
            """

            def __init__(self):
                self.service_id = "{service_id}"
        ''').strip()

    def _generate_should_execute(
        self,
        conditions: List[Dict[str, Any]],
        prefetch: Dict[str, str]
    ) -> str:
        """Generate should_execute method with condition evaluation"""

        method_start = textwrap.dedent('''

        async def should_execute(
            self,
            context: Dict[str, Any],
            prefetch: Dict[str, Any]
        ) -> bool:
            """
            Evaluate conditions to determine if service should execute

            Educational notes:
            - Converts visual conditions to Python logic
            - Handles nested condition groups
            - Integrates with FHIR data
            """
            try:
                patient_id = context.get('patientId', '').replace('Patient/', '')
                if not patient_id:
                    return False
        ''').strip()

        # Generate condition evaluation logic
        condition_logic = self._generate_condition_logic(conditions, indent=2)

        method_end = textwrap.dedent('''
            except Exception as e:
                logger.error(f"Error in should_execute: {e}")
                return False
        ''').strip()

        return "\n".join([
            method_start,
            "",
            condition_logic,
            "",
            method_end
        ])

    def _generate_condition_logic(
        self,
        conditions: List[Dict[str, Any]],
        indent: int = 0
    ) -> str:
        """
        Generate Python code for condition evaluation

        Handles:
        - Nested condition groups (AND/OR/NOT)
        - Individual conditions with operators
        - FHIR data access
        """
        if not conditions or len(conditions) == 0:
            return self._indent("return True", indent)

        # Get root condition group
        root_group = conditions[0]
        if root_group.get("type") != "group":
            return self._indent("return True", indent)

        return self._evaluate_condition_group(root_group, indent)

    def _evaluate_condition_group(
        self,
        group: Dict[str, Any],
        indent: int
    ) -> str:
        """Generate code for a condition group with logical operator"""

        operator = group.get("operator", "AND")
        conditions = group.get("conditions", [])

        if len(conditions) == 0:
            return self._indent("return True", indent)

        # Generate code for each condition
        condition_checks = []
        for idx, condition in enumerate(conditions):
            if condition.get("type") == "group":
                # Nested group - recursive evaluation
                check = self._evaluate_condition_group(condition, 0)
                condition_checks.append(f"({check})")
            else:
                # Individual condition
                check = self._evaluate_single_condition(condition)
                condition_checks.append(check)

        # Combine with logical operator
        if operator == "AND":
            logic = " and ".join(condition_checks)
        elif operator == "OR":
            logic = " or ".join(condition_checks)
        elif operator == "NOT":
            logic = f"not ({condition_checks[0]})"
        else:
            logic = " and ".join(condition_checks)

        return self._indent(f"return {logic}", indent)

    def _evaluate_single_condition(
        self,
        condition: Dict[str, Any]
    ) -> str:
        """Generate code for a single condition evaluation"""

        data_source = condition.get("dataSource", "")
        operator = condition.get("operator", "equals")
        value = condition.get("value", "")
        catalog_selection = condition.get("catalogSelection", {})

        # Map data source to evaluation code
        if data_source == "patient.age":
            return self._evaluate_age_condition(operator, value)
        elif data_source == "conditions":
            return self._evaluate_condition_existence(operator, catalog_selection)
        elif data_source == "medications":
            return self._evaluate_medication_condition(operator, catalog_selection)
        elif data_source == "lab.value":
            return self._evaluate_lab_value(operator, value, catalog_selection)
        elif data_source == "vitals":
            return self._evaluate_vital_sign(operator, value, catalog_selection)
        elif data_source == "screening.gap":
            return self._evaluate_screening_gap(operator, value, catalog_selection)
        else:
            return "True"  # Unknown data source - default to True

    def _evaluate_age_condition(self, operator: str, value: Any) -> str:
        """Generate age comparison code"""

        age_calc = "(datetime.now().date() - parser.parse(patient.birthDate.as_json()).date()).days // 365"

        op_map = {
            ">=": ">=",
            "<=": "<=",
            ">": ">",
            "<": "<",
            "==": "==",
            "equals": "=="
        }

        python_op = op_map.get(operator, ">=")
        return f"({age_calc} {python_op} {value})"

    def _evaluate_condition_existence(
        self,
        operator: str,
        catalog_selection: Dict[str, Any]
    ) -> str:
        """Generate condition existence check code"""

        if operator == "exists":
            condition_code = catalog_selection.get("code", "")
            condition_display = catalog_selection.get("display", "")

            return f"any('{condition_display.lower()}' in (c.code.text.lower() if c.code and c.code.text else '') for c in search_conditions(patient_id, status='active'))"
        elif operator == "notExists":
            condition_code = catalog_selection.get("code", "")
            condition_display = catalog_selection.get("display", "")

            return f"not any('{condition_display.lower()}' in (c.code.text.lower() if c.code and c.code.text else '') for c in search_conditions(patient_id, status='active'))"
        else:
            return "True"

    def _evaluate_medication_condition(
        self,
        operator: str,
        catalog_selection: Dict[str, Any]
    ) -> str:
        """Generate medication check code"""

        med_display = catalog_selection.get("display", "")

        if operator == "taking":
            return f"any('{med_display.lower()}' in (m.medicationCodeableConcept.text.lower() if m.medicationCodeableConcept and m.medicationCodeableConcept.text else '') for m in search_medications(patient_id, status='active'))"
        elif operator == "notTaking":
            return f"not any('{med_display.lower()}' in (m.medicationCodeableConcept.text.lower() if m.medicationCodeableConcept and m.medicationCodeableConcept.text else '') for m in search_medications(patient_id, status='active'))"
        else:
            return "True"

    def _evaluate_lab_value(
        self,
        operator: str,
        value: Any,
        catalog_selection: Dict[str, Any]
    ) -> str:
        """Generate lab value comparison code"""

        lab_code = catalog_selection.get("code", "4548-4")  # Default to HbA1c

        op_map = {
            ">=": ">=",
            "<=": "<=",
            ">": ">",
            "<": "<",
            "==": "=="
        }

        python_op = op_map.get(operator, ">=")

        return f"any(obs.valueQuantity and obs.valueQuantity.value and obs.valueQuantity.value {python_op} {value} for obs in search_observations(patient_id, code='{lab_code}'))"

    def _evaluate_vital_sign(
        self,
        operator: str,
        value: Any,
        catalog_selection: Dict[str, Any]
    ) -> str:
        """Generate vital sign evaluation code"""

        vital_code = catalog_selection.get("code", "")

        op_map = {
            ">=": ">=",
            "<=": "<=",
            ">": ">",
            "<": "<"
        }

        python_op = op_map.get(operator, ">=")

        return f"any(obs.valueQuantity and obs.valueQuantity.value and obs.valueQuantity.value {python_op} {value} for obs in search_observations(patient_id, code='{vital_code}', category='vital-signs'))"

    def _evaluate_screening_gap(
        self,
        operator: str,
        value: Any,
        catalog_selection: Dict[str, Any]
    ) -> str:
        """Generate screening gap evaluation code"""

        screening_code = catalog_selection.get("code", "")
        days = int(value)

        if operator == "olderThanDays":
            return f"not any((datetime.now().date() - parser.parse(obs.effectiveDateTime.as_json()).date()).days < {days} for obs in search_observations(patient_id, code='{screening_code}'))"
        else:
            return "True"

    def _generate_execute_method(
        self,
        card: Dict[str, Any],
        conditions: List[Dict[str, Any]]
    ) -> str:
        """Generate execute method with card creation"""

        summary = card.get("summary", "Clinical recommendation")
        detail = card.get("detail", "")
        indicator = card.get("indicator", "info")
        source = card.get("source", {})
        suggestions = card.get("suggestions", [])
        links = card.get("links", [])

        method_start = textwrap.dedent(f'''
        async def execute(
            self,
            context: Dict[str, Any],
            prefetch: Dict[str, Any]
        ) -> Dict[str, Any]:
            """
            Execute service and generate CDS cards

            Educational notes:
            - Creates spec-compliant CDS Hooks cards
            - Integrates clinical data into card content
            - Supports suggestions and links
            """
            cards = []

            try:
                patient_id = context.get('patientId', '').replace('Patient/', '')
                if not patient_id:
                    return {{"cards": []}}

                # Fetch patient data
                patient = get_patient(patient_id)
                if not patient:
                    return {{"cards": []}}
        ''').strip()

        # Generate card creation
        card_creation = self._generate_card_creation(
            summary, detail, indicator, source, suggestions, links
        )

        method_end = textwrap.dedent('''
            except Exception as e:
                logger.error(f"Error in execute: {e}", exc_info=True)
                cards.append(self.create_card(
                    summary="CDS Service Error",
                    detail=f"Unable to execute service: {str(e)}",
                    indicator="warning"
                ))

            return {"cards": cards}
        ''').strip()

        return "\n".join([
            method_start,
            "",
            card_creation,
            "",
            method_end
        ])

    def _generate_card_creation(
        self,
        summary: str,
        detail: str,
        indicator: str,
        source: Dict[str, Any],
        suggestions: List[Dict[str, Any]],
        links: List[Dict[str, Any]]
    ) -> str:
        """Generate code to create CDS card"""

        source_label = source.get("label", "WintEHR CDS")
        source_url = source.get("url", "")

        card_code = [
            self._indent("# Create clinical recommendation card", 2),
            self._indent("card = {", 2),
            self._indent(f'"uuid": str(uuid.uuid4()),', 3),
            self._indent(f'"summary": "{summary}",', 3),
            self._indent(f'"detail": "{detail}",', 3),
            self._indent(f'"indicator": "{indicator}",', 3),
            self._indent('"source": {', 3),
            self._indent(f'"label": "{source_label}"', 4)
        ]

        if source_url:
            card_code.append(self._indent(f'"url": "{source_url}"', 4))

        card_code.append(self._indent('}', 3))

        # Add suggestions if present
        if suggestions and len(suggestions) > 0:
            card_code.append(self._indent('"suggestions": [', 3))

            for suggestion in suggestions:
                card_code.extend(self._generate_suggestion_code(suggestion, 4))

            card_code.append(self._indent('],', 3))

        # Add links if present
        if links and len(links) > 0:
            card_code.append(self._indent('"links": [', 3))

            for link in links:
                card_code.append(self._indent('{', 4))
                card_code.append(self._indent(f'"label": "{link.get("label", "")}",', 5))
                card_code.append(self._indent(f'"url": "{link.get("url", "")}",', 5))
                card_code.append(self._indent(f'"type": "{link.get("type", "absolute")}"', 5))
                card_code.append(self._indent('},', 4))

            card_code.append(self._indent(']', 3))

        card_code.append(self._indent('}', 2))
        card_code.append(self._indent('cards.append(card)', 2))

        return "\n".join(card_code)

    def _generate_suggestion_code(
        self,
        suggestion: Dict[str, Any],
        indent: int
    ) -> List[str]:
        """Generate code for a card suggestion"""

        code = [
            self._indent('{', indent),
            self._indent(f'"label": "{suggestion.get("label", "")}",', indent + 1),
            self._indent(f'"uuid": str(uuid.uuid4()),', indent + 1),
            self._indent(f'"isRecommended": {suggestion.get("isRecommended", False)},', indent + 1)
        ]

        actions = suggestion.get("actions", [])
        if actions:
            code.append(self._indent('"actions": [', indent + 1))

            for action in actions:
                code.append(self._indent('{', indent + 2))
                code.append(self._indent(f'"type": "{action.get("type", "create")}",', indent + 3))
                code.append(self._indent(f'"description": "{action.get("description", "")}",', indent + 3))

                resource = action.get("resource", {})
                if resource:
                    code.append(self._indent('"resource": ' + str(resource), indent + 3))

                code.append(self._indent('},', indent + 2))

            code.append(self._indent(']', indent + 1))

        code.append(self._indent('},', indent))

        return code

    def _generate_helper_methods(
        self,
        service_type: str,
        conditions: List[Dict[str, Any]]
    ) -> str:
        """Generate helper methods for the service"""

        create_card_method = textwrap.dedent('''
        def create_card(
            self,
            summary: str,
            detail: str,
            indicator: str = "info",
            source: Dict[str, str] = None,
            suggestions: List[Dict[str, Any]] = None,
            links: List[Dict[str, str]] = None
        ) -> Dict[str, Any]:
            """Helper method to create a CDS Hooks card"""
            card = {
                "uuid": str(uuid.uuid4()),
                "summary": summary,
                "detail": detail,
                "indicator": indicator,
                "source": source or {"label": "WintEHR CDS"}
            }

            if suggestions:
                card["suggestions"] = suggestions
            if links:
                card["links"] = links

            return card
        ''').strip()

        return create_card_method

    # Utility methods

    def _to_class_name(self, service_id: str) -> str:
        """Convert service ID to Python class name"""
        # Remove hyphens, capitalize words
        words = service_id.replace('-', ' ').split()
        return ''.join(word.capitalize() for word in words) + 'Service'

    def _indent(self, text: str, level: int) -> str:
        """Add indentation to text"""
        return ' ' * (level * self.indent_size) + text

    def _flatten_conditions(
        self,
        conditions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Flatten nested condition groups into list of individual conditions"""
        result = []

        for condition in conditions:
            if condition.get("type") == "group":
                result.extend(self._flatten_conditions(condition.get("conditions", [])))
            else:
                result.append(condition)

        return result

    def _uses_date_operator(self, condition: Dict[str, Any]) -> bool:
        """Check if condition uses date-based operators"""
        operator = condition.get("operator", "")
        return operator in ["withinDays", "olderThanDays", "withinYears"]

    def generate_code_hash(self, code: str) -> str:
        """Generate hash of generated code for change detection"""
        return hashlib.sha256(code.encode()).hexdigest()

    def generate_service_registration(
        self,
        service_id: str,
        service_config: Dict[str, Any],
        class_name: str
    ) -> str:
        """Generate service registration code for service_registry.py"""

        hook_type = service_config.get("hook_type", "patient-view")
        name = service_config.get("name", service_id)
        description = service_config.get("description", f"Auto-generated service: {name}")
        prefetch = service_config.get("prefetch", {})

        registration = textwrap.dedent(f'''
        # Auto-generated service registration
        {service_id.replace("-", "_")}_def = ServiceDefinition(
            id="{service_id}",
            hook="{hook_type}",
            title="{name}",
            description="{description}",
            prefetch={prefetch},
            usageRequirements="Auto-generated from visual builder"
        )
        {service_id.replace("-", "_")}_impl = {class_name}()
        service_registry.register_service(
            {service_id.replace("-", "_")}_def,
            {service_id.replace("-", "_")}_impl
        )
        ''').strip()

        return registration


# Example usage and testing
if __name__ == "__main__":
    generator = ServiceCodeGenerator()

    # Example: Diabetes screening service
    example_config = {
        "service_type": "preventive-care",
        "hook_type": "patient-view",
        "name": "Diabetes Screening Reminder",
        "description": "Reminds providers to screen eligible patients for diabetes",
        "conditions": [
            {
                "type": "group",
                "operator": "AND",
                "conditions": [
                    {
                        "type": "condition",
                        "dataSource": "patient.age",
                        "operator": ">=",
                        "value": 35
                    },
                    {
                        "type": "condition",
                        "dataSource": "screening.gap",
                        "operator": "olderThanDays",
                        "value": 1095,
                        "catalogSelection": {
                            "code": "4548-4",
                            "display": "Hemoglobin A1c"
                        }
                    }
                ]
            }
        ],
        "card": {
            "summary": "Patient due for diabetes screening",
            "detail": "Patient is over 35 and has no A1C test in past 3 years. Consider ordering hemoglobin A1C.",
            "indicator": "info",
            "source": {
                "label": "ADA Diabetes Guidelines",
                "url": "https://diabetes.org/guidelines"
            },
            "suggestions": [
                {
                    "label": "Order A1C Test",
                    "isRecommended": True,
                    "actions": [
                        {
                            "type": "create",
                            "description": "Order Hemoglobin A1C",
                            "resource": {
                                "resourceType": "ServiceRequest",
                                "code": {
                                    "coding": [
                                        {
                                            "system": "http://loinc.org",
                                            "code": "4548-4",
                                            "display": "Hemoglobin A1c"
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            ]
        },
        "prefetch": {
            "patient": "Patient/{{context.patientId}}",
            "recentLabs": "Observation?patient={{context.patientId}}&code=4548-4"
        }
    }

    # Generate code
    code = generator.generate_service_code("diabetes-screening-reminder", example_config)
    print("Generated Code:")
    print("=" * 80)
    print(code)
    print("=" * 80)

    # Generate code hash
    code_hash = generator.generate_code_hash(code)
    print(f"\nCode Hash: {code_hash}")

    # Generate registration
    registration = generator.generate_service_registration(
        "diabetes-screening-reminder",
        example_config,
        "DiabetesScreeningReminderService"
    )
    print("\nRegistration Code:")
    print("=" * 80)
    print(registration)
