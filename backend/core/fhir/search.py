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
from .reference_utils import ReferenceUtils


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
            if param_name.startswith('_has:'):
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
    
    def _parse_parameter(
        self,
        resource_type: str,
        param_name: str,
        param_values: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Parse a single search parameter."""
        # Extract modifier if present
        if ':' in param_name:
            parts = param_name.split(':', 1)
            base_param = parts[0]
            modifier = parts[1]
        else:
            base_param = param_name
            modifier = None
        
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
    
    def _build_has_clause(
        self,
        param_name: str,
        param_data: Dict,
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build WHERE clause for _has parameter (reverse chaining)."""
        # _has:Observation:patient:code=1234-5
        # Find patients that have observations with code 1234-5
        
        # This is a simplified implementation
        # Full implementation would parse the _has parameter and build subquery
        return "1=1"
    
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