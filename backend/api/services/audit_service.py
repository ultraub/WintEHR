"""
Audit Service for WintEHR
Logs security and clinical events to the audit_logs table
"""

import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import logging

logger = logging.getLogger(__name__)

class AuditEventType:
    """Standard audit event types"""
    # Authentication events
    AUTH_LOGIN_SUCCESS = "auth.login.success"
    AUTH_LOGIN_FAILURE = "auth.login.failure"
    AUTH_LOGOUT = "auth.logout"
    AUTH_SESSION_EXPIRED = "auth.session.expired"
    AUTH_UNAUTHORIZED_ACCESS = "auth.unauthorized"
    
    # Resource access events
    FHIR_RESOURCE_CREATE = "fhir.resource.create"
    FHIR_RESOURCE_READ = "fhir.resource.read"
    FHIR_RESOURCE_UPDATE = "fhir.resource.update"
    FHIR_RESOURCE_DELETE = "fhir.resource.delete"
    
    # Clinical events
    MEDICATION_PRESCRIBED = "medication.prescribed"
    MEDICATION_DISPENSED = "medication.dispensed"
    MEDICATION_ADMINISTERED = "medication.administered"
    ORDER_PLACED = "order.placed"
    RESULT_VIEWED = "result.viewed"
    RESULT_ACKNOWLEDGED = "result.acknowledged"
    
    # Security events
    SECURITY_PERMISSION_DENIED = "security.permission.denied"
    SECURITY_INVALID_TOKEN = "security.invalid.token"
    SECURITY_SUSPICIOUS_ACTIVITY = "security.suspicious"


