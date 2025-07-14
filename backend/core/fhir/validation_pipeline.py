"""
Pluggable FHIR Validation Pipeline
Extensible validation framework for FHIR resources with multiple validation stages
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime
import logging

class ValidationSeverity(Enum):
    """Validation severity levels following FHIR OperationOutcome"""
    FATAL = "fatal"
    ERROR = "error"
    WARNING = "warning"
    INFORMATION = "information"

class ValidationType(Enum):
    """Types of validation rules"""
    STRUCTURAL = "structural"      # FHIR structure compliance
    BUSINESS = "business"          # Business logic rules
    PROFILE = "profile"           # Profile compliance
    TERMINOLOGY = "terminology"   # Code system validation
    REFERENCE = "reference"       # Reference resolution
    CUSTOM = "custom"             # Custom validation rules

@dataclass
class ValidationIssue:
    """Individual validation issue"""
    severity: ValidationSeverity
    code: str
    details: str
    location: Optional[str] = None
    validation_type: ValidationType = ValidationType.STRUCTURAL
    source: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)

@dataclass
class ValidationResult:
    """Result of validation operation"""
    success: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    validation_timestamp: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def has_errors(self) -> bool:
        """Check if result has fatal or error level issues"""
        return any(issue.severity in [ValidationSeverity.FATAL, ValidationSeverity.ERROR] 
                  for issue in self.issues)
    
    @property
    def has_warnings(self) -> bool:
        """Check if result has warning level issues"""
        return any(issue.severity == ValidationSeverity.WARNING for issue in self.issues)
    
    def add_issue(self, severity: ValidationSeverity, code: str, details: str, 
                  location: str = None, validation_type: ValidationType = ValidationType.STRUCTURAL):
        """Add validation issue"""
        self.issues.append(ValidationIssue(
            severity=severity,
            code=code,
            details=details,
            location=location,
            validation_type=validation_type
        ))
        
        # Update success status
        if severity in [ValidationSeverity.FATAL, ValidationSeverity.ERROR]:
            self.success = False
    
    @classmethod
    def combine(cls, results: List['ValidationResult']) -> 'ValidationResult':
        """Combine multiple validation results"""
        combined = cls(success=True)
        
        for result in results:
            combined.issues.extend(result.issues)
            if not result.success:
                combined.success = False
        
        return combined

class BaseValidator(ABC):
    """Abstract base class for all validators"""
    
    def __init__(self, name: str, enabled: bool = True, continue_on_error: bool = True):
        self.name = name
        self.enabled = enabled
        self.continue_on_error = continue_on_error
        self.logger = logging.getLogger(f"validator.{name}")
    
    @abstractmethod
    async def validate(self, resource: Dict[str, Any], context: Dict[str, Any] = None) -> ValidationResult:
        """Validate resource and return result"""
        pass
    
    def is_applicable(self, resource: Dict[str, Any]) -> bool:
        """Check if validator applies to given resource"""
        return True

class StructuralValidator(BaseValidator):
    """Validates FHIR resource structure"""
    
    def __init__(self):
        super().__init__("structural")
    
    async def validate(self, resource: Dict[str, Any], context: Dict[str, Any] = None) -> ValidationResult:
        result = ValidationResult(success=True)
        resource_type = resource.get('resourceType')
        
        if not resource_type:
            result.add_issue(
                ValidationSeverity.ERROR,
                "structure",
                "Missing required field: resourceType",
                location="resourceType"
            )
            return result
        
        result.resource_type = resource_type
        result.resource_id = resource.get('id')
        
        # Validate required fields based on resource type
        required_fields = self._get_required_fields(resource_type)
        for field in required_fields:
            if field not in resource or resource[field] is None:
                result.add_issue(
                    ValidationSeverity.ERROR,
                    "required",
                    f"Missing required field: {field}",
                    location=field
                )
        
        # Validate resource ID format if present
        if 'id' in resource and not self._is_valid_id(resource['id']):
            result.add_issue(
                ValidationSeverity.ERROR,
                "invalid-id",
                f"Invalid resource ID format: {resource['id']}",
                location="id"
            )
        
        return result
    
    def _get_required_fields(self, resource_type: str) -> List[str]:
        """Get required fields for resource type"""
        # This would be loaded from FHIR specification
        required_by_type = {
            'Patient': [],  # Patient has no required fields in FHIR R4
            'Condition': ['subject', 'code'],  # R4 requirements
            'Observation': ['status', 'code', 'subject'],
            'AllergyIntolerance': ['patient', 'code'],
            'MedicationRequest': ['status', 'intent', 'medication', 'subject'],
            'DiagnosticReport': ['status', 'code', 'subject']
        }
        return required_by_type.get(resource_type, [])
    
    def _is_valid_id(self, resource_id: str) -> bool:
        """Validate FHIR resource ID format"""
        import re
        # FHIR ID pattern: [A-Za-z0-9\-\.]{1,64}
        pattern = r'^[A-Za-z0-9\-\.]{1,64}$'
        return bool(re.match(pattern, resource_id))

class BusinessRuleValidator(BaseValidator):
    """Validates business logic rules"""
    
    def __init__(self):
        super().__init__("business_rules")
    
    async def validate(self, resource: Dict[str, Any], context: Dict[str, Any] = None) -> ValidationResult:
        result = ValidationResult(success=True)
        resource_type = resource.get('resourceType')
        
        # Apply resource-specific business rules
        if resource_type == 'Condition':
            await self._validate_condition_rules(resource, result)
        elif resource_type == 'Observation':
            await self._validate_observation_rules(resource, result)
        elif resource_type == 'AllergyIntolerance':
            await self._validate_allergy_rules(resource, result)
        
        return result
    
    async def _validate_condition_rules(self, resource: Dict[str, Any], result: ValidationResult):
        """Validate Condition-specific business rules"""
        # R5 requires clinicalStatus
        if 'clinicalStatus' not in resource:
            result.add_issue(
                ValidationSeverity.WARNING,
                "missing-clinical-status",
                "Clinical status should be specified for conditions",
                location="clinicalStatus",
                validation_type=ValidationType.BUSINESS
            )
        
        # Validate onset vs abatement dates
        onset_date = resource.get('onsetDateTime')
        abatement_date = resource.get('abatementDateTime')
        
        if onset_date and abatement_date:
            try:
                onset = datetime.fromisoformat(onset_date.replace('Z', '+00:00'))
                abatement = datetime.fromisoformat(abatement_date.replace('Z', '+00:00'))
                
                if abatement <= onset:
                    result.add_issue(
                        ValidationSeverity.ERROR,
                        "invalid-date-sequence",
                        "Abatement date must be after onset date",
                        location="abatementDateTime",
                        validation_type=ValidationType.BUSINESS
                    )
            except ValueError:
                # Date parsing error - will be caught by structural validation
                pass
    
    async def _validate_observation_rules(self, resource: Dict[str, Any], result: ValidationResult):
        """Validate Observation-specific business rules"""
        # Validate value vs status consistency
        status = resource.get('status')
        has_value = any(key.startswith('value') for key in resource.keys())
        
        if status == 'final' and not has_value:
            result.add_issue(
                ValidationSeverity.WARNING,
                "final-without-value",
                "Final observations should have a value",
                location="value[x]",
                validation_type=ValidationType.BUSINESS
            )
    
    async def _validate_allergy_rules(self, resource: Dict[str, Any], result: ValidationResult):
        """Validate AllergyIntolerance-specific business rules"""
        # Validate reaction manifestation format (R4 vs R5)
        reactions = resource.get('reaction', [])
        for i, reaction in enumerate(reactions):
            manifestation = reaction.get('manifestation', [])
            if manifestation:
                # Check if using R5 format in R4 context
                if isinstance(manifestation[0], dict) and 'concept' in manifestation[0]:
                    result.add_issue(
                        ValidationSeverity.WARNING,
                        "version-mismatch",
                        "Manifestation format appears to be R5 but context is R4",
                        location=f"reaction[{i}].manifestation",
                        validation_type=ValidationType.BUSINESS
                    )

class ProfileValidator(BaseValidator):
    """Validates FHIR profile compliance"""
    
    def __init__(self):
        super().__init__("profile")
        self.loaded_profiles = {}
    
    async def validate(self, resource: Dict[str, Any], context: Dict[str, Any] = None) -> ValidationResult:
        result = ValidationResult(success=True)
        
        # Get profile URLs from meta.profile
        profiles = resource.get('meta', {}).get('profile', [])
        
        for profile_url in profiles:
            profile_result = await self._validate_against_profile(resource, profile_url)
            result = ValidationResult.combine([result, profile_result])
        
        return result
    
    async def _validate_against_profile(self, resource: Dict[str, Any], profile_url: str) -> ValidationResult:
        """Validate resource against specific profile"""
        result = ValidationResult(success=True)
        
        # This would load and validate against actual profile definitions
        # For now, just placeholder validation
        result.add_issue(
            ValidationSeverity.INFORMATION,
            "profile-validation",
            f"Profile validation against {profile_url} not yet implemented",
            validation_type=ValidationType.PROFILE
        )
        
        return result

class ValidationPipeline:
    """Main validation pipeline that orchestrates all validators"""
    
    def __init__(self):
        self.validators: List[BaseValidator] = []
        self.logger = logging.getLogger("validation_pipeline")
    
    def add_validator(self, validator: BaseValidator):
        """Add validator to pipeline"""
        self.validators.append(validator)
        self.logger.info(f"Added validator: {validator.name}")
    
    def remove_validator(self, validator_name: str):
        """Remove validator by name"""
        self.validators = [v for v in self.validators if v.name != validator_name]
        self.logger.info(f"Removed validator: {validator_name}")
    
    async def validate(self, resource: Dict[str, Any], context: Dict[str, Any] = None) -> ValidationResult:
        """Run all validators in pipeline"""
        results = []
        
        for validator in self.validators:
            if not validator.enabled or not validator.is_applicable(resource):
                continue
            
            try:
                self.logger.debug(f"Running validator: {validator.name}")
                result = await validator.validate(resource, context)
                results.append(result)
                
                # Stop if fatal error and validator doesn't continue on error
                if result.has_errors and not validator.continue_on_error:
                    self.logger.warning(f"Stopping pipeline due to errors in {validator.name}")
                    break
                    
            except Exception as e:
                self.logger.error(f"Validator {validator.name} failed: {e}")
                error_result = ValidationResult(success=False)
                error_result.add_issue(
                    ValidationSeverity.FATAL,
                    "validator-error",
                    f"Validator {validator.name} encountered an error: {str(e)}",
                    validation_type=ValidationType.CUSTOM
                )
                results.append(error_result)
                
                if not validator.continue_on_error:
                    break
        
        return ValidationResult.combine(results)

# Default pipeline factory
def create_default_pipeline() -> ValidationPipeline:
    """Create default validation pipeline with standard validators"""
    pipeline = ValidationPipeline()
    
    # Add validators in order of execution
    pipeline.add_validator(StructuralValidator())
    pipeline.add_validator(BusinessRuleValidator())
    pipeline.add_validator(ProfileValidator())
    
    return pipeline