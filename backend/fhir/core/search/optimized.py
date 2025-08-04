"""
Optimized FHIR Search Query Builder

Uses EXISTS subqueries instead of multiple LEFT JOINs for better performance
with compound indexes.

Author: WintEHR Team
Date: 2025-01-24
"""

import logging
from typing import Dict, List, Tuple, Any, Optional

logger = logging.getLogger(__name__)


class OptimizedSearchBuilder:
    """Builds optimized search queries using EXISTS subqueries."""
    
    def build_optimized_query(
        self,
        resource_type: str,
        search_params: Dict[str, Any],
        limit: int = 100,
        offset: int = 0,
        count_only: bool = False
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Build an optimized search query using EXISTS subqueries.
        
        Args:
            resource_type: FHIR resource type
            search_params: Parsed search parameters
            limit: Maximum results
            offset: Result offset
            count_only: If True, return only count query
            
        Returns:
            Tuple of (sql_query, sql_params)
        """
        sql_params = {
            'resource_type': resource_type,
            'limit': limit,
            'offset': offset
        }
        
        # Build WHERE clauses using EXISTS
        where_clauses = [
            "r.resource_type = :resource_type",
            "r.deleted = false"
        ]
        
        # Process each search parameter
        param_counter = 0
        for param_name, param_data in search_params.items():
            if param_name == '_sort' or param_name == '_include':
                continue
                
            param_counter += 1
            
            # Handle _id parameter specially
            if param_name == '_id':
                where_clauses.append(self._build_id_clause(param_data, param_counter, sql_params))
                continue
            
            # Build EXISTS clause for this parameter
            exists_clause = self._build_exists_clause(
                param_name, param_data, param_counter, sql_params
            )
            if exists_clause:
                where_clauses.append(exists_clause)
                logger.debug(f"Added EXISTS clause for {param_name}: {exists_clause[:100]}...")
        
        # Build final query
        if count_only:
            query = f"""
                SELECT COUNT(DISTINCT r.id) as total
                FROM fhir.resources r
                WHERE {' AND '.join(where_clauses)}
            """
        else:
            # Extract sort parameters
            sort_clause = self._build_sort_clause(search_params.get('_sort', {}))
            
            query = f"""
                SELECT DISTINCT r.resource, r.fhir_id, r.version_id, r.last_updated
                FROM fhir.resources r
                WHERE {' AND '.join(where_clauses)}
                {sort_clause}
                LIMIT :limit OFFSET :offset
            """
        
        logger.debug(f"Generated query: {query[:200]}...")
        logger.debug(f"SQL params: {sql_params}")
        
        return query, sql_params
    
    def _build_exists_clause(
        self,
        param_name: str,
        param_data: Dict[str, Any],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> Optional[str]:
        """Build an EXISTS subquery for a search parameter."""
        param_type = param_data.get('type')
        modifier = param_data.get('modifier')
        values = param_data.get('values', [])
        
        if not values:
            return None
        
        # Handle :missing modifier
        if modifier == 'missing':
            return self._build_missing_exists(param_name, values[0], counter, sql_params)
        
        # Build value conditions based on parameter type
        value_conditions = []
        
        if param_type == 'string':
            value_conditions = self._build_string_conditions(
                param_name, values, modifier, counter, sql_params
            )
        elif param_type == 'token':
            value_conditions = self._build_token_conditions(
                param_name, values, modifier, counter, sql_params
            )
        elif param_type == 'reference':
            value_conditions = self._build_reference_conditions(
                param_name, values, modifier, counter, sql_params
            )
        elif param_type == 'date':
            value_conditions = self._build_date_conditions(
                param_name, values, modifier, counter, sql_params
            )
        elif param_type == 'number':
            value_conditions = self._build_number_conditions(
                param_name, values, modifier, counter, sql_params
            )
        
        if not value_conditions:
            return None
        
        # Combine with OR if multiple values
        value_clause = f"({' OR '.join(value_conditions)})" if len(value_conditions) > 1 else value_conditions[0]
        
        # Build EXISTS subquery - handle :not modifier
        if modifier == 'not':
            return f"""NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp{counter}
                WHERE sp{counter}.resource_id = r.id
                AND sp{counter}.param_name = :param_name_{counter}
                AND {value_clause}
            )"""
        else:
            return f"""EXISTS (
                SELECT 1 FROM fhir.search_params sp{counter}
                WHERE sp{counter}.resource_id = r.id
                AND sp{counter}.param_name = :param_name_{counter}
                AND {value_clause}
            )"""
    
    def _build_string_conditions(
        self,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> List[str]:
        """Build conditions for string searches."""
        conditions = []
        sql_params[f'param_name_{counter}'] = param_name
        
        for i, value_dict in enumerate(values):
            # Extract the actual value from the dictionary
            value = value_dict.get('value', value_dict) if isinstance(value_dict, dict) else value_dict
            key = f"string_{counter}_{i}"
            
            if modifier == 'exact':
                conditions.append(f"sp{counter}.value_string = :{key}")
                sql_params[key] = value
            elif modifier == 'contains':
                conditions.append(f"sp{counter}.value_string ILIKE :{key}")
                sql_params[key] = f"%{value}%"
            else:  # Default: starts-with (but using contains for better UX)
                conditions.append(f"sp{counter}.value_string ILIKE :{key}")
                sql_params[key] = f"%{value}%"
        
        return conditions
    
    def _build_token_conditions(
        self,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> List[str]:
        """Build conditions for token searches."""
        conditions = []
        sql_params[f'param_name_{counter}'] = param_name
        
        for i, value_dict in enumerate(values):
            # Handle both old and new formats
            if isinstance(value_dict, dict):
                # Extract from the nested structure
                system = value_dict.get('system')
                code = value_dict.get('code', value_dict.get('value'))
            else:
                # If it's just a string value
                system = None
                code = value_dict
            
            if system and code:
                # System and code
                system_key = f"system_{counter}_{i}"
                code_key = f"code_{counter}_{i}"
                conditions.append(
                    f"(sp{counter}.value_token = :{system_key} AND sp{counter}.value_token_code = :{code_key})"
                )
                sql_params[system_key] = system
                sql_params[code_key] = code
            elif code:
                # Code only
                code_key = f"code_{counter}_{i}"
                conditions.append(f"sp{counter}.value_token_code = :{code_key}")
                sql_params[code_key] = code
            elif system:
                # System only
                system_key = f"system_{counter}_{i}"
                conditions.append(f"sp{counter}.value_token = :{system_key}")
                sql_params[system_key] = system
        
        return conditions
    
    def _build_reference_conditions(
        self,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> List[str]:
        """Build conditions for reference searches."""
        conditions = []
        sql_params[f'param_name_{counter}'] = param_name
        
        for i, value_dict in enumerate(values):
            # Handle the nested dictionary structure for references
            if isinstance(value_dict, dict):
                # Check if this is a reference object with 'id' field
                if 'id' in value_dict:
                    # This is the parsed reference format: {'type': None, 'id': '...'}
                    value = value_dict['id']
                else:
                    # Try to get 'value' field or use the dict itself
                    value = value_dict.get('value', value_dict)
            else:
                value = value_dict
            
            ref_key = f"ref_{counter}_{i}"
            urn_key = f"urn_{counter}_{i}"
            
            # Handle different reference formats
            if '/' in str(value):
                # Full reference like "Patient/123"
                # Check both value_reference and value_string columns
                conditions.append(f"(sp{counter}.value_reference = :{ref_key} OR sp{counter}.value_string = :{ref_key})")
                sql_params[ref_key] = value
            else:
                # Just ID - need to check multiple formats:
                # 1. Reference format: "ResourceType/id" in value_reference
                # 2. URN format: "urn:uuid:id" in value_string (Synthea format)
                # 3. Direct ID in value_reference
                # 4. Numeric ID if this is a UUID
                ref_pattern_key = f"ref_pattern_{counter}_{i}"
                condition_parts = [
                    f"sp{counter}.value_reference LIKE :{ref_pattern_key}",  # Matches "ResourceType/id"
                    f"sp{counter}.value_string = :{urn_key}",  # Matches "urn:uuid:id"
                    f"sp{counter}.value_string LIKE :{ref_pattern_key}",  # Matches "ResourceType/id" in value_string
                    f"sp{counter}.value_reference = :{ref_key}"  # Direct ID match
                ]
                
                # If this looks like a UUID, also search for the numeric ID mapping
                if '-' in str(value) and len(str(value)) == 36:
                    # This is likely a UUID - add conditions for numeric ID references
                    numeric_id_key = f"ref_numeric_{counter}_{i}"
                    
                    # Add subqueries to find resources by numeric ID
                    # Note: We need to guess the resource type - default to Patient for patient searches
                    target_type = 'Patient' if param_name in ['patient', 'subject'] else None
                    
                    if target_type:
                        condition_parts.append(
                            f"sp{counter}.value_string IN ("
                            f"SELECT '{target_type}/' || id::text FROM fhir.resources "
                            f"WHERE resource_type = '{target_type}' AND fhir_id = :{numeric_id_key} AND deleted = false"
                            f")"
                        )
                        condition_parts.append(
                            f"sp{counter}.value_reference IN ("
                            f"SELECT id::text FROM fhir.resources "
                            f"WHERE resource_type = '{target_type}' AND fhir_id = :{numeric_id_key} AND deleted = false"
                            f")"
                        )
                        sql_params[numeric_id_key] = value
                
                conditions.append(f"({' OR '.join(condition_parts)})")
                sql_params[ref_key] = value
                sql_params[ref_pattern_key] = f"%/{value}"
                sql_params[urn_key] = f"urn:uuid:{value}"
        
        return conditions
    
    def _build_date_conditions(
        self,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> List[str]:
        """Build conditions for date searches."""
        conditions = []
        sql_params[f'param_name_{counter}'] = param_name
        
        for i, value_dict in enumerate(values):
            # Handle both dictionary and direct value formats
            if isinstance(value_dict, dict):
                prefix = value_dict.get('prefix', 'eq')
                date_value = value_dict.get('value')
                precision = value_dict.get('precision', 'day')
            else:
                # If it's a direct value, assume eq prefix
                prefix = 'eq'
                date_value = value_dict
                precision = 'day'
            
            if not date_value:
                continue
            
            date_key = f"date_{counter}_{i}"
            
            # Import datetime handling
            from datetime import datetime, timedelta
            
            if prefix == 'eq':
                # For equality, we need to handle date precision
                start_key = f"{date_key}_start"
                end_key = f"{date_key}_end"
                conditions.append(
                    f"(sp{counter}.value_date >= :{start_key} AND sp{counter}.value_date < :{end_key})"
                )
                
                # Handle datetime objects properly
                if isinstance(date_value, datetime):
                    # Calculate date range based on precision
                    if precision == 'year':
                        start = date_value.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
                        end = start.replace(year=start.year + 1)
                    elif precision == 'month':
                        start = date_value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                        if start.month == 12:
                            end = start.replace(year=start.year + 1, month=1)
                        else:
                            end = start.replace(month=start.month + 1)
                    elif precision == 'day':
                        start = date_value.replace(hour=0, minute=0, second=0, microsecond=0)
                        end = start + timedelta(days=1)
                    else:  # time precision
                        start = date_value
                        end = date_value + timedelta(microseconds=1)
                    
                    sql_params[start_key] = start
                    sql_params[end_key] = end
                else:
                    # String date handling (legacy)
                    sql_params[start_key] = date_value
                    if isinstance(date_value, str) and len(date_value) == 10:
                        sql_params[end_key] = date_value + ' 23:59:59'
                    else:
                        sql_params[end_key] = date_value
            elif prefix == 'lt':
                conditions.append(f"sp{counter}.value_date < :{date_key}")
                sql_params[date_key] = date_value
            elif prefix == 'le':
                conditions.append(f"sp{counter}.value_date <= :{date_key}")
                sql_params[date_key] = date_value
            elif prefix == 'gt':
                conditions.append(f"sp{counter}.value_date > :{date_key}")
                sql_params[date_key] = date_value
            elif prefix == 'ge':
                conditions.append(f"sp{counter}.value_date >= :{date_key}")
                sql_params[date_key] = date_value
        
        return conditions
    
    def _build_number_conditions(
        self,
        param_name: str,
        values: List[Dict],
        modifier: Optional[str],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> List[str]:
        """Build conditions for number searches."""
        conditions = []
        sql_params[f'param_name_{counter}'] = param_name
        
        for i, value_dict in enumerate(values):
            # Handle both dictionary and direct value formats
            if isinstance(value_dict, dict):
                prefix = value_dict.get('prefix', 'eq')
                number_value = value_dict.get('value')
            else:
                # If it's a direct value, assume eq prefix
                prefix = 'eq'
                number_value = value_dict
            
            if number_value is None:
                continue
            
            number_key = f"number_{counter}_{i}"
            
            if prefix == 'eq':
                conditions.append(f"sp{counter}.value_number = :{number_key}")
            elif prefix == 'lt':
                conditions.append(f"sp{counter}.value_number < :{number_key}")
            elif prefix == 'le':
                conditions.append(f"sp{counter}.value_number <= :{number_key}")
            elif prefix == 'gt':
                conditions.append(f"sp{counter}.value_number > :{number_key}")
            elif prefix == 'ge':
                conditions.append(f"sp{counter}.value_number >= :{number_key}")
            
            sql_params[number_key] = number_value
        
        return conditions
    
    def _build_missing_exists(
        self,
        param_name: str,
        missing_value: bool,
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build EXISTS clause for :missing modifier."""
        sql_params[f'param_name_{counter}'] = param_name
        
        if missing_value:
            # Parameter should be missing
            return f"""NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp{counter}
                WHERE sp{counter}.resource_id = r.id
                AND sp{counter}.param_name = :param_name_{counter}
            )"""
        else:
            # Parameter should be present
            return f"""EXISTS (
                SELECT 1 FROM fhir.search_params sp{counter}
                WHERE sp{counter}.resource_id = r.id
                AND sp{counter}.param_name = :param_name_{counter}
            )"""
    
    def _build_id_clause(
        self,
        param_data: Dict[str, Any],
        counter: int,
        sql_params: Dict[str, Any]
    ) -> str:
        """Build clause for _id parameter."""
        values = param_data.get('values', [])
        if not values:
            return "1=1"
        
        # Extract actual values from dictionary format if needed
        extracted_values = []
        for v in values:
            if isinstance(v, dict):
                extracted_values.append(v.get('value', v))
            else:
                extracted_values.append(v)
        
        if len(extracted_values) == 1:
            sql_params[f'id_{counter}'] = extracted_values[0]
            return f"r.fhir_id = :id_{counter}"
        else:
            # Multiple IDs
            id_placeholders = []
            for i, value in enumerate(extracted_values):
                key = f"id_{counter}_{i}"
                sql_params[key] = value
                id_placeholders.append(f":{key}")
            return f"r.fhir_id IN ({', '.join(id_placeholders)})"
    
    def _build_sort_clause(self, sort_params: Dict[str, Any]) -> str:
        """Build ORDER BY clause from sort parameters."""
        if not sort_params or not sort_params.get('values'):
            return "ORDER BY r.last_updated DESC"
        
        sort_fields = []
        for sort_value in sort_params.get('values', []):
            # Parse sort parameter (e.g., "-date" or "status")
            if sort_value.startswith('-'):
                field = sort_value[1:]
                direction = 'DESC'
            else:
                field = sort_value
                direction = 'ASC'
            
            # Map common sort fields
            if field == '_lastUpdated':
                sort_fields.append(f"r.last_updated {direction}")
            elif field == '_id':
                sort_fields.append(f"r.fhir_id {direction}")
            else:
                # For other fields, we'd need to join with search_params
                # For now, fall back to last_updated
                sort_fields.append(f"r.last_updated {direction}")
        
        return f"ORDER BY {', '.join(sort_fields)}" if sort_fields else "ORDER BY r.last_updated DESC"