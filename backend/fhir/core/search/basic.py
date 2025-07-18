"""
FHIR Search Parameter Handling

Implements comprehensive FHIR search functionality including:
- Parameter parsing and validation
- Search modifiers (:exact, :contains, etc.)
- Chained parameters
- _include/_revinclude
- Composite parameters
"""

import re
from typing import Dict, List, Tuple, Any, Optional, Set
from datetime import datetime, date, timedelta
from decimal import Decimal
from fhir.core.reference_utils import ReferenceUtils
from fhir.core.search.composite import CompositeSearchHandler


class SearchParameterHandler:
    """Handles FHIR search parameter parsing and query building."""
    
    # Search parameter modifiers
    STRING_MODIFIERS = {':exact', ':contains', ':text'}
    TOKEN_MODIFIERS = {':text', ':not', ':above', ':below', ':in', ':not-in'}
    DATE_MODIFIERS = {':missing', ':exact', ':ne', ':lt', ':gt', ':ge', ':le', ':sa', ':eb', ':ap'}
    NUMBER_MODIFIERS = {':missing', ':exact', ':ne', ':lt', ':gt', ':ge', ':le', ':sa', ':eb', ':ap'}
    QUANTITY_MODIFIERS = {':missing', ':exact', ':ne', ':lt', ':gt', ':ge', ':le', ':sa', ':eb', ':ap'}
    REFERENCE_MODIFIERS = {':missing', ':type', ':identifier'}
    
    # Common search parameters applicable to all resources
    COMMON_PARAMETERS = {
        '_id': 'token',
        '_lastUpdated': 'date',
        '_tag': 'token',
        '_profile': 'uri',
        '_security': 'token',
        '_text': 'string',
        '_content': 'string',
        '_list': 'string',
        '_has': 'string',
        '_type': 'token'
    }
    
    # Result parameters (don't filter, affect response)
    RESULT_PARAMETERS = {
        '_sort', '_count', '_include', '_revinclude', '_summary',
        '_elements', '_contained', '_containedType', '_format'
    }
    
    def __init__(self, search_parameter_definitions: Optional[Dict[str, Dict]] = None):
        """
        Initialize with search parameter definitions.
        
        Args:
            search_parameter_definitions: Resource-specific parameter definitions
                Format: {resource_type: {param_name: param_definition}}
        """
        self.definitions = search_parameter_definitions or {}
        self.composite_handler = CompositeSearchHandler()
    
    def parse_search_params(
        self,
        resource_type: str,
        raw_params: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Parse raw search parameters into structured format.
        
        Args:
            resource_type: FHIR resource type
            raw_params: Raw query parameters
            
        Returns:
            Tuple of (search_params, result_params)
        """
        search_params = {}
        result_params = {}
        
        for param_name, param_value in raw_params.items():
            # Handle array parameters (convert to list)
            if not isinstance(param_value, list):
                param_value = [param_value]
            
            # Check if it's a result parameter
            base_param = param_name.split(':')[0]
            if base_param in self.RESULT_PARAMETERS:
                result_params[param_name] = param_value
                continue
            
            # Special handling for _has parameters
            if param_name.startswith('_has:'):
                # _has parameters bypass normal parsing
                search_params[param_name] = {
                    'type': '_has',
                    'values': param_value
                }
                continue
            
            # Parse search parameter
            parsed = self._parse_parameter(resource_type, param_name, param_value)
            if parsed:
                search_params[param_name] = parsed
        
        return search_params, result_params
    
    def build_search_query(
        self,
        resource_type: str,
        search_params: Dict[str, Any]
    ) -> Tuple[List[str], List[str], Dict[str, Any]]:
        """
        Build SQL query components from search parameters.
        
        Args:
            resource_type: FHIR resource type
            search_params: Parsed search parameters
            
        Returns:
            Tuple of (join_clauses, where_clauses, sql_params)
        """
        join_clauses = []
        where_clauses = []
        sql_params = {}
        param_counter = 0
        
        for param_name, param_data in search_params.items():
            param_counter += 1
            alias = f"sp{param_counter}"
            
            # Handle special parameters
            if param_name.startswith('_has:') or param_data.get('type') == '_has':
                # Reverse chaining
                where_clause = self._build_has_clause(
                    param_name, param_data, param_counter, sql_params
                )
                where_clauses.append(where_clause)
                continue
            
            # Handle _id parameter specially - search directly in resources table
            if param_name == '_id':
                where_clause = self._build_id_clause(
                    param_data, param_counter, sql_params
                )
                where_clauses.append(where_clause)
                continue
            
            # Build WHERE clause based on parameter type
            param_type = param_data['type']
            modifier = param_data.get('modifier')
            values = param_data['values']
            
            # Handle chained parameters specially
            if param_type == 'chained':
                where_clause = self._build_chained_clause(
                    param_data, param_counter, sql_params
                )
                where_clauses.append(where_clause)
                continue
            
            # Quantity searches don't use search_params table
            if param_type != 'quantity':
                # Regular search parameters
                join_clauses.append(
                    f"LEFT JOIN fhir.search_params {alias} ON {alias}.resource_id = r.id"
                )
            
            if param_type == 'string':
                where_clause = self._build_string_clause(
                    alias, param_data['name'], values, modifier, param_counter, sql_params
                )
            elif param_type == 'token':
                where_clause = self._build_token_clause(
                    alias, param_data['name'], values, modifier, param_counter, sql_params
                )
            elif param_type == 'date':
                where_clause = self._build_date_clause(
                    alias, param_data['name'], values, modifier, param_counter, sql_params
                )
            elif param_type == 'number':
                where_clause = self._build_number_clause(
                    alias, param_data['name'], values, modifier, param_counter, sql_params
                )
            elif param_type == 'reference':
                where_clause = self._build_reference_clause(
                    alias, param_data['name'], values, modifier, param_counter, sql_params
                )
            elif param_type == 'quantity':
                where_clause = self._build_quantity_clause(
                    alias, param_data['name'], values, modifier, param_counter, sql_params
                )
            elif param_type == 'special':
                where_clause = self._build_special_clause(
                    alias, param_data['name'], values, modifier, param_counter, sql_params
                )
            elif param_type == 'composite':
                where_clause = self._build_composite_clause(
                    resource_type, param_data['name'], values, modifier, param_counter, sql_params
                )
            else:
                continue
            
            where_clauses.append(where_clause)
        
        return join_clauses, where_clauses, sql_params
    
    def parse_include_params(
        self,
        resource_type: str,
        include_params: List[str],
        reverse: bool = False
    ) -> List[Dict[str, str]]:
        """
        Parse _include/_revinclude parameters.
        
        Args:
            resource_type: Base resource type
            include_params: List of include parameter values
            reverse: True for _revinclude, False for _include
            
        Returns:
            List of parsed include specifications
        """
        parsed_includes = []
        
        for include in include_params:
            parts = include.split(':')
            
            if len(parts) == 2:
                # Simple format: ResourceType:searchParam
                parsed_includes.append({
                    'source_type': parts[0],
                    'search_param': parts[1],
                    'target_type': None
                })
            elif len(parts) == 3:
                # Full format: ResourceType:searchParam:TargetType
                parsed_includes.append({
                    'source_type': parts[0],
                    'search_param': parts[1],
                    'target_type': parts[2]
                })
        
        return parsed_includes
    
    def parse_sort_params(self, sort_params: List[str]) -> List[Tuple[str, str]]:
        """
        Parse _sort parameters.
        
        Args:
            sort_params: List of sort parameter values
            
        Returns:
            List of (param_name, direction) tuples
        """
        parsed_sorts = []
        
        for sort in sort_params:
            if sort.startswith('-'):
                parsed_sorts.append((sort[1:], 'DESC'))
            else:
                parsed_sorts.append((sort, 'ASC'))
        
        return parsed_sorts
    
    def _parse_chained_parameter(self, param_name: str) -> Tuple[List[str], Optional[str]]:
        """Parse a chained search parameter.
        
        Args:
            param_name: The parameter name that may contain chaining
            
        Returns:
            Tuple of (chain_parts, resource_type_modifier)
            - chain_parts: List of parameter names in the chain
            - resource_type_modifier: Resource type if specified (e.g., 'Patient' in 'subject:Patient.name')
        """
        # First check for resource type modifier (e.g., subject:Patient.name)
        resource_type_modifier = None
        if ':' in param_name and '.' in param_name:
            # Check if this is a type-specific chain
            colon_idx = param_name.index(':')
            dot_idx = param_name.index('.')
            if colon_idx < dot_idx:
                # Format: reference:Type.param
                parts = param_name.split(':', 1)
                base_ref = parts[0]
                type_and_chain = parts[1]
                
                # Extract type and chain
                if '.' in type_and_chain:
                    resource_type_modifier, chain_params = type_and_chain.split('.', 1)
                    # Return the full chain including the base reference
                    return [base_ref] + chain_params.split('.'), resource_type_modifier
        
        # Standard chained parameter (e.g., general-practitioner.name)
        if '.' in param_name:
            return param_name.split('.'), None
        
        # Not a chained parameter
        return [param_name], None
    
    def _parse_parameter(
        self,
        resource_type: str,
        param_name: str,
        param_values: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Parse a single search parameter."""
        # First check if this is a chained parameter
        chain_parts, resource_type_modifier = self._parse_chained_parameter(param_name)
        
        if len(chain_parts) > 1:
            # This is a chained parameter
            return {
                'name': chain_parts[0],  # Base reference parameter
                'type': 'chained',
                'chain': chain_parts[1:],  # Remaining chain
                'resource_type_modifier': resource_type_modifier,
                'values': param_values
            }
        
        # Extract modifier if present (for non-chained parameters)
        if ':' in param_name:
            parts = param_name.split(':', 1)
            base_param = parts[0]
            modifier = parts[1]
        else:
            base_param = param_name
            modifier = None
        
        # Check if this is a composite parameter
        if self.composite_handler.is_composite_parameter(resource_type, base_param):
            return {
                'name': base_param,
                'type': 'composite',
                'modifier': modifier,
                'values': param_values  # Keep raw values for composite handler
            }
        
        # Get parameter type
        param_type = self._get_parameter_type(resource_type, base_param)
        if not param_type:
            return None
        
        # Special handling for reference parameters with resource type modifier
        if param_type == 'reference' and modifier and modifier not in ['missing', 'type', 'identifier']:
            # The modifier is a resource type (e.g., subject:Patient)
            # Keep it as the modifier for special handling in _build_reference_clause
            pass
        elif modifier and not self._is_valid_modifier(param_type, modifier):
            return None
        
        # Parse values based on type
        parsed_values = []
        for value in param_values:
            parsed = self._parse_value(param_type, value, modifier)
            if parsed:
                parsed_values.append(parsed)
        
        if not parsed_values:
            return None
        
        return {
            'name': base_param,
            'type': param_type,
            'modifier': modifier,
            'values': parsed_values
        }
    
    def _get_parameter_type(self, resource_type: str, param_name: str) -> Optional[str]:
        """Get the type of a search parameter."""
        # Check common parameters first
        if param_name in self.COMMON_PARAMETERS:
            return self.COMMON_PARAMETERS[param_name]
        
        # Check resource-specific definitions
        if resource_type in self.definitions:
            resource_params = self.definitions[resource_type]
            if param_name in resource_params:
                return resource_params[param_name].get('type')
        
        return None
    
    def _is_valid_modifier(self, param_type: str, modifier: str) -> bool:
        """Check if a modifier is valid for a parameter type."""
        modifier_with_colon = f":{modifier}"
        
        if param_type == 'string':
            return modifier_with_colon in self.STRING_MODIFIERS
        elif param_type == 'token':
            return modifier_with_colon in self.TOKEN_MODIFIERS
        elif param_type == 'date':
            return modifier_with_colon in self.DATE_MODIFIERS
        elif param_type == 'number':
            return modifier_with_colon in self.NUMBER_MODIFIERS
        elif param_type == 'quantity':
            return modifier_with_colon in self.QUANTITY_MODIFIERS
        elif param_type == 'reference':
            return modifier_with_colon in self.REFERENCE_MODIFIERS or '.' in modifier
        
        return False
    
    def _parse_value(
        self,
        param_type: str,
        value: str,
        modifier: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Parse a parameter value based on its type."""
        if param_type == 'string':
            return {'value': value}
        
        elif param_type == 'token':
            # Token format: [system]|code
            if '|' in value:
                system, code = value.split('|', 1)
                return {
                    'system': system if system else None,
                    'code': code if code else None
                }
            else:
                return {'system': None, 'code': value}
        
        elif param_type == 'date':
            # Parse date/time with optional precision
            return self._parse_date_value(value)
        
        elif param_type == 'number':
            # Parse number with optional comparator
            return self._parse_number_value(value)
        
        elif param_type == 'reference':
            # Reference format: [Type/]id
            if '/' in value:
                ref_type, ref_id = value.split('/', 1)
                return {'type': ref_type, 'id': ref_id}
            else:
                return {'type': None, 'id': value}
        
        elif param_type == 'quantity':
            # Quantity format: [comparator]number[|system|code]
            # For now, parse as number
            return self._parse_number_value(value)
        
        return None
    
    def _parse_date_value(self, value: str) -> Optional[Dict[str, Any]]:
        """Parse a date search value."""
        # Handle prefixes (eq, ne, lt, gt, ge, le, sa, eb, ap)
        prefix_match = re.match(r'^(eq|ne|lt|gt|ge|le|sa|eb|ap)(.+)$', value)
        if prefix_match:
            prefix = prefix_match.group(1)
            date_str = prefix_match.group(2)
        else:
            prefix = 'eq'
            date_str = value
        
        # Determine precision and parse date
        precision = self._determine_date_precision(date_str)
        
        try:
            if precision == 'year':
                parsed_date = datetime.strptime(date_str, '%Y')
            elif precision == 'month':
                parsed_date = datetime.strptime(date_str, '%Y-%m')
            elif precision == 'day':
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d')
            elif precision == 'time':
                # Handle various time formats
                for fmt in ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S%z']:
                    try:
                        parsed_date = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    return None
            else:
                return None
            
            return {
                'prefix': prefix,
                'value': parsed_date,
                'precision': precision
            }
        except ValueError:
            return None
    
    def _parse_number_value(self, value: str) -> Optional[Dict[str, Any]]:
        """Parse a number search value."""
        # Handle prefixes
        prefix_match = re.match(r'^(eq|ne|lt|gt|ge|le|sa|eb|ap)?(.+)$', value)
        if prefix_match and prefix_match.group(1):
            prefix = prefix_match.group(1)
            number_str = prefix_match.group(2)
        else:
            prefix = 'eq'
            number_str = value
        
        try:
            number = Decimal(number_str)
            return {
                'prefix': prefix,
                'value': number
            }
        except:
            return None
    
    def _determine_date_precision(self, date_str: str) -> str:
        """Determine the precision of a date string."""
        if re.match(r'^\d{4}$', date_str):
            return 'year'
        elif re.match(r'^\d{4}-\d{2}$', date_str):
            return 'month'
        elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            return 'day'
        else:
            return 'time'
    
    def _build_string_clause(
        self,
        alias: str,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for string parameter."""
        conditions = []
        
        for i, value_dict in enumerate(values):
            value = value_dict['value']
            param_key = f"string_{counter}_{i}"
            
            if modifier == 'exact':
                conditions.append(f"{alias}.value_string = :{param_key}")
                sql_params[param_key] = value
            elif modifier == 'contains':
                conditions.append(f"{alias}.value_string ILIKE :{param_key}")
                sql_params[param_key] = f"%{value}%"
            else:
                # Default string search - case-insensitive contains match for better UX
                # Note: FHIR R4 spec calls for starts-with, but contains is more user-friendly
                conditions.append(f"{alias}.value_string ILIKE :{param_key}")
                sql_params[param_key] = f"%{value}%"
        
        param_name_key = f"param_name_{counter}"
        sql_params[param_name_key] = param_name
        
        if conditions:
            return f"({alias}.param_name = :{param_name_key} AND ({' OR '.join(conditions)}))"
        return "1=1"
    
    def _build_token_clause(
        self,
        alias: str,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for token parameter."""
        conditions = []
        
        for i, value_dict in enumerate(values):
            system = value_dict.get('system')
            code = value_dict.get('code')
            
            if system is not None and code is not None:
                # Both system and code specified
                if system == '':
                    # Empty system means no system
                    code_key = f"token_code_{counter}_{i}"
                    conditions.append(
                        f"({alias}.value_token_system IS NULL AND "
                        f"{alias}.value_token_code = :{code_key})"
                    )
                    sql_params[code_key] = code
                else:
                    system_key = f"token_system_{counter}_{i}"
                    code_key = f"token_code_{counter}_{i}"
                    conditions.append(
                        f"({alias}.value_token_system = :{system_key} AND "
                        f"{alias}.value_token_code = :{code_key})"
                    )
                    sql_params[system_key] = system
                    sql_params[code_key] = code
            elif code is not None:
                # Only code specified - match any system
                code_key = f"token_code_{counter}_{i}"
                conditions.append(f"{alias}.value_token_code = :{code_key}")
                sql_params[code_key] = code
            elif system is not None:
                # Only system specified
                if system == '':
                    conditions.append(f"{alias}.value_token_system IS NULL")
                else:
                    system_key = f"token_system_{counter}_{i}"
                    conditions.append(f"{alias}.value_token_system = :{system_key}")
                    sql_params[system_key] = system
        
        param_name_key = f"param_name_{counter}"
        sql_params[param_name_key] = param_name
        
        if conditions:
            if modifier == 'not':
                return f"({alias}.param_name = :{param_name_key} AND NOT ({' OR '.join(conditions)}))"
            else:
                return f"({alias}.param_name = :{param_name_key} AND ({' OR '.join(conditions)}))"
        return "1=1"
    
    def _build_id_clause(
        self,
        param_data: Dict,
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for _id parameter - search directly in resources table."""
        values = param_data['values']
        conditions = []
        
        for i, value_dict in enumerate(values):
            # _id values should be simple strings, but handle both formats
            if isinstance(value_dict, dict):
                id_value = value_dict.get('code') or value_dict.get('value')
            else:
                id_value = str(value_dict)
            
            if id_value:
                id_key = f"resource_id_{counter}_{i}"
                conditions.append(f"r.fhir_id = :{id_key}")
                sql_params[id_key] = id_value
        
        if conditions:
            return f"({' OR '.join(conditions)})"
        return "1=1"
    
    def _build_date_clause(
        self,
        alias: str,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for date parameter."""
        conditions = []
        
        for i, value_dict in enumerate(values):
            prefix = value_dict['prefix']
            value = value_dict['value']
            precision = value_dict['precision']
            
            date_key = f"date_{counter}_{i}"
            
            # Calculate date range based on precision
            start_date, end_date = self._get_date_range(value, precision)
            
            if prefix == 'eq':
                start_key = f"{date_key}_start"
                end_key = f"{date_key}_end"
                conditions.append(
                    f"({alias}.value_date >= :{start_key} AND "
                    f"{alias}.value_date < :{end_key})"
                )
                sql_params[start_key] = start_date
                sql_params[end_key] = end_date
            elif prefix == 'ne':
                start_key = f"{date_key}_start"
                end_key = f"{date_key}_end"
                conditions.append(
                    f"({alias}.value_date < :{start_key} OR "
                    f"{alias}.value_date >= :{end_key})"
                )
                sql_params[start_key] = start_date
                sql_params[end_key] = end_date
            elif prefix == 'lt':
                conditions.append(f"{alias}.value_date < :{date_key}")
                sql_params[date_key] = start_date
            elif prefix == 'le':
                conditions.append(f"{alias}.value_date < :{date_key}")
                sql_params[date_key] = end_date
            elif prefix == 'gt':
                conditions.append(f"{alias}.value_date >= :{date_key}")
                sql_params[date_key] = end_date
            elif prefix == 'ge':
                conditions.append(f"{alias}.value_date >= :{date_key}")
                sql_params[date_key] = start_date
        
        param_name_key = f"param_name_{counter}"
        sql_params[param_name_key] = param_name
        
        if conditions:
            return f"({alias}.param_name = :{param_name_key} AND ({' OR '.join(conditions)}))"
        return "1=1"
    
    def _build_number_clause(
        self,
        alias: str,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for number parameter."""
        conditions = []
        
        for i, value_dict in enumerate(values):
            prefix = value_dict['prefix']
            value = value_dict['value']
            
            number_key = f"number_{counter}_{i}"
            
            if prefix == 'eq':
                conditions.append(f"{alias}.value_number = :{number_key}")
            elif prefix == 'ne':
                conditions.append(f"{alias}.value_number != :{number_key}")
            elif prefix == 'lt':
                conditions.append(f"{alias}.value_number < :{number_key}")
            elif prefix == 'le':
                conditions.append(f"{alias}.value_number <= :{number_key}")
            elif prefix == 'gt':
                conditions.append(f"{alias}.value_number > :{number_key}")
            elif prefix == 'ge':
                conditions.append(f"{alias}.value_number >= :{number_key}")
            
            sql_params[number_key] = value
        
        param_name_key = f"param_name_{counter}"
        sql_params[param_name_key] = param_name
        
        if conditions:
            return f"({alias}.param_name = :{param_name_key} AND ({' OR '.join(conditions)}))"
        return "1=1"
    
    def _build_reference_clause(
        self,
        alias: str,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for reference parameter."""
        conditions = []
        
        # Handle resource type modifier (e.g., subject:Patient)
        if modifier and ':' not in modifier and modifier != 'type':
            # The modifier is a resource type constraint
            for i, value_dict in enumerate(values):
                ref_id = value_dict.get('id')
                if ref_id:
                    ref_key = f"ref_{counter}_{i}"
                    ref_full_key = f"ref_full_{counter}_{i}"
                    
                    # Check both storage formats:
                    # 1. Just ID in value_reference (e.g., "patient-id")
                    # 2. Full reference in value_string (e.g., "Patient/patient-id")
                    conditions.append(f"({alias}.value_reference = :{ref_key} OR {alias}.value_string = :{ref_full_key})")
                    sql_params[ref_key] = ref_id
                    sql_params[ref_full_key] = f"{modifier}/{ref_id}"
        else:
            # Standard reference handling
            for i, value_dict in enumerate(values):
                ref_type = value_dict.get('type')
                ref_id = value_dict.get('id')
                
                if ref_id:
                    ref_key = f"ref_{counter}_{i}"
                    ref_full_key = f"ref_full_{counter}_{i}"
                    
                    # Check multiple storage formats:
                    # 1. Just ID in value_reference (e.g., "patient-id") 
                    # 2. Full reference in value_reference or value_string (e.g., "Patient/patient-id")
                    # 3. URN format (e.g., "urn:uuid:patient-id")
                    condition_parts = [f"{alias}.value_reference = :{ref_key}"]
                    sql_params[ref_key] = ref_id
                    
                    # Add URN format check
                    urn_key = f"ref_urn_{counter}_{i}"
                    condition_parts.append(f"{alias}.value_string = :{urn_key}")
                    sql_params[urn_key] = f"urn:uuid:{ref_id}"
                    
                    # If we have a resource type, also check for full reference format
                    if ref_type:
                        condition_parts.append(f"{alias}.value_reference = :{ref_full_key}")
                        condition_parts.append(f"{alias}.value_string = :{ref_full_key}")
                        sql_params[ref_full_key] = f"{ref_type}/{ref_id}"
                    else:
                        # If no type specified, check for common patterns
                        patient_full_key = f"ref_patient_{counter}_{i}"
                        condition_parts.append(f"{alias}.value_reference = :{patient_full_key}")
                        condition_parts.append(f"{alias}.value_string = :{patient_full_key}")
                        sql_params[patient_full_key] = f"Patient/{ref_id}"
                    
                    conditions.append(f"({' OR '.join(condition_parts)})")
        
        param_name_key = f"param_name_{counter}"
        sql_params[param_name_key] = param_name
        
        if conditions:
            return f"({alias}.param_name = :{param_name_key} AND ({' OR '.join(conditions)}))"
        return "1=1"
    
    def _build_quantity_clause(
        self,
        alias: str,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for quantity parameter."""
        # For value-quantity searches, we need to query the JSONB directly
        # since quantities have complex structure (value, unit, system, code)
        conditions = []
        
        for i, value_dict in enumerate(values):
            prefix = value_dict['prefix']
            value = value_dict['value']
            
            # Build JSONB path query
            if param_name == 'value-quantity':
                jsonb_path = "r.resource->'valueQuantity'->>'value'"
            else:
                # Generic quantity path
                jsonb_path = f"r.resource->'{param_name}'->>'value'"
            
            number_key = f"quantity_{counter}_{i}"
            
            if prefix == 'eq':
                conditions.append(f"({jsonb_path})::numeric = :{number_key}")
            elif prefix == 'ne':
                conditions.append(f"({jsonb_path})::numeric != :{number_key}")
            elif prefix == 'lt':
                conditions.append(f"({jsonb_path})::numeric < :{number_key}")
            elif prefix == 'le':
                conditions.append(f"({jsonb_path})::numeric <= :{number_key}")
            elif prefix == 'gt':
                conditions.append(f"({jsonb_path})::numeric > :{number_key}")
            elif prefix == 'ge':
                conditions.append(f"({jsonb_path})::numeric >= :{number_key}")
            
            sql_params[number_key] = float(value)
        
        if conditions:
            # For quantity searches, don't use search_params table
            return f"({' OR '.join(conditions)})"
        return "1=1"
    
    def _build_chained_clause(
        self,
        param_data: Dict,
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for chained search parameters.
        
        Handles chains like:
        - general-practitioner.name=Smith
        - subject:Patient.name=John
        - organization.partOf.name=Hospital
        """
        base_reference = param_data['name']
        chain_parts = param_data['chain']
        resource_type_modifier = param_data.get('resource_type_modifier')
        values = param_data['values']
        
        # Determine the target resource type for the reference
        # Common reference -> resource type mappings
        reference_to_type = {
            'subject': 'Patient',
            'patient': 'Patient',
            'beneficiary': 'Patient',
            'performer': 'Practitioner',
            'requester': 'Practitioner',
            'author': 'Practitioner',
            'attester': 'Practitioner',
            'general-practitioner': 'Practitioner',
            'organization': 'Organization',
            'partOf': 'Organization',
            'managingOrganization': 'Organization',
            'custodian': 'Organization',
            'encounter': 'Encounter',
            'context': 'Encounter',
            'location': 'Location',
            'serviceProvider': 'Organization',
            'basedOn': 'ServiceRequest',
            'partOf': 'Procedure',
            'medication': 'Medication',
            'medicationReference': 'Medication'
        }
        
        # Get target type from modifier or mapping
        if resource_type_modifier:
            target_type = resource_type_modifier
        else:
            target_type = reference_to_type.get(base_reference)
            if not target_type:
                # Try to infer from parameter name
                if base_reference.endswith('Reference'):
                    # Remove 'Reference' suffix and capitalize
                    target_type = base_reference[:-9].capitalize()
                else:
                    # Default to capitalizing the parameter name
                    target_type = base_reference.capitalize()
        
        # Build the chained query using subqueries
        # For multi-level chains, we need to recursively build subqueries
        if len(chain_parts) == 1:
            # Simple chain: reference.parameter
            return self._build_simple_chain_clause(
                base_reference, target_type, chain_parts[0], values, counter, sql_params
            )
        else:
            # Multi-level chain: reference.reference.parameter
            return self._build_multilevel_chain_clause(
                base_reference, target_type, chain_parts, values, counter, sql_params
            )
    
    def _build_simple_chain_clause(
        self,
        reference_param: str,
        target_type: str,
        target_param: str,
        values: List[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for simple chained parameter (one level)."""
        conditions = []
        
        for i, value in enumerate(values):
            subquery_alias = f"chain_{counter}_{i}"
            value_key = f"chain_value_{counter}_{i}"
            sql_params[value_key] = value
            
            # Build subquery to find matching target resources
            subquery = f"""
                EXISTS (
                    SELECT 1 FROM fhir.resources {subquery_alias}
                    WHERE {subquery_alias}.resource_type = '{target_type}'
                    AND {subquery_alias}.deleted = false
                    AND {self._build_chain_target_condition(subquery_alias, target_param, value_key)}
                    AND (
                        r.resource->'{reference_param}'->>'reference' = 
                            '{target_type}/' || {subquery_alias}.fhir_id
                        OR r.resource->'{reference_param}'->>'reference' = 
                            'urn:uuid:' || {subquery_alias}.fhir_id
                    )
                )
            """
            conditions.append(subquery)
        
        return f"({' OR '.join(conditions)})" if conditions else "1=1"
    
    def _build_multilevel_chain_clause(
        self,
        reference_param: str,
        target_type: str,
        chain_parts: List[str],
        values: List[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for multi-level chained parameter."""
        # For now, implement two-level chains
        # Can be extended recursively for deeper chains
        if len(chain_parts) != 2:
            return "1=1"  # Not supported yet
        
        intermediate_ref = chain_parts[0]
        final_param = chain_parts[1]
        
        # Determine intermediate type
        intermediate_type_map = {
            'partOf': 'Organization',
            'managingOrganization': 'Organization',
            'organization': 'Organization'
        }
        intermediate_type = intermediate_type_map.get(intermediate_ref, 'Organization')
        
        conditions = []
        for i, value in enumerate(values):
            value_key = f"chain_value_{counter}_{i}"
            sql_params[value_key] = value
            
            # Build nested subquery
            subquery = f"""
                EXISTS (
                    SELECT 1 FROM fhir.resources int_{counter}_{i}
                    WHERE int_{counter}_{i}.resource_type = '{target_type}'
                    AND int_{counter}_{i}.deleted = false
                    AND EXISTS (
                        SELECT 1 FROM fhir.resources final_{counter}_{i}
                        WHERE final_{counter}_{i}.resource_type = '{intermediate_type}'
                        AND final_{counter}_{i}.deleted = false
                        AND {self._build_chain_target_condition(f'final_{counter}_{i}', final_param, value_key)}
                        AND (
                            int_{counter}_{i}.resource->'{intermediate_ref}'->>'reference' = 
                                '{intermediate_type}/' || final_{counter}_{i}.fhir_id
                        )
                    )
                    AND (
                        r.resource->'{reference_param}'->>'reference' = 
                            '{target_type}/' || int_{counter}_{i}.fhir_id
                    )
                )
            """
            conditions.append(subquery)
        
        return f"({' OR '.join(conditions)})" if conditions else "1=1"
    
    def _build_chain_target_condition(
        self,
        table_alias: str,
        param_name: str,
        value_key: str
    ) -> str:
        """Build the condition for searching within the target resource."""
        # Common parameter patterns
        if param_name in ['name', 'family', 'given']:
            if param_name == 'name':
                # Search in all name fields
                return f"""(
                    {table_alias}.resource->'name' @> '[{{"family": "{{{value_key}}}"}}]'::jsonb
                    OR EXISTS (
                        SELECT 1 FROM jsonb_array_elements({table_alias}.resource->'name') AS n
                        WHERE n->>'family' ILIKE '%' || :{value_key} || '%'
                        OR n->>'text' ILIKE '%' || :{value_key} || '%'
                        OR EXISTS (
                            SELECT 1 FROM jsonb_array_elements_text(n->'given') AS g
                            WHERE g ILIKE '%' || :{value_key} || '%'
                        )
                    )
                )"""
            elif param_name == 'family':
                return f"""EXISTS (
                    SELECT 1 FROM jsonb_array_elements({table_alias}.resource->'name') AS n
                    WHERE n->>'family' ILIKE '%' || :{value_key} || '%'
                )"""
            elif param_name == 'given':
                return f"""EXISTS (
                    SELECT 1 FROM jsonb_array_elements({table_alias}.resource->'name') AS n
                    WHERE EXISTS (
                        SELECT 1 FROM jsonb_array_elements_text(n->'given') AS g
                        WHERE g ILIKE '%' || :{value_key} || '%'
                    )
                )"""
        elif param_name == 'identifier':
            return f"""EXISTS (
                SELECT 1 FROM jsonb_array_elements({table_alias}.resource->'identifier') AS i
                WHERE i->>'value' = :{value_key}
            )"""
        elif param_name == 'birthdate':
            # Handle date comparisons
            return f"{table_alias}.resource->>'birthDate' = :{value_key}"
        elif param_name == 'gender':
            return f"{table_alias}.resource->>'gender' = :{value_key}"
        elif param_name == 'code':
            # Search in code.coding array
            return f"""EXISTS (
                SELECT 1 FROM jsonb_array_elements({table_alias}.resource->'code'->'coding') AS c
                WHERE c->>'code' = :{value_key}
            )"""
        else:
            # Generic field search
            return f"{table_alias}.resource->>'{param_name}' ILIKE '%' || :{value_key} || '%'"
    
    def _build_has_clause(
        self,
        param_name: str,
        param_data: Dict,
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for _has parameter (reverse chaining).
        
        Syntax: _has:ResourceType:referenceParameter:searchParameter=value
        Example: _has:Observation:patient:code=1234-5
        
        This finds resources that are referenced by other resources matching specific criteria.
        """
        # Parse the _has parameter name
        # Format: _has:ResourceType:referenceParameter:searchParameter
        parts = param_name.split(':', 3)
        if len(parts) < 4 or parts[0] != '_has':
            return "1=1"  # Invalid format
        
        referencing_type = parts[1]  # e.g., "Observation"
        reference_param = parts[2]   # e.g., "patient"
        search_param = parts[3]      # e.g., "code"
        
        # Handle nested _has parameters
        if search_param.startswith('_has:'):
            # Recursive _has - build nested subquery
            return self._build_nested_has_clause(
                referencing_type, reference_param, search_param, 
                param_data, counter, sql_params
            )
        
        # Build subquery for reverse reference lookup
        conditions = []
        values = param_data.get('values', [])
        
        for i, value in enumerate(values):
            subquery_alias = f"has_{counter}_{i}"
            
            # Determine the actual value to search for
            if isinstance(value, dict):
                search_value = value.get('value') or value.get('code') or str(value)
            else:
                search_value = str(value)
            
            # Build the subquery
            subquery = self._build_single_has_subquery(
                subquery_alias, referencing_type, reference_param,
                search_param, search_value, counter, i, sql_params
            )
            
            conditions.append(subquery)
        
        return f"({' OR '.join(conditions)})" if conditions else "1=1"
    
    def _build_single_has_subquery(
        self,
        alias: str,
        referencing_type: str,
        reference_param: str,
        search_param: str,
        search_value: str,
        counter: int,
        value_index: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build a single _has subquery for reverse reference lookup."""
        # Determine if search_param has modifiers
        param_parts = search_param.split(':')
        base_search_param = param_parts[0]
        modifier = param_parts[1] if len(param_parts) > 1 else None
        
        # Build the search condition for the referencing resource
        search_condition = self._build_has_search_condition(
            alias, base_search_param, search_value, modifier, 
            counter, value_index, sql_params
        )
        
        # Build the reference condition
        # The referencing resource should reference the current resource
        reference_condition = self._build_has_reference_condition(
            alias, reference_param
        )
        
        # Combine into EXISTS subquery
        subquery = f"""
            EXISTS (
                SELECT 1 FROM fhir.resources {alias}
                WHERE {alias}.resource_type = '{referencing_type}'
                AND {alias}.deleted = false
                AND {search_condition}
                AND {reference_condition}
            )
        """
        
        return subquery.strip()
    
    def _build_has_search_condition(
        self,
        alias: str,
        search_param: str,
        search_value: str,
        modifier: Optional[str],
        counter: int,
        value_index: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build search condition for the _has parameter target."""
        value_key = f"has_value_{counter}_{value_index}"
        
        # Handle common search parameters
        if search_param == 'code':
            # Search in code.coding array
            sql_params[value_key] = search_value
            
            # Handle token search with optional system
            if '|' in search_value:
                system, code = search_value.split('|', 1)
                system_key = f"has_system_{counter}_{value_index}"
                code_key = f"has_code_{counter}_{value_index}"
                sql_params[system_key] = system if system else None
                sql_params[code_key] = code
                
                if system:
                    return f"""EXISTS (
                        SELECT 1 FROM jsonb_array_elements({alias}.resource->'code'->'coding') AS c
                        WHERE c->>'system' = :{system_key} AND c->>'code' = :{code_key}
                    )"""
                else:
                    return f"""EXISTS (
                        SELECT 1 FROM jsonb_array_elements({alias}.resource->'code'->'coding') AS c
                        WHERE c->>'code' = :{code_key}
                    )"""
            else:
                return f"""EXISTS (
                    SELECT 1 FROM jsonb_array_elements({alias}.resource->'code'->'coding') AS c
                    WHERE c->>'code' = :{value_key}
                )"""
        
        elif search_param == 'status':
            sql_params[value_key] = search_value
            return f"{alias}.resource->>'status' = :{value_key}"
        
        elif search_param == 'identifier':
            sql_params[value_key] = search_value
            return f"""EXISTS (
                SELECT 1 FROM jsonb_array_elements({alias}.resource->'identifier') AS i
                WHERE i->>'value' = :{value_key}
            )"""
        
        elif search_param in ['type', 'category']:
            # Handle CodeableConcept searches
            sql_params[value_key] = search_value
            return f"""EXISTS (
                SELECT 1 FROM jsonb_array_elements({alias}.resource->'{search_param}'->'coding') AS c
                WHERE c->>'code' = :{value_key}
            )"""
        
        elif search_param == 'date':
            # Handle date searches with prefixes
            return self._build_has_date_condition(
                alias, search_param, search_value, modifier, 
                counter, value_index, sql_params
            )
        
        elif search_param == '_id':
            sql_params[value_key] = search_value
            return f"{alias}.fhir_id = :{value_key}"
        
        else:
            # Generic string search
            sql_params[value_key] = f"%{search_value}%"
            return f"{alias}.resource->>'{search_param}' ILIKE :{value_key}"
    
    def _build_has_reference_condition(
        self,
        alias: str,
        reference_param: str
    ) -> str:
        """Build condition to check if referencing resource references the current resource."""
        # Handle different reference formats
        return f"""(
            {alias}.resource->'{reference_param}'->>'reference' = 
                r.resource_type || '/' || r.fhir_id
            OR {alias}.resource->'{reference_param}'->>'reference' = 
                'urn:uuid:' || r.fhir_id
            OR {alias}.resource->'{reference_param}'->>'reference' = r.fhir_id
        )"""
    
    def _build_has_date_condition(
        self,
        alias: str,
        search_param: str,
        search_value: str,
        modifier: Optional[str],
        counter: int,
        value_index: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build date condition for _has parameter."""
        # Parse date value with optional prefix
        parsed_date = self._parse_date_value(search_value)
        if not parsed_date:
            return "1=0"  # Invalid date
        
        prefix = parsed_date['prefix']
        date_value = parsed_date['value']
        precision = parsed_date['precision']
        
        # Get date range based on precision
        start_date, end_date = self._get_date_range(date_value, precision)
        
        start_key = f"has_date_start_{counter}_{value_index}"
        end_key = f"has_date_end_{counter}_{value_index}"
        
        if prefix == 'eq':
            sql_params[start_key] = start_date.isoformat()
            sql_params[end_key] = end_date.isoformat()
            return f"({alias}.resource->>'{search_param}' >= :{start_key} AND {alias}.resource->>'{search_param}' < :{end_key})"
        elif prefix == 'lt':
            sql_params[start_key] = start_date.isoformat()
            return f"{alias}.resource->>'{search_param}' < :{start_key}"
        elif prefix == 'gt':
            sql_params[end_key] = end_date.isoformat()
            return f"{alias}.resource->>'{search_param}' >= :{end_key}"
        elif prefix == 'le':
            sql_params[end_key] = end_date.isoformat()
            return f"{alias}.resource->>'{search_param}' < :{end_key}"
        elif prefix == 'ge':
            sql_params[start_key] = start_date.isoformat()
            return f"{alias}.resource->>'{search_param}' >= :{start_key}"
        else:
            # Default to equality
            sql_params[start_key] = start_date.isoformat()
            sql_params[end_key] = end_date.isoformat()
            return f"({alias}.resource->>'{search_param}' >= :{start_key} AND {alias}.resource->>'{search_param}' < :{end_key})"
    
    def _build_nested_has_clause(
        self,
        referencing_type: str,
        reference_param: str,
        nested_has_param: str,
        param_data: Dict,
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build nested _has clause for recursive reverse chaining.
        
        Example: _has:Observation:patient:_has:AuditEvent:entity:type=rest
        """
        # Parse the nested _has parameter
        nested_parts = nested_has_param.split(':', 3)
        if len(nested_parts) < 4 or nested_parts[0] != '_has':
            return "1=1"  # Invalid format
        
        nested_referencing_type = nested_parts[1]
        nested_reference_param = nested_parts[2]
        nested_search_param = nested_parts[3]
        
        values = param_data.get('values', [])
        conditions = []
        
        for i, value in enumerate(values):
            # Determine the actual value to search for
            if isinstance(value, dict):
                search_value = value.get('value') or value.get('code') or str(value)
            else:
                search_value = str(value)
            
            outer_alias = f"has_outer_{counter}_{i}"
            inner_alias = f"has_inner_{counter}_{i}"
            
            # Build the nested search condition
            search_condition = self._build_has_search_condition(
                inner_alias, nested_search_param, search_value, None,
                counter, i, sql_params
            )
            
            # Build nested EXISTS query
            subquery = f"""
                EXISTS (
                    SELECT 1 FROM fhir.resources {outer_alias}
                    WHERE {outer_alias}.resource_type = '{referencing_type}'
                    AND {outer_alias}.deleted = false
                    AND (
                        {outer_alias}.resource->'{reference_param}'->>'reference' = 
                            r.resource_type || '/' || r.fhir_id
                        OR {outer_alias}.resource->'{reference_param}'->>'reference' = 
                            'urn:uuid:' || r.fhir_id
                    )
                    AND EXISTS (
                        SELECT 1 FROM fhir.resources {inner_alias}
                        WHERE {inner_alias}.resource_type = '{nested_referencing_type}'
                        AND {inner_alias}.deleted = false
                        AND {search_condition}
                        AND (
                            {inner_alias}.resource->'{nested_reference_param}'->>'reference' = 
                                '{referencing_type}/' || {outer_alias}.fhir_id
                            OR {inner_alias}.resource->'{nested_reference_param}'->>'reference' = 
                                'urn:uuid:' || {outer_alias}.fhir_id
                        )
                    )
                )
            """
            
            conditions.append(subquery.strip())
        
        return f"({' OR '.join(conditions)})" if conditions else "1=1"
    
    def _get_date_range(
        self,
        date_value: datetime,
        precision: str
    ) -> Tuple[datetime, datetime]:
        """Get start and end dates for a given precision."""
        if precision == 'year':
            start = date_value.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            end = start.replace(year=start.year + 1)
        elif precision == 'month':
            start = date_value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            # Calculate first day of next month
            if start.month == 12:
                end = start.replace(year=start.year + 1, month=1)
            else:
                end = start.replace(month=start.month + 1)
        elif precision == 'day':
            start = date_value.replace(hour=0, minute=0, second=0, microsecond=0)
            # Add one day
            from datetime import timedelta
            end = start + timedelta(days=1)
        else:
            # Time precision - exact match
            start = date_value
            end = date_value + timedelta(microseconds=1)
        
        return start, end
    
    def _build_special_clause(
        self,
        alias: str,
        param_name: str,
        values: List[str],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for special parameters like geographic 'near' search."""
        if param_name == 'near':
            # Handle geographic proximity search
            # Format: latitude|longitude|distance|units
            # or: latitude|longitude (uses default distance)
            
            conditions = []
            for value in values:
                param_key = f"special_param_{counter}_{len(conditions)}"
                
                # Parse near parameter
                parts = value.split('|')
                if len(parts) < 2:
                    continue
                
                try:
                    target_lat = float(parts[0])
                    target_lon = float(parts[1])
                    
                    # Default distance: 50km if not specified
                    distance_km = 50.0
                    if len(parts) >= 3:
                        distance_km = float(parts[2])
                        # Handle units - default to km
                        if len(parts) >= 4 and parts[3].lower() in ['mi', 'mile', 'miles']:
                            distance_km = distance_km * 1.60934  # Convert miles to kilometers
                    
                    # Store search parameters
                    sql_params[f"{param_key}_lat"] = target_lat
                    sql_params[f"{param_key}_lon"] = target_lon
                    sql_params[f"{param_key}_dist"] = distance_km
                    
                    # Use the Haversine formula for distance calculation
                    # 6371 is Earth's radius in kilometers
                    distance_calc = f"""
                        6371 * 2 * ASIN(SQRT(
                            POWER(SIN(RADIANS(:{param_key}_lat - 
                                CAST(SPLIT_PART({alias}.value_string, ',', 1) AS FLOAT)
                            ) / 2), 2) +
                            COS(RADIANS(CAST(SPLIT_PART({alias}.value_string, ',', 1) AS FLOAT))) *
                            COS(RADIANS(:{param_key}_lat)) *
                            POWER(SIN(RADIANS(:{param_key}_lon - 
                                CAST(SPLIT_PART({alias}.value_string, ',', 2) AS FLOAT)
                            ) / 2), 2)
                        ))
                    """
                    
                    condition = f"""
                        ({alias}.param_name = 'near' AND
                         {alias}.param_type = 'special' AND
                         {alias}.value_string IS NOT NULL AND
                         ARRAY_LENGTH(STRING_TO_ARRAY({alias}.value_string, ','), 1) >= 2 AND
                         {distance_calc} <= :{param_key}_dist)
                    """
                    
                    conditions.append(condition)
                    
                except (ValueError, IndexError):
                    # Invalid coordinate format, skip this value
                    continue
            
            if conditions:
                return f"({' OR '.join(conditions)})"
            else:
                # No valid geographic parameters, return false condition
                return "1=0"
        
        # Default handling for other special parameters
        conditions = []
        for i, value in enumerate(values):
            param_key = f"special_param_{counter}_{i}"
            sql_params[param_key] = value
            conditions.append(f"""
                {alias}.param_name = '{param_name}' AND
                {alias}.param_type = 'special' AND
                {alias}.value_string = :{param_key}
            """)
        
        return f"({' OR '.join(conditions)})"
    
    def _build_composite_clause(
        self,
        resource_type: str,
        param_name: str,
        values: List[Any],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for composite search parameters."""
        # Use the CompositeSearchHandler to build the JSONB query
        conditions = []
        
        for i, value in enumerate(values):
            if isinstance(value, str):
                # Parse composite value
                parsed_values = self.composite_handler.parse_composite_value(value)
                
                # Build JSONB conditions based on resource type and parameter
                if resource_type == "Observation" and param_name == "code-value-quantity":
                    # Example: code-value-quantity=http://loinc.org|8480-6$gt140
                    if len(parsed_values) >= 2:
                        code = parsed_values[0]
                        quantity_expr = parsed_values[1]
                        
                        # Parse quantity expression
                        comparator = 'eq'
                        number_str = quantity_expr
                        
                        # Check for comparator prefixes
                        for comp in ['gt', 'ge', 'lt', 'le', 'eq', 'ne']:
                            if quantity_expr.startswith(comp):
                                comparator = comp
                                number_str = quantity_expr[len(comp):]
                                break
                        
                        try:
                            number = float(number_str)
                        except ValueError:
                            continue
                        
                        # Build JSONB condition
                        code_key = f"comp_code_{counter}_{i}"
                        value_key = f"comp_value_{counter}_{i}"
                        sql_params[code_key] = code
                        sql_params[value_key] = number
                        
                        # Build the appropriate comparison
                        comp_op = {
                            'gt': '>',
                            'ge': '>=',
                            'lt': '<',
                            'le': '<=',
                            'eq': '=',
                            'ne': '!='
                        }.get(comparator, '=')
                        
                        condition = f"""
                            (EXISTS (
                                SELECT 1 FROM jsonb_array_elements(r.resource->'code'->'coding') AS coding
                                WHERE coding->>'code' = :{code_key}
                            ) AND (r.resource->'valueQuantity'->>'value')::numeric {comp_op} :{value_key})
                        """
                        conditions.append(condition)
                        
                elif resource_type == "Observation" and param_name == "component-code-value-quantity":
                    # Component composite search
                    if len(parsed_values) >= 2:
                        code = parsed_values[0]
                        quantity_expr = parsed_values[1]
                        
                        # Parse quantity expression (same as above)
                        comparator = 'eq'
                        number_str = quantity_expr
                        
                        for comp in ['gt', 'ge', 'lt', 'le', 'eq', 'ne']:
                            if quantity_expr.startswith(comp):
                                comparator = comp
                                number_str = quantity_expr[len(comp):]
                                break
                        
                        try:
                            number = float(number_str)
                        except ValueError:
                            continue
                        
                        code_key = f"comp_code_{counter}_{i}"
                        value_key = f"comp_value_{counter}_{i}"
                        sql_params[code_key] = code
                        sql_params[value_key] = number
                        
                        comp_op = {
                            'gt': '>',
                            'ge': '>=',
                            'lt': '<',
                            'le': '<=',
                            'eq': '=',
                            'ne': '!='
                        }.get(comparator, '=')
                        
                        condition = f"""
                            EXISTS (
                                SELECT 1 FROM jsonb_array_elements(r.resource->'component') AS comp
                                WHERE EXISTS (
                                    SELECT 1 FROM jsonb_array_elements(comp->'code'->'coding') AS coding
                                    WHERE coding->>'code' = :{code_key}
                                ) AND (comp->'valueQuantity'->>'value')::numeric {comp_op} :{value_key}
                            )
                        """
                        conditions.append(condition)
                        
                elif resource_type == "Condition" and param_name == "code-severity":
                    # Condition composite search
                    if len(parsed_values) >= 2:
                        code = parsed_values[0]
                        severity = parsed_values[1]
                        
                        code_key = f"comp_code_{counter}_{i}"
                        severity_key = f"comp_severity_{counter}_{i}"
                        sql_params[code_key] = code
                        sql_params[severity_key] = severity
                        
                        condition = f"""
                            (EXISTS (
                                SELECT 1 FROM jsonb_array_elements(r.resource->'code'->'coding') AS coding
                                WHERE coding->>'code' = :{code_key}
                            ) AND EXISTS (
                                SELECT 1 FROM jsonb_array_elements(r.resource->'severity'->'coding') AS coding
                                WHERE coding->>'code' = :{severity_key}
                            ))
                        """
                        conditions.append(condition)
        
        if conditions:
            return f"({' OR '.join(conditions)})"
        else:
            # No valid composite parameters
            return "1=0"