"""
Clinical Tasks API endpoints.
Manages clinical tasks and to-dos for healthcare providers.

v4.2 - Migrated to pure FHIR architecture using HAPI FHIR JPA Server (Phase 4)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from api.auth import get_current_user
from services.hapi_fhir_client import HAPIFHIRClient
from api.cds_hooks.constants import ExtensionURLs

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/clinical/tasks", tags=["clinical-tasks"])

# Pydantic models
class TaskCreate(BaseModel):
    patient_id: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high, urgent
    status: str = "pending"  # pending, in-progress, completed, cancelled
    due_date: Optional[datetime] = None
    assignee: Optional[str] = None
    task_type: Optional[str] = "general"  # general, follow-up, lab-review, medication, referral

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    assignee: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    patient_id: str
    title: str
    description: Optional[str]
    priority: str
    status: str
    due_date: Optional[datetime]
    assignee: Optional[str]
    task_type: str
    created_at: datetime
    updated_at: datetime
    created_by: str


def extract_task_response(fhir_task: dict) -> TaskResponse:
    """Helper function to extract TaskResponse from FHIR Task resource"""
    # Extract patient reference
    patient_ref = fhir_task.get("for", {}).get("reference", "")
    patient_id_extracted = patient_ref.replace("Patient/", "") if patient_ref else ""

    # Extract description/note
    notes = fhir_task.get("note", [])
    description = notes[0].get("text") if notes else None

    # Extract due date
    restriction = fhir_task.get("restriction", {})
    period = restriction.get("period", {})
    due_date = period.get("end")

    # Extract assignee
    owner_ref = fhir_task.get("owner", {}).get("reference", "")
    assignee_id = owner_ref.replace("Practitioner/", "") if owner_ref else None

    # Extract task type
    code = fhir_task.get("code", {})
    codings = code.get("coding", [])
    task_type = codings[0].get("code", "general") if codings else "general"

    # Extract created by
    requester_ref = fhir_task.get("requester", {}).get("reference", "")
    created_by = requester_ref.replace("Practitioner/", "") if requester_ref else ""

    # Extract timestamps
    meta = fhir_task.get("meta", {})
    created_at = meta.get("lastUpdated", datetime.now(timezone.utc).isoformat())

    return TaskResponse(
        id=fhir_task.get("id", ""),
        patient_id=patient_id_extracted,
        title=fhir_task.get("description", ""),
        description=description,
        priority=fhir_task.get("priority", "medium"),
        status=fhir_task.get("status", "pending"),
        due_date=due_date,
        assignee=assignee_id,
        task_type=task_type,
        created_at=created_at,
        updated_at=created_at,
        created_by=created_by
    )


@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new clinical task as FHIR Task resource"""
    hapi_client = HAPIFHIRClient()

    # Build FHIR Task resource
    fhir_task = {
        "resourceType": "Task",
        "status": task.status,
        "priority": task.priority,
        "intent": "order",
        "description": task.title,
        "for": {
            "reference": f"Patient/{task.patient_id}"
        },
        "authoredOn": datetime.now(timezone.utc).isoformat(),
        "requester": {
            "reference": f"Practitioner/{current_user.get('id', 'unknown')}"
        }
    }

    # Add optional fields
    if task.description:
        fhir_task["note"] = [{"text": task.description}]

    if task.due_date:
        fhir_task["restriction"] = {
            "period": {
                "end": task.due_date.isoformat()
            }
        }

    if task.assignee:
        fhir_task["owner"] = {
            "reference": f"Practitioner/{task.assignee}"
        }

    if task.task_type:
        fhir_task["code"] = {
            "coding": [{
                "system": ExtensionURLs.TASK_TYPE_SYSTEM,
                "code": task.task_type,
                "display": task.task_type.replace("-", " ").title()
            }]
        }

    # Create resource via HAPI FHIR
    try:
        created_resource = await hapi_client.create("Task", fhir_task)
        task_id = created_resource["id"]

        return TaskResponse(
            id=task_id,
            patient_id=task.patient_id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            status=task.status,
            due_date=task.due_date,
            assignee=task.assignee,
            task_type=task.task_type,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            created_by=current_user.get('id', 'unknown')
        )
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")

@router.get("/", response_model=List[TaskResponse])
async def get_tasks(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None)
):
    """Get clinical tasks with optional filters using HAPI FHIR search"""
    hapi_client = HAPIFHIRClient()

    try:
        # Build search parameters
        search_params = {}
        if patient_id:
            search_params['patient'] = f'Patient/{patient_id}'
        if status:
            search_params['status'] = status
        if priority:
            search_params['priority'] = priority
        if assignee:
            search_params['owner'] = f'Practitioner/{assignee}'

        # Search HAPI FHIR - returns Bundle dict
        bundle = await hapi_client.search("Task", search_params)

        tasks = []
        for entry in bundle.get("entry", []):
            fhir_task = entry.get("resource", {})
            task = extract_task_response(fhir_task)
            tasks.append(task)

        return tasks

    except Exception as e:
        logger.error(f"Failed to search tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search tasks: {str(e)}")

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get a specific clinical task by ID"""
    hapi_client = HAPIFHIRClient()

    try:
        # Read task from HAPI FHIR
        fhir_task = await hapi_client.read("Task", task_id)
        return extract_task_response(fhir_task)

    except Exception as e:
        logger.error(f"Failed to get task {task_id}: {e}")
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate
):
    """Update a clinical task"""
    hapi_client = HAPIFHIRClient()

    try:
        # Read existing task
        existing_task = await hapi_client.read("Task", task_id)

        # Update fields in dict
        if task_update.title is not None:
            existing_task["description"] = task_update.title

        if task_update.description is not None:
            existing_task["note"] = [{"text": task_update.description}]

        if task_update.priority is not None:
            existing_task["priority"] = task_update.priority

        if task_update.status is not None:
            existing_task["status"] = task_update.status

        if task_update.due_date is not None:
            existing_task["restriction"] = {
                "period": {
                    "end": task_update.due_date.isoformat()
                }
            }

        if task_update.assignee is not None:
            existing_task["owner"] = {
                "reference": f"Practitioner/{task_update.assignee}"
            }

        # Update via HAPI FHIR
        updated_resource = await hapi_client.update("Task", task_id, existing_task)

        # Return updated task using helper
        return extract_task_response(updated_resource)

    except Exception as e:
        logger.error(f"Failed to update task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")

@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a clinical task"""
    hapi_client = HAPIFHIRClient()

    try:
        await hapi_client.delete("Task", task_id)
        return {"message": "Task deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete task: {str(e)}")


@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    status_update: dict
):
    """Update task status"""
    hapi_client = HAPIFHIRClient()

    try:
        # Read existing task
        existing_task = await hapi_client.read("Task", task_id)

        # Update status
        existing_task["status"] = status_update.get("status")

        # Update via HAPI FHIR
        updated_resource = await hapi_client.update("Task", task_id, existing_task)

        return {
            "message": "Task status updated successfully",
            "status": updated_resource["status"]
        }

    except Exception as e:
        logger.error(f"Failed to update task status {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update status: {str(e)}")