"""
FHIR Version Transformation Framework
Handles conversion between FHIR R4, R5, and R6 resource formats
"""

from typing import Dict, Any, List, Optional, Callable
from abc import ABC, abstractmethod
import logging
import copy
from dataclasses import dataclass

from fhir.core.version_negotiator import FHIRVersion, version_negotiator

logger = logging.getLogger(__name__)

@dataclass
class TransformationResult:
    """Result of FHIR version transformation"""
    transformed_resource: Dict[str, Any]
    source_version: FHIRVersion
    target_version: FHIRVersion
    warnings: List[str]
    data_loss: List[str]
    success: bool

class BaseTransformer(ABC):
    """Base class for FHIR version transformers"""
    
    @abstractmethod
    def transform(self, resource: Dict[str, Any], 
                 source_version: FHIRVersion, 
                 target_version: FHIRVersion) -> TransformationResult:
        """Transform resource between FHIR versions"""
        pass
    
    @abstractmethod
    def supports_resource_type(self, resource_type: str) -> bool:
        """Check if transformer supports given resource type"""
        pass

class MedicationRequestTransformer(BaseTransformer):
    """Transformer for MedicationRequest resources between FHIR versions"""
    
    def supports_resource_type(self, resource_type: str) -> bool:
        return resource_type == 'MedicationRequest'
    
    def transform(self, resource: Dict[str, Any], 
                 source_version: FHIRVersion, 
                 target_version: FHIRVersion) -> TransformationResult:
        """Transform MedicationRequest between versions"""
        
        result_resource = copy.deepcopy(resource)
        warnings = []
        data_loss = []
        
        try:
            # R4 to R5 transformation
            if source_version == FHIRVersion.R4 and target_version == FHIRVersion.R5:
                result_resource = self._transform_r4_to_r5(result_resource, warnings, data_loss)
            
            # R5 to R4 transformation
            elif source_version == FHIRVersion.R5 and target_version == FHIRVersion.R4:
                result_resource = self._transform_r5_to_r4(result_resource, warnings, data_loss)
            
            # R4 to R6 transformation (via R5)
            elif source_version == FHIRVersion.R4 and target_version == FHIRVersion.R6:
                r5_result = self._transform_r4_to_r5(result_resource, warnings, data_loss)
                result_resource = self._transform_r5_to_r6(r5_result, warnings, data_loss)
            
            # R6 to R4 transformation (via R5)
            elif source_version == FHIRVersion.R6 and target_version == FHIRVersion.R4:
                r5_result = self._transform_r6_to_r5(result_resource, warnings, data_loss)
                result_resource = self._transform_r5_to_r4(r5_result, warnings, data_loss)
            
            # R5 to R6 transformation
            elif source_version == FHIRVersion.R5 and target_version == FHIRVersion.R6:
                result_resource = self._transform_r5_to_r6(result_resource, warnings, data_loss)
            
            # R6 to R5 transformation
            elif source_version == FHIRVersion.R6 and target_version == FHIRVersion.R5:
                result_resource = self._transform_r6_to_r5(result_resource, warnings, data_loss)
            
            return TransformationResult(
                transformed_resource=result_resource,
                source_version=source_version,
                target_version=target_version,
                warnings=warnings,
                data_loss=data_loss,
                success=True
            )
            
        except Exception as e:
            logger.error(f"MedicationRequest transformation failed: {e}")
            return TransformationResult(
                transformed_resource=resource,
                source_version=source_version,
                target_version=target_version,
                warnings=[f"Transformation failed: {str(e)}"],
                data_loss=[],
                success=False
            )
    
    def _transform_r4_to_r5(self, resource: Dict[str, Any], 
                           warnings: List[str], data_loss: List[str]) -> Dict[str, Any]:
        """Transform MedicationRequest from R4 to R5 format"""
        
        # Transform medicationCodeableConcept to medication.concept
        if 'medicationCodeableConcept' in resource:
            medication_concept = resource.pop('medicationCodeableConcept')
            resource['medication'] = {
                'concept': medication_concept
            }
            warnings.append("Converted medicationCodeableConcept to medication.concept (R5 format)")
        
        # Transform medicationReference to medication.reference  
        elif 'medicationReference' in resource:
            medication_ref = resource.pop('medicationReference')
            resource['medication'] = {
                'reference': medication_ref
            }
            warnings.append("Converted medicationReference to medication.reference (R5 format)")
        
        # Update meta.profile to R5
        if 'meta' not in resource:
            resource['meta'] = {}
        
        resource['meta']['profile'] = ['http://hl7.org/fhir/R5/StructureDefinition/MedicationRequest']
        
        # Remove fhirVersion field as it's not part of the FHIR resource structure
        if 'fhirVersion' in resource:
            resource.pop('fhirVersion')
        
        return resource
    
    def _transform_r5_to_r4(self, resource: Dict[str, Any], 
                           warnings: List[str], data_loss: List[str]) -> Dict[str, Any]:
        """Transform MedicationRequest from R5 to R4 format"""
        
        # Transform medication.concept to medicationCodeableConcept
        if 'medication' in resource:
            medication = resource.pop('medication')
            
            if 'concept' in medication:
                resource['medicationCodeableConcept'] = medication['concept']
                warnings.append("Converted medication.concept to medicationCodeableConcept (R4 format)")
            
            elif 'reference' in medication:
                resource['medicationReference'] = medication['reference']
                warnings.append("Converted medication.reference to medicationReference (R4 format)")
            
            # Handle any other medication fields
            if len(medication) > 1:
                data_loss.append("Some medication fields may not be preserved in R4 format")
        
        # Update meta.profile to R4
        if 'meta' not in resource:
            resource['meta'] = {}
        
        resource['meta']['profile'] = ['http://hl7.org/fhir/StructureDefinition/MedicationRequest']
        
        # Remove fhirVersion field as it's not part of the FHIR resource structure
        if 'fhirVersion' in resource:
            resource.pop('fhirVersion')
        
        return resource
    
    def _transform_r5_to_r6(self, resource: Dict[str, Any], 
                           warnings: List[str], data_loss: List[str]) -> Dict[str, Any]:
        """Transform MedicationRequest from R5 to R6 format"""
        
        # R5 to R6 transformations (hypothetical - R6 structure)
        # Add enhanced dosage instructions support
        if 'dosageInstruction' in resource:
            for dosage in resource['dosageInstruction']:
                if 'text' in dosage and 'enhancedInstructions' not in dosage:
                    dosage['enhancedInstructions'] = {
                        'text': dosage['text'],
                        'machineReadable': False  # R6 enhancement
                    }
                    warnings.append("Enhanced dosage instructions for R6 compatibility")
        
        # Update meta.profile to R6
        if 'meta' not in resource:
            resource['meta'] = {}
        
        resource['meta']['profile'] = ['http://hl7.org/fhir/R6/StructureDefinition/MedicationRequest']
        
        # Remove fhirVersion field as it's not part of the FHIR resource structure
        if 'fhirVersion' in resource:
            resource.pop('fhirVersion')
        
        return resource
    
    def _transform_r6_to_r5(self, resource: Dict[str, Any], 
                           warnings: List[str], data_loss: List[str]) -> Dict[str, Any]:
        """Transform MedicationRequest from R6 to R5 format"""
        
        # R6 to R5 transformations
        if 'dosageInstruction' in resource:
            for dosage in resource['dosageInstruction']:
                if 'enhancedInstructions' in dosage:
                    enhanced = dosage.pop('enhancedInstructions')
                    if 'text' in enhanced:
                        dosage['text'] = enhanced['text']
                    data_loss.append("Enhanced dosage instructions simplified for R5")
        
        # Update meta.profile to R5
        if 'meta' not in resource:
            resource['meta'] = {}
        resource['meta']['profile'] = ['http://hl7.org/fhir/R5/StructureDefinition/MedicationRequest']
        
        # Remove fhirVersion field as it's not part of the FHIR resource structure
        if 'fhirVersion' in resource:
            resource.pop('fhirVersion')
        
        return resource

