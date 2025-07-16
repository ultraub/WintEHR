"""
Comprehensive FHIR Multi-Version Compliance Test Suite
Tests version detection, negotiation, transformation, and API compatibility
"""

import pytest
import asyncio
from typing import Dict, Any
from unittest.mock import Mock, AsyncMock, patch

from fhir.core.versioning.negotiator import (
    FHIRVersion, 
    FHIRVersionNegotiator, 
    VersionDetectionResult,
    NegotiationResult
)
from fhir.core.versioning.transformer import (
    FHIRVersionTransformer,
    MedicationRequestTransformer,
    PatientTransformer,
    TransformationResult
)
from fhir.core.storage import FHIRStorageEngine


class TestFHIRVersionDetection:
    """Test FHIR version detection capabilities"""
    
    def setup_method(self):
        self.negotiator = FHIRVersionNegotiator()
    
    def test_detect_r4_medication_request(self):
        """Test detection of R4 MedicationRequest"""
        r4_medication = {
            "resourceType": "MedicationRequest",
            "id": "test-123",
            "fhirVersion": "4.0.1",
            "medicationCodeableConcept": {
                "coding": [
                    {
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "1049502",
                        "display": "Acetaminophen 325 MG Oral Tablet"
                    }
                ]
            },
            "meta": {
                "profile": ["http://hl7.org/fhir/StructureDefinition/MedicationRequest"]
            }
        }
        
        result = self.negotiator.detect_version_from_resource(r4_medication)
        
        assert result.detected_version == FHIRVersion.R4
        assert result.confidence > 0.7
        assert any("fhirVersion field: 4.0.1" in indicator for indicator in result.indicators)
    
    def test_detect_r5_medication_request(self):
        """Test detection of R5 MedicationRequest"""
        r5_medication = {
            "resourceType": "MedicationRequest",
            "id": "test-456",
            "fhirVersion": "5.0.0",
            "medication": {
                "concept": {
                    "coding": [
                        {
                            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                            "code": "1049502",
                            "display": "Acetaminophen 325 MG Oral Tablet"
                        }
                    ]
                }
            },
            "meta": {
                "profile": ["http://hl7.org/fhir/R5/StructureDefinition/MedicationRequest"]
            }
        }
        
        result = self.negotiator.detect_version_from_resource(r5_medication)
        
        assert result.detected_version == FHIRVersion.R5
        assert result.confidence > 0.7
        assert any("medication.concept" in indicator for indicator in result.indicators)
    
    def test_detect_version_with_fallback(self):
        """Test version detection with fallback when unclear"""
        unclear_resource = {
            "resourceType": "Patient",
            "id": "test-789",
            "name": [{"family": "Doe", "given": ["John"]}]
        }
        
        result = self.negotiator.detect_version_from_resource(unclear_resource)
        
        assert result.detected_version == FHIRVersion.R4  # Default fallback
        assert result.confidence < 0.5
    
    def test_extract_version_from_accept_header(self):
        """Test parsing FHIR version from HTTP Accept header"""
        test_cases = [
            ("application/fhir+json; fhirVersion=4.0.1", [FHIRVersion.R4]),
            ("application/fhir+json; fhirVersion=5.0.0", [FHIRVersion.R5]),
            ("application/fhir+json; fhirVersion=6.0.0", [FHIRVersion.R6]),
            ("application/json", [FHIRVersion.R4])  # Default fallback
        ]
        
        for accept_header, expected_versions in test_cases:
            result = self.negotiator.extract_version_from_accept_header(accept_header)
            assert result == expected_versions


