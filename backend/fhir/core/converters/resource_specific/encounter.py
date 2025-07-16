"""
FHIR Encounter Resource Converter
Handles conversion and validation of Encounter resources
"""

from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

def convert_encounter(encounter_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert Encounter resource to ensure compatibility with FHIR R4B library
    
    The main issue is that the 'class' field in R4B Encounter expects a Coding object,
    but the frontend sends a CodeableConcept structure.
    """
    if encounter_dict.get('resourceType') != 'Encounter':
        return encounter_dict
    
    result = encounter_dict.copy()
    
    # Convert class field from CodeableConcept to Coding
    if 'class' in result:
        class_field = result['class']
        
        # If it's already a Coding object, leave it as is
        if isinstance(class_field, dict) and 'coding' in class_field:
            # Extract the first coding from the CodeableConcept
            coding_array = class_field.get('coding', [])
            if coding_array and len(coding_array) > 0:
                # Use the first coding as the class value
                result['class'] = coding_array[0]
            else:
                # If no coding found, remove the class field
                del result['class']
        elif isinstance(class_field, list) and len(class_field) > 0:
            # If it's already an array of CodeableConcepts, extract the first coding
            first_class = class_field[0]
            if isinstance(first_class, dict) and 'coding' in first_class:
                coding_array = first_class.get('coding', [])
                if coding_array and len(coding_array) > 0:
                    result['class'] = coding_array[0]
                else:
                    del result['class']
    
    # Ensure period dates are properly formatted
    if 'period' in result and isinstance(result['period'], dict):
        period = result['period']
        for date_field in ['start', 'end']:
            if date_field in period and isinstance(period[date_field], str):
                # Ensure ISO format
                if not period[date_field].endswith('Z') and '+' not in period[date_field]:
                    if 'T' in period[date_field]:
                        period[date_field] = period[date_field] + 'Z'
    
    # Ensure reasonCode is properly structured
    if 'reasonCode' in result and isinstance(result['reasonCode'], list):
        for i, reason in enumerate(result['reasonCode']):
            if isinstance(reason, dict) and 'coding' in reason:
                # Ensure coding is a list
                if not isinstance(reason['coding'], list):
                    reason['coding'] = [reason['coding']]
    
    logger.debug(f"Converted Encounter class field: {result.get('class')}")
    return result

def validate_encounter(encounter_dict: Dict[str, Any]) -> Optional[str]:
    """
    Validate Encounter resource structure
    Returns error message if validation fails, None if valid
    """
    if encounter_dict.get('resourceType') != 'Encounter':
        return "Invalid resource type"
    
    # Check required fields
    required_fields = ['status', 'subject']
    for field in required_fields:
        if field not in encounter_dict:
            return f"Missing required field: {field}"
    
    # Validate status
    valid_statuses = [
        'planned', 'arrived', 'triaged', 'in-progress', 
        'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'
    ]
    status = encounter_dict.get('status')
    if status not in valid_statuses:
        return f"Invalid status: {status}"
    
    # Validate subject reference
    subject = encounter_dict.get('subject')
    if not isinstance(subject, dict) or 'reference' not in subject:
        return "Invalid subject reference"
    
    # Validate class field if present
    if 'class' in encounter_dict:
        class_field = encounter_dict['class']
        if isinstance(class_field, dict):
            # Should be a Coding object
            if 'system' not in class_field and 'code' not in class_field:
                return "Invalid class field: must have system and code"
        else:
            return "Invalid class field: must be a Coding object"
    
    return None