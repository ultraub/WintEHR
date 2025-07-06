"""
Tests for Profile-Aware FHIR Transformer

Tests the transformation of Synthea and other FHIR data to ensure
compatibility with fhir.resources library.
"""

import pytest
import json
from datetime import datetime
from pathlib import Path

from core.fhir.profile_transformer import (
    ProfileAwareFHIRTransformer,
    SyntheaProfileHandler,
    USCoreProfileHandler
)


class TestSyntheaProfileHandler:
    """Test Synthea-specific transformations."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.handler = SyntheaProfileHandler()
    
    def test_can_handle_synthea_data(self):
        """Test detection of Synthea data."""
        # Test with Synthea profile in meta
        resource = {
            "resourceType": "Patient",
            "meta": {
                "profile": ["http://synthea.mitre.org/fhir/StructureDefinition/Patient"]
            }
        }
        assert self.handler.can_handle(resource)
        
        # Test with Synthea identifier
        resource = {
            "resourceType": "Patient",
            "identifier": [{
                "system": "https://github.com/synthetichealth/synthea",
                "value": "123"
            }]
        }
        assert self.handler.can_handle(resource)
        
        # Test with urn:uuid reference
        resource = {
            "resourceType": "Encounter",
            "subject": {
                "reference": "urn:uuid:12345"
            }
        }
        assert self.handler.can_handle(resource)
        
        # Test non-Synthea data
        resource = {
            "resourceType": "Patient",
            "name": [{"family": "Smith"}]
        }
        assert not self.handler.can_handle(resource)
    
    def test_encounter_class_transformation(self):
        """Test Encounter.class field transformation."""
        # Test array to single Coding
        resource = {
            "resourceType": "Encounter",
            "class": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "IMP"
            }]
        }
        transformed = self.handler.transform(resource)
        assert isinstance(transformed['class'], dict)
        assert transformed['class']['code'] == 'IMP'
        
        # Test CodeableConcept to Coding
        resource = {
            "resourceType": "Encounter",
            "class": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "AMB"
                }]
            }
        }
        transformed = self.handler.transform(resource)
        assert isinstance(transformed['class'], dict)
        assert transformed['class']['code'] == 'AMB'
        assert 'coding' not in transformed['class']
    
    def test_encounter_participant_transformation(self):
        """Test Encounter participant.individual -> participant.actor."""
        resource = {
            "resourceType": "Encounter",
            "participant": [{
                "individual": {
                    "reference": "Practitioner/123"
                }
            }]
        }
        transformed = self.handler.transform(resource)
        assert 'actor' in transformed['participant'][0]
        assert 'individual' not in transformed['participant'][0]
        assert transformed['participant'][0]['actor']['reference'] == "Practitioner/123"
    
    def test_field_cleaning(self):
        """Test removal of extra fields."""
        resource = {
            "resourceType": "Encounter",
            "period": {
                "start": "2024-01-01",
                "end": "2024-01-02",
                "extra_field": "should be removed"
            }
        }
        transformed = self.handler.transform(resource)
        assert 'start' in transformed['period']
        assert 'end' in transformed['period']
        assert 'extra_field' not in transformed['period']
    
    def test_reference_transformation(self):
        """Test reference transformation."""
        resource = {
            "resourceType": "Observation",
            "subject": {
                "reference": "urn:uuid:12345-67890-abcdef",
                "display": "John Doe"
            }
        }
        transformed = self.handler.transform(resource)
        # Reference should be preserved but cleaned
        assert transformed['subject']['reference'].startswith('urn:uuid:')
        assert 'display' in transformed['subject']
        
        # Test conditional reference
        resource = {
            "resourceType": "MedicationRequest",
            "subject": {
                "reference": "Patient?identifier=12345"
            }
        }
        transformed = self.handler.transform(resource)
        assert '?' in transformed['subject']['reference']
    
    def test_array_field_handling(self):
        """Test that fields that should be arrays are arrays."""
        resource = {
            "resourceType": "Patient",
            "name": {"family": "Doe", "given": ["John"]},  # Should be array
            "identifier": {"system": "test", "value": "123"}  # Should be array
        }
        transformed = self.handler.transform(resource)
        assert isinstance(transformed['name'], list)
        assert isinstance(transformed['identifier'], list)
        assert transformed['name'][0]['family'] == "Doe"
    
    def test_medication_request_transformation(self):
        """Test MedicationRequest specific transformations."""
        # Test medication field handling
        resource = {
            "resourceType": "MedicationRequest",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "123"
                }]
            }
        }
        transformed = self.handler.transform(resource)
        assert 'medication' in transformed
        assert 'medicationCodeableConcept' not in transformed
        
        # Test dosageInstruction cleaning
        resource = {
            "resourceType": "MedicationRequest",
            "dosageInstruction": [{
                "asNeededBoolean": True,
                "timing": {
                    "repeat": {
                        "frequency": 1,
                        "period": 1,
                        "periodUnit": "d",
                        "extra_field": "remove"
                    }
                }
            }]
        }
        transformed = self.handler.transform(resource)
        assert 'asNeeded' in transformed['dosageInstruction'][0]
        assert 'asNeededBoolean' not in transformed['dosageInstruction'][0]
        assert 'extra_field' not in transformed['dosageInstruction'][0]['timing']['repeat']
    
    def test_observation_component_cleaning(self):
        """Test Observation component field cleaning."""
        resource = {
            "resourceType": "Observation",
            "component": [{
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8480-6",
                        "extra": "remove"
                    }]
                },
                "valueQuantity": {
                    "value": "120",  # String that should be float
                    "unit": "mmHg",
                    "extra_field": "remove"
                },
                "extra_component_field": "remove"
            }]
        }
        transformed = self.handler.transform(resource)
        component = transformed['component'][0]
        
        # Check code cleaning
        assert 'extra' not in component['code']['coding'][0]
        
        # Check quantity cleaning and type conversion
        assert isinstance(component['valueQuantity']['value'], float)
        assert component['valueQuantity']['value'] == 120.0
        assert 'extra_field' not in component['valueQuantity']
        assert 'extra_component_field' not in component


class TestProfileAwareFHIRTransformer:
    """Test the main transformer."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.transformer = ProfileAwareFHIRTransformer()
    
    def test_profile_detection(self):
        """Test profile detection."""
        # Synthea data
        synthea_resource = {
            "resourceType": "Patient",
            "identifier": [{
                "system": "https://github.com/synthetichealth/synthea",
                "value": "123"
            }]
        }
        handler = self.transformer.detect_profile(synthea_resource)
        assert isinstance(handler, SyntheaProfileHandler)
        
        # US Core data
        uscore_resource = {
            "resourceType": "Patient",
            "meta": {
                "profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
            }
        }
        handler = self.transformer.detect_profile(uscore_resource)
        assert isinstance(handler, USCoreProfileHandler)
    
    def test_transform_resource(self):
        """Test full resource transformation."""
        resource = {
            "resourceType": "Encounter",
            "class": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "IMP"
            }],
            "participant": [{
                "individual": {
                    "reference": "Practitioner/123"
                }
            }],
            "identifier": [{
                "system": "https://github.com/synthetichealth/synthea",
                "value": "encounter123"
            }]
        }
        
        transformed = self.transformer.transform_resource(resource)
        
        # Check class transformation
        assert isinstance(transformed['class'], dict)
        assert transformed['class']['code'] == 'IMP'
        
        # Check participant transformation
        assert 'actor' in transformed['participant'][0]
        assert 'individual' not in transformed['participant'][0]
    
    def test_bundle_transformation(self):
        """Test transformation of a bundle with multiple resources."""
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "fullUrl": "urn:uuid:patient-1",
                    "resource": {
                        "resourceType": "Patient",
                        "id": "patient-1",
                        "name": {"family": "Doe"}  # Should be array
                    }
                },
                {
                    "fullUrl": "urn:uuid:encounter-1",
                    "resource": {
                        "resourceType": "Encounter",
                        "id": "encounter-1",
                        "class": {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                            "code": "AMB"
                        },
                        "subject": {
                            "reference": "urn:uuid:patient-1"
                        }
                    }
                }
            ]
        }
        
        # Transform each entry
        for entry in bundle['entry']:
            if 'resource' in entry:
                entry['resource'] = self.transformer.transform_resource(entry['resource'])
        
        # Verify transformations
        patient = bundle['entry'][0]['resource']
        assert isinstance(patient['name'], list)
        
        encounter = bundle['entry'][1]['resource']
        assert isinstance(encounter['class'], dict)
        assert encounter['subject']['reference'] == "urn:uuid:patient-1"


