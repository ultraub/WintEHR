"""
FHIR Task Converter

Handles conversion between FHIR Task resources and internal data models.
Used for clinical tasks, reminders, and workflow items.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from core.fhir.resources_r4b import (
    Task, CodeableConcept, Coding, Reference,
    Identifier, Annotation
)
from fhir.resources.R4B.task import TaskRestriction
from fhir.resources.R4B.period import Period


class TaskConverter:
    """Converter for FHIR Task resources"""
    
    # Task type codes
    TASK_TYPE_CODES = {
        'review': {
            'system': 'http://wintehr.com/task-type',
            'code': 'review',
            'display': 'Review'
        },
        'follow_up': {
            'system': 'http://wintehr.com/task-type',
            'code': 'follow-up',
            'display': 'Follow-up'
        },
        'lab_review': {
            'system': 'http://wintehr.com/task-type',
            'code': 'lab-review',
            'display': 'Lab Review'
        },
        'med_reconciliation': {
            'system': 'http://wintehr.com/task-type',
            'code': 'med-recon',
            'display': 'Medication Reconciliation'
        },
        'prior_auth': {
            'system': 'http://wintehr.com/task-type',
            'code': 'prior-auth',
            'display': 'Prior Authorization'
        },
        'patient_outreach': {
            'system': 'http://wintehr.com/task-type',
            'code': 'outreach',
            'display': 'Patient Outreach'
        },
        'referral': {
            'system': 'http://wintehr.com/task-type',
            'code': 'referral',
            'display': 'Referral'
        },
        'documentation': {
            'system': 'http://wintehr.com/task-type',
            'code': 'documentation',
            'display': 'Documentation'
        }
    }
    
    # Status mapping
    STATUS_MAP = {
        # Internal -> FHIR
        'pending': 'requested',
        'in_progress': 'in-progress',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'on_hold': 'on-hold',
        'failed': 'failed',
        'ready': 'ready',
        'accepted': 'accepted',
        'rejected': 'rejected'
    }
    
    REVERSE_STATUS_MAP = {v: k for k, v in STATUS_MAP.items()}
    
    # Priority mapping
    PRIORITY_MAP = {
        'stat': 'stat',
        'urgent': 'urgent',
        'high': 'urgent',
        'asap': 'asap',
        'routine': 'routine',
        'normal': 'routine',
        'low': 'routine'
    }
    
    @staticmethod
    def to_fhir(data: Dict[str, Any]) -> Task:
        """Convert internal task data to FHIR Task"""
        
        task = Task()
        
        # Required fields
        task.status = TaskConverter.STATUS_MAP.get(data.get('status', 'pending'), 'requested')
        task.intent = data.get('intent', 'order')
        
        # Priority
        task.priority = TaskConverter.PRIORITY_MAP.get(data.get('priority', 'routine'), 'routine')
        
        # Code (task type)
        task_type = data.get('taskType', 'review')
        type_info = TaskConverter.TASK_TYPE_CODES.get(task_type, TaskConverter.TASK_TYPE_CODES['review'])
        
        task.code = CodeableConcept()
        task.code.coding = [Coding()]
        task.code.coding[0].system = type_info['system']
        task.code.coding[0].code = type_info['code']
        task.code.coding[0].display = type_info['display']
        
        if data.get('taskTypeDisplay'):
            task.code.text = data['taskTypeDisplay']
        
        # Description
        if data.get('description'):
            task.description = data['description']
        
        # For (Patient)
        if data.get('patientId'):
            task.for_fhir = Reference()
            task.for_fhir.reference = f"Patient/{data['patientId']}"
        
        # Encounter
        if data.get('encounterId'):
            task.encounter = Reference()
            task.encounter.reference = f"Encounter/{data['encounterId']}"
        
        # Owner (assigned to)
        if data.get('assignedTo'):
            task.owner = Reference()
            task.owner.reference = f"Practitioner/{data['assignedTo']}"
        
        # Requester (created by)
        if data.get('createdBy'):
            task.requester = Reference()
            task.requester.reference = f"Practitioner/{data['createdBy']}"
        
        # Authored on
        task.authoredOn = data.get('createdAt', datetime.now().isoformat())
        
        # Last modified
        if data.get('updatedAt'):
            task.lastModified = data['updatedAt']
        
        # Restriction (due date)
        if data.get('dueDate'):
            task.restriction = TaskRestriction()
            task.restriction.period = Period()
            task.restriction.period.end = data['dueDate']
        
        # Notes
        if data.get('notes'):
            task.note = []
            for note in data['notes']:
                annotation = Annotation()
                annotation.text = note.get('text', '')
                annotation.time = note.get('createdAt', datetime.now().isoformat())
                if note.get('createdBy'):
                    annotation.authorReference = Reference()
                    annotation.authorReference.reference = f"Practitioner/{note['createdBy']}"
                task.note.append(annotation)
        
        # Identifiers
        if data.get('id'):
            task.identifier = [Identifier()]
            task.identifier[0].system = "http://wintehr.com/task"
            task.identifier[0].value = str(data['id'])
        
        # Reason
        if data.get('reason'):
            task.reasonCode = CodeableConcept()
            task.reasonCode.text = data['reason']
        
        # Focus (what the task is about - could be another resource)
        if data.get('focusReference'):
            task.focus = Reference()
            task.focus.reference = data['focusReference']
        
        # Business status
        if data.get('businessStatus'):
            task.businessStatus = CodeableConcept()
            task.businessStatus.text = data['businessStatus']
        
        # Execution period
        if data.get('startDate') or data.get('completedDate'):
            task.executionPeriod = Period()
            if data.get('startDate'):
                task.executionPeriod.start = data['startDate']
            if data.get('completedDate'):
                task.executionPeriod.end = data['completedDate']
        
        return task
    
    @staticmethod
    def from_fhir(task: Task) -> Dict[str, Any]:
        """Convert FHIR Task to internal task format"""
        
        # Determine task type from code
        task_type = 'review'  # default
        if task.code and task.code.coding:
            code = task.code.coding[0].code
            for key, value in TaskConverter.TASK_TYPE_CODES.items():
                if value['code'] == code:
                    task_type = key
                    break
        
        # Build internal representation
        data = {
            'resourceType': 'Task',
            'id': task.id,
            'taskType': task_type,
            'status': TaskConverter.REVERSE_STATUS_MAP.get(task.status, task.status),
            'intent': task.intent,
            'priority': task.priority,
            'description': task.description,
            'createdAt': task.authoredOn,
            'updatedAt': task.lastModified,
        }
        
        # Task type display
        if task.code and task.code.text:
            data['taskTypeDisplay'] = task.code.text
        elif task.code and task.code.coding and task.code.coding[0].display:
            data['taskTypeDisplay'] = task.code.coding[0].display
        
        # Extract references
        if task.for_fhir and task.for_fhir.reference:
            data['patientId'] = task.for_fhir.reference.split('/')[-1]
        
        if task.encounter and task.encounter.reference:
            data['encounterId'] = task.encounter.reference.split('/')[-1]
        
        if task.owner and task.owner.reference:
            data['assignedTo'] = task.owner.reference.split('/')[-1]
        
        if task.requester and task.requester.reference:
            data['createdBy'] = task.requester.reference.split('/')[-1]
        
        # Due date from restriction
        if task.restriction and task.restriction.period and task.restriction.period.end:
            data['dueDate'] = task.restriction.period.end
        
        # Notes
        if task.note:
            data['notes'] = []
            for note in task.note:
                note_data = {
                    'text': note.text,
                    'createdAt': note.time
                }
                if note.authorReference and note.authorReference.reference:
                    note_data['createdBy'] = note.authorReference.reference.split('/')[-1]
                data['notes'].append(note_data)
        
        # Reason
        if task.reasonCode and task.reasonCode.text:
            data['reason'] = task.reasonCode.text
        
        # Focus
        if task.focus and task.focus.reference:
            data['focusReference'] = task.focus.reference
        
        # Business status
        if task.businessStatus and task.businessStatus.text:
            data['businessStatus'] = task.businessStatus.text
        
        # Execution period
        if task.executionPeriod:
            if task.executionPeriod.start:
                data['startDate'] = task.executionPeriod.start
            if task.executionPeriod.end:
                data['completedDate'] = task.executionPeriod.end
        
        # Extract identifiers
        if task.identifier:
            for identifier in task.identifier:
                if identifier.system == "http://wintehr.com/task":
                    data['externalId'] = identifier.value
        
        return data
    
    @staticmethod
    def get_search_params() -> List[Dict[str, Any]]:
        """Get supported search parameters for Task"""
        return [
            {
                'name': 'patient',
                'type': 'reference',
                'documentation': 'Search by patient'
            },
            {
                'name': 'encounter',
                'type': 'reference',
                'documentation': 'Search by encounter'
            },
            {
                'name': 'status',
                'type': 'token',
                'documentation': 'Search by status'
            },
            {
                'name': 'priority',
                'type': 'token',
                'documentation': 'Search by priority'
            },
            {
                'name': 'code',
                'type': 'token',
                'documentation': 'Search by task type'
            },
            {
                'name': 'owner',
                'type': 'reference',
                'documentation': 'Search by owner (assigned to)'
            },
            {
                'name': 'requester',
                'type': 'reference',
                'documentation': 'Search by requester'
            },
            {
                'name': 'authored-on',
                'type': 'date',
                'documentation': 'Search by authored date'
            },
            {
                'name': 'modified',
                'type': 'date',
                'documentation': 'Search by last modified date'
            },
            {
                'name': 'period',
                'type': 'date',
                'documentation': 'Search by due date'
            },
            {
                'name': 'business-status',
                'type': 'token',
                'documentation': 'Search by business status'
            },
            {
                'name': '_lastUpdated',
                'type': 'date',
                'documentation': 'When the resource version last changed'
            }
        ]