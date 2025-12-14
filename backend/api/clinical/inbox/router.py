"""
Clinical Inbox Router

Manages clinical inbox items including:
- Pending tasks
- Notifications
- Lab results requiring review
- Messages
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from uuid import UUID
import uuid
import json
import logging

from database import get_db_session
from services.hapi_fhir_client import HAPIFHIRClient
from pydantic import BaseModel
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clinical/inbox", tags=["Clinical Inbox"])


class InboxItemType(str, Enum):
    TASK = "task"
    NOTIFICATION = "notification"
    LAB_RESULT = "lab_result"
    MESSAGE = "message"
    MEDICATION_REQUEST = "medication_request"
    ORDER_REVIEW = "order_review"


class InboxItemStatus(str, Enum):
    UNREAD = "unread"
    READ = "read"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class InboxItem(BaseModel):
    id: str
    type: InboxItemType
    status: InboxItemStatus
    priority: str = "medium"
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    subject: str
    description: Optional[str] = None
    created_at: datetime
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    source_resource_id: Optional[str] = None
    source_resource_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class BulkActionRequest(BaseModel):
    item_ids: List[str]
    action: str  # "mark_read", "mark_completed", "archive", "assign"
    assignee_id: Optional[str] = None


class CreateTaskRequest(BaseModel):
    patient_id: str
    subject: str
    description: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None


@router.get("/", response_model=List[InboxItem])
async def get_inbox_items(
    status: Optional[InboxItemStatus] = None,
    type: Optional[InboxItemType] = None,
    assigned_to: Optional[str] = None,
    patient_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    Get inbox items with filtering options.
    
    Aggregates items from:
    - FHIR Tasks
    - Notifications
    - Pending lab results
    - Clinical messages
    """
    try:
        inbox_items = []
        hapi_client = HAPIFHIRClient()

        # 1. Get FHIR Tasks
        task_params = {"status": "requested,accepted,in-progress", "_count": str(limit)}
        if patient_id:
            task_params["patient"] = patient_id

        task_bundle = await hapi_client.search("Task", task_params)
        tasks = [entry.get("resource", {}) for entry in task_bundle.get("entry", [])]
        
        for task in tasks:
            # Extract patient info - handle both reference string and object formats
            task_for = task.get("for", {})
            if isinstance(task_for, str):
                patient_ref = task_for
                patient_name = "Unknown Patient"
            else:
                patient_ref = task_for.get("reference", "") if isinstance(task_for, dict) else ""
                patient_name = task_for.get("display", "Unknown Patient") if isinstance(task_for, dict) else "Unknown Patient"
            
            inbox_item = InboxItem(
                id=task.get("id"),
                type=InboxItemType.TASK,
                status=InboxItemStatus.UNREAD if task.get("status") == "requested" else InboxItemStatus.IN_PROGRESS,
                priority=task.get("priority", "medium"),
                patient_id=patient_ref.split("/")[-1] if patient_ref else None,
                patient_name=patient_name,
                subject=task.get("description", "Clinical Task"),
                description=task.get("note", [{}])[0].get("text") if task.get("note") and isinstance(task.get("note"), list) and len(task.get("note")) > 0 else None,
                created_at=datetime.fromisoformat(task.get("authoredOn", datetime.now().isoformat())),
                due_date=datetime.fromisoformat(task.get("restriction", {}).get("period", {}).get("end")) if task.get("restriction", {}).get("period", {}).get("end") else None,
                assigned_to=(task.get("owner", {}).get("reference", "").split("/")[-1] if isinstance(task.get("owner"), dict) and task.get("owner", {}).get("reference") else task.get("owner", "").split("/")[-1] if isinstance(task.get("owner"), str) else None) if task.get("owner") else None,
                source_resource_id=task.get("id"),
                source_resource_type="Task"
            )
            inbox_items.append(inbox_item)
        
        # 2. Get recent abnormal lab results
        if not type or type == InboxItemType.LAB_RESULT:
            # Search for recent observations with abnormal flags
            obs_params = {
                "status": "final",
                "date": f"ge{(datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')}",
                "_count": "50"
            }
            if patient_id:
                obs_params["patient"] = patient_id

            obs_bundle = await hapi_client.search("Observation", obs_params)
            observations = [entry.get("resource", {}) for entry in obs_bundle.get("entry", [])]
            
            for obs in observations:
                # Check if abnormal - safely navigate nested structures
                interpretation_list = obs.get("interpretation", [])
                interpretation = None
                if isinstance(interpretation_list, list) and len(interpretation_list) > 0:
                    first_interp = interpretation_list[0]
                    if isinstance(first_interp, dict):
                        coding_list = first_interp.get("coding", [])
                        if isinstance(coding_list, list) and len(coding_list) > 0:
                            first_coding = coding_list[0]
                            if isinstance(first_coding, dict):
                                interpretation = first_coding.get("code")
                
                if interpretation in ["H", "L", "HH", "LL", "A", "AA"]:
                    # Safely get patient reference
                    subject = obs.get("subject", {})
                    if isinstance(subject, str):
                        patient_ref = subject
                        patient_name = "Unknown Patient"
                    else:
                        patient_ref = subject.get("reference", "") if isinstance(subject, dict) else ""
                        patient_name = subject.get("display", "Unknown Patient") if isinstance(subject, dict) else "Unknown Patient"
                    
                    inbox_item = InboxItem(
                        id=f"lab-{obs.get('id')}",
                        type=InboxItemType.LAB_RESULT,
                        status=InboxItemStatus.UNREAD,
                        priority="high" if interpretation in ["HH", "LL", "AA"] else "medium",
                        patient_id=patient_ref.split("/")[-1] if patient_ref else None,
                        patient_name=patient_name,
                        subject=f"Abnormal Lab Result: {obs.get('code', {}).get('text', 'Unknown Test') if isinstance(obs.get('code'), dict) else 'Unknown Test'}",
                        description=f"Value: {obs.get('valueQuantity', {}).get('value', 'N/A') if isinstance(obs.get('valueQuantity'), dict) else 'N/A'} {obs.get('valueQuantity', {}).get('unit', '') if isinstance(obs.get('valueQuantity'), dict) else ''}",
                        created_at=datetime.fromisoformat(obs.get("issued", datetime.now().isoformat())),
                        source_resource_id=obs.get("id"),
                        source_resource_type="Observation",
                        metadata={"interpretation": interpretation}
                    )
                    inbox_items.append(inbox_item)
        
        # 3. Get pending medication requests
        if not type or type == InboxItemType.MEDICATION_REQUEST:
            med_params = {"status": "draft,active", "intent": "order", "_count": "20"}
            if patient_id:
                med_params["patient"] = patient_id

            med_bundle = await hapi_client.search("MedicationRequest", med_params)
            med_requests = [entry.get("resource", {}) for entry in med_bundle.get("entry", [])]
            
            for med_req in med_requests:
                if med_req.get("status") == "draft":
                    patient_ref = med_req.get("subject", {}).get("reference", "")
                    med_display = med_req.get("medicationCodeableConcept", {}).get("text", "Unknown Medication")
                    
                    inbox_item = InboxItem(
                        id=f"med-{med_req.get('id')}",
                        type=InboxItemType.MEDICATION_REQUEST,
                        status=InboxItemStatus.UNREAD,
                        priority=med_req.get("priority", "medium"),
                        patient_id=patient_ref.split("/")[-1] if patient_ref else None,
                        patient_name=med_req.get("subject", {}).get("display", "Unknown Patient"),
                        subject=f"Medication Request Review: {med_display}",
                        description="Pending approval",
                        created_at=datetime.fromisoformat(med_req.get("authoredOn", datetime.now().isoformat())),
                        source_resource_id=med_req.get("id"),
                        source_resource_type="MedicationRequest"
                    )
                    inbox_items.append(inbox_item)
        
        # Apply filters
        if status:
            inbox_items = [item for item in inbox_items if item.status == status]
        if type:
            inbox_items = [item for item in inbox_items if item.type == type]
        if assigned_to:
            inbox_items = [item for item in inbox_items if item.assigned_to == assigned_to]
        
        # Sort by priority and created date
        priority_order = {"high": 0, "medium": 1, "low": 2}
        inbox_items.sort(key=lambda x: (priority_order.get(x.priority, 1), x.created_at), reverse=True)
        
        # Apply pagination
        return inbox_items[offset:offset + limit]
        
    except Exception as e:
        logger.error(f"Error getting inbox items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_inbox_stats(
    assigned_to: Optional[str] = None
):
    """Get inbox statistics including counts by type and status."""
    try:
        # Get all items (simplified version)
        all_items = await get_inbox_items(
            assigned_to=assigned_to,
            limit=200
        )
        
        # Calculate statistics
        stats = {
            "total": len(all_items),
            "by_status": {},
            "by_type": {},
            "by_priority": {}
        }
        
        for item in all_items:
            # By status
            stats["by_status"][item.status] = stats["by_status"].get(item.status, 0) + 1
            # By type
            stats["by_type"][item.type] = stats["by_type"].get(item.type, 0) + 1
            # By priority
            stats["by_priority"][item.priority] = stats["by_priority"].get(item.priority, 0) + 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting inbox stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{item_id}")
