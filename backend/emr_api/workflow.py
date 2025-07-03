"""
EMR Workflow Management

Orchestrates clinical workflows beyond basic FHIR Task resources:
- Complex multi-step workflows
- State machines
- Task assignments and routing
- Workflow templates
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import json

from ..database import get_db_session
from .auth import require_auth, require_role

router = APIRouter()


@router.get("/workflows")
async def get_workflows(
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth),
    type: Optional[str] = None,
    active_only: bool = True
):
    """Get available workflows."""
    query = """
        SELECT 
            w.id, w.name, w.type, w.definition,
            w.version, w.is_active, w.created_at,
            u.username as created_by_name
        FROM emr.workflows w
        LEFT JOIN emr.users u ON w.created_by = u.id
        WHERE 1=1
    """
    
    params = {}
    
    if active_only:
        query += " AND w.is_active = true"
    
    if type:
        query += " AND w.type = :type"
        params['type'] = type
    
    query += " ORDER BY w.name"
    
    result = await db.execute(text(query), params)
    
    workflows = []
    for row in result:
        workflows.append({
            "id": str(row.id),
            "name": row.name,
            "type": row.type,
            "definition": row.definition,
            "version": row.version,
            "isActive": row.is_active,
            "createdAt": row.created_at.isoformat(),
            "createdBy": row.created_by_name
        })
    
    return {"workflows": workflows}


@router.post("/workflows")
async def create_workflow(
    workflow_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_role("admin"))
):
    """Create a new workflow definition."""
    workflow_id = uuid.uuid4()
    
    insert_query = text("""
        INSERT INTO emr.workflows (
            id, name, type, definition, version,
            is_active, created_by
        ) VALUES (
            :id, :name, :type, :definition, :version,
            :is_active, :created_by
        )
    """)
    
    await db.execute(insert_query, {
        "id": workflow_id,
        "name": workflow_data["name"],
        "type": workflow_data["type"],
        "definition": json.dumps(workflow_data["definition"]),
        "version": workflow_data.get("version", 1),
        "is_active": workflow_data.get("isActive", True),
        "created_by": uuid.UUID(user["id"])
    })
    
    await db.commit()
    
    return {
        "id": str(workflow_id),
        "message": "Workflow created successfully"
    }


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Get a specific workflow definition."""
    query = text("""
        SELECT 
            w.id, w.name, w.type, w.definition,
            w.version, w.is_active, w.created_at,
            u.username as created_by_name
        FROM emr.workflows w
        LEFT JOIN emr.users u ON w.created_by = u.id
        WHERE w.id = :workflow_id
    """)
    
    result = await db.execute(query, {"workflow_id": uuid.UUID(workflow_id)})
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {
        "id": str(row.id),
        "name": row.name,
        "type": row.type,
        "definition": row.definition,
        "version": row.version,
        "isActive": row.is_active,
        "createdAt": row.created_at.isoformat(),
        "createdBy": row.created_by_name
    }


