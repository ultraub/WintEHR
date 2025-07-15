"""
FHIR Composite Search Parameter Support
Handles composite search parameters that combine multiple search criteria
"""

from typing import Dict, List, Tuple, Optional, Any
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Query
from models.synthea_models import Observation
from models.fhir_resource import FHIRResource


class CompositeSearchHandler:
    """Handles composite search parameters for FHIR resources"""
    
    # Define composite search parameters for each resource type
    COMPOSITE_PARAMETERS = {
        "Observation": {
            "code-value-quantity": ["code", "value-quantity"],
            "code-value-concept": ["code", "value-concept"],
            "combo-code": ["code", "combo-code"],
            "combo-code-value-quantity": ["combo-code", "value-quantity"],
            "component-code-value-quantity": ["component-code", "component-value-quantity"]
        },
        "MedicationRequest": {
            "medication-code-status": ["code", "status"],
            "intent-status": ["intent", "status"]
        },
        "Condition": {
            "code-status": ["code", "clinical-status"],
            "category-status": ["category", "clinical-status"]
        }
    }
    
    def __init__(self, resource_type: str):
        self.resource_type = resource_type
        self.composites = self.COMPOSITE_PARAMETERS.get(resource_type, {})
    
    def is_composite_parameter(self, param: str) -> bool:
        """Check if a parameter is a registered composite parameter"""
        return param in self.composites
    
    def parse_composite_value(self, param: str, value: str) -> List[Tuple[str, str]]:
        """Parse composite parameter value into component parts
        
        Format: component1$component2$component3
        Example: http://loinc.org|8480-6$gt90
        """
        if '$' not in value:
            return []
        
        components = value.split('$')
        param_components = self.composites.get(param, [])
        
        if len(components) != len(param_components):
            # Mismatch in number of components
            return []
        
        return list(zip(param_components, components))
    
    def apply_composite_search(self, query: Query, param: str, value: str) -> Query:
        """Apply composite search parameter to query"""
        
        components = self.parse_composite_value(param, value)
        if not components:
            return query
        
        if self.resource_type == "Observation":
            return self._apply_observation_composite(query, param, components)
        elif self.resource_type == "MedicationRequest":
            return self._apply_medication_composite(query, param, components)
        elif self.resource_type == "Condition":
            return self._apply_condition_composite(query, param, components)
        
        return query
    
    def _apply_observation_composite(self, query: Query, param: str, components: List[Tuple[str, str]]) -> Query:
        """Apply composite search for Observation resource"""
        
        if param == "code-value-quantity":
            # Search for observations with specific code AND value
            code_param, value_param = components[0][1], components[1][1]
            
            # Parse code (may have system|code format)
            if '|' in code_param:
                system, code = code_param.split('|', 1)
                # For Observation model
                query = query.filter(Observation.loinc_code == code)
            else:
                query = query.filter(Observation.loinc_code == code_param)
            
            # Parse value with comparator
            comparator, value_str = self._parse_quantity_value(value_param)
            try:
                value_num = float(value_str)
                
                if comparator == 'gt':
                    query = query.filter(Observation.value > value_num)
                elif comparator == 'ge':
                    query = query.filter(Observation.value >= value_num)
                elif comparator == 'lt':
                    query = query.filter(Observation.value < value_num)
                elif comparator == 'le':
                    query = query.filter(Observation.value <= value_num)
                elif comparator == 'ne':
                    query = query.filter(Observation.value != value_num)
                else:  # eq or no comparator
                    query = query.filter(Observation.value == value_num)
            except ValueError:
                # Invalid numeric value
                pass
        
        elif param == "component-code-value-quantity":
            # For JSONB stored observations with components
            component_code = components[0][1]
            component_value = components[1][1]
            
            # Parse code
            if '|' in component_code:
                system, code = component_code.split('|', 1)
            else:
                code = component_code
            
            # Parse value comparator
            comparator, value_str = self._parse_quantity_value(component_value)
            
            # Build JSONB query for component array
            # Example structure: component[{code: {coding: [{code: "8480-6"}]}, valueQuantity: {value: 120}}]
            if comparator == 'gt':
                query = query.filter(
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.component[*] ? (@.code.coding[*].code == "{code}" && @.valueQuantity.value > {value_str})'
                    )
                )
            elif comparator == 'lt':
                query = query.filter(
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.component[*] ? (@.code.coding[*].code == "{code}" && @.valueQuantity.value < {value_str})'
                    )
                )
            else:  # Default to equality
                query = query.filter(
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.component[*] ? (@.code.coding[*].code == "{code}" && @.valueQuantity.value == {value_str})'
                    )
                )
        
        return query
    
    def _apply_medication_composite(self, query: Query, param: str, components: List[Tuple[str, str]]) -> Query:
        """Apply composite search for MedicationRequest resource"""
        
        if param == "medication-code-status":
            # Search for medications with specific code AND status
            code_value = components[0][1]
            status_value = components[1][1]
            
            # Apply both filters
            conditions = []
            
            # Code filter
            if '|' in code_value:
                system, code = code_value.split('|', 1)
                conditions.append(
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.medicationCodeableConcept.coding[*] ? (@.system == "{system}" && @.code == "{code}")'
                    )
                )
            else:
                conditions.append(
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.medicationCodeableConcept.coding[*] ? (@.code == "{code_value}")'
                    )
                )
            
            # Status filter
            conditions.append(
                FHIRResource.resource['status'].astext == status_value
            )
            
            query = query.filter(and_(*conditions))
        
        return query
    
    def _apply_condition_composite(self, query: Query, param: str, components: List[Tuple[str, str]]) -> Query:
        """Apply composite search for Condition resource"""
        
        if param == "code-status":
            # Search for conditions with specific code AND clinical status
            code_value = components[0][1]
            status_value = components[1][1]
            
            # Apply both filters
            conditions = []
            
            # Code filter
            if '|' in code_value:
                system, code = code_value.split('|', 1)
                conditions.append(
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.code.coding[*] ? (@.system == "{system}" && @.code == "{code}")'
                    )
                )
            else:
                conditions.append(
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.code.coding[*] ? (@.code == "{code_value}")'
                    )
                )
            
            # Clinical status filter
            conditions.append(
                func.jsonb_path_exists(
                    FHIRResource.resource,
                    f'$.clinicalStatus.coding[*] ? (@.code == "{status_value}")'
                )
            )
            
            query = query.filter(and_(*conditions))
        
        return query
    
    def _parse_quantity_value(self, value: str) -> Tuple[str, str]:
        """Parse quantity value with optional comparator
        
        Examples:
        - gt90 -> ('gt', '90')
        - 120 -> ('eq', '120')
        - le7.5 -> ('le', '7.5')
        """
        # Check for comparator prefixes
        for prefix in ['gt', 'ge', 'lt', 'le', 'ne', 'eq']:
            if value.startswith(prefix):
                return prefix, value[len(prefix):]
        
        # No comparator, default to equality
        return 'eq', value