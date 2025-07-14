# AbstractFHIRConverter Design Specification
**WintEHR Backend - Comprehensive Converter Abstraction Architecture**

*Design Date: 2025-07-13*  
*Based On: Converter Pattern Analysis Report*  
*Status: Architecture Design*

## 🎯 Design Objectives

### Primary Goals
1. **Eliminate 2,250+ lines** of duplicated converter code (47% reduction)
2. **Standardize FHIR compliance** across all resource types
3. **Enable rapid development** of new converters (1 day vs 1 week)
4. **Centralize version handling** for R4/R5/R6 compatibility
5. **Ensure data integrity** through consistent validation patterns

### Design Principles
- **Single Responsibility**: Each converter handles one resource type
- **Open/Closed**: Open for extension, closed for modification
- **Dependency Inversion**: Depend on abstractions, not concretions
- **Version Agnostic**: Support multiple FHIR versions transparently
- **Performance First**: Optimize for high-throughput conversion scenarios

---

## 🏗️ Core Architecture

### Class Hierarchy

```
AbstractFHIRConverter (Abstract Base)
├── ResourceConverter (Abstract)
│   ├── ConditionConverter
│   ├── ObservationConverter
│   ├── MedicationRequestConverter
│   └── [Other Resource Converters]
├── UtilityConverter (Abstract)
│   ├── ReferenceConverter
│   ├── CodeableConceptConverter
│   └── IdentifierConverter
└── VersionAdapter (Abstract)
    ├── R4ToR5Adapter
    ├── R5ToR4Adapter
    └── R6Adapter (Future)
```

### Conversion Pipeline

```
Input Data
    ↓
[Validation] → [Pre-processing] → [Core Conversion] → [Post-processing] → [Version Adaptation] → [Final Validation]
    ↓
FHIR Resource
```

---

## 🔧 Interface Definitions

### AbstractFHIRConverter Base Class

```python
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Union, Type
from datetime import datetime
from enum import Enum
import logging

class FHIRVersion(Enum):
    R4 = "R4"
    R5 = "R5"
    R6 = "R6"

class ConversionDirection(Enum):
    TO_FHIR = "to_fhir"
    FROM_FHIR = "from_fhir"

class ValidationLevel(Enum):
    NONE = "none"
    BASIC = "basic"
    STRICT = "strict"
    PROFILE = "profile"

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
                 validation_level: ValidationLevel = ValidationLevel.STRICT,
                 system_id: str = "wintehr",
                 profile_urls: List[str] = None):
        """
        Initialize converter with version and validation settings.
        
        Args:
            source_version: FHIR version of source data
            target_version: FHIR version of target data
            validation_level: Level of validation to perform
            system_id: System identifier for generated resources
            profile_urls: FHIR profiles to validate against
        """
        self.source_version = source_version
        self.target_version = target_version
        self.validation_level = validation_level
        self.system_id = system_id
        self.profile_urls = profile_urls or []
        
        # Initialize logging
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
        
        # Load configuration
        self._load_configuration()
        
        # Initialize components
        self.validator = self._create_validator()
        self.version_adapter = self._create_version_adapter()
        self.field_mappings = self._load_field_mappings()
        
    # Core Abstract Methods
    @abstractmethod
    def get_resource_type(self) -> str:
        """Return the FHIR resource type this converter handles."""
        pass
    
    @abstractmethod
    def get_required_fields(self) -> List[str]:
        """Return list of required fields for this resource type."""
        pass
    
    @abstractmethod
    def to_fhir_core(self, model_data: Dict) -> Dict:
        """Core conversion logic from internal model to FHIR."""
        pass
    
    @abstractmethod
    def from_fhir_core(self, fhir_data: Dict) -> Dict:
        """Core conversion logic from FHIR to internal model."""
        pass
    
    # Template Methods (implement conversion pipeline)
    def to_fhir(self, model_data: Dict, context: ConversionContext = None) -> ConversionResult:
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
            if self.validation_level != ValidationLevel.NONE:
                validation_errors = self._validate_input(model_data, ConversionDirection.TO_FHIR)
                if validation_errors:
                    return ConversionResult.error(validation_errors, "input_validation")
            
            # Pre-processing
            processed_data = self._preprocess_input(model_data, ctx)
            
            # Core conversion (implemented by subclass)
            fhir_resource = self.to_fhir_core(processed_data)
            
            # Post-processing
            fhir_resource = self._postprocess_output(fhir_resource, ctx)
            
            # Version adaptation
            if self.source_version != self.target_version:
                fhir_resource = self.version_adapter.transform(
                    fhir_resource, 
                    self.source_version, 
                    self.target_version
                )
            
            # Final validation
            if self.validation_level in [ValidationLevel.STRICT, ValidationLevel.PROFILE]:
                validation_errors = self._validate_fhir_resource(fhir_resource)
                if validation_errors:
                    return ConversionResult.error(validation_errors, "output_validation")
            
            # Success
            return ConversionResult.success(fhir_resource)
            
        except Exception as e:
            self.logger.error(f"Conversion error in to_fhir: {e}", exc_info=True)
            return ConversionResult.error([str(e)], "conversion_error")
    
    def from_fhir(self, fhir_data: Dict, context: ConversionContext = None) -> ConversionResult:
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
            if self.validation_level != ValidationLevel.NONE:
                validation_errors = self._validate_fhir_resource(fhir_data)
                if validation_errors:
                    return ConversionResult.error(validation_errors, "input_validation")
            
            # Version adaptation (if needed)
            if self.source_version != self.target_version:
                fhir_data = self.version_adapter.transform(
                    fhir_data, 
                    self.source_version, 
                    self.target_version
                )
            
            # Pre-processing
            processed_data = self._preprocess_input(fhir_data, ctx)
            
            # Core conversion (implemented by subclass)
            model_data = self.from_fhir_core(processed_data)
            
            # Post-processing
            model_data = self._postprocess_output(model_data, ctx)
            
            # Final validation
            if self.validation_level in [ValidationLevel.STRICT, ValidationLevel.PROFILE]:
                validation_errors = self._validate_input(model_data, ConversionDirection.FROM_FHIR)
                if validation_errors:
                    return ConversionResult.error(validation_errors, "output_validation")
            
            # Success
            return ConversionResult.success(model_data)
            
        except Exception as e:
            self.logger.error(f"Conversion error in from_fhir: {e}", exc_info=True)
            return ConversionResult.error([str(e)], "conversion_error")
```

