"""
SMART on FHIR Scope Handler

Parses, validates, and enforces SMART scopes for authorization and access control.
Based on SMART App Launch Implementation Guide v2.1.0

Educational Purpose:
- Demonstrates SMART scope syntax: [context]/[resource].[permission]
- Shows patient compartment enforcement
- Provides scope-to-permission mapping for FHIR access control

Scope Format:
- patient/Observation.read - Read Observations for the in-context patient
- user/Patient.read - Read Patients the user has access to
- launch/patient - Request patient context at launch
- openid fhirUser - OpenID Connect scopes
"""

import re
from typing import List, Dict, Set, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class ScopeContext(str, Enum):
    """SMART scope context types"""
    PATIENT = "patient"  # Patient-specific context
    USER = "user"        # User-level access
    SYSTEM = "system"    # Backend service access


class ScopeAction(str, Enum):
    """SMART scope actions/permissions"""
    READ = "read"
    WRITE = "write"
    ALL = "*"


# FHIR Patient Compartment Resources
# Resources that belong to a patient compartment
# See: https://www.hl7.org/fhir/compartmentdefinition-patient.html
PATIENT_COMPARTMENT_RESOURCES: Set[str] = {
    "Patient",
    "AllergyIntolerance",
    "Appointment",
    "Basic",
    "CarePlan",
    "CareTeam",
    "Claim",
    "ClinicalImpression",
    "Communication",
    "CommunicationRequest",
    "Composition",
    "Condition",
    "Consent",
    "Coverage",
    "DetectedIssue",
    "DeviceRequest",
    "DeviceUseStatement",
    "DiagnosticReport",
    "DocumentManifest",
    "DocumentReference",
    "Encounter",
    "EnrollmentRequest",
    "EpisodeOfCare",
    "ExplanationOfBenefit",
    "FamilyMemberHistory",
    "Flag",
    "Goal",
    "ImagingStudy",
    "Immunization",
    "ImmunizationRecommendation",
    "Invoice",
    "List",
    "MeasureReport",
    "Media",
    "MedicationAdministration",
    "MedicationDispense",
    "MedicationRequest",
    "MedicationStatement",
    "MolecularSequence",
    "NutritionOrder",
    "Observation",
    "Procedure",
    "Provenance",
    "QuestionnaireResponse",
    "RelatedPerson",
    "RequestGroup",
    "RiskAssessment",
    "Schedule",
    "ServiceRequest",
    "Specimen",
    "SupplyDelivery",
    "SupplyRequest",
    "VisionPrescription",
}

# Standard launch scopes
LAUNCH_SCOPES: Set[str] = {
    "launch",           # EHR launch with context
    "launch/patient",   # Request patient context
    "launch/encounter", # Request encounter context
}

# OpenID Connect scopes
OPENID_SCOPES: Set[str] = {
    "openid",       # OpenID Connect
    "profile",      # User profile
    "fhirUser",     # FHIR user resource
    "offline_access",  # Refresh tokens
    "online_access",   # No refresh tokens
}


@dataclass
class ParsedScope:
    """
    Parsed SMART scope with context, resource, and action

    Educational notes:
    - A scope like "patient/Observation.read" becomes:
      - context: patient
      - resource_type: Observation
      - action: read
    - Wildcard scopes like "patient/*.read" have resource_type: *
    """
    original: str
    context: Optional[ScopeContext]
    resource_type: Optional[str]  # None for non-resource scopes
    action: Optional[ScopeAction]  # None for non-resource scopes
    is_launch_scope: bool = False
    is_openid_scope: bool = False
    is_wildcard: bool = False

    def __str__(self) -> str:
        return self.original

    def matches_resource(self, resource_type: str) -> bool:
        """Check if this scope grants access to the given resource type"""
        if self.is_wildcard:
            return True
        return self.resource_type == resource_type

    def allows_action(self, action: str) -> bool:
        """Check if this scope allows the given action (read/write)"""
        if self.action == ScopeAction.ALL:
            return True
        if self.action and self.action.value == action:
            return True
        # write implies read for SMART scopes
        if action == "read" and self.action == ScopeAction.WRITE:
            return True
        return False


