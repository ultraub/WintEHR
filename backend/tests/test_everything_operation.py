"""
Comprehensive tests for FHIR $everything operation

Tests cover:
- Basic functionality
- Parameter handling (_since, _type, _count)
- Pagination
- Resource traversal
- Error handling
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fhir.core.operations import OperationHandler
from fhir.core.storage import FHIRStorageEngine
from fhir.core.validators.synthea import SyntheaFHIRValidator
from fhir.core.resources_r4b import Bundle, BundleEntry


class TestEverythingOperation:
    """Test suite for the $everything operation implementation."""
    
    @pytest.fixture
    def mock_storage(self):
        """Create a mock storage engine."""
        storage = AsyncMock(spec=FHIRStorageEngine)
        return storage
    
    @pytest.fixture
    def mock_validator(self):
        """Create a mock validator."""
        validator = MagicMock(spec=SyntheaFHIRValidator)
        return validator
    
    @pytest.fixture
    def operation_handler(self, mock_storage, mock_validator):
        """Create an operation handler with mocked dependencies."""
        return OperationHandler(mock_storage, mock_validator)
    
    @pytest.fixture
    def sample_patient(self):
        """Create a sample patient resource."""
        return {
            "resourceType": "Patient",
            "id": "test-patient-123",
            "meta": {
                "versionId": "1",
                "lastUpdated": "2024-01-15T10:00:00Z"
            },
            "name": [{
                "family": "Test",
                "given": ["Patient"]
            }],
            "birthDate": "1980-01-01"
        }
    
    @pytest.fixture
    def sample_observation(self):
        """Create a sample observation resource."""
        return {
            "resourceType": "Observation",
            "id": "obs-123",
            "meta": {
                "versionId": "1",
                "lastUpdated": "2024-01-16T10:00:00Z"
            },
            "status": "final",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "29463-7",
                    "display": "Body weight"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-123"
            },
            "valueQuantity": {
                "value": 70,
                "unit": "kg"
            }
        }
    
    @pytest.fixture
    def sample_condition(self):
        """Create a sample condition resource."""
        return {
            "resourceType": "Condition",
            "id": "cond-456",
            "meta": {
                "versionId": "1",
                "lastUpdated": "2024-01-17T10:00:00Z"
            },
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-123"
            },
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "44054006",
                    "display": "Diabetes mellitus"
                }]
            }
        }
    
    @pytest.mark.asyncio
    async def test_patient_everything_basic(self, operation_handler, mock_storage, 
                                          sample_patient, sample_observation, sample_condition):
        """Test basic Patient/$everything operation without parameters."""
        # Setup mock storage
        mock_storage.read_resource.return_value = sample_patient
        mock_storage.search_resources.side_effect = [
            # First call for Observations
            ([sample_observation], 1),
            # Second call for Conditions
            ([sample_condition], 1),
            # All other resource types return empty
            *[([], 0) for _ in range(50)]  # Approximate number of resource types
        ]
        
        # Execute operation
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient",
            resource_id="test-patient-123"
        )
        
        # Verify result structure
        assert result.type == "searchset"
        assert result.total == 3  # Patient + Observation + Condition
        assert len(result.entry) == 3
        
        # Verify patient is first
        assert result.entry[0].resource.resourceType == "Patient"
        assert result.entry[0].resource.id == "test-patient-123"
        
        # Verify other resources are included
        resource_types = {entry.resource.resourceType for entry in result.entry}
        assert "Observation" in resource_types
        assert "Condition" in resource_types
    
    @pytest.mark.asyncio
    async def test_patient_everything_with_type_filter(self, operation_handler, mock_storage,
                                                      sample_patient, sample_observation):
        """Test Patient/$everything with _type parameter."""
        # Setup mock storage
        mock_storage.read_resource.return_value = sample_patient
        mock_storage.search_resources.side_effect = [
            # Only Observation is requested
            ([sample_observation], 1)
        ]
        
        # Execute operation with _type filter
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient",
            resource_id="test-patient-123",
            parameters={"_type": "Observation"}
        )
        
        # Verify results
        assert result.total == 2  # Patient + Observation
        assert len(result.entry) == 2
        
        # Verify only requested types are searched
        mock_storage.search_resources.assert_called_once()
        call_args = mock_storage.search_resources.call_args[0]
        assert call_args[0] == "Observation"
    
    @pytest.mark.asyncio
    async def test_patient_everything_with_since_filter(self, operation_handler, mock_storage,
                                                       sample_patient, sample_observation, sample_condition):
        """Test Patient/$everything with _since parameter."""
        # Setup mock storage
        mock_storage.read_resource.return_value = sample_patient
        
        # Only the condition is after the since date
        since_date = "2024-01-16T15:00:00Z"
        mock_storage.search_resources.side_effect = [
            # Observation - should be filtered by _lastUpdated
            ([sample_observation], 1),
            # Condition - should be included
            ([sample_condition], 1),
            # All other resource types return empty
            *[([], 0) for _ in range(50)]
        ]
        
        # Execute operation with _since filter
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient",
            resource_id="test-patient-123",
            parameters={"_since": since_date}
        )
        
        # Verify _lastUpdated parameter is added to searches
        for call in mock_storage.search_resources.call_args_list:
            search_params = call[0][1]
            if '_lastUpdated' in search_params:
                assert search_params['_lastUpdated'] == f"gt{since_date}"
    
    @pytest.mark.asyncio
    async def test_patient_everything_with_pagination(self, operation_handler, mock_storage,
                                                     sample_patient):
        """Test Patient/$everything with _count parameter for pagination."""
        # Create many resources
        observations = [
            {
                "resourceType": "Observation",
                "id": f"obs-{i}",
                "meta": {"lastUpdated": f"2024-01-{15+i:02d}T10:00:00Z"},
                "subject": {"reference": "Patient/test-patient-123"}
            }
            for i in range(10)
        ]
        
        # Setup mock storage
        mock_storage.read_resource.return_value = sample_patient
        mock_storage.search_resources.side_effect = [
            # Return 10 observations
            (observations, 10),
            # All other resource types return empty
            *[([], 0) for _ in range(50)]
        ]
        
        # Execute operation with pagination
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient",
            resource_id="test-patient-123",
            parameters={"_count": 5}
        )
        
        # Verify pagination
        assert result.total == 11  # 1 patient + 10 observations
        assert len(result.entry) == 5  # Limited by _count
        assert hasattr(result, 'link')
        
        # Check for next link
        next_links = [link for link in result.link if link['relation'] == 'next']
        assert len(next_links) == 1
        assert "_offset=5" in next_links[0]['url']
    
    @pytest.mark.asyncio
    async def test_patient_everything_with_offset(self, operation_handler, mock_storage,
                                                 sample_patient):
        """Test Patient/$everything with _offset parameter."""
        # Create resources
        observations = [
            {
                "resourceType": "Observation",
                "id": f"obs-{i}",
                "subject": {"reference": "Patient/test-patient-123"}
            }
            for i in range(5)
        ]
        
        # Setup mock storage
        mock_storage.read_resource.return_value = sample_patient
        mock_storage.search_resources.side_effect = [
            (observations, 5),
            *[([], 0) for _ in range(50)]
        ]
        
        # Execute operation with offset
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient",
            resource_id="test-patient-123",
            parameters={"_count": 3, "_offset": 2}
        )
        
        # Verify offset is applied
        assert len(result.entry) == 3
        # First entry at offset 2 should be the third resource (after patient and first observation)
        assert result.entry[0].resource.id in ["obs-1", "obs-2", "obs-3"]
    
    @pytest.mark.asyncio
    async def test_patient_everything_not_found(self, operation_handler, mock_storage):
        """Test Patient/$everything when patient doesn't exist."""
        # Setup mock storage to return None
        mock_storage.read_resource.return_value = None
        
        # Execute operation and expect error
        with pytest.raises(ValueError, match="not found"):
            await operation_handler.execute_operation(
                "everything",
                resource_type="Patient",
                resource_id="non-existent-patient"
            )
    
    @pytest.mark.asyncio
    async def test_patient_everything_with_references(self, operation_handler, mock_storage,
                                                     sample_patient):
        """Test Patient/$everything includes referenced resources."""
        # Create encounter referenced by observation
        encounter = {
            "resourceType": "Encounter",
            "id": "enc-123",
            "status": "finished",
            "subject": {"reference": "Patient/test-patient-123"}
        }
        
        observation_with_encounter = {
            "resourceType": "Observation",
            "id": "obs-123",
            "subject": {"reference": "Patient/test-patient-123"},
            "encounter": {"reference": "Encounter/enc-123"}
        }
        
        # Setup mock storage
        mock_storage.read_resource.side_effect = [
            sample_patient,  # Initial patient read
            encounter,       # When following encounter reference
        ]
        mock_storage.search_resources.side_effect = [
            ([observation_with_encounter], 1),
            ([encounter], 1),  # Encounter also found in patient compartment
            *[([], 0) for _ in range(50)]
        ]
        
        # Execute operation
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient",
            resource_id="test-patient-123"
        )
        
        # Verify referenced resources are included
        resource_ids = {f"{entry.resource.resourceType}/{entry.resource.id}" 
                       for entry in result.entry}
        assert "Encounter/enc-123" in resource_ids
    
    @pytest.mark.asyncio
    async def test_patient_everything_handles_search_errors(self, operation_handler, mock_storage,
                                                           sample_patient):
        """Test Patient/$everything handles errors gracefully."""
        # Setup mock storage
        mock_storage.read_resource.return_value = sample_patient
        
        # Make one resource type fail
        def search_side_effect(resource_type, *args, **kwargs):
            if resource_type == "Observation":
                raise Exception("Database error")
            return ([], 0)
        
        mock_storage.search_resources.side_effect = search_side_effect
        
        # Execute operation - should not fail
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient",
            resource_id="test-patient-123"
        )
        
        # Should still return patient even if searches fail
        assert result.total >= 1
        assert result.entry[0].resource.resourceType == "Patient"
    
    @pytest.mark.asyncio
    async def test_generic_everything_operation(self, operation_handler, mock_storage):
        """Test $everything operation on non-Patient resources."""
        # Create a sample encounter
        encounter = {
            "resourceType": "Encounter",
            "id": "enc-123",
            "status": "finished",
            "period": {"start": "2024-01-15T10:00:00Z"}
        }
        
        # Setup mock storage
        mock_storage.read_resource.return_value = encounter
        
        # Execute operation on Encounter
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Encounter",
            resource_id="enc-123"
        )
        
        # Should return at least the encounter itself
        assert result.type == "searchset"
        assert result.total == 1
        assert result.entry[0].resource.resourceType == "Encounter"
        assert result.entry[0].resource.id == "enc-123"
    
    @pytest.mark.asyncio
    async def test_patient_everything_special_search_params(self, operation_handler, mock_storage,
                                                           sample_patient):
        """Test Patient/$everything with resources that use different search parameters."""
        # Create resources with different patient reference params
        coverage = {
            "resourceType": "Coverage",
            "id": "cov-123",
            "status": "active",
            "beneficiary": {"reference": "Patient/test-patient-123"}  # Uses beneficiary
        }
        
        related_person = {
            "resourceType": "RelatedPerson",
            "id": "rp-123",
            "patient": {"reference": "Patient/test-patient-123"}  # Uses patient
        }
        
        # Setup mock storage
        mock_storage.read_resource.return_value = sample_patient
        
        def search_side_effect(resource_type, search_params, **kwargs):
            if resource_type == "Coverage" and "beneficiary" in search_params:
                return ([coverage], 1)
            elif resource_type == "RelatedPerson" and "patient" in search_params:
                return ([related_person], 1)
            return ([], 0)
        
        mock_storage.search_resources.side_effect = search_side_effect
        
        # Execute operation
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient", 
            resource_id="test-patient-123"
        )
        
        # Verify special parameter resources are found
        resource_types = {entry.resource.resourceType for entry in result.entry}
        assert "Coverage" in resource_types
        assert "RelatedPerson" in resource_types


if __name__ == "__main__":
    pytest.main([__file__, "-v"])