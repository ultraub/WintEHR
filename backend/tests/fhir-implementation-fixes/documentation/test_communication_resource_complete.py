"""
Communication Resource Complete Implementation Test Harness

This test harness validates the complete Communication resource implementation
with all FHIR R4 search parameters and clinical workflow integration.

Tests cover:
- All FHIR R4 search parameters: category, encounter, identifier, medium, 
  received, recipient, sender, sent, status, subject
- Communication threading and real-time workflow integration
- Clinical alert and notification capabilities
- Role-based communication routing
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

from fhir.core.storage import FHIRStorageEngine
from fhir.models.resources import FHIRResource
from sqlalchemy.ext.asyncio import AsyncSession


class TestCommunicationResourceComplete:
    """Test harness for complete Communication resource implementation."""
    
    @pytest.fixture
    async def storage_engine(self, async_session: AsyncSession):
        """Create storage engine instance."""
        return FHIRStorageEngine(async_session)
    
    @pytest.fixture
    def sample_communications(self) -> List[Dict[str, Any]]:
        """Create sample Communication resources for testing."""
        return [
            {
                "resourceType": "Communication",
                "id": "alert-critical-lab-123",
                "identifier": [{
                    "system": "http://wintehr.com/communication-id",
                    "value": "ALERT-LAB-2025-001"
                }],
                "status": "completed",
                "category": [{
                    "coding": [{
                        "system": "http://wintehr.com/communication-category",
                        "code": "alert",
                        "display": "Clinical Alert"
                    }]
                }],
                "priority": "stat",
                "subject": {"reference": "Patient/patient-123"},
                "encounter": {"reference": "Encounter/encounter-456"},
                "sent": "2025-07-14T10:30:00Z",
                "received": "2025-07-14T10:31:00Z",
                "recipient": [{
                    "reference": "Practitioner/provider-456"
                }],
                "sender": {"reference": "Organization/wintehr-system"},
                "medium": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode",
                        "code": "WRITTEN",
                        "display": "written"
                    }]
                }],
                "payload": [{
                    "contentString": "CRITICAL: Lab result outside normal range - Glucose: 450 mg/dL (Normal: 70-100)"
                }],
                "reasonReference": [{
                    "reference": "Observation/glucose-result-789"
                }]
            },
            {
                "resourceType": "Communication",
                "id": "provider-consultation-456",
                "identifier": [{
                    "system": "http://wintehr.com/communication-id",
                    "value": "CONSULT-2025-002"
                }],
                "status": "completed",
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/communication-category",
                        "code": "notification",
                        "display": "Notification"
                    }]
                }],
                "priority": "routine",
                "subject": {"reference": "Patient/patient-456"},
                "encounter": {"reference": "Encounter/encounter-789"},
                "sent": "2025-07-14T14:00:00Z",
                "received": "2025-07-14T14:05:00Z",
                "recipient": [{
                    "reference": "Practitioner/cardiologist-789"
                }],
                "sender": {"reference": "Practitioner/primary-care-123"},
                "medium": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode",
                        "code": "VERBAL",
                        "display": "verbal"
                    }]
                }],
                "payload": [{
                    "contentString": "Please review patient's updated medication list before next appointment"
                }],
                "basedOn": [{
                    "reference": "ServiceRequest/med-review-321"
                }]
            },
            {
                "resourceType": "Communication",
                "id": "patient-notification-789",
                "identifier": [{
                    "system": "http://wintehr.com/communication-id",
                    "value": "PATIENT-NOTIFY-2025-003"
                }],
                "status": "completed",
                "category": [{
                    "coding": [{
                        "system": "http://wintehr.com/communication-category",
                        "code": "patient-notification",
                        "display": "Patient Notification"
                    }]
                }],
                "priority": "routine",
                "subject": {"reference": "Patient/patient-789"},
                "sent": "2025-07-14T16:00:00Z",
                "received": "2025-07-14T16:02:00Z",
                "recipient": [{
                    "reference": "Patient/patient-789"
                }],
                "sender": {"reference": "Organization/clinic-456"},
                "medium": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode",
                        "code": "ELECTRONIC",
                        "display": "electronic"
                    }]
                }],
                "payload": [{
                    "contentString": "Your appointment is scheduled for July 20, 2025 at 2:00 PM. Please arrive 15 minutes early."
                }]
            }
        ]
    
    async def test_communication_search_parameter_definitions(self, storage_engine: FHIRStorageEngine):
        """Test that Communication has all required FHIR R4 search parameters."""
        search_params = storage_engine._get_search_parameter_definitions()
        
        # Verify Communication search parameters exist
        assert 'Communication' in search_params
        comm_params = search_params['Communication']
        
        # Test all FHIR R4 search parameters
        required_params = [
            'category', 'encounter', 'identifier', 'medium', 'received',
            'recipient', 'sender', 'sent', 'status', 'subject', 'priority',
            'based-on', 'part-of', 'reason-reference'
        ]
        
        for param in required_params:
            assert param in comm_params, f"Missing search parameter: {param}"
        
        # Verify parameter types
        assert comm_params['category']['type'] == 'token'
        assert comm_params['encounter']['type'] == 'reference'
        assert comm_params['identifier']['type'] == 'token'
        assert comm_params['medium']['type'] == 'token'
        assert comm_params['received']['type'] == 'date'
        assert comm_params['recipient']['type'] == 'reference'
        assert comm_params['sender']['type'] == 'reference'
        assert comm_params['sent']['type'] == 'date'
        assert comm_params['status']['type'] == 'token'
        assert comm_params['subject']['type'] == 'reference'
        assert comm_params['priority']['type'] == 'token'
    
    async def test_category_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search by category parameter."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test alert category search
        alerts, total = await storage_engine.search_resources(
            'Communication',
            {'category': 'alert'}
        )
        
        assert total == 1
        assert alerts[0]['category'][0]['coding'][0]['code'] == 'alert'
        assert alerts[0]['priority'] == 'stat'
        
        # Test notification category search
        notifications, total = await storage_engine.search_resources(
            'Communication',
            {'category': 'notification'}
        )
        
        assert total == 1
        assert notifications[0]['category'][0]['coding'][0]['code'] == 'notification'
        
        # Test patient notification category search
        patient_notifications, total = await storage_engine.search_resources(
            'Communication',
            {'category': 'patient-notification'}
        )
        
        assert total == 1
        assert patient_notifications[0]['category'][0]['coding'][0]['code'] == 'patient-notification'
    
    async def test_encounter_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search by encounter parameter."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test encounter-specific search
        encounter_comms, total = await storage_engine.search_resources(
            'Communication',
            {'encounter': 'Encounter/encounter-456'}
        )
        
        assert total == 1
        assert encounter_comms[0]['encounter']['reference'] == 'Encounter/encounter-456'
    
    async def test_identifier_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search by identifier parameter."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test identifier search
        identified_comms, total = await storage_engine.search_resources(
            'Communication',
            {'identifier': 'ALERT-LAB-2025-001'}
        )
        
        assert total == 1
        assert identified_comms[0]['identifier'][0]['value'] == 'ALERT-LAB-2025-001'
    
    async def test_medium_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search by medium parameter."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test written medium search
        written_comms, total = await storage_engine.search_resources(
            'Communication',
            {'medium': 'WRITTEN'}
        )
        
        assert total == 1
        assert written_comms[0]['medium'][0]['coding'][0]['code'] == 'WRITTEN'
        
        # Test verbal medium search
        verbal_comms, total = await storage_engine.search_resources(
            'Communication',
            {'medium': 'VERBAL'}
        )
        
        assert total == 1
        assert verbal_comms[0]['medium'][0]['coding'][0]['code'] == 'VERBAL'
        
        # Test electronic medium search
        electronic_comms, total = await storage_engine.search_resources(
            'Communication',
            {'medium': 'ELECTRONIC'}
        )
        
        assert total == 1
        assert electronic_comms[0]['medium'][0]['coding'][0]['code'] == 'ELECTRONIC'
    
    async def test_datetime_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search by sent and received date parameters."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test sent date range search
        morning_comms, total = await storage_engine.search_resources(
            'Communication',
            {
                'sent': 'ge2025-07-14T10:00:00Z',
                'sent': 'le2025-07-14T12:00:00Z'
            }
        )
        
        assert total == 1
        assert '10:30:00' in morning_comms[0]['sent']
        
        # Test received date search
        afternoon_comms, total = await storage_engine.search_resources(
            'Communication',
            {
                'received': 'ge2025-07-14T14:00:00Z',
                'received': 'le2025-07-14T17:00:00Z'
            }
        )
        
        assert total == 2  # Both afternoon communications
        
        # Test specific sent date
        specific_comms, total = await storage_engine.search_resources(
            'Communication',
            {'sent': '2025-07-14T16:00:00Z'}
        )
        
        assert total == 1
        assert specific_comms[0]['sent'] == '2025-07-14T16:00:00Z'
    
    async def test_recipient_sender_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search by recipient and sender parameters."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test recipient search
        provider_comms, total = await storage_engine.search_resources(
            'Communication',
            {'recipient': 'Practitioner/provider-456'}
        )
        
        assert total == 1
        assert provider_comms[0]['recipient'][0]['reference'] == 'Practitioner/provider-456'
        
        # Test patient recipient search
        patient_comms, total = await storage_engine.search_resources(
            'Communication',
            {'recipient': 'Patient/patient-789'}
        )
        
        assert total == 1
        assert patient_comms[0]['recipient'][0]['reference'] == 'Patient/patient-789'
        
        # Test sender search
        system_comms, total = await storage_engine.search_resources(
            'Communication',
            {'sender': 'Organization/wintehr-system'}
        )
        
        assert total == 1
        assert system_comms[0]['sender']['reference'] == 'Organization/wintehr-system'
    
    async def test_status_priority_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search by status and priority parameters."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test status search
        completed_comms, total = await storage_engine.search_resources(
            'Communication',
            {'status': 'completed'}
        )
        
        assert total == 3  # All test communications are completed
        
        # Test priority search
        stat_comms, total = await storage_engine.search_resources(
            'Communication',
            {'priority': 'stat'}
        )
        
        assert total == 1
        assert stat_comms[0]['priority'] == 'stat'
        assert stat_comms[0]['category'][0]['coding'][0]['code'] == 'alert'
        
        # Test routine priority search
        routine_comms, total = await storage_engine.search_resources(
            'Communication',
            {'priority': 'routine'}
        )
        
        assert total == 2
    
    async def test_subject_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search by subject parameter."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test patient-specific communication search
        patient_123_comms, total = await storage_engine.search_resources(
            'Communication',
            {'subject': 'Patient/patient-123'}
        )
        
        assert total == 1
        assert patient_123_comms[0]['subject']['reference'] == 'Patient/patient-123'
        
        # Test different patient search
        patient_456_comms, total = await storage_engine.search_resources(
            'Communication',
            {'subject': 'Patient/patient-456'}
        )
        
        assert total == 1
        assert patient_456_comms[0]['subject']['reference'] == 'Patient/patient-456'
    
    async def test_combined_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_communications: List[Dict[str, Any]]
    ):
        """Test Communication search with multiple parameters."""
        
        # Create test communications
        for comm_data in sample_communications:
            await storage_engine.create_resource('Communication', comm_data)
        
        # Test combined search: category + priority + medium
        urgent_alerts, total = await storage_engine.search_resources(
            'Communication',
            {
                'category': 'alert',
                'priority': 'stat',
                'medium': 'WRITTEN'
            }
        )
        
        assert total == 1
        comm = urgent_alerts[0]
        assert comm['category'][0]['coding'][0]['code'] == 'alert'
        assert comm['priority'] == 'stat'
        assert comm['medium'][0]['coding'][0]['code'] == 'WRITTEN'
        
        # Test patient + category search
        patient_notifications, total = await storage_engine.search_resources(
            'Communication',
            {
                'subject': 'Patient/patient-789',
                'category': 'patient-notification'
            }
        )
        
        assert total == 1
        assert patient_notifications[0]['subject']['reference'] == 'Patient/patient-789'
        assert patient_notifications[0]['category'][0]['coding'][0]['code'] == 'patient-notification'
    
    async def test_communication_threading(self, storage_engine: FHIRStorageEngine):
        """Test Communication threading with partOf relationships."""
        
        # Create parent communication
        parent_comm = {
            "resourceType": "Communication",
            "id": "original-alert-456",
            "status": "completed",
            "category": [{
                "coding": [{
                    "system": "http://wintehr.com/communication-category",
                    "code": "alert",
                    "display": "Clinical Alert"
                }]
            }],
            "subject": {"reference": "Patient/patient-123"},
            "sent": "2025-07-14T10:00:00Z",
            "payload": [{
                "contentString": "Patient glucose levels critically high: 450 mg/dL"
            }]
        }
        
        parent_id, _, _ = await storage_engine.create_resource('Communication', parent_comm)
        
        # Create follow-up communication
        followup_comm = {
            "resourceType": "Communication",
            "id": "follow-up-123",
            "status": "completed",
            "partOf": [{
                "reference": f"Communication/{parent_id}"
            }],
            "category": [{
                "coding": [{
                    "system": "http://wintehr.com/communication-category",
                    "code": "follow-up",
                    "display": "Follow-up Communication"
                }]
            }],
            "subject": {"reference": "Patient/patient-123"},
            "sent": "2025-07-14T12:00:00Z",
            "payload": [{
                "contentString": "Patient glucose levels now stabilized at 120 mg/dL following intervention"
            }]
        }
        
        followup_id, _, _ = await storage_engine.create_resource('Communication', followup_comm)
        
        # Test thread search by partOf
        thread_comms, total = await storage_engine.search_resources(
            'Communication',
            {'part-of': f'Communication/{parent_id}'}
        )
        
        assert total == 1
        assert thread_comms[0]['partOf'][0]['reference'] == f'Communication/{parent_id}'
        assert thread_comms[0]['category'][0]['coding'][0]['code'] == 'follow-up'
    
    async def test_clinical_workflow_integration(self, storage_engine: FHIRStorageEngine):
        """Test Communication integration with clinical workflows."""
        
        # Create lab result that triggers communication
        observation = {
            "resourceType": "Observation",
            "status": "final",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "33747-0",
                    "display": "Glucose"
                }]
            },
            "subject": {"reference": "Patient/patient-123"},
            "valueQuantity": {
                "value": 450,
                "unit": "mg/dL",
                "system": "http://unitsofmeasure.org"
            }
        }
        
        obs_id, _, _ = await storage_engine.create_resource('Observation', observation)
        
        # Create communication triggered by observation
        alert_comm = {
            "resourceType": "Communication",
            "status": "completed",
            "category": [{
                "coding": [{
                    "system": "http://wintehr.com/communication-category",
                    "code": "alert",
                    "display": "Clinical Alert"
                }]
            }],
            "priority": "stat",
            "subject": {"reference": "Patient/patient-123"},
            "sent": "2025-07-14T10:30:00Z",
            "recipient": [{
                "reference": "Practitioner/attending-physician"
            }],
            "sender": {"reference": "Organization/lab-system"},
            "payload": [{
                "contentString": "CRITICAL: Glucose level 450 mg/dL exceeds normal range (70-100 mg/dL)"
            }],
            "reasonReference": [{
                "reference": f"Observation/{obs_id}"
            }]
        }
        
        comm_id, _, _ = await storage_engine.create_resource('Communication', alert_comm)
        
        # Test workflow search by reason reference
        workflow_comms, total = await storage_engine.search_resources(
            'Communication',
            {'reason-reference': f'Observation/{obs_id}'}
        )
        
        assert total == 1
        assert workflow_comms[0]['reasonReference'][0]['reference'] == f'Observation/{obs_id}'
        assert workflow_comms[0]['priority'] == 'stat'
        assert workflow_comms[0]['category'][0]['coding'][0]['code'] == 'alert'
    
    async def test_real_time_notification_scenarios(self, storage_engine: FHIRStorageEngine):
        """Test real-time notification communication scenarios."""
        
        # Test urgent communication creation
        urgent_comm = {
            "resourceType": "Communication",
            "status": "in-progress",
            "category": [{
                "coding": [{
                    "system": "http://wintehr.com/communication-category",
                    "code": "urgent-notification",
                    "display": "Urgent Notification"
                }]
            }],
            "priority": "urgent",
            "subject": {"reference": "Patient/patient-123"},
            "sent": "2025-07-14T15:00:00Z",
            "recipient": [{
                "reference": "Practitioner/on-call-physician"
            }],
            "sender": {"reference": "Organization/emergency-department"},
            "payload": [{
                "contentString": "Patient requires immediate attention - vitals deteriorating"
            }]
        }
        
        comm_id, _, _ = await storage_engine.create_resource('Communication', urgent_comm)
        
        # Update to completed status
        urgent_comm['status'] = 'completed'
        urgent_comm['received'] = '2025-07-14T15:02:00Z'
        
        updated_id, version, _ = await storage_engine.update_resource(
            'Communication', comm_id, urgent_comm
        )
        
        # Test status transition tracking
        completed_comms, total = await storage_engine.search_resources(
            'Communication',
            {
                'status': 'completed',
                'priority': 'urgent'
            }
        )
        
        assert total == 1
        assert completed_comms[0]['status'] == 'completed'
        assert completed_comms[0]['received'] == '2025-07-14T15:02:00Z'
        assert completed_comms[0]['meta']['versionId'] == '2'

    async def test_communication_validation_and_error_handling(self, storage_engine: FHIRStorageEngine):
        """Test Communication resource validation and error scenarios."""
        
        # Test missing required fields
        invalid_comm = {
            "resourceType": "Communication"
            # Missing status - should fail validation
        }
        
        with pytest.raises(ValueError):
            await storage_engine.create_resource('Communication', invalid_comm)
        
        # Test invalid status value
        invalid_status_comm = {
            "resourceType": "Communication",
            "status": "invalid-status",
            "subject": {"reference": "Patient/patient-123"}
        }
        
        with pytest.raises(ValueError):
            await storage_engine.create_resource('Communication', invalid_status_comm)
        
        # Test valid minimal communication
        minimal_comm = {
            "resourceType": "Communication",
            "status": "completed",
            "subject": {"reference": "Patient/patient-123"}
        }
        
        # Should not raise error
        comm_id, _, _ = await storage_engine.create_resource('Communication', minimal_comm)
        assert comm_id is not None