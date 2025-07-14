"""FHIR Communication-based notification system."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from typing import List, Optional, Dict, Any
from datetime import datetime
from database import get_db_session as get_db
from emr_api.auth import get_current_user
import uuid
import json

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# FHIR Communication resource schema
def create_communication_resource(
    sender_id: str,
    recipient_id: str,
    subject: str,
    message: str,
    priority: str = "routine",
    category: str = "notification",
    sender_type: str = "Practitioner",
    recipient_type: str = "Practitioner",
    patient_id: Optional[str] = None
) -> Dict[str, Any]:
    """Create a FHIR Communication resource."""
    communication_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    
    communication = {
        "resourceType": "Communication",
        "id": communication_id,
        "meta": {
            "lastUpdated": now
        },
        "status": "completed",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/communication-category",
                "code": category,
                "display": category.title()
            }]
        }],
        "priority": priority,
        "subject": {
            "reference": f"Patient/{patient_id}",
            "display": "Patient"
        } if patient_id else None,
        "sent": now,
        "received": None,  # Will be updated when marked as read
        "recipient": [{
            "reference": f"{recipient_type}/{recipient_id}",
            "display": "Recipient"
        }],
        "sender": {
            "reference": f"{sender_type}/{sender_id}",
            "display": "Sender"
        },
        "payload": [{
            "contentString": message
        }],
        "note": [{
            "text": subject
        }],
        "extension": [{
            "url": "http://wintehr.com/fhir/StructureDefinition/notification-read",
            "valueBoolean": False
        }]
    }
    
    # Remove None values
    communication = {k: v for k, v in communication.items() if v is not None}
    
    return communication

@router.get("/count")
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get count of unread notifications for the current user."""
    try:
        # Query the fhir.resources table for Communication resources
        query = text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Communication'
            AND data->'recipient' @> :recipient_ref
            AND data->'extension' @> :unread_extension
            AND (data->>'status' = 'completed' OR data->>'status' = 'in-progress')
        """)
        
        # Build the recipient reference
        recipient_ref = json.dumps([{
            "reference": f"Practitioner/{current_user['id']}"
        }])
        
        # Extension for unread status
        unread_extension = json.dumps([{
            "url": "http://wintehr.com/fhir/StructureDefinition/notification-read",
            "valueBoolean": False
        }])
        
        result = db.execute(query, {"recipient_ref": recipient_ref, "unread_extension": unread_extension})
        count = result.fetchone()[0] if result else 0
        
        return {"count": count}
    except Exception as e:
        # If the FHIR table doesn't exist yet, return 0
        return {"count": 0}

@router.get("/")
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _count: int = Query(20, le=100),
    _offset: int = Query(0),
    unread_only: bool = Query(False)
):
    """Get notifications for the current user."""
    try:
        # Base query for Communication resources
        base_query = text("""
            SELECT id, data, created_at, updated_at
            FROM fhir.resources
            WHERE resource_type = 'Communication'
            AND data->'recipient' @> :recipient_ref
        """)
        
        params = [json.dumps([{"reference": f"Practitioner/{current_user['id']}"}])]
        
        query_params = {"recipient_ref": params[0]}
        
        if unread_only:
            base_query = text(str(base_query) + " AND data->'extension' @> :unread_extension")
            query_params["unread_extension"] = json.dumps([{
                "url": "http://wintehr.com/fhir/StructureDefinition/notification-read",
                "valueBoolean": False
            }])
        
        # Add ordering and pagination
        base_query = text(str(base_query) + " ORDER BY created_at DESC LIMIT :limit OFFSET :offset")
        query_params["limit"] = _count
        query_params["offset"] = _offset
        
        result = db.execute(base_query, query_params)
        notifications = []
        
        for row in result:
            notification = row['data']
            notification['_id'] = str(row['id'])
            notification['_created'] = row['created_at'].isoformat() + "Z"
            notifications.append(notification)
        
        # Get total count
        count_query = text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Communication'
            AND data->'recipient' @> :recipient_ref
        """)
        count_params = {"recipient_ref": json.dumps([{"reference": f"Practitioner/{current_user['id']}"}])}
        
        if unread_only:
            count_query = text(str(count_query) + " AND data->'extension' @> :unread_extension")
            count_params["unread_extension"] = json.dumps([{
                "url": "http://wintehr.com/fhir/StructureDefinition/notification-read",
                "valueBoolean": False
            }])
        
        count_result = db.execute(count_query, count_params)
        total_count = count_result.fetchone()[0] if count_result else 0
        
        return {
            "total": total_count,
            "notifications": notifications,
            "offset": _offset,
            "count": len(notifications)
        }
    except Exception as e:
        # If the FHIR table doesn't exist yet, return empty list
        return {
            "total": 0,
            "notifications": [],
            "offset": _offset,
            "count": 0
        }

