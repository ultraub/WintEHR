"""
FHIR Composite Search Parameter Support
Handles composite search parameters according to FHIR R4 specification

Reference: https://www.hl7.org/fhir/search.html#composite
"""

from typing import Dict, List, Tuple, Optional, Any
import json
import logging
from sqlalchemy import and_, or_, func
from sqlalchemy.sql import text

logger = logging.getLogger(__name__)


class CompositeSearchHandler:
    """
    Handles composite search parameters for FHIR resources.
    Composite parameters combine multiple search parameters into correlated searches.
    """
    
    # Define composite parameters for each resource type
    COMPOSITE_PARAMETERS = {
        "Observation": {
            "code-value-quantity": ["code", "value-quantity"],
            "code-value-string": ["code", "value-string"],
            "code-value-concept": ["code", "value-concept"],
            "component-code-value-quantity": ["component-code", "component-value-quantity"]
        },
        "MedicationRequest": {
            "medication-strength": ["medication", "dosage-instruction"]
        },
        "Condition": {
            "code-severity": ["code", "severity"],
            "category-status": ["category", "clinical-status"]
        },
        "DiagnosticReport": {
            "code-result": ["code", "result-value"]
        }
    }
    
    def __init__(self):
        self.logger = logger
        
    def is_composite_parameter(self, resource_type: str, parameter: str) -> bool:
        """Check if a parameter is a composite parameter for the resource type"""
        return parameter in self.COMPOSITE_PARAMETERS.get(resource_type, {})
        
    def parse_composite_value(self, value: str) -> List[str]:
        """
        Parse composite parameter value.
        Format: component1$component2$component3...
        """
        # Split by $ but handle escaped \$
        parts = []
        current = ""
        escaped = False
        
        for char in value:
            if escaped:
                current += char
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == "$":
                parts.append(current)
                current = ""
            else:
                current += char
                
        if current:
            parts.append(current)
            
        return parts
        
    def apply_composite_search(
        self, 
        query: Any, 
        resource_type: str,
        parameter: str, 
        value: str,
        resource_table: Any
    ) -> Any:
        """
        Apply composite search to a query.
        
        Args:
            query: SQLAlchemy query object
            resource_type: FHIR resource type
            parameter: Composite parameter name
            value: Composite parameter value
            resource_table: SQLAlchemy table/model
            
        Returns:
            Modified query with composite search applied
        """
        if not self.is_composite_parameter(resource_type, parameter):
            self.logger.warning(f"Unknown composite parameter {parameter} for {resource_type}")
            return query
            
        components = self.COMPOSITE_PARAMETERS[resource_type][parameter]
        values = self.parse_composite_value(value)
        
        if len(values) != len(components):
            self.logger.warning(
                f"Composite parameter {parameter} expects {len(components)} values, "
                f"got {len(values)}"
            )
            return query
            
        # Build composite search based on resource type and parameter
        if resource_type == "Observation":
            return self._apply_observation_composite(
                query, parameter, components, values, resource_table
            )
        elif resource_type == "Condition":
            return self._apply_condition_composite(
                query, parameter, components, values, resource_table
            )
        elif resource_type == "MedicationRequest":
            return self._apply_medication_request_composite(
                query, parameter, components, values, resource_table
            )
        elif resource_type == "DiagnosticReport":
            return self._apply_diagnostic_report_composite(
                query, parameter, components, values, resource_table
            )
        else:
            self.logger.warning(f"Composite search not implemented for {resource_type}")
            return query
            
    def _apply_observation_composite(
        self, 
        query: Any, 
        parameter: str,
        components: List[str],
        values: List[str],
        resource_table: Any
    ) -> Any:
        """Apply Observation-specific composite searches"""
        
        if parameter == "code-value-quantity":
            # Parse code and quantity value
            code = values[0]
            quantity_expr = values[1]
            
            # Parse quantity expression (e.g., "gt5.4", "5.4", "le100")
            comparator, number = self._parse_quantity_expression(quantity_expr)
            
            # Build JSONB conditions
            code_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.code.coding[*] ? (@.code == $code)',
                json.dumps({"code": code})
            )
            
            # Build quantity condition based on comparator
            if comparator == "gt":
                quantity_condition = func.jsonb_path_exists(
                    resource_table.resource,
                    '$.valueQuantity.value ? (@ > $value)',
                    json.dumps({"value": number})
                )
            elif comparator == "ge":
                quantity_condition = func.jsonb_path_exists(
                    resource_table.resource,
                    '$.valueQuantity.value ? (@ >= $value)',
                    json.dumps({"value": number})
                )
            elif comparator == "lt":
                quantity_condition = func.jsonb_path_exists(
                    resource_table.resource,
                    '$.valueQuantity.value ? (@ < $value)',
                    json.dumps({"value": number})
                )
            elif comparator == "le":
                quantity_condition = func.jsonb_path_exists(
                    resource_table.resource,
                    '$.valueQuantity.value ? (@ <= $value)',
                    json.dumps({"value": number})
                )
            else:  # eq or no comparator
                quantity_condition = func.jsonb_path_exists(
                    resource_table.resource,
                    '$.valueQuantity.value ? (@ == $value)',
                    json.dumps({"value": number})
                )
                
            return query.filter(and_(code_condition, quantity_condition))
            
        elif parameter == "component-code-value-quantity":
            # Handle component searches (e.g., blood pressure with systolic/diastolic)
            code = values[0]
            quantity_expr = values[1]
            
            comparator, number = self._parse_quantity_expression(quantity_expr)
            
            # Check components array for matching code and value
            component_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.component[*] ? (@.code.coding[*].code == $code && @.valueQuantity.value ' + 
                self._get_jsonb_comparator(comparator) + ' $value)',
                json.dumps({"code": code, "value": number})
            )
            
            return query.filter(component_condition)
            
        elif parameter == "code-value-string":
            code = values[0]
            string_value = values[1]
            
            code_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.code.coding[*] ? (@.code == $code)',
                json.dumps({"code": code})
            )
            
            string_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.valueString ? (@ like_regex $pattern flag "i")',
                json.dumps({"pattern": f".*{string_value}.*"})
            )
            
            return query.filter(and_(code_condition, string_condition))
            
        elif parameter == "code-value-concept":
            code = values[0]
            concept_code = values[1]
            
            code_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.code.coding[*] ? (@.code == $code)',
                json.dumps({"code": code})
            )
            
            concept_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.valueCodeableConcept.coding[*] ? (@.code == $concept)',
                json.dumps({"concept": concept_code})
            )
            
            return query.filter(and_(code_condition, concept_condition))
            
        return query
        
    def _apply_condition_composite(
        self, 
        query: Any, 
        parameter: str,
        components: List[str],
        values: List[str],
        resource_table: Any
    ) -> Any:
        """Apply Condition-specific composite searches"""
        
        if parameter == "code-severity":
            code = values[0]
            severity = values[1]
            
            code_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.code.coding[*] ? (@.code == $code)',
                json.dumps({"code": code})
            )
            
            severity_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.severity.coding[*] ? (@.code == $severity)',
                json.dumps({"severity": severity})
            )
            
            return query.filter(and_(code_condition, severity_condition))
            
        elif parameter == "category-status":
            category = values[0]
            status = values[1]
            
            category_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.category[*].coding[*] ? (@.code == $category)',
                json.dumps({"category": category})
            )
            
            status_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.clinicalStatus.coding[*] ? (@.code == $status)',
                json.dumps({"status": status})
            )
            
            return query.filter(and_(category_condition, status_condition))
            
        return query
        
    def _apply_medication_request_composite(
        self, 
        query: Any, 
        parameter: str,
        components: List[str],
        values: List[str],
        resource_table: Any
    ) -> Any:
        """Apply MedicationRequest-specific composite searches"""
        
        if parameter == "medication-strength":
            medication_code = values[0]
            strength = values[1]
            
            # Check medication code
            med_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.medicationCodeableConcept.coding[*] ? (@.code == $code)',
                json.dumps({"code": medication_code})
            )
            
            # Check dosage instruction for strength
            # This is simplified - real implementation would parse strength units
            strength_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.dosageInstruction[*].doseAndRate[*].doseQuantity.value ? (@ == $strength)',
                json.dumps({"strength": float(strength) if strength.replace('.', '').isdigit() else 0})
            )
            
            return query.filter(and_(med_condition, strength_condition))
            
        return query
        
    def _apply_diagnostic_report_composite(
        self, 
        query: Any, 
        parameter: str,
        components: List[str],
        values: List[str],
        resource_table: Any
    ) -> Any:
        """Apply DiagnosticReport-specific composite searches"""
        
        if parameter == "code-result":
            code = values[0]
            result_value = values[1]
            
            # Check report code
            code_condition = func.jsonb_path_exists(
                resource_table.resource,
                '$.code.coding[*] ? (@.code == $code)',
                json.dumps({"code": code})
            )
            
            # This would need to join with Observation resources referenced in result
            # For now, we'll check if the report has the code
            # Full implementation would require checking referenced Observations
            
            return query.filter(code_condition)
            
        return query
        
    def _parse_quantity_expression(self, expr: str) -> Tuple[str, float]:
        """
        Parse quantity expression like "gt5.4", "le100", "5.4"
        Returns (comparator, value)
        """
        comparators = ["gt", "ge", "lt", "le", "eq", "ne"]
        
        for comp in comparators:
            if expr.startswith(comp):
                try:
                    value = float(expr[len(comp):])
                    return comp, value
                except ValueError:
                    self.logger.warning(f"Invalid quantity value: {expr}")
                    return "eq", 0.0
                    
        # No comparator, assume equality
        try:
            return "eq", float(expr)
        except ValueError:
            self.logger.warning(f"Invalid quantity value: {expr}")
            return "eq", 0.0
            
    def _get_jsonb_comparator(self, comparator: str) -> str:
        """Convert comparator to JSONB path expression operator"""
        mapping = {
            "gt": ">",
            "ge": ">=", 
            "lt": "<",
            "le": "<=",
            "eq": "==",
            "ne": "!="
        }
        return mapping.get(comparator, "==")
        
    def get_supported_composites(self, resource_type: str) -> List[str]:
        """Get list of supported composite parameters for a resource type"""
        return list(self.COMPOSITE_PARAMETERS.get(resource_type, {}).keys())