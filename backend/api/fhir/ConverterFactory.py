"""
FHIR Converter Factory
Unified factory for accessing FHIR resource converters

This factory provides a unified interface to all existing converter functionality:
- Legacy converter functions from converters.py
- Class-based converters from converter_modules/
- Extended converters for specialized resources

Note: All existing converter files remain unchanged and functional.
This provides an alternative unified interface for converter access.
"""

from typing import Dict, Any, Optional, Union, Type, Callable
from datetime import datetime
import inspect

# Import all legacy converter functions from converters.py
from .converters import (
    patient_to_fhir, encounter_to_fhir, observation_to_fhir,
    condition_to_fhir, medication_request_to_fhir, practitioner_to_fhir,
    organization_to_fhir, location_to_fhir, allergy_intolerance_to_fhir,
    immunization_to_fhir, procedure_to_fhir, diagnostic_report_to_fhir,
    imaging_study_to_fhir, device_to_fhir, care_plan_to_fhir,
    goal_to_fhir, communication_to_fhir, clinical_impression_to_fhir,
    family_member_history_to_fhir, risk_assessment_to_fhir,
    specimen_to_fhir, media_to_fhir, document_reference_to_fhir,
    composition_to_fhir, list_to_fhir, questionnaire_response_to_fhir,
    subscription_to_fhir, binary_to_fhir, bundle_to_fhir,
    medication_to_fhir, medication_administration_to_fhir,
    care_team_to_fhir, practitioner_role_to_fhir, coverage_to_fhir,
    claim_to_fhir, explanation_of_benefit_to_fhir, supply_delivery_to_fhir,
    provenance_to_fhir
)

# Import class-based converters from converter_modules
from .converter_modules.document_reference import DocumentReferenceConverter
from .converter_modules.service_request import ServiceRequestConverter
from .converter_modules.task import TaskConverter
from .converter_modules.appointment import appointment_to_fhir, fhir_to_appointment
from .converter_modules.audit_event import audit_log_to_fhir, create_audit_event
from .converter_modules.person import (
    provider_to_person, create_person_from_user_data, add_authentication_extensions
)
from .converter_modules.practitioner import (
    provider_to_practitioner, create_practitioner_role, add_practitioner_credentials
)
from .converter_modules.generic_converter import GenericConverter
from .converter_modules.helpers import create_reference, create_codeable_concept, create_identifier