### Common Utility Methods

```python
    # FHIR Utility Methods (available to all subclasses)
    def generate_metadata(self, resource_data: Dict) -> Dict:
        """Generate standard FHIR metadata."""
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
        """Create FHIR reference with version compatibility."""
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
        """Create FHIR CodeableConcept with validation."""
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
        """Create FHIR Identifier with validation."""
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
        """Convert datetime to FHIR format with precision control."""
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
    
    def create_quantity(self,
                       value: Union[int, float],
                       unit: str = None,
                       system: str = 'http://unitsofmeasure.org',
                       code: str = None) -> Dict:
        """Create FHIR Quantity with validation."""
        if value is None:
            raise ValueError("Value is required for Quantity")
        
        quantity = {
            'value': float(value)
        }
        
        if unit:
            quantity['unit'] = unit
            quantity['system'] = system
            quantity['code'] = code or unit
        
        return quantity
    
    def create_period(self,
                     start: Union[datetime, str] = None,
                     end: Union[datetime, str] = None) -> Dict:
        """Create FHIR Period."""
        if not start and not end:
            raise ValueError("At least start or end is required for Period")
        
        period = {}
        
        if start:
            period['start'] = self.convert_datetime(start)
        
        if end:
            period['end'] = self.convert_datetime(end)
        
        return period
    
    def add_extension(self,
                     resource: Dict,
                     url: str,
                     value: Any,
                     value_type: str = None) -> None:
        """Add extension to FHIR resource with type detection."""
        if 'extension' not in resource:
            resource['extension'] = []
        
        if value_type is None:
            value_type = self._detect_fhir_type(value)
        
        extension = {
            'url': url,
            f'value{value_type}': value
        }
        
        resource['extension'].append(extension)
    
    def get_extension_value(self, resource: Dict, url: str) -> Any:
        """Get extension value from FHIR resource."""
        extensions = resource.get('extension', [])
        for ext in extensions:
            if ext.get('url') == url:
                for key, value in ext.items():
                    if key.startswith('value'):
                        return value
        return None
```

---

## 🎭 Supporting Classes

### ConversionContext

