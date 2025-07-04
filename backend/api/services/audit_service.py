"""
FHIR Audit Service
Handles creation and management of FHIR AuditEvent resources
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json
import uuid
from fastapi import Request

from api.fhir.converters.audit_event import audit_log_to_fhir, create_audit_event


class AuditService:
    """Service for handling FHIR AuditEvent creation and management"""
    
    @staticmethod
    async def create_audit_log(
        db: AsyncSession,
        action: str,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> Dict[str, Any]:
        """
        Create an audit log entry and return it as a FHIR AuditEvent.
        
        Args:
            db: Database session
            action: The action performed (login, logout, create, read, update, delete)
            user_id: ID of the user who performed the action
            resource_type: FHIR resource type that was accessed
            resource_id: ID of the resource that was accessed
            details: Additional details about the action
            request: FastAPI request object for extracting IP and user agent
        
        Returns:
            FHIR AuditEvent resource
        """
        # Extract request details if available
        ip_address = None
        user_agent = None
        if request:
            if request.client:
                ip_address = request.client.host
            user_agent = request.headers.get("User-Agent")
        
        # Create the audit log entry in the database
        audit_id = uuid.uuid4()
        
        insert_query = text("""
            INSERT INTO emr.audit_logs (
                id, user_id, action, resource_type, resource_id,
                details, ip_address, user_agent, created_at
            ) VALUES (
                :id, :user_id, :action, :resource_type, :resource_id,
                :details, :ip_address, :user_agent, :created_at
            )
            RETURNING *
        """)
        
        result = await db.execute(insert_query, {
            "id": audit_id,
            "user_id": uuid.UUID(user_id) if user_id else None,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": json.dumps(details) if details else None,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.utcnow()
        })
        
        await db.commit()
        
        # Get the created audit log
        audit_log = result.first()
        
        # Convert to dictionary for the converter
        audit_dict = {
            "id": audit_log.id,
            "user_id": str(audit_log.user_id) if audit_log.user_id else None,
            "action": audit_log.action,
            "resource_type": audit_log.resource_type,
            "resource_id": audit_log.resource_id,
            "details": json.loads(audit_log.details) if audit_log.details else None,
            "ip_address": audit_log.ip_address,
            "user_agent": audit_log.user_agent,
            "created_at": audit_log.created_at
        }
        
        # Convert to FHIR AuditEvent
        return audit_log_to_fhir(audit_dict)
    
    @staticmethod
    async def audit_fhir_operation(
        db: AsyncSession,
        operation: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        user_id: Optional[str] = None,
        success: bool = True,
        details: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> Dict[str, Any]:
        """
        Create an audit log for a FHIR operation.
        
        Args:
            db: Database session
            operation: FHIR operation (create, read, update, delete, search)
            resource_type: FHIR resource type
            resource_id: Resource ID (if applicable)
            user_id: User who performed the operation
            success: Whether the operation succeeded
            details: Additional operation details
            request: FastAPI request object
        
        Returns:
            FHIR AuditEvent resource
        """
        # Add operation-specific details
        if details is None:
            details = {}
        
        details["fhir_operation"] = operation
        details["success"] = success
        
        # Add search parameters if this is a search operation
        if operation == "search" and request:
            details["search_params"] = dict(request.query_params)
        
        # Map FHIR operations to audit actions
        action_map = {
            "create": "create",
            "read": "read",
            "update": "update",
            "delete": "delete",
            "search": "read",
            "vread": "read",
            "history": "read",
            "batch": "execute",
            "transaction": "execute"
        }
        
        action = action_map.get(operation, "read")
        
        return await AuditService.create_audit_log(
            db=db,
            action=action,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            request=request
        )
    
    @staticmethod
    async def get_audit_events(
        db: AsyncSession,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Retrieve audit events as FHIR AuditEvent resources.
        
        Args:
            db: Database session
            filters: Optional filters (user_id, action, resource_type, date_from, date_to)
            limit: Maximum number of results
            offset: Number of results to skip
        
        Returns:
            List of FHIR AuditEvent resources
        """
        # Build query with filters
        query_parts = ["SELECT * FROM emr.audit_logs WHERE 1=1"]
        params = {"limit": limit, "offset": offset}
        
        if filters:
            if filters.get("user_id"):
                query_parts.append("AND user_id = :user_id")
                params["user_id"] = uuid.UUID(filters["user_id"])
            
            if filters.get("action"):
                query_parts.append("AND action = :action")
                params["action"] = filters["action"]
            
            if filters.get("resource_type"):
                query_parts.append("AND resource_type = :resource_type")
                params["resource_type"] = filters["resource_type"]
            
            if filters.get("resource_id"):
                query_parts.append("AND resource_id = :resource_id")
                params["resource_id"] = filters["resource_id"]
            
            if filters.get("date_from"):
                query_parts.append("AND created_at >= :date_from")
                params["date_from"] = filters["date_from"]
            
            if filters.get("date_to"):
                query_parts.append("AND created_at <= :date_to")
                params["date_to"] = filters["date_to"]
        
        query_parts.append("ORDER BY created_at DESC")
        query_parts.append("LIMIT :limit OFFSET :offset")
        
        query = text(" ".join(query_parts))
        result = await db.execute(query, params)
        
        # Convert to FHIR AuditEvents
        audit_events = []
        for row in result:
            audit_dict = {
                "id": row.id,
                "user_id": str(row.user_id) if row.user_id else None,
                "action": row.action,
                "resource_type": row.resource_type,
                "resource_id": row.resource_id,
                "details": json.loads(row.details) if row.details else None,
                "ip_address": row.ip_address,
                "user_agent": row.user_agent,
                "created_at": row.created_at
            }
            audit_events.append(audit_log_to_fhir(audit_dict))
        
        return audit_events
    
    @staticmethod
    async def create_login_audit(
        db: AsyncSession,
        user_id: str,
        success: bool = True,
        details: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> Dict[str, Any]:
        """Create an audit log for login attempts."""
        if details is None:
            details = {}
        
        details["success"] = success
        
        return await AuditService.create_audit_log(
            db=db,
            action="login",
            user_id=user_id if success else None,
            details=details,
            request=request
        )
    
    @staticmethod
    async def create_logout_audit(
        db: AsyncSession,
        user_id: str,
        request: Optional[Request] = None
    ) -> Dict[str, Any]:
        """Create an audit log for logout."""
        return await AuditService.create_audit_log(
            db=db,
            action="logout",
            user_id=user_id,
            request=request
        )