class ConverterFactory:
    """
    Unified factory for accessing all FHIR resource converters
    """
    
    def __init__(self):
        self._legacy_converters = {}
        self._class_converters = {}
        self._specialized_converters = {}
        self._converter_cache = {}
        
        # Initialize converter registries
        self._register_legacy_converters()
        self._register_class_converters()
        self._register_specialized_converters()
    
    def _register_legacy_converters(self):
        """Register legacy function-based converters from converters.py"""
        self._legacy_converters = {
            'Patient': patient_to_fhir,
            'Encounter': encounter_to_fhir,
            'Observation': observation_to_fhir,
            'Condition': condition_to_fhir,
            'MedicationRequest': medication_request_to_fhir,
            'Practitioner': practitioner_to_fhir,
            'Organization': organization_to_fhir,
            'Location': location_to_fhir,
            'AllergyIntolerance': allergy_intolerance_to_fhir,
            'Immunization': immunization_to_fhir,
            'Procedure': procedure_to_fhir,
            'DiagnosticReport': diagnostic_report_to_fhir,
            'ImagingStudy': imaging_study_to_fhir,
            'Device': device_to_fhir,
            'CarePlan': care_plan_to_fhir,
            'Goal': goal_to_fhir,
            'Communication': communication_to_fhir,
            'ClinicalImpression': clinical_impression_to_fhir,
            'FamilyMemberHistory': family_member_history_to_fhir,
            'RiskAssessment': risk_assessment_to_fhir,
            'Specimen': specimen_to_fhir,
            'Media': media_to_fhir,
            'DocumentReference': document_reference_to_fhir,
            'Composition': composition_to_fhir,
            'List': list_to_fhir,
            'QuestionnaireResponse': questionnaire_response_to_fhir,
            'Subscription': subscription_to_fhir,
            'Binary': binary_to_fhir,
            'Bundle': bundle_to_fhir,
            'Medication': medication_to_fhir,
            'MedicationAdministration': medication_administration_to_fhir,
            'CareTeam': care_team_to_fhir,
            'PractitionerRole': practitioner_role_to_fhir,
            'Coverage': coverage_to_fhir,
            'Claim': claim_to_fhir,
            'ExplanationOfBenefit': explanation_of_benefit_to_fhir,
            'SupplyDelivery': supply_delivery_to_fhir,
            'Provenance': provenance_to_fhir
        }
    
    def _register_class_converters(self):
        """Register class-based converters from converter_modules"""
        self._class_converters = {
            'DocumentReference': DocumentReferenceConverter,
            'ServiceRequest': ServiceRequestConverter,
            'Task': TaskConverter,
            'Generic': GenericConverter
        }
    
    def _register_specialized_converters(self):
        """Register specialized converter functions"""
        self._specialized_converters = {
            'Appointment': {
                'to_fhir': appointment_to_fhir,
                'from_fhir': fhir_to_appointment
            },
            'AuditEvent': {
                'from_log': audit_log_to_fhir,
                'create': create_audit_event
            },
            'Person': {
                'from_provider': provider_to_person,
                'from_user_data': create_person_from_user_data,
                'add_auth_extensions': add_authentication_extensions
            },
            'PractitionerEnhanced': {
                'from_provider': provider_to_practitioner,
                'create_role': create_practitioner_role,
                'add_credentials': add_practitioner_credentials
            }
        }
    
    def get_converter(self, resource_type: str, converter_type: str = 'auto') -> Union[Callable, object, None]:
        """
        Get converter for specified resource type
        
        Args:
            resource_type: FHIR resource type (e.g., 'Patient', 'Observation')
            converter_type: Type of converter ('legacy', 'class', 'specialized', 'auto')
                          'auto' will try to find the best available converter
        
        Returns:
            Converter function or class instance
        """
        cache_key = f"{resource_type}_{converter_type}"
        
        if cache_key in self._converter_cache:
            return self._converter_cache[cache_key]
        
        converter = None
        
        if converter_type == 'auto':
            converter = self._get_best_converter(resource_type)
        elif converter_type == 'legacy':
            converter = self._legacy_converters.get(resource_type)
        elif converter_type == 'class':
            converter_class = self._class_converters.get(resource_type)
            if converter_class:
                converter = converter_class()
        elif converter_type == 'specialized':
            converter = self._specialized_converters.get(resource_type)
        
        # Cache the result
        if converter:
            self._converter_cache[cache_key] = converter
        
        return converter
    
    def _get_best_converter(self, resource_type: str) -> Union[Callable, object, None]:
        """
        Get the best available converter for resource type
        Priority: class > legacy > specialized
        """
        # First try class-based converters
        if resource_type in self._class_converters:
            converter_class = self._class_converters[resource_type]
            return converter_class()
        
        # Then try legacy converters
        if resource_type in self._legacy_converters:
            return self._legacy_converters[resource_type]
        
        # Finally try specialized converters
        if resource_type in self._specialized_converters:
            return self._specialized_converters[resource_type]
        
        return None
    
    def convert_to_fhir(self, resource_type: str, data: Any, **kwargs) -> Dict[str, Any]:
        """
        Convert data to FHIR resource using the best available converter
        
        Args:
            resource_type: FHIR resource type
            data: Source data to convert
            **kwargs: Additional arguments for converter
        
        Returns:
            FHIR resource as dictionary
        """
        converter = self.get_converter(resource_type)
        
        if not converter:
            raise ValueError(f"No converter found for resource type: {resource_type}")
        
        # Handle different converter types
        if callable(converter):
            # Function-based converter
            return self._call_converter_function(converter, data, **kwargs)
        elif hasattr(converter, 'to_fhir'):
            # Class-based converter with to_fhir method
            return converter.to_fhir(data, **kwargs)
        elif isinstance(converter, dict):
            # Specialized converter dictionary
            if 'to_fhir' in converter:
                return self._call_converter_function(converter['to_fhir'], data, **kwargs)
            else:
                raise ValueError(f"Specialized converter for {resource_type} has no 'to_fhir' method")
        else:
            raise ValueError(f"Unknown converter type for {resource_type}")
    
    def convert_from_fhir(self, resource_type: str, fhir_data: Dict[str, Any], **kwargs) -> Any:
        """
        Convert FHIR resource to internal data format
        
        Args:
            resource_type: FHIR resource type
            fhir_data: FHIR resource data
            **kwargs: Additional arguments for converter
        
        Returns:
            Converted data in internal format
        """
        converter = self.get_converter(resource_type)
        
        if not converter:
            raise ValueError(f"No converter found for resource type: {resource_type}")
        
        # Handle different converter types
        if hasattr(converter, 'from_fhir'):
            # Class-based converter with from_fhir method
            return converter.from_fhir(fhir_data, **kwargs)
        elif isinstance(converter, dict) and 'from_fhir' in converter:
            # Specialized converter with from_fhir function
            return self._call_converter_function(converter['from_fhir'], fhir_data, **kwargs)
        else:
            raise ValueError(f"No 'from_fhir' method available for {resource_type}")
    
    def _call_converter_function(self, converter_func: Callable, data: Any, **kwargs) -> Any:
        """
        Call converter function with appropriate arguments
        """
        # Get function signature to determine how to call it
        sig = inspect.signature(converter_func)
        params = list(sig.parameters.keys())
        
        # Prepare arguments
        args = [data]
        
        # Add keyword arguments that match function parameters
        for param in params[1:]:  # Skip first parameter (data)
            if param in kwargs:
                args.append(kwargs[param])
        
        # Call function with appropriate arguments
        if len(args) == 1 and not kwargs:
            return converter_func(data)
        else:
            return converter_func(*args, **{k: v for k, v in kwargs.items() if k in params})
    
    def list_available_converters(self) -> Dict[str, Dict[str, Any]]:
        """
        List all available converters by type
        
        Returns:
            Dictionary of converter types and their available resource types
        """
        return {
            'legacy': {
                'resource_types': list(self._legacy_converters.keys()),
                'description': 'Function-based converters from converters.py',
                'capabilities': ['to_fhir']
            },
            'class': {
                'resource_types': list(self._class_converters.keys()),
                'description': 'Class-based converters from converter_modules/',
                'capabilities': ['to_fhir', 'from_fhir']
            },
            'specialized': {
                'resource_types': list(self._specialized_converters.keys()),
                'description': 'Specialized converter functions',
                'capabilities': 'varies'
            }
        }
    
    def get_converter_info(self, resource_type: str) -> Dict[str, Any]:
        """
        Get information about available converters for a resource type
        
        Args:
            resource_type: FHIR resource type
        
        Returns:
            Dictionary with converter information
        """
        info = {
            'resource_type': resource_type,
            'available_converters': [],
            'recommended': None,
            'capabilities': []
        }
        
        # Check legacy converters
        if resource_type in self._legacy_converters:
            info['available_converters'].append({
                'type': 'legacy',
                'description': 'Function-based converter',
                'capabilities': ['to_fhir']
            })
        
        # Check class converters
        if resource_type in self._class_converters:
            info['available_converters'].append({
                'type': 'class',
                'description': 'Class-based converter',
                'capabilities': ['to_fhir', 'from_fhir']
            })
            info['recommended'] = 'class'
        
        # Check specialized converters
        if resource_type in self._specialized_converters:
            specialized = self._specialized_converters[resource_type]
            capabilities = list(specialized.keys())
            info['available_converters'].append({
                'type': 'specialized',
                'description': 'Specialized converter functions',
                'capabilities': capabilities
            })
        
        # Set recommended if not already set
        if not info['recommended'] and info['available_converters']:
            info['recommended'] = info['available_converters'][0]['type']
        
        return info
    
    def validate_converter_compatibility(self, resource_type: str, operation: str) -> bool:
        """
        Validate if a converter supports a specific operation
        
        Args:
            resource_type: FHIR resource type
            operation: Operation name ('to_fhir', 'from_fhir', etc.)
        
        Returns:
            True if operation is supported, False otherwise
        """
        converter = self.get_converter(resource_type)
        
        if not converter:
            return False
        
        if callable(converter) and operation == 'to_fhir':
            return True
        elif hasattr(converter, operation):
            return True
        elif isinstance(converter, dict) and operation in converter:
            return True
        
        return False