@router.post("/")
async def create_notification(
    notification_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new notification (Communication resource)."""
    try:
        # Create the Communication resource
        communication = create_communication_resource(
            sender_id=current_user['id'],
            recipient_id=notification_data['recipient_id'],
            subject=notification_data['subject'],
            message=notification_data['message'],
            priority=notification_data.get('priority', 'routine'),
            category=notification_data.get('category', 'notification'),
            sender_type=notification_data.get('sender_type', 'Practitioner'),
            recipient_type=notification_data.get('recipient_type', 'Practitioner'),
            patient_id=notification_data.get('patient_id')
        )
        
        # Insert into fhir.resources table
        insert_query = text("""
            INSERT INTO fhir.resources (id, resource_type, data, created_at, updated_at)
            VALUES (:id, :resource_type, :data, :created_at, :updated_at)
            RETURNING id
        """)
        
        resource_id = uuid.UUID(communication['id'])
        now = datetime.utcnow()
        
        result = db.execute(
            insert_query,
            {
                "id": resource_id,
                "resource_type": 'Communication',
                "data": json.dumps(communication),
                "created_at": now,
                "updated_at": now
            }
        )
        db.commit()
        
        # Broadcast via WebSocket
        from api.websocket.fhir_notifications import notification_service
        import asyncio
        
        # Create async task for notification
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            notification_service.notify_resource_created(
                resource_type="Communication",
                resource_id=str(resource_id),
                resource_data=communication,
                patient_id=notification_data.get('patient_id')
            )
        )
        
        return communication
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark a notification as read."""
    try:
        # Get the Communication resource
        query = text("""
            SELECT data
            FROM fhir.resources
            WHERE id = :id
            AND resource_type = 'Communication'
            AND data->'recipient' @> :recipient_ref
        """)
        
        result = db.execute(
            query,
            {
                "id": uuid.UUID(notification_id),
                "recipient_ref": json.dumps([{"reference": f"Practitioner/{current_user['id']}"}])
            }
        )
        
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        communication = row['data']
        
        # Update the read status
        for ext in communication.get('extension', []):
            if ext.get('url') == 'http://wintehr.com/fhir/StructureDefinition/notification-read':
                ext['valueBoolean'] = True
                break
        
        # Update received timestamp
        communication['received'] = datetime.utcnow().isoformat() + "Z"
        
        # Update in database
        update_query = text("""
            UPDATE fhir.resources
            SET data = :data, updated_at = :updated_at
            WHERE id = :id
        """)
        
        db.execute(
            update_query,
            {
                "data": json.dumps(communication),
                "updated_at": datetime.utcnow(),
                "id": uuid.UUID(notification_id)
            }
        )
        db.commit()
        
        # Broadcast update via WebSocket
        from api.websocket.fhir_notifications import notification_service
        import asyncio
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            notification_service.notify_resource_updated(
                resource_type="Communication",
                resource_id=notification_id,
                resource_data=communication
            )
        )
        
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/mark-all-read")
async def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark all notifications as read for the current user."""
    try:
        # Update all unread notifications
        update_query = text("""
            UPDATE fhir.resources
            SET 
                data = jsonb_set(
                    jsonb_set(
                        data,
                        '{extension,0,valueBoolean}',
                        'true'::jsonb
                    ),
                    '{received}',
                    to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                ),
                updated_at = now()
            WHERE resource_type = 'Communication'
            AND data->'recipient' @> :recipient_ref
            AND data->'extension' @> :unread_extension
        """)
        
        recipient_ref = json.dumps([{"reference": f"Practitioner/{current_user['id']}"}])
        unread_extension = json.dumps([{
            "url": "http://wintehr.com/fhir/StructureDefinition/notification-read",
            "valueBoolean": False
        }])
        
        result = db.execute(update_query, {"recipient_ref": recipient_ref, "unread_extension": unread_extension})
        count = result.rowcount
        db.commit()
        
        return {"success": True, "count": count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Helper function to create system notifications
async def create_system_notification(
    db: Session,
    recipient_id: str,
    subject: str,
    message: str,
    priority: str = "routine",
    category: str = "alert",
    patient_id: Optional[str] = None
):
    """Create a system-generated notification."""
    communication = create_communication_resource(
        sender_id="system",
        recipient_id=recipient_id,
        subject=subject,
        message=message,
        priority=priority,
        category=category,
        sender_type="Device",  # System notifications come from Device
        recipient_type="Practitioner",
        patient_id=patient_id
    )
    
    # Insert into database
    insert_query = text("""
        INSERT INTO fhir.resources (id, resource_type, data, created_at, updated_at)
        VALUES (:id, :resource_type, :data, :created_at, :updated_at)
    """)
    
    resource_id = uuid.UUID(communication['id'])
    now = datetime.utcnow()
    
    db.execute(
        insert_query,
        {
            "id": resource_id,
            "resource_type": 'Communication',
            "data": json.dumps(communication),
            "created_at": now,
            "updated_at": now
        }
    )
    db.commit()
    
    # Broadcast via WebSocket
    from api.websocket.fhir_notifications import notification_service
    await notification_service.notify_resource_created(
        resource_type="Communication",
        resource_id=str(resource_id),
        resource_data=communication,
        patient_id=patient_id
    )
    
    return communication