class PatientTransformer(BaseTransformer):
    """Transformer for Patient resources between FHIR versions"""
    
    def supports_resource_type(self, resource_type: str) -> bool:
        return resource_type == 'Patient'
    
    def transform(self, resource: Dict[str, Any], 
                 source_version: FHIRVersion, 
                 target_version: FHIRVersion) -> TransformationResult:
        """Transform Patient between versions"""
        
        result_resource = copy.deepcopy(resource)
        warnings = []
        data_loss = []
        
        try:
            # Most Patient transformations are structural updates
            if source_version != target_version:
                # Update meta.profile based on target version
                if 'meta' not in result_resource:
                    result_resource['meta'] = {}
                
                if target_version == FHIRVersion.R4:
                    result_resource['meta']['profile'] = ['http://hl7.org/fhir/StructureDefinition/Patient']
                elif target_version == FHIRVersion.R5:
                    result_resource['meta']['profile'] = ['http://hl7.org/fhir/R5/StructureDefinition/Patient']
                elif target_version == FHIRVersion.R6:
                    result_resource['meta']['profile'] = ['http://hl7.org/fhir/R6/StructureDefinition/Patient']
                    
                    # Add R6 enhancements (hypothetical)
                    if 'extension' not in result_resource:
                        result_resource['extension'] = []
                    
                    # Add pronouns support in R6
                    pronouns_extension = {
                        'url': 'http://hl7.org/fhir/R6/StructureDefinition/patient-pronouns',
                        'valueString': 'they/them'  # Default neutral
                    }
                    result_resource['extension'].append(pronouns_extension)
                    warnings.append("Added default pronouns extension for R6 compatibility")
                
                # Remove fhirVersion field as it's not part of the FHIR resource structure
                if 'fhirVersion' in result_resource:
                    result_resource.pop('fhirVersion')
                
                warnings.append(f"Updated Patient resource structure for {target_version.value}")
            
            return TransformationResult(
                transformed_resource=result_resource,
                source_version=source_version,
                target_version=target_version,
                warnings=warnings,
                data_loss=data_loss,
                success=True
            )
            
        except Exception as e:
            logger.error(f"Patient transformation failed: {e}")
            return TransformationResult(
                transformed_resource=resource,
                source_version=source_version,
                target_version=target_version,
                warnings=[f"Transformation failed: {str(e)}"],
                data_loss=[],
                success=False
            )

