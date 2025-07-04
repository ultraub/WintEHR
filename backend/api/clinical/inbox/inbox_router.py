"""Clinical inbox API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from database import get_db_session as get_db
from models.clinical.tasks import InboxItem, ClinicalTask
from models.models import Provider

router = APIRouter(prefix="/clinical/inbox", tags=["clinical-inbox"])


# Pydantic schemas
class InboxItemResponse(BaseModel):
    id: str
    recipient_id: str
    patient_id: Optional[str]
    category: str
    item_type: str
    title: str
    preview: Optional[str]
    priority: str
    status: str
    is_abnormal: bool
    requires_action: bool
    source_id: Optional[str]
    source_type: Optional[str]
    created_at: datetime
    read_at: Optional[datetime]
    acknowledged_at: Optional[datetime]
    
    # Include patient info
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None

    class Config:
        orm_mode = True


class BulkActionRequest(BaseModel):
    action: str  # acknowledge, read, forward
    item_ids: List[str]
    forward_to_id: Optional[str] = None
    forward_note: Optional[str] = None


class InboxStats(BaseModel):
    total: int
    unread: int
    urgent: int
    requires_action: int
    by_category: Dict[str, int]


def get_current_user(db: Session = Depends(get_db)) -> Provider:
    """Mock function to get current user - replace with real auth"""
    provider = db.query(Provider).first()
    if not provider:
        raise HTTPException(status_code=404, detail="No provider found")
    return provider


@router.get("/", response_model=List[InboxItemResponse])
async def get_inbox_items(
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Get inbox items for current user"""
    query = db.query(InboxItem).filter(
        InboxItem.recipient_id == current_user.id
    )
    
    if category:
        query = query.filter(InboxItem.category == category)
    if priority:
        query = query.filter(InboxItem.priority == priority)
    if status:
        query = query.filter(InboxItem.status == status)
    if patient_id:
        query = query.filter(InboxItem.patient_id == patient_id)
    
    # Join with patient to get patient info
    items = query.order_by(
        InboxItem.priority.desc(),
        InboxItem.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    # Enrich with patient info
    result = []
    for item in items:
        item_dict = {
            "id": item.id,
            "recipient_id": item.recipient_id,
            "patient_id": item.patient_id,
            "category": item.category,
            "item_type": item.item_type,
            "title": item.title,
            "preview": item.preview,
            "priority": item.priority,
            "status": item.status,
            "is_abnormal": item.is_abnormal,
            "requires_action": item.requires_action,
            "source_id": item.source_id,
            "source_type": item.source_type,
            "created_at": item.created_at,
            "read_at": item.read_at,
            "acknowledged_at": item.acknowledged_at
        }
        
        if item.patient:
            item_dict["patient_name"] = f"{item.patient.first_name} {item.patient.last_name}"
            item_dict["patient_mrn"] = item.patient.mrn
        
        result.append(InboxItemResponse(**item_dict))
    
    return result


@router.get("/stats", response_model=InboxStats)
async def get_inbox_stats(
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Get inbox statistics for current user"""
    base_query = db.query(InboxItem).filter(
        InboxItem.recipient_id == current_user.id
    )
    
    total = base_query.count()
    unread = base_query.filter(InboxItem.status == "unread").count()
    urgent = base_query.filter(InboxItem.priority == "urgent").count()
    requires_action = base_query.filter(InboxItem.requires_action == True).count()
    
    # Count by category
    categories = db.query(
        InboxItem.category,
        func.count(InboxItem.id)
    ).filter(
        InboxItem.recipient_id == current_user.id
    ).group_by(InboxItem.category).all()
    
    by_category = {cat: count for cat, count in categories}
    
    return InboxStats(
        total=total,
        unread=unread,
        urgent=urgent,
        requires_action=requires_action,
        by_category=by_category
    )


@router.get("/{item_id}", response_model=InboxItemResponse)
async def get_inbox_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Get specific inbox item"""
    item = db.query(InboxItem).filter(
        InboxItem.id == item_id,
        InboxItem.recipient_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    
    # Mark as read if unread
    if item.status == "unread":
        item.status = "read"
        item.read_at = datetime.utcnow()
        db.commit()
        db.refresh(item)
    
    result = InboxItemResponse(
        id=item.id,
        recipient_id=item.recipient_id,
        patient_id=item.patient_id,
        category=item.category,
        item_type=item.item_type,
        title=item.title,
        preview=item.preview,
        priority=item.priority,
        status=item.status,
        is_abnormal=item.is_abnormal,
        requires_action=item.requires_action,
        source_id=item.source_id,
        source_type=item.source_type,
        created_at=item.created_at,
        read_at=item.read_at,
        acknowledged_at=item.acknowledged_at
    )
    
    if item.patient:
        result.patient_name = f"{item.patient.first_name} {item.patient.last_name}"
        result.patient_mrn = item.patient.mrn
    
    return result


@router.post("/bulk-action")
async def bulk_action(
    request: BulkActionRequest,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Perform bulk action on inbox items"""
    # Get items
    items = db.query(InboxItem).filter(
        InboxItem.id.in_(request.item_ids),
        InboxItem.recipient_id == current_user.id
    ).all()
    
    if not items:
        raise HTTPException(status_code=404, detail="No items found")
    
    if request.action == "acknowledge":
        for item in items:
            item.status = "acknowledged"
            item.acknowledged_at = datetime.utcnow()
            item.acknowledged_by_id = current_user.id
    
    elif request.action == "read":
        for item in items:
            if item.status == "unread":
                item.status = "read"
                item.read_at = datetime.utcnow()
    
    elif request.action == "forward":
        if not request.forward_to_id:
            raise HTTPException(status_code=400, detail="Forward recipient required")
        
        # Create new inbox items for forward recipient
        for item in items:
            new_item = InboxItem(
                recipient_id=request.forward_to_id,
                patient_id=item.patient_id,
                category=item.category,
                item_type=item.item_type,
                title=f"FWD: {item.title}",
                preview=item.preview,
                priority=item.priority,
                status="unread",
                is_abnormal=item.is_abnormal,
                requires_action=item.requires_action,
                source_id=item.source_id,
                source_type=item.source_type,
                forwarded_from_id=current_user.id,
                forwarded_at=datetime.utcnow(),
                forward_note=request.forward_note,
                created_at=datetime.utcnow()
            )
            db.add(new_item)
            
            # Mark original as forwarded
            item.status = "forwarded"
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    db.commit()
    
    return {
        "message": f"Performed {request.action} on {len(items)} items",
        "affected_items": len(items)
    }


@router.post("/create-task")
async def create_task_from_inbox(
    item_id: str,
    task_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a task from an inbox item"""
    item = db.query(InboxItem).filter(
        InboxItem.id == item_id,
        InboxItem.recipient_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    
    # Create task
    task = ClinicalTask(
        patient_id=item.patient_id,
        task_type="general",
        title=task_data.get("title", item.title),
        description=task_data.get("description", item.preview),
        priority=task_data.get("priority", item.priority),
        assigned_to_id=task_data.get("assigned_to_id", current_user.id),
        assigned_by_id=current_user.id,
        assigned_at=datetime.utcnow(),
        due_date=task_data.get("due_date"),
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(task)
    
    # Mark inbox item as acknowledged
    item.status = "acknowledged"
    item.acknowledged_at = datetime.utcnow()
    item.acknowledged_by_id = current_user.id
    
    db.commit()
    
    return {
        "message": "Task created successfully",
        "task_id": task.id
    }