class AuditService:
    """Service for logging audit events"""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
    
    async def log_event(
        self,
        event_type: str,
        user_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[str] = None,
        outcome: str = "success",
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> str:
        """
        Log an audit event to the database
        
        Args:
            event_type: Type of event (use AuditEventType constants)
            user_id: ID of the user performing the action
            patient_id: ID of the patient (if applicable)
            resource_type: FHIR resource type (if applicable)
            resource_id: FHIR resource ID (if applicable)
            action: Action performed (create, read, update, delete, etc.)
            outcome: Outcome of the action (success, failure, error)
            details: Additional details as JSON
            ip_address: Client IP address
            user_agent: Client user agent string
            
        Returns:
            ID of the created audit log entry
        """
        try:
            audit_id = str(uuid.uuid4())
            
            # Prepare the audit log entry
            query = text("""
                INSERT INTO audit.events (
                    id,
                    event_type,
                    event_time,
                    user_id,
                    patient_id,
                    resource_type,
                    resource_id,
                    action,
                    outcome,
                    details,
                    ip_address,
                    user_agent
                ) VALUES (
                    :id,
                    :event_type,
                    :event_time,
                    :user_id,
                    :patient_id,
                    :resource_type,
                    :resource_id,
                    :action,
                    :outcome,
                    :details,
                    :ip_address,
                    :user_agent
                )
            """)
            
            await self.db.execute(
                query,
                {
                    "id": audit_id,
                    "event_type": event_type,
                    "event_time": datetime.utcnow(),
                    "user_id": user_id,
                    "patient_id": patient_id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "action": action,
                    "outcome": outcome,
                    "details": json.dumps(details) if details else None,
                    "ip_address": ip_address,
                    "user_agent": user_agent
                }
            )
            
            await self.db.commit()
            
            # Log to application logs as well
            logger.info(
                f"Audit event logged: {event_type} | "
                f"User: {user_id} | "
                f"Outcome: {outcome} | "
                f"Resource: {resource_type}/{resource_id if resource_id else 'N/A'}"
            )
            
            return audit_id
            
        except Exception as e:
            logger.error(f"Failed to log audit event: {e}")
            # Don't fail the main operation if audit logging fails
            return None
    
    async def log_login_attempt(
        self,
        username: str,
        success: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        failure_reason: Optional[str] = None
    ):
        """Log a login attempt"""
        event_type = (
            AuditEventType.AUTH_LOGIN_SUCCESS 
            if success 
            else AuditEventType.AUTH_LOGIN_FAILURE
        )
        
        details = {"username": username}
        if failure_reason:
            details["failure_reason"] = failure_reason
        
        await self.log_event(
            event_type=event_type,
            user_id=username if success else None,
            action="login",
            outcome="success" if success else "failure",
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    async def log_logout(
        self,
        user_id: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log a logout event"""
        await self.log_event(
            event_type=AuditEventType.AUTH_LOGOUT,
            user_id=user_id,
            action="logout",
            outcome="success",
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    async def log_resource_access(
        self,
        user_id: str,
        resource_type: str,
        resource_id: str,
        action: str,
        patient_id: Optional[str] = None,
        success: bool = True,
        ip_address: Optional[str] = None
    ):
        """Log FHIR resource access"""
        event_type_map = {
            "create": AuditEventType.FHIR_RESOURCE_CREATE,
            "read": AuditEventType.FHIR_RESOURCE_READ,
            "update": AuditEventType.FHIR_RESOURCE_UPDATE,
            "delete": AuditEventType.FHIR_RESOURCE_DELETE
        }
        
        event_type = event_type_map.get(
            action.lower(), 
            f"fhir.resource.{action.lower()}"
        )
        
        await self.log_event(
            event_type=event_type,
            user_id=user_id,
            patient_id=patient_id,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            outcome="success" if success else "failure",
            ip_address=ip_address
        )
    
    async def log_medication_event(
        self,
        event_type: str,
        user_id: str,
        patient_id: str,
        medication_id: str,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ):
        """Log medication-related events"""
        await self.log_event(
            event_type=event_type,
            user_id=user_id,
            patient_id=patient_id,
            resource_type="MedicationRequest",
            resource_id=medication_id,
            action=event_type.split('.')[-1],  # Extract action from event type
            outcome="success",
            details=details,
            ip_address=ip_address
        )
    
    async def get_user_activity(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> list:
        """Get audit logs for a specific user"""
        query = text("""
            SELECT * FROM audit.events
            WHERE user_id = :user_id
            AND (:start_date IS NULL OR event_time >= :start_date)
            AND (:end_date IS NULL OR event_time <= :end_date)
            ORDER BY event_time DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(
            query,
            {
                "user_id": user_id,
                "start_date": start_date,
                "end_date": end_date,
                "limit": limit
            }
        )
        
        return [dict(row) for row in result]
    
    async def get_patient_access_logs(
        self,
        patient_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> list:
        """Get all access logs for a specific patient"""
        query = text("""
            SELECT * FROM audit.events
            WHERE patient_id = :patient_id
            AND (:start_date IS NULL OR event_time >= :start_date)
            AND (:end_date IS NULL OR event_time <= :end_date)
            ORDER BY event_time DESC
        """)
        
        result = await self.db.execute(
            query,
            {
                "patient_id": patient_id,
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        return [dict(row) for row in result]
    
    async def get_failed_login_attempts(
        self,
        username: Optional[str] = None,
        since: Optional[datetime] = None,
        ip_address: Optional[str] = None
    ) -> list:
        """Get failed login attempts for security monitoring"""
        query = text("""
            SELECT * FROM audit.events
            WHERE event_type = :event_type
            AND (:username IS NULL OR details->>'username' = :username)
            AND (:since IS NULL OR event_time >= :since)
            AND (:ip_address IS NULL OR ip_address = :ip_address)
            ORDER BY event_time DESC
        """)
        
        result = await self.db.execute(
            query,
            {
                "event_type": AuditEventType.AUTH_LOGIN_FAILURE,
                "username": username,
                "since": since,
                "ip_address": ip_address
            }
        )
        
        return [dict(row) for row in result]


# Dependency injection helper
async def get_audit_service(db: AsyncSession) -> AuditService:
    """Get audit service instance"""
    return AuditService(db)