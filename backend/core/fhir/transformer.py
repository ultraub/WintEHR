"""
FHIR Data Transformer

Transforms FHIR data from various sources (like Synthea) to be compliant
with strict FHIR R4 specification as expected by fhir.resources library.
"""

import copy
from typing import Dict, Any, List, Union
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FHIRTransformer:
    """
    Transforms FHIR resources to ensure R4 compliance.
    
    Handles common issues found in Synthea and other FHIR data sources:
    - Single values that should be arrays
    - Field name variations
    - Extra fields not in spec
    - Missing required fields
    """
    
    def __init__(self):
        """Initialize transformer with transformation rules."""
        # Define fields that should always be arrays in R4
        self.array_fields = {
            'Encounter': ['class', 'type', 'diagnosis', 'account', 'statusHistory'],
            'Device': ['type', 'safety', 'property', 'specialization', 'version'],
            'DocumentReference': ['context', 'category', 'author', 'relatesTo'],
            'SupplyDelivery': ['suppliedItem'],
            'Patient': ['identifier', 'name', 'telecom', 'address', 'contact', 'communication', 'generalPractitioner', 'link'],
            'Practitioner': ['identifier', 'name', 'telecom', 'address', 'qualification'],
            'Organization': ['identifier', 'type', 'telecom', 'address', 'contact', 'endpoint'],
            'Observation': ['identifier', 'category', 'performer', 'interpretation', 'note', 'referenceRange', 'component'],
            'Condition': ['identifier', 'category', 'severity', 'bodySite', 'stage', 'evidence'],
            'MedicationRequest': ['identifier', 'category', 'reasonCode', 'reasonReference', 'note', 'dosageInstruction', 'substitution'],
            'Procedure': ['identifier', 'category', 'performer', 'reasonCode', 'reasonReference', 'bodySite', 'note', 'focalDevice', 'usedReference', 'usedCode'],
            'DiagnosticReport': ['identifier', 'category', 'performer', 'specimen', 'result', 'imagingStudy', 'media', 'presentedForm'],
            'ImagingStudy': ['identifier', 'endpoint', 'procedureCode', 'reasonCode', 'reasonReference', 'note', 'series'],
            'Immunization': ['identifier', 'statusReason', 'vaccineCode', 'manufacturer', 'lotNumber', 'expirationDate', 'site', 'route', 'performer', 'note', 'reasonCode', 'reasonReference', 'reaction', 'protocolApplied'],
            'AllergyIntolerance': ['identifier', 'category', 'reaction'],
            'CarePlan': ['identifier', 'instantiatesCanonical', 'instantiatesUri', 'basedOn', 'replaces', 'partOf', 'category', 'contributor', 'careTeam', 'addresses', 'supportingInfo', 'goal', 'activity', 'note'],
            'CareTeam': ['identifier', 'category', 'participant', 'reasonCode', 'reasonReference', 'managingOrganization', 'telecom', 'note'],
            'Claim': ['identifier', 'related', 'careTeam', 'supportingInfo', 'diagnosis', 'procedure', 'insurance', 'item'],
            'ExplanationOfBenefit': ['identifier', 'careTeam', 'supportingInfo', 'diagnosis', 'procedure', 'insurance', 'item', 'addItem', 'adjudication', 'total', 'processNote', 'benefitBalance'],
        }
        
        # Field renames (old_name -> new_name)
        self.field_renames = {
            'Encounter': {
                'period': 'actualPeriod',  # If period is at wrong level
            },
            'Procedure': {
                'performedPeriod': 'performedPeriod',  # Keep but handle specially
            },
            'Device': {
                'patient': 'patient',  # Valid but handle reference format
                'deviceName': 'deviceName',  # Array in R4
                'distinctIdentifier': 'distinctIdentifier',  # Deprecated, remove
            },
            'DocumentReference': {
                'context': 'context',  # Ensure it's array
            },
            'MedicationRequest': {
                'medicationCodeableConcept': 'medicationCodeableConcept',
                'medicationReference': 'medicationReference',
                'reasonReference': 'reasonReference',  # Array in R4
            },
            'CareTeam': {
                'encounter': 'encounter',  # Valid reference
                'reasonCode': 'reasonCode',  # Array in R4
            },
            'CarePlan': {
                'addresses': 'addresses',  # Array of references
            }
        }
        
        # Fields to remove (deprecated or invalid)
        self.fields_to_remove = {
            'Device': ['distinctIdentifier'],
            'DocumentReference': ['content.format'],  # format is valid but in wrong structure
            'Encounter': ['participant.individual'],  # Should be participant.actor
            'MedicationRequest': ['dosageInstruction.asNeededBoolean'],  # Should be asNeeded[x]
            'ExplanationOfBenefit': ['contained'],  # Process contained resources specially
        }
        
    def transform_resource(self, resource_type: str, resource_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a FHIR resource to be R4 compliant.
        
        Args:
            resource_type: The FHIR resource type
            resource_data: The resource data to transform
            
        Returns:
            Transformed resource data
        """
        # Make a deep copy to avoid modifying original
        transformed = copy.deepcopy(resource_data)
        
        # Ensure resourceType is set
        transformed['resourceType'] = resource_type
        
        # Apply transformations
        transformed = self._ensure_arrays(resource_type, transformed)
        transformed = self._fix_field_names(resource_type, transformed)
        transformed = self._fix_references(transformed)
        transformed = self._fix_specific_resource_issues(resource_type, transformed)
        transformed = self._remove_invalid_fields(resource_type, transformed)
        transformed = self._fix_contained_resources(transformed)
        
        return transformed
    
    def _ensure_arrays(self, resource_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure fields that should be arrays are arrays."""
        if resource_type in self.array_fields:
            for field in self.array_fields[resource_type]:
                if field in data and not isinstance(data[field], list):
                    data[field] = [data[field]]
        
        return data
    
    def _fix_field_names(self, resource_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix field names and structure."""
        if resource_type == 'Encounter':
            # Fix participant structure
            if 'participant' in data:
                for participant in data.get('participant', []):
                    if isinstance(participant, dict) and 'individual' in participant:
                        # Rename individual to actor
                        participant['actor'] = participant.pop('individual')
        
        elif resource_type == 'Procedure':
            # Handle performedPeriod -> performed[x]
            if 'performedPeriod' in data and 'performed' not in data:
                # Procedure uses performed[x] which can be performedDateTime or performedPeriod
                # The field name should just be 'performed' for Period type
                data['performed'] = data.pop('performedPeriod')
        
        elif resource_type == 'MedicationRequest':
            # Handle medication[x] - must be either medicationCodeableConcept or medicationReference
            if 'medicationCodeableConcept' in data:
                data['medication'] = data.pop('medicationCodeableConcept')
            elif 'medicationReference' in data:
                data['medication'] = data.pop('medicationReference')
            
            # Fix dosageInstruction
            if 'dosageInstruction' in data:
                for dosage in data.get('dosageInstruction', []):
                    if isinstance(dosage, dict) and 'asNeededBoolean' in dosage:
                        # Convert to proper asNeeded[x] format
                        dosage['asNeeded'] = dosage.pop('asNeededBoolean')
        
        elif resource_type == 'MedicationAdministration':
            # Fix occurence[x] field name
            if 'occurenceDateTime' in data:
                data['occurenceDateTime'] = data.pop('occurenceDateTime')
            elif 'occurencePeriod' in data:
                data['occurencePeriod'] = data.pop('occurencePeriod')
        
        elif resource_type == 'DocumentReference':
            # Fix content.attachment structure
            if 'content' in data and isinstance(data['content'], list):
                for content in data['content']:
                    if isinstance(content, dict) and 'format' in content:
                        # Format should be under attachment
                        if 'attachment' not in content:
                            content['attachment'] = {}
                        # Remove format from content level
                        content.pop('format', None)
        
        elif resource_type == 'Device':
            # Fix deviceName structure - should be array
            if 'deviceName' in data and not isinstance(data['deviceName'], list):
                device_name = data['deviceName']
                if isinstance(device_name, str):
                    data['deviceName'] = [{
                        'name': device_name,
                        'type': 'user-friendly-name'
                    }]
                elif isinstance(device_name, dict):
                    data['deviceName'] = [device_name]
            
            # Fix UDI carrier structure
            if 'udiCarrier' in data and isinstance(data['udiCarrier'], list):
                for carrier in data['udiCarrier']:
                    if isinstance(carrier, dict):
                        # Ensure required fields
                        if 'deviceIdentifier' in carrier and 'issuer' not in carrier:
                            carrier['issuer'] = 'Unknown'  # Required field
        
        elif resource_type == 'ExplanationOfBenefit':
            # Fix contained resources structure
            if 'contained' in data and isinstance(data['contained'], list):
                fixed_contained = []
                for contained in data['contained']:
                    if isinstance(contained, dict):
                        # Ensure resourceType is set for contained resources
                        if 'resourceType' not in contained:
                            # Try to infer from kind or other fields
                            if 'kind' in contained:
                                contained['resourceType'] = contained['kind']
                            elif 'name' in contained and 'telecom' in contained:
                                contained['resourceType'] = 'Organization'
                            elif 'name' in contained:
                                contained['resourceType'] = 'Practitioner'
                        fixed_contained.append(contained)
                data['contained'] = fixed_contained
        
        elif resource_type == 'ImagingStudy':
            # Fix series.instance structure
            if 'series' in data and isinstance(data['series'], list):
                for series in data['series']:
                    if isinstance(series, dict):
                        # Fix modality - should be Coding not CodeableConcept
                        if 'modality' in series and isinstance(series['modality'], dict):
                            if 'coding' in series['modality']:
                                # Extract first coding
                                series['modality'] = series['modality']['coding'][0] if series['modality']['coding'] else {}
                        
                        # Fix bodySite - should be Coding not CodeableConcept  
                        if 'bodySite' in series and isinstance(series['bodySite'], dict):
                            if 'coding' in series['bodySite']:
                                # Extract first coding
                                series['bodySite'] = series['bodySite']['coding'][0] if series['bodySite']['coding'] else {}
        
        elif resource_type == 'CareTeam':
            # Fix participant.role structure
            if 'participant' in data and isinstance(data['participant'], list):
                for participant in data['participant']:
                    if isinstance(participant, dict) and 'role' in participant:
                        # Role should be CodeableConcept, not array of CodeableConcept
                        if isinstance(participant['role'], list) and len(participant['role']) > 0:
                            participant['role'] = participant['role'][0]
        
        elif resource_type == 'CarePlan':
            # Fix activity.detail structure
            if 'activity' in data and isinstance(data['activity'], list):
                for activity in data['activity']:
                    if isinstance(activity, dict) and 'detail' in activity:
                        # detail should be an object, not a reference
                        if isinstance(activity['detail'], dict) and 'reference' in activity['detail']:
                            # Move reference to outcomeReference
                            activity['reference'] = activity['detail']['reference']
                            del activity['detail']
            
            # Fix addresses reference structure
            if 'addresses' in data and isinstance(data['addresses'], list):
                fixed_addresses = []
                for addr in data['addresses']:
                    if isinstance(addr, dict) and 'reference' in addr:
                        # The reference might be malformed
                        ref = addr['reference']
                        if isinstance(ref, dict):
                            fixed_addresses.append(ref)
                        else:
                            fixed_addresses.append({'reference': str(ref)})
                    else:
                        fixed_addresses.append(addr)
                data['addresses'] = fixed_addresses
        
        elif resource_type == 'SupplyDelivery':
            # Ensure suppliedItem is array and has proper structure
            if 'suppliedItem' in data:
                if not isinstance(data['suppliedItem'], list):
                    data['suppliedItem'] = [data['suppliedItem']]
                
                # Fix structure of each supplied item
                for i, item in enumerate(data['suppliedItem']):
                    if isinstance(item, dict):
                        # Ensure quantity exists
                        if 'quantity' not in item and 'itemCodeableConcept' in item:
                            item['quantity'] = {'value': 1}
        
        return data
    
    def _fix_references(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix reference formats throughout the resource."""
        if isinstance(data, dict):
            for key, value in list(data.items()):
                if key.endswith('Reference') and isinstance(value, str):
                    # Convert string reference to Reference object
                    data[key] = {'reference': value}
                elif isinstance(value, (dict, list)):
                    data[key] = self._fix_references(value)
        elif isinstance(data, list):
            return [self._fix_references(item) for item in data]
        
        return data
    
    def _fix_specific_resource_issues(self, resource_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix resource-specific issues."""
        if resource_type == 'DiagnosticReport':
            # Fix presentedForm for base64 data
            if 'presentedForm' in data and isinstance(data['presentedForm'], list):
                for form in data['presentedForm']:
                    if isinstance(form, dict) and 'data' in form:
                        # Ensure data is string, not bytes
                        if isinstance(form['data'], bytes):
                            form['data'] = form['data'].decode('utf-8')
        
        return data
    
    def _remove_invalid_fields(self, resource_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove fields that are invalid for the resource type."""
        if resource_type in self.fields_to_remove:
            for field in self.fields_to_remove[resource_type]:
                if '.' in field:
                    # Nested field
                    parts = field.split('.')
                    current = data
                    for part in parts[:-1]:
                        if part in current:
                            current = current[part]
                        else:
                            break
                    if parts[-1] in current:
                        del current[parts[-1]]
                else:
                    # Top-level field
                    data.pop(field, None)
        
        # Remove extra fields not in spec
        if resource_type == 'Encounter' and 'reasonCode' in data:
            # reasonCode should be array in R4
            if not isinstance(data['reasonCode'], list):
                data['reasonCode'] = [data['reasonCode']]
        
        return data
    
    def _fix_contained_resources(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix contained resources structure."""
        if 'contained' in data and isinstance(data['contained'], list):
            fixed_contained = []
            for contained in data['contained']:
                if isinstance(contained, dict) and 'resourceType' in contained:
                    # Recursively transform contained resources
                    resource_type = contained['resourceType']
                    fixed_resource = self.transform_resource(resource_type, contained)
                    fixed_contained.append(fixed_resource)
            data['contained'] = fixed_contained
        
        return data
    
    def transform_bundle(self, bundle_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a FHIR Bundle and all its entries.
        
        Args:
            bundle_data: The bundle data to transform
            
        Returns:
            Transformed bundle data
        """
        transformed = copy.deepcopy(bundle_data)
        
        # Transform each entry
        if 'entry' in transformed and isinstance(transformed['entry'], list):
            for entry in transformed['entry']:
                if isinstance(entry, dict) and 'resource' in entry:
                    resource = entry['resource']
                    if isinstance(resource, dict) and 'resourceType' in resource:
                        resource_type = resource['resourceType']
                        entry['resource'] = self.transform_resource(resource_type, resource)
        
        return transformed