"""
FHIR Reference Utilities

Handles normalization and transformation of FHIR references between different formats.
"""

import re
from typing import Optional, Tuple


class ReferenceUtils:
    """Utilities for handling FHIR references."""
    
    @staticmethod
    def normalize_reference(reference: str) -> str:
        """
        Normalize a FHIR reference to standard format.
        
        Handles:
        - urn:uuid: references (Synthea format)
        - Standard ResourceType/id references
        - Absolute URL references
        
        Args:
            reference: The reference string to normalize
            
        Returns:
            Normalized reference string
        """
        if not reference:
            return reference
            
        # Handle urn:uuid: references
        if reference.startswith('urn:uuid:'):
            # Keep the urn:uuid format as it's valid FHIR
            return reference
            
        # Handle absolute URLs
        if reference.startswith('http://') or reference.startswith('https://'):
            # Extract the last part which should be ResourceType/id
            parts = reference.split('/')
            if len(parts) >= 2:
                return f"{parts[-2]}/{parts[-1]}"
                
        # Already in standard format
        return reference
    
    @staticmethod
    def normalize_for_search(reference: str) -> str:
        """
        Normalize a reference for search operations.
        
        Converts urn:uuid: references to just the ID part for consistent searching.
        
        Args:
            reference: The reference string to normalize for search
            
        Returns:
            Normalized reference string suitable for search
        """
        if not reference:
            return reference
            
        # Handle urn:uuid: references
        if reference.startswith('urn:uuid:'):
            # Extract just the UUID part for search
            return reference[9:]
            
        # Handle ResourceType/id references
        if '/' in reference:
            # For search, we might want just the ID part
            parts = reference.split('/', 1)
            if len(parts) == 2:
                return parts[1]
                
        # Return as-is if no special handling needed
        return reference
    
    @staticmethod
    def extract_resource_type_and_id(reference: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract resource type and ID from a reference.
        
        Args:
            reference: The reference string
            
        Returns:
            Tuple of (resource_type, resource_id) or (None, None) if invalid
        """
        if not reference:
            return None, None
            
        # Handle urn:uuid: references
        if reference.startswith('urn:uuid:'):
            # For urn:uuid references, we don't know the resource type
            # Return None for type, but extract the UUID
            uuid_part = reference[9:]
            return None, uuid_part
            
        # Handle absolute URLs
        if reference.startswith('http://') or reference.startswith('https://'):
            parts = reference.split('/')
            if len(parts) >= 2:
                return parts[-2], parts[-1]
                
        # Handle standard ResourceType/id format
        if '/' in reference:
            parts = reference.split('/', 1)
            if len(parts) == 2:
                return parts[0], parts[1]
                
        return None, None
    
    @staticmethod
    def is_patient_reference(reference: str) -> bool:
        """
        Check if a reference is to a Patient resource.
        
        Args:
            reference: The reference string
            
        Returns:
            True if it's a patient reference
        """
        if not reference:
            return False
            
        # For urn:uuid references, we can't determine the type
        # This is a limitation that needs to be handled elsewhere
        if reference.startswith('urn:uuid:'):
            return False
            
        resource_type, _ = ReferenceUtils.extract_resource_type_and_id(reference)
        return resource_type == 'Patient'
    
    @staticmethod
    def matches_reference(stored_ref: str, search_ref: str) -> bool:
        """
        Check if a stored reference matches a search reference.
        
        Handles different reference formats and partial matches.
        
        Args:
            stored_ref: The reference stored in the database
            search_ref: The reference being searched for
            
        Returns:
            True if they match
        """
        if not stored_ref or not search_ref:
            return False
            
        # Direct match
        if stored_ref == search_ref:
            return True
            
        # Extract IDs from both references
        _, stored_id = ReferenceUtils.extract_resource_type_and_id(stored_ref)
        search_type, search_id = ReferenceUtils.extract_resource_type_and_id(search_ref)
        
        # If we have IDs, compare them
        if stored_id and search_id:
            # Check if the IDs match
            if stored_id == search_id:
                # If search has a type requirement, check it
                if search_type:
                    stored_type, _ = ReferenceUtils.extract_resource_type_and_id(stored_ref)
                    # For urn:uuid refs, we don't know the type
                    if stored_type is None and stored_ref.startswith('urn:uuid:'):
                        # Can't verify type for urn:uuid refs
                        return True
                    return stored_type == search_type
                return True
                
        return False