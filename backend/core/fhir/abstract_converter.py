"""
AbstractFHIRConverter - Base class for all FHIR resource converters
Provides common functionality for FHIR resource creation, validation, and version compatibility
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Union, Type
from datetime import datetime
from enum import Enum
import logging
import json

from .validation_pipeline import ValidationPipeline, ValidationResult, create_default_pipeline

class FHIRVersion(Enum):
    R4 = "R4"
    R5 = "R5"
    R6 = "R6"

class ConversionDirection(Enum):
    TO_FHIR = "to_fhir"
    FROM_FHIR = "from_fhir"

class ConversionContext:
    """Context information for FHIR conversions"""
    
    def __init__(self,
                 patient_id: str = None,
                 patient_reference: Dict = None,
                 encounter_id: str = None,
                 encounter_reference: Dict = None,
                 practitioner_id: str = None,
                 practitioner_reference: Dict = None,
                 organization_id: str = None,
                 organization_reference: Dict = None,
                 effective_date: datetime = None,
                 recorded_date: datetime = None,
                 include_contained: bool = False,
                 resolve_references: bool = True,
                 validate_references: bool = True,
                 custom_data: Dict[str, Any] = None):
        
        self.patient_id = patient_id
        self.patient_reference = patient_reference
        self.encounter_id = encounter_id
        self.encounter_reference = encounter_reference
        self.practitioner_id = practitioner_id
        self.practitioner_reference = practitioner_reference
        self.organization_id = organization_id
        self.organization_reference = organization_reference
        self.effective_date = effective_date
        self.recorded_date = recorded_date
        self.include_contained = include_contained
        self.resolve_references = resolve_references
        self.validate_references = validate_references
        self.custom_data = custom_data or {}

class ConversionResult:
    """Result of a FHIR conversion operation"""
    
    def __init__(self, success: bool, data: Dict = None, errors: List[str] = None, 
                 warnings: List[str] = None, context: str = None, metadata: Dict[str, Any] = None):
        self.success = success
        self.data = data
        self.errors = errors or []
        self.warnings = warnings or []
        self.context = context
        self.metadata = metadata or {}
        self.validation_result: Optional[ValidationResult] = None
    
    @classmethod
    def success_result(cls, data: Dict, warnings: List[str] = None) -> 'ConversionResult':
        """Create successful conversion result"""
        return cls(success=True, data=data, warnings=warnings or [])
    
    @classmethod
    def error_result(cls, errors: List[str], context: str = None) -> 'ConversionResult':
        """Create error conversion result"""
        return cls(success=False, errors=errors, context=context)

class AbstractFHIRConverter(ABC):
    """
    Abstract base class for all FHIR resource converters.
    
    Provides common functionality for FHIR resource creation, validation,
    version compatibility, and error handling while allowing resource-specific
    customization through abstract methods.
    """
    
    def __init__(self,
                 source_version: FHIRVersion = FHIRVersion.R4,
                 target_version: FHIRVersion = FHIRVersion.R5,
                 system_id: str = "wintehr",
                 profile_urls: List[str] = None,
                 validation_pipeline: ValidationPipeline = None):
        """
        Initialize converter with version and validation settings.
        
        Args:
            source_version: FHIR version of source data
            target_version: FHIR version of target data
            system_id: System identifier for generated resources
            profile_urls: FHIR profiles to validate against
            validation_pipeline: Custom validation pipeline
        """
        self.source_version = source_version
        self.target_version = target_version
        self.system_id = system_id
        self.profile_urls = profile_urls or []
        
        # Initialize logging
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
        
        # Initialize validation pipeline
        self.validation_pipeline = validation_pipeline or create_default_pipeline()
        
        # Load configuration
        self._load_configuration()
        
        # Initialize components
        self.field_mappings = self._load_field_mappings()
    
    # Core Abstract Methods
    @abstractmethod
    def get_resource_type(self) -> str:
        """Return the FHIR resource type this converter handles"""
        pass
    
    @abstractmethod
    def get_required_fields(self) -> List[str]:
        """Return list of required fields for this resource type"""
        pass
    
    @abstractmethod
    def to_fhir_core(self, model_data: Dict) -> Dict:
        """Core conversion logic from internal model to FHIR"""
        pass
    
    @abstractmethod
    def from_fhir_core(self, fhir_data: Dict) -> Dict:
        """Core conversion logic from FHIR to internal model"""
        pass
    
    # Template Methods (implement conversion pipeline)
    async def to_fhir(self, model_data: Dict, context: ConversionContext = None) -> ConversionResult:
        """
        Convert from internal model to FHIR resource using template method pattern.
        
        Args:
            model_data: Internal model data
            context: Conversion context (patient, encounter, etc.)
            
        Returns:
            ConversionResult with resource or errors
        """
        try:
            # Create conversion context
            ctx = context or ConversionContext()
            
            # Pre-conversion validation
            validation_errors = await self._validate_input(model_data, ConversionDirection.TO_FHIR)
            if validation_errors:
                return ConversionResult.error_result(validation_errors, "input_validation")
            
            # Pre-processing
            processed_data = await self._preprocess_input(model_data, ctx)
            
            # Core conversion (implemented by subclass)
            fhir_resource = self.to_fhir_core(processed_data)
            
            # Post-processing
            fhir_resource = await self._postprocess_output(fhir_resource, ctx)
            
            # Version adaptation
            if self.source_version != self.target_version:
                fhir_resource = await self._transform_version(fhir_resource, self.source_version, self.target_version)
            
            # Final validation
            validation_result = await self.validation_pipeline.validate(fhir_resource, {"context": ctx})
            
            result = ConversionResult.success_result(fhir_resource)
            result.validation_result = validation_result
            
            if validation_result.has_errors:
                error_messages = [f"{issue.location}: {issue.details}" for issue in validation_result.issues 
                                if issue.severity.value in ['fatal', 'error']]
                return ConversionResult.error_result(error_messages, "output_validation")
            
            if validation_result.has_warnings:
                warning_messages = [f"{issue.location}: {issue.details}" for issue in validation_result.issues 
                                  if issue.severity.value == 'warning']
                result.warnings.extend(warning_messages)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Conversion error in to_fhir: {e}", exc_info=True)
            return ConversionResult.error_result([str(e)], "conversion_error")
    
    async def from_fhir(self, fhir_data: Dict, context: ConversionContext = None) -> ConversionResult:
        """
        Convert from FHIR resource to internal model using template method pattern.
        
        Args:
            fhir_data: FHIR resource data
            context: Conversion context
            
        Returns:
            ConversionResult with model data or errors
        """
        try:
            # Create conversion context
            ctx = context or ConversionContext()
            
            # Pre-conversion validation
            validation_result = await self.validation_pipeline.validate(fhir_data, {"context": ctx})
            
            if validation_result.has_errors:
                error_messages = [f"{issue.location}: {issue.details}" for issue in validation_result.issues 
                                if issue.severity.value in ['fatal', 'error']]
                return ConversionResult.error_result(error_messages, "input_validation")
            
            # Version adaptation (if needed)
            if self.source_version != self.target_version:
                fhir_data = await self._transform_version(fhir_data, self.source_version, self.target_version)
            
            # Pre-processing
            processed_data = await self._preprocess_input(fhir_data, ctx)
            
            # Core conversion (implemented by subclass)
            model_data = self.from_fhir_core(processed_data)
            
            # Post-processing
            model_data = await self._postprocess_output(model_data, ctx)
            
            # Final validation
            output_validation_errors = await self._validate_input(model_data, ConversionDirection.FROM_FHIR)
            if output_validation_errors:
                return ConversionResult.error_result(output_validation_errors, "output_validation")
            
            result = ConversionResult.success_result(model_data)
            result.validation_result = validation_result
            
            if validation_result.has_warnings:
                warning_messages = [f"{issue.location}: {issue.details}" for issue in validation_result.issues 
                                  if issue.severity.value == 'warning']
                result.warnings.extend(warning_messages)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Conversion error in from_fhir: {e}", exc_info=True)
            return ConversionResult.error_result([str(e)], "conversion_error")
    
    # FHIR Utility Methods (available to all subclasses)
    def generate_metadata(self, resource_data: Dict) -> Dict:
        """Generate standard FHIR metadata"""
        return {
            'versionId': str(resource_data.get('version', 1)),
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
            'source': f"#{self.system_id}",
            'profile': self.profile_urls,
            'security': self._get_security_labels(resource_data),
            'tag': self._get_resource_tags(resource_data)
        }
    
    def create_reference(self,
                        resource_type: str,
                        resource_id: str,
                        display: str = None,
                        identifier: Dict = None) -> Dict:
        """Create FHIR reference with version compatibility"""
        ref = {
            'reference': f'{resource_type}/{resource_id}'
        }
        
        if display:
            ref['display'] = display
        
        if identifier:
            ref['identifier'] = identifier
        
        # Add type for R5+ compatibility
        if self.target_version in [FHIRVersion.R5, FHIRVersion.R6]:
            ref['type'] = resource_type
        
        return ref
    
    def create_codeable_concept(self,
                               code: str,
                               system: str,
                               display: str = None,
                               text: str = None,
                               version: str = None) -> Dict:
        """Create FHIR CodeableConcept with validation"""
        if not code or not system:
            raise ValueError("Code and system are required for CodeableConcept")
        
        coding = {
            'system': system,
            'code': code
        }
        
        if display:
            coding['display'] = display
        
        if version:
            coding['version'] = version
        
        concept = {
            'coding': [coding]
        }
        
        if text:
            concept['text'] = text
        elif display:
            concept['text'] = display
        
        return concept
    
    def create_identifier(self,
                         value: str,
                         system: str = None,
                         use: str = 'official',
                         type_coding: Dict = None) -> Dict:
        """Create FHIR Identifier with validation"""
        if not value:
            raise ValueError("Value is required for Identifier")
        
        identifier = {
            'use': use,
            'value': value
        }
        
        if system:
            identifier['system'] = system
        
        if type_coding:
            identifier['type'] = type_coding
        
        return identifier
    
    def convert_datetime(self,
                        dt: Union[datetime, str],
                        fhir_format: str = 'dateTime',
                        precision: str = 'second') -> str:
        """Convert datetime to FHIR format with precision control"""
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            except ValueError:
                raise ValueError(f"Invalid datetime format: {dt}")
        
        if fhir_format == 'date':
            return dt.strftime('%Y-%m-%d')
        elif fhir_format == 'dateTime':
            if precision == 'second':
                return dt.strftime('%Y-%m-%dT%H:%M:%SZ')
            elif precision == 'millisecond':
                return dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ')[:-3] + 'Z'
            else:
                return dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        else:
            raise ValueError(f"Unsupported FHIR format: {fhir_format}")
    
    # Hook methods for customization
    async def _preprocess_input(self, data: Dict, context: ConversionContext) -> Dict:
        """Pre-process input data before conversion"""
        return data
    
    async def _postprocess_output(self, data: Dict, context: ConversionContext) -> Dict:
        """Post-process output data after conversion"""
        return data
    
    async def _validate_input(self, data: Dict, direction: ConversionDirection) -> List[str]:
        """Validate input data"""
        errors = []
        
        # Basic validation
        if direction == ConversionDirection.TO_FHIR:
            required_fields = self.get_required_fields()
            for field in required_fields:
                if field not in data or data[field] is None:
                    errors.append(f"Required field '{field}' is missing")
        
        return errors
    
    async def _transform_version(self, resource: Dict, from_version: FHIRVersion, to_version: FHIRVersion) -> Dict:
        """Transform resource between FHIR versions"""
        # This would implement version-specific transformations
        # For now, return as-is
        self.logger.info(f"Version transformation {from_version.value} -> {to_version.value} not yet implemented")
        return resource
    
    def _load_configuration(self):
        """Load converter configuration"""
        # Override in subclasses for specific configuration
        pass
    
    def _load_field_mappings(self) -> Dict[str, str]:
        """Load field mappings for version compatibility"""
        # Override in subclasses for specific mappings
        return {}
    
    def _get_security_labels(self, resource_data: Dict) -> List[Dict]:
        """Get security labels for resource"""
        # Override in subclasses for specific security requirements
        return []
    
    def _get_resource_tags(self, resource_data: Dict) -> List[Dict]:
        """Get tags for resource"""
        # Override in subclasses for specific tagging
        return []
    
    def _detect_fhir_type(self, value: Any) -> str:
        """Detect FHIR data type for extensions"""
        if isinstance(value, bool):
            return 'Boolean'
        elif isinstance(value, int):
            return 'Integer'
        elif isinstance(value, float):
            return 'Decimal'
        elif isinstance(value, str):
            return 'String'
        elif isinstance(value, datetime):
            return 'DateTime'
        elif isinstance(value, dict):
            return 'Reference' if 'reference' in value else 'CodeableConcept'
        else:
            return 'String'