```python
@dataclass
class ConversionContext:
    """Context information for FHIR conversions."""
    
    # Patient context
    patient_id: Optional[str] = None
    patient_reference: Optional[Dict] = None
    
    # Encounter context
    encounter_id: Optional[str] = None
    encounter_reference: Optional[Dict] = None
    
    # Provider context
    practitioner_id: Optional[str] = None
    practitioner_reference: Optional[Dict] = None
    
    # Organization context
    organization_id: Optional[str] = None
    organization_reference: Optional[Dict] = None
    
    # Temporal context
    effective_date: Optional[datetime] = None
    recorded_date: Optional[datetime] = None
    
    # Processing hints
    include_contained: bool = False
    resolve_references: bool = True
    validate_references: bool = True
    
    # Custom context
    custom_data: Dict[str, Any] = field(default_factory=dict)
```

### ConversionResult

```python
@dataclass
class ConversionResult:
    """Result of a FHIR conversion operation."""
    
    success: bool
    data: Optional[Dict] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    context: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def success(cls, data: Dict, warnings: List[str] = None) -> 'ConversionResult':
        """Create successful conversion result."""
        return cls(
            success=True,
            data=data,
            warnings=warnings or []
        )
    
    @classmethod
    def error(cls, errors: List[str], context: str = None) -> 'ConversionResult':
        """Create error conversion result."""
        return cls(
            success=False,
            errors=errors,
            context=context
        )
```

### ValidationRule

```python
class ValidationRule(ABC):
    """Abstract base for validation rules."""
    
    @abstractmethod
    def validate(self, data: Dict, context: ConversionContext) -> List[str]:
        """Validate data and return list of error messages."""
        pass

class RequiredFieldRule(ValidationRule):
    """Validates required fields are present."""
    
    def __init__(self, fields: List[str]):
        self.fields = fields
    
    def validate(self, data: Dict, context: ConversionContext) -> List[str]:
        errors = []
        for field in self.fields:
            if field not in data or data[field] is None:
                errors.append(f"Required field '{field}' is missing")
        return errors

class FHIRStructureRule(ValidationRule):
    """Validates FHIR resource structure."""
    
    def __init__(self, resource_type: str):
        self.resource_type = resource_type
    
    def validate(self, data: Dict, context: ConversionContext) -> List[str]:
        errors = []
        
        # Check resourceType
        if data.get('resourceType') != self.resource_type:
            errors.append(f"Expected resourceType '{self.resource_type}', got '{data.get('resourceType')}'")
        
        # Check ID format
        if 'id' in data and not self._is_valid_id(data['id']):
            errors.append(f"Invalid resource ID format: {data['id']}")
        
        return errors
    
    def _is_valid_id(self, resource_id: str) -> bool:
        """Validate FHIR resource ID format."""
        import re
        # FHIR ID pattern: [A-Za-z0-9\-\.]{1,64}
        pattern = r'^[A-Za-z0-9\-\.]{1,64}$'
        return bool(re.match(pattern, resource_id))
```

---

## 🔄 Version Adaptation Framework

### VersionAdapter Interface

```python
class VersionAdapter(ABC):
    """Abstract base for FHIR version adapters."""
    
    @abstractmethod
    def transform(self, 
                 resource: Dict, 
                 from_version: FHIRVersion, 
                 to_version: FHIRVersion) -> Dict:
        """Transform resource between FHIR versions."""
        pass
    
    @abstractmethod
    def get_field_mapping(self, 
                         resource_type: str,
                         from_version: FHIRVersion,
                         to_version: FHIRVersion) -> Dict[str, str]:
        """Get field mappings between versions."""
        pass

class R4ToR5Adapter(VersionAdapter):
    """Adapter for R4 to R5 transformations."""
    
    def __init__(self):
        self.field_mappings = self._load_field_mappings()
        self.transformers = self._load_transformers()
    
    def transform(self, 
                 resource: Dict, 
                 from_version: FHIRVersion, 
                 to_version: FHIRVersion) -> Dict:
        """Transform R4 resource to R5 format."""
        if from_version != FHIRVersion.R4 or to_version != FHIRVersion.R5:
            raise ValueError(f"Unsupported transformation: {from_version} -> {to_version}")
        
        resource_type = resource.get('resourceType')
        if not resource_type:
            raise ValueError("resourceType is required for transformation")
        
        # Apply field mappings
        transformed = self._apply_field_mappings(resource, resource_type)
        
        # Apply resource-specific transformations
        transformer = self.transformers.get(resource_type)
        if transformer:
            transformed = transformer.transform(transformed)
        
        return transformed
    
    def _apply_field_mappings(self, resource: Dict, resource_type: str) -> Dict:
        """Apply field-level mappings."""
        mappings = self.field_mappings.get(resource_type, {})
        transformed = resource.copy()
        
        for old_field, new_field in mappings.items():
            if old_field in resource:
                if '.' in new_field:
                    # Nested field mapping
                    self._set_nested_field(transformed, new_field, resource[old_field])
                    del transformed[old_field]
                else:
                    # Simple field rename
                    transformed[new_field] = transformed.pop(old_field)
        
        return transformed
    
    def _set_nested_field(self, obj: Dict, path: str, value: Any) -> None:
        """Set nested field using dot notation."""
        parts = path.split('.')
        current = obj
        
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        current[parts[-1]] = value
```

