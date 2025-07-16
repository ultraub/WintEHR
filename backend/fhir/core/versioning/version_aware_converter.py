"""
Version-Aware FHIR Converter
Enhanced version of AbstractFHIRConverter with version-aware capabilities
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Union, Type, Tuple
from datetime import datetime
from enum import Enum
import logging
import json
from dataclasses import dataclass

from fhir.core.abstract_converter import AbstractFHIRConverter, ConversionContext
from fhir.core.version_negotiator import FHIRVersion, FHIRVersionNegotiator
from fhir.core.validation_pipeline import ValidationPipeline, ValidationResult

logger = logging.getLogger(__name__)

@dataclass
class VersionCompatibility:
    """Information about version compatibility for a resource"""
    source_version: FHIRVersion
    target_version: FHIRVersion
    compatibility_level: str  # 'full', 'partial', 'minimal', 'none'
    data_loss_risk: str      # 'none', 'low', 'medium', 'high', 'severe'
    transformation_available: bool
    migration_notes: List[str]
    preserved_fields: List[str]
    lost_fields: List[str]
    added_fields: List[str]

@dataclass
class ConversionResult:
    """Result of FHIR version conversion"""
    resource: Dict[str, Any]
    original_version: FHIRVersion
    target_version: FHIRVersion
    compatibility: VersionCompatibility
    warnings: List[str]
    extensions_preserved: Dict[str, Any]
    transformation_log: List[Dict[str, Any]]
    validation_result: Optional[ValidationResult]

class VersionAwareFHIRConverter(AbstractFHIRConverter):
    """
    Enhanced FHIR Converter with version awareness
    
    Capabilities:
    - Multi-version FHIR support (R4, R5, R6)
    - Automatic version detection and conversion
    - Lossless transformation with extension preservation
    - Validation across versions
    - Migration path analysis
    """
    
    def __init__(self, 
                 resource_type: str,
                 default_version: FHIRVersion = FHIRVersion.R4,
                 enable_validation: bool = True):
        self.resource_type = resource_type
        self.default_version = default_version
        self.enable_validation = enable_validation
        
        # Version-specific configurations
        self.version_configs = self._initialize_version_configs()
        self.field_mappings = self._initialize_field_mappings()
        self.compatibility_matrix = self._initialize_compatibility_matrix()
        
        # Validation pipeline
        if enable_validation:
            self.validation_pipeline = ValidationPipeline()
        
        # Version negotiator
        self.version_negotiator = FHIRVersionNegotiator(default_version)
    
    @abstractmethod
    def _initialize_version_configs(self) -> Dict[FHIRVersion, Dict[str, Any]]:
        """Initialize version-specific configurations for the resource type"""
        pass
    
    @abstractmethod
    def _initialize_field_mappings(self) -> Dict[Tuple[FHIRVersion, FHIRVersion], Dict[str, str]]:
        """Initialize field mappings between FHIR versions"""
        pass
    
    @abstractmethod
    def _initialize_compatibility_matrix(self) -> Dict[Tuple[FHIRVersion, FHIRVersion], VersionCompatibility]:
        """Initialize compatibility information between versions"""
        pass
    
    async def convert(self, 
                     resource_data: Dict[str, Any],
                     source_version: FHIRVersion,
                     target_version: FHIRVersion,
                     context: Optional[ConversionContext] = None,
                     preserve_extensions: bool = True) -> ConversionResult:
        """
        Convert FHIR resource between versions
        
        Args:
            resource_data: Source FHIR resource data
            source_version: Source FHIR version
            target_version: Target FHIR version
            context: Conversion context
            preserve_extensions: Whether to preserve extensions
            
        Returns:
            Conversion result with transformed resource and metadata
        """
        
        logger.info(f"Converting {self.resource_type} from {source_version.value} to {target_version.value}")
        
        if source_version == target_version:
            # No conversion needed
            validation_result = None
            if self.enable_validation:
                validation_result = await self.validation_pipeline.validate(resource_data)
            
            return ConversionResult(
                resource=resource_data,
                original_version=source_version,
                target_version=target_version,
                compatibility=self._get_compatibility(source_version, target_version),
                warnings=[],
                extensions_preserved={},
                transformation_log=[],
                validation_result=validation_result
            )
        
        # Get compatibility info
        compatibility = self._get_compatibility(source_version, target_version)
        if compatibility.compatibility_level == 'none':
            raise ValueError(f"No conversion available from {source_version.value} to {target_version.value}")
        
        # Start conversion process
        transformation_log = []
        warnings = []
        extensions_preserved = {}
        
        # Step 1: Extract and preserve extensions
        if preserve_extensions:
            extensions_preserved = self._extract_extensions(resource_data, source_version)
            transformation_log.append({
                'step': 'extension_extraction',
                'timestamp': datetime.now().isoformat(),
                'extensions_count': len(extensions_preserved),
                'source_version': source_version.value
            })
        
        # Step 2: Validate source resource
        if self.enable_validation:
            source_validation = await self.validation_pipeline.validate(resource_data)
            if not source_validation.is_valid:
                warnings.append(f"Source resource validation failed: {source_validation.error_message}")
        
        # Step 3: Apply version-specific transformations
        converted_resource = await self._apply_version_transformation(
            resource_data, 
            source_version, 
            target_version,
            context
        )
        
        transformation_log.append({
            'step': 'version_transformation',
            'timestamp': datetime.now().isoformat(),
            'source_version': source_version.value,
            'target_version': target_version.value,
            'compatibility_level': compatibility.compatibility_level
        })
        
        # Step 4: Restore extensions in target format
        if preserve_extensions and extensions_preserved:
            converted_resource = self._restore_extensions(
                converted_resource, 
                extensions_preserved, 
                target_version
            )
            transformation_log.append({
                'step': 'extension_restoration',
                'timestamp': datetime.now().isoformat(),
                'extensions_restored': len(extensions_preserved),
                'target_version': target_version.value
            })
        
        # Step 5: Validate converted resource
        validation_result = None
        if self.enable_validation:
            validation_result = await self.validation_pipeline.validate(converted_resource)
            if not validation_result.is_valid:
                warnings.append(f"Converted resource validation failed: {validation_result.error_message}")
        
        # Step 6: Add data loss warnings
        if compatibility.lost_fields:
            warnings.append(f"Fields lost in conversion: {', '.join(compatibility.lost_fields)}")
        
        return ConversionResult(
            resource=converted_resource,
            original_version=source_version,
            target_version=target_version,
            compatibility=compatibility,
            warnings=warnings,
            extensions_preserved=extensions_preserved,
            transformation_log=transformation_log,
            validation_result=validation_result
        )
    
    async def _apply_version_transformation(self,
                                          resource_data: Dict[str, Any],
                                          source_version: FHIRVersion,
                                          target_version: FHIRVersion,
                                          context: Optional[ConversionContext]) -> Dict[str, Any]:
        """Apply version-specific field transformations"""
        
        converted = resource_data.copy()
        field_mapping = self.field_mappings.get((source_version, target_version), {})
        
        # Apply field mappings
        for source_field, target_field in field_mapping.items():
            if source_field in converted:
                value = converted.pop(source_field)
                if target_field:  # None means field is removed
                    converted[target_field] = value
        
        # Apply version-specific transformations
        if source_version == FHIRVersion.R4 and target_version == FHIRVersion.R5:
            converted = await self._transform_r4_to_r5(converted, context)
        elif source_version == FHIRVersion.R5 and target_version == FHIRVersion.R4:
            converted = await self._transform_r5_to_r4(converted, context)
        elif source_version == FHIRVersion.R4 and target_version == FHIRVersion.R6:
            converted = await self._transform_r4_to_r6(converted, context)
        elif source_version == FHIRVersion.R6 and target_version == FHIRVersion.R4:
            converted = await self._transform_r6_to_r4(converted, context)
        elif source_version == FHIRVersion.R5 and target_version == FHIRVersion.R6:
            converted = await self._transform_r5_to_r6(converted, context)
        elif source_version == FHIRVersion.R6 and target_version == FHIRVersion.R5:
            converted = await self._transform_r6_to_r5(converted, context)
        
        # Update metadata
        if 'meta' not in converted:
            converted['meta'] = {}
        
        converted['meta']['versionId'] = '1'
        converted['meta']['lastUpdated'] = datetime.now().isoformat()
        
        # Add version indicator
        if 'extension' not in converted:
            converted['extension'] = []
        
        converted['extension'].append({
            'url': 'http://medgen-emr.com/fhir/extensions/converted-from-version',
            'valueString': source_version.value
        })
        
        return converted
    
    @abstractmethod
    async def _transform_r4_to_r5(self, resource: Dict[str, Any], context: Optional[ConversionContext]) -> Dict[str, Any]:
        """Transform R4 resource to R5 format"""
        pass
    
    @abstractmethod
    async def _transform_r5_to_r4(self, resource: Dict[str, Any], context: Optional[ConversionContext]) -> Dict[str, Any]:
        """Transform R5 resource to R4 format"""
        pass
    
    @abstractmethod
    async def _transform_r4_to_r6(self, resource: Dict[str, Any], context: Optional[ConversionContext]) -> Dict[str, Any]:
        """Transform R4 resource to R6 format"""
        pass
    
    @abstractmethod
    async def _transform_r6_to_r4(self, resource: Dict[str, Any], context: Optional[ConversionContext]) -> Dict[str, Any]:
        """Transform R6 resource to R4 format"""
        pass
    
    @abstractmethod
    async def _transform_r5_to_r6(self, resource: Dict[str, Any], context: Optional[ConversionContext]) -> Dict[str, Any]:
        """Transform R5 resource to R6 format"""
        pass
    
    @abstractmethod
    async def _transform_r6_to_r5(self, resource: Dict[str, Any], context: Optional[ConversionContext]) -> Dict[str, Any]:
        """Transform R6 resource to R5 format"""
        pass
    
    def _get_compatibility(self, source_version: FHIRVersion, target_version: FHIRVersion) -> VersionCompatibility:
        """Get compatibility information between versions"""
        return self.compatibility_matrix.get(
            (source_version, target_version),
            VersionCompatibility(
                source_version=source_version,
                target_version=target_version,
                compatibility_level='minimal',
                data_loss_risk='high',
                transformation_available=False,
                migration_notes=['No specific compatibility information available'],
                preserved_fields=[],
                lost_fields=[],
                added_fields=[]
            )
        )
    
    def _extract_extensions(self, resource: Dict[str, Any], version: FHIRVersion) -> Dict[str, Any]:
        """Extract extensions from resource for preservation"""
        extensions = {}
        
        # Extract root extensions
        if 'extension' in resource:
            extensions['root'] = resource['extension']
        
        # Extract modifier extensions
        if 'modifierExtension' in resource:
            extensions['modifier'] = resource['modifierExtension']
        
        # Extract nested extensions (version-specific)
        if version == FHIRVersion.R5:
            # R5-specific extension handling
            self._extract_r5_extensions(resource, extensions)
        elif version == FHIRVersion.R6:
            # R6-specific extension handling
            self._extract_r6_extensions(resource, extensions)
        
        return extensions
    
    def _restore_extensions(self, 
                           resource: Dict[str, Any], 
                           extensions: Dict[str, Any], 
                           version: FHIRVersion) -> Dict[str, Any]:
        """Restore extensions to resource in target version format"""
        
        if 'root' in extensions:
            if 'extension' not in resource:
                resource['extension'] = []
            resource['extension'].extend(extensions['root'])
        
        if 'modifier' in extensions:
            if 'modifierExtension' not in resource:
                resource['modifierExtension'] = []
            resource['modifierExtension'].extend(extensions['modifier'])
        
        # Version-specific extension restoration
        if version == FHIRVersion.R5:
            self._restore_r5_extensions(resource, extensions)
        elif version == FHIRVersion.R6:
            self._restore_r6_extensions(resource, extensions)
        
        return resource
    
    def _extract_r5_extensions(self, resource: Dict[str, Any], extensions: Dict[str, Any]):
        """Extract R5-specific extensions"""
        # TODO: Implement R5-specific extension extraction
        pass
    
    def _extract_r6_extensions(self, resource: Dict[str, Any], extensions: Dict[str, Any]):
        """Extract R6-specific extensions"""
        # TODO: Implement R6-specific extension extraction
        pass
    
    def _restore_r5_extensions(self, resource: Dict[str, Any], extensions: Dict[str, Any]):
        """Restore R5-specific extensions"""
        # TODO: Implement R5-specific extension restoration
        pass
    
    def _restore_r6_extensions(self, resource: Dict[str, Any], extensions: Dict[str, Any]):
        """Restore R6-specific extensions"""
        # TODO: Implement R6-specific extension restoration
        pass
    
    async def analyze_migration_path(self, 
                                   source_version: FHIRVersion,
                                   target_version: FHIRVersion) -> Dict[str, Any]:
        """Analyze migration path between versions"""
        
        compatibility = self._get_compatibility(source_version, target_version)
        
        analysis = {
            'source_version': source_version.value,
            'target_version': target_version.value,
            'direct_path_available': compatibility.transformation_available,
            'compatibility_level': compatibility.compatibility_level,
            'data_loss_risk': compatibility.data_loss_risk,
            'migration_strategy': 'direct' if compatibility.transformation_available else 'multi_step',
            'estimated_complexity': self._estimate_migration_complexity(compatibility),
            'recommended_approach': self._get_migration_recommendation(compatibility),
            'field_changes': {
                'preserved': compatibility.preserved_fields,
                'lost': compatibility.lost_fields,
                'added': compatibility.added_fields
            },
            'warnings': compatibility.migration_notes
        }
        
        # If direct path not available, find multi-step path
        if not compatibility.transformation_available:
            analysis['multi_step_path'] = self._find_multi_step_path(source_version, target_version)
        
        return analysis
    
    def _estimate_migration_complexity(self, compatibility: VersionCompatibility) -> str:
        """Estimate migration complexity"""
        if compatibility.data_loss_risk == 'none':
            return 'low'
        elif compatibility.data_loss_risk in ['low', 'medium']:
            return 'medium'
        else:
            return 'high'
    
    def _get_migration_recommendation(self, compatibility: VersionCompatibility) -> str:
        """Get migration recommendation"""
        if compatibility.compatibility_level == 'full':
            return 'safe_to_migrate'
        elif compatibility.compatibility_level == 'partial':
            return 'migrate_with_caution'
        elif compatibility.compatibility_level == 'minimal':
            return 'migration_not_recommended'
        else:
            return 'migration_not_possible'
    
    def _find_multi_step_path(self, source: FHIRVersion, target: FHIRVersion) -> List[FHIRVersion]:
        """Find multi-step migration path between versions"""
        # Simple implementation: try intermediate versions
        if source == FHIRVersion.R4 and target == FHIRVersion.R6:
            return [FHIRVersion.R4, FHIRVersion.R5, FHIRVersion.R6]
        elif source == FHIRVersion.R6 and target == FHIRVersion.R4:
            return [FHIRVersion.R6, FHIRVersion.R5, FHIRVersion.R4]
        
        return [source, target]  # Direct path
    
    async def validate_conversion(self, 
                                original: Dict[str, Any],
                                converted: Dict[str, Any],
                                source_version: FHIRVersion,
                                target_version: FHIRVersion) -> Dict[str, Any]:
        """Validate the quality of a conversion"""
        
        validation_result = {
            'conversion_successful': True,
            'data_integrity_score': 1.0,
            'field_preservation_rate': 1.0,
            'warnings': [],
            'errors': [],
            'recommendations': []
        }
        
        # Check required fields
        required_fields = self._get_required_fields(target_version)
        missing_fields = [field for field in required_fields if field not in converted]
        
        if missing_fields:
            validation_result['errors'].extend([f"Missing required field: {field}" for field in missing_fields])
            validation_result['conversion_successful'] = False
        
        # Calculate preservation rate
        original_fields = set(self._get_all_field_paths(original))
        converted_fields = set(self._get_all_field_paths(converted))
        preserved_count = len(original_fields.intersection(converted_fields))
        validation_result['field_preservation_rate'] = preserved_count / len(original_fields) if original_fields else 1.0
        
        # Calculate data integrity score
        compatibility = self._get_compatibility(source_version, target_version)
        if compatibility.data_loss_risk == 'none':
            validation_result['data_integrity_score'] = 1.0
        elif compatibility.data_loss_risk == 'low':
            validation_result['data_integrity_score'] = 0.9
        elif compatibility.data_loss_risk == 'medium':
            validation_result['data_integrity_score'] = 0.7
        elif compatibility.data_loss_risk == 'high':
            validation_result['data_integrity_score'] = 0.5
        else:  # severe
            validation_result['data_integrity_score'] = 0.3
        
        return validation_result
    
    @abstractmethod
    def _get_required_fields(self, version: FHIRVersion) -> List[str]:
        """Get required fields for the resource type in specific version"""
        pass
    
    def _get_all_field_paths(self, resource: Dict[str, Any], prefix: str = '') -> List[str]:
        """Get all field paths in a resource"""
        paths = []
        for key, value in resource.items():
            full_key = f"{prefix}.{key}" if prefix else key
            paths.append(full_key)
            
            if isinstance(value, dict):
                paths.extend(self._get_all_field_paths(value, full_key))
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        paths.extend(self._get_all_field_paths(item, f"{full_key}[{i}]"))
        
        return paths