async def get_inbox_item(
    item_id: str
):
    """Get a specific inbox item by ID."""
    try:
        hapi_client = HAPIFHIRClient()

        # Try to parse the item ID to determine type
        if item_id.startswith("lab-"):
            # Lab result
            obs_id = item_id.replace("lab-", "")
            obs = await hapi_client.read("Observation", obs_id)
            if not obs:
                raise HTTPException(status_code=404, detail="Lab result not found")
            
            # Convert to inbox item
            interpretation = obs.get("interpretation", [{}])[0].get("coding", [{}])[0].get("code")
            patient_ref = obs.get("subject", {}).get("reference", "")
            
            return InboxItem(
                id=item_id,
                type=InboxItemType.LAB_RESULT,
                status=InboxItemStatus.UNREAD,
                priority="high" if interpretation in ["HH", "LL", "AA"] else "medium",
                patient_id=patient_ref.split("/")[-1] if patient_ref else None,
                patient_name=obs.get("subject", {}).get("display", "Unknown Patient"),
                subject=f"Abnormal Lab Result: {obs.get('code', {}).get('text', 'Unknown Test')}",
                description=f"Value: {obs.get('valueQuantity', {}).get('value')} {obs.get('valueQuantity', {}).get('unit', '')}",
                created_at=datetime.fromisoformat(obs.get("issued", datetime.now().isoformat())),
                source_resource_id=obs.get("id"),
                source_resource_type="Observation",
                metadata={"interpretation": interpretation, "full_resource": obs}
            )
            
        elif item_id.startswith("med-"):
            # Medication request
            med_id = item_id.replace("med-", "")
            med_req = await hapi_client.read("MedicationRequest", med_id)
            if not med_req:
                raise HTTPException(status_code=404, detail="Medication request not found")
            
            patient_ref = med_req.get("subject", {}).get("reference", "")
            med_display = med_req.get("medicationCodeableConcept", {}).get("text", "Unknown Medication")
            
            return InboxItem(
                id=item_id,
                type=InboxItemType.MEDICATION_REQUEST,
                status=InboxItemStatus.UNREAD,
                priority=med_req.get("priority", "medium"),
                patient_id=patient_ref.split("/")[-1] if patient_ref else None,
                patient_name=med_req.get("subject", {}).get("display", "Unknown Patient"),
                subject=f"Medication Request Review: {med_display}",
                description="Pending approval",
                created_at=datetime.fromisoformat(med_req.get("authoredOn", datetime.now().isoformat())),
                source_resource_id=med_req.get("id"),
                source_resource_type="MedicationRequest",
                metadata={"full_resource": med_req}
            )
            
        else:
            # Assume it's a task
            task = await hapi_client.read("Task", item_id)
            if not task:
                raise HTTPException(status_code=404, detail="Inbox item not found")
            
            patient_ref = task.get("for", {}).get("reference", "")
            patient_name = task.get("for", {}).get("display", "Unknown Patient")
            
            return InboxItem(
                id=task.get("id"),
                type=InboxItemType.TASK,
                status=InboxItemStatus.UNREAD if task.get("status") == "requested" else InboxItemStatus.IN_PROGRESS,
                priority=task.get("priority", "medium"),
                patient_id=patient_ref.split("/")[-1] if patient_ref else None,
                patient_name=patient_name,
                subject=task.get("description", "Clinical Task"),
                description=task.get("note", [{}])[0].get("text") if task.get("note") and isinstance(task.get("note"), list) and len(task.get("note")) > 0 else None,
                created_at=datetime.fromisoformat(task.get("authoredOn", datetime.now().isoformat())),
                due_date=datetime.fromisoformat(task.get("restriction", {}).get("period", {}).get("end")) if task.get("restriction", {}).get("period", {}).get("end") else None,
                assigned_to=(task.get("owner", {}).get("reference", "").split("/")[-1] if isinstance(task.get("owner"), dict) and task.get("owner", {}).get("reference") else task.get("owner", "").split("/")[-1] if isinstance(task.get("owner"), str) else None) if task.get("owner") else None,
                source_resource_id=task.get("id"),
                source_resource_type="Task",
                metadata={"full_resource": task}
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting inbox item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-action")
async def perform_bulk_action(
    request: BulkActionRequest
):
    """Perform bulk actions on multiple inbox items."""
    try:
        results = []
        hapi_client = HAPIFHIRClient()

        for item_id in request.item_ids:
            try:
                if request.action == "mark_read":
                    # For simplicity, we'll just return success
                    # In a real system, this would update the item status
                    results.append({"id": item_id, "success": True})

                elif request.action == "mark_completed":
                    if not item_id.startswith("lab-") and not item_id.startswith("med-"):
                        # Update task status
                        task = await hapi_client.read("Task", item_id)
                        if task:
                            task["status"] = "completed"
                            await hapi_client.update("Task", item_id, task)
                    results.append({"id": item_id, "success": True})

                elif request.action == "archive":
                    # In a real system, this would move to an archive
                    results.append({"id": item_id, "success": True})

                elif request.action == "assign" and request.assignee_id:
                    if not item_id.startswith("lab-") and not item_id.startswith("med-"):
                        # Update task owner
                        task = await hapi_client.read("Task", item_id)
                        if task:
                            task["owner"] = {"reference": f"Practitioner/{request.assignee_id}"}
                            await hapi_client.update("Task", item_id, task)
                    results.append({"id": item_id, "success": True})

                else:
                    results.append({"id": item_id, "success": False, "error": "Invalid action"})

            except Exception as e:
                results.append({"id": item_id, "success": False, "error": str(e)})

        return {"results": results}
        
    except Exception as e:
        logger.error(f"Error performing bulk action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-task")
async def create_task_from_inbox(
    request: CreateTaskRequest
):
    """Create a new task from inbox."""
    try:
        # Create FHIR Task
        task = {
            "resourceType": "Task",
            "status": "requested",
            "intent": "order",
            "priority": request.priority,
            "description": request.subject,
            "for": {
                "reference": f"Patient/{request.patient_id}"
            },
            "authoredOn": datetime.now(timezone.utc).isoformat(),
            "lastModified": datetime.now(timezone.utc).isoformat()
        }

        if request.description:
            task["note"] = [{"text": request.description}]

        if request.due_date:
            task["restriction"] = {
                "period": {
                    "end": request.due_date.isoformat()
                }
            }

        if request.assigned_to:
            task["owner"] = {
                "reference": f"Practitioner/{request.assigned_to}"
            }

        # Create the task using async client
        hapi_client = HAPIFHIRClient()
        created_task = await hapi_client.create("Task", task)

        return {
            "success": True,
            "task_id": created_task.get("id"),
            "message": "Task created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))