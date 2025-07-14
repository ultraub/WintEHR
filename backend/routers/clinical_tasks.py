"""
Clinical Tasks API endpoints.
Manages clinical tasks and to-dos for healthcare providers.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
import uuid

from database import get_db_session
from auth import get_current_user

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
    task_id = str(uuid.uuid4())
    fhir_task = {
        "resourceType": "Task",
        "id": task_id,
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
    
    # Store in FHIR database
    try:
        await db.execute(
            text("""
                INSERT INTO fhir.resources (resource_type, fhir_id, version_id, last_updated, resource)
                VALUES (:resource_type, :fhir_id, :version_id, :last_updated, :resource)
            """),
            {
                "resource_type": "Task",
                "fhir_id": task_id,
                "version_id": 1,
                "last_updated": datetime.now(timezone.utc),
                "resource": fhir_task
            }
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")
    
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

@router.get("/", response_model=List[TaskResponse])
async def get_tasks(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session)
):
    """Get clinical tasks with optional filters."""
    # Build query
    query = """
        SELECT resource 
        FROM fhir.resources 
        WHERE resource_type = 'Task' 
        AND deleted = false
    """
    
    conditions = []
    if patient_id:
        conditions.append(f"resource->'for'->>'reference' = 'Patient/{patient_id}'")
    if status:
        conditions.append(f"resource->>'status' = '{status}'")
    if priority:
        conditions.append(f"resource->>'priority' = '{priority}'")
    if assignee:
        conditions.append(f"resource->'owner'->>'reference' = 'Practitioner/{assignee}'")
    
    if conditions:
        query += " AND " + " AND ".join(conditions)
    
    query += " ORDER BY last_updated DESC"
    
    try:
        result = await db.execute(text(query))
        tasks = []
        
        for row in result:
            fhir_task = row[0]
            
            # Extract task details
            task = TaskResponse(
                id=fhir_task.get("id"),
                patient_id=fhir_task.get("for", {}).get("reference", "").replace("Patient/", ""),
                title=fhir_task.get("description", ""),
                description=fhir_task.get("note", [{}])[0].get("text") if fhir_task.get("note") else None,
                priority=fhir_task.get("priority", "medium"),
                status=fhir_task.get("status", "pending"),
                due_date=fhir_task.get("restriction", {}).get("period", {}).get("end"),
                assignee=fhir_task.get("owner", {}).get("reference", "").replace("Practitioner/", "") or None,
                task_type=fhir_task.get("code", {}).get("coding", [{}])[0].get("code", "general"),
                created_at=fhir_task.get("authoredOn", datetime.now(timezone.utc).isoformat()),
                updated_at=fhir_task.get("meta", {}).get("lastUpdated", datetime.now(timezone.utc).isoformat()),
                created_by=fhir_task.get("requester", {}).get("reference", "").replace("Practitioner/", "")
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
        result = await db.execute(
            text("""
                SELECT resource 
                FROM fhir.resources 
                WHERE resource_type = 'Task' 
                AND fhir_id = :task_id
                AND deleted = false
            """),
            {"task_id": task_id}
        )
        
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        
        fhir_task = row[0]
        
        return TaskResponse(
            id=fhir_task.get("id"),
            patient_id=fhir_task.get("for", {}).get("reference", "").replace("Patient/", ""),
            title=fhir_task.get("description", ""),
            description=fhir_task.get("note", [{}])[0].get("text") if fhir_task.get("note") else None,
            priority=fhir_task.get("priority", "medium"),
            status=fhir_task.get("status", "pending"),
            due_date=fhir_task.get("restriction", {}).get("period", {}).get("end"),
            assignee=fhir_task.get("owner", {}).get("reference", "").replace("Practitioner/", "") or None,
            task_type=fhir_task.get("code", {}).get("coding", [{}])[0].get("code", "general"),
            created_at=fhir_task.get("authoredOn", datetime.now(timezone.utc).isoformat()),
            updated_at=fhir_task.get("meta", {}).get("lastUpdated", datetime.now(timezone.utc).isoformat()),
            created_by=fhir_task.get("requester", {}).get("reference", "").replace("Practitioner/", "")
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
        # Get existing task
        result = await db.execute(
            text("""
                SELECT resource, version_id
                FROM fhir.resources 
                WHERE resource_type = 'Task' 
                AND fhir_id = :task_id
                AND deleted = false
            """),
            {"task_id": task_id}
        )
        
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        
        fhir_task = row[0]
        current_version = row[1]
        
        # Update fields
        if task_update.title is not None:
            fhir_task["description"] = task_update.title
        
        if task_update.description is not None:
            fhir_task["note"] = [{"text": task_update.description}]
        
        if task_update.priority is not None:
            fhir_task["priority"] = task_update.priority
        
        if task_update.status is not None:
            fhir_task["status"] = task_update.status
        
        if task_update.due_date is not None:
            fhir_task["restriction"] = {
                "period": {
                    "end": task_update.due_date.isoformat()
                }
            }
        
        if task_update.assignee is not None:
            fhir_task["owner"] = {
                "reference": f"Practitioner/{task_update.assignee}"
            }
        
        # Update metadata
        fhir_task["meta"] = {
            "versionId": str(current_version + 1),
            "lastUpdated": datetime.now(timezone.utc).isoformat()
        }
        
        # Update in database
        await db.execute(
            text("""
                UPDATE fhir.resources 
                SET resource = :resource,
                    version_id = :version_id,
                    last_updated = :last_updated
                WHERE resource_type = 'Task' 
                AND fhir_id = :task_id
            """),
            {
                "resource": fhir_task,
                "version_id": current_version + 1,
                "last_updated": datetime.now(timezone.utc),
                "task_id": task_id
            }
        )
        await db.commit()
        
        return TaskResponse(
            id=fhir_task.get("id"),
            patient_id=fhir_task.get("for", {}).get("reference", "").replace("Patient/", ""),
            title=fhir_task.get("description", ""),
            description=fhir_task.get("note", [{}])[0].get("text") if fhir_task.get("note") else None,
            priority=fhir_task.get("priority", "medium"),
            status=fhir_task.get("status", "pending"),
            due_date=fhir_task.get("restriction", {}).get("period", {}).get("end"),
            assignee=fhir_task.get("owner", {}).get("reference", "").replace("Practitioner/", "") or None,
            task_type=fhir_task.get("code", {}).get("coding", [{}])[0].get("code", "general"),
            created_at=fhir_task.get("authoredOn", datetime.now(timezone.utc).isoformat()),
            updated_at=datetime.now(timezone.utc),
            created_by=fhir_task.get("requester", {}).get("reference", "").replace("Practitioner/", "")
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    """Delete a task (soft delete)."""
    try:
        await db.execute(
            text("""
                UPDATE fhir.resources 
                SET deleted = true,
                    last_updated = :last_updated
                WHERE resource_type = 'Task' 
                AND fhir_id = :task_id
            """),
            {
                "last_updated": datetime.now(timezone.utc),
                "task_id": task_id
            }
        )
        await db.commit()
        
        return {"message": "Task deleted successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete task: {str(e)}")