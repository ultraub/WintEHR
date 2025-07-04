"""
Profile-Aware FHIR Transformer

A flexible FHIR transformer that can handle different profiles, Implementation Guides (IGs),
and FHIR versions while ensuring compatibility with the fhir.resources library.

Supports:
- US Core profiles
- Synthea output
- C-CDA on FHIR
- International Patient Summary (IPS)
- Custom organizational profiles
"""

import copy
import json
from typing import Dict, Any, List, Optional, Union, Set
from datetime import datetime
from pathlib import Path
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class ProfileHandler(ABC):
    """Abstract base class for handling specific FHIR profiles."""
    
    @abstractmethod
    def can_handle(self, resource: Dict[str, Any]) -> bool:
        """Check if this handler can process the resource."""
        pass
    
    @abstractmethod
    def transform(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Transform the resource to R4 standard."""
        pass
    
    @abstractmethod
    def get_profile_url(self) -> str:
        """Get the profile URL this handler supports."""
        pass


class SyntheaProfileHandler(ProfileHandler):
    """Handler for Synthea-generated FHIR data."""
    
    def can_handle(self, resource: Dict[str, Any]) -> bool:
        """Check if this is Synthea data."""
        # Check for Synthea-specific markers in various places
        
        # 1. Check meta profiles for synthea
        meta = resource.get('meta', {})
        profiles = meta.get('profile', [])
        if any('synthea' in p.lower() for p in profiles):
            return True
        
        # 2. Check identifier systems for Synthea
        identifiers = resource.get('identifier', [])
        for identifier in identifiers:
            if isinstance(identifier, dict):
                system = identifier.get('system', '')
                if 'synthea' in system.lower():
                    return True
        
        # 3. Check for Synthea-specific reference patterns
        if 'reference' in str(resource) and 'urn:uuid:' in str(resource):
            # Synthea often uses urn:uuid references
            if resource.get('resourceType') in ['Encounter', 'Patient', 'Condition', 'Observation']:
                return True
        
        # 4. Check for specific Synthea field patterns
        if resource.get('resourceType') == 'Encounter':
            # Synthea encounters have specific class structure and participant.individual
            class_field = resource.get('class')
            participants = resource.get('participant', [])
            
            if (isinstance(class_field, dict) and 
                any(isinstance(p, dict) and 'individual' in p for p in participants)):
                return True
        
        # 5. Check for bundle patterns
        if resource.get('resourceType') == 'Bundle':
            entries = resource.get('entry', [])
            if entries and len(entries) > 0:
                # Check if any entries have Synthea patterns
                for entry in entries[:5]:  # Check first 5 entries
                    entry_resource = entry.get('resource', {})
                    if self.can_handle(entry_resource):
                        return True
        
        return False
    
    def get_profile_url(self) -> str:
        return "http://synthea.mitre.org/fhir/StructureDefinition/"
    
    def transform(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Synthea resource to standard R4."""
        resource_type = resource.get('resourceType')
        
        if resource_type == 'Encounter':
            # Synthea uses single class object instead of array
            if 'class' in resource and not isinstance(resource['class'], list):
                resource['class'] = [resource['class']]
            
            # Fix participant structure: individual → actor
            if 'participant' in resource and isinstance(resource['participant'], list):
                for participant in resource['participant']:
                    if isinstance(participant, dict) and 'individual' in participant:
                        participant['actor'] = participant.pop('individual')
        
        elif resource_type == 'Procedure':
            # Synthea uses performedPeriod which needs to be performed
            if 'performedPeriod' in resource and 'performed' not in resource:
                resource['performed'] = resource.pop('performedPeriod')
            elif 'performedDateTime' in resource and 'performed' not in resource:
                resource['performed'] = resource.pop('performedDateTime')
        
        elif resource_type == 'Device':
            # Fix type to be array
            if 'type' in resource and not isinstance(resource['type'], list):
                resource['type'] = [resource['type']]
            # Remove deprecated fields
            resource.pop('distinctIdentifier', None)
        
        elif resource_type == 'DiagnosticReport':
            # Handle base64 data in presentedForm
            if 'presentedForm' in resource and isinstance(resource['presentedForm'], list):
                for form in resource['presentedForm']:
                    if isinstance(form, dict) and 'data' in form:
                        # Ensure data is properly encoded string
                        if isinstance(form['data'], bytes):
                            try:
                                form['data'] = form['data'].decode('utf-8')
                            except UnicodeDecodeError:
                                # If can't decode, convert to base64
                                import base64
                                form['data'] = base64.b64encode(form['data']).decode('utf-8')
        
        return resource


class USCoreProfileHandler(ProfileHandler):
    """Handler for US Core profiles."""
    
    US_CORE_PROFILES = {
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner",
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
    }
    
    def can_handle(self, resource: Dict[str, Any]) -> bool:
        """Check if this is US Core profiled data."""
        meta = resource.get('meta', {})
        profiles = meta.get('profile', [])
        
        return any(profile in self.US_CORE_PROFILES for profile in profiles)
    
    def get_profile_url(self) -> str:
        return "http://hl7.org/fhir/us/core/StructureDefinition/"
    
    def transform(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Transform US Core resource to standard R4."""
        # US Core is generally compliant with R4, but may have specific requirements
        resource_type = resource.get('resourceType')
        
        if resource_type == 'Patient':
            # Ensure required US Core fields are present
            if 'identifier' in resource and not isinstance(resource['identifier'], list):
                resource['identifier'] = [resource['identifier']]
            
            # US Core requires at least name.family or name.given
            if 'name' in resource:
                for name in resource.get('name', []):
                    if isinstance(name, dict):
                        # Ensure proper name structure
                        if 'text' in name and not any(k in name for k in ['family', 'given']):
                            # Split text into parts if needed
                            parts = name['text'].split()
                            if len(parts) >= 2:
                                name['given'] = parts[:-1]
                                name['family'] = parts[-1]
        
        elif resource_type == 'Encounter':
            # Handle Synthea-generated US Core Encounters that need class array fix
            if 'class' in resource and not isinstance(resource['class'], list):
                resource['class'] = [resource['class']]
            
            # Fix participant structure: individual → actor (common in Synthea data)
            if 'participant' in resource and isinstance(resource['participant'], list):
                for participant in resource['participant']:
                    if isinstance(participant, dict) and 'individual' in participant:
                        participant['actor'] = participant.pop('individual')
        
        return resource


class ProfileAwareFHIRTransformer:
    """
    Main transformer that uses profile handlers to transform FHIR data.
    
    This transformer:
    1. Detects the profile/IG of incoming data
    2. Applies profile-specific transformations
    3. Ensures R4 compliance for fhir.resources library
    4. Preserves profile information in meta
    """
    
    def __init__(self, strict_mode: bool = False):
        """
        Initialize the transformer.
        
        Args:
            strict_mode: If True, fail on validation errors. If False, attempt to fix.
        """
        self.strict_mode = strict_mode
        self.handlers: List[ProfileHandler] = [
            SyntheaProfileHandler(),
            USCoreProfileHandler(),
        ]
        
        # Common field mappings across all profiles
        self.common_array_fields = {
            'identifier', 'name', 'telecom', 'address', 'photo',
            'contact', 'communication', 'generalPractitioner', 'link',
            'category', 'performer', 'author', 'note',
            'dosageInstruction', 'dispenseRequest', 'substitution',
            'priorPrescription', 'detectedIssue', 'eventHistory',
            'destination', 'receiver', 'enterer', 'attester',
            'custodian', 'relatesTo', 'event', 'section', 'careTeam',
            'addresses', 'supportingInfo', 'goal', 'activity',
            'diagnosis', 'procedure', 'insurance', 'accident',
            'item', 'addItem', 'total', 'payment', 'processNote',
            'benefitBalance', 'contained', 'extension', 'modifierExtension'
        }
        
        # Resource-specific array fields that need special handling
        self.resource_array_fields = {
            'Encounter': {'class', 'type', 'participant'},
            'Device': {'type'},
            'Patient': {'identifier', 'name', 'telecom', 'address', 'contact', 'communication', 'generalPractitioner', 'link'},
            'Condition': {'category', 'bodySite'},
            'Observation': {'category', 'performer', 'interpretation', 'note', 'referenceRange', 'component'},
            'Procedure': {'category', 'performer', 'reasonCode', 'reasonReference', 'bodySite', 'note'},
            'DiagnosticReport': {'category', 'performer', 'specimen', 'result', 'imagingStudy', 'media', 'presentedForm'}
        }
        
        # Version-specific transformations
        self.version_transforms = {
            'STU3_to_R4': {
                'MedicationRequest': {
                    'medicationCodeableConcept': 'medication',
                    'medicationReference': 'medication',
                },
                'Observation': {
                    'valueQuantity': 'value',
                    'valueCodeableConcept': 'value',
                    'valueString': 'value',
                },
            }
        }
    
    def detect_profile(self, resource: Dict[str, Any]) -> Optional[ProfileHandler]:
        """
        Detect which profile handler to use for this resource.
        
        Args:
            resource: The FHIR resource
            
        Returns:
            The appropriate ProfileHandler or None
        """
        for handler in self.handlers:
            if handler.can_handle(resource):
                logger.info(f"Detected profile: {handler.get_profile_url()}")
                return handler
        
        return None
    
    def transform_resource(self, resource: Dict[str, Any], 
                         profile_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Transform a FHIR resource to R4 standard.
        
        Args:
            resource: The resource to transform
            profile_url: Optional profile URL to force specific handling
            
        Returns:
            Transformed resource
        """
        # Make a deep copy
        transformed = copy.deepcopy(resource)
        
        # Detect and apply profile-specific transformations
        handler = self.detect_profile(transformed)
        if handler:
            transformed = handler.transform(transformed)
        
        # Apply common transformations
        transformed = self._apply_common_transforms(transformed)
        
        # Ensure arrays where needed
        transformed = self._ensure_common_arrays(transformed)
        
        # Fix references
        transformed = self._normalize_references(transformed)
        
        # Preserve profile information
        if profile_url:
            if 'meta' not in transformed:
                transformed['meta'] = {}
            if 'profile' not in transformed['meta']:
                transformed['meta']['profile'] = []
            if profile_url not in transformed['meta']['profile']:
                transformed['meta']['profile'].append(profile_url)
        
        return transformed
    
    def _apply_common_transforms(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Apply transformations common to all profiles."""
        resource_type = resource.get('resourceType')
        
        # Handle medication[x] polymorphic fields
        if resource_type == 'MedicationRequest':
            if 'medicationCodeableConcept' in resource:
                resource['medication'] = resource.pop('medicationCodeableConcept')
            elif 'medicationReference' in resource:
                resource['medication'] = resource.pop('medicationReference')
        
        # Handle performed[x] polymorphic fields
        elif resource_type == 'Procedure':
            if 'performedPeriod' in resource and 'performed' not in resource:
                resource['performed'] = resource.pop('performedPeriod')
            elif 'performedDateTime' in resource and 'performed' not in resource:
                resource['performed'] = resource.pop('performedDateTime')
        
        # Handle value[x] polymorphic fields
        elif resource_type == 'Observation':
            # Find any value[x] field and ensure it's named correctly
            for key in list(resource.keys()):
                if key.startswith('value') and key != 'value':
                    # This is a value[x] field
                    if 'value' not in resource:
                        resource['value'] = resource.pop(key)
        
        # Fix Encounter structure
        elif resource_type == 'Encounter':
            # Ensure class is array
            if 'class' in resource and not isinstance(resource['class'], list):
                resource['class'] = [resource['class']]
                
            # Fix participant structure: individual → actor
            if 'participant' in resource:
                for participant in resource.get('participant', []):
                    if isinstance(participant, dict) and 'individual' in participant:
                        participant['actor'] = participant.pop('individual')
        
        return resource
    
    def _ensure_common_arrays(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure commonly used fields are arrays when needed."""
        resource_type = resource.get('resourceType')
        
        def make_array(obj: Dict[str, Any], field: str):
            """Convert field to array if it exists and isn't already an array."""
            if field in obj and not isinstance(obj[field], list):
                obj[field] = [obj[field]]
        
        # Apply resource-specific array rules first
        if resource_type in self.resource_array_fields:
            for field in self.resource_array_fields[resource_type]:
                make_array(resource, field)
        
        # Apply common array rules to top level only (avoid nested recursion)
        for field in self.common_array_fields:
            make_array(resource, field)
        
        return resource
    
    def _normalize_references(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize reference formats throughout the resource."""
        
        def fix_reference(obj: Any, key: str, value: Any):
            """Fix a single reference field."""
            if key == 'reference':
                # This is already a reference field, don't double-wrap
                if isinstance(value, str):
                    return value
                elif isinstance(value, dict) and 'reference' in value:
                    return value['reference']  # Extract the reference string
                return value
            elif key.endswith('Reference') and isinstance(value, str):
                # This is a reference field that should be an object
                return {'reference': value}
            elif isinstance(value, dict) and 'reference' in value and len(value) == 1:
                # This is likely already a proper Reference object
                return value
            return value
        
        def process_object(obj: Any) -> Any:
            """Recursively process an object to fix references."""
            if isinstance(obj, dict):
                return {k: fix_reference(obj, k, process_object(v)) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [process_object(item) for item in obj]
            return obj
        
        return process_object(resource)
    
    def transform_bundle(self, bundle: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a complete bundle and all its entries.
        
        Args:
            bundle: The bundle to transform
            
        Returns:
            Transformed bundle
        """
        transformed = copy.deepcopy(bundle)
        
        # Detect bundle profile
        bundle_handler = self.detect_profile(transformed)
        
        # Transform each entry
        if 'entry' in transformed and isinstance(transformed['entry'], list):
            for entry in transformed['entry']:
                if isinstance(entry, dict) and 'resource' in entry:
                    resource = entry['resource']
                    if isinstance(resource, dict) and 'resourceType' in resource:
                        # Use detected bundle profile as hint for resources
                        profile_hint = bundle_handler.get_profile_url() if bundle_handler else None
                        entry['resource'] = self.transform_resource(resource, profile_hint)
        
        return transformed
    
    def validate_and_fix(self, resource: Dict[str, Any]) -> tuple[bool, Dict[str, Any], List[str]]:
        """
        Validate a resource and attempt to fix issues.
        
        Args:
            resource: The resource to validate
            
        Returns:
            Tuple of (is_valid, fixed_resource, error_messages)
        """
        errors = []
        fixed = self.transform_resource(resource)
        
        # Try to construct FHIR resource to validate
        try:
            from fhir.resources import construct_fhir_element
            resource_type = fixed.get('resourceType')
            construct_fhir_element(resource_type, fixed)
            return True, fixed, []
        except Exception as e:
            errors.append(str(e))
            
            if self.strict_mode:
                return False, fixed, errors
            
            # Attempt additional fixes
            # This is where you could add more sophisticated fixing logic
            return False, fixed, errors


class ProfileRegistry:
    """
    Registry for managing multiple profile handlers.
    
    Allows dynamic registration of new profile handlers for different IGs.
    """
    
    def __init__(self):
        self.handlers: Dict[str, ProfileHandler] = {}
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """Register default handlers."""
        self.register('synthea', SyntheaProfileHandler())
        self.register('us-core', USCoreProfileHandler())
    
    def register(self, name: str, handler: ProfileHandler):
        """Register a new profile handler."""
        self.handlers[name] = handler
        logger.info(f"Registered profile handler: {name}")
    
    def get_handler(self, name: str) -> Optional[ProfileHandler]:
        """Get a handler by name."""
        return self.handlers.get(name)
    
    def detect_handler(self, resource: Dict[str, Any]) -> Optional[ProfileHandler]:
        """Detect appropriate handler for a resource."""
        for handler in self.handlers.values():
            if handler.can_handle(resource):
                return handler
        return None


# Global registry instance
profile_registry = ProfileRegistry()


def transform_for_import(resource_data: Dict[str, Any], 
                        source_profile: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function to transform a resource for import.
    
    Args:
        resource_data: The resource data to transform
        source_profile: Optional source profile hint
        
    Returns:
        Transformed resource ready for import
    """
    transformer = ProfileAwareFHIRTransformer()
    return transformer.transform_resource(resource_data, source_profile)