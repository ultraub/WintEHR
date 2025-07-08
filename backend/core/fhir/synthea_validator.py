"""
Enhanced FHIR Validator with Synthea Support

Extends the base validator to handle Synthea-specific formats and references.
"""

from typing import Dict, List, Optional, Any
from fhir.resources import construct_fhir_element
from fhir.resources.operationoutcome import OperationOutcome, OperationOutcomeIssue
from pydantic import ValidationError
import re

from .validator import FHIRValidator


class SyntheaFHIRValidator(FHIRValidator):
    """FHIR Validator that handles Synthea-specific formats."""
    
    def __init__(self, profile_registry: Optional[Dict[str, Any]] = None):
        super().__init__(profile_registry)
        # Track known resource IDs for reference validation
        self.known_resources = set()
        
    def validate_resource(
        self,
        resource_type: str,
        resource_data: Dict[str, Any],
        profile_url: Optional[str] = None
    ) -> OperationOutcome:
        """
        Validate a FHIR resource with Synthea format support.
        
        Pre-processes the resource to handle Synthea-specific issues before validation.
        """
        # Pre-process resource for Synthea format
        processed_data = self._preprocess_synthea_resource(resource_type, resource_data)
        
        # Add resource to known list
        if 'id' in processed_data:
            self.known_resources.add(f"{resource_type}/{processed_data['id']}")
        
        # Now do validation on processed data
        issues = []
        
        # Structural validation using fhir.resources
        structural_issues = self._validate_structure(resource_type, processed_data)
        issues.extend(structural_issues)
        
        # Profile validation if specified
        if profile_url and profile_url in self.profile_registry:
            profile_issues = self._validate_against_profile(
                resource_type, processed_data, profile_url
            )
            issues.extend(profile_issues)
        
        # Business rule validation
        business_issues = self._validate_business_rules(resource_type, processed_data)
        issues.extend(business_issues)
        
        # Create operation outcome
        if issues:
            return OperationOutcome(
                issue=issues
            )
        else:
            # Success
            return OperationOutcome(
                issue=[
                    OperationOutcomeIssue(
                        severity="information",
                        code="informational",
                        details={"text": "Validation successful"}
                    )
                ]
            )
    
    def _preprocess_synthea_resource(
        self,
        resource_type: str,
        resource_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Pre-process Synthea resources to fix known format issues."""
        # Make a copy to avoid modifying original
        import json
        processed = json.loads(json.dumps(resource_data))
        
        # Fix ID if it's a urn:uuid:
        if 'id' in processed and isinstance(processed['id'], str) and processed['id'].startswith('urn:uuid:'):
            # Convert to valid FHIR ID
            processed['id'] = processed['id'].replace('urn:uuid:', '').replace('-', '')[:64]
        
        # Remove resourceType if present - it's not a field in the model
        if 'resourceType' in processed:
            del processed['resourceType']
        
        # Resource-specific preprocessing
        if resource_type == 'Encounter':
            processed = self._preprocess_encounter(processed)
        elif resource_type == 'MedicationRequest':
            processed = self._preprocess_medication_request(processed)
        elif resource_type == 'Procedure':
            processed = self._preprocess_procedure(processed)
        elif resource_type == 'Organization':
            processed = self._preprocess_organization(processed)
        elif resource_type == 'Location':
            processed = self._preprocess_location(processed)
        elif resource_type == 'Observation':
            processed = self._preprocess_observation(processed)
        
        return processed
    
    def _preprocess_encounter(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Encounter-specific Synthea format issues."""
        # Fix class field - The fhir.resources library (R5) expects a LIST of CodeableConcept
        # Synthea provides a single Coding object following FHIR R4 spec
        # We need to convert: Coding -> [CodeableConcept]
        if 'class' in data:
            if isinstance(data['class'], dict):
                # Convert single Coding to list of CodeableConcept
                if 'system' in data['class'] and 'code' in data['class']:
                    # It's a Coding object - wrap in CodeableConcept and make it a list
                    data['class'] = [{
                        'coding': [data['class']]
                    }]
                elif 'coding' in data['class']:
                    # It's already a CodeableConcept - just make it a list
                    data['class'] = [data['class']]
            elif isinstance(data['class'], list):
                # Already a list - ensure each item is a CodeableConcept
                cleaned_classes = []
                for cls in data['class']:
                    if isinstance(cls, dict):
                        if 'coding' in cls:
                            # Already a CodeableConcept
                            cleaned_classes.append(cls)
                        elif 'system' in cls and 'code' in cls:
                            # It's a Coding - wrap in CodeableConcept
                            cleaned_classes.append({'coding': [cls]})
                data['class'] = cleaned_classes if cleaned_classes else [{'coding': [{'code': 'UNK'}]}]
            else:
                # Invalid format - create default
                data['class'] = [{'coding': [{'code': 'UNK'}]}]
        # Clean up all BackboneElement fields to remove Synthea's extra fields
        # Period - the error shows "extra fields not permitted"
        if 'period' in data and isinstance(data['period'], dict):
            # Only keep standard FHIR fields
            allowed_period_fields = {'id', 'extension', 'start', 'end'}
            data['period'] = {
                k: v for k, v in data['period'].items() 
                if k in allowed_period_fields
            }
        
        # Fix participant - the error shows participant.individual has extra fields
        if 'participant' in data:
            for i, participant in enumerate(data['participant']):
                # Clean the participant BackboneElement
                allowed_participant_fields = {'id', 'extension', 'modifierExtension', 'type', 'period', 'individual'}
                cleaned_participant = {
                    k: v for k, v in participant.items()
                    if k in allowed_participant_fields
                }
                
                # Clean the individual Reference
                if 'individual' in cleaned_participant and isinstance(cleaned_participant['individual'], dict):
                    allowed_reference_fields = {'id', 'extension', 'reference', 'type', 'identifier', 'display'}
                    cleaned_participant['individual'] = {
                        k: v for k, v in cleaned_participant['individual'].items()
                        if k in allowed_reference_fields
                    }
                
                data['participant'][i] = cleaned_participant
        
        # Fix reasonCode - the error shows "extra fields not permitted"
        if 'reasonCode' in data:
            cleaned_reasons = []
            for reason in data['reasonCode']:
                if isinstance(reason, dict):
                    # Clean the CodeableConcept
                    allowed_cc_fields = {'id', 'extension', 'coding', 'text'}
                    cleaned_reason = {
                        k: v for k, v in reason.items()
                        if k in allowed_cc_fields
                    }
                    
                    # Clean each Coding in the CodeableConcept
                    if 'coding' in cleaned_reason:
                        cleaned_codings = []
                        for coding in cleaned_reason['coding']:
                            allowed_coding_fields = {'id', 'extension', 'system', 'version', 'code', 'display', 'userSelected'}
                            cleaned_codings.append({
                                k: v for k, v in coding.items()
                                if k in allowed_coding_fields
                            })
                        cleaned_reason['coding'] = cleaned_codings
                    
                    cleaned_reasons.append(cleaned_reason)
            
            if cleaned_reasons:
                data['reasonCode'] = cleaned_reasons
            else:
                # Remove empty reasonCode
                del data['reasonCode']
        
        # Fix hospitalization - the error shows "extra fields not permitted"
        if 'hospitalization' in data and isinstance(data['hospitalization'], dict):
            allowed_hosp_fields = {
                'id', 'extension', 'modifierExtension', 'preAdmissionIdentifier',
                'origin', 'admitSource', 'reAdmission', 'dietPreference',
                'specialCourtesy', 'specialArrangement', 'destination',
                'dischargeDisposition'
            }
            data['hospitalization'] = {
                k: v for k, v in data['hospitalization'].items()
                if k in allowed_hosp_fields
            }
        
        return data
    
    def _preprocess_medication_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix MedicationRequest-specific Synthea format issues."""
        # The fhir.resources library expects medicationCodeableConcept or medicationReference
        # NOT a medication field. Synthea outputs medication as a CodeableConcept
        
        # Check if medication exists and transform it
        if 'medication' in data and isinstance(data['medication'], dict):
            # Check if it's a CodeableConcept (has coding or text)
            if 'coding' in data['medication'] or 'text' in data['medication']:
                # It's a CodeableConcept - clean and move to medicationCodeableConcept
                allowed_cc_fields = {'id', 'extension', 'coding', 'text'}
                cleaned_med = {
                    k: v for k, v in data['medication'].items()
                    if k in allowed_cc_fields
                }
                
                # Clean the codings
                if 'coding' in cleaned_med:
                    cleaned_codings = []
                    for coding in cleaned_med['coding']:
                        allowed_coding_fields = {'id', 'extension', 'system', 'version', 'code', 'display', 'userSelected'}
                        cleaned_codings.append({
                            k: v for k, v in coding.items()
                            if k in allowed_coding_fields
                        })
                    cleaned_med['coding'] = cleaned_codings
                
                # Move to medicationCodeableConcept
                data['medicationCodeableConcept'] = cleaned_med
                del data['medication']
            
            # Check if it's a Reference (has reference field)
            elif 'reference' in data['medication']:
                # It's a Reference - clean it
                allowed_ref_fields = {'id', 'extension', 'reference', 'type', 'identifier', 'display'}
                data['medication'] = {
                    k: v for k, v in data['medication'].items()
                    if k in allowed_ref_fields
                }
        
        # Fix medicationCodeableConcept if it exists (older Synthea format)
        if 'medicationCodeableConcept' in data:
            data['medication'] = data.pop('medicationCodeableConcept')
        elif 'medicationReference' in data:
            data['medication'] = data.pop('medicationReference')
        
        # Fix reason field - the error shows "reason -> 0 -> reference" and "reason -> 0 -> display" issues
        # This suggests reason is an array with improper Reference objects
        if 'reason' in data and isinstance(data['reason'], list):
            cleaned_reasons = []
            for reason in data['reason']:
                if isinstance(reason, dict):
                    # Check if it's a reference (for backward compatibility)
                    if 'reference' in reason:
                        # Wrap in proper structure
                        cleaned_reasons.append({
                            'reference': {
                                'reference': reason['reference'],
                                'display': reason.get('display')
                            }
                        })
                    # Check if it's already properly structured
                    elif 'concept' in reason or 'reference' in reason:
                        # Clean the reason BackboneElement
                        allowed_reason_fields = {'id', 'extension', 'concept', 'reference'}
                        cleaned_reason = {
                            k: v for k, v in reason.items()
                            if k in allowed_reason_fields
                        }
                        
                        # Clean nested reference if present
                        if 'reference' in cleaned_reason and isinstance(cleaned_reason['reference'], dict):
                            allowed_ref_fields = {'id', 'extension', 'reference', 'type', 'identifier', 'display'}
                            cleaned_reason['reference'] = {
                                k: v for k, v in cleaned_reason['reference'].items()
                                if k in allowed_ref_fields
                            }
                        
                        cleaned_reasons.append(cleaned_reason)
            
            if cleaned_reasons:
                data['reason'] = cleaned_reasons
            else:
                del data['reason']
        
        # Fix reasonReference (older format)
        if 'reasonReference' in data:
            if isinstance(data['reasonReference'], list):
                data['reason'] = [{'reference': ref} for ref in data['reasonReference']]
            else:
                data['reason'] = [{'reference': data['reasonReference']}]
            del data['reasonReference']
        
        # Fix reasonCode (convert to reason with concept)
        if 'reasonCode' in data:
            if 'reason' not in data:
                data['reason'] = []
            for code in data['reasonCode']:
                data['reason'].append({'concept': code})
            del data['reasonCode']
        
        # Fix dosageInstruction
        if 'dosageInstruction' in data:
            for dosage in data['dosageInstruction']:
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
                keys_to_remove = [k for k in dosage.keys() if k not in allowed_dosage_fields]
                for key in keys_to_remove:
                    del dosage[key]
                
                # Clean timing if present
                if 'timing' in dosage and isinstance(dosage['timing'], dict):
                    allowed_timing_fields = {'id', 'extension', 'modifierExtension', 'event', 'repeat', 'code'}
                    dosage['timing'] = {
                        k: v for k, v in dosage['timing'].items()
                        if k in allowed_timing_fields
                    }
                    
                    # Clean repeat if present
                    if 'repeat' in dosage['timing'] and isinstance(dosage['timing']['repeat'], dict):
                        allowed_repeat_fields = {
                            'id', 'extension', 'boundsDuration', 'boundsRange', 'boundsPeriod',
                            'count', 'countMax', 'duration', 'durationMax', 'durationUnit',
                            'frequency', 'frequencyMax', 'period', 'periodMax', 'periodUnit',
                            'dayOfWeek', 'timeOfDay', 'when', 'offset'
                        }
                        dosage['timing']['repeat'] = {
                            k: v for k, v in dosage['timing']['repeat'].items()
                            if k in allowed_repeat_fields
                        }
        
        return data
    
    def _preprocess_procedure(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Procedure-specific Synthea format issues."""
        # The error shows "performedPeriod - extra fields not permitted"
        # Clean the Period to only include allowed fields
        if 'performedPeriod' in data and isinstance(data['performedPeriod'], dict):
            allowed_period_fields = {'id', 'extension', 'start', 'end'}
            data['performedPeriod'] = {
                k: v for k, v in data['performedPeriod'].items()
                if k in allowed_period_fields
            }
        
        # Fix reasonReference to reason (for older Synthea versions)
        if 'reasonReference' in data:
            # Convert to reason array with reference
            if isinstance(data['reasonReference'], list):
                data['reason'] = [{'reference': ref} for ref in data['reasonReference']]
            else:
                data['reason'] = [{'reference': data['reasonReference']}]
            del data['reasonReference']
        
        # Fix reasonCode (convert to reason with concept)
        if 'reasonCode' in data:
            if 'reason' not in data:
                data['reason'] = []
            for code in data['reasonCode']:
                data['reason'].append({'concept': code})
            del data['reasonCode']
        
        # Clean any existing reason field
        if 'reason' in data and isinstance(data['reason'], list):
            cleaned_reasons = []
            for reason in data['reason']:
                if isinstance(reason, dict):
                    # Clean the reason BackboneElement
                    allowed_reason_fields = {'id', 'extension', 'concept', 'reference'}
                    cleaned_reason = {
                        k: v for k, v in reason.items()
                        if k in allowed_reason_fields
                    }
                    
                    # Clean nested reference if present
                    if 'reference' in cleaned_reason and isinstance(cleaned_reason['reference'], dict):
                        allowed_ref_fields = {'id', 'extension', 'reference', 'type', 'identifier', 'display'}
                        cleaned_reason['reference'] = {
                            k: v for k, v in cleaned_reason['reference'].items()
                            if k in allowed_ref_fields
                        }
                    
                    # Clean nested concept if present
                    if 'concept' in cleaned_reason and isinstance(cleaned_reason['concept'], dict):
                        allowed_cc_fields = {'id', 'extension', 'coding', 'text'}
                        cleaned_reason['concept'] = {
                            k: v for k, v in cleaned_reason['concept'].items()
                            if k in allowed_cc_fields
                        }
                    
                    cleaned_reasons.append(cleaned_reason)
            
            if cleaned_reasons:
                data['reason'] = cleaned_reasons
            else:
                del data['reason']
        
        # Clean performer field if present
        if 'performer' in data and isinstance(data['performer'], list):
            cleaned_performers = []
            for performer in data['performer']:
                if isinstance(performer, dict):
                    # Clean the performer BackboneElement
                    allowed_performer_fields = {'id', 'extension', 'modifierExtension', 'function', 'actor', 'onBehalfOf'}
                    cleaned_performer = {
                        k: v for k, v in performer.items()
                        if k in allowed_performer_fields
                    }
                    
                    # Clean nested references
                    for ref_field in ['actor', 'onBehalfOf']:
                        if ref_field in cleaned_performer and isinstance(cleaned_performer[ref_field], dict):
                            allowed_ref_fields = {'id', 'extension', 'reference', 'type', 'identifier', 'display'}
                            cleaned_performer[ref_field] = {
                                k: v for k, v in cleaned_performer[ref_field].items()
                                if k in allowed_ref_fields
                            }
                    
                    cleaned_performers.append(cleaned_performer)
            
            data['performer'] = cleaned_performers
        
        return data
    
    def _preprocess_observation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Observation-specific format issues, particularly for components and reference ranges."""
        # Clean component field if present
        if 'component' in data and isinstance(data['component'], list):
            cleaned_components = []
            for component in data['component']:
                if isinstance(component, dict):
                    # Clean the component BackboneElement
                    allowed_component_fields = {
                        'id', 'extension', 'modifierExtension', 'code', 
                        'valueQuantity', 'valueCodeableConcept', 'valueString',
                        'valueBoolean', 'valueInteger', 'valueRange', 'valueRatio',
                        'valueSampledData', 'valueTime', 'valueDateTime', 'valuePeriod',
                        'dataAbsentReason', 'interpretation', 'referenceRange'
                    }
                    cleaned_component = {
                        k: v for k, v in component.items()
                        if k in allowed_component_fields
                    }
                    
                    # Clean nested CodeableConcept (code)
                    if 'code' in cleaned_component and isinstance(cleaned_component['code'], dict):
                        allowed_cc_fields = {'id', 'extension', 'coding', 'text'}
                        cleaned_component['code'] = {
                            k: v for k, v in cleaned_component['code'].items()
                            if k in allowed_cc_fields
                        }
                        
                        # Clean nested Coding
                        if 'coding' in cleaned_component['code']:
                            cleaned_codings = []
                            for coding in cleaned_component['code']['coding']:
                                allowed_coding_fields = {'id', 'extension', 'system', 'version', 'code', 'display', 'userSelected'}
                                cleaned_codings.append({
                                    k: v for k, v in coding.items()
                                    if k in allowed_coding_fields
                                })
                            cleaned_component['code']['coding'] = cleaned_codings
                    
                    # Clean valueQuantity if present
                    if 'valueQuantity' in cleaned_component and isinstance(cleaned_component['valueQuantity'], dict):
                        allowed_quantity_fields = {'id', 'extension', 'value', 'comparator', 'unit', 'system', 'code'}
                        cleaned_quantity = {
                            k: v for k, v in cleaned_component['valueQuantity'].items()
                            if k in allowed_quantity_fields
                        }
                        # Ensure value is numeric
                        if 'value' in cleaned_quantity and cleaned_quantity['value'] is not None:
                            try:
                                cleaned_quantity['value'] = float(cleaned_quantity['value'])
                            except (ValueError, TypeError):
                                pass
                        cleaned_component['valueQuantity'] = cleaned_quantity
                    
                    cleaned_components.append(cleaned_component)
            
            data['component'] = cleaned_components
        
        # Clean referenceRange field if present
        if 'referenceRange' in data and isinstance(data['referenceRange'], list):
            cleaned_ranges = []
            for ref_range in data['referenceRange']:
                if isinstance(ref_range, dict):
                    # Clean the referenceRange BackboneElement
                    allowed_range_fields = {
                        'id', 'extension', 'modifierExtension', 'low', 'high',
                        'type', 'appliesTo', 'age', 'text'
                    }
                    cleaned_range = {
                        k: v for k, v in ref_range.items()
                        if k in allowed_range_fields
                    }
                    
                    # Clean low/high Quantity fields
                    for quantity_field in ['low', 'high']:
                        if quantity_field in cleaned_range and isinstance(cleaned_range[quantity_field], dict):
                            allowed_quantity_fields = {'id', 'extension', 'value', 'comparator', 'unit', 'system', 'code'}
                            cleaned_quantity = {
                                k: v for k, v in cleaned_range[quantity_field].items()
                                if k in allowed_quantity_fields
                            }
                            # Ensure value is numeric
                            if 'value' in cleaned_quantity and cleaned_quantity['value'] is not None:
                                try:
                                    cleaned_quantity['value'] = float(cleaned_quantity['value'])
                                except (ValueError, TypeError):
                                    pass
                            cleaned_range[quantity_field] = cleaned_quantity
                    
                    cleaned_ranges.append(cleaned_range)
            
            data['referenceRange'] = cleaned_ranges
        
        # Clean interpretation field if present
        if 'interpretation' in data and isinstance(data['interpretation'], list):
            cleaned_interpretations = []
            for interpretation in data['interpretation']:
                if isinstance(interpretation, dict):
                    allowed_cc_fields = {'id', 'extension', 'coding', 'text'}
                    cleaned_interpretation = {
                        k: v for k, v in interpretation.items()
                        if k in allowed_cc_fields
                    }
                    
                    # Clean nested Coding
                    if 'coding' in cleaned_interpretation:
                        cleaned_codings = []
                        for coding in cleaned_interpretation['coding']:
                            allowed_coding_fields = {'id', 'extension', 'system', 'version', 'code', 'display', 'userSelected'}
                            cleaned_codings.append({
                                k: v for k, v in coding.items()
                                if k in allowed_coding_fields
                            })
                        cleaned_interpretation['coding'] = cleaned_codings
                    
                    cleaned_interpretations.append(cleaned_interpretation)
            
            data['interpretation'] = cleaned_interpretations
        
        # Clean main valueQuantity if present
        if 'valueQuantity' in data and isinstance(data['valueQuantity'], dict):
            allowed_quantity_fields = {'id', 'extension', 'value', 'comparator', 'unit', 'system', 'code'}
            cleaned_quantity = {
                k: v for k, v in data['valueQuantity'].items()
                if k in allowed_quantity_fields
            }
            # Ensure value is numeric
            if 'value' in cleaned_quantity and cleaned_quantity['value'] is not None:
                try:
                    cleaned_quantity['value'] = float(cleaned_quantity['value'])
                except (ValueError, TypeError):
                    pass
            data['valueQuantity'] = cleaned_quantity
        
        return data
    
    def _preprocess_organization(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Organization-specific Synthea format issues."""
        # Synthea adds custom extensions that may cause validation issues
        # Keep only standard extensions if validation fails
        if 'extension' in data and isinstance(data['extension'], list):
            # For now, keep all extensions but ensure they're properly structured
            cleaned_extensions = []
            for ext in data['extension']:
                if isinstance(ext, dict) and 'url' in ext:
                    # Basic extension structure validation
                    allowed_ext_fields = {'id', 'extension', 'url', 'valueString', 'valueInteger', 
                                        'valueBoolean', 'valueDateTime', 'valueCodeableConcept',
                                        'valueReference', 'valuePeriod', 'valueQuantity'}
                    cleaned_ext = {
                        k: v for k, v in ext.items()
                        if k in allowed_ext_fields or k.startswith('value')
                    }
                    cleaned_extensions.append(cleaned_ext)
            
            if cleaned_extensions:
                data['extension'] = cleaned_extensions
            else:
                del data['extension']
        
        # Clean address if present
        if 'address' in data and isinstance(data['address'], list):
            cleaned_addresses = []
            for addr in data['address']:
                if isinstance(addr, dict):
                    allowed_addr_fields = {'id', 'extension', 'use', 'type', 'text', 'line',
                                         'city', 'district', 'state', 'postalCode', 'country', 'period'}
                    cleaned_addresses.append({
                        k: v for k, v in addr.items()
                        if k in allowed_addr_fields
                    })
            data['address'] = cleaned_addresses
        
        # Clean telecom if present
        if 'telecom' in data and isinstance(data['telecom'], list):
            cleaned_telecoms = []
            for telecom in data['telecom']:
                if isinstance(telecom, dict):
                    allowed_telecom_fields = {'id', 'extension', 'system', 'value', 'use', 'rank', 'period'}
                    cleaned_telecoms.append({
                        k: v for k, v in telecom.items()
                        if k in allowed_telecom_fields
                    })
            data['telecom'] = cleaned_telecoms
        
        return data
    
    def _preprocess_location(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Location-specific Synthea format issues."""
        # Similar to Organization, clean any Synthea-specific extensions
        if 'extension' in data and isinstance(data['extension'], list):
            cleaned_extensions = []
            for ext in data['extension']:
                if isinstance(ext, dict) and 'url' in ext:
                    allowed_ext_fields = {'id', 'extension', 'url', 'valueString', 'valueInteger', 
                                        'valueBoolean', 'valueDateTime', 'valueCodeableConcept',
                                        'valueReference', 'valuePeriod', 'valueQuantity'}
                    cleaned_ext = {
                        k: v for k, v in ext.items()
                        if k in allowed_ext_fields or k.startswith('value')
                    }
                    cleaned_extensions.append(cleaned_ext)
            
            if cleaned_extensions:
                data['extension'] = cleaned_extensions
            else:
                del data['extension']
        
        # Clean position if present
        if 'position' in data and isinstance(data['position'], dict):
            allowed_position_fields = {'id', 'extension', 'longitude', 'latitude', 'altitude'}
            data['position'] = {
                k: v for k, v in data['position'].items()
                if k in allowed_position_fields
            }
        
        # Clean address
        if 'address' in data and isinstance(data['address'], dict):
            allowed_addr_fields = {'id', 'extension', 'use', 'type', 'text', 'line',
                                 'city', 'district', 'state', 'postalCode', 'country', 'period'}
            data['address'] = {
                k: v for k, v in data['address'].items()
                if k in allowed_addr_fields
            }
        
        # Clean managingOrganization reference
        if 'managingOrganization' in data and isinstance(data['managingOrganization'], dict):
            allowed_ref_fields = {'id', 'extension', 'reference', 'type', 'identifier', 'display'}
            data['managingOrganization'] = {
                k: v for k, v in data['managingOrganization'].items()
                if k in allowed_ref_fields
            }
        
        return data
    
    def _validate_structure(
        self,
        resource_type: str,
        resource_data: Dict[str, Any]
    ) -> List[OperationOutcomeIssue]:
        """
        Validate resource structure with Synthea preprocessing.
        
        This overrides the parent method to ensure preprocessing happens
        before structural validation.
        """
        # IMPORTANT: The resource_data here has already been preprocessed
        # by validate_resource method, so we can call parent directly
        return super()._validate_structure(resource_type, resource_data)
    
    def _is_valid_reference(self, reference: str) -> bool:
        """
        Extended reference validation that accepts Synthea formats.
        
        Accepts:
        - Standard FHIR: ResourceType/id
        - Contained: #id
        - URL: http(s)://...
        - UUID: urn:uuid:...
        - Conditional: ResourceType?search-params
        """
        if not reference:
            return False
        
        # Standard internal reference
        if '/' in reference and not reference.startswith('http'):
            parts = reference.split('/')
            if len(parts) == 2 and parts[0] and parts[1]:
                return True
        
        # Contained reference
        if reference.startswith('#'):
            return len(reference) > 1
        
        # External URL reference
        if reference.startswith(('http://', 'https://')):
            return True
        
        # UUID reference (Synthea format)
        if reference.startswith('urn:uuid:'):
            # Valid UUID format
            uuid_part = reference[9:]  # Remove 'urn:uuid:'
            uuid_pattern = re.compile(
                r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                re.IGNORECASE
            )
            return bool(uuid_pattern.match(uuid_part))
        
        # Conditional reference (Synthea format)
        if '?' in reference:
            # Format: ResourceType?search-params
            parts = reference.split('?', 1)
            if len(parts) == 2 and parts[0] and parts[1]:
                # Basic validation - resource type exists and has search params
                return True
        
        return False
    
    def _validate_business_rules(
        self,
        resource_type: str,
        resource_data: Dict[str, Any]
    ) -> List[OperationOutcomeIssue]:
        """
        Apply business rules with Synthea awareness.
        
        Relaxes some rules for Synthea-generated data while maintaining
        data integrity.
        """
        issues = []
        
        # Get base business rule issues
        base_issues = super()._validate_business_rules(resource_type, resource_data)
        
        # Filter out issues that are acceptable for Synthea data
        for issue in base_issues:
            # Skip reference format errors for Synthea-style references
            if (issue.code == 'business-rule' and 
                hasattr(issue.details, 'get') and
                'Invalid reference format' in issue.details.get('text', '') and
                any(ref_format in issue.details.get('text', '') 
                    for ref_format in ['urn:uuid:', '?identifier='])):
                # These are valid Synthea references
                continue
            
            # Keep all other issues
            issues.append(issue)
        
        return issues