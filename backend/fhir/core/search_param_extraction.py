"""
FHIR Search Parameter Extraction Module

This module provides a centralized, comprehensive implementation of search parameter
extraction for all FHIR R4 resource types. It consolidates logic from multiple
scripts to ensure consistency and completeness.

Created: 2025-01-19
"""

from datetime import datetime
from typing import Dict, List, Any, Optional, Union
import logging

logger = logging.getLogger(__name__)

class SearchParameterExtractor:
    """
    Centralized search parameter extraction for FHIR resources.
    
    This class provides comprehensive extraction logic for all supported
    FHIR R4 resource types, ensuring consistent parameter indexing across
    the application.
    """
    
    # URN to resource mapping cache (populated during import)
    _urn_to_resource_map = {}
    
    @classmethod
    def set_urn_mapping(cls, urn_map: Dict[str, str]):
        """Set the URN to resource ID mapping for reference resolution."""
        cls._urn_to_resource_map = urn_map
    
    @classmethod
    def resolve_reference(cls, reference: str) -> str:
        """
        Resolve a reference, converting URNs to proper FHIR references.
        
        Args:
            reference: The reference string (e.g., 'Patient/123' or 'urn:uuid:abc')
            
        Returns:
            Resolved reference (e.g., 'Patient/123')
        """
        if not reference:
            return reference
            
        # If it's already a proper reference, return as-is
        if not reference.startswith('urn:'):
            return reference
            
        # Extract UUID from URN
        if reference.startswith('urn:uuid:'):
            uuid = reference[9:]  # Remove 'urn:uuid:' prefix
            
            # Check our URN mapping cache first
            if uuid in cls._urn_to_resource_map:
                return cls._urn_to_resource_map[uuid]
            
            # If not in cache, try to determine resource type from context
            # For now, assume Patient if we can't determine otherwise
            # This could be enhanced with more sophisticated logic
            return f"Patient/{uuid}"
        
        return reference
    
    @staticmethod
    def _extract_reference_param(resource_data: Dict[str, Any], field_path: str, 
                               param_name: str, params: List[Dict[str, Any]]):
        """
        Extract a reference parameter from a resource, resolving URNs.
        
        Args:
            resource_data: The resource data
            field_path: Dot-separated path to the field (e.g., 'subject' or 'patient')
            param_name: The search parameter name
            params: List to append parameters to
        """
        # Navigate to the field
        field_parts = field_path.split('.')
        current = resource_data
        
        for part in field_parts:
            if not isinstance(current, dict) or part not in current:
                return
            current = current[part]
        
        # Extract reference
        if isinstance(current, dict) and 'reference' in current:
            ref = SearchParameterExtractor.resolve_reference(current['reference'])
            params.append({
                'param_name': param_name,
                'param_type': 'reference',
                'value_reference': ref
            })
    
    @staticmethod
    def extract_parameters(resource_type: str, resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract search parameters from a FHIR resource.
        
        Args:
            resource_type: The FHIR resource type
            resource_data: The resource data as a dictionary
            
        Returns:
            List of search parameter dictionaries
        """
        params = []
        
        # Common parameters for all resources
        params.extend(SearchParameterExtractor._extract_common_params(resource_data))
        
        # Resource-specific parameters
        extractor_method = getattr(
            SearchParameterExtractor,
            f'_extract_{resource_type.lower()}_params',
            None
        )
        
        if extractor_method:
            try:
                specific_params = extractor_method(resource_data)
                params.extend(specific_params)
            except Exception as e:
                logger.error(f"Error extracting {resource_type} parameters: {e}")
        else:
            logger.warning(f"No specific extractor for resource type: {resource_type}")
        
        return params
    
    @staticmethod
    def _extract_common_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract common parameters that apply to all resources."""
        params = []
        
        # _id parameter
        if 'id' in resource_data:
            params.append({
                'param_name': '_id',
                'param_type': 'token',
                'value_token_code': resource_data['id']
            })
        
        # _lastUpdated parameter
        if 'meta' in resource_data and 'lastUpdated' in resource_data['meta']:
            try:
                last_updated = datetime.fromisoformat(
                    resource_data['meta']['lastUpdated'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': '_lastUpdated',
                    'param_type': 'date',
                    'value_date': last_updated
                })
            except Exception as e:
                logger.warning(f"Failed to parse lastUpdated: {e}")
        
        # _tag parameters
        if 'meta' in resource_data and 'tag' in resource_data['meta']:
            for tag in resource_data['meta']['tag']:
                if 'code' in tag:
                    params.append({
                        'param_name': '_tag',
                        'param_type': 'token',
                        'value_token_system': tag.get('system'),
                        'value_token_code': tag['code']
                    })
        
        # _profile parameters
        if 'meta' in resource_data and 'profile' in resource_data['meta']:
            for profile in resource_data['meta']['profile']:
                params.append({
                    'param_name': '_profile',
                    'param_type': 'reference',
                    'value_reference': profile
                })
        
        return params
    
    @staticmethod
    def _extract_patient_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Patient-specific search parameters according to FHIR R4 spec."""
        params = []
        
        # identifier - Token search on patient identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # name - String search on any part of the name
        # family - String search on family name
        # given - String search on given name(s)
        if 'name' in resource_data:
            for name in resource_data['name']:
                # Build full name for general search
                name_parts = []
                if 'given' in name:
                    name_parts.extend(name['given'])
                if 'family' in name:
                    name_parts.append(name['family'])
                
                if name_parts:
                    full_name = ' '.join(name_parts)
                    params.append({
                        'param_name': 'name',
                        'param_type': 'string',
                        'value_string': full_name.lower()
                    })
                
                # Individual name components
                if 'family' in name:
                    params.append({
                        'param_name': 'family',
                        'param_type': 'string',
                        'value_string': name['family'].lower()
                    })
                
                if 'given' in name:
                    for given in name['given']:
                        params.append({
                            'param_name': 'given',
                            'param_type': 'string',
                            'value_string': given.lower()
                        })
        
        # gender - Token search on administrative gender (with proper system)
        if 'gender' in resource_data:
            params.append({
                'param_name': 'gender',
                'param_type': 'token',
                'value_token_system': 'http://hl7.org/fhir/administrative-gender',
                'value_token_code': resource_data['gender']
            })
        
        # birthdate - Date search on date of birth
        if 'birthDate' in resource_data:
            try:
                birth_date = datetime.strptime(resource_data['birthDate'], '%Y-%m-%d')
                params.append({
                    'param_name': 'birthdate',
                    'param_type': 'date',
                    'value_date': birth_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse birthDate: {e}")
        
        # deceased - Token search on deceased status
        if 'deceasedBoolean' in resource_data:
            params.append({
                'param_name': 'deceased',
                'param_type': 'token',
                'value_token_code': 'true' if resource_data['deceasedBoolean'] else 'false'
            })
        elif 'deceasedDateTime' in resource_data:
            params.append({
                'param_name': 'deceased',
                'param_type': 'token',
                'value_token_code': 'true'
            })
            # Also index death-date
            try:
                death_date = datetime.fromisoformat(
                    resource_data['deceasedDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'death-date',
                    'param_type': 'date',
                    'value_date': death_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse deceasedDateTime: {e}")
        
        # address - String search on any address part
        # address-city, address-state, address-postalcode, address-country
        if 'address' in resource_data:
            for address in resource_data['address']:
                # Full address text
                address_parts = []
                for field in ['line', 'city', 'state', 'postalCode', 'country']:
                    if field == 'line' and field in address:
                        address_parts.extend(address['line'])
                    elif field in address:
                        address_parts.append(address[field])
                
                if address_parts:
                    full_address = ' '.join(address_parts)
                    params.append({
                        'param_name': 'address',
                        'param_type': 'string',
                        'value_string': full_address.lower()
                    })
                
                # Individual address components
                if 'city' in address:
                    params.append({
                        'param_name': 'address-city',
                        'param_type': 'string',
                        'value_string': address['city'].lower()
                    })
                
                if 'state' in address:
                    params.append({
                        'param_name': 'address-state',
                        'param_type': 'string',
                        'value_string': address['state'].lower()
                    })
                
                if 'postalCode' in address:
                    params.append({
                        'param_name': 'address-postalcode',
                        'param_type': 'string',
                        'value_string': address['postalCode'].lower()
                    })
                
                if 'country' in address:
                    params.append({
                        'param_name': 'address-country',
                        'param_type': 'string',
                        'value_string': address['country'].lower()
                    })
        
        # telecom - Token search on contact details
        # phone - Token search specifically for phone numbers
        if 'telecom' in resource_data:
            for telecom in resource_data['telecom']:
                if 'value' in telecom:
                    params.append({
                        'param_name': 'telecom',
                        'param_type': 'token',
                        'value_token_system': telecom.get('system'),
                        'value_token_code': telecom['value']
                    })
                    
                    # Also index as phone if it's a phone number
                    if telecom.get('system') == 'phone':
                        params.append({
                            'param_name': 'phone',
                            'param_type': 'token',
                            'value_token_code': telecom['value']
                        })
        
        # language - Token search on language
        if 'communication' in resource_data:
            for comm in resource_data['communication']:
                if 'language' in comm and 'coding' in comm['language']:
                    for coding in comm['language']['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'language',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # general-practitioner - Reference to the patient's primary care provider
        if 'generalPractitioner' in resource_data:
            for gp in resource_data['generalPractitioner']:
                if 'reference' in gp:
                    params.append({
                        'param_name': 'general-practitioner',
                        'param_type': 'reference',
                        'value_reference': gp['reference']
                    })
        
        # organization - Managing organization
        if 'managingOrganization' in resource_data and 'reference' in resource_data['managingOrganization']:
            params.append({
                'param_name': 'organization',
                'param_type': 'reference',
                'value_reference': resource_data['managingOrganization']['reference']
            })
        
        # active - Whether the patient record is active
        if 'active' in resource_data:
            params.append({
                'param_name': 'active',
                'param_type': 'token',
                'value_token_code': 'true' if resource_data['active'] else 'false'
            })
        
        return params
    
    @staticmethod
    def _extract_practitioner_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Practitioner-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # name, family, given
        if 'name' in resource_data:
            for name in resource_data['name']:
                # Full name
                name_parts = []
                if 'given' in name:
                    name_parts.extend(name['given'])
                if 'family' in name:
                    name_parts.append(name['family'])
                
                if name_parts:
                    full_name = ' '.join(name_parts)
                    params.append({
                        'param_name': 'name',
                        'param_type': 'string',
                        'value_string': full_name.lower()
                    })
                
                # Family name
                if 'family' in name:
                    params.append({
                        'param_name': 'family',
                        'param_type': 'string',
                        'value_string': name['family'].lower()
                    })
                
                # Given names
                if 'given' in name:
                    for given in name['given']:
                        params.append({
                            'param_name': 'given',
                            'param_type': 'string',
                            'value_string': given.lower()
                        })
        
        # gender
        if 'gender' in resource_data:
            params.append({
                'param_name': 'gender',
                'param_type': 'token',
                'value_token_system': 'http://hl7.org/fhir/administrative-gender',
                'value_token_code': resource_data['gender']
            })
        
        # active
        if 'active' in resource_data:
            params.append({
                'param_name': 'active',
                'param_type': 'token',
                'value_token_code': 'true' if resource_data['active'] else 'false'
            })
        
        # communication
        if 'communication' in resource_data:
            for comm in resource_data['communication']:
                if 'coding' in comm:
                    for coding in comm['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'communication',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        return params
    
    @staticmethod
    def _extract_organization_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Organization-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # name
        if 'name' in resource_data:
            params.append({
                'param_name': 'name',
                'param_type': 'string',
                'value_string': resource_data['name'].lower()
            })
        
        # active
        if 'active' in resource_data:
            params.append({
                'param_name': 'active',
                'param_type': 'token',
                'value_token_code': 'true' if resource_data['active'] else 'false'
            })
        
        # type
        if 'type' in resource_data:
            for type_concept in resource_data['type']:
                if 'coding' in type_concept:
                    for coding in type_concept['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'type',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # address
        if 'address' in resource_data:
            for address in resource_data['address']:
                # Full address
                address_parts = []
                for field in ['line', 'city', 'state', 'postalCode', 'country']:
                    if field == 'line' and field in address:
                        address_parts.extend(address['line'])
                    elif field in address:
                        address_parts.append(address[field])
                
                if address_parts:
                    full_address = ' '.join(address_parts)
                    params.append({
                        'param_name': 'address',
                        'param_type': 'string',
                        'value_string': full_address.lower()
                    })
        
        # partof
        if 'partOf' in resource_data and 'reference' in resource_data['partOf']:
            params.append({
                'param_name': 'partof',
                'param_type': 'reference',
                'value_reference': resource_data['partOf']['reference']
            })
        
        return params
    
    @staticmethod
    def _extract_observation_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Observation-specific search parameters."""
        params = []
        
        # code
        if 'code' in resource_data and 'coding' in resource_data['code']:
            for coding in resource_data['code']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # category
        if 'category' in resource_data:
            for category in resource_data['category']:
                if 'coding' in category:
                    for coding in category['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'category',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            # Also add as patient if it's a patient reference
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # performer
        if 'performer' in resource_data:
            for performer in resource_data['performer']:
                if 'reference' in performer:
                    params.append({
                        'param_name': 'performer',
                        'param_type': 'reference',
                        'value_reference': performer['reference']
                    })
        
        # date (effectiveDateTime or effectivePeriod)
        if 'effectiveDateTime' in resource_data:
            try:
                effective_date = datetime.fromisoformat(
                    resource_data['effectiveDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': effective_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse effectiveDateTime: {e}")
        elif 'effectivePeriod' in resource_data and 'start' in resource_data['effectivePeriod']:
            try:
                effective_date = datetime.fromisoformat(
                    resource_data['effectivePeriod']['start'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': effective_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse effectivePeriod.start: {e}")
        
        # value-quantity (for numeric observations)
        if 'valueQuantity' in resource_data:
            value_qty = resource_data['valueQuantity']
            if 'value' in value_qty:
                params.append({
                    'param_name': 'value-quantity',
                    'param_type': 'quantity',
                    'value_quantity_value': float(value_qty['value']),
                    'value_quantity_unit': value_qty.get('unit')
                })
        
        # value-concept (for coded observations)
        if 'valueCodeableConcept' in resource_data and 'coding' in resource_data['valueCodeableConcept']:
            for coding in resource_data['valueCodeableConcept']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'value-concept',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # component-code (for multi-component observations like blood pressure)
        if 'component' in resource_data:
            for component in resource_data['component']:
                if 'code' in component and 'coding' in component['code']:
                    for coding in component['code']['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'component-code',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
                
                # component-value-quantity
                if 'valueQuantity' in component:
                    value_qty = component['valueQuantity']
                    if 'value' in value_qty:
                        params.append({
                            'param_name': 'component-value-quantity',
                            'param_type': 'quantity',
                            'value_quantity_value': float(value_qty['value']),
                            'value_quantity_unit': value_qty.get('unit')
                        })
        
        return params
    
    @staticmethod
    def _extract_condition_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Condition-specific search parameters."""
        params = []
        
        # code
        if 'code' in resource_data and 'coding' in resource_data['code']:
            for coding in resource_data['code']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # clinical-status
        if 'clinicalStatus' in resource_data and 'coding' in resource_data['clinicalStatus']:
            for coding in resource_data['clinicalStatus']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'clinical-status',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # verification-status
        if 'verificationStatus' in resource_data and 'coding' in resource_data['verificationStatus']:
            for coding in resource_data['verificationStatus']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'verification-status',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # category
        if 'category' in resource_data:
            for category in resource_data['category']:
                if 'coding' in category:
                    for coding in category['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'category',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # severity
        if 'severity' in resource_data and 'coding' in resource_data['severity']:
            for coding in resource_data['severity']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'severity',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # onset-date
        if 'onsetDateTime' in resource_data:
            try:
                onset_date = datetime.fromisoformat(
                    resource_data['onsetDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'onset-date',
                    'param_type': 'date',
                    'value_date': onset_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse onsetDateTime: {e}")
        elif 'onsetPeriod' in resource_data and 'start' in resource_data['onsetPeriod']:
            try:
                onset_date = datetime.fromisoformat(
                    resource_data['onsetPeriod']['start'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'onset-date',
                    'param_type': 'date',
                    'value_date': onset_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse onsetPeriod.start: {e}")
        
        # recorded-date
        if 'recordedDate' in resource_data:
            try:
                recorded_date = datetime.fromisoformat(
                    resource_data['recordedDate'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'recorded-date',
                    'param_type': 'date',
                    'value_date': recorded_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse recordedDate: {e}")
        
        return params
    
    @staticmethod
    def _extract_medicationrequest_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract MedicationRequest-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # intent
        if 'intent' in resource_data:
            params.append({
                'param_name': 'intent',
                'param_type': 'token',
                'value_token_code': resource_data['intent']
            })
        
        # priority
        if 'priority' in resource_data:
            params.append({
                'param_name': 'priority',
                'param_type': 'token',
                'value_token_code': resource_data['priority']
            })
        
        # code (medication code)
        if 'medicationCodeableConcept' in resource_data and 'coding' in resource_data['medicationCodeableConcept']:
            for coding in resource_data['medicationCodeableConcept']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # medication (reference)
        if 'medicationReference' in resource_data and 'reference' in resource_data['medicationReference']:
            params.append({
                'param_name': 'medication',
                'param_type': 'reference',
                'value_reference': resource_data['medicationReference']['reference']
            })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # requester
        if 'requester' in resource_data and 'reference' in resource_data['requester']:
            params.append({
                'param_name': 'requester',
                'param_type': 'reference',
                'value_reference': resource_data['requester']['reference']
            })
        
        # authoredon
        if 'authoredOn' in resource_data:
            try:
                authored_date = datetime.fromisoformat(
                    resource_data['authoredOn'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'authoredon',
                    'param_type': 'date',
                    'value_date': authored_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse authoredOn: {e}")
        
        # intended-performer
        if 'performer' in resource_data and 'reference' in resource_data['performer']:
            params.append({
                'param_name': 'intended-performer',
                'param_type': 'reference',
                'value_reference': resource_data['performer']['reference']
            })
        
        # intended-dispenser
        if 'dispenseRequest' in resource_data and 'performer' in resource_data['dispenseRequest']:
            if 'reference' in resource_data['dispenseRequest']['performer']:
                params.append({
                    'param_name': 'intended-dispenser',
                    'param_type': 'reference',
                    'value_reference': resource_data['dispenseRequest']['performer']['reference']
                })
        
        return params
    
    @staticmethod
    def _extract_encounter_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Encounter-specific search parameters."""
        params = []
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # class
        if 'class' in resource_data:
            # Handle both simple coding and list of codings
            class_data = resource_data['class']
            if isinstance(class_data, dict):
                # Simple coding object
                if 'code' in class_data:
                    params.append({
                        'param_name': 'class',
                        'param_type': 'token',
                        'value_token_system': class_data.get('system'),
                        'value_token_code': class_data['code']
                    })
            elif isinstance(class_data, list):
                # List of coding objects
                for coding in class_data:
                    if isinstance(coding, dict) and 'code' in coding:
                        params.append({
                            'param_name': 'class',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
        
        # type
        if 'type' in resource_data:
            for type_concept in resource_data['type']:
                if 'coding' in type_concept:
                    for coding in type_concept['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'type',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # service-type
        if 'serviceType' in resource_data and 'coding' in resource_data['serviceType']:
            for coding in resource_data['serviceType']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'service-type',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # participant
        if 'participant' in resource_data:
            for participant in resource_data['participant']:
                if 'individual' in participant and 'reference' in participant['individual']:
                    params.append({
                        'param_name': 'participant',
                        'param_type': 'reference',
                        'value_reference': participant['individual']['reference']
                    })
        
        # practitioner (from participants)
        if 'participant' in resource_data:
            for participant in resource_data['participant']:
                if 'individual' in participant and 'reference' in participant['individual']:
                    ref = participant['individual']['reference']
                    if 'Practitioner/' in ref:
                        params.append({
                            'param_name': 'practitioner',
                            'param_type': 'reference',
                            'value_reference': ref
                        })
        
        # date/period
        if 'period' in resource_data:
            if 'start' in resource_data['period']:
                try:
                    period_start = datetime.fromisoformat(
                        resource_data['period']['start'].replace('Z', '+00:00')
                    )
                    params.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': period_start
                    })
                except Exception as e:
                    logger.warning(f"Failed to parse period.start: {e}")
        
        # location
        if 'location' in resource_data:
            for location in resource_data['location']:
                if 'location' in location and 'reference' in location['location']:
                    params.append({
                        'param_name': 'location',
                        'param_type': 'reference',
                        'value_reference': location['location']['reference']
                    })
        
        # service-provider
        if 'serviceProvider' in resource_data and 'reference' in resource_data['serviceProvider']:
            params.append({
                'param_name': 'service-provider',
                'param_type': 'reference',
                'value_reference': resource_data['serviceProvider']['reference']
            })
        
        # reason-code
        if 'reasonCode' in resource_data:
            for reason_concept in resource_data['reasonCode']:
                if 'coding' in reason_concept:
                    for coding in reason_concept['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'reason-code',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # diagnosis
        if 'diagnosis' in resource_data:
            for diagnosis in resource_data['diagnosis']:
                if 'condition' in diagnosis and 'reference' in diagnosis['condition']:
                    params.append({
                        'param_name': 'diagnosis',
                        'param_type': 'reference',
                        'value_reference': diagnosis['condition']['reference']
                    })
        
        return params
    
    @staticmethod
    def _extract_procedure_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Procedure-specific search parameters."""
        params = []
        
        # code
        if 'code' in resource_data and 'coding' in resource_data['code']:
            for coding in resource_data['code']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # category
        if 'category' in resource_data and 'coding' in resource_data['category']:
            for coding in resource_data['category']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'category',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # performer
        if 'performer' in resource_data:
            for performer in resource_data['performer']:
                if 'actor' in performer and 'reference' in performer['actor']:
                    params.append({
                        'param_name': 'performer',
                        'param_type': 'reference',
                        'value_reference': performer['actor']['reference']
                    })
        
        # date (performedDateTime or performedPeriod)
        if 'performedDateTime' in resource_data:
            try:
                performed_date = datetime.fromisoformat(
                    resource_data['performedDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': performed_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse performedDateTime: {e}")
        elif 'performedPeriod' in resource_data and 'start' in resource_data['performedPeriod']:
            try:
                performed_date = datetime.fromisoformat(
                    resource_data['performedPeriod']['start'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': performed_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse performedPeriod.start: {e}")
        
        return params
    
    @staticmethod
    def _extract_allergyintolerance_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract AllergyIntolerance-specific search parameters."""
        params = []
        
        # code
        if 'code' in resource_data and 'coding' in resource_data['code']:
            for coding in resource_data['code']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # clinical-status
        if 'clinicalStatus' in resource_data and 'coding' in resource_data['clinicalStatus']:
            for coding in resource_data['clinicalStatus']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'clinical-status',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # verification-status
        if 'verificationStatus' in resource_data and 'coding' in resource_data['verificationStatus']:
            for coding in resource_data['verificationStatus']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'verification-status',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # type
        if 'type' in resource_data:
            params.append({
                'param_name': 'type',
                'param_type': 'token',
                'value_token_code': resource_data['type']
            })
        
        # category
        if 'category' in resource_data:
            for category in resource_data['category']:
                # In FHIR R4, AllergyIntolerance.category is just an array of codes (strings)
                if isinstance(category, str):
                    params.append({
                        'param_name': 'category',
                        'param_type': 'token',
                        'value_token_code': category
                    })
        
        # criticality
        if 'criticality' in resource_data:
            params.append({
                'param_name': 'criticality',
                'param_type': 'token',
                'value_token_code': resource_data['criticality']
            })
        
        # patient (note: uses 'patient' not 'subject' for AllergyIntolerance)
        if 'patient' in resource_data and 'reference' in resource_data['patient']:
            ref = SearchParameterExtractor.resolve_reference(resource_data['patient']['reference'])
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': ref
            })
        
        # date (recordedDate)
        if 'recordedDate' in resource_data:
            try:
                recorded_date = datetime.fromisoformat(
                    resource_data['recordedDate'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': recorded_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse recordedDate: {e}")
        
        # onset
        if 'onsetDateTime' in resource_data:
            try:
                onset_date = datetime.fromisoformat(
                    resource_data['onsetDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'onset',
                    'param_type': 'date',
                    'value_date': onset_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse onsetDateTime: {e}")
        
        return params
    
    @staticmethod
    def _extract_immunization_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Immunization-specific search parameters."""
        params = []
        
        # vaccine-code
        if 'vaccineCode' in resource_data and 'coding' in resource_data['vaccineCode']:
            for coding in resource_data['vaccineCode']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'vaccine-code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # status-reason
        if 'statusReason' in resource_data and 'coding' in resource_data['statusReason']:
            for coding in resource_data['statusReason']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'status-reason',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # patient
        if 'patient' in resource_data and 'reference' in resource_data['patient']:
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': resource_data['patient']['reference']
            })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # performer
        if 'performer' in resource_data:
            for performer in resource_data['performer']:
                if 'actor' in performer and 'reference' in performer['actor']:
                    params.append({
                        'param_name': 'performer',
                        'param_type': 'reference',
                        'value_reference': performer['actor']['reference']
                    })
        
        # date (occurrenceDateTime)
        if 'occurrenceDateTime' in resource_data:
            try:
                occurrence_date = datetime.fromisoformat(
                    resource_data['occurrenceDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': occurrence_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse occurrenceDateTime: {e}")
        
        # reaction
        if 'reaction' in resource_data:
            for reaction in resource_data['reaction']:
                if 'detail' in reaction and 'reference' in reaction['detail']:
                    params.append({
                        'param_name': 'reaction',
                        'param_type': 'reference',
                        'value_reference': reaction['detail']['reference']
                    })
        
        # lot-number
        if 'lotNumber' in resource_data:
            params.append({
                'param_name': 'lot-number',
                'param_type': 'string',
                'value_string': resource_data['lotNumber'].lower()
            })
        
        return params
    
    @staticmethod
    def _extract_diagnosticreport_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract DiagnosticReport-specific search parameters."""
        params = []
        
        # code
        if 'code' in resource_data and 'coding' in resource_data['code']:
            for coding in resource_data['code']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # category
        if 'category' in resource_data:
            for category in resource_data['category']:
                if 'coding' in category:
                    for coding in category['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'category',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # performer
        if 'performer' in resource_data:
            for performer in resource_data['performer']:
                if 'reference' in performer:
                    params.append({
                        'param_name': 'performer',
                        'param_type': 'reference',
                        'value_reference': performer['reference']
                    })
        
        # result
        if 'result' in resource_data:
            for result in resource_data['result']:
                if 'reference' in result:
                    params.append({
                        'param_name': 'result',
                        'param_type': 'reference',
                        'value_reference': result['reference']
                    })
        
        # issued
        if 'issued' in resource_data:
            try:
                issued_date = datetime.fromisoformat(
                    resource_data['issued'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'issued',
                    'param_type': 'date',
                    'value_date': issued_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse issued: {e}")
        
        # date (effectiveDateTime or effectivePeriod)
        if 'effectiveDateTime' in resource_data:
            try:
                effective_date = datetime.fromisoformat(
                    resource_data['effectiveDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': effective_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse effectiveDateTime: {e}")
        elif 'effectivePeriod' in resource_data and 'start' in resource_data['effectivePeriod']:
            try:
                effective_date = datetime.fromisoformat(
                    resource_data['effectivePeriod']['start'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': effective_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse effectivePeriod.start: {e}")
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        return params
    
    @staticmethod
    def _extract_imagingstudy_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract ImagingStudy-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # modality
        if 'modality' in resource_data:
            for modality in resource_data['modality']:
                if 'code' in modality:
                    params.append({
                        'param_name': 'modality',
                        'param_type': 'token',
                        'value_token_system': modality.get('system'),
                        'value_token_code': modality['code']
                    })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # started
        if 'started' in resource_data:
            try:
                started_date = datetime.fromisoformat(
                    resource_data['started'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'started',
                    'param_type': 'date',
                    'value_date': started_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse started: {e}")
        
        # performer
        if 'performer' in resource_data:
            for performer in resource_data['performer']:
                if 'actor' in performer and 'reference' in performer['actor']:
                    params.append({
                        'param_name': 'performer',
                        'param_type': 'reference',
                        'value_reference': performer['actor']['reference']
                    })
        
        # basedon (referrer)
        if 'basedOn' in resource_data:
            for based_on in resource_data['basedOn']:
                if 'reference' in based_on:
                    params.append({
                        'param_name': 'basedon',
                        'param_type': 'reference',
                        'value_reference': based_on['reference']
                    })
        
        # endpoint
        if 'endpoint' in resource_data:
            for endpoint in resource_data['endpoint']:
                if 'reference' in endpoint:
                    params.append({
                        'param_name': 'endpoint',
                        'param_type': 'reference',
                        'value_reference': endpoint['reference']
                    })
        
        # bodysite
        if 'series' in resource_data:
            for series in resource_data['series']:
                if 'bodySite' in series and 'code' in series['bodySite']:
                    params.append({
                        'param_name': 'bodysite',
                        'param_type': 'token',
                        'value_token_system': series['bodySite'].get('system'),
                        'value_token_code': series['bodySite']['code']
                    })
        
        # instance (DICOM Study Instance UID)
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if identifier.get('system') == 'urn:dicom:uid' and identifier.get('value', '').startswith('urn:oid:'):
                    params.append({
                        'param_name': 'instance',
                        'param_type': 'token',
                        'value_token_system': 'urn:dicom:uid',
                        'value_token_code': identifier['value']
                    })
        
        return params
    
    @staticmethod
    def _extract_careplan_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract CarePlan-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # intent
        if 'intent' in resource_data:
            params.append({
                'param_name': 'intent',
                'param_type': 'token',
                'value_token_code': resource_data['intent']
            })
        
        # category
        if 'category' in resource_data:
            for category in resource_data['category']:
                if 'coding' in category:
                    for coding in category['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'category',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # date (period)
        if 'period' in resource_data and 'start' in resource_data['period']:
            try:
                period_start = datetime.fromisoformat(
                    resource_data['period']['start'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': period_start
                })
            except Exception as e:
                logger.warning(f"Failed to parse period.start: {e}")
        
        # author
        if 'author' in resource_data and 'reference' in resource_data['author']:
            params.append({
                'param_name': 'author',
                'param_type': 'reference',
                'value_reference': resource_data['author']['reference']
            })
        
        # care-team
        if 'careTeam' in resource_data:
            for care_team in resource_data['careTeam']:
                if 'reference' in care_team:
                    params.append({
                        'param_name': 'care-team',
                        'param_type': 'reference',
                        'value_reference': care_team['reference']
                    })
        
        # activity-code
        if 'activity' in resource_data:
            for activity in resource_data['activity']:
                if 'detail' in activity and 'code' in activity['detail'] and 'coding' in activity['detail']['code']:
                    for coding in activity['detail']['code']['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'activity-code',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # goal
        if 'goal' in resource_data:
            for goal in resource_data['goal']:
                if 'reference' in goal:
                    params.append({
                        'param_name': 'goal',
                        'param_type': 'reference',
                        'value_reference': goal['reference']
                    })
        
        return params
    
    @staticmethod
    def _extract_goal_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Goal-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # lifecycle-status
        if 'lifecycleStatus' in resource_data:
            params.append({
                'param_name': 'lifecycle-status',
                'param_type': 'token',
                'value_token_code': resource_data['lifecycleStatus']
            })
        
        # achievement-status
        if 'achievementStatus' in resource_data and 'coding' in resource_data['achievementStatus']:
            for coding in resource_data['achievementStatus']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'achievement-status',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # category
        if 'category' in resource_data:
            for category in resource_data['category']:
                if 'coding' in category:
                    for coding in category['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'category',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # start-date
        if 'startDate' in resource_data:
            try:
                start_date = datetime.strptime(resource_data['startDate'], '%Y-%m-%d')
                params.append({
                    'param_name': 'start-date',
                    'param_type': 'date',
                    'value_date': start_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse startDate: {e}")
        
        # target-date
        if 'target' in resource_data:
            for target in resource_data['target']:
                if 'dueDate' in target:
                    try:
                        target_date = datetime.strptime(target['dueDate'], '%Y-%m-%d')
                        params.append({
                            'param_name': 'target-date',
                            'param_type': 'date',
                            'value_date': target_date
                        })
                    except Exception as e:
                        logger.warning(f"Failed to parse target dueDate: {e}")
        
        return params
    
    @staticmethod
    def _extract_task_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Task-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # intent
        if 'intent' in resource_data:
            params.append({
                'param_name': 'intent',
                'param_type': 'token',
                'value_token_code': resource_data['intent']
            })
        
        # priority
        if 'priority' in resource_data:
            params.append({
                'param_name': 'priority',
                'param_type': 'token',
                'value_token_code': resource_data['priority']
            })
        
        # code
        if 'code' in resource_data and 'coding' in resource_data['code']:
            for coding in resource_data['code']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # subject/patient
        if 'for' in resource_data and 'reference' in resource_data['for']:
            ref = resource_data['for']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # focus
        if 'focus' in resource_data and 'reference' in resource_data['focus']:
            params.append({
                'param_name': 'focus',
                'param_type': 'reference',
                'value_reference': resource_data['focus']['reference']
            })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # owner
        if 'owner' in resource_data and 'reference' in resource_data['owner']:
            params.append({
                'param_name': 'owner',
                'param_type': 'reference',
                'value_reference': resource_data['owner']['reference']
            })
        
        # requester
        if 'requester' in resource_data and 'reference' in resource_data['requester']:
            params.append({
                'param_name': 'requester',
                'param_type': 'reference',
                'value_reference': resource_data['requester']['reference']
            })
        
        # authored-on
        if 'authoredOn' in resource_data:
            try:
                authored_date = datetime.fromisoformat(
                    resource_data['authoredOn'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'authored-on',
                    'param_type': 'date',
                    'value_date': authored_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse authoredOn: {e}")
        
        # period
        if 'executionPeriod' in resource_data and 'start' in resource_data['executionPeriod']:
            try:
                period_start = datetime.fromisoformat(
                    resource_data['executionPeriod']['start'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'period',
                    'param_type': 'date',
                    'value_date': period_start
                })
            except Exception as e:
                logger.warning(f"Failed to parse executionPeriod.start: {e}")
        
        return params
    
    @staticmethod
    def _extract_servicerequest_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract ServiceRequest-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # intent
        if 'intent' in resource_data:
            params.append({
                'param_name': 'intent',
                'param_type': 'token',
                'value_token_code': resource_data['intent']
            })
        
        # priority
        if 'priority' in resource_data:
            params.append({
                'param_name': 'priority',
                'param_type': 'token',
                'value_token_code': resource_data['priority']
            })
        
        # code
        if 'code' in resource_data and 'coding' in resource_data['code']:
            for coding in resource_data['code']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # category
        if 'category' in resource_data:
            for category in resource_data['category']:
                if 'coding' in category:
                    for coding in category['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'category',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            if 'Patient/' in ref or ref.startswith('urn:uuid:'):
                params.append({
                    'param_name': 'patient',
                    'param_type': 'reference',
                    'value_reference': ref
                })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # requester
        if 'requester' in resource_data and 'reference' in resource_data['requester']:
            params.append({
                'param_name': 'requester',
                'param_type': 'reference',
                'value_reference': resource_data['requester']['reference']
            })
        
        # performer
        if 'performer' in resource_data:
            for performer in resource_data['performer']:
                if 'reference' in performer:
                    params.append({
                        'param_name': 'performer',
                        'param_type': 'reference',
                        'value_reference': performer['reference']
                    })
        
        # authored
        if 'authoredOn' in resource_data:
            try:
                authored_date = datetime.fromisoformat(
                    resource_data['authoredOn'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'authored',
                    'param_type': 'date',
                    'value_date': authored_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse authoredOn: {e}")
        
        # occurrence
        if 'occurrenceDateTime' in resource_data:
            try:
                occurrence_date = datetime.fromisoformat(
                    resource_data['occurrenceDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'occurrence',
                    'param_type': 'date',
                    'value_date': occurrence_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse occurrenceDateTime: {e}")
        elif 'occurrencePeriod' in resource_data and 'start' in resource_data['occurrencePeriod']:
            try:
                occurrence_date = datetime.fromisoformat(
                    resource_data['occurrencePeriod']['start'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'occurrence',
                    'param_type': 'date',
                    'value_date': occurrence_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse occurrencePeriod.start: {e}")
        
        return params
    @staticmethod
    def _extract_careteam_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract CareTeam-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # patient/subject
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': ref
            })
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # encounter
        if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
            params.append({
                'param_name': 'encounter',
                'param_type': 'reference',
                'value_reference': resource_data['encounter']['reference']
            })
        
        # participant
        if 'participant' in resource_data:
            for participant in resource_data['participant']:
                if 'member' in participant and 'reference' in participant['member']:
                    params.append({
                        'param_name': 'participant',
                        'param_type': 'reference',
                        'value_reference': participant['member']['reference']
                    })
        
        return params
    
    @staticmethod
    def _extract_claim_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Claim-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # patient
        if 'patient' in resource_data and 'reference' in resource_data['patient']:
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': resource_data['patient']['reference']
            })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # use
        if 'use' in resource_data:
            params.append({
                'param_name': 'use',
                'param_type': 'token',
                'value_token_code': resource_data['use']
            })
        
        # created
        if 'created' in resource_data:
            try:
                created_date = datetime.fromisoformat(
                    resource_data['created'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'created',
                    'param_type': 'date',
                    'value_date': created_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse created date: {e}")
        
        # provider
        if 'provider' in resource_data and 'reference' in resource_data['provider']:
            params.append({
                'param_name': 'provider',
                'param_type': 'reference',
                'value_reference': resource_data['provider']['reference']
            })
        
        # insurer
        if 'insurer' in resource_data and 'reference' in resource_data['insurer']:
            params.append({
                'param_name': 'insurer',
                'param_type': 'reference',
                'value_reference': resource_data['insurer']['reference']
            })
        
        return params
    
    @staticmethod
    def _extract_device_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Device-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # type
        if 'type' in resource_data and 'coding' in resource_data['type']:
            for coding in resource_data['type']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'type',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # patient
        if 'patient' in resource_data and 'reference' in resource_data['patient']:
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': resource_data['patient']['reference']
            })
        
        # manufacturer
        if 'manufacturer' in resource_data:
            params.append({
                'param_name': 'manufacturer',
                'param_type': 'string',
                'value_string': resource_data['manufacturer'].lower()
            })
        
        # model
        if 'modelNumber' in resource_data:
            params.append({
                'param_name': 'model',
                'param_type': 'string',
                'value_string': resource_data['modelNumber'].lower()
            })
        
        return params
    
    @staticmethod
    def _extract_documentreference_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract DocumentReference-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # subject/patient
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': ref
            })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # type
        if 'type' in resource_data and 'coding' in resource_data['type']:
            for coding in resource_data['type']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'type',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # category
        if 'category' in resource_data:
            for category in resource_data['category']:
                if 'coding' in category:
                    for coding in category['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'category',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # date
        if 'date' in resource_data:
            try:
                doc_date = datetime.fromisoformat(
                    resource_data['date'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': doc_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse date: {e}")
        
        # author
        if 'author' in resource_data:
            for author in resource_data['author']:
                if 'reference' in author:
                    params.append({
                        'param_name': 'author',
                        'param_type': 'reference',
                        'value_reference': author['reference']
                    })
        
        # encounter
        if 'context' in resource_data and 'encounter' in resource_data['context']:
            for encounter in resource_data['context']['encounter']:
                if 'reference' in encounter:
                    params.append({
                        'param_name': 'encounter',
                        'param_type': 'reference',
                        'value_reference': encounter['reference']
                    })
        
        return params
    
    @staticmethod
    def _extract_explanationofbenefit_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract ExplanationOfBenefit-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # patient
        if 'patient' in resource_data and 'reference' in resource_data['patient']:
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': resource_data['patient']['reference']
            })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # created
        if 'created' in resource_data:
            try:
                created_date = datetime.fromisoformat(
                    resource_data['created'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'created',
                    'param_type': 'date',
                    'value_date': created_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse created date: {e}")
        
        # claim
        if 'claim' in resource_data and 'reference' in resource_data['claim']:
            params.append({
                'param_name': 'claim',
                'param_type': 'reference',
                'value_reference': resource_data['claim']['reference']
            })
        
        # provider
        if 'provider' in resource_data and 'reference' in resource_data['provider']:
            params.append({
                'param_name': 'provider',
                'param_type': 'reference',
                'value_reference': resource_data['provider']['reference']
            })
        
        return params
    
    @staticmethod
    def _extract_location_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Location-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # name
        if 'name' in resource_data:
            params.append({
                'param_name': 'name',
                'param_type': 'string',
                'value_string': resource_data['name'].lower()
            })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # type
        if 'type' in resource_data:
            for type_item in resource_data['type']:
                if 'coding' in type_item:
                    for coding in type_item['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'type',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # address
        if 'address' in resource_data:
            address = resource_data['address']
            address_parts = []
            for field in ['line', 'city', 'state', 'postalCode', 'country']:
                if field in address:
                    if field == 'line':
                        address_parts.extend(address[field])
                    else:
                        address_parts.append(address[field])
            
            if address_parts:
                address_text = ' '.join(address_parts)
                params.append({
                    'param_name': 'address',
                    'param_type': 'string',
                    'value_string': address_text.lower()
                })
                
                # Also index city separately
                if 'city' in address:
                    params.append({
                        'param_name': 'address-city',
                        'param_type': 'string',
                        'value_string': address['city'].lower()
                    })
        
        # organization
        if 'managingOrganization' in resource_data and 'reference' in resource_data['managingOrganization']:
            params.append({
                'param_name': 'organization',
                'param_type': 'reference',
                'value_reference': resource_data['managingOrganization']['reference']
            })
        
        return params
    
    @staticmethod
    def _extract_medication_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Medication-specific search parameters."""
        params = []
        
        # code
        if 'code' in resource_data and 'coding' in resource_data['code']:
            for coding in resource_data['code']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # manufacturer
        if 'manufacturer' in resource_data and 'reference' in resource_data['manufacturer']:
            params.append({
                'param_name': 'manufacturer',
                'param_type': 'reference',
                'value_reference': resource_data['manufacturer']['reference']
            })
        
        # form
        if 'form' in resource_data and 'coding' in resource_data['form']:
            for coding in resource_data['form']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'form',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        return params
    
    @staticmethod
    def _extract_medicationadministration_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract MedicationAdministration-specific search parameters."""
        params = []
        
        # patient/subject
        if 'subject' in resource_data and 'reference' in resource_data['subject']:
            ref = resource_data['subject']['reference']
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': ref
            })
            params.append({
                'param_name': 'subject',
                'param_type': 'reference',
                'value_reference': ref
            })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # medication
        if 'medicationReference' in resource_data and 'reference' in resource_data['medicationReference']:
            params.append({
                'param_name': 'medication',
                'param_type': 'reference',
                'value_reference': resource_data['medicationReference']['reference']
            })
        elif 'medicationCodeableConcept' in resource_data and 'coding' in resource_data['medicationCodeableConcept']:
            for coding in resource_data['medicationCodeableConcept']['coding']:
                if 'code' in coding:
                    params.append({
                        'param_name': 'code',
                        'param_type': 'token',
                        'value_token_system': coding.get('system'),
                        'value_token_code': coding['code']
                    })
        
        # effective-time
        if 'effectiveDateTime' in resource_data:
            try:
                effective_date = datetime.fromisoformat(
                    resource_data['effectiveDateTime'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'effective-time',
                    'param_type': 'date',
                    'value_date': effective_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse effectiveDateTime: {e}")
        elif 'effectivePeriod' in resource_data and 'start' in resource_data['effectivePeriod']:
            try:
                effective_date = datetime.fromisoformat(
                    resource_data['effectivePeriod']['start'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'effective-time',
                    'param_type': 'date',
                    'value_date': effective_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse effectivePeriod.start: {e}")
        
        # context (encounter)
        if 'context' in resource_data and 'reference' in resource_data['context']:
            params.append({
                'param_name': 'context',
                'param_type': 'reference',
                'value_reference': resource_data['context']['reference']
            })
        
        # request
        if 'request' in resource_data and 'reference' in resource_data['request']:
            params.append({
                'param_name': 'request',
                'param_type': 'reference',
                'value_reference': resource_data['request']['reference']
            })
        
        return params
    
    @staticmethod
    def _extract_practitionerrole_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract PractitionerRole-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # practitioner
        if 'practitioner' in resource_data and 'reference' in resource_data['practitioner']:
            params.append({
                'param_name': 'practitioner',
                'param_type': 'reference',
                'value_reference': resource_data['practitioner']['reference']
            })
        
        # organization
        if 'organization' in resource_data and 'reference' in resource_data['organization']:
            params.append({
                'param_name': 'organization',
                'param_type': 'reference',
                'value_reference': resource_data['organization']['reference']
            })
        
        # active
        if 'active' in resource_data:
            params.append({
                'param_name': 'active',
                'param_type': 'token',
                'value_token_code': 'true' if resource_data['active'] else 'false'
            })
        
        # role
        if 'code' in resource_data:
            for code in resource_data['code']:
                if 'coding' in code:
                    for coding in code['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'role',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # specialty
        if 'specialty' in resource_data:
            for specialty in resource_data['specialty']:
                if 'coding' in specialty:
                    for coding in specialty['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'specialty',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # location
        if 'location' in resource_data:
            for location in resource_data['location']:
                if 'reference' in location:
                    params.append({
                        'param_name': 'location',
                        'param_type': 'reference',
                        'value_reference': location['reference']
                    })
        
        return params
    
    @staticmethod
    def _extract_provenance_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Provenance-specific search parameters."""
        params = []
        
        # target
        if 'target' in resource_data:
            for target in resource_data['target']:
                if 'reference' in target:
                    params.append({
                        'param_name': 'target',
                        'param_type': 'reference',
                        'value_reference': target['reference']
                    })
        
        # recorded
        if 'recorded' in resource_data:
            try:
                recorded_date = datetime.fromisoformat(
                    resource_data['recorded'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'recorded',
                    'param_type': 'date',
                    'value_date': recorded_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse recorded date: {e}")
        
        # agent
        if 'agent' in resource_data:
            for agent in resource_data['agent']:
                if 'who' in agent and 'reference' in agent['who']:
                    params.append({
                        'param_name': 'agent',
                        'param_type': 'reference',
                        'value_reference': agent['who']['reference']
                    })
        
        # patient
        if 'target' in resource_data:
            for target in resource_data['target']:
                if 'reference' in target and target['reference'].startswith('Patient/'):
                    params.append({
                        'param_name': 'patient',
                        'param_type': 'reference',
                        'value_reference': target['reference']
                    })
        
        return params
    
    @staticmethod
    def _extract_questionnaire_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract Questionnaire-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # name
        if 'name' in resource_data:
            params.append({
                'param_name': 'name',
                'param_type': 'string',
                'value_string': resource_data['name'].lower()
            })
        
        # title
        if 'title' in resource_data:
            params.append({
                'param_name': 'title',
                'param_type': 'string',
                'value_string': resource_data['title'].lower()
            })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # date
        if 'date' in resource_data:
            try:
                q_date = datetime.fromisoformat(
                    resource_data['date'].replace('Z', '+00:00')
                )
                params.append({
                    'param_name': 'date',
                    'param_type': 'date',
                    'value_date': q_date
                })
            except Exception as e:
                logger.warning(f"Failed to parse date: {e}")
        
        # publisher
        if 'publisher' in resource_data:
            params.append({
                'param_name': 'publisher',
                'param_type': 'string',
                'value_string': resource_data['publisher'].lower()
            })
        
        # version
        if 'version' in resource_data:
            params.append({
                'param_name': 'version',
                'param_type': 'token',
                'value_token_code': resource_data['version']
            })
        
        return params
    
    @staticmethod
    def _extract_supplydelivery_params(resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract SupplyDelivery-specific search parameters."""
        params = []
        
        # identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # patient
        if 'patient' in resource_data and 'reference' in resource_data['patient']:
            params.append({
                'param_name': 'patient',
                'param_type': 'reference',
                'value_reference': resource_data['patient']['reference']
            })
        
        # status
        if 'status' in resource_data:
            params.append({
                'param_name': 'status',
                'param_type': 'token',
                'value_token_code': resource_data['status']
            })
        
        # receiver
        if 'receiver' in resource_data:
            for receiver in resource_data['receiver']:
                if 'reference' in receiver:
                    params.append({
                        'param_name': 'receiver',
                        'param_type': 'reference',
                        'value_reference': receiver['reference']
                    })
        
        # supplier
        if 'supplier' in resource_data and 'reference' in resource_data['supplier']:
            params.append({
                'param_name': 'supplier',
                'param_type': 'reference',
                'value_reference': resource_data['supplier']['reference']
            })
        
        return params