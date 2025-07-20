"""
Task Resource Workflow Orchestration Test Harness

This test harness validates the complete Task resource implementation
with comprehensive workflow orchestration capabilities.

Tests cover:
- All FHIR R4 search parameters: status, business-status, code, focus, for,
  identifier, owner, part-of, patient, performer, requester, subject
- Clinical workflow orchestration and task management
- Role-based task assignment and tracking
- Task lifecycle and status transitions
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

from fhir.core.storage import FHIRStorageEngine
from fhir.models.resources import FHIRResource
from sqlalchemy.ext.asyncio import AsyncSession


class TestTaskWorkflowOrchestration:
    """Test harness for Task workflow orchestration capabilities."""
    
    @pytest.fixture
    async def storage_engine(self, async_session: AsyncSession):
        """Create storage engine instance."""
        return FHIRStorageEngine(async_session)
    
    @pytest.fixture
    def sample_tasks(self) -> List[Dict[str, Any]]:
        """Create sample Task resources for testing."""
        return [
            {
                "resourceType": "Task",
                "id": "lab-review-task-123",
                "identifier": [{
                    "system": "http://wintehr.com/task-id",
                    "value": "LAB-REVIEW-2025-001"
                }],
                "status": "requested",
                "intent": "order",
                "code": {
                    "coding": [{
                        "system": "http://wintehr.com/task-type",
                        "code": "lab-review",
                        "display": "Lab Review"
                    }]
                },
                "description": "Review critical glucose results and determine follow-up actions",
                "priority": "urgent",
                "for": {"reference": "Patient/patient-123"},
                "authoredOn": "2025-07-14T10:00:00Z",
                "lastModified": "2025-07-14T10:00:00Z",
                "requester": {"reference": "Organization/lab-department"},
                "owner": {"reference": "Practitioner/attending-physician-456"},
                "focus": {"reference": "Observation/glucose-result-789"},
                "businessStatus": {
                    "coding": [{
                        "system": "http://wintehr.com/task-business-status",
                        "code": "pending-review",
                        "display": "Pending Review"
                    }]
                },
                "reasonCode": [{
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "33747-0",
                        "display": "Glucose measurement"
                    }]
                }],
                "restriction": {
                    "period": {
                        "end": "2025-07-14T12:00:00Z"
                    }
                }
            },
            {
                "resourceType": "Task",
                "id": "medication-reconciliation-456",
                "identifier": [{
                    "system": "http://wintehr.com/task-id",
                    "value": "MED-RECON-2025-002"
                }],
                "status": "in-progress",
                "intent": "order",
                "code": {
                    "coding": [{
                        "system": "http://wintehr.com/task-type",
                        "code": "med-reconciliation",
                        "display": "Medication Reconciliation"
                    }]
                },
                "description": "Reconcile medications for patient admission",
                "priority": "routine",
                "for": {"reference": "Patient/patient-456"},
                "authoredOn": "2025-07-14T08:00:00Z",
                "lastModified": "2025-07-14T09:30:00Z",
                "requester": {"reference": "Practitioner/admitting-physician"},
                "owner": {"reference": "Practitioner/pharmacist-789"},
                "businessStatus": {
                    "coding": [{
                        "system": "http://wintehr.com/task-business-status",
                        "code": "in-review",
                        "display": "In Review"
                    }]
                },
                "executionPeriod": {
                    "start": "2025-07-14T09:30:00Z"
                },
                "note": [{
                    "authorReference": {"reference": "Practitioner/pharmacist-789"},
                    "time": "2025-07-14T09:30:00Z",
                    "text": "Started medication review process"
                }]
            },
            {
                "resourceType": "Task",
                "id": "patient-outreach-789",
                "identifier": [{
                    "system": "http://wintehr.com/task-id",
                    "value": "OUTREACH-2025-003"
                }],
                "status": "completed",
                "intent": "order",
                "code": {
                    "coding": [{
                        "system": "http://wintehr.com/task-type",
                        "code": "patient-outreach",
                        "display": "Patient Outreach"
                    }]
                },
                "description": "Contact patient for follow-up appointment scheduling",
                "priority": "routine",
                "for": {"reference": "Patient/patient-789"},
                "authoredOn": "2025-07-13T14:00:00Z",
                "lastModified": "2025-07-14T11:00:00Z",
                "requester": {"reference": "Practitioner/primary-care-123"},
                "owner": {"reference": "Practitioner/care-coordinator-456"},
                "businessStatus": {
                    "coding": [{
                        "system": "http://wintehr.com/task-business-status",
                        "code": "completed-successful",
                        "display": "Completed Successfully"
                    }]
                },
                "executionPeriod": {
                    "start": "2025-07-14T10:00:00Z",
                    "end": "2025-07-14T11:00:00Z"
                },
                "note": [{
                    "authorReference": {"reference": "Practitioner/care-coordinator-456"},
                    "time": "2025-07-14T11:00:00Z",
                    "text": "Successfully contacted patient. Appointment scheduled for 2025-07-20."
                }]
            }
        ]
    
    async def test_task_search_parameter_definitions(self, storage_engine: FHIRStorageEngine):
        """Test that Task has all required FHIR R4 search parameters."""
        search_params = storage_engine._get_search_parameter_definitions()
        
        # Verify Task search parameters exist
        assert 'Task' in search_params
        task_params = search_params['Task']
        
        # Test all FHIR R4 search parameters
        required_params = [
            'status', 'business-status', 'code', 'focus', 'for',
            'identifier', 'owner', 'part-of', 'patient', 'performer',
            'requester', 'subject', 'authored-on', 'modified',
            'priority', 'intent'
        ]
        
        for param in required_params:
            assert param in task_params, f"Missing search parameter: {param}"
        
        # Verify parameter types
        assert task_params['status']['type'] == 'token'
        assert task_params['business-status']['type'] == 'token'
        assert task_params['code']['type'] == 'token'
        assert task_params['focus']['type'] == 'reference'
        assert task_params['for']['type'] == 'reference'
        assert task_params['identifier']['type'] == 'token'
        assert task_params['owner']['type'] == 'reference'
        assert task_params['part-of']['type'] == 'reference'
        assert task_params['patient']['type'] == 'reference'
        assert task_params['requester']['type'] == 'reference'
        assert task_params['authored-on']['type'] == 'date'
        assert task_params['modified']['type'] == 'date'
        assert task_params['priority']['type'] == 'token'
    
    async def test_status_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by status parameter."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test requested status search
        requested_tasks, total = await storage_engine.search_resources(
            'Task',
            {'status': 'requested'}
        )
        
        assert total == 1
        assert requested_tasks[0]['status'] == 'requested'
        assert requested_tasks[0]['code']['coding'][0]['code'] == 'lab-review'
        
        # Test in-progress status search
        in_progress_tasks, total = await storage_engine.search_resources(
            'Task',
            {'status': 'in-progress'}
        )
        
        assert total == 1
        assert in_progress_tasks[0]['status'] == 'in-progress'
        assert in_progress_tasks[0]['code']['coding'][0]['code'] == 'med-reconciliation'
        
        # Test completed status search
        completed_tasks, total = await storage_engine.search_resources(
            'Task',
            {'status': 'completed'}
        )
        
        assert total == 1
        assert completed_tasks[0]['status'] == 'completed'
        assert completed_tasks[0]['code']['coding'][0]['code'] == 'patient-outreach'
    
    async def test_business_status_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by business-status parameter."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test pending review business status
        pending_tasks, total = await storage_engine.search_resources(
            'Task',
            {'business-status': 'pending-review'}
        )
        
        assert total == 1
        assert pending_tasks[0]['businessStatus']['coding'][0]['code'] == 'pending-review'
        
        # Test in-review business status
        in_review_tasks, total = await storage_engine.search_resources(
            'Task',
            {'business-status': 'in-review'}
        )
        
        assert total == 1
        assert in_review_tasks[0]['businessStatus']['coding'][0]['code'] == 'in-review'
        
        # Test completed-successful business status
        success_tasks, total = await storage_engine.search_resources(
            'Task',
            {'business-status': 'completed-successful'}
        )
        
        assert total == 1
        assert success_tasks[0]['businessStatus']['coding'][0]['code'] == 'completed-successful'
    
    async def test_code_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by code (task type) parameter."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test lab review task type
        lab_tasks, total = await storage_engine.search_resources(
            'Task',
            {'code': 'lab-review'}
        )
        
        assert total == 1
        assert lab_tasks[0]['code']['coding'][0]['code'] == 'lab-review'
        assert lab_tasks[0]['priority'] == 'urgent'
        
        # Test medication reconciliation task type
        med_tasks, total = await storage_engine.search_resources(
            'Task',
            {'code': 'med-reconciliation'}
        )
        
        assert total == 1
        assert med_tasks[0]['code']['coding'][0]['code'] == 'med-reconciliation'
        
        # Test patient outreach task type
        outreach_tasks, total = await storage_engine.search_resources(
            'Task',
            {'code': 'patient-outreach'}
        )
        
        assert total == 1
        assert outreach_tasks[0]['code']['coding'][0]['code'] == 'patient-outreach'
    
    async def test_focus_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by focus parameter."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test focus on observation
        observation_tasks, total = await storage_engine.search_resources(
            'Task',
            {'focus': 'Observation/glucose-result-789'}
        )
        
        assert total == 1
        assert observation_tasks[0]['focus']['reference'] == 'Observation/glucose-result-789'
        assert observation_tasks[0]['code']['coding'][0]['code'] == 'lab-review'
    
    async def test_patient_for_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by patient and for parameters."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test patient-specific task search
        patient_123_tasks, total = await storage_engine.search_resources(
            'Task',
            {'for': 'Patient/patient-123'}
        )
        
        assert total == 1
        assert patient_123_tasks[0]['for']['reference'] == 'Patient/patient-123'
        
        # Test patient parameter (should work same as 'for')
        patient_456_tasks, total = await storage_engine.search_resources(
            'Task',
            {'patient': 'Patient/patient-456'}
        )
        
        assert total == 1
        assert patient_456_tasks[0]['for']['reference'] == 'Patient/patient-456'
    
    async def test_identifier_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by identifier parameter."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test identifier search
        identified_tasks, total = await storage_engine.search_resources(
            'Task',
            {'identifier': 'LAB-REVIEW-2025-001'}
        )
        
        assert total == 1
        assert identified_tasks[0]['identifier'][0]['value'] == 'LAB-REVIEW-2025-001'
        
        # Test another identifier
        med_recon_tasks, total = await storage_engine.search_resources(
            'Task',
            {'identifier': 'MED-RECON-2025-002'}
        )
        
        assert total == 1
        assert med_recon_tasks[0]['identifier'][0]['value'] == 'MED-RECON-2025-002'
    
    async def test_owner_requester_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by owner and requester parameters."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test owner search
        physician_tasks, total = await storage_engine.search_resources(
            'Task',
            {'owner': 'Practitioner/attending-physician-456'}
        )
        
        assert total == 1
        assert physician_tasks[0]['owner']['reference'] == 'Practitioner/attending-physician-456'
        
        # Test pharmacist owner search
        pharmacist_tasks, total = await storage_engine.search_resources(
            'Task',
            {'owner': 'Practitioner/pharmacist-789'}
        )
        
        assert total == 1
        assert pharmacist_tasks[0]['owner']['reference'] == 'Practitioner/pharmacist-789'
        
        # Test requester search
        lab_requested_tasks, total = await storage_engine.search_resources(
            'Task',
            {'requester': 'Organization/lab-department'}
        )
        
        assert total == 1
        assert lab_requested_tasks[0]['requester']['reference'] == 'Organization/lab-department'
    
    async def test_priority_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by priority parameter."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test urgent priority search
        urgent_tasks, total = await storage_engine.search_resources(
            'Task',
            {'priority': 'urgent'}
        )
        
        assert total == 1
        assert urgent_tasks[0]['priority'] == 'urgent'
        assert urgent_tasks[0]['code']['coding'][0]['code'] == 'lab-review'
        
        # Test routine priority search
        routine_tasks, total = await storage_engine.search_resources(
            'Task',
            {'priority': 'routine'}
        )
        
        assert total == 2  # Both med-reconciliation and patient-outreach
    
    async def test_date_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search by authored-on and modified date parameters."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test authored-on date search
        today_tasks, total = await storage_engine.search_resources(
            'Task',
            {
                'authored-on': 'ge2025-07-14T00:00:00Z',
                'authored-on': 'le2025-07-14T23:59:59Z'
            }
        )
        
        assert total == 2  # Lab review and med reconciliation
        
        # Test specific authored date
        morning_tasks, total = await storage_engine.search_resources(
            'Task',
            {
                'authored-on': 'ge2025-07-14T08:00:00Z',
                'authored-on': 'le2025-07-14T10:00:00Z'
            }
        )
        
        assert total == 2
        
        # Test modified date search
        recently_modified, total = await storage_engine.search_resources(
            'Task',
            {'modified': 'ge2025-07-14T09:00:00Z'}
        )
        
        assert total == 3  # All tasks have recent modifications
    
    async def test_combined_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_tasks: List[Dict[str, Any]]
    ):
        """Test Task search with multiple parameters."""
        
        # Create test tasks
        for task_data in sample_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test combined search: status + priority + code
        urgent_requested_labs, total = await storage_engine.search_resources(
            'Task',
            {
                'status': 'requested',
                'priority': 'urgent',
                'code': 'lab-review'
            }
        )
        
        assert total == 1
        task = urgent_requested_labs[0]
        assert task['status'] == 'requested'
        assert task['priority'] == 'urgent'
        assert task['code']['coding'][0]['code'] == 'lab-review'
        
        # Test patient + status search
        patient_tasks, total = await storage_engine.search_resources(
            'Task',
            {
                'for': 'Patient/patient-456',
                'status': 'in-progress'
            }
        )
        
        assert total == 1
        assert patient_tasks[0]['for']['reference'] == 'Patient/patient-456'
        assert patient_tasks[0]['status'] == 'in-progress'
    
    async def test_task_lifecycle_transitions(self, storage_engine: FHIRStorageEngine):
        """Test Task status lifecycle transitions."""
        
        # Create initial task
        task_data = {
            "resourceType": "Task",
            "status": "requested",
            "intent": "order",
            "code": {
                "coding": [{
                    "system": "http://wintehr.com/task-type",
                    "code": "follow-up",
                    "display": "Follow-up"
                }]
            },
            "for": {"reference": "Patient/patient-123"},
            "authoredOn": "2025-07-14T10:00:00Z",
            "lastModified": "2025-07-14T10:00:00Z",
            "priority": "routine"
        }
        
        task_id, version_id, _ = await storage_engine.create_resource('Task', task_data)
        
        # Transition to accepted
        task_data['status'] = 'accepted'
        task_data['lastModified'] = '2025-07-14T10:30:00Z'
        task_data['owner'] = {'reference': 'Practitioner/assigned-provider'}
        
        updated_id, version2, _ = await storage_engine.update_resource('Task', task_id, task_data)
        
        # Transition to in-progress
        task_data['status'] = 'in-progress'
        task_data['lastModified'] = '2025-07-14T11:00:00Z'
        task_data['executionPeriod'] = {'start': '2025-07-14T11:00:00Z'}
        
        updated_id, version3, _ = await storage_engine.update_resource('Task', task_id, task_data)
        
        # Transition to completed
        task_data['status'] = 'completed'
        task_data['lastModified'] = '2025-07-14T12:00:00Z'
        task_data['executionPeriod']['end'] = '2025-07-14T12:00:00Z'
        
        updated_id, version4, _ = await storage_engine.update_resource('Task', task_id, task_data)
        
        # Verify final state
        completed_tasks, total = await storage_engine.search_resources(
            'Task',
            {'status': 'completed', 'for': 'Patient/patient-123'}
        )
        
        assert total == 1
        final_task = completed_tasks[0]
        assert final_task['status'] == 'completed'
        assert final_task['meta']['versionId'] == '4'
        assert 'executionPeriod' in final_task
        assert 'end' in final_task['executionPeriod']
    
    async def test_hierarchical_task_relationships(self, storage_engine: FHIRStorageEngine):
        """Test Task hierarchical relationships with partOf."""
        
        # Create parent task
        parent_task = {
            "resourceType": "Task",
            "id": "parent-diabetes-management",
            "status": "in-progress",
            "intent": "plan",
            "code": {
                "coding": [{
                    "system": "http://wintehr.com/task-type",
                    "code": "care-plan-execution",
                    "display": "Care Plan Execution"
                }]
            },
            "description": "Comprehensive diabetes management workflow",
            "for": {"reference": "Patient/patient-123"},
            "authoredOn": "2025-07-14T08:00:00Z",
            "priority": "routine"
        }
        
        parent_id, _, _ = await storage_engine.create_resource('Task', parent_task)
        
        # Create child tasks
        child_tasks = [
            {
                "resourceType": "Task",
                "status": "requested",
                "intent": "order",
                "partOf": [{"reference": f"Task/{parent_id}"}],
                "code": {
                    "coding": [{
                        "system": "http://wintehr.com/task-type",
                        "code": "lab-order",
                        "display": "Lab Order"
                    }]
                },
                "description": "Order HbA1c lab test",
                "for": {"reference": "Patient/patient-123"},
                "priority": "routine"
            },
            {
                "resourceType": "Task",
                "status": "requested",
                "intent": "order",
                "partOf": [{"reference": f"Task/{parent_id}"}],
                "code": {
                    "coding": [{
                        "system": "http://wintehr.com/task-type",
                        "code": "patient-education",
                        "display": "Patient Education"
                    }]
                },
                "description": "Provide diabetes self-management education",
                "for": {"reference": "Patient/patient-123"},
                "priority": "routine"
            }
        ]
        
        child_ids = []
        for child_data in child_tasks:
            child_id, _, _ = await storage_engine.create_resource('Task', child_data)
            child_ids.append(child_id)
        
        # Test partOf search
        child_tasks_found, total = await storage_engine.search_resources(
            'Task',
            {'part-of': f'Task/{parent_id}'}
        )
        
        assert total == 2
        for task in child_tasks_found:
            assert task['partOf'][0]['reference'] == f'Task/{parent_id}'
    
    async def test_workflow_orchestration_scenarios(self, storage_engine: FHIRStorageEngine):
        """Test clinical workflow orchestration scenarios."""
        
        # Scenario: Lab result triggers multiple tasks
        
        # 1. Create critical lab observation
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
        
        # 2. Create workflow tasks triggered by observation
        workflow_tasks = [
            {
                "resourceType": "Task",
                "status": "requested",
                "intent": "order",
                "code": {
                    "coding": [{
                        "system": "http://wintehr.com/task-type",
                        "code": "physician-review",
                        "display": "Physician Review"
                    }]
                },
                "description": "Review critical glucose result",
                "priority": "stat",
                "for": {"reference": "Patient/patient-123"},
                "focus": {"reference": f"Observation/{obs_id}"},
                "owner": {"reference": "Practitioner/attending-physician"},
                "restriction": {
                    "period": {"end": "2025-07-14T11:00:00Z"}
                }
            },
            {
                "resourceType": "Task",
                "status": "requested",
                "intent": "order",
                "code": {
                    "coding": [{
                        "system": "http://wintehr.com/task-type",
                        "code": "nurse-notification",
                        "display": "Nurse Notification"
                    }]
                },
                "description": "Notify charge nurse of critical result",
                "priority": "urgent",
                "for": {"reference": "Patient/patient-123"},
                "focus": {"reference": f"Observation/{obs_id}"},
                "owner": {"reference": "Practitioner/charge-nurse"}
            },
            {
                "resourceType": "Task",
                "status": "requested",
                "intent": "order",
                "code": {
                    "coding": [{
                        "system": "http://wintehr.com/task-type",
                        "code": "patient-contact",
                        "display": "Patient Contact"
                    }]
                },
                "description": "Contact patient about critical glucose result",
                "priority": "urgent",
                "for": {"reference": "Patient/patient-123"},
                "focus": {"reference": f"Observation/{obs_id}"},
                "owner": {"reference": "Practitioner/care-coordinator"}
            }
        ]
        
        # Create workflow tasks
        for task_data in workflow_tasks:
            await storage_engine.create_resource('Task', task_data)
        
        # Test workflow orchestration queries
        
        # Find all tasks related to the critical observation
        observation_tasks, total = await storage_engine.search_resources(
            'Task',
            {'focus': f'Observation/{obs_id}'}
        )
        
        assert total == 3
        
        # Find urgent/stat priority tasks for the patient
        urgent_tasks, total = await storage_engine.search_resources(
            'Task',
            {
                'for': 'Patient/patient-123',
                'priority': 'urgent,stat'
            }
        )
        
        assert total == 3
        
        # Find physician tasks
        physician_tasks, total = await storage_engine.search_resources(
            'Task',
            {
                'owner': 'Practitioner/attending-physician',
                'priority': 'stat'
            }
        )
        
        assert total == 1
        assert physician_tasks[0]['priority'] == 'stat'
        assert physician_tasks[0]['code']['coding'][0]['code'] == 'physician-review'

    async def test_task_assignment_and_delegation(self, storage_engine: FHIRStorageEngine):
        """Test task assignment and delegation scenarios."""
        
        # Create task without owner (unassigned)
        unassigned_task = {
            "resourceType": "Task",
            "status": "requested",
            "intent": "order",
            "code": {
                "coding": [{
                    "system": "http://wintehr.com/task-type",
                    "code": "general-review",
                    "display": "General Review"
                }]
            },
            "for": {"reference": "Patient/patient-123"},
            "requester": {"reference": "Practitioner/requesting-physician"},
            "priority": "routine"
        }
        
        task_id, _, _ = await storage_engine.create_resource('Task', unassigned_task)
        
        # Assign task to owner
        unassigned_task['owner'] = {'reference': 'Practitioner/assigned-provider'}
        unassigned_task['status'] = 'accepted'
        
        await storage_engine.update_resource('Task', task_id, unassigned_task)
        
        # Delegate task to different owner
        unassigned_task['owner'] = {'reference': 'Practitioner/delegate-provider'}
        unassigned_task['note'] = [{
            'authorReference': {'reference': 'Practitioner/assigned-provider'},
            'time': '2025-07-14T12:00:00Z',
            'text': 'Delegating task due to workload'
        }]
        
        await storage_engine.update_resource('Task', task_id, unassigned_task)
        
        # Test delegation search
        delegated_tasks, total = await storage_engine.search_resources(
            'Task',
            {'owner': 'Practitioner/delegate-provider'}
        )
        
        assert total == 1
        assert delegated_tasks[0]['owner']['reference'] == 'Practitioner/delegate-provider'
        assert delegated_tasks[0]['note'][0]['text'] == 'Delegating task due to workload'

    async def test_task_validation_and_error_handling(self, storage_engine: FHIRStorageEngine):
        """Test Task resource validation and error scenarios."""
        
        # Test missing required fields
        invalid_task = {
            "resourceType": "Task"
            # Missing status and intent - should fail validation
        }
        
        with pytest.raises(ValueError):
            await storage_engine.create_resource('Task', invalid_task)
        
        # Test invalid status value
        invalid_status_task = {
            "resourceType": "Task",
            "status": "invalid-status",
            "intent": "order"
        }
        
        with pytest.raises(ValueError):
            await storage_engine.create_resource('Task', invalid_status_task)
        
        # Test valid minimal task
        minimal_task = {
            "resourceType": "Task",
            "status": "requested",
            "intent": "order"
        }
        
        # Should not raise error
        task_id, _, _ = await storage_engine.create_resource('Task', minimal_task)
        assert task_id is not None