---

## 📊 Concrete Implementation Examples

### ConditionConverter

```python
class ConditionConverter(AbstractFHIRConverter):
    """Converter for FHIR Condition resources with R4/R5 compatibility."""
    
    def get_resource_type(self) -> str:
        return 'Condition'
    
    def get_required_fields(self) -> List[str]:
        # R5 requires clinicalStatus, R4 does not
        base_fields = ['subject', 'code']
        if self.target_version in [FHIRVersion.R5, FHIRVersion.R6]:
            base_fields.append('clinicalStatus')
        return base_fields
    
    def to_fhir_core(self, condition_data: Dict) -> Dict:
        """Convert internal condition model to FHIR Condition."""
        # Build base resource structure
        resource = {
            'resourceType': self.get_resource_type(),
            'id': condition_data.get('id'),
            'meta': self.generate_metadata(condition_data)
        }
        
        # Required: subject (patient reference)
        resource['subject'] = self.create_reference(
            'Patient',
            condition_data['patient_id'],
            condition_data.get('patient_name')
        )
        
        # Required: code (condition diagnosis)
        resource['code'] = self.create_codeable_concept(
            condition_data['code'],
            condition_data.get('code_system', 'http://snomed.info/sct'),
            condition_data.get('display'),
            condition_data.get('text')
        )
        
        # R5 Required: clinicalStatus
        if self.target_version in [FHIRVersion.R5, FHIRVersion.R6]:
            clinical_status = condition_data.get('clinical_status', 'active')
            resource['clinicalStatus'] = self.create_codeable_concept(
                clinical_status,
                'http://terminology.hl7.org/CodeSystem/condition-clinical',
                clinical_status.title()
            )
        
        # Optional: verificationStatus
        if 'verification_status' in condition_data:
            resource['verificationStatus'] = self.create_codeable_concept(
                condition_data['verification_status'],
                'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                condition_data['verification_status'].replace('-', ' ').title()
            )
        
        # Optional: category
        if 'category' in condition_data:
            resource['category'] = [self.create_codeable_concept(
                condition_data['category'],
                'http://terminology.hl7.org/CodeSystem/condition-category',
                condition_data.get('category_display')
            )]
        
        # Optional: severity
        if 'severity' in condition_data:
            resource['severity'] = self.create_codeable_concept(
                condition_data['severity'],
                'http://snomed.info/sct',
                condition_data.get('severity_display')
            )
        
        # Optional: onset
        if 'onset_date' in condition_data:
            resource['onsetDateTime'] = self.convert_datetime(condition_data['onset_date'])
        elif 'onset_age' in condition_data:
            resource['onsetAge'] = self.create_quantity(
                condition_data['onset_age'],
                'a',
                'http://unitsofmeasure.org'
            )
        
        # Optional: abatement
        if 'abatement_date' in condition_data:
            resource['abatementDateTime'] = self.convert_datetime(condition_data['abatement_date'])
        
        # Optional: recordedDate
        if 'recorded_date' in condition_data:
            resource['recordedDate'] = self.convert_datetime(condition_data['recorded_date'])
        
        # Optional: recorder
        if 'recorder_id' in condition_data:
            resource['recorder'] = self.create_reference(
                'Practitioner',
                condition_data['recorder_id'],
                condition_data.get('recorder_name')
            )
        
        # Optional: asserter
        if 'asserter_id' in condition_data:
            resource['asserter'] = self.create_reference(
                'Practitioner',
                condition_data['asserter_id'],
                condition_data.get('asserter_name')
            )
        
        # Optional: encounter
        if 'encounter_id' in condition_data:
            resource['encounter'] = self.create_reference(
                'Encounter',
                condition_data['encounter_id']
            )
        
        # Optional: evidence
        if 'evidence' in condition_data:
            resource['evidence'] = []
            for evidence_item in condition_data['evidence']:
                evidence = {}
                if 'code' in evidence_item:
                    evidence['code'] = [self.create_codeable_concept(
                        evidence_item['code'],
                        evidence_item.get('code_system', 'http://snomed.info/sct'),
                        evidence_item.get('display')
                    )]
                if 'detail' in evidence_item:
                    evidence['detail'] = [self.create_reference(
                        evidence_item['detail_type'],
                        evidence_item['detail']
                    )]
                resource['evidence'].append(evidence)
        
        # Optional: note
        if 'notes' in condition_data:
            resource['note'] = []
            for note in condition_data['notes']:
                note_obj = {
                    'text': note['text']
                }
                if 'author' in note:
                    note_obj['authorReference'] = self.create_reference(
                        'Practitioner',
                        note['author']
                    )
                if 'time' in note:
                    note_obj['time'] = self.convert_datetime(note['time'])
                resource['note'].append(note_obj)
        
        return resource
    
    def from_fhir_core(self, fhir_data: Dict) -> Dict:
        """Convert FHIR Condition to internal model."""
        model_data = {
            'id': fhir_data.get('id'),
            'resource_type': 'condition'
        }
        
        # Extract patient reference
        if 'subject' in fhir_data:
            model_data['patient_id'] = self._extract_reference_id(fhir_data['subject'])
            model_data['patient_name'] = fhir_data['subject'].get('display')
        
        # Extract condition code
        if 'code' in fhir_data:
            code_data = self._extract_codeable_concept(fhir_data['code'])
            model_data.update(code_data)
        
        # Extract clinical status
        if 'clinicalStatus' in fhir_data:
            status_data = self._extract_codeable_concept(fhir_data['clinicalStatus'])
            model_data['clinical_status'] = status_data.get('code')
        
        # Extract verification status
        if 'verificationStatus' in fhir_data:
            verification_data = self._extract_codeable_concept(fhir_data['verificationStatus'])
            model_data['verification_status'] = verification_data.get('code')
        
        # Extract category
        if 'category' in fhir_data and fhir_data['category']:
            category_data = self._extract_codeable_concept(fhir_data['category'][0])
            model_data['category'] = category_data.get('code')
            model_data['category_display'] = category_data.get('display')
        
        # Extract severity
        if 'severity' in fhir_data:
            severity_data = self._extract_codeable_concept(fhir_data['severity'])
            model_data['severity'] = severity_data.get('code')
            model_data['severity_display'] = severity_data.get('display')
        
        # Extract onset
        if 'onsetDateTime' in fhir_data:
            model_data['onset_date'] = fhir_data['onsetDateTime']
        elif 'onsetAge' in fhir_data:
            model_data['onset_age'] = fhir_data['onsetAge'].get('value')
        
        # Extract abatement
        if 'abatementDateTime' in fhir_data:
            model_data['abatement_date'] = fhir_data['abatementDateTime']
        
        # Extract dates
        if 'recordedDate' in fhir_data:
            model_data['recorded_date'] = fhir_data['recordedDate']
        
        # Extract references
        if 'recorder' in fhir_data:
            model_data['recorder_id'] = self._extract_reference_id(fhir_data['recorder'])
            model_data['recorder_name'] = fhir_data['recorder'].get('display')
        
        if 'asserter' in fhir_data:
            model_data['asserter_id'] = self._extract_reference_id(fhir_data['asserter'])
            model_data['asserter_name'] = fhir_data['asserter'].get('display')
        
        if 'encounter' in fhir_data:
            model_data['encounter_id'] = self._extract_reference_id(fhir_data['encounter'])
        
        # Extract evidence
        if 'evidence' in fhir_data:
            model_data['evidence'] = []
            for evidence in fhir_data['evidence']:
                evidence_item = {}
                if 'code' in evidence and evidence['code']:
                    code_data = self._extract_codeable_concept(evidence['code'][0])
                    evidence_item.update(code_data)
                if 'detail' in evidence and evidence['detail']:
                    detail_ref = evidence['detail'][0]
                    evidence_item['detail'] = self._extract_reference_id(detail_ref)
                    evidence_item['detail_type'] = self._extract_reference_type(detail_ref)
                model_data['evidence'].append(evidence_item)
        
        # Extract notes
        if 'note' in fhir_data:
            model_data['notes'] = []
            for note in fhir_data['note']:
                note_item = {
                    'text': note.get('text')
                }
                if 'authorReference' in note:
                    note_item['author'] = self._extract_reference_id(note['authorReference'])
                if 'time' in note:
                    note_item['time'] = note['time']
                model_data['notes'].append(note_item)
        
        return model_data
    
    # Helper methods
    def _extract_reference_id(self, reference: Dict) -> str:
        """Extract ID from FHIR reference."""
        if not reference or 'reference' not in reference:
            return None
        
        ref = reference['reference']
        if '/' in ref:
            return ref.split('/')[-1]
        return ref
    
    def _extract_reference_type(self, reference: Dict) -> str:
        """Extract resource type from FHIR reference."""
        if not reference or 'reference' not in reference:
            return None
        
        ref = reference['reference']
        if '/' in ref:
            return ref.split('/')[0]
        return reference.get('type')
    
    def _extract_codeable_concept(self, codeable_concept: Dict) -> Dict:
        """Extract code information from CodeableConcept."""
        if not codeable_concept:
            return {}
        
        result = {}
        
        # Extract text
        if 'text' in codeable_concept:
            result['text'] = codeable_concept['text']
            result['display'] = codeable_concept['text']
        
        # Extract coding
        if 'coding' in codeable_concept and codeable_concept['coding']:
            first_coding = codeable_concept['coding'][0]
            result['code'] = first_coding.get('code')
            result['code_system'] = first_coding.get('system')
            if 'display' in first_coding and 'display' not in result:
                result['display'] = first_coding['display']
        
        return result
```