class ConverterRegistry:
    """
    Registry for managing custom converters
    """
    
    def __init__(self):
        self._custom_converters = {}
    
    def register_converter(self, resource_type: str, converter: Union[Callable, object], 
                          converter_type: str = 'custom'):
        """
        Register a custom converter
        
        Args:
            resource_type: FHIR resource type
            converter: Converter function or class
            converter_type: Type of converter
        """
        if resource_type not in self._custom_converters:
            self._custom_converters[resource_type] = {}
        
        self._custom_converters[resource_type][converter_type] = converter
    
    def get_custom_converter(self, resource_type: str, converter_type: str = 'custom'):
        """
        Get a registered custom converter
        """
        return self._custom_converters.get(resource_type, {}).get(converter_type)
    
    def list_custom_converters(self) -> Dict[str, Any]:
        """
        List all registered custom converters
        """
        return self._custom_converters


# Singleton instances
converter_factory = ConverterFactory()
converter_registry = ConverterRegistry()


# Convenience functions for backwards compatibility
def get_converter(resource_type: str, converter_type: str = 'auto'):
    """Get converter for resource type"""
    return converter_factory.get_converter(resource_type, converter_type)


def convert_to_fhir(resource_type: str, data: Any, **kwargs) -> Dict[str, Any]:
    """Convert data to FHIR resource"""
    return converter_factory.convert_to_fhir(resource_type, data, **kwargs)


def convert_from_fhir(resource_type: str, fhir_data: Dict[str, Any], **kwargs) -> Any:
    """Convert FHIR resource to internal format"""
    return converter_factory.convert_from_fhir(resource_type, fhir_data, **kwargs)


def list_converters() -> Dict[str, Dict[str, Any]]:
    """List all available converters"""
    return converter_factory.list_available_converters()


# Export main classes and functions
__all__ = [
    'ConverterFactory',
    'ConverterRegistry',
    'converter_factory',
    'converter_registry',
    'get_converter',
    'convert_to_fhir',
    'convert_from_fhir',
    'list_converters'
]