class TestFHIRVersionNegotiation:
    """Test FHIR version negotiation logic"""
    
    def setup_method(self):
        self.negotiator = FHIRVersionNegotiator()
    
    def test_negotiate_exact_match(self):
        """Test negotiation when client and server versions match exactly"""
        result = self.negotiator.negotiate_version(
            client_preferences=[FHIRVersion.R5],
            server_capabilities=[FHIRVersion.R4, FHIRVersion.R5, FHIRVersion.R6]
        )
        
        assert result.target_version == FHIRVersion.R5
        assert result.transformation_needed == False
        assert result.compatibility_level == 'full'
    
    def test_negotiate_with_transformation(self):
        """Test negotiation requiring transformation"""
        result = self.negotiator.negotiate_version(
            client_preferences=[FHIRVersion.R5],
            resource_version=FHIRVersion.R4,
            server_capabilities=[FHIRVersion.R4, FHIRVersion.R5]
        )
        
        assert result.target_version == FHIRVersion.R5
        assert result.source_version == FHIRVersion.R4
        assert result.transformation_needed == True
        assert result.compatibility_level == 'partial'
    
    def test_negotiate_fallback_to_server_capability(self):
        """Test fallback when client preferences not supported"""
        result = self.negotiator.negotiate_version(
            client_preferences=[FHIRVersion.R6],
            server_capabilities=[FHIRVersion.R4, FHIRVersion.R5]
        )
        
        assert result.target_version == FHIRVersion.R5  # Highest server capability
        # transformation_needed should be False since no resource version was provided
        assert result.transformation_needed == False
    
    def test_assess_transformation_complexity(self):
        """Test transformation complexity assessment"""
        # R4 to R5 transformation (moderate complexity)
        result = self.negotiator.assess_transformation_complexity(
            FHIRVersion.R4, FHIRVersion.R5, 'MedicationRequest'
        )
        
        assert result['complexity'] == 'medium'
        assert result['success_probability'] == 0.95
        assert 'medicationCodeableConcept -> medication.concept' in result['transformations_needed']
        
        # No transformation needed
        no_transform = self.negotiator.assess_transformation_complexity(
            FHIRVersion.R4, FHIRVersion.R4, 'Patient'
        )
        
        assert no_transform['complexity'] == 'none'
        assert no_transform['success_probability'] == 1.0


class TestFHIRVersionTransformation:
    """Test FHIR version transformation capabilities"""
    
    def setup_method(self):
        self.transformer = FHIRVersionTransformer()
        self.medication_transformer = MedicationRequestTransformer()
        self.patient_transformer = PatientTransformer()
    
    def test_medication_request_r4_to_r5(self):
        """Test MedicationRequest transformation from R4 to R5"""
        r4_medication = {
            "resourceType": "MedicationRequest",
            "id": "test-medication",
            "fhirVersion": "4.0.1",
            "medicationCodeableConcept": {
                "coding": [
                    {
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "1049502",
                        "display": "Acetaminophen 325 MG Oral Tablet"
                    }
                ],
                "text": "Acetaminophen 325 MG Oral Tablet"
            },
            "subject": {
                "reference": "Patient/123"
            }
        }
        
        result = self.medication_transformer.transform(
            r4_medication, FHIRVersion.R4, FHIRVersion.R5
        )
        
        assert result.success == True
        assert result.target_version == FHIRVersion.R5
        assert 'medicationCodeableConcept' not in result.transformed_resource
        assert 'medication' in result.transformed_resource
        assert 'concept' in result.transformed_resource['medication']
        assert 'fhirVersion' not in result.transformed_resource
    
    def test_medication_request_r5_to_r4(self):
        """Test MedicationRequest transformation from R5 to R4"""
        r5_medication = {
            "resourceType": "MedicationRequest",
            "id": "test-medication-r5",
            "fhirVersion": "5.0.0",
            "medication": {
                "concept": {
                    "coding": [
                        {
                            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                            "code": "1049502",
                            "display": "Acetaminophen 325 MG Oral Tablet"
                        }
                    ],
                    "text": "Acetaminophen 325 MG Oral Tablet"
                }
            },
            "subject": {
                "reference": "Patient/456"
            }
        }
        
        result = self.medication_transformer.transform(
            r5_medication, FHIRVersion.R5, FHIRVersion.R4
        )
        
        assert result.success == True
        assert result.target_version == FHIRVersion.R4
        assert 'medication' not in result.transformed_resource
        assert 'medicationCodeableConcept' in result.transformed_resource
        assert 'fhirVersion' not in result.transformed_resource
    
    def test_patient_transformation_with_r6_enhancements(self):
        """Test Patient transformation with R6 enhancements"""
        r4_patient = {
            "resourceType": "Patient",
            "id": "test-patient",
            "name": [{"family": "Smith", "given": ["Jane"]}],
            "gender": "female"
        }
        
        result = self.patient_transformer.transform(
            r4_patient, FHIRVersion.R4, FHIRVersion.R6
        )
        
        assert result.success == True
        assert result.target_version == FHIRVersion.R6
        assert 'fhirVersion' not in result.transformed_resource
        assert 'extension' in result.transformed_resource
        # Check for R6 pronouns extension
        pronouns_ext = next(
            (ext for ext in result.transformed_resource['extension'] 
             if 'patient-pronouns' in ext['url']), 
            None
        )
        assert pronouns_ext is not None
    
    def test_bundle_transformation(self):
        """Test transformation of FHIR Bundle with multiple resources"""
        bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "entry": [
                {
                    "resource": {
                        "resourceType": "MedicationRequest",
                        "id": "med-1",
                        "fhirVersion": "4.0.1",
                        "medicationCodeableConcept": {
                            "text": "Aspirin"
                        }
                    }
                },
                {
                    "resource": {
                        "resourceType": "Patient",
                        "id": "patient-1",
                        "name": [{"family": "Doe"}]
                    }
                }
            ]
        }
        
        result = self.transformer.transform_bundle(bundle, FHIRVersion.R5)
        
        assert 'fhirVersion' not in result
        
        # Check MedicationRequest was transformed
        med_resource = result['entry'][0]['resource']
        assert 'medicationCodeableConcept' not in med_resource
        assert 'medication' in med_resource
        
        # Check Patient was updated
        patient_resource = result['entry'][1]['resource']
        assert 'fhirVersion' not in patient_resource
    
    def test_transformation_with_data_loss_warning(self):
        """Test transformation that results in data loss warnings"""
        r6_medication = {
            "resourceType": "MedicationRequest",
            "id": "r6-test",
            "fhirVersion": "6.0.0",
            "dosageInstruction": [{
                "text": "Take twice daily",
                "enhancedInstructions": {
                    "text": "Take twice daily with food",
                    "machineReadable": True
                }
            }]
        }
        
        result = self.medication_transformer.transform(
            r6_medication, FHIRVersion.R6, FHIRVersion.R5
        )
        
        assert result.success == True
        assert len(result.data_loss) > 0
        assert any("Enhanced dosage instructions simplified" in loss for loss in result.data_loss)