class ObservationTransformer(BaseTransformer):
    """Transformer for Observation resources between FHIR versions"""
    
    def supports_resource_type(self, resource_type: str) -> bool:
        return resource_type == 'Observation'
    
    def transform(self, resource: Dict[str, Any], 
                 source_version: FHIRVersion, 
                 target_version: FHIRVersion) -> TransformationResult:
        """Transform Observation between versions"""
        
        result_resource = copy.deepcopy(resource)
        warnings = []
        data_loss = []
        
        try:
            # Update version-specific metadata
            if source_version != target_version:
                if 'meta' not in result_resource:
                    result_resource['meta'] = {}
                
                if target_version == FHIRVersion.R4:
                    result_resource['meta']['profile'] = ['http://hl7.org/fhir/StructureDefinition/Observation']
                elif target_version == FHIRVersion.R5:
                    result_resource['meta']['profile'] = ['http://hl7.org/fhir/R5/StructureDefinition/Observation']
                elif target_version == FHIRVersion.R6:
                    result_resource['meta']['profile'] = ['http://hl7.org/fhir/R6/StructureDefinition/Observation']
                
                # Remove fhirVersion field as it's not part of the FHIR resource structure
                if 'fhirVersion' in result_resource:
                    result_resource.pop('fhirVersion')
                
                warnings.append(f"Updated Observation resource metadata for {target_version.value}")
            
            return TransformationResult(
                transformed_resource=result_resource,
                source_version=source_version,
                target_version=target_version,
                warnings=warnings,
                data_loss=data_loss,
                success=True
            )
            
        except Exception as e:
            logger.error(f"Observation transformation failed: {e}")
            return TransformationResult(
                transformed_resource=resource,
                source_version=source_version,
                target_version=target_version,
                warnings=[f"Transformation failed: {str(e)}"],
                data_loss=[],
                success=False
            )

