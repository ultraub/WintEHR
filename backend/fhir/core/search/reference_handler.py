"""
FHIR Reference Search Handler

Handles normalization and searching of FHIR references across different formats.
Supports:
- Standard ResourceType/id format (e.g., Patient/123)
- urn:uuid: format (e.g., urn:uuid:123)
- Partial matches (just ID)
- Chained searches
"""

from typing import List, Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class ReferenceSearchHandler:
    """Handles reference searches with format normalization."""
    
    @staticmethod
    def build_reference_search_conditions(
        param_name: str,
        search_value: str,
        resource_type_constraint: Optional[str] = None
    ) -> Tuple[List[str], Dict[str, Any]]:
        """
        Build SQL conditions for reference searches that handle multiple formats.
        
        Args:
            param_name: The search parameter name
            search_value: The reference value being searched for
            resource_type_constraint: Optional resource type constraint
            
        Returns:
            Tuple of (SQL conditions list, parameter dict)
        """
        conditions = []
        params = {}
        
        # Extract the ID and type from the search value
        resource_type = None
        resource_id = None
        
        if search_value.startswith('urn:uuid:'):
            # urn:uuid: format
            resource_id = search_value[9:]
        elif '/' in search_value:
            # ResourceType/id format
            parts = search_value.split('/', 1)
            if len(parts) == 2:
                resource_type = parts[0]
                resource_id = parts[1]
        else:
            # Just an ID
            resource_id = search_value
            
        # Apply resource type constraint if provided
        if resource_type_constraint:
            resource_type = resource_type_constraint
            
        # Build conditions for different storage formats
        if resource_id:
            # The reference might be stored in different formats:
            # 1. Just the ID
            # 2. ResourceType/id
            # 3. urn:uuid:id
            
            # Check for just the ID
            conditions.append("sp.value_reference = :ref_id")
            params['ref_id'] = resource_id
            
            # Check for urn:uuid: format
            conditions.append("sp.value_reference = :ref_urn")
            params['ref_urn'] = f"urn:uuid:{resource_id}"
            
            # If we know the resource type, check for full reference
            if resource_type:
                conditions.append("sp.value_reference = :ref_full")
                params['ref_full'] = f"{resource_type}/{resource_id}"
                
        return conditions, params
    
    @staticmethod
    def normalize_stored_reference(reference: str) -> str:
        """
        Normalize a stored reference for consistent comparison.
        
        Args:
            reference: The stored reference value
            
        Returns:
            Normalized reference string
        """
        if not reference:
            return reference
            
        # For now, return as-is since we handle multiple formats in search
        return reference
    
    @staticmethod
    def extract_id_from_reference(reference: str) -> Optional[str]:
        """
        Extract just the ID part from any reference format.
        
        Args:
            reference: The reference string
            
        Returns:
            The extracted ID or None
        """
        if not reference:
            return None
            
        if reference.startswith('urn:uuid:'):
            return reference[9:]
        elif '/' in reference:
            parts = reference.split('/', 1)
            if len(parts) == 2:
                return parts[1]
                
        # Assume it's already just an ID
        return reference