class TestFHIRStorageMultiVersion:
    """Test FHIR storage with multi-version support"""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock()
    
    @pytest.fixture
    def storage_engine(self, mock_session):
        return FHIRStorageEngine(mock_session, FHIRVersion.R4)
    
    @pytest.mark.asyncio
    async def test_create_resource_with_version_transform(self, storage_engine, mock_session):
        """Test creating resource with automatic version transformation"""
        
        # Mock database operations
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        
        r5_medication = {
            "resourceType": "MedicationRequest",
            "fhirVersion": "5.0.0",
            "status": "active",
            "intent": "order",
            "subject": {"reference": "Patient/test-patient"},
            "medication": {
                "concept": {
                    "text": "Test Medication"
                }
            }
        }
        
        # The storage engine should transform R5 to R4 (default version)
        # Create a version of the resource without fhirVersion for preprocessing
        processed_medication = {k: v for k, v in r5_medication.items() if k != 'fhirVersion'}
        with patch.object(storage_engine.validator, '_preprocess_synthea_resource', return_value=processed_medication):
            with patch('fhir.resources.construct_fhir_element') as mock_construct:
                mock_fhir_resource = Mock()
                mock_fhir_resource.dict.return_value = {
                    "resourceType": "MedicationRequest",
                    "id": "test-123",
                    "status": "active",
                    "intent": "order",
                    "subject": {"reference": "Patient/test-patient"},
                    "medicationCodeableConcept": {"text": "Test Medication"}
                }
                mock_construct.return_value = mock_fhir_resource
                
                fhir_id, version_id, last_updated = await storage_engine.create_resource(
                    "MedicationRequest", r5_medication, target_version=FHIRVersion.R4
                )
                
                assert fhir_id is not None
                assert version_id == 1


class TestAPIVersionRouting:
    """Test version-aware API routing"""
    
    def test_version_parsing(self):
        """Test parsing of version parameters"""
        try:
            from fhir.api.version_router import VersionAwareFHIRRouter
            
            router = VersionAwareFHIRRouter()
            
            test_cases = [
                ("R4", FHIRVersion.R4),
                ("r4", FHIRVersion.R4),
                ("4.0.1", FHIRVersion.R4),
                ("R5", FHIRVersion.R5),
                ("5.0.0", FHIRVersion.R5),
                ("R6", FHIRVersion.R6),
                ("6.0", FHIRVersion.R6)
            ]
            
            for version_str, expected_version in test_cases:
                result = router._parse_version(version_str)
                assert result == expected_version
        except ImportError as e:
            pytest.skip(f"Skipping version parsing test due to missing dependency: {e}")
    
    def test_invalid_version_parsing(self):
        """Test handling of invalid version parameters"""
        try:
            from fhir.api.version_router import VersionAwareFHIRRouter
            from fastapi import HTTPException
            
            router = VersionAwareFHIRRouter()
            
            with pytest.raises(HTTPException) as exc_info:
                router._parse_version("R7")
            
            assert exc_info.value.status_code == 400
            assert "Unsupported FHIR version" in str(exc_info.value.detail)
        except ImportError as e:
            pytest.skip(f"Skipping invalid version parsing test due to missing dependency: {e}")


