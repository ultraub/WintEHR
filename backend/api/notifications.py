"""
Notification API endpoints using FHIR Communication resources
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from database import get_db_session as get_db
from services.fhir_client_config import search_resources, get_resource, update_resource, create_resource
from fhir.core.resources_r4b import Communication, Reference, Extension
from pydantic import BaseModel
import logging



router = APIRouter()


class NotificationResponse(BaseModel):
    count: int
    notifications: List[dict] = []


class NotificationCountResponse(BaseModel):
    count: int


@router.get("/notifications/count", response_model=NotificationCountResponse)
async def get_notification_count(
    db: Session = Depends(get_db),
    # current_user would come from auth dependency
    current_user_id: str = "demo-user"  # For now, hardcoded
):
    """Get count of unread notifications for the current user"""

    # Search for Communication resources where:
    # 1. Recipient is the current user (Practitioner)
    # 2. Status is not 'completed' (unread)
    # 3. Has extension marking it as unread

    search_params = {
        'recipient': f'Practitioner/{current_user_id}',
        'status:not': 'completed',
        '_sort': '-sent',
        '_count': 1000  # Fetch all to count properly
    }

    response = search_resources('Communication', search_params)

    # Filter for unread notifications
    unread_count = 0
    all_resources = response.get('entry', []) if isinstance(response, dict) else []

    if all_resources:

        for entry in all_resources:
            resource = entry.get('resource', entry)
            comm = Communication.parse_obj(resource)
            
            # Check if marked as read
            is_read = False
            if comm.extension:
                for ext in comm.extension:
                    if ext.url == "http://wintehr.com/fhir/StructureDefinition/notification-read":
                        is_read = ext.valueBoolean or False
                        break
            
            if not is_read:
                unread_count += 1
    
    return NotificationCountResponse(count=unread_count)


@router.get("/notifications", response_model=NotificationResponse)
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user_id: str = "demo-user"
):
    """Get notifications for the current user"""

    # Search for Communication resources for the current user
    search_params = {
        'recipient': f'Practitioner/{current_user_id}',
        '_sort': '-sent',
        '_count': limit
    }

    response = search_resources('Communication', search_params)

    notifications = []
    entries = response.get('entry', []) if isinstance(response, dict) else []

    for entry in entries:
        resource = entry.get('resource', entry)
        comm = Communication.parse_obj(resource)
        
        # Check if marked as read
        is_read = False
        if comm.extension:
            for ext in comm.extension:
                if ext.url == "http://wintehr.com/fhir/StructureDefinition/notification-read":
                    is_read = ext.valueBoolean or False
                    break
        
        # Filter if unread_only is requested
        if unread_only and is_read:
            continue
        
        # Convert to dict for response
        notif_dict = comm.dict(exclude_none=True)
        notif_dict['id'] = resource.get('id', '')
        notif_dict['_isRead'] = is_read  # Add convenience field
        
        notifications.append(notif_dict)
    
    # Count unread
    unread_count = sum(1 for n in notifications if not n.get('_isRead', False))
    
    return NotificationResponse(
        count=unread_count,
        notifications=notifications
    )


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user_id: str = "demo-user"
):
    """Mark a notification as read"""

    # Get the notification
    try:
        resource = get_resource('Communication', notification_id)
        comm = Communication.parse_obj(resource)
        
        # Verify this notification is for the current user
        is_recipient = False
        if comm.recipient:
            for recipient in comm.recipient:
                if recipient.reference == f'Practitioner/{current_user_id}':
                    is_recipient = True
                    break
        
        if not is_recipient:
            raise HTTPException(status_code=403, detail="Not authorized to modify this notification")
        
        # Update or add the read extension
        read_ext_found = False
        if not comm.extension:
            comm.extension = []
        
        for ext in comm.extension:
            if ext.url == "http://wintehr.com/fhir/StructureDefinition/notification-read":
                ext.valueBoolean = True
                read_ext_found = True
                break
        
        if not read_ext_found:
            comm.extension.append(Extension(
                url="http://wintehr.com/fhir/StructureDefinition/notification-read",
                valueBoolean=True
            ))
        
        # Also update status to completed if it was in-progress
        if comm.status == "in-progress":
            comm.status = "completed"
        
        # Save the updated resource via HAPI FHIR
        update_resource(
            'Communication',
            notification_id,
            comm.dict(exclude_none=True)
        )
        
        return {"success": True, "message": "Notification marked as read"}
        
    except Exception as e:
        raise HTTPException(status_code=404, detail="Notification not found")


@router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user_id: str = "demo-user"
):
    """Mark all notifications as read for the current user"""

    # Get all unread notifications
    search_params = {
        'recipient': f'Practitioner/{current_user_id}',
        'status:not': 'completed',
        '_count': 1000  # Process in batches if needed
    }

    response = search_resources('Communication', search_params)

    updated_count = 0
    entries = response.get('entry', []) if isinstance(response, dict) else []

    for entry in entries:
        try:
            resource = entry.get('resource', entry)
            comm = Communication.parse_obj(resource)
            
            # Check if already read
            is_read = False
            if comm.extension:
                for ext in comm.extension:
                    if ext.url == "http://wintehr.com/fhir/StructureDefinition/notification-read":
                        is_read = ext.valueBoolean or False
                        break
            
            if not is_read:
                # Mark as read
                if not comm.extension:
                    comm.extension = []
                
                read_ext_found = False
                for ext in comm.extension:
                    if ext.url == "http://wintehr.com/fhir/StructureDefinition/notification-read":
                        ext.valueBoolean = True
                        read_ext_found = True
                        break
                
                if not read_ext_found:
                    comm.extension.append(Extension(
                        url="http://wintehr.com/fhir/StructureDefinition/notification-read",
                        valueBoolean=True
                    ))
                
                # Update status
                if comm.status == "in-progress":
                    comm.status = "completed"
                
                # Save via HAPI FHIR
                update_resource(
                    'Communication',
                    resource.get('id'),
                    comm.dict(exclude_none=True)
                )
                
                updated_count += 1
                
        except Exception as e:
            logging.error(f"Error updating notification {resource.get('id')}: {e}")
            continue
    
    return {
        "success": True,
        "message": f"Marked {updated_count} notifications as read"
    }


@router.post("/notifications")
async def create_notification(
    notification_data: dict,
    db: Session = Depends(get_db),
    current_user_id: str = "demo-user"
):
    """Create a new notification (Communication resource)"""
    
    # Build Communication resource
    comm_data = {
        "resourceType": "Communication",
        "status": "in-progress",
        "priority": notification_data.get("priority", "routine"),
        "subject": notification_data.get("subject"),  # Patient reference
        "recipient": notification_data.get("recipient", []),  # List of practitioner references
        "sender": {"reference": f"Practitioner/{current_user_id}"},
        "sent": datetime.utcnow().isoformat() + "Z",
        "payload": [
            {
                "contentString": notification_data.get("message", "")
            }
        ],
        "extension": [
            {
                "url": "http://wintehr.com/fhir/StructureDefinition/notification-read",
                "valueBoolean": False
            }
        ]
    }
    
    # Add category if provided
    if notification_data.get("category"):
        comm_data["category"] = [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/communication-category",
                        "code": notification_data["category"],
                        "display": notification_data["category"].title()
                    }
                ]
            }
        ]
    
    # Validate and create
    try:
        comm = Communication.parse_obj(comm_data)
        result = create_resource(comm.dict(exclude_none=True))

        # TODO: Send WebSocket notification to recipients

        return {
            "success": True,
            "id": result.get('id'),
            "message": "Notification created successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))