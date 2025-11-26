"""
CDS Hooks Constants

Centralized FHIR extension URLs and other constants for CDS Hooks implementation.
Standardizes on http://wintehr.local/fhir/StructureDefinition/ for development.

Educational Notes:
    - FHIR extensions allow custom data to be attached to resources
    - Extension URLs should be unique and resolvable (though not required)
    - WintEHR uses a local domain for educational/development purposes
"""


class ExtensionURLs:
    """
    Centralized FHIR extension URLs for CDS Hooks.

    Usage:
        from api.cds_hooks.constants import ExtensionURLs

        extension = {
            "url": ExtensionURLs.SERVICE_ORIGIN,
            "valueString": "built-in"
        }

    Educational Notes:
        - All extensions use consistent base URL
        - Extensions are grouped by functional area
        - Names follow FHIR naming conventions (kebab-case)
    """

    # Base URL for all WintEHR FHIR extensions
    BASE_URL = "http://wintehr.local/fhir/StructureDefinition"

    # CDS Hooks Service Extensions
    SERVICE_ORIGIN = f"{BASE_URL}/service-origin"
    SERVICE_ID = f"{BASE_URL}/cds-hooks-service-id"
    HOOK_TYPE = f"{BASE_URL}/hook-type"
    HOOK_SERVICE_ID = f"{BASE_URL}/hook-service-id"
    EXTERNAL_SERVICE_ID = f"{BASE_URL}/external-service-id"
    PREFETCH_TEMPLATE = f"{BASE_URL}/prefetch-template"
    PYTHON_CLASS = f"{BASE_URL}/python-class"
    CDS_HOOKS_VERSION = f"{BASE_URL}/cds-hooks-version"
    CDS_SYSTEM_ACTION = f"{BASE_URL}/cds-system-action"
    EXTERNAL_SERVICE = f"{BASE_URL}/external-service"

    # Pharmacy Extensions
    PHARMACY_STATUS = f"{BASE_URL}/pharmacy-status"

    # Code Systems
    CDS_SERVICES_SYSTEM = "http://wintehr.local/cds-services"
    AUDIT_EVENT_SUBTYPE_SYSTEM = "http://wintehr.local/fhir/audit-event-subtype"
    COMMUNICATION_CATEGORY_SYSTEM = "http://wintehr.local/fhir/communication-category"
    ALERT_TYPE_SYSTEM = "http://wintehr.local/fhir/alert-type"
    TASK_TYPE_SYSTEM = "http://wintehr.local/fhir/task-type"


class PlanDefinitionURLs:
    """
    URLs for PlanDefinition resources.

    Usage:
        from api.cds_hooks.constants import PlanDefinitionURLs

        url = PlanDefinitionURLs.get_service_url("diabetes-screening")
    """

    BASE_URL = "http://wintehr.local/PlanDefinition"

    @classmethod
    def get_service_url(cls, service_id: str) -> str:
        """Get the canonical URL for a CDS service PlanDefinition."""
        return f"{cls.BASE_URL}/{service_id}"


# Convenience aliases for common use cases
EXTENSION_BASE = ExtensionURLs.BASE_URL
