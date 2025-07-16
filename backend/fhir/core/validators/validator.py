"""
FHIR Resource Validator

Validates FHIR resources using the fhir.resources library.
Supports profile validation and custom business rules.
"""

from typing import Dict, List, Optional, Any, Type
from fhir.resources.R4B import FHIRAbstractModel
from fhir.core.resources_r4b import construct_fhir_element, Id
from fhir.core.resources_r4b import OperationOutcome, OperationOutcomeIssue
from pydantic import ValidationError
import json


class FHIRValidator:
    """Validates FHIR resources for structure and business rules."""
    
    def __init__(self, profile_registry: Optional[Dict[str, Any]] = None):
        """
        Initialize validator with optional profile registry.
        
        Args:
            profile_registry: Registry of custom profiles for validation
        """
        self.profile_registry = profile_registry or {}
        
    def validate_resource(
        self,
        resource_type: str,
        resource_data: Dict[str, Any],
        profile_url: Optional[str] = None
    ) -> OperationOutcome:
        """
        Validate a FHIR resource.
        
        Args:
            resource_type: FHIR resource type
            resource_data: Resource data as dictionary
            profile_url: Optional profile URL for validation
            
        Returns:
            OperationOutcome with validation results
        """
        issues = []
        
        # Structural validation using fhir.resources
        structural_issues = self._validate_structure(resource_type, resource_data)
        issues.extend(structural_issues)
        
        # Profile validation if specified
        if profile_url and profile_url in self.profile_registry:
            profile_issues = self._validate_against_profile(
                resource_type, resource_data, profile_url
            )
            issues.extend(profile_issues)
        
        # Business rule validation
        business_issues = self._validate_business_rules(resource_type, resource_data)
        issues.extend(business_issues)
        
        # Create operation outcome
        if issues:
            return OperationOutcome(
                issue=issues
            )
        else:
            # Success
            return OperationOutcome(
                issue=[
                    OperationOutcomeIssue(
                        severity="information",
                        code="informational",
                        details={"text": "Validation successful"}
                    )
                ]
            )
    
    def _validate_structure(
        self,
        resource_type: str,
        resource_data: Dict[str, Any]
    ) -> List[OperationOutcomeIssue]:
        """Validate resource structure using fhir.resources."""
        issues = []
        
        try:
            # Attempt to construct the FHIR resource
            fhir_resource = construct_fhir_element(resource_type, resource_data)
            
            # Additional structural checks
            if resource_type == "Bundle":
                # Validate bundle entries
                if hasattr(fhir_resource, 'entry'):
                    for i, entry in enumerate(fhir_resource.entry or []):
                        if entry.resource:
                            # Recursively validate contained resources
                            entry_type = entry.resource.resource_type
                            entry_issues = self._validate_structure(
                                entry_type,
                                json.loads(entry.resource.json())
                            )
                            for issue in entry_issues:
                                # Update expression to include entry path
                                if issue.expression:
                                    issue.expression = [
                                        f"Bundle.entry[{i}].resource.{expr}"
                                        for expr in issue.expression
                                    ]
                                else:
                                    issue.expression = [f"Bundle.entry[{i}].resource"]
                            issues.extend(entry_issues)
                            
        except ValidationError as e:
            # Convert Pydantic validation errors to OperationOutcomeIssues
            for error in e.errors():
                issue = OperationOutcomeIssue(
                    severity="error",
                    code="structure",
                    details={"text": error['msg']},
                    expression=['.'.join(str(loc) for loc in error['loc'])]
                )
                issues.append(issue)
                
        except Exception as e:
            # General construction error
            issues.append(
                OperationOutcomeIssue(
                    severity="error",
                    code="structure",
                    details={"text": f"Failed to construct {resource_type}: {str(e)}"}
                )
            )
        
        return issues
    
    def _validate_against_profile(
        self,
        resource_type: str,
        resource_data: Dict[str, Any],
        profile_url: str
    ) -> List[OperationOutcomeIssue]:
        """Validate resource against a specific profile."""
        issues = []
        
        profile = self.profile_registry.get(profile_url)
        if not profile:
            issues.append(
                OperationOutcomeIssue(
                    severity="warning",
                    code="not-supported",
                    details={"text": f"Profile {profile_url} not found in registry"}
                )
            )
            return issues
        
        # Profile validation logic would go here
        # This is a placeholder for actual profile validation
        
        return issues
    
    def _validate_business_rules(
        self,
        resource_type: str,
        resource_data: Dict[str, Any]
    ) -> List[OperationOutcomeIssue]:
        """Apply business rule validation based on resource type."""
        issues = []
        
        # Resource-specific business rules
        if resource_type == "Patient":
            issues.extend(self._validate_patient_rules(resource_data))
        elif resource_type == "Observation":
            issues.extend(self._validate_observation_rules(resource_data))
        elif resource_type == "MedicationRequest":
            issues.extend(self._validate_medication_request_rules(resource_data))
        elif resource_type == "Encounter":
            issues.extend(self._validate_encounter_rules(resource_data))
        elif resource_type == "Condition":
            issues.extend(self._validate_condition_rules(resource_data))
        
        # Common rules for all resources
        issues.extend(self._validate_common_rules(resource_type, resource_data))
        
        return issues
    
    def _validate_patient_rules(self, resource_data: Dict[str, Any]) -> List[OperationOutcomeIssue]:
        """Validate Patient-specific business rules."""
        issues = []
        
        # Example: At least one identifier required
        if not resource_data.get('identifier'):
            issues.append(
                OperationOutcomeIssue(
                    severity="error",
                    code="business-rule",
                    details={"text": "Patient must have at least one identifier"},
                    expression=["Patient.identifier"]
                )
            )
        
        # Example: Birth date should not be in the future
        if resource_data.get('birthDate'):
            from datetime import date, datetime
            birth_date_str = resource_data['birthDate']
            try:
                birth_date = datetime.strptime(birth_date_str, '%Y-%m-%d').date()
                if birth_date > date.today():
                    issues.append(
                        OperationOutcomeIssue(
                            severity="error",
                            code="business-rule",
                            details={"text": "Birth date cannot be in the future"},
                            expression=["Patient.birthDate"]
                        )
                    )
            except ValueError:
                pass  # Structural validation will catch format errors
        
        # Example: Deceased patients should have deceasedDateTime or deceasedBoolean
        if resource_data.get('deceasedBoolean') is True:
            if not resource_data.get('deceasedDateTime'):
                issues.append(
                    OperationOutcomeIssue(
                        severity="warning",
                        code="business-rule",
                        details={"text": "Deceased patients should have a deceased date/time"},
                        expression=["Patient.deceasedDateTime"]
                    )
                )
        
        return issues
    
    def _validate_observation_rules(self, resource_data: Dict[str, Any]) -> List[OperationOutcomeIssue]:
        """Validate Observation-specific business rules."""
        issues = []
        
        # Example: Status and code are essential
        if resource_data.get('status') == 'final' and not resource_data.get('value'):
            issues.append(
                OperationOutcomeIssue(
                    severity="warning",
                    code="business-rule",
                    details={"text": "Final observations should have a value"},
                    expression=["Observation.value[x]"]
                )
            )
        
        # Example: Reference ranges should be logical
        if resource_data.get('referenceRange'):
            for i, ref_range in enumerate(resource_data['referenceRange']):
                low = ref_range.get('low', {}).get('value')
                high = ref_range.get('high', {}).get('value')
                
                if low is not None and high is not None and low > high:
                    issues.append(
                        OperationOutcomeIssue(
                            severity="error",
                            code="business-rule",
                            details={"text": "Reference range low value cannot be greater than high value"},
                            expression=[f"Observation.referenceRange[{i}]"]
                        )
                    )
        
        return issues
    
    def _validate_medication_request_rules(self, resource_data: Dict[str, Any]) -> List[OperationOutcomeIssue]:
        """Validate MedicationRequest-specific business rules."""
        issues = []
        
        # Example: Active requests should have dosage instructions
        if resource_data.get('status') == 'active' and not resource_data.get('dosageInstruction'):
            issues.append(
                OperationOutcomeIssue(
                    severity="warning",
                    code="business-rule",
                    details={"text": "Active medication requests should have dosage instructions"},
                    expression=["MedicationRequest.dosageInstruction"]
                )
            )
        
        # Example: Check for required authoredOn date
        if resource_data.get('status') in ['active', 'completed'] and not resource_data.get('authoredOn'):
            issues.append(
                OperationOutcomeIssue(
                    severity="warning",
                    code="business-rule",
                    details={"text": "Medication requests should have an authored date"},
                    expression=["MedicationRequest.authoredOn"]
                )
            )
        
        return issues
    
    def _validate_encounter_rules(self, resource_data: Dict[str, Any]) -> List[OperationOutcomeIssue]:
        """Validate Encounter-specific business rules."""
        issues = []
        
        # Example: Finished encounters should have an end period
        if resource_data.get('status') == 'finished':
            period = resource_data.get('period', {})
            if not period.get('end'):
                issues.append(
                    OperationOutcomeIssue(
                        severity="warning",
                        code="business-rule",
                        details={"text": "Finished encounters should have an end date"},
                        expression=["Encounter.period.end"]
                    )
                )
        
        # Example: In-progress encounters should not have an end date
        if resource_data.get('status') == 'in-progress':
            period = resource_data.get('period', {})
            if period.get('end'):
                issues.append(
                    OperationOutcomeIssue(
                        severity="error",
                        code="business-rule",
                        details={"text": "In-progress encounters should not have an end date"},
                        expression=["Encounter.period.end"]
                    )
                )
        
        return issues
    
    def _validate_condition_rules(self, resource_data: Dict[str, Any]) -> List[OperationOutcomeIssue]:
        """Validate Condition-specific business rules."""
        issues = []
        
        # Example: Active conditions should not have abatement
        if resource_data.get('clinicalStatus', {}).get('coding', [{}])[0].get('code') == 'active':
            if any(key.startswith('abatement') for key in resource_data):
                issues.append(
                    OperationOutcomeIssue(
                        severity="warning",
                        code="business-rule",
                        details={"text": "Active conditions should not have abatement information"},
                        expression=["Condition.abatement[x]"]
                    )
                )
        
        # Example: Resolved conditions should have abatement
        if resource_data.get('clinicalStatus', {}).get('coding', [{}])[0].get('code') == 'resolved':
            if not any(key.startswith('abatement') for key in resource_data):
                issues.append(
                    OperationOutcomeIssue(
                        severity="warning",
                        code="business-rule",
                        details={"text": "Resolved conditions should have abatement information"},
                        expression=["Condition.abatement[x]"]
                    )
                )
        
        return issues
    
    def _validate_common_rules(
        self,
        resource_type: str,
        resource_data: Dict[str, Any]
    ) -> List[OperationOutcomeIssue]:
        """Validate common business rules for all resources."""
        issues = []
        
        # Example: Check for required meta.profile if configured
        if self.profile_registry and not resource_data.get('meta', {}).get('profile'):
            issues.append(
                OperationOutcomeIssue(
                    severity="information",
                    code="business-rule",
                    details={"text": "Resources should declare their profile"},
                    expression=[f"{resource_type}.meta.profile"]
                )
            )
        
        # Example: Validate reference integrity
        references = self._extract_references(resource_data)
        for ref_path, ref_value in references:
            if not self._is_valid_reference(ref_value):
                issues.append(
                    OperationOutcomeIssue(
                        severity="error",
                        code="business-rule",
                        details={"text": f"Invalid reference format: {ref_value}"},
                        expression=[ref_path]
                    )
                )
        
        return issues
    
    def _extract_references(
        self,
        data: Dict[str, Any],
        path: str = ""
    ) -> List[tuple[str, str]]:
        """Extract all references from a resource."""
        references = []
        
        for key, value in data.items():
            current_path = f"{path}.{key}" if path else key
            
            if key == 'reference' and isinstance(value, str):
                references.append((path, value))
            elif isinstance(value, dict):
                references.extend(self._extract_references(value, current_path))
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        references.extend(
                            self._extract_references(item, f"{current_path}[{i}]")
                        )
        
        return references
    
    def _is_valid_reference(self, reference: str) -> bool:
        """Check if a reference has valid format."""
        if not reference:
            return False
        
        # Internal reference format: ResourceType/id
        if '/' in reference:
            parts = reference.split('/')
            if len(parts) == 2 and parts[0] and parts[1]:
                return True
        
        # Contained reference format: #id
        if reference.startswith('#'):
            return len(reference) > 1
        
        # External reference (URL)
        if reference.startswith(('http://', 'https://')):
            return True
        
        return False