class FHIRVersionTransformer:
    """
    Main FHIR Version Transformation Framework
    
    Orchestrates transformation between FHIR R4, R5, and R6 versions
    Uses specialized transformers for different resource types
    """
    
    def __init__(self):
        self.transformers: Dict[str, BaseTransformer] = {
            'MedicationRequest': MedicationRequestTransformer(),
            'Patient': PatientTransformer(),
            'Observation': ObservationTransformer(),
        }
        self.fallback_transformer = self._create_fallback_transformer()
    
    def _create_fallback_transformer(self) -> BaseTransformer:
        """Create a fallback transformer for unsupported resource types"""
        
        class FallbackTransformer(BaseTransformer):
            def supports_resource_type(self, resource_type: str) -> bool:
                return True  # Supports all types as fallback
            
            def transform(self, resource: Dict[str, Any], 
                         source_version: FHIRVersion, 
                         target_version: FHIRVersion) -> TransformationResult:
                """Basic transformation - just update metadata"""
                
                result_resource = copy.deepcopy(resource)
                warnings = []
                
                if source_version != target_version:
                    if 'meta' not in result_resource:
                        result_resource['meta'] = {}
                    
                    # Remove fhirVersion field as it's not part of the FHIR resource structure
                    if 'fhirVersion' in result_resource:
                        result_resource.pop('fhirVersion')
                    
                    warnings.append(f"Basic transformation applied - updated metadata only")
                
                return TransformationResult(
                    transformed_resource=result_resource,
                    source_version=source_version,
                    target_version=target_version,
                    warnings=warnings,
                    data_loss=[],
                    success=True
                )
        
        return FallbackTransformer()
    
    def transform_resource(self, resource: Dict[str, Any], 
                          target_version: FHIRVersion,
                          source_version: Optional[FHIRVersion] = None) -> TransformationResult:
        """
        Transform a FHIR resource to target version
        
        Args:
            resource: FHIR resource to transform
            target_version: Desired FHIR version
            source_version: Source version (auto-detected if None)
            
        Returns:
            TransformationResult with transformed resource and metadata
        """
        
        # Auto-detect source version if not provided
        if source_version is None:
            detection_result = version_negotiator.detect_version_from_resource(resource)
            source_version = detection_result.detected_version
            logger.info(f"Auto-detected source version: {source_version.value} "
                       f"(confidence: {detection_result.confidence:.2f})")
        
        # No transformation needed if versions match
        if source_version == target_version:
            return TransformationResult(
                transformed_resource=resource,
                source_version=source_version,
                target_version=target_version,
                warnings=[],
                data_loss=[],
                success=True
            )
        
        # Get appropriate transformer
        resource_type = resource.get('resourceType', '')
        transformer = self.transformers.get(resource_type, self.fallback_transformer)
        
        # Perform transformation
        result = transformer.transform(resource, source_version, target_version)
        
        logger.info(f"Transformed {resource_type} from {source_version.value} to {target_version.value}")
        if result.warnings:
            logger.warning(f"Transformation warnings: {result.warnings}")
        if result.data_loss:
            logger.warning(f"Data loss during transformation: {result.data_loss}")
        
        return result
    
    def transform_bundle(self, bundle: Dict[str, Any], 
                        target_version: FHIRVersion) -> Dict[str, Any]:
        """
        Transform all resources in a FHIR Bundle to target version
        
        Args:
            bundle: FHIR Bundle containing multiple resources
            target_version: Desired FHIR version for all resources
            
        Returns:
            Transformed bundle with all resources converted
        """
        
        result_bundle = copy.deepcopy(bundle)
        transformation_results = []
        
        if 'entry' in result_bundle:
            for entry in result_bundle['entry']:
                if 'resource' in entry:
                    transform_result = self.transform_resource(
                        entry['resource'], 
                        target_version
                    )
                    entry['resource'] = transform_result.transformed_resource
                    transformation_results.append(transform_result)
        
        # Update bundle metadata
        if 'meta' not in result_bundle:
            result_bundle['meta'] = {}
        
        # Remove fhirVersion field as it's not part of the FHIR resource structure
        if 'fhirVersion' in result_bundle:
            result_bundle.pop('fhirVersion')
        
        # Add transformation summary to bundle
        total_warnings = sum(len(r.warnings) for r in transformation_results)
        total_data_loss = sum(len(r.data_loss) for r in transformation_results)
        
        if total_warnings > 0 or total_data_loss > 0:
            if 'extension' not in result_bundle:
                result_bundle['extension'] = []
            
            result_bundle['extension'].append({
                'url': 'http://example.org/fhir/StructureDefinition/transformation-summary',
                'extension': [
                    {
                        'url': 'totalWarnings',
                        'valueInteger': total_warnings
                    },
                    {
                        'url': 'totalDataLoss',
                        'valueInteger': total_data_loss
                    }
                ]
            })
        
        return result_bundle
    
    def register_transformer(self, resource_type: str, transformer: BaseTransformer):
        """Register a custom transformer for a resource type"""
        self.transformers[resource_type] = transformer
        logger.info(f"Registered custom transformer for {resource_type}")

# Global transformer instance
fhir_transformer = FHIRVersionTransformer()