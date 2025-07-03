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
        
        # Resource-specific preprocessing
        if resource_type == 'Encounter':
            processed = self._preprocess_encounter(processed)
        elif resource_type == 'MedicationRequest':
            processed = self._preprocess_medication_request(processed)
        elif resource_type == 'Procedure':
            processed = self._preprocess_procedure(processed)
        
        return processed
    
    def _preprocess_encounter(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Encounter-specific Synthea format issues."""
        # Fix class field - in R4, class is a single Coding, not a CodeableConcept or list
        if 'class' in data:
            if isinstance(data['class'], dict) and 'coding' in data['class']:
                # Convert CodeableConcept to single Coding
                data['class'] = data['class']['coding'][0] if data['class']['coding'] else {}
            elif isinstance(data['class'], list) and len(data['class']) > 0:
                # Convert from list to single Coding
                if 'coding' in data['class'][0]:
                    data['class'] = data['class'][0]['coding'][0]
                else:
                    data['class'] = data['class'][0]
        
        # Fix period - remove extra fields
        if 'period' in data:
            allowed_fields = ['start', 'end', 'id', 'extension']
            data['period'] = {
                k: v for k, v in data['period'].items() 
                if k in allowed_fields
            }
        
        # Fix participant individual references
        if 'participant' in data:
            for participant in data['participant']:
                if 'individual' in participant:
                    # Ensure individual is a proper Reference
                    if isinstance(participant['individual'], dict):
                        # Keep only valid Reference fields
                        allowed_fields = ['reference', 'type', 'identifier', 'display']
                        cleaned_ref = {}
                        for field in allowed_fields:
                            if field in participant['individual']:
                                cleaned_ref[field] = participant['individual'][field]
                        participant['individual'] = cleaned_ref
                
                # Clean participant object - keep only allowed fields
                allowed_participant_fields = ['id', 'extension', 'modifierExtension', 'type', 'period', 'individual']
                keys_to_remove = [k for k in participant.keys() if k not in allowed_participant_fields]
                for key in keys_to_remove:
                    del participant[key]
        
        # Fix reasonCode - remove extra fields from codings
        if 'reasonCode' in data:
            for reason in data['reasonCode']:
                if 'coding' in reason:
                    for coding in reason['coding']:
                        allowed_fields = ['system', 'code', 'display', 'version', 'userSelected']
                        keys_to_remove = [k for k in coding.keys() if k not in allowed_fields]
                        for key in keys_to_remove:
                            del coding[key]
        
        # Fix hospitalization if present
        if 'hospitalization' in data:
            # Remove extra fields
            allowed_fields = ['origin', 'admitSource', 'reAdmission', 'dietPreference', 
                            'specialCourtesy', 'specialArrangement', 'destination', 
                            'dischargeDisposition', 'id', 'extension']
            data['hospitalization'] = {
                k: v for k, v in data['hospitalization'].items()
                if k in allowed_fields
            }
        
        return data
    
    def _preprocess_medication_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix MedicationRequest-specific Synthea format issues."""
        # Fix medication reference - Synthea uses medicationCodeableConcept or medicationReference
        if 'medicationCodeableConcept' in data:
            # Move to medication[x] format
            data['medication'] = data.pop('medicationCodeableConcept')
        elif 'medicationReference' in data:
            # This should be under medication[x]
            data['medication'] = data.pop('medicationReference')
        
        # Fix dosageInstruction
        if 'dosageInstruction' in data:
            for dosage in data['dosageInstruction']:
                # Fix asNeededBoolean field
                if 'asNeededBoolean' in dosage:
                    # Move to asNeeded[x]
                    dosage['asNeeded'] = dosage.pop('asNeededBoolean')
                
                # Fix timing repeat
                if 'timing' in dosage and 'repeat' in dosage['timing']:
                    repeat = dosage['timing']['repeat']
                    allowed_fields = ['boundsDuration', 'boundsPeriod', 'boundsRange',
                                    'count', 'countMax', 'duration', 'durationMax',
                                    'durationUnit', 'frequency', 'frequencyMax',
                                    'period', 'periodMax', 'periodUnit', 'dayOfWeek',
                                    'timeOfDay', 'when', 'offset', 'id', 'extension']
                    keys_to_remove = [k for k in repeat.keys() if k not in allowed_fields]
                    for key in keys_to_remove:
                        del repeat[key]
        
        # Fix reasonReference to reason
        if 'reasonReference' in data:
            data['reason'] = data.pop('reasonReference')
        
        # Fix reasonCode field
        if 'reasonCode' in data:
            # Ensure it's wrapped in reason array
            if 'reason' not in data:
                data['reason'] = []
            for code in data['reasonCode']:
                data['reason'].append({'concept': code})
            del data['reasonCode']
        
        return data
    
    def _preprocess_procedure(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Procedure-specific Synthea format issues."""
        # Fix performedPeriod - remove extra fields
        if 'performedPeriod' in data:
            allowed_fields = ['start', 'end', 'id', 'extension']
            data['performedPeriod'] = {
                k: v for k, v in data['performedPeriod'].items()
                if k in allowed_fields
            }
        
        # Fix reasonReference to reason
        if 'reasonReference' in data:
            # Convert to reason array with reference
            data['reason'] = [{'reference': ref} for ref in data.pop('reasonReference')]
        
        # Fix reasonCode
        if 'reasonCode' in data:
            # Convert to reason array with concept
            if 'reason' not in data:
                data['reason'] = []
            for code in data['reasonCode']:
                data['reason'].append({'concept': code})
            del data['reasonCode']
        
        return data
    
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