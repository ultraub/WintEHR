"""
FHIR Query Builder for Generic Resource Storage
Handles building queries against JSONB stored FHIR resources
"""

from sqlalchemy import and_, or_, func, cast, String
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from fhir.models.resource import FHIRResource


class FHIRQueryBuilder:
    """Builds queries for FHIR resources stored as JSONB"""
    
    def __init__(self, resource_type: str):
        self.resource_type = resource_type
    
    def base_query(self, session):
        """Get base query for this resource type"""
        return session.query(FHIRResource).filter(
            FHIRResource.resource_type == self.resource_type,
            FHIRResource.deleted == False
        )
    
    def apply_patient_filter(self, query, patient_id: str):
        """Apply patient filter to query"""
        # Handle different patient reference paths
        patient_ref = f"Patient/{patient_id}"
        
        return query.filter(
            or_(
                FHIRResource.resource['subject']['reference'].astext == patient_ref,
                FHIRResource.resource['patient']['reference'].astext == patient_ref,
                FHIRResource.resource['beneficiary']['reference'].astext == patient_ref,
                # For Patient resources, match by fhir_id
                and_(
                    FHIRResource.resource_type == 'Patient',
                    FHIRResource.fhir_id == patient_id
                )
            )
        )
    
    def apply_encounter_filter(self, query, encounter_id: str):
        """Apply encounter filter to query"""
        encounter_ref = f"Encounter/{encounter_id}"
        
        return query.filter(
            or_(
                FHIRResource.resource['encounter']['reference'].astext == encounter_ref,
                FHIRResource.resource['context']['reference'].astext == encounter_ref,
                # For Encounter resources, match by fhir_id
                and_(
                    FHIRResource.resource_type == 'Encounter',
                    FHIRResource.fhir_id == encounter_id
                )
            )
        )
    
    def apply_code_filter(self, query, code_value: str, system: Optional[str] = None):
        """Apply code filter to query"""
        conditions = []
        
        # Check main code field
        if system:
            # Search for specific system and code
            conditions.append(
                func.jsonb_path_exists(
                    FHIRResource.resource,
                    f'$.code.coding[*] ? (@.system == "{system}" && @.code == "{code_value}")'
                )
            )
        else:
            # Search for code in any system
            conditions.append(
                func.jsonb_path_exists(
                    FHIRResource.resource,
                    f'$.code.coding[*] ? (@.code == "{code_value}")'
                )
            )
        
        # Also check text field
        conditions.append(
            FHIRResource.resource['code']['text'].astext.ilike(f'%{code_value}%')
        )
        
        return query.filter(or_(*conditions))
    
    def apply_status_filter(self, query, status: str, status_field: str = 'status'):
        """Apply status filter to query"""
        if '.' in status_field:
            # Handle nested status fields like clinicalStatus.coding[0].code
            path_parts = status_field.split('.')
            json_path = FHIRResource.resource
            for part in path_parts:
                if '[' in part and ']' in part:
                    # Handle array access
                    field, index = part.split('[')
                    index = int(index.rstrip(']'))
                    json_path = json_path[field][index]
                else:
                    json_path = json_path[part]
            return query.filter(json_path.astext == status)
        else:
            # Simple status field
            return query.filter(
                FHIRResource.resource[status_field].astext == status
            )
    
    def apply_date_filter(self, query, date_field: str, date_value: str, modifier: Optional[str] = None):
        """Apply date filter with support for modifiers"""
        # Parse date value
        if 'T' in date_value:
            date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
        else:
            date_obj = datetime.strptime(date_value, '%Y-%m-%d')
        
        # Get the JSON field
        json_date = FHIRResource.resource[date_field].astext
        
        # Apply modifier
        if modifier == 'eq' or not modifier:
            # Equal (same day)
            start_of_day = date_obj.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = date_obj.replace(hour=23, minute=59, second=59, microsecond=999999)
            return query.filter(
                json_date >= start_of_day.isoformat(),
                json_date <= end_of_day.isoformat()
            )
        elif modifier == 'ne':
            # Not equal
            start_of_day = date_obj.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = date_obj.replace(hour=23, minute=59, second=59, microsecond=999999)
            return query.filter(
                or_(
                    json_date < start_of_day.isoformat(),
                    json_date > end_of_day.isoformat()
                )
            )
        elif modifier == 'lt':
            # Less than
            return query.filter(json_date < date_obj.isoformat())
        elif modifier == 'le':
            # Less than or equal
            return query.filter(json_date <= date_obj.isoformat())
        elif modifier == 'gt':
            # Greater than
            return query.filter(json_date > date_obj.isoformat())
        elif modifier == 'ge':
            # Greater than or equal
            return query.filter(json_date >= date_obj.isoformat())
        
        return query
    
    def apply_reference_filter(self, query, ref_field: str, ref_value: str, ref_type: Optional[str] = None):
        """Apply reference filter"""
        if ref_type and not ref_value.startswith(f"{ref_type}/"):
            ref_value = f"{ref_type}/{ref_value}"
        
        return query.filter(
            FHIRResource.resource[ref_field]['reference'].astext == ref_value
        )
    
    def apply_identifier_filter(self, query, identifier_value: str, system: Optional[str] = None):
        """Apply identifier filter"""
        if system:
            # Search for specific system and value
            return query.filter(
                func.jsonb_path_exists(
                    FHIRResource.resource,
                    f'$.identifier[*] ? (@.system == "{system}" && @.value == "{identifier_value}")'
                )
            )
        else:
            # Search for value in any system
            return query.filter(
                func.jsonb_path_exists(
                    FHIRResource.resource,
                    f'$.identifier[*] ? (@.value == "{identifier_value}")'
                )
            )
    
    def apply_string_filter(self, query, field_path: str, value: str, modifier: Optional[str] = None):
        """Apply string filter with support for modifiers"""
        # Navigate to the field
        path_parts = field_path.split('.')
        json_field = FHIRResource.resource
        for part in path_parts:
            json_field = json_field[part]
        
        if modifier == 'exact':
            return query.filter(json_field.astext == value)
        elif modifier == 'contains':
            return query.filter(json_field.astext.ilike(f'%{value}%'))
        else:
            # Default: starts with (for names)
            return query.filter(json_field.astext.ilike(f'{value}%'))
    
    def apply_token_filter(self, query, token_field: str, token_value: str, modifier: Optional[str] = None):
        """Apply token filter (for coded values)"""
        if '|' in token_value:
            system, code = token_value.split('|', 1)
            return self.apply_code_filter(query, code, system)
        else:
            # Just code, no system
            return self.apply_code_filter(query, token_value)
    
    def apply_missing_filter(self, query, field_path: str, is_missing: bool):
        """Apply :missing modifier for JSONB fields
        
        Args:
            query: Current query
            field_path: JSON path to the field (e.g., 'identifier', 'subject.reference')
            is_missing: True if searching for resources where field is missing
        """
        # Build the JSON path expression
        path_parts = field_path.split('.')
        json_field = FHIRResource.resource
        
        # Navigate to the field
        for part in path_parts:
            json_field = json_field[part]
        
        if is_missing:
            # Find resources where the field is null or doesn't exist
            return query.filter(
                or_(
                    json_field.is_(None),
                    func.jsonb_typeof(json_field) == 'null'
                )
            )
        else:
            # Find resources where the field exists and is not null
            return query.filter(
                and_(
                    json_field.isnot(None),
                    func.jsonb_typeof(json_field) != 'null'
                )
            )
    
    def apply_chained_parameter(self, query, session, reference_param: str, chain_param: str, chain_value: str):
        """Apply chained parameter search (e.g., subject.name=Smith)
        
        Args:
            query: Current query on this resource type
            session: Database session for subqueries
            reference_param: The reference parameter (e.g., 'subject', 'patient')
            chain_param: The parameter on the referenced resource (e.g., 'name', 'family')
            chain_value: The value to search for
        """
        # Common reference mappings
        ref_mappings = {
            'subject': 'Patient',
            'patient': 'Patient',
            'performer': 'Practitioner',
            'requester': 'Practitioner',
            'organization': 'Organization',
            'encounter': 'Encounter'
        }
        
        # Get the target resource type
        target_type = ref_mappings.get(reference_param)
        if not target_type:
            # If not in mappings, try to infer from parameter name
            target_type = reference_param.capitalize()
        
        # Create subquery to find matching referenced resources
        subquery = session.query(FHIRResource.fhir_id).filter(
            FHIRResource.resource_type == target_type,
            FHIRResource.deleted == False
        )
        
        # Apply the chain parameter filter based on common patterns
        if chain_param == 'name':
            # Search in name.family, name.given, and name.text
            subquery = subquery.filter(
                or_(
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.name[*].family ? (@ ilike "%{chain_value}%")'
                    ),
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.name[*].given[*] ? (@ ilike "%{chain_value}%")'
                    ),
                    func.jsonb_path_exists(
                        FHIRResource.resource,
                        f'$.name[*].text ? (@ ilike "%{chain_value}%")'
                    )
                )
            )
        elif chain_param == 'family':
            subquery = subquery.filter(
                func.jsonb_path_exists(
                    FHIRResource.resource,
                    f'$.name[*].family ? (@ ilike "%{chain_value}%")'
                )
            )
        elif chain_param == 'given':
            subquery = subquery.filter(
                func.jsonb_path_exists(
                    FHIRResource.resource,
                    f'$.name[*].given[*] ? (@ ilike "%{chain_value}%")'
                )
            )
        elif chain_param == 'identifier':
            subquery = subquery.filter(
                func.jsonb_path_exists(
                    FHIRResource.resource,
                    f'$.identifier[*].value ? (@ == "{chain_value}")'
                )
            )
        else:
            # Generic field search
            subquery = subquery.filter(
                FHIRResource.resource[chain_param].astext.ilike(f'%{chain_value}%')
            )
        
        # Get the IDs of matching resources
        matching_ids = [f"{target_type}/{r.fhir_id}" for r in subquery.all()]
        
        if not matching_ids:
            # No matches found, return empty result
            return query.filter(False)
        
        # Filter main query by references to matching resources
        ref_field = reference_param if reference_param in ['subject', 'patient'] else reference_param
        conditions = []
        
        for ref_id in matching_ids:
            conditions.append(
                FHIRResource.resource[ref_field]['reference'].astext == ref_id
            )
        
        return query.filter(or_(*conditions))