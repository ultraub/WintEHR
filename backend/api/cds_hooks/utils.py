"""
CDS Hooks Utility Functions

Shared helper functions for CDS Hooks implementation.

Educational Focus:
- FHIR extension extraction patterns
- Reusable utility functions for CDS operations
- Clean separation of concerns
"""

from typing import Any, Dict, List, Optional


def extract_extension_value(
    resource: Dict[str, Any],
    url: str,
    default: Any = None
) -> Any:
    """
    Extract value from a FHIR extension.

    FHIR extensions can contain values of different types (valueString, valueBoolean,
    valueCode, valueInteger, etc.). This function extracts the value regardless of type.

    Args:
        resource: FHIR resource with extensions array
        url: Extension URL to find
        default: Default value if extension not found

    Returns:
        Extension value or default

    Educational Notes:
        - Extensions in FHIR follow the pattern: {"url": "...", "value[x]": ...}
        - The value field name depends on the data type (valueString, valueInteger, etc.)
        - This handles the most common value types automatically

    Example:
        >>> resource = {"extension": [
        ...     {"url": "http://example.com/ext", "valueString": "hello"}
        ... ]}
        >>> extract_extension_value(resource, "http://example.com/ext")
        'hello'
    """
    extensions = resource.get("extension", [])
    for ext in extensions:
        if ext.get("url") == url:
            # Try different value types in order of likelihood
            return (
                ext.get("valueString") or
                ext.get("valueBoolean") or
                ext.get("valueCode") or
                ext.get("valueInteger") or
                ext.get("valueDecimal") or
                ext.get("valueUri") or
                ext.get("valueUrl") or
                ext.get("valueReference") or
                ext.get("valueCoding") or
                ext.get("valueCodeableConcept") or
                default
            )
    return default


def get_all_extension_values(
    resource: Dict[str, Any],
    url: str
) -> List[Any]:
    """
    Extract all values from FHIR extensions with the given URL.

    Unlike extract_extension_value which returns the first match,
    this returns all matching extension values (useful for repeating extensions).

    Args:
        resource: FHIR resource with extensions array
        url: Extension URL to find

    Returns:
        List of extension values (empty list if none found)

    Example:
        >>> resource = {"extension": [
        ...     {"url": "http://example.com/tag", "valueString": "tag1"},
        ...     {"url": "http://example.com/tag", "valueString": "tag2"}
        ... ]}
        >>> get_all_extension_values(resource, "http://example.com/tag")
        ['tag1', 'tag2']
    """
    values = []
    extensions = resource.get("extension", [])
    for ext in extensions:
        if ext.get("url") == url:
            value = (
                ext.get("valueString") or
                ext.get("valueBoolean") or
                ext.get("valueCode") or
                ext.get("valueInteger") or
                ext.get("valueDecimal") or
                ext.get("valueUri") or
                ext.get("valueUrl") or
                ext.get("valueReference") or
                ext.get("valueCoding") or
                ext.get("valueCodeableConcept")
            )
            if value is not None:
                values.append(value)
    return values


def has_extension(resource: Dict[str, Any], url: str) -> bool:
    """
    Check if a FHIR resource has an extension with the given URL.

    Args:
        resource: FHIR resource with extensions array
        url: Extension URL to check

    Returns:
        True if extension exists, False otherwise
    """
    extensions = resource.get("extension", [])
    return any(ext.get("url") == url for ext in extensions)


def build_extension(
    url: str,
    value: Any,
    value_type: str = "valueString"
) -> Dict[str, Any]:
    """
    Build a FHIR extension dictionary.

    Args:
        url: Extension URL
        value: Extension value
        value_type: FHIR value type (valueString, valueBoolean, etc.)

    Returns:
        Extension dictionary ready for inclusion in a resource

    Example:
        >>> build_extension("http://example.com/ext", "hello")
        {'url': 'http://example.com/ext', 'valueString': 'hello'}
    """
    return {
        "url": url,
        value_type: value
    }
