"""
FHIR Converter Helper Functions
"""

from typing import Dict, Any, List, Optional


def create_reference(resource_type: str, resource_id: str, display: str = None) -> Dict[str, Any]:
    """Create a properly formatted FHIR reference"""
    reference = {
        "reference": f"{resource_type}/{resource_id}"
    }
    if display:
        reference["display"] = display
    return reference


def create_codeable_concept(
    system: str = None, 
    code: str = None, 
    display: str = None, 
    text: str = None,
    additional_codings: List[Dict[str, str]] = None
) -> Dict[str, Any]:
    """Create a properly formatted FHIR CodeableConcept"""
    concept = {"coding": []}
    
    if system and code:
        coding = {"system": system, "code": code}
        if display:
            coding["display"] = display
        concept["coding"].append(coding)
    
    if additional_codings:
        concept["coding"].extend(additional_codings)
    
    if text:
        concept["text"] = text
    elif display and not text:
        concept["text"] = display
    
    return concept


def create_identifier(system: str, value: str, use: str = None, type_dict: Dict[str, Any] = None) -> Dict[str, Any]:
    """Create a properly formatted FHIR Identifier"""
    identifier = {
        "system": system,
        "value": value
    }
    if use:
        identifier["use"] = use
    if type_dict:
        identifier["type"] = type_dict
    return identifier