---

## 🎯 Implementation Strategy

### Phase 1: Foundation (Weeks 1-2)

#### Week 1: Core Infrastructure
- [ ] **AbstractFHIRConverter** base class implementation
- [ ] **ConversionContext** and **ConversionResult** classes
- [ ] **ValidationRule** framework
- [ ] Core utility methods (metadata, reference, codeable concept)

#### Week 2: Version Support
- [ ] **VersionAdapter** framework
- [ ] **R4ToR5Adapter** implementation
- [ ] Field mapping configuration system
- [ ] Testing framework for converters

### Phase 2: Pilot Implementation (Weeks 3-4)

#### Week 3: ConditionConverter
- [ ] Implement **ConditionConverter** using new framework
- [ ] Resource-specific validation rules
- [ ] Comprehensive test suite
- [ ] Performance benchmarking

#### Week 4: Validation and Refinement
- [ ] A/B testing against existing converter
- [ ] Performance optimization
- [ ] Framework refinements based on learnings
- [ ] Documentation updates

### Phase 3: Systematic Migration (Weeks 5-8)

#### Week 5-6: Core Resource Converters
- [ ] **ObservationConverter**
- [ ] **MedicationRequestConverter**
- [ ] **EncounterConverter**
- [ ] **PatientConverter**

#### Week 7-8: Remaining Converters
- [ ] **PractitionerConverter**
- [ ] **OrganizationConverter**
- [ ] **AllergyIntoleranceConverter**
- [ ] Utility converters migration

