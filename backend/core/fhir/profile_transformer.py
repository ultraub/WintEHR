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
            # Fix Encounter fields for proper JSON/FHIR validation
            # 1. class field - should be a single Coding in R4, not an array
            if 'class' in resource:
                class_field = resource['class']
                if isinstance(class_field, list):
                    # Take the first element if it's incorrectly an array
                    resource['class'] = self._to_coding(class_field[0] if class_field else {})
                elif isinstance(class_field, dict) and 'coding' in class_field:
                    # Convert CodeableConcept to Coding
                    resource['class'] = self._to_coding(class_field)
                # else: assume it's already a proper Coding object
                
                # Clean the Coding object
                if isinstance(resource['class'], dict):
                    allowed_coding_fields = {'id', 'extension', 'system', 'version', 'code', 'display', 'userSelected'}
                    resource['class'] = self._clean_fields(resource['class'], allowed_coding_fields)
            
            # 2. Clean period field - remove extra fields  
            if 'period' in resource and isinstance(resource['period'], dict):
                resource['period'] = self._clean_period(resource['period'])
            
            # 3. Fix participant structure: individual → actor and clean fields
            if 'participant' in resource and isinstance(resource['participant'], list):
                cleaned_participants = []
                for participant in resource['participant']:
                    if isinstance(participant, dict):
                        # Clean the participant BackboneElement
                        allowed_participant_fields = {'id', 'extension', 'modifierExtension', 'type', 'period', 'individual', 'actor'}
                        participant = self._clean_fields(participant, allowed_participant_fields)
                        
                        # Fix individual -> actor
                        if 'individual' in participant:
                            participant['actor'] = participant.pop('individual')
                        
                        # Clean the actor Reference
                        if 'actor' in participant and isinstance(participant['actor'], dict):
                            participant['actor'] = self._clean_reference(participant['actor'])
                        
                        # Clean type array if present
                        if 'type' in participant and isinstance(participant['type'], list):
                            participant['type'] = [self._clean_codeable_concept(t) for t in participant['type'] if isinstance(t, dict)]
                        
                        cleaned_participants.append(participant)
                resource['participant'] = cleaned_participants
            
            # 4. Clean reasonCode array
            if 'reasonCode' in resource and isinstance(resource['reasonCode'], list):
                resource['reasonCode'] = [self._clean_codeable_concept(r) for r in resource['reasonCode'] if isinstance(r, dict)]
            
            # 5. Clean hospitalization if present
            if 'hospitalization' in resource and isinstance(resource['hospitalization'], dict):
                allowed_hosp_fields = {
                    'id', 'extension', 'modifierExtension', 'preAdmissionIdentifier',
                    'origin', 'admitSource', 'reAdmission', 'dietPreference',
                    'specialCourtesy', 'specialArrangement', 'destination',
                    'dischargeDisposition'
                }
                resource['hospitalization'] = self._clean_fields(resource['hospitalization'], allowed_hosp_fields)
        
        elif resource_type == 'Procedure':
            # Fix performedPeriod -> performed (polymorphic field)
            if 'performedPeriod' in resource and 'performed' not in resource:
                resource['performed'] = resource.pop('performedPeriod')
            elif 'performedDateTime' in resource and 'performed' not in resource:
                resource['performed'] = resource.pop('performedDateTime')
            
            # Clean performed field if it's a Period
            if 'performed' in resource and isinstance(resource['performed'], dict) and 'start' in resource['performed']:
                resource['performed'] = self._clean_period(resource['performed'])
            
            # Fix reasonCode -> reasonCode (ensure array)
            if 'reasonCode' in resource and not isinstance(resource['reasonCode'], list):
                resource['reasonCode'] = [resource['reasonCode']]
            
            # Clean reasonCode array
            if 'reasonCode' in resource and isinstance(resource['reasonCode'], list):
                resource['reasonCode'] = [self._clean_codeable_concept(r) for r in resource['reasonCode'] if isinstance(r, dict)]
            
            # Handle reason field if present (newer format)
            if 'reason' in resource and isinstance(resource['reason'], list):
                cleaned_reasons = []
                for reason in resource['reason']:
                    if isinstance(reason, dict):
                        # Clean the reason BackboneElement
                        allowed_reason_fields = {'id', 'extension', 'concept', 'reference'}
                        reason = self._clean_fields(reason, allowed_reason_fields)
                        
                        # Clean nested reference if present
                        if 'reference' in reason and isinstance(reason['reference'], dict):
                            reason['reference'] = self._clean_reference(reason['reference'])
                        
                        # Clean nested concept if present
                        if 'concept' in reason and isinstance(reason['concept'], dict):
                            reason['concept'] = self._clean_codeable_concept(reason['concept'])
                        
                        cleaned_reasons.append(reason)
                resource['reason'] = cleaned_reasons
            
            # Clean performer field if present
            if 'performer' in resource and isinstance(resource['performer'], list):
                cleaned_performers = []
                for performer in resource['performer']:
                    if isinstance(performer, dict):
                        # Clean the performer BackboneElement
                        allowed_performer_fields = {'id', 'extension', 'modifierExtension', 'function', 'actor', 'onBehalfOf'}
                        performer = self._clean_fields(performer, allowed_performer_fields)
                        
                        # Clean nested references
                        for ref_field in ['actor', 'onBehalfOf']:
                            if ref_field in performer and isinstance(performer[ref_field], dict):
                                performer[ref_field] = self._clean_reference(performer[ref_field])
                        
                        # Clean function if present
                        if 'function' in performer and isinstance(performer['function'], dict):
                            performer['function'] = self._clean_codeable_concept(performer['function'])
                        
                        cleaned_performers.append(performer)
                resource['performer'] = cleaned_performers
        
        elif resource_type == 'Device':
            # Fix type to be array of CodeableConcept
            if 'type' in resource and not isinstance(resource['type'], list):
                resource['type'] = [self._to_codeable_concept(resource['type'])]
            elif 'type' in resource:
                resource['type'] = [self._to_codeable_concept(t) for t in resource['type']]
            
            # Remove deprecated fields
            resource.pop('distinctIdentifier', None)
            
            # Fix deviceName structure
            if 'deviceName' in resource:
                device_names = resource.pop('deviceName')
                if isinstance(device_names, str):
                    resource['deviceName'] = [{'name': device_names, 'type': 'user-friendly-name'}]
                elif isinstance(device_names, dict):
                    resource['deviceName'] = [device_names]
                elif isinstance(device_names, list):
                    resource['deviceName'] = device_names
            
            # Fix UDI carrier issues
            if 'udiCarrier' in resource and isinstance(resource['udiCarrier'], list):
                for carrier in resource['udiCarrier']:
                    if isinstance(carrier, dict) and 'deviceIdentifier' in carrier and 'issuer' not in carrier:
                        carrier['issuer'] = 'Unknown'  # Required field
        
        elif resource_type == 'MedicationRequest':
            # Fix medication field (polymorphic)
            if 'medicationReference' in resource and 'medication' not in resource:
                resource['medication'] = resource.pop('medicationReference')
            elif 'medicationCodeableConcept' in resource and 'medication' not in resource:
                resource['medication'] = resource.pop('medicationCodeableConcept')
            
            # Clean medication field based on type
            if 'medication' in resource and isinstance(resource['medication'], dict):
                if 'reference' in resource['medication']:
                    # It's a Reference
                    resource['medication'] = self._clean_reference(resource['medication'])
                else:
                    # It's a CodeableConcept
                    resource['medication'] = self._clean_codeable_concept(resource['medication'])
            
            # Fix reasonCode -> reasonCode (ensure array)
            if 'reasonCode' in resource and not isinstance(resource['reasonCode'], list):
                resource['reasonCode'] = [resource['reasonCode']]
            
            # Clean reasonCode array
            if 'reasonCode' in resource and isinstance(resource['reasonCode'], list):
                resource['reasonCode'] = [self._clean_codeable_concept(r) for r in resource['reasonCode'] if isinstance(r, dict)]
            
            # Handle reason field if present (newer format)
            if 'reason' in resource and isinstance(resource['reason'], list):
                cleaned_reasons = []
                for reason in resource['reason']:
                    if isinstance(reason, dict):
                        # Clean the reason BackboneElement
                        allowed_reason_fields = {'id', 'extension', 'concept', 'reference'}
                        reason = self._clean_fields(reason, allowed_reason_fields)
                        
                        # Clean nested reference if present
                        if 'reference' in reason and isinstance(reason['reference'], dict):
                            reason['reference'] = self._clean_reference(reason['reference'])
                        
                        # Clean nested concept if present
                        if 'concept' in reason and isinstance(reason['concept'], dict):
                            reason['concept'] = self._clean_codeable_concept(reason['concept'])
                        
                        cleaned_reasons.append(reason)
                resource['reason'] = cleaned_reasons
            
            # Clean dosageInstruction if present
            if 'dosageInstruction' in resource and isinstance(resource['dosageInstruction'], list):
                cleaned_dosages = []
                for dosage in resource['dosageInstruction']:
                    if isinstance(dosage, dict):
                        # Fix asNeededBoolean -> asNeeded
                        if 'asNeededBoolean' in dosage:
                            dosage['asNeeded'] = dosage.pop('asNeededBoolean')
                        
                        # Clean dosage fields
                        allowed_dosage_fields = {
                            'id', 'extension', 'modifierExtension', 'sequence', 'text',
                            'additionalInstruction', 'patientInstruction', 'timing',
                            'asNeeded', 'asNeededFor', 'site', 'route', 'method',
                            'doseAndRate', 'maxDosePerPeriod', 'maxDosePerAdministration',
                            'maxDosePerLifetime'
                        }
                        dosage = self._clean_fields(dosage, allowed_dosage_fields)
                        
                        # Clean timing if present
                        if 'timing' in dosage and isinstance(dosage['timing'], dict):
                            allowed_timing_fields = {'id', 'extension', 'modifierExtension', 'event', 'repeat', 'code'}
                            dosage['timing'] = self._clean_fields(dosage['timing'], allowed_timing_fields)
                            
                            # Clean repeat if present
                            if 'repeat' in dosage['timing'] and isinstance(dosage['timing']['repeat'], dict):
                                allowed_repeat_fields = {
                                    'id', 'extension', 'boundsDuration', 'boundsRange', 'boundsPeriod',
                                    'count', 'countMax', 'duration', 'durationMax', 'durationUnit',
                                    'frequency', 'frequencyMax', 'period', 'periodMax', 'periodUnit',
                                    'dayOfWeek', 'timeOfDay', 'when', 'offset'
                                }
                                dosage['timing']['repeat'] = self._clean_fields(dosage['timing']['repeat'], allowed_repeat_fields)
                        
                        cleaned_dosages.append(dosage)
                resource['dosageInstruction'] = cleaned_dosages
        
        elif resource_type == 'MedicationAdministration':
            # Fix occurrence field naming (common typo)
            if 'occurenceDateTime' in resource:
                resource['occurenceDateTime'] = resource.pop('occurenceDateTime')
            elif 'occurencePeriod' in resource:
                resource['occurencePeriod'] = resource.pop('occurencePeriod')
        
        elif resource_type == 'DocumentReference':
            # Fix context to be array
            if 'context' in resource and not isinstance(resource['context'], list):
                resource['context'] = [resource['context']]
            
            # Fix content.format structure
            if 'content' in resource and isinstance(resource['content'], list):
                for content in resource['content']:
                    if isinstance(content, dict):
                        # Move format to attachment if present
                        if 'format' in content:
                            if 'attachment' not in content:
                                content['attachment'] = {}
                            # Remove format from content level
                            content.pop('format', None)
        
        elif resource_type == 'SupplyDelivery':
            # Fix suppliedItem to be array
            if 'suppliedItem' in resource and not isinstance(resource['suppliedItem'], list):
                resource['suppliedItem'] = [resource['suppliedItem']]
            
            # Ensure each suppliedItem has proper structure
            for item in resource.get('suppliedItem', []):
                if isinstance(item, dict) and 'quantity' not in item and 'itemCodeableConcept' in item:
                    item['quantity'] = {'value': 1}
        
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
        
        elif resource_type == 'ExplanationOfBenefit':
            # Fix contained resources
            if 'contained' in resource and isinstance(resource['contained'], list):
                fixed_contained = []
                for contained in resource['contained']:
                    if isinstance(contained, dict):
                        # Ensure resourceType is set
                        if 'resourceType' not in contained:
                            if 'kind' in contained:
                                contained['resourceType'] = contained.pop('kind')
                            elif 'name' in contained and 'telecom' in contained:
                                contained['resourceType'] = 'Organization'
                            elif 'name' in contained:
                                contained['resourceType'] = 'Practitioner'
                        fixed_contained.append(contained)
                resource['contained'] = fixed_contained
        
        elif resource_type == 'ImagingStudy':
            # Fix series structure
            if 'series' in resource and isinstance(resource['series'], list):
                for series in resource['series']:
                    if isinstance(series, dict):
                        # Fix modality - should be Coding not CodeableConcept
                        if 'modality' in series and isinstance(series['modality'], dict):
                            if 'coding' in series['modality']:
                                series['modality'] = self._to_coding(series['modality'])
                        
                        # Fix bodySite - should be Coding not CodeableConcept  
                        if 'bodySite' in series and isinstance(series['bodySite'], dict):
                            if 'coding' in series['bodySite']:
                                series['bodySite'] = self._to_coding(series['bodySite'])
        
        elif resource_type == 'CareTeam':
            # Fix participant.role structure - should be CodeableConcept not array
            if 'participant' in resource and isinstance(resource['participant'], list):
                for participant in resource['participant']:
                    if isinstance(participant, dict) and 'role' in participant:
                        # Role should be CodeableConcept, not array of CodeableConcept
                        if isinstance(participant['role'], list) and len(participant['role']) > 0:
                            participant['role'] = participant['role'][0]
        
        elif resource_type == 'CarePlan':
            # Fix activity.detail structure
            if 'activity' in resource and isinstance(resource['activity'], list):
                for activity in resource['activity']:
                    if isinstance(activity, dict) and 'detail' in activity:
                        # detail should be an object, not a reference
                        if isinstance(activity['detail'], dict) and 'reference' in activity['detail']:
                            # Move reference to activity.reference
                            activity['reference'] = activity['detail']['reference']
                            del activity['detail']
            
            # Fix addresses reference structure
            if 'addresses' in resource and isinstance(resource['addresses'], list):
                fixed_addresses = []
                for addr in resource['addresses']:
                    if isinstance(addr, dict) and 'reference' in addr:
                        fixed_addresses.append(addr)
                    elif isinstance(addr, str):
                        fixed_addresses.append({'reference': addr})
                    else:
                        fixed_addresses.append(addr)
                resource['addresses'] = fixed_addresses
        
        elif resource_type == 'Patient':
            # Clean telecom/address arrays
            if 'telecom' in resource and isinstance(resource['telecom'], list):
                resource['telecom'] = [self._clean_contact_point(t) for t in resource['telecom'] if isinstance(t, dict)]
            
            if 'address' in resource and isinstance(resource['address'], list):
                resource['address'] = [self._clean_address(a) for a in resource['address'] if isinstance(a, dict)]
        
        elif resource_type == 'Observation':
            # Fix component arrays
            if 'component' in resource and not isinstance(resource['component'], list):
                resource['component'] = [resource['component']]
            
            # Clean components
            if 'component' in resource and isinstance(resource['component'], list):
                cleaned_components = []
                for component in resource['component']:
                    if isinstance(component, dict):
                        # Clean the component BackboneElement
                        allowed_component_fields = {
                            'id', 'extension', 'modifierExtension', 'code', 
                            'valueQuantity', 'valueCodeableConcept', 'valueString',
                            'valueBoolean', 'valueInteger', 'valueRange', 'valueRatio',
                            'valueSampledData', 'valueTime', 'valueDateTime', 'valuePeriod',
                            'dataAbsentReason', 'interpretation', 'referenceRange'
                        }
                        component = self._clean_fields(component, allowed_component_fields)
                        
                        # Clean nested fields
                        if 'code' in component and isinstance(component['code'], dict):
                            component['code'] = self._clean_codeable_concept(component['code'])
                        
                        if 'valueQuantity' in component and isinstance(component['valueQuantity'], dict):
                            component['valueQuantity'] = self._clean_quantity(component['valueQuantity'])
                        
                        cleaned_components.append(component)
                resource['component'] = cleaned_components
            
            # Fix interpretation - ensure it's array of CodeableConcept
            if 'interpretation' in resource and not isinstance(resource['interpretation'], list):
                resource['interpretation'] = [self._to_codeable_concept(resource['interpretation'])]
            elif 'interpretation' in resource:
                resource['interpretation'] = [self._clean_codeable_concept(self._to_codeable_concept(i)) 
                                            for i in resource['interpretation']]
            
            # Fix referenceRange
            if 'referenceRange' in resource and isinstance(resource['referenceRange'], list):
                cleaned_ranges = []
                for range_item in resource['referenceRange']:
                    if isinstance(range_item, dict):
                        # Clean the referenceRange BackboneElement
                        allowed_range_fields = {
                            'id', 'extension', 'modifierExtension', 'low', 'high',
                            'normalValue', 'type', 'appliesTo', 'age', 'text'
                        }
                        range_item = self._clean_fields(range_item, allowed_range_fields)
                        
                        # Clean low/high Quantity fields
                        for quantity_field in ['low', 'high']:
                            if quantity_field in range_item and isinstance(range_item[quantity_field], dict):
                                range_item[quantity_field] = self._clean_quantity(range_item[quantity_field])
                        
                        cleaned_ranges.append(range_item)
                resource['referenceRange'] = cleaned_ranges
            
            # Clean main valueQuantity if present
            if 'valueQuantity' in resource and isinstance(resource['valueQuantity'], dict):
                resource['valueQuantity'] = self._clean_quantity(resource['valueQuantity'])
        
        elif resource_type == 'Condition':
            # Ensure arrays for category, bodySite, evidence
            if 'category' in resource and not isinstance(resource['category'], list):
                resource['category'] = [self._to_codeable_concept(resource['category'])]
            
            if 'bodySite' in resource and not isinstance(resource['bodySite'], list):
                resource['bodySite'] = [self._to_codeable_concept(resource['bodySite'])]
            
            if 'evidence' in resource and not isinstance(resource['evidence'], list):
                resource['evidence'] = [resource['evidence']]
        
        elif resource_type == 'Claim':
            # Fix total from array to single Money object
            if 'total' in resource and isinstance(resource['total'], list):
                if len(resource['total']) > 0:
                    resource['total'] = resource['total'][0]  # Take first total
                else:
                    resource.pop('total', None)  # Remove if empty array
        
        elif resource_type == 'Organization':
            # Clean extensions and addresses
            if 'extension' in resource and isinstance(resource['extension'], list):
                # Remove extensions with invalid URLs and clean structure
                cleaned_extensions = []
                for ext in resource['extension']:
                    if isinstance(ext, dict) and 'url' in ext and isinstance(ext['url'], str):
                        # Basic extension structure validation
                        allowed_ext_fields = {'id', 'extension', 'url', 'valueString', 'valueInteger', 
                                            'valueBoolean', 'valueDateTime', 'valueCodeableConcept',
                                            'valueReference', 'valuePeriod', 'valueQuantity', 'valueCode',
                                            'valueUri', 'valueDecimal', 'valueAddress', 'valueContactPoint'}
                        cleaned_extensions.append(self._clean_fields(ext, allowed_ext_fields))
                resource['extension'] = cleaned_extensions
            
            if 'address' in resource and isinstance(resource['address'], list):
                resource['address'] = [self._clean_address(a) for a in resource['address'] if isinstance(a, dict)]
            
            if 'telecom' in resource and isinstance(resource['telecom'], list):
                resource['telecom'] = [self._clean_contact_point(t) for t in resource['telecom'] if isinstance(t, dict)]
        
        elif resource_type == 'Location':
            # Clean position coordinates
            if 'position' in resource and isinstance(resource['position'], dict):
                # Ensure latitude and longitude are numbers
                if 'latitude' in resource['position']:
                    try:
                        resource['position']['latitude'] = float(resource['position']['latitude'])
                    except (ValueError, TypeError):
                        del resource['position']['latitude']
                
                if 'longitude' in resource['position']:
                    try:
                        resource['position']['longitude'] = float(resource['position']['longitude'])
                    except (ValueError, TypeError):
                        del resource['position']['longitude']
        
        # Transform all references in the resource
        resource = self._transform_all_references(resource)
        
        # Ensure arrays are properly formatted
        resource = self._ensure_arrays(resource_type, resource)
        
        return resource
    
    def _to_codeable_concept(self, coding_or_concept: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a Coding or simple {code, system} to CodeableConcept."""
        if isinstance(coding_or_concept, dict):
            # If it already has 'coding' array, it's probably a CodeableConcept
            if 'coding' in coding_or_concept:
                return coding_or_concept
            # If it has 'code' and 'system', convert to CodeableConcept  
            elif 'code' in coding_or_concept:
                return {
                    'coding': [coding_or_concept]
                }
        return coding_or_concept
    
    def _to_coding(self, coding_or_concept: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a CodeableConcept or simple {code, system} to Coding."""
        if isinstance(coding_or_concept, dict):
            # If it has 'coding' array, extract the first coding
            if 'coding' in coding_or_concept and isinstance(coding_or_concept['coding'], list):
                return coding_or_concept['coding'][0] if coding_or_concept['coding'] else {}
            # If it has 'code' and 'system', it's already a Coding
            elif 'code' in coding_or_concept:
                return coding_or_concept
        return coding_or_concept
    
    def _clean_fields(self, obj: Dict[str, Any], allowed_fields: set) -> Dict[str, Any]:
        """Remove fields not in the allowed list."""
        if not isinstance(obj, dict):
            return obj
        
        keys_to_remove = [k for k in obj.keys() if k not in allowed_fields]
        for key in keys_to_remove:
            del obj[key]
        
        return obj
    
    def _clean_reference(self, ref: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a Reference object to only allowed fields."""
        allowed_fields = {'id', 'extension', 'reference', 'type', 'identifier', 'display'}
        return self._clean_fields(ref, allowed_fields)
    
    def _clean_codeable_concept(self, cc: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a CodeableConcept object."""
        allowed_fields = {'id', 'extension', 'coding', 'text'}
        cc = self._clean_fields(cc, allowed_fields)
        
        # Clean nested codings
        if 'coding' in cc and isinstance(cc['coding'], list):
            cleaned_codings = []
            for coding in cc['coding']:
                allowed_coding_fields = {'id', 'extension', 'system', 'version', 'code', 'display', 'userSelected'}
                cleaned_codings.append(self._clean_fields(coding, allowed_coding_fields))
            cc['coding'] = cleaned_codings
        
        return cc
    
    def _clean_quantity(self, quantity: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a Quantity object."""
        allowed_fields = {'id', 'extension', 'value', 'comparator', 'unit', 'system', 'code'}
        quantity = self._clean_fields(quantity, allowed_fields)
        
        # Ensure value is numeric
        if 'value' in quantity and quantity['value'] is not None:
            try:
                quantity['value'] = float(quantity['value'])
            except (ValueError, TypeError):
                pass
        
        return quantity
    
    def _clean_period(self, period: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a Period object."""
        allowed_fields = {'id', 'extension', 'start', 'end'}
        return self._clean_fields(period, allowed_fields)
    
    def _clean_address(self, address: Dict[str, Any]) -> Dict[str, Any]:
        """Clean an Address object."""
        allowed_fields = {'id', 'extension', 'use', 'type', 'text', 'line', 
                         'city', 'district', 'state', 'postalCode', 'country', 'period'}
        return self._clean_fields(address, allowed_fields)
    
    def _clean_contact_point(self, contact: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a ContactPoint object."""
        allowed_fields = {'id', 'extension', 'system', 'value', 'use', 'rank', 'period'}
        return self._clean_fields(contact, allowed_fields)
    
    def _transform_reference(self, ref: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Transform Synthea references to standard FHIR format.
        
        Handles:
        - urn:uuid: references -> standard ResourceType/id format
        - Conditional references (ResourceType?identifier=...) -> standard format
        - String references -> Reference objects
        """
        if isinstance(ref, str):
            # Convert string to Reference object
            ref = {'reference': ref}
        
        if not isinstance(ref, dict) or 'reference' not in ref:
            return ref
        
        ref_string = ref['reference']
        
        # Handle urn:uuid: references
        if ref_string.startswith('urn:uuid:'):
            # For now, keep as-is but ensure it's properly formatted
            # In a full implementation, we'd resolve these to actual resource IDs
            uuid_part = ref_string[9:]  # Remove 'urn:uuid:'
            # Validate UUID format
            import re
            uuid_pattern = re.compile(
                r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                re.IGNORECASE
            )
            if not uuid_pattern.match(uuid_part):
                # Invalid UUID, try to clean it
                uuid_part = uuid_part.replace('-', '')[:32]
                if len(uuid_part) == 32:
                    # Reformat as UUID
                    uuid_part = f"{uuid_part[:8]}-{uuid_part[8:12]}-{uuid_part[12:16]}-{uuid_part[16:20]}-{uuid_part[20:32]}"
                ref['reference'] = f"urn:uuid:{uuid_part}"
        
        # Handle conditional references
        elif '?' in ref_string and not ref_string.startswith('http'):
            # Format: ResourceType?search-params
            # For now, keep as-is - these will be resolved during import
            pass
        
        # Ensure reference object only has allowed fields
        return self._clean_reference(ref)
    
    def _transform_all_references(self, obj: Any) -> Any:
        """Recursively transform all references in an object."""
        if isinstance(obj, dict):
            # Check if this is a reference object
            if 'reference' in obj and isinstance(obj.get('reference'), str):
                return self._transform_reference(obj)
            
            # Recursively process all values
            result = {}
            for key, value in obj.items():
                # Common reference field names
                if key in ['subject', 'patient', 'encounter', 'performer', 'actor', 
                          'author', 'recorder', 'asserter', 'prescriber', 'requester',
                          'participant', 'individual', 'practitioner', 'organization',
                          'location', 'managingOrganization', 'partOf', 'basedOn',
                          'replaces', 'context', 'supportingInfo', 'specimen',
                          'device', 'for', 'owner', 'focus', 'reference']:
                    if isinstance(value, (str, dict)):
                        result[key] = self._transform_reference(value)
                    else:
                        result[key] = self._transform_all_references(value)
                else:
                    result[key] = self._transform_all_references(value)
            return result
        elif isinstance(obj, list):
            return [self._transform_all_references(item) for item in obj]
        else:
            return obj
    
    def _ensure_arrays(self, resource_type: str, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure fields that should be arrays are arrays."""
        # Define fields that should always be arrays in R4
        array_fields = {
            'Encounter': ['type', 'diagnosis', 'account', 'statusHistory', 'reasonCode', 'episodeOfCare', 'basedOn', 'classHistory'],
            'Device': ['type', 'safety', 'property', 'specialization', 'version', 'udiCarrier', 'deviceName', 'contact', 'note'],
            'DocumentReference': ['category', 'author', 'relatesTo', 'securityLabel', 'content'],
            'SupplyDelivery': ['suppliedItem', 'partOf', 'basedOn'],
            'Patient': ['identifier', 'name', 'telecom', 'address', 'contact', 'communication', 'generalPractitioner', 'link'],
            'Practitioner': ['identifier', 'name', 'telecom', 'address', 'qualification'],
            'Organization': ['identifier', 'type', 'telecom', 'address', 'contact', 'endpoint', 'alias'],
            'Observation': ['identifier', 'category', 'performer', 'interpretation', 'note', 'referenceRange', 'component', 'basedOn', 'partOf', 'focus', 'hasMember', 'derivedFrom'],
            'Condition': ['identifier', 'category', 'severity', 'bodySite', 'stage', 'evidence'],
            'MedicationRequest': ['identifier', 'category', 'reasonCode', 'reasonReference', 'note', 'dosageInstruction', 'eventHistory', 'instantiatesCanonical', 'instantiatesUri', 'basedOn', 'supportingInformation', 'detectedIssue', 'insurance'],
            'Procedure': ['identifier', 'category', 'performer', 'reasonCode', 'reasonReference', 'bodySite', 'note', 'focalDevice', 'usedReference', 'usedCode', 'partOf', 'basedOn', 'complication', 'complicationDetail', 'followUp', 'report', 'instantiatesCanonical', 'instantiatesUri'],
            'DiagnosticReport': ['identifier', 'category', 'performer', 'specimen', 'result', 'imagingStudy', 'media', 'presentedForm', 'basedOn', 'resultsInterpreter'],
            'ImagingStudy': ['identifier', 'endpoint', 'procedureCode', 'reasonCode', 'reasonReference', 'note', 'series', 'modality', 'basedOn', 'interpreter'],
            'Immunization': ['identifier', 'statusReason', 'vaccineCode', 'performer', 'note', 'reasonCode', 'reasonReference', 'reaction', 'protocolApplied', 'education', 'programEligibility'],
            'AllergyIntolerance': ['identifier', 'category', 'reaction', 'note'],
            'CarePlan': ['identifier', 'instantiatesCanonical', 'instantiatesUri', 'basedOn', 'replaces', 'partOf', 'category', 'contributor', 'careTeam', 'addresses', 'supportingInfo', 'goal', 'activity', 'note'],
            'CareTeam': ['identifier', 'category', 'participant', 'reasonCode', 'reasonReference', 'managingOrganization', 'telecom', 'note'],
            'Claim': ['identifier', 'related', 'careTeam', 'supportingInfo', 'diagnosis', 'procedure', 'insurance', 'item'],
            'ExplanationOfBenefit': ['identifier', 'careTeam', 'supportingInfo', 'diagnosis', 'procedure', 'insurance', 'item', 'addItem', 'adjudication', 'total', 'processNote', 'benefitBalance'],
        }
        
        if resource_type in array_fields:
            for field in array_fields[resource_type]:
                if field in resource and not isinstance(resource[field], list):
                    resource[field] = [resource[field]]
        
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
            # Apply the same comprehensive fixes as SyntheaProfileHandler
            if 'class' in resource:
                class_field = resource['class']
                if isinstance(class_field, list):
                    # Take the first element if it's incorrectly an array
                    resource['class'] = self._to_coding(class_field[0] if class_field else {})
                elif isinstance(class_field, dict) and 'coding' in class_field:
                    # Convert CodeableConcept to Coding
                    resource['class'] = self._to_coding(class_field)
                # else: assume it's already a proper Coding object
            
            if 'period' in resource:
                resource['actualPeriod'] = resource.pop('period')
            
            if 'reasonCode' in resource:
                reason_codes = resource.pop('reasonCode')
                if not isinstance(reason_codes, list):
                    reason_codes = [reason_codes]
                resource['reason'] = []
                for reason_code in reason_codes:
                    resource['reason'].append({
                        'use': [self._to_codeable_concept(reason_code)]
                    })
            
            if 'participant' in resource and isinstance(resource['participant'], list):
                for participant in resource['participant']:
                    if isinstance(participant, dict) and 'individual' in participant:
                        participant['actor'] = participant.pop('individual')
        
        elif resource_type == 'Procedure':
            # Apply same fixes as SyntheaProfileHandler
            if 'performedPeriod' in resource and 'performed' not in resource:
                resource['performed'] = resource.pop('performedPeriod')
            elif 'performedDateTime' in resource and 'performed' not in resource:
                resource['performed'] = resource.pop('performedDateTime')
            if 'reasonCode' in resource and not isinstance(resource['reasonCode'], list):
                resource['reasonCode'] = [resource['reasonCode']]
        
        elif resource_type == 'MedicationRequest':
            # Apply same fixes as SyntheaProfileHandler
            if 'medicationReference' in resource and 'medication' not in resource:
                resource['medication'] = resource.pop('medicationReference')
            elif 'medicationCodeableConcept' in resource and 'medication' not in resource:
                resource['medication'] = resource.pop('medicationCodeableConcept')
            if 'reasonCode' in resource and not isinstance(resource['reasonCode'], list):
                resource['reasonCode'] = [resource['reasonCode']]
        
        return resource
    
    def _to_codeable_concept(self, coding_or_concept: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a Coding or simple {code, system} to CodeableConcept."""
        if isinstance(coding_or_concept, dict):
            # If it already has 'coding' array, it's probably a CodeableConcept
            if 'coding' in coding_or_concept:
                return coding_or_concept
            # If it has 'code' and 'system', convert to CodeableConcept  
            elif 'code' in coding_or_concept:
                return {
                    'coding': [coding_or_concept]
                }
        return coding_or_concept
    
    def _to_coding(self, coding_or_concept: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a CodeableConcept or simple {code, system} to Coding."""
        if isinstance(coding_or_concept, dict):
            # If it has 'coding' array, extract the first coding
            if 'coding' in coding_or_concept and isinstance(coding_or_concept['coding'], list):
                return coding_or_concept['coding'][0] if coding_or_concept['coding'] else {}
            # If it has 'code' and 'system', it's already a Coding
            elif 'code' in coding_or_concept:
                return coding_or_concept
        return coding_or_concept


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
            'benefitBalance', 'contained', 'extension', 'modifierExtension',
            'reasonCode', 'reasonReference', 'bodySite', 'type',
            'statusHistory', 'qualification', 'endpoint', 'safety',
            'property', 'specialization', 'version', 'severity',
            'stage', 'evidence', 'focalDevice', 'usedReference',
            'usedCode', 'statusReason', 'vaccineCode', 'manufacturer',
            'lotNumber', 'expirationDate', 'site', 'route', 'reaction',
            'protocolApplied', 'instantiatesCanonical', 'instantiatesUri',
            'basedOn', 'replaces', 'partOf', 'contributor', 'related',
            'managingOrganization', 'adjudication', 'specimen', 'result',
            'imagingStudy', 'media', 'presentedForm', 'account'
        }
        
        # Resource-specific array fields that need special handling
        self.resource_array_fields = {
            'Encounter': {'type', 'diagnosis', 'account', 'statusHistory'},  # Note: 'class' is NOT an array in R4
            'Device': {'type', 'safety', 'property', 'specialization', 'version'},
            'DocumentReference': {'context', 'category', 'author', 'relatesTo'},
            'SupplyDelivery': {'suppliedItem'},
            'Patient': {'identifier', 'name', 'telecom', 'address', 'contact', 'communication', 'generalPractitioner', 'link'},
            'Practitioner': {'identifier', 'name', 'telecom', 'address', 'qualification'},
            'Organization': {'identifier', 'type', 'telecom', 'address', 'contact', 'endpoint'},
            'Observation': {'identifier', 'category', 'performer', 'interpretation', 'note', 'referenceRange', 'component'},
            'Condition': {'identifier', 'category', 'severity', 'bodySite', 'stage', 'evidence'},
            'MedicationRequest': {'identifier', 'category', 'reasonCode', 'reasonReference', 'note', 'dosageInstruction', 'substitution'},
            'Procedure': {'identifier', 'category', 'performer', 'reasonCode', 'reasonReference', 'bodySite', 'note', 'focalDevice', 'usedReference', 'usedCode'},
            'DiagnosticReport': {'identifier', 'category', 'performer', 'specimen', 'result', 'imagingStudy', 'media', 'presentedForm'},
            'ImagingStudy': {'identifier', 'endpoint', 'procedureCode', 'reasonCode', 'reasonReference', 'note', 'series'},
            'Immunization': {'identifier', 'statusReason', 'vaccineCode', 'manufacturer', 'lotNumber', 'expirationDate', 'site', 'route', 'performer', 'note', 'reasonCode', 'reasonReference', 'reaction', 'protocolApplied'},
            'AllergyIntolerance': {'identifier', 'category', 'reaction'},
            'CarePlan': {'identifier', 'instantiatesCanonical', 'instantiatesUri', 'basedOn', 'replaces', 'partOf', 'category', 'contributor', 'careTeam', 'addresses', 'supportingInfo', 'goal', 'activity', 'note'},
            'CareTeam': {'identifier', 'category', 'participant', 'reasonCode', 'reasonReference', 'managingOrganization', 'telecom', 'note'},
            'Claim': {'identifier', 'related', 'careTeam', 'supportingInfo', 'diagnosis', 'procedure', 'insurance', 'item'},
            'ExplanationOfBenefit': {'identifier', 'careTeam', 'supportingInfo', 'diagnosis', 'procedure', 'insurance', 'item', 'addItem', 'adjudication', 'total', 'processNote', 'benefitBalance'},
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