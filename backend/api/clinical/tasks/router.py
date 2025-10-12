"""
Clinical Tasks API endpoints.
Manages clinical tasks and to-dos for healthcare providers.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import uuid

from database import get_db_session
from api.auth import get_current_user
from services.fhir_client_config import get_resource, search_resources, create_resource, update_resource, delete_resource

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

@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    """Create a new clinical task."""
    # Create FHIR Task resource
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
                "system": "http://wintehr.com/fhir/task-type",
                "code": task.task_type,
                "display": task.task_type.replace("-", " ").title()
            }]
        }

    # Create resource in HAPI FHIR
    try:
        created_task = create_resource('Task', fhir_task)
        task_id = created_task.id if hasattr(created_task, 'id') else str(uuid.uuid4())

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
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")

@router.get("/", response_model=List[TaskResponse])
async def get_tasks(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session)
):
    """Get clinical tasks with optional filters."""
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

        # Search Task resources from HAPI FHIR
        task_resources = search_resources('Task', search_params)

        tasks = []
        if task_resources:
            for fhir_task in task_resources:
                # Extract patient reference
                patient_ref = ""
                if hasattr(fhir_task, 'for_fhir') and fhir_task.for_fhir:
                    patient_ref = fhir_task.for_fhir.reference if hasattr(fhir_task.for_fhir, 'reference') else ""
                patient_id_extracted = patient_ref.replace("Patient/", "") if patient_ref else ""

                # Extract description/note
                description = None
                if hasattr(fhir_task, 'note') and fhir_task.note:
                    first_note = fhir_task.note[0] if fhir_task.note else None
                    if first_note and hasattr(first_note, 'text'):
                        description = first_note.text

                # Extract due date
                due_date = None
                if hasattr(fhir_task, 'restriction') and fhir_task.restriction:
                    if hasattr(fhir_task.restriction, 'period') and fhir_task.restriction.period:
                        if hasattr(fhir_task.restriction.period, 'end'):
                            due_date = fhir_task.restriction.period.end

                # Extract assignee
                assignee_id = None
                if hasattr(fhir_task, 'owner') and fhir_task.owner:
                    owner_ref = fhir_task.owner.reference if hasattr(fhir_task.owner, 'reference') else ""
                    assignee_id = owner_ref.replace("Practitioner/", "") if owner_ref else None

                # Extract task type
                task_type = "general"
                if hasattr(fhir_task, 'code') and fhir_task.code:
                    if hasattr(fhir_task.code, 'coding') and fhir_task.code.coding:
                        first_coding = fhir_task.code.coding[0] if fhir_task.code.coding else None
                        if first_coding and hasattr(first_coding, 'code'):
                            task_type = first_coding.code

                # Extract created by
                created_by = ""
                if hasattr(fhir_task, 'requester') and fhir_task.requester:
                    requester_ref = fhir_task.requester.reference if hasattr(fhir_task.requester, 'reference') else ""
                    created_by = requester_ref.replace("Practitioner/", "") if requester_ref else ""

                # Build response
                task = TaskResponse(
                    id=fhir_task.id if hasattr(fhir_task, 'id') else "",
                    patient_id=patient_id_extracted,
                    title=fhir_task.description if hasattr(fhir_task, 'description') else "",
                    description=description,
                    priority=fhir_task.priority if hasattr(fhir_task, 'priority') else "medium",
                    status=fhir_task.status if hasattr(fhir_task, 'status') else "pending",
                    due_date=due_date,
                    assignee=assignee_id,
                    task_type=task_type,
                    created_at=fhir_task.authoredOn.isostring if hasattr(fhir_task, 'authoredOn') and fhir_task.authoredOn else datetime.now(timezone.utc),
                    updated_at=fhir_task.meta.lastUpdated.isostring if hasattr(fhir_task, 'meta') and fhir_task.meta and hasattr(fhir_task.meta, 'lastUpdated') else datetime.now(timezone.utc),
                    created_by=created_by
                )
                tasks.append(task)

        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {str(e)}")

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Get a specific task by ID."""
    try:
        # Get Task resource from HAPI FHIR
        fhir_task = get_resource('Task', task_id)

        if not fhir_task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Extract patient reference
        patient_ref = ""
        if hasattr(fhir_task, 'for_fhir') and fhir_task.for_fhir:
            patient_ref = fhir_task.for_fhir.reference if hasattr(fhir_task.for_fhir, 'reference') else ""
        patient_id_extracted = patient_ref.replace("Patient/", "") if patient_ref else ""

        # Extract description/note
        description = None
        if hasattr(fhir_task, 'note') and fhir_task.note:
            first_note = fhir_task.note[0] if fhir_task.note else None
            if first_note and hasattr(first_note, 'text'):
                description = first_note.text

        # Extract due date
        due_date = None
        if hasattr(fhir_task, 'restriction') and fhir_task.restriction:
            if hasattr(fhir_task.restriction, 'period') and fhir_task.restriction.period:
                if hasattr(fhir_task.restriction.period, 'end'):
                    due_date = fhir_task.restriction.period.end

        # Extract assignee
        assignee_id = None
        if hasattr(fhir_task, 'owner') and fhir_task.owner:
            owner_ref = fhir_task.owner.reference if hasattr(fhir_task.owner, 'reference') else ""
            assignee_id = owner_ref.replace("Practitioner/", "") if owner_ref else None

        # Extract task type
        task_type = "general"
        if hasattr(fhir_task, 'code') and fhir_task.code:
            if hasattr(fhir_task.code, 'coding') and fhir_task.code.coding:
                first_coding = fhir_task.code.coding[0] if fhir_task.code.coding else None
                if first_coding and hasattr(first_coding, 'code'):
                    task_type = first_coding.code

        # Extract created by
        created_by = ""
        if hasattr(fhir_task, 'requester') and fhir_task.requester:
            requester_ref = fhir_task.requester.reference if hasattr(fhir_task.requester, 'reference') else ""
            created_by = requester_ref.replace("Practitioner/", "") if requester_ref else ""

        return TaskResponse(
            id=fhir_task.id if hasattr(fhir_task, 'id') else "",
            patient_id=patient_id_extracted,
            title=fhir_task.description if hasattr(fhir_task, 'description') else "",
            description=description,
            priority=fhir_task.priority if hasattr(fhir_task, 'priority') else "medium",
            status=fhir_task.status if hasattr(fhir_task, 'status') else "pending",
            due_date=due_date,
            assignee=assignee_id,
            task_type=task_type,
            created_at=fhir_task.authoredOn.isostring if hasattr(fhir_task, 'authoredOn') and fhir_task.authoredOn else datetime.now(timezone.utc),
            updated_at=fhir_task.meta.lastUpdated.isostring if hasattr(fhir_task, 'meta') and fhir_task.meta and hasattr(fhir_task.meta, 'lastUpdated') else datetime.now(timezone.utc),
            created_by=created_by
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch task: {str(e)}")

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    """Update a task."""
    try:
        # Get existing task from HAPI FHIR
        fhir_task = get_resource('Task', task_id)

        if not fhir_task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Convert to dict for updates
        task_dict = fhir_task.as_json() if hasattr(fhir_task, 'as_json') else fhir_task

        # Update fields
        if task_update.title is not None:
            task_dict["description"] = task_update.title

        if task_update.description is not None:
            task_dict["note"] = [{"text": task_update.description}]

        if task_update.priority is not None:
            task_dict["priority"] = task_update.priority

        if task_update.status is not None:
            task_dict["status"] = task_update.status

        if task_update.due_date is not None:
            task_dict["restriction"] = {
                "period": {
                    "end": task_update.due_date.isoformat()
                }
            }

        if task_update.assignee is not None:
            task_dict["owner"] = {
                "reference": f"Practitioner/{task_update.assignee}"
            }

        # Update in HAPI FHIR
        updated_task = update_resource('Task', task_id, task_dict)

        # Extract response data
        patient_ref = ""
        if hasattr(updated_task, 'for_fhir') and updated_task.for_fhir:
            patient_ref = updated_task.for_fhir.reference if hasattr(updated_task.for_fhir, 'reference') else ""
        patient_id_extracted = patient_ref.replace("Patient/", "") if patient_ref else ""

        description = None
        if hasattr(updated_task, 'note') and updated_task.note:
            first_note = updated_task.note[0] if updated_task.note else None
            if first_note and hasattr(first_note, 'text'):
                description = first_note.text

        due_date = None
        if hasattr(updated_task, 'restriction') and updated_task.restriction:
            if hasattr(updated_task.restriction, 'period') and updated_task.restriction.period:
                if hasattr(updated_task.restriction.period, 'end'):
                    due_date = updated_task.restriction.period.end

        assignee_id = None
        if hasattr(updated_task, 'owner') and updated_task.owner:
            owner_ref = updated_task.owner.reference if hasattr(updated_task.owner, 'reference') else ""
            assignee_id = owner_ref.replace("Practitioner/", "") if owner_ref else None

        task_type = "general"
        if hasattr(updated_task, 'code') and updated_task.code:
            if hasattr(updated_task.code, 'coding') and updated_task.code.coding:
                first_coding = updated_task.code.coding[0] if updated_task.code.coding else None
                if first_coding and hasattr(first_coding, 'code'):
                    task_type = first_coding.code

        created_by = ""
        if hasattr(updated_task, 'requester') and updated_task.requester:
            requester_ref = updated_task.requester.reference if hasattr(updated_task.requester, 'reference') else ""
            created_by = requester_ref.replace("Practitioner/", "") if requester_ref else ""

        return TaskResponse(
            id=updated_task.id if hasattr(updated_task, 'id') else task_id,
            patient_id=patient_id_extracted,
            title=updated_task.description if hasattr(updated_task, 'description') else "",
            description=description,
            priority=updated_task.priority if hasattr(updated_task, 'priority') else "medium",
            status=updated_task.status if hasattr(updated_task, 'status') else "pending",
            due_date=due_date,
            assignee=assignee_id,
            task_type=task_type,
            created_at=updated_task.authoredOn.isostring if hasattr(updated_task, 'authoredOn') and updated_task.authoredOn else datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            created_by=created_by
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    """Delete a task (soft delete)."""
    try:
        # Delete task from HAPI FHIR
        delete_resource('Task', task_id)

        return {"message": "Task deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete task: {str(e)}")