### Phase 4: Enhancement (Weeks 9-10)

#### Week 9: Advanced Features
- [ ] Profile-specific validation
- [ ] Extension handling improvements
- [ ] Bulk conversion support
- [ ] Performance optimization

#### Week 10: Production Readiness
- [ ] Comprehensive testing
- [ ] Documentation completion
- [ ] Monitoring and metrics
- [ ] Production deployment

---

## 📈 Success Metrics

### Code Quality Metrics
- **Code Reduction**: 47% (2,250+ lines eliminated)
- **Duplication Elimination**: <5% duplication across converters
- **Test Coverage**: >95% for AbstractFHIRConverter, >90% for implementations
- **Cyclomatic Complexity**: <10 for 95% of methods

### Performance Metrics
- **Conversion Speed**: <10ms for typical resource
- **Memory Usage**: <50MB for converter instances
- **Throughput**: >1000 conversions/second
- **Error Rate**: <0.1% for valid input data

### Development Metrics
- **New Converter Development**: 1 day (from 1 week)
- **Bug Resolution Time**: 50% reduction
- **Maintenance Effort**: 60% reduction
- **Onboarding Time**: 40% faster for new developers

---

## 🔚 Conclusion

This AbstractFHIRConverter design provides a comprehensive solution for eliminating converter code duplication while ensuring consistent FHIR compliance across all resource types. The template method pattern ensures standardized conversion pipelines while the abstract methods allow for resource-specific customization.

The version adaptation framework future-proofs the system for R6 and beyond, while the validation system ensures data integrity at all stages of conversion.

**Recommendation**: Proceed with implementation using the phased approach, starting with the base framework and piloting with ConditionConverter before systematic migration.

---

*This design will be refined based on implementation feedback and evolving FHIR standards.*