@dataclass
class ScopeValidationResult:
    """Result of scope validation"""
    valid: bool
    granted_scopes: List[ParsedScope] = field(default_factory=list)
    rejected_scopes: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class SMARTScopeHandler:
    """
    SMART on FHIR scope parsing and enforcement

    Educational Purpose:
    This handler demonstrates how SMART scopes work in practice:
    1. Parsing scope strings into structured objects
    2. Validating scopes against app registrations
    3. Enforcing patient compartment restrictions
    4. Mapping scopes to FHIR resource access
    """

    # Regex pattern for SMART scopes
    # Format: [context]/[resource].[action]
    # Examples: patient/Observation.read, user/*.write
    SCOPE_PATTERN = re.compile(
        r'^(patient|user|system)/(\*|[A-Z][a-zA-Z]+)\.(read|write|\*)$'
    )

    def __init__(self):
        """Initialize scope handler"""
        self._scope_cache: Dict[str, ParsedScope] = {}

    def parse_scope(self, scope: str) -> ParsedScope:
        """
        Parse a single SMART scope string

        Educational notes:
        - Resource scopes: patient/Observation.read
        - Wildcard scopes: patient/*.read, user/*.*
        - Launch scopes: launch, launch/patient
        - OpenID scopes: openid, fhirUser, profile

        Args:
            scope: The scope string to parse

        Returns:
            ParsedScope object with parsed components
        """
        # Check cache
        if scope in self._scope_cache:
            return self._scope_cache[scope]

        scope = scope.strip()

        # Check for launch scopes
        if scope in LAUNCH_SCOPES:
            parsed = ParsedScope(
                original=scope,
                context=None,
                resource_type=None,
                action=None,
                is_launch_scope=True
            )
            self._scope_cache[scope] = parsed
            return parsed

        # Check for OpenID scopes
        if scope in OPENID_SCOPES:
            parsed = ParsedScope(
                original=scope,
                context=None,
                resource_type=None,
                action=None,
                is_openid_scope=True
            )
            self._scope_cache[scope] = parsed
            return parsed

        # Parse resource scopes
        match = self.SCOPE_PATTERN.match(scope)
        if match:
            context_str, resource, action_str = match.groups()

            parsed = ParsedScope(
                original=scope,
                context=ScopeContext(context_str),
                resource_type=resource if resource != "*" else None,
                action=ScopeAction(action_str) if action_str != "*" else ScopeAction.ALL,
                is_wildcard=(resource == "*" or action_str == "*")
            )

            # Set resource_type even for wildcard (as "*")
            if resource == "*":
                parsed.resource_type = "*"

            self._scope_cache[scope] = parsed
            return parsed

        # Unknown scope format - still return a parsed object
        logger.warning(f"Unknown scope format: {scope}")
        parsed = ParsedScope(
            original=scope,
            context=None,
            resource_type=None,
            action=None
        )
        self._scope_cache[scope] = parsed
        return parsed

    def parse_scopes(self, scope_string: str) -> List[ParsedScope]:
        """
        Parse a space-separated scope string

        Args:
            scope_string: Space-separated scopes (e.g., "launch patient/Patient.read")

        Returns:
            List of ParsedScope objects
        """
        if not scope_string:
            return []

        scopes = scope_string.strip().split()
        return [self.parse_scope(s) for s in scopes]

    def validate_scopes(
        self,
        requested_scopes: str,
        allowed_scopes: List[str]
    ) -> ScopeValidationResult:
        """
        Validate requested scopes against allowed scopes for an app

        Educational notes:
        - Apps can only request scopes they were registered for
        - Wildcard scopes in allowed list grant access to more specific requests
        - Returns both granted and rejected scopes for transparency

        Args:
            requested_scopes: Space-separated requested scopes
            allowed_scopes: List of scopes the app is allowed to request

        Returns:
            ScopeValidationResult with granted/rejected scopes
        """
        result = ScopeValidationResult(valid=True)

        requested = self.parse_scopes(requested_scopes)
        allowed_parsed = [self.parse_scope(s) for s in allowed_scopes]

        for req in requested:
            if self._scope_allowed(req, allowed_parsed):
                result.granted_scopes.append(req)
            else:
                result.rejected_scopes.append(req.original)
                result.errors.append(
                    f"Scope '{req.original}' not allowed for this application"
                )

        if result.rejected_scopes:
            result.valid = False

        return result

    def _scope_allowed(
        self,
        requested: ParsedScope,
        allowed: List[ParsedScope]
    ) -> bool:
        """Check if a requested scope is covered by allowed scopes"""
        for allowed_scope in allowed:
            # Exact match
            if requested.original == allowed_scope.original:
                return True

            # Launch and OpenID scopes must match exactly
            if requested.is_launch_scope or requested.is_openid_scope:
                continue

            # Check if allowed scope covers requested scope
            if self._scope_covers(allowed_scope, requested):
                return True

        return False

    def _scope_covers(self, allowed: ParsedScope, requested: ParsedScope) -> bool:
        """
        Check if an allowed scope covers a requested scope

        Examples:
        - patient/*.read covers patient/Observation.read
        - patient/*.* covers patient/Observation.write
        - patient/Observation.write covers patient/Observation.read
        """
        # Must be same context
        if allowed.context != requested.context:
            return False

        # Check resource coverage
        resource_ok = (
            allowed.is_wildcard or  # Wildcard allows all
            allowed.resource_type == requested.resource_type
        )
        if not resource_ok:
            return False

        # Check action coverage
        action_ok = (
            allowed.action == ScopeAction.ALL or  # *.* allows all
            allowed.action == requested.action or
            # write implies read
            (allowed.action == ScopeAction.WRITE and requested.action == ScopeAction.READ)
        )

        return action_ok

    def check_resource_access(
        self,
        scopes: List[ParsedScope],
        resource_type: str,
        action: str,
        patient_id: Optional[str] = None,
        context_patient_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if scopes allow access to a FHIR resource

        Educational notes:
        - Patient context scopes only allow access to that patient's data
        - User context scopes allow broader access based on user permissions
        - System context is for backend services

        Args:
            scopes: List of granted scopes
            resource_type: FHIR resource type to access
            action: "read" or "write"
            patient_id: Patient ID being accessed (for patient compartment check)
            context_patient_id: Patient ID from token context

        Returns:
            Tuple of (allowed: bool, reason: str if denied)
        """
        # Find applicable scopes for this resource/action
        applicable_scopes = [
            s for s in scopes
            if s.matches_resource(resource_type) and s.allows_action(action)
        ]

        if not applicable_scopes:
            return False, f"No scope grants {action} access to {resource_type}"

        # Check patient compartment for patient-context scopes
        for scope in applicable_scopes:
            if scope.context == ScopeContext.PATIENT:
                # Patient compartment check
                if resource_type in PATIENT_COMPARTMENT_RESOURCES:
                    if patient_id and context_patient_id:
                        if patient_id != context_patient_id:
                            return False, (
                                f"Patient context scope only allows access to "
                                f"patient {context_patient_id}, not {patient_id}"
                            )
                # Patient compartment resource with patient context - allowed
                return True, None

            elif scope.context == ScopeContext.USER:
                # User context - broader access (actual permissions would be
                # enforced by the FHIR server based on user role)
                return True, None

            elif scope.context == ScopeContext.SYSTEM:
                # System context - full access for backend services
                return True, None

        return False, "No applicable scope found"

    def get_allowed_resources(
        self,
        scopes: List[ParsedScope],
        action: str = "read"
    ) -> Set[str]:
        """
        Get list of resource types allowed by the given scopes

        Args:
            scopes: List of granted scopes
            action: "read" or "write"

        Returns:
            Set of resource type names that can be accessed
        """
        allowed = set()

        for scope in scopes:
            if not scope.allows_action(action):
                continue

            if scope.is_wildcard:
                # Wildcard grants access to all patient compartment resources
                if scope.context == ScopeContext.PATIENT:
                    allowed.update(PATIENT_COMPARTMENT_RESOURCES)
                else:
                    # For user/system context, allow all FHIR resources
                    # (In practice, would need a complete list)
                    allowed.add("*")
            elif scope.resource_type:
                allowed.add(scope.resource_type)

        return allowed

    def get_readable_scope_descriptions(
        self,
        scopes: List[ParsedScope]
    ) -> List[Dict[str, str]]:
        """
        Get human-readable descriptions of scopes for consent display

        Educational Purpose:
        Shows users what data access they're granting in clear language

        Returns:
            List of dicts with scope, display name, and description
        """
        from .models import get_scope_info

        descriptions = []
        for scope in scopes:
            info = get_scope_info(scope.original)
            descriptions.append({
                "scope": scope.original,
                "display": info.display,
                "description": info.description,
                "resource_types": info.resource_types,
                "actions": info.actions
            })

        return descriptions

    def filter_search_by_scopes(
        self,
        scopes: List[ParsedScope],
        resource_type: str,
        search_params: Dict[str, str],
        context_patient_id: Optional[str] = None
    ) -> Tuple[Dict[str, str], List[str]]:
        """
        Filter FHIR search parameters based on scopes

        Educational notes:
        - Patient context scopes automatically add patient parameter
        - This enforces patient compartment at search time
        - Returns modified search params and any warnings

        Args:
            scopes: List of granted scopes
            resource_type: FHIR resource type being searched
            search_params: Original search parameters
            context_patient_id: Patient ID from token context

        Returns:
            Tuple of (modified search params, list of warnings)
        """
        warnings = []
        modified_params = dict(search_params)

        # Check if any patient-context scope applies
        has_patient_context = any(
            s.context == ScopeContext.PATIENT and
            s.matches_resource(resource_type) and
            s.allows_action("read")
            for s in scopes
        )

        if has_patient_context and context_patient_id:
            # Enforce patient compartment
            if resource_type == "Patient":
                # For Patient searches, restrict to the context patient
                modified_params["_id"] = context_patient_id
                if "name" in modified_params:
                    warnings.append(
                        "Patient context scope restricts Patient search to context patient"
                    )
            elif resource_type in PATIENT_COMPARTMENT_RESOURCES:
                # For compartment resources, add patient parameter
                existing_patient = modified_params.get("patient")
                if existing_patient and existing_patient != f"Patient/{context_patient_id}":
                    warnings.append(
                        f"Patient context scope restricts search to patient {context_patient_id}"
                    )
                modified_params["patient"] = f"Patient/{context_patient_id}"

        return modified_params, warnings


# Module-level singleton for convenience
scope_handler = SMARTScopeHandler()


def parse_scopes(scope_string: str) -> List[ParsedScope]:
    """Convenience function to parse scopes"""
    return scope_handler.parse_scopes(scope_string)


def validate_scopes(
    requested: str,
    allowed: List[str]
) -> ScopeValidationResult:
    """Convenience function to validate scopes"""
    return scope_handler.validate_scopes(requested, allowed)


def check_resource_access(
    scopes: List[ParsedScope],
    resource_type: str,
    action: str,
    patient_id: Optional[str] = None,
    context_patient_id: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Convenience function to check resource access"""
    return scope_handler.check_resource_access(
        scopes, resource_type, action, patient_id, context_patient_id
    )
