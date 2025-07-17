"""
FHIR Version Detection and Negotiation System
Handles automatic detection and negotiation between FHIR R4, R5, and R6 versions
"""

from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
import logging
from dataclasses import dataclass
import re

logger = logging.getLogger(__name__)

class FHIRVersion(Enum):
    """Supported FHIR versions"""
    R4 = "4.0.1"
    R5 = "5.0.0"
    R6 = "6.0.0"

@dataclass
class VersionDetectionResult:
    """Result of FHIR version detection"""
    detected_version: FHIRVersion
    confidence: float
    indicators: List[str]
    fallback_version: Optional[FHIRVersion] = None

@dataclass
class NegotiationResult:
    """Result of version negotiation"""
    target_version: FHIRVersion
    source_version: FHIRVersion
    transformation_needed: bool
    compatibility_level: str  # 'full', 'partial', 'minimal'

class FHIRVersionNegotiator:
    """
    FHIR Version Detection and Negotiation System
    
    Capabilities:
    - Automatic version detection from resources
    - Content negotiation based on client preferences
    - Compatibility assessment between versions
    - Fallback strategy management
    """
    
    def __init__(self, default_version: FHIRVersion = FHIRVersion.R4):
        self.default_version = default_version
        self.version_indicators = self._build_version_indicators()
        self.compatibility_matrix = self._build_compatibility_matrix()
    
    def _build_version_indicators(self) -> Dict[FHIRVersion, Dict[str, Any]]:
        """Build version detection indicators"""
        return {
            FHIRVersion.R4: {
                'meta_profile_patterns': [
                    r'http://hl7\.org/fhir/R4/',
                    r'http://hl7\.org/fhir/StructureDefinition/.*',
                ],
                'fhir_version_field': '4.0.1',
                'structure_indicators': {
                    'MedicationRequest': ['medicationCodeableConcept', 'medicationReference'],
                    'Observation': ['valueQuantity', 'component'],
                    'Patient': ['active', 'name', 'telecom']
                },
                'unsupported_elements': ['medication.concept']  # R5 format
            },
            FHIRVersion.R5: {
                'meta_profile_patterns': [
                    r'http://hl7\.org/fhir/R5/',
                    r'http://hl7\.org/fhir/5\.0\.0/',
                ],
                'fhir_version_field': '5.0.0',
                'structure_indicators': {
                    'MedicationRequest': ['medication.concept', 'medication.reference'],
                    'Observation': ['value', 'component'],
                    'Patient': ['active', 'name', 'contact']
                },
                'new_elements': ['medication.concept'],  # New in R5
                'deprecated_r4': ['medicationCodeableConcept']
            },
            FHIRVersion.R6: {
                'meta_profile_patterns': [
                    r'http://hl7\.org/fhir/R6/',
                    r'http://hl7\.org/fhir/6\.0\.0/',
                ],
                'fhir_version_field': '6.0.0',
                'structure_indicators': {
                    'MedicationRequest': ['medication.concept', 'medication.reference'],
                    'Observation': ['value', 'component'],
                    'Patient': ['active', 'name', 'contact']
                },
                'new_elements': ['patient.pronouns'],  # New in R6
                'enhanced_elements': ['CodeableConcept.concept']
            }
        }
    
    def _build_compatibility_matrix(self) -> Dict[Tuple[FHIRVersion, FHIRVersion], str]:
        """Build version compatibility matrix"""
        return {
            # R4 compatibility
            (FHIRVersion.R4, FHIRVersion.R4): 'full',
            (FHIRVersion.R4, FHIRVersion.R5): 'partial',
            (FHIRVersion.R4, FHIRVersion.R6): 'minimal',
            
            # R5 compatibility
            (FHIRVersion.R5, FHIRVersion.R4): 'partial',
            (FHIRVersion.R5, FHIRVersion.R5): 'full',
            (FHIRVersion.R5, FHIRVersion.R6): 'partial',
            
            # R6 compatibility
            (FHIRVersion.R6, FHIRVersion.R4): 'minimal',
            (FHIRVersion.R6, FHIRVersion.R5): 'partial',
            (FHIRVersion.R6, FHIRVersion.R6): 'full',
        }
    
    def detect_version_from_resource(self, resource: Dict[str, Any]) -> VersionDetectionResult:
        """
        Detect FHIR version from a single resource
        
        Args:
            resource: FHIR resource dictionary
            
        Returns:
            VersionDetectionResult with detected version and confidence
        """
        indicators = []
        version_scores = {version: 0 for version in FHIRVersion}
        
        # Check meta.profile for version indicators
        if 'meta' in resource and 'profile' in resource['meta']:
            for profile in resource['meta']['profile']:
                for version, config in self.version_indicators.items():
                    for pattern in config['meta_profile_patterns']:
                        if re.search(pattern, profile):
                            version_scores[version] += 3
                            indicators.append(f"Profile pattern: {pattern}")
        
        # Check fhirVersion field
        if 'fhirVersion' in resource:
            fhir_version = resource['fhirVersion']
            for version, config in self.version_indicators.items():
                if fhir_version == config['fhir_version_field']:
                    version_scores[version] += 5
                    indicators.append(f"fhirVersion field: {fhir_version}")
        
        # Check structure indicators
        resource_type = resource.get('resourceType', '')
        for version, config in self.version_indicators.items():
            if resource_type in config['structure_indicators']:
                expected_fields = config['structure_indicators'][resource_type]
                found_fields = [field for field in expected_fields if self._has_nested_field(resource, field)]
                
                if found_fields:
                    version_scores[version] += len(found_fields)
                    indicators.extend([f"Structure indicator: {field}" for field in found_fields])
        
        # Check for version-specific elements
        for version, config in self.version_indicators.items():
            # Check for new elements
            if 'new_elements' in config:
                for element in config['new_elements']:
                    if self._has_nested_field(resource, element):
                        version_scores[version] += 2
                        indicators.append(f"Version-specific element: {element}")
            
            # Check for unsupported elements (negative score)
            if 'unsupported_elements' in config:
                for element in config['unsupported_elements']:
                    if self._has_nested_field(resource, element):
                        version_scores[version] -= 2
                        indicators.append(f"Unsupported element: {element}")
        
        # Determine detected version
        max_score = max(version_scores.values())
        if max_score <= 0:
            detected_version = self.default_version
            confidence = 0.1
        else:
            detected_version = max(version_scores, key=version_scores.get)
            confidence = min(max_score / 10.0, 1.0)  # Normalize to 0-1
        
        # Determine fallback version
        sorted_versions = sorted(version_scores.items(), key=lambda x: x[1], reverse=True)
        fallback_version = sorted_versions[1][0] if len(sorted_versions) > 1 and sorted_versions[1][1] > 0 else None
        
        return VersionDetectionResult(
            detected_version=detected_version,
            confidence=confidence,
            indicators=indicators,
            fallback_version=fallback_version
        )
    
    def _has_nested_field(self, obj: Dict[str, Any], field_path: str) -> bool:
        """Check if nested field exists in object"""
        parts = field_path.split('.')
        current = obj
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return False
        return True
    
    def negotiate_version(self, 
                         client_preferences: List[FHIRVersion],
                         resource_version: Optional[FHIRVersion] = None,
                         server_capabilities: Optional[List[FHIRVersion]] = None) -> NegotiationResult:
        """
        Negotiate FHIR version based on client preferences and capabilities
        
        Args:
            client_preferences: Ordered list of client's preferred versions
            resource_version: Detected version of existing resource (if any)
            server_capabilities: Server's supported versions
            
        Returns:
            NegotiationResult with agreed version and transformation requirements
        """
        if server_capabilities is None:
            server_capabilities = list(FHIRVersion)
        
        # Start with client preferences
        for preferred_version in client_preferences:
            if preferred_version in server_capabilities:
                source_version = resource_version or preferred_version
                compatibility = self.compatibility_matrix.get(
                    (source_version, preferred_version), 'minimal'
                )
                
                transformation_needed = source_version != preferred_version
                
                return NegotiationResult(
                    target_version=preferred_version,
                    source_version=source_version,
                    transformation_needed=transformation_needed,
                    compatibility_level=compatibility
                )
        
        # Fallback to server's highest supported version
        highest_server_version = max(server_capabilities, key=lambda v: v.value)
        source_version = resource_version or highest_server_version
        
        compatibility = self.compatibility_matrix.get(
            (source_version, highest_server_version), 'minimal'
        )
        
        return NegotiationResult(
            target_version=highest_server_version,
            source_version=source_version,
            transformation_needed=source_version != highest_server_version,
            compatibility_level=compatibility
        )
    
    def extract_version_from_accept_header(self, accept_header: str) -> List[FHIRVersion]:
        """
        Extract FHIR version preferences from HTTP Accept header
        
        Examples:
        - application/fhir+json; fhirVersion=4.0.1
        - application/fhir+json; fhirVersion=5.0.0; q=0.8
        """
        preferences = []
        
        # Parse accept header for FHIR version parameters
        parts = accept_header.split(',')
        for part in parts:
            part = part.strip()
            if 'fhirVersion=' in part:
                version_match = re.search(r'fhirVersion=([0-9.]+)', part)
                if version_match:
                    version_str = version_match.group(1)
                    try:
                        # Map version strings to enum values
                        if version_str.startswith('4.'):
                            preferences.append(FHIRVersion.R4)
                        elif version_str.startswith('5.'):
                            preferences.append(FHIRVersion.R5)
                        elif version_str.startswith('6.'):
                            preferences.append(FHIRVersion.R6)
                    except ValueError:
                        continue
        
        # Default to R4 if no version specified
        if not preferences:
            preferences.append(FHIRVersion.R4)
        
        return preferences
    
    def assess_transformation_complexity(self, 
                                       source_version: FHIRVersion,
                                       target_version: FHIRVersion,
                                       resource_type: str) -> Dict[str, Any]:
        """
        Assess complexity of transforming between FHIR versions
        
        Returns:
            Dictionary with transformation assessment details
        """
        if source_version == target_version:
            return {
                'complexity': 'none',
                'transformations_needed': [],
                'data_loss_risk': 'none',
                'success_probability': 1.0
            }
        
        compatibility = self.compatibility_matrix.get((source_version, target_version), 'minimal')
        
        transformations = []
        data_loss_risk = 'low'
        success_probability = 0.9
        
        # Assess specific transformations needed
        if source_version == FHIRVersion.R4 and target_version == FHIRVersion.R5:
            if resource_type == 'MedicationRequest':
                transformations.append('medicationCodeableConcept -> medication.concept')
                data_loss_risk = 'minimal'
                success_probability = 0.95
        
        elif source_version == FHIRVersion.R5 and target_version == FHIRVersion.R4:
            if resource_type == 'MedicationRequest':
                transformations.append('medication.concept -> medicationCodeableConcept')
                data_loss_risk = 'minimal'
                success_probability = 0.95
        
        elif abs(float(source_version.value[0]) - float(target_version.value[0])) > 1:
            transformations.append('Major version transformation required')
            data_loss_risk = 'high'
            success_probability = 0.7
        
        complexity_map = {
            'full': 'low',
            'partial': 'medium', 
            'minimal': 'high'
        }
        
        return {
            'complexity': complexity_map.get(compatibility, 'high'),
            'transformations_needed': transformations,
            'data_loss_risk': data_loss_risk,
            'success_probability': success_probability
        }

# Global instance
version_negotiator = FHIRVersionNegotiator()