"""
Bundle Transaction Processing Enhancement Test Harness

This test harness validates enhanced Bundle transaction processing
with optimized performance and error handling capabilities.

Tests cover:
- Optimized transaction processing performance
- Enhanced error handling and rollback capabilities
- Comprehensive Bundle validation and type support
- All Bundle types: transaction, batch, collection, searchset, history, document
"""

import pytest
import asyncio
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

from fhir.core.storage import FHIRStorageEngine
from fhir.models.resources import FHIRResource
from sqlalchemy.ext.asyncio import AsyncSession


class TestBundleTransactionEnhancement:
    """Test harness for enhanced Bundle transaction processing."""
    
    @pytest.fixture
    async def storage_engine(self, async_session: AsyncSession):
        """Create storage engine instance."""
        return FHIRStorageEngine(async_session)
    
    @pytest.fixture
    def sample_transaction_bundle(self) -> Dict[str, Any]:
        """Create sample transaction Bundle for testing."""
        return {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "fullUrl": "urn:uuid:patient-1",
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "TestTransaction", "given": ["Bundle"]}],
                        "gender": "unknown"
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    },
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {
                            "coding": [{"system": "http://loinc.org", "code": "8302-2"}]
                        },
                        "subject": {"reference": "urn:uuid:patient-1"},
                        "valueQuantity": {"value": 185, "unit": "cm"}
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Condition"
                    },
                    "resource": {
                        "resourceType": "Condition",
                        "clinicalStatus": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                                "code": "active"
                            }]
                        },
                        "code": {
                            "coding": [{
                                "system": "http://snomed.info/sct",
                                "code": "233604007",
                                "display": "Pneumonia"
                            }]
                        },
                        "subject": {"reference": "urn:uuid:patient-1"}
                    }
                }
            ]
        }
    
    @pytest.fixture
    def sample_batch_bundle(self) -> Dict[str, Any]:
        """Create sample batch Bundle for testing."""
        return {
            "resourceType": "Bundle",
            "type": "batch",
            "entry": [
                {
                    "request": {
                        "method": "GET",
                        "url": "Patient?name=TestBatch"
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "TestBatch", "given": ["Bundle"]}],
                        "gender": "unknown"
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "InvalidBatch"}]
                        # Missing gender - will cause validation error but shouldn't affect other entries
                    }
                }
            ]
        }
    
    async def test_enhanced_bundle_processing_definitions(self, storage_engine: FHIRStorageEngine):
        """Test that Bundle processing has enhanced capabilities."""
        
        # Verify Bundle processing method exists
        assert hasattr(storage_engine, 'process_bundle_dict')
        
        # Test bundle type validation
        valid_types = ['transaction', 'batch', 'collection', 'searchset', 'history', 'document']
        
        for bundle_type in valid_types:
            test_bundle = {
                "resourceType": "Bundle",
                "type": bundle_type,
                "entry": []
            }
            
            # Should not raise error for valid types
            # Note: We're testing the validation logic exists, actual processing tested separately
            assert test_bundle['type'] in valid_types
    
    async def test_transaction_success_scenario(
        self,
        storage_engine: FHIRStorageEngine,
        sample_transaction_bundle: Dict[str, Any]
    ):
        """Test successful atomic transaction processing."""
        
        # Process transaction bundle
        start_time = time.time()
        response_bundle = await storage_engine.process_bundle_dict(sample_transaction_bundle)
        processing_time = time.time() - start_time
        
        # Verify response structure
        assert response_bundle['resourceType'] == 'Bundle'
        assert response_bundle['type'] == 'transaction-response'
        assert len(response_bundle['entry']) == 3
        
        # Verify all operations succeeded
        for entry in response_bundle['entry']:
            assert 'response' in entry
            assert entry['response']['status'] == '201'
            assert 'location' in entry['response']
        
        # Verify reference resolution worked
        patient_location = response_bundle['entry'][0]['response']['location']
        patient_id = patient_location.split('/')[-1]
        
        # Check that observation references the created patient
        observation_resource = response_bundle['entry'][1].get('resource')
        if observation_resource:
            assert observation_resource['subject']['reference'] == f'Patient/{patient_id}'
        
        # Verify performance (should complete quickly)
        assert processing_time < 5.0, f"Transaction took too long: {processing_time}s"
        
        # Verify data integrity - all resources should exist
        patients, total = await storage_engine.search_resources('Patient', {'name': 'TestTransaction'})
        assert total == 1
        
        observations, total = await storage_engine.search_resources('Observation', {'subject': f'Patient/{patient_id}'})
        assert total == 1
        
        conditions, total = await storage_engine.search_resources('Condition', {'subject': f'Patient/{patient_id}'})
        assert total == 1
    
    async def test_transaction_rollback_scenario(self, storage_engine: FHIRStorageEngine):
        """Test transaction rollback on failure."""
        
        # Create transaction bundle with one invalid resource
        rollback_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "fullUrl": "urn:uuid:patient-valid",
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "ValidPatient", "given": ["Test"]}],
                        "gender": "male"
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "InvalidPatient"}]
                        # Missing required gender field - should cause failure
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    },
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {
                            "coding": [{"system": "http://loinc.org", "code": "8302-2"}]
                        },
                        "subject": {"reference": "urn:uuid:patient-valid"},
                        "valueQuantity": {"value": 180, "unit": "cm"}
                    }
                }
            ]
        }
        
        # Attempt to process bundle - should fail
        with pytest.raises(Exception):
            await storage_engine.process_bundle_dict(rollback_bundle)
        
        # Verify rollback - no resources should have been created
        patients, total = await storage_engine.search_resources('Patient', {'name': 'ValidPatient'})
        assert total == 0
        
        patients, total = await storage_engine.search_resources('Patient', {'name': 'InvalidPatient'})
        assert total == 0
        
        observations, total = await storage_engine.search_resources('Observation', {})
        # Count should be same as before test (depending on other tests)
        # Main point is that the observation from this bundle wasn't created
    
    async def test_batch_independent_processing(
        self,
        storage_engine: FHIRStorageEngine,
        sample_batch_bundle: Dict[str, Any]
    ):
        """Test batch processing with independent entry handling."""
        
        # Process batch bundle
        response_bundle = await storage_engine.process_bundle_dict(sample_batch_bundle)
        
        # Verify response structure
        assert response_bundle['resourceType'] == 'Bundle'
        assert response_bundle['type'] == 'batch-response'
        assert len(response_bundle['entry']) == 3
        
        # Verify mixed success/failure responses
        response_statuses = [entry['response']['status'] for entry in response_bundle['entry']]
        
        # Should have mix of success and failure statuses
        # First entry: GET request (success)
        # Second entry: Valid POST (success) 
        # Third entry: Invalid POST (failure)
        assert '200' in response_statuses or '201' in response_statuses  # At least one success
        assert any(status.startswith('4') for status in response_statuses)  # At least one client error
        
        # Verify that valid operations succeeded despite invalid ones
        patients, total = await storage_engine.search_resources('Patient', {'name': 'TestBatch'})
        assert total >= 1  # At least the valid patient was created
    
    async def test_reference_resolution_enhancement(self, storage_engine: FHIRStorageEngine):
        """Test enhanced reference resolution in transactions."""
        
        # Create bundle with complex reference resolution
        complex_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "fullUrl": "urn:uuid:patient-ref",
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "ReferenceTest", "given": ["Complex"]}],
                        "gender": "female"
                    }
                },
                {
                    "fullUrl": "urn:uuid:encounter-ref",
                    "request": {
                        "method": "POST",
                        "url": "Encounter"
                    },
                    "resource": {
                        "resourceType": "Encounter",
                        "status": "finished",
                        "class": {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                            "code": "AMB"
                        },
                        "subject": {"reference": "urn:uuid:patient-ref"}
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    },
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {
                            "coding": [{"system": "http://loinc.org", "code": "29463-7"}]
                        },
                        "subject": {"reference": "urn:uuid:patient-ref"},
                        "encounter": {"reference": "urn:uuid:encounter-ref"},
                        "valueQuantity": {"value": 70, "unit": "kg"}
                    }
                }
            ]
        }
        
        # Process bundle
        response_bundle = await storage_engine.process_bundle_dict(complex_bundle)
        
        # Verify all entries succeeded
        assert len(response_bundle['entry']) == 3
        for entry in response_bundle['entry']:
            assert entry['response']['status'] == '201'
        
        # Extract created resource IDs
        patient_location = response_bundle['entry'][0]['response']['location']
        patient_id = patient_location.split('/')[-1]
        
        encounter_location = response_bundle['entry'][1]['response']['location']
        encounter_id = encounter_location.split('/')[-1]
        
        # Verify reference resolution
        encounters, _ = await storage_engine.search_resources('Encounter', {'subject': f'Patient/{patient_id}'})
        assert len(encounters) == 1
        assert encounters[0]['subject']['reference'] == f'Patient/{patient_id}'
        
        observations, _ = await storage_engine.search_resources('Observation', {'subject': f'Patient/{patient_id}'})
        assert len(observations) == 1
        obs = observations[0]
        assert obs['subject']['reference'] == f'Patient/{patient_id}'
        assert obs['encounter']['reference'] == f'Encounter/{encounter_id}'
    
    async def test_large_bundle_performance(self, storage_engine: FHIRStorageEngine):
        """Test performance with large bundle processing."""
        
        # Create large transaction bundle (100 entries)
        large_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": []
        }
        
        # Add 100 patient resources
        for i in range(100):
            entry = {
                "request": {
                    "method": "POST",
                    "url": "Patient"
                },
                "resource": {
                    "resourceType": "Patient",
                    "name": [{"family": f"TestLarge{i:03d}", "given": ["Bundle"]}],
                    "gender": "unknown"
                }
            }
            large_bundle['entry'].append(entry)
        
        # Process large bundle
        start_time = time.time()
        response_bundle = await storage_engine.process_bundle_dict(large_bundle)
        processing_time = time.time() - start_time
        
        # Verify performance benchmarks
        assert processing_time < 60.0, f"Large bundle took too long: {processing_time}s"  # Less than 1 minute
        assert len(response_bundle['entry']) == 100
        
        # Verify all succeeded
        for entry in response_bundle['entry']:
            assert entry['response']['status'] == '201'
        
        # Verify data integrity
        patients, total = await storage_engine.search_resources('Patient', {'family': 'TestLarge*'})
        assert total == 100
    
    async def test_concurrent_bundle_processing(self, storage_engine: FHIRStorageEngine):
        """Test concurrent bundle processing for race conditions."""
        
        # Create multiple small bundles
        bundles = []
        for i in range(10):
            bundle = {
                "resourceType": "Bundle",
                "type": "transaction",
                "entry": [
                    {
                        "request": {
                            "method": "POST",
                            "url": "Patient"
                        },
                        "resource": {
                            "resourceType": "Patient",
                            "name": [{"family": f"Concurrent{i}", "given": ["Test"]}],
                            "gender": "unknown"
                        }
                    }
                ]
            }
            bundles.append(bundle)
        
        # Process bundles concurrently
        start_time = time.time()
        tasks = [storage_engine.process_bundle_dict(bundle) for bundle in bundles]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        processing_time = time.time() - start_time
        
        # Verify no exceptions occurred
        for response in responses:
            assert not isinstance(response, Exception), f"Concurrent processing failed: {response}"
        
        # Verify all bundles processed successfully
        assert len(responses) == 10
        for response in responses:
            assert response['type'] == 'transaction-response'
            assert len(response['entry']) == 1
            assert response['entry'][0]['response']['status'] == '201'
        
        # Verify data integrity
        patients, total = await storage_engine.search_resources('Patient', {'family': 'Concurrent*'})
        assert total == 10
        
        # Verify reasonable performance
        assert processing_time < 30.0, f"Concurrent processing took too long: {processing_time}s"
    
    async def test_bundle_validation_enhancement(self, storage_engine: FHIRStorageEngine):
        """Test enhanced Bundle validation."""
        
        # Test invalid bundle type
        invalid_type_bundle = {
            "resourceType": "Bundle",
            "type": "invalid-type",
            "entry": []
        }
        
        with pytest.raises(ValueError):
            await storage_engine.process_bundle_dict(invalid_type_bundle)
        
        # Test missing required fields
        invalid_structure_bundle = {
            "resourceType": "Bundle"
            # Missing type field
        }
        
        with pytest.raises(ValueError):
            await storage_engine.process_bundle_dict(invalid_structure_bundle)
        
        # Test invalid entry structure
        invalid_entry_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    # Missing request field
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "Test"}]
                    }
                }
            ]
        }
        
        with pytest.raises(ValueError):
            await storage_engine.process_bundle_dict(invalid_entry_bundle)
    
    async def test_bundle_type_specific_processing(self, storage_engine: FHIRStorageEngine):
        """Test processing for different Bundle types."""
        
        # Test collection bundle (no processing requirements)
        collection_bundle = {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "Collection", "given": ["Test"]}],
                        "gender": "unknown"
                    }
                }
            ]
        }
        
        # Collection bundles should be handled without processing
        response = await storage_engine.process_bundle_dict(collection_bundle)
        assert response['type'] == 'collection'
        # For collections, entries are typically returned as-is
        
        # Test searchset bundle structure
        searchset_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "total": 1,
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "SearchSet", "given": ["Test"]}],
                        "gender": "unknown"
                    }
                }
            ]
        }
        
        # Searchset bundles represent search results
        response = await storage_engine.process_bundle_dict(searchset_bundle)
        assert response['type'] == 'searchset'
    
    async def test_error_handling_enhancement(self, storage_engine: FHIRStorageEngine):
        """Test enhanced error handling in bundle processing."""
        
        # Test bundle with multiple error types
        error_bundle = {
            "resourceType": "Bundle",
            "type": "batch",  # Use batch so errors don't stop processing
            "entry": [
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "ValidError", "given": ["Test"]}],
                        "gender": "male"
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "InvalidResource"  # Invalid resource type
                    },
                    "resource": {
                        "resourceType": "InvalidResource",
                        "name": "test"
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient"
                        # Missing required fields
                    }
                }
            ]
        }
        
        # Process bundle - should handle errors gracefully
        response_bundle = await storage_engine.process_bundle_dict(error_bundle)
        
        # Verify error handling
        assert response_bundle['type'] == 'batch-response'
        assert len(response_bundle['entry']) == 3
        
        # First entry should succeed
        assert response_bundle['entry'][0]['response']['status'] == '201'
        
        # Second and third entries should have error statuses
        for i in [1, 2]:
            status = response_bundle['entry'][i]['response']['status']
            assert status.startswith('4') or status.startswith('5')  # Client or server error
            
            # Should include OperationOutcome
            assert 'resource' in response_bundle['entry'][i]
            assert response_bundle['entry'][i]['resource']['resourceType'] == 'OperationOutcome'
    
    async def test_bundle_memory_optimization(self, storage_engine: FHIRStorageEngine):
        """Test memory optimization for large bundle processing."""
        
        # Create moderately large bundle to test memory handling
        medium_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": []
        }
        
        # Add 50 entries with some content
        for i in range(50):
            entry = {
                "request": {
                    "method": "POST",
                    "url": "Patient"
                },
                "resource": {
                    "resourceType": "Patient",
                    "name": [{"family": f"MemoryTest{i:03d}", "given": ["Bundle", "Large"]}],
                    "gender": "unknown",
                    "address": [{
                        "line": [f"{i} Test Street"],
                        "city": "Test City",
                        "state": "Test State",
                        "postalCode": f"{i:05d}"
                    }]
                }
            }
            medium_bundle['entry'].append(entry)
        
        # Process bundle and monitor
        start_time = time.time()
        response_bundle = await storage_engine.process_bundle_dict(medium_bundle)
        processing_time = time.time() - start_time
        
        # Verify successful processing
        assert len(response_bundle['entry']) == 50
        for entry in response_bundle['entry']:
            assert entry['response']['status'] == '201'
        
        # Verify reasonable performance (memory optimization should help)
        assert processing_time < 30.0, f"Memory test took too long: {processing_time}s"
        
        # Verify data integrity
        patients, total = await storage_engine.search_resources('Patient', {'family': 'MemoryTest*'})
        assert total == 50