class TestPerformanceAndBenchmarks:
    """Performance tests for version transformations"""
    
    def setup_method(self):
        self.transformer = FHIRVersionTransformer()
    
    def test_transformation_performance(self):
        """Test performance of version transformations"""
        import time
        
        # Create a complex resource for testing
        complex_medication = {
            "resourceType": "MedicationRequest",
            "id": "perf-test",
            "fhirVersion": "4.0.1",
            "medicationCodeableConcept": {
                "coding": [
                    {
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "1049502",
                        "display": "Acetaminophen 325 MG Oral Tablet"
                    }
                ],
                "text": "Acetaminophen 325 MG Oral Tablet"
            },
            "dosageInstruction": [
                {
                    "text": "Take 1-2 tablets every 4-6 hours as needed",
                    "timing": {
                        "repeat": {
                            "frequency": 1,
                            "period": 6,
                            "periodUnit": "h"
                        }
                    }
                }
            ]
        }
        
        # Measure transformation time
        start_time = time.time()
        
        # Perform 100 transformations
        for _ in range(100):
            result = self.transformer.transform_resource(
                complex_medication, FHIRVersion.R5
            )
            assert result.success
        
        end_time = time.time()
        total_time = end_time - start_time
        avg_time = total_time / 100
        
        # Assert reasonable performance (< 10ms per transformation)
        assert avg_time < 0.01, f"Transformation too slow: {avg_time:.4f}s average"
    
    def test_bundle_transformation_performance(self):
        """Test performance of bundle transformations"""
        import time
        
        # Create a large bundle
        bundle_entries = []
        for i in range(50):
            bundle_entries.append({
                "resource": {
                    "resourceType": "MedicationRequest",
                    "id": f"med-{i}",
                    "fhirVersion": "4.0.1",
                    "medicationCodeableConcept": {"text": f"Medication {i}"}
                }
            })
        
        large_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "entry": bundle_entries
        }
        
        start_time = time.time()
        result = self.transformer.transform_bundle(large_bundle, FHIRVersion.R5)
        end_time = time.time()
        
        transformation_time = end_time - start_time
        
        # Assert bundle transformation completes in reasonable time
        assert transformation_time < 1.0, f"Bundle transformation too slow: {transformation_time:.4f}s"
        assert 'fhirVersion' not in result
        assert len(result['entry']) == 50


class TestIntegrationCompliance:
    """Integration tests for full multi-version workflow"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_version_workflow(self):
        """Test complete workflow from client request to response"""
        
        # Simulate client sending R4 resource
        r4_resource = {
            "resourceType": "MedicationRequest",
            "medicationCodeableConcept": {"text": "Aspirin"},
            "subject": {"reference": "Patient/123"}
        }
        
        # Client prefers R5 (via Accept header)
        accept_header = "application/fhir+json; fhirVersion=5.0.0"
        
        # 1. Version negotiation
        negotiator = FHIRVersionNegotiator()
        client_prefs = negotiator.extract_version_from_accept_header(accept_header)
        negotiation = negotiator.negotiate_version(
            client_preferences=client_prefs,
            server_capabilities=[FHIRVersion.R4, FHIRVersion.R5]
        )
        
        assert negotiation.target_version == FHIRVersion.R5
        
        # 2. Resource transformation for storage (R4 to R5)
        transformer = FHIRVersionTransformer()
        transform_result = transformer.transform_resource(r4_resource, FHIRVersion.R5)
        
        assert transform_result.success
        assert 'medication' in transform_result.transformed_resource
        
        # 3. Response transformation back to client preference
        response_transform = transformer.transform_resource(
            transform_result.transformed_resource, FHIRVersion.R5
        )
        
        assert response_transform.success
        assert 'fhirVersion' not in response_transform.transformed_resource


if __name__ == "__main__":
    pytest.main([__file__, "-v"])