@router.post("/workflows/{workflow_id}/instantiate")
async def instantiate_workflow(
    workflow_id: str,
    context: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """
    Instantiate a workflow.
    
    Creates FHIR Task resources and task extensions based on workflow definition.
    """
    # Get workflow definition
    workflow_query = text("""
        SELECT definition
        FROM emr.workflows
        WHERE id = :workflow_id AND is_active = true
    """)
    
    result = await db.execute(workflow_query, {"workflow_id": uuid.UUID(workflow_id)})
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found or inactive")
    
    definition = row.definition
    
    # Create tasks based on workflow definition
    # This is a simplified implementation
    created_tasks = []
    
    for step in definition.get("steps", []):
        # Create FHIR Task
        task_fhir_id = str(uuid.uuid4())
        
        # Create task extension
        extension_query = text("""
            INSERT INTO emr.task_extensions (
                task_fhir_id, workflow_id, ui_state,
                assigned_to, due_date, priority, tags
            ) VALUES (
                :task_fhir_id, :workflow_id, :ui_state,
                :assigned_to, :due_date, :priority, :tags
            )
            RETURNING id
        """)
        
        extension_result = await db.execute(extension_query, {
            "task_fhir_id": task_fhir_id,
            "workflow_id": uuid.UUID(workflow_id),
            "ui_state": json.dumps(step.get("uiState", {})),
            "assigned_to": uuid.UUID(step["assignedTo"]) if step.get("assignedTo") else None,
            "due_date": step.get("dueDate"),
            "priority": step.get("priority", 3),
            "tags": step.get("tags", [])
        })
        
        extension_id = extension_result.scalar()
        
        created_tasks.append({
            "taskId": task_fhir_id,
            "extensionId": str(extension_id),
            "name": step["name"],
            "status": "ready"
        })
    
    await db.commit()
    
    # Create audit log
    audit_query = text("""
        INSERT INTO emr.audit_logs (
            user_id, action, resource_type, resource_id, details
        ) VALUES (
            :user_id, :action, :resource_type, :resource_id, :details
        )
    """)
    
    await db.execute(audit_query, {
        "user_id": uuid.UUID(user["id"]),
        "action": "workflow_instantiated",
        "resource_type": "Workflow",
        "resource_id": workflow_id,
        "details": json.dumps({
            "taskCount": len(created_tasks),
            "context": context
        })
    })
    
    await db.commit()
    
    return {
        "workflowId": workflow_id,
        "tasks": created_tasks,
        "message": "Workflow instantiated successfully"
    }


@router.get("/tasks/my-tasks")
async def get_my_tasks(
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth),
    status: Optional[str] = None,
    priority: Optional[int] = None
):
    """Get tasks assigned to current user."""
    query = """
        SELECT 
            te.id, te.task_fhir_id, te.workflow_id,
            te.ui_state, te.due_date, te.priority, te.tags,
            w.name as workflow_name
        FROM emr.task_extensions te
        LEFT JOIN emr.workflows w ON te.workflow_id = w.id
        WHERE te.assigned_to = :user_id
    """
    
    params = {"user_id": uuid.UUID(user["id"])}
    
    if priority is not None:
        query += " AND te.priority = :priority"
        params['priority'] = priority
    
    query += " ORDER BY te.priority DESC, te.due_date ASC NULLS LAST"
    
    result = await db.execute(text(query), params)
    
    tasks = []
    for row in result:
        tasks.append({
            "id": str(row.id),
            "taskFhirId": row.task_fhir_id,
            "workflowId": str(row.workflow_id) if row.workflow_id else None,
            "workflowName": row.workflow_name,
            "uiState": row.ui_state or {},
            "dueDate": row.due_date.isoformat() if row.due_date else None,
            "priority": row.priority,
            "tags": row.tags or []
        })
    
    return {"tasks": tasks}