class TestReferenceHandling:
    """Test reference transformation and resolution."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.handler = SyntheaProfileHandler()
    
    def test_uuid_reference_validation(self):
        """Test UUID reference format validation."""
        # Valid UUID
        ref = {"reference": "urn:uuid:550e8400-e29b-41d4-a716-446655440000"}
        transformed = self.handler._transform_reference(ref)
        assert transformed['reference'] == "urn:uuid:550e8400-e29b-41d4-a716-446655440000"
        
        # Invalid UUID (will be reformatted)
        ref = {"reference": "urn:uuid:invalid-uuid"}
        transformed = self.handler._transform_reference(ref)
        # Should attempt to clean but keep original if can't fix
        assert transformed['reference'].startswith("urn:uuid:")
    
    def test_conditional_reference_handling(self):
        """Test conditional reference handling."""
        ref = {"reference": "Patient?identifier=http://example.org/mrn|12345"}
        transformed = self.handler._transform_reference(ref)
        assert "?" in transformed['reference']
        assert "identifier=" in transformed['reference']
    
    def test_string_reference_conversion(self):
        """Test conversion of string references to Reference objects."""
        ref = "Patient/123"
        transformed = self.handler._transform_reference(ref)
        assert isinstance(transformed, dict)
        assert transformed['reference'] == "Patient/123"


class TestValidationIntegration:
    """Test integration with FHIR validation."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.transformer = ProfileAwareFHIRTransformer()
    
    @pytest.mark.asyncio
    async def test_transformed_resource_validation(self):
        """Test that transformed resources pass FHIR validation."""
        from fhir.resources import construct_fhir_element
        
        # Create a Synthea-style resource with known issues
        resource = {
            "resourceType": "Encounter",
            "id": "test-encounter",
            "status": "finished",
            "class": [{  # Wrong: should be single Coding
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "IMP",
                "display": "inpatient encounter"
            }],
            "subject": {
                "reference": "Patient/test-patient"
            },
            "period": {
                "start": "2024-01-01T10:00:00Z",
                "end": "2024-01-02T10:00:00Z"
            }
        }
        
        # Transform the resource
        transformed = self.transformer.transform_resource(resource)
        
        # Remove resourceType for validation
        data = transformed.copy()
        data.pop('resourceType')
        
        # Validate with fhir.resources
        try:
            encounter = construct_fhir_element('Encounter', data)
            assert encounter is not None
            assert encounter.status == "finished"
            assert encounter.class_fhir.code == "IMP"  # Note: field is renamed to class_fhir
        except Exception as e:
            pytest.fail(f"Transformed resource failed validation: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])