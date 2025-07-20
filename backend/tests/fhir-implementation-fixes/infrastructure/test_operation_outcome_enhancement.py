"""
OperationOutcome Enhancement Test Harness

This test harness validates enhanced OperationOutcome generation
with detailed diagnostics and clinical context.

Tests cover:
- Improved error reporting with detailed diagnostics
- Proper severity level handling (fatal, error, warning, information)
- Expression path tracking for detailed error location
- Enhanced integration with Bundle transaction processing
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

from fhir.core.storage import FHIRStorageEngine
from fhir.models.resources import FHIRResource
from sqlalchemy.ext.asyncio import AsyncSession


class TestOperationOutcomeEnhancement:
    """Test harness for enhanced OperationOutcome generation."""
    
    @pytest.fixture
    async def storage_engine(self, async_session: AsyncSession):
        """Create storage engine instance."""
        return FHIRStorageEngine(async_session)
    
    @pytest.fixture
    def sample_operation_outcomes(self) -> List[Dict[str, Any]]:
        """Create sample OperationOutcome resources for testing."""
        return [
            {
                "resourceType": "OperationOutcome",
                "issue": [
                    {
                        "severity": "error",
                        "code": "required",
                        "details": {
                            "coding": [{
                                "system": "http://hl7.org/fhir/issue-type",
                                "code": "required",
                                "display": "Required element missing"
                            }]
                        },
                        "diagnostics": "Patient.gender is required but was not provided",
                        "expression": ["Patient.gender"],
                        "location": ["Patient"]
                    }
                ]
            },
            {
                "resourceType": "OperationOutcome",
                "issue": [
                    {
                        "severity": "warning",
                        "code": "code-invalid",
                        "details": {
                            "coding": [{
                                "system": "http://hl7.org/fhir/issue-type",
                                "code": "code-invalid",
                                "display": "Invalid code"
                            }]
                        },
                        "diagnostics": "The code 'XYZ123' is not valid in system 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus'",
                        "expression": ["Patient.maritalStatus.coding[0].code"],
                        "location": ["Patient.maritalStatus"]
                    }
                ]
            },
            {
                "resourceType": "OperationOutcome",
                "issue": [
                    {
                        "severity": "information",
                        "code": "informational",
                        "details": {
                            "coding": [{
                                "system": "http://hl7.org/fhir/issue-type",
                                "code": "informational",
                                "display": "Informational note"
                            }]
                        },
                        "diagnostics": "Resource created successfully with auto-generated ID",
                        "expression": ["Patient.id"],
                        "location": ["Patient"]
                    }
                ]
            }
        ]
    
    async def test_operation_outcome_creation_and_storage(
        self,
        storage_engine: FHIRStorageEngine,
        sample_operation_outcomes: List[Dict[str, Any]]
    ):
        """Test OperationOutcome resource creation and storage."""
        
        created_outcomes = []
        for outcome_data in sample_operation_outcomes:
            outcome_id, version_id, last_updated = await storage_engine.create_resource(
                'OperationOutcome', outcome_data
            )
            created_outcomes.append(outcome_id)
        
        # Verify all outcomes were created
        assert len(created_outcomes) == 3
        
        # Test retrieval
        for outcome_id in created_outcomes:
            retrieved_outcome = await storage_engine.get_resource('OperationOutcome', outcome_id)
            assert retrieved_outcome is not None
            assert retrieved_outcome['resourceType'] == 'OperationOutcome'
            assert 'issue' in retrieved_outcome
            assert len(retrieved_outcome['issue']) >= 1
    
    async def test_severity_level_handling(
        self,
        storage_engine: FHIRStorageEngine,
        sample_operation_outcomes: List[Dict[str, Any]]
    ):
        """Test OperationOutcome severity level handling."""
        
        # Create test outcomes
        for outcome_data in sample_operation_outcomes:
            await storage_engine.create_resource('OperationOutcome', outcome_data)
        
        # Test severity-based search if search parameters exist
        search_params = storage_engine._get_search_parameter_definitions()
        
        if 'OperationOutcome' in search_params and 'severity' in search_params['OperationOutcome']:
            # Test error severity search
            error_outcomes, total = await storage_engine.search_resources(
                'OperationOutcome',
                {'severity': 'error'}
            )
            
            assert total == 1
            assert error_outcomes[0]['issue'][0]['severity'] == 'error'
            
            # Test warning severity search
            warning_outcomes, total = await storage_engine.search_resources(
                'OperationOutcome',
                {'severity': 'warning'}
            )
            
            assert total == 1
            assert warning_outcomes[0]['issue'][0]['severity'] == 'warning'
            
            # Test information severity search
            info_outcomes, total = await storage_engine.search_resources(
                'OperationOutcome',
                {'severity': 'information'}
            )
            
            assert total == 1
            assert info_outcomes[0]['issue'][0]['severity'] == 'information'
    
    async def test_detailed_diagnostics_generation(self, storage_engine: FHIRStorageEngine):
        """Test enhanced diagnostics generation for errors."""
        
        # Create invalid resource to trigger detailed diagnostics
        invalid_patient = {
            "resourceType": "Patient",
            "name": [{"family": "TestDiagnostics"}]
            # Missing required gender field
        }
        
        try:
            await storage_engine.create_resource('Patient', invalid_patient)
            pytest.fail("Expected validation error")
        except ValueError as e:
            # Verify detailed error message
            error_message = str(e)
            assert "Patient" in error_message
            # Error should provide specific field information
        
        # Test with more complex validation error
        invalid_observation = {
            "resourceType": "Observation",
            "status": "invalid-status",  # Invalid status value
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "8302-2"
                }]
            },
            "subject": {"reference": "Patient/non-existent"}  # Invalid reference
        }
        
        try:
            await storage_engine.create_resource('Observation', invalid_observation)
            pytest.fail("Expected validation error")
        except ValueError as e:
            error_message = str(e)
            assert "Observation" in error_message
    
    async def test_expression_path_tracking(self, storage_engine: FHIRStorageEngine):
        """Test expression path tracking for error location."""
        
        # Create OperationOutcome with detailed expression paths
        detailed_outcome = {
            "resourceType": "OperationOutcome",
            "issue": [
                {
                    "severity": "error",
                    "code": "value",
                    "details": {
                        "coding": [{
                            "system": "http://hl7.org/fhir/issue-type",
                            "code": "value",
                            "display": "Invalid value"
                        }]
                    },
                    "diagnostics": "The value '999' for Patient.contact[0].telecom[1].value is not a valid phone number format",
                    "expression": [
                        "Patient.contact[0].telecom[1].value"
                    ],
                    "location": [
                        "Patient.contact",
                        "Patient.contact[0]",
                        "Patient.contact[0].telecom[1]"
                    ]
                },
                {
                    "severity": "warning",
                    "code": "code-invalid",
                    "details": {
                        "coding": [{
                            "system": "http://hl7.org/fhir/issue-type",
                            "code": "code-invalid",
                            "display": "Invalid code"
                        }]
                    },
                    "diagnostics": "Code 'MOBILE' is deprecated in favor of 'MC' in system http://hl7.org/fhir/contact-point-use",
                    "expression": [
                        "Patient.contact[0].telecom[1].use"
                    ],
                    "location": [
                        "Patient.contact[0].telecom[1]"
                    ]
                }
            ]
        }
        
        outcome_id, _, _ = await storage_engine.create_resource('OperationOutcome', detailed_outcome)
        
        # Retrieve and verify expression path details
        retrieved_outcome = await storage_engine.get_resource('OperationOutcome', outcome_id)
        
        assert len(retrieved_outcome['issue']) == 2
        
        # Verify first issue expression path
        first_issue = retrieved_outcome['issue'][0]
        assert 'expression' in first_issue
        assert first_issue['expression'][0] == 'Patient.contact[0].telecom[1].value'
        assert 'location' in first_issue
        assert len(first_issue['location']) == 3
        
        # Verify second issue expression path
        second_issue = retrieved_outcome['issue'][1]
        assert 'expression' in second_issue
        assert second_issue['expression'][0] == 'Patient.contact[0].telecom[1].use'
        assert 'diagnostics' in second_issue
        assert 'deprecated' in second_issue['diagnostics']
    
    async def test_bundle_transaction_integration(self, storage_engine: FHIRStorageEngine):
        """Test OperationOutcome integration with Bundle transaction processing."""
        
        # Create transaction bundle with mixed valid/invalid resources
        transaction_bundle = {
            "resourceType": "Bundle",
            "type": "batch",  # Use batch to see individual error handling
            "entry": [
                {
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
                        # Missing required gender field
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    },
                    "resource": {
                        "resourceType": "Observation",
                        "status": "invalid-status",  # Invalid status
                        "code": {
                            "coding": [{
                                "system": "http://loinc.org",
                                "code": "8302-2"
                            }]
                        }
                    }
                }
            ]
        }
        
        # Process bundle
        response_bundle = await storage_engine.process_bundle_dict(transaction_bundle)
        
        # Verify bundle response structure
        assert response_bundle['resourceType'] == 'Bundle'
        assert response_bundle['type'] == 'batch-response'
        assert len(response_bundle['entry']) == 3
        
        # First entry should succeed
        assert response_bundle['entry'][0]['response']['status'] == '201'
        
        # Second and third entries should fail with OperationOutcome
        for i in [1, 2]:
            entry = response_bundle['entry'][i]
            assert entry['response']['status'].startswith('4')  # Client error
            
            # Should contain OperationOutcome
            assert 'resource' in entry
            assert entry['resource']['resourceType'] == 'OperationOutcome'
            
            # OperationOutcome should have detailed issue information
            operation_outcome = entry['resource']
            assert 'issue' in operation_outcome
            assert len(operation_outcome['issue']) >= 1
            
            issue = operation_outcome['issue'][0]
            assert 'severity' in issue
            assert 'code' in issue
            assert 'diagnostics' in issue
            assert issue['severity'] in ['error', 'fatal']
    
    async def test_clinical_context_enhancement(self, storage_engine: FHIRStorageEngine):
        """Test OperationOutcome with clinical context information."""
        
        # Create OperationOutcome with clinical context
        clinical_outcome = {
            "resourceType": "OperationOutcome",
            "issue": [
                {
                    "severity": "warning",
                    "code": "business-rule",
                    "details": {
                        "coding": [{
                            "system": "http://wintehr.com/operation-outcome-codes",
                            "code": "drug-interaction",
                            "display": "Drug Interaction Warning"
                        }]
                    },
                    "diagnostics": "Potential interaction between Warfarin and Aspirin detected. Monitor INR levels closely.",
                    "expression": [
                        "MedicationRequest.medicationCodeableConcept",
                        "MedicationRequest.note"
                    ],
                    "location": [
                        "MedicationRequest"
                    ]
                },
                {
                    "severity": "information",
                    "code": "informational",
                    "details": {
                        "coding": [{
                            "system": "http://wintehr.com/operation-outcome-codes",
                            "code": "clinical-reminder",
                            "display": "Clinical Reminder"
                        }]
                    },
                    "diagnostics": "Patient is due for annual diabetic retinal screening based on condition history.",
                    "expression": [
                        "Patient.condition"
                    ],
                    "location": [
                        "Patient"
                    ]
                }
            ]
        }
        
        outcome_id, _, _ = await storage_engine.create_resource('OperationOutcome', clinical_outcome)
        
        # Retrieve and verify clinical context
        retrieved_outcome = await storage_engine.get_resource('OperationOutcome', outcome_id)
        
        # Verify drug interaction warning
        drug_issue = retrieved_outcome['issue'][0]
        assert drug_issue['severity'] == 'warning'
        assert drug_issue['details']['coding'][0]['code'] == 'drug-interaction'
        assert 'Warfarin' in drug_issue['diagnostics']
        assert 'INR' in drug_issue['diagnostics']
        
        # Verify clinical reminder
        reminder_issue = retrieved_outcome['issue'][1]
        assert reminder_issue['severity'] == 'information'
        assert reminder_issue['details']['coding'][0]['code'] == 'clinical-reminder'
        assert 'diabetic' in reminder_issue['diagnostics']
        assert 'screening' in reminder_issue['diagnostics']
    
    async def test_multi_issue_operation_outcome(self, storage_engine: FHIRStorageEngine):
        """Test OperationOutcome with multiple issues of different severities."""
        
        # Create OperationOutcome with multiple issues
        multi_issue_outcome = {
            "resourceType": "OperationOutcome",
            "issue": [
                {
                    "severity": "error",
                    "code": "required",
                    "details": {
                        "coding": [{
                            "system": "http://hl7.org/fhir/issue-type",
                            "code": "required",
                            "display": "Required element missing"
                        }]
                    },
                    "diagnostics": "Patient.identifier is required for this operation",
                    "expression": ["Patient.identifier"],
                    "location": ["Patient"]
                },
                {
                    "severity": "warning",
                    "code": "business-rule",
                    "details": {
                        "coding": [{
                            "system": "http://hl7.org/fhir/issue-type", 
                            "code": "business-rule",
                            "display": "Business rule violation"
                        }]
                    },
                    "diagnostics": "Patient address is incomplete - missing postal code",
                    "expression": ["Patient.address[0].postalCode"],
                    "location": ["Patient.address[0]"]
                },
                {
                    "severity": "information",
                    "code": "informational",
                    "details": {
                        "coding": [{
                            "system": "http://hl7.org/fhir/issue-type",
                            "code": "informational",
                            "display": "Informational note"
                        }]
                    },
                    "diagnostics": "Patient record updated successfully",
                    "expression": ["Patient"],
                    "location": ["Patient"]
                }
            ]
        }
        
        outcome_id, _, _ = await storage_engine.create_resource('OperationOutcome', multi_issue_outcome)
        
        # Retrieve and verify multiple issues
        retrieved_outcome = await storage_engine.get_resource('OperationOutcome', outcome_id)
        
        assert len(retrieved_outcome['issue']) == 3
        
        # Verify severity ordering and content
        severities = [issue['severity'] for issue in retrieved_outcome['issue']]
        assert 'error' in severities
        assert 'warning' in severities
        assert 'information' in severities
        
        # Verify each issue has required fields
        for issue in retrieved_outcome['issue']:
            assert 'severity' in issue
            assert 'code' in issue
            assert 'diagnostics' in issue
            assert 'expression' in issue
            assert 'location' in issue
            assert issue['severity'] in ['fatal', 'error', 'warning', 'information']
    
    async def test_operation_outcome_search_capabilities(self, storage_engine: FHIRStorageEngine):
        """Test OperationOutcome search parameter functionality."""
        
        # Create various OperationOutcomes for search testing
        search_outcomes = [
            {
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "invalid",
                    "diagnostics": "Patient validation failed",
                    "expression": ["Patient.gender"]
                }]
            },
            {
                "resourceType": "OperationOutcome", 
                "issue": [{
                    "severity": "warning",
                    "code": "business-rule",
                    "diagnostics": "Medication interaction detected",
                    "expression": ["MedicationRequest.medication"]
                }]
            },
            {
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "information",
                    "code": "informational",
                    "diagnostics": "Operation completed successfully",
                    "expression": ["Bundle"]
                }]
            }
        ]
        
        # Create test outcomes
        for outcome_data in search_outcomes:
            await storage_engine.create_resource('OperationOutcome', outcome_data)
        
        # Test search functionality if search parameters are defined
        search_params = storage_engine._get_search_parameter_definitions()
        
        if 'OperationOutcome' in search_params:
            # Test basic search
            all_outcomes, total = await storage_engine.search_resources('OperationOutcome', {})
            assert total >= 3
            
            # If severity search parameter exists, test it
            if 'severity' in search_params['OperationOutcome']:
                error_outcomes, total = await storage_engine.search_resources(
                    'OperationOutcome',
                    {'severity': 'error'}
                )
                assert total >= 1
    
    async def test_operation_outcome_validation(self, storage_engine: FHIRStorageEngine):
        """Test OperationOutcome resource validation."""
        
        # Test invalid OperationOutcome (missing required fields)
        invalid_outcome = {
            "resourceType": "OperationOutcome"
            # Missing issue array - should fail validation
        }
        
        with pytest.raises(ValueError):
            await storage_engine.create_resource('OperationOutcome', invalid_outcome)
        
        # Test invalid issue structure
        invalid_issue_outcome = {
            "resourceType": "OperationOutcome",
            "issue": [
                {
                    # Missing severity and code - should fail validation
                    "diagnostics": "Test error message"
                }
            ]
        }
        
        with pytest.raises(ValueError):
            await storage_engine.create_resource('OperationOutcome', invalid_issue_outcome)
        
        # Test valid minimal OperationOutcome
        valid_minimal_outcome = {
            "resourceType": "OperationOutcome",
            "issue": [
                {
                    "severity": "error",
                    "code": "invalid",
                    "diagnostics": "Minimal valid OperationOutcome"
                }
            ]
        }
        
        # Should not raise error
        outcome_id, _, _ = await storage_engine.create_resource('OperationOutcome', valid_minimal_outcome)
        assert outcome_id is not None