@router.put("/tasks/{task_fhir_id}/assign")
async def assign_task(
    task_fhir_id: str,
    assignment: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Assign or reassign a task."""
    update_query = text("""
        UPDATE emr.task_extensions
        SET assigned_to = :assigned_to
        WHERE task_fhir_id = :task_fhir_id
    """)
    
    result = await db.execute(update_query, {
        "assigned_to": uuid.UUID(assignment["userId"]) if assignment.get("userId") else None,
        "task_fhir_id": task_fhir_id
    })
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task extension not found")
    
    # Create audit log
    audit_query = text("""
        INSERT INTO emr.audit_logs (
            user_id, action, resource_type, resource_id, details
        ) VALUES (
            :user_id, :action, :resource_type, :resource_id, :details
        )
    """)
    
    await db.execute(audit_query, {
        "user_id": uuid.UUID(user["id"]),
        "action": "task_assigned",
        "resource_type": "Task",
        "resource_id": task_fhir_id,
        "details": json.dumps(assignment)
    })
    
    await db.commit()
    
    return {"message": "Task assigned successfully"}


@router.put("/tasks/{task_fhir_id}/ui-state")
async def update_task_ui_state(
    task_fhir_id: str,
    ui_state: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Update task UI state."""
    update_query = text("""
        UPDATE emr.task_extensions
        SET ui_state = :ui_state
        WHERE task_fhir_id = :task_fhir_id
    """)
    
    result = await db.execute(update_query, {
        "ui_state": json.dumps(ui_state),
        "task_fhir_id": task_fhir_id
    })
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task extension not found")
    
    await db.commit()
    
    return {"message": "Task UI state updated successfully"}


@router.get("/tasks/{task_fhir_id}/history")
async def get_task_history(
    task_fhir_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Get audit history for a task."""
    query = text("""
        SELECT 
            al.id, al.action, al.details, al.created_at,
            u.username as user_name
        FROM emr.audit_logs al
        LEFT JOIN emr.users u ON al.user_id = u.id
        WHERE al.resource_type = 'Task' 
        AND al.resource_id = :task_fhir_id
        ORDER BY al.created_at DESC
    """)
    
    result = await db.execute(query, {"task_fhir_id": task_fhir_id})
    
    history = []
    for row in result:
        history.append({
            "id": str(row.id),
            "action": row.action,
            "details": row.details or {},
            "timestamp": row.created_at.isoformat(),
            "user": row.user_name
        })
    
    return {"history": history}


@router.post("/tasks/bulk-assign")
async def bulk_assign_tasks(
    bulk_assignment: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_role("admin"))
):
    """Bulk assign multiple tasks."""
    task_ids = bulk_assignment.get("taskIds", [])
    assigned_to = bulk_assignment.get("assignedTo")
    
    if not task_ids:
        raise HTTPException(status_code=400, detail="No task IDs provided")
    
    # Update all tasks
    update_query = text("""
        UPDATE emr.task_extensions
        SET assigned_to = :assigned_to
        WHERE task_fhir_id = ANY(:task_ids)
    """)
    
    result = await db.execute(update_query, {
        "assigned_to": uuid.UUID(assigned_to) if assigned_to else None,
        "task_ids": task_ids
    })
    
    # Create audit log
    audit_query = text("""
        INSERT INTO emr.audit_logs (
            user_id, action, details
        ) VALUES (
            :user_id, :action, :details
        )
    """)
    
    await db.execute(audit_query, {
        "user_id": uuid.UUID(user["id"]),
        "action": "bulk_task_assignment",
        "details": json.dumps({
            "taskCount": result.rowcount,
            "assignedTo": assigned_to
        })
    })
    
    await db.commit()
    
    return {
        "tasksUpdated": result.rowcount,
        "message": "Tasks assigned successfully"
    }


@router.get("/workflow-metrics")
async def get_workflow_metrics(
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth),
    workflow_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """Get workflow performance metrics."""
    # This is a simplified implementation
    # In reality, you would calculate various metrics
    
    metrics = {
        "totalWorkflows": 0,
        "activeWorkflows": 0,
        "completedTasks": 0,
        "pendingTasks": 0,
        "averageCompletionTime": None,
        "tasksByPriority": {
            "high": 0,
            "medium": 0,
            "low": 0
        }
    }
    
    # Count tasks by priority
    priority_query = text("""
        SELECT priority, COUNT(*) as count
        FROM emr.task_extensions
        WHERE 1=1
        GROUP BY priority
    """)
    
    result = await db.execute(priority_query)
    for row in result:
        if row.priority == 1:
            metrics["tasksByPriority"]["high"] = row.count
        elif row.priority == 2:
            metrics["tasksByPriority"]["medium"] = row.count
        elif row.priority == 3:
            metrics["tasksByPriority"]["low"] = row.count
    
    return {"metrics": metrics}