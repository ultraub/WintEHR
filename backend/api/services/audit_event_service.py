"""
HAPI FHIR AuditEvent Service for WintEHR
Replaces legacy fhir.audit_logs table with FHIR R4 AuditEvent resources

Migration: Part of Phase 2 - HAPI FHIR Migration
Created: 2025-10-06
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
import httpx

logger = logging.getLogger(__name__)


class AuditEventType:
    """Standard audit event types mapped to FHIR codes"""
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


class AuditEventService:
    """Service for logging audit events as FHIR AuditEvent resources in HAPI FHIR"""

    def __init__(self, hapi_base_url: str = "http://hapi-fhir:8080/fhir"):
        self.hapi_base_url = hapi_base_url

    def _map_event_type(self, event_type: str) -> Dict[str, Any]:
        """Map internal event type to FHIR audit event type coding"""

        # Map to FHIR audit event type codes
        type_map = {
            "auth": {
                "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
                "code": "110114",
                "display": "User Authentication"
            },
            "fhir": {
                "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
                "code": "rest",
                "display": "RESTful Operation"
            },
            "medication": {
                "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
                "code": "110111",
                "display": "Medication Event"
            },
            "order": {
                "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
                "code": "110111",
                "display": "Order Event"
            },
            "security": {
                "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
                "code": "110113",
                "display": "Security Alert"
            }
        }

        # Extract category from event_type (e.g., "auth.login.success" → "auth")
        category = event_type.split('.')[0] if '.' in event_type else "rest"

        return type_map.get(category, type_map["fhir"])

    def _map_action(self, action: str) -> str:
        """Map action to FHIR AuditEvent.action code"""
        action_map = {
            "create": "C",
            "read": "R",
            "update": "U",
            "delete": "D",
            "execute": "E",
            "login": "E",
            "logout": "E"
        }
        return action_map.get(action.lower(), "R")

    def _map_outcome(self, outcome: str) -> str:
        """Map outcome to FHIR AuditEvent.outcome code"""
        outcome_map = {
            "success": "0",     # Success
            "failure": "4",     # Minor failure
            "error": "8"        # Serious failure
        }
        return outcome_map.get(outcome.lower(), "0")

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
    ) -> Optional[str]:
        """
        Log an audit event as a FHIR AuditEvent resource

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
            ID of the created AuditEvent resource or None on error
        """
        try:
            # Build FHIR AuditEvent resource
            audit_event = {
                "resourceType": "AuditEvent",
                "type": self._map_event_type(event_type),
                "action": self._map_action(action or "read"),
                "recorded": datetime.utcnow().isoformat() + "Z",
                "outcome": self._map_outcome(outcome),
                "outcomeDesc": outcome,
                "agent": []
            }

            # Add subtype for more specific event classification
            audit_event["subtype"] = [{
                "system": "http://wintehr.com/fhir/audit-event-subtype",
                "code": event_type,
                "display": event_type.replace('.', ' ').replace('_', ' ').title()
            }]

            # Add user agent
            if user_id:
                # Use display instead of reference to avoid validation errors
                # when the Practitioner doesn't exist yet
                agent = {
                    "type": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                            "code": "AUT",
                            "display": "Author"
                        }]
                    },
                    "who": {"display": user_id},  # Use display to avoid reference validation
                    "requestor": True
                }

                # Add network info if available
                if ip_address:
                    agent["network"] = {
                        "address": ip_address,
                        "type": "2"  # IP Address
                    }

                audit_event["agent"].append(agent)

            # If no user, add system agent
            if not user_id:
                audit_event["agent"].append({
                    "type": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                            "code": "CST",
                            "display": "Custodian"
                        }]
                    },
                    "who": {
                        "display": "WintEHR System"
                    },
                    "requestor": False
                })

            # Add entities
            audit_event["entity"] = []

            # Add patient entity if provided
            if patient_id:
                # Use display to avoid reference validation when patient doesn't exist
                patient_ref = {"display": patient_id}
                # If patient_id looks like it includes "Patient/", use as reference
                if patient_id.startswith("Patient/"):
                    patient_ref = {"display": patient_id}
                audit_event["entity"].append({
                    "what": patient_ref,
                    "type": {
                        "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
                        "code": "1",
                        "display": "Person"
                    },
                    "role": {
                        "system": "http://terminology.hl7.org/CodeSystem/object-role",
                        "code": "1",
                        "display": "Patient"
                    }
                })

            # Add resource entity if provided
            if resource_type and resource_id:
                entity = {
                    "what": {"reference": f"{resource_type}/{resource_id}"},
                    "type": {
                        "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
                        "code": "2",
                        "display": "System Object"
                    }
                }

                # Add details if provided
                if details:
                    entity["detail"] = [{
                        "type": "Custom",
                        "valueString": json.dumps(details)
                    }]

                # Add user agent as detail
                if user_agent:
                    if "detail" not in entity:
                        entity["detail"] = []
                    entity["detail"].append({
                        "type": "User-Agent",
                        "valueString": user_agent
                    })

                audit_event["entity"].append(entity)

            # Create AuditEvent in HAPI FHIR
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.hapi_base_url}/AuditEvent",
                    json=audit_event,
                    headers={"Content-Type": "application/fhir+json"}
                )

                if response.status_code in [200, 201]:
                    created_resource = response.json()
                    audit_id = created_resource.get("id")

                    logger.info(
                        f"Audit event logged: {event_type} | "
                        f"User: {user_id} | "
                        f"Outcome: {outcome} | "
                        f"AuditEvent ID: {audit_id}"
                    )

                    return audit_id
                else:
                    logger.error(
                        f"Failed to create AuditEvent in HAPI: "
                        f"{response.status_code} - {response.text}"
                    )
                    return None

        except Exception as e:
            logger.error(f"Failed to log audit event: {e}", exc_info=True)
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
            action=event_type.split('.')[-1],
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
    ) -> List[Dict]:
        """Get audit events for a specific user using FHIR search"""
        try:
            # Build search parameters
            search_params = {
                "agent": f"Practitioner/{user_id}",
                "_count": str(limit),
                "_sort": "-date"
            }

            if start_date:
                search_params["date"] = f"ge{start_date.isoformat()}"

            if end_date:
                # Use range syntax if both dates provided
                if start_date:
                    search_params["date"] = f"ge{start_date.isoformat()}&date=le{end_date.isoformat()}"
                else:
                    search_params["date"] = f"le{end_date.isoformat()}"

            # Search HAPI FHIR
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.hapi_base_url}/AuditEvent",
                    params=search_params
                )

                if response.status_code == 200:
                    bundle = response.json()
                    entries = bundle.get("entry", [])
                    return [entry["resource"] for entry in entries]
                else:
                    logger.error(f"Failed to search audit events: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"Error retrieving user activity: {e}", exc_info=True)
            return []

    async def get_patient_access_logs(
        self,
        patient_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        """Get all access logs for a specific patient"""
        try:
            search_params = {
                "patient": f"Patient/{patient_id}",
                "_sort": "-date"
            }

            if start_date:
                search_params["date"] = f"ge{start_date.isoformat()}"

            if end_date:
                if start_date:
                    search_params["date"] = f"ge{start_date.isoformat()}&date=le{end_date.isoformat()}"
                else:
                    search_params["date"] = f"le{end_date.isoformat()}"

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.hapi_base_url}/AuditEvent",
                    params=search_params
                )

                if response.status_code == 200:
                    bundle = response.json()
                    entries = bundle.get("entry", [])
                    return [entry["resource"] for entry in entries]
                else:
                    logger.error(f"Failed to search patient access logs: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"Error retrieving patient access logs: {e}", exc_info=True)
            return []

    async def get_failed_login_attempts(
        self,
        username: Optional[str] = None,
        since: Optional[datetime] = None,
        ip_address: Optional[str] = None
    ) -> List[Dict]:
        """Get failed login attempts for security monitoring"""
        try:
            search_params = {
                "subtype": AuditEventType.AUTH_LOGIN_FAILURE,
                "outcome": "4",  # Minor failure
                "_sort": "-date"
            }

            if since:
                search_params["date"] = f"ge{since.isoformat()}"

            # Note: FHIR search doesn't easily support searching in entity details
            # We'll filter results in memory if username or ip_address specified

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.hapi_base_url}/AuditEvent",
                    params=search_params
                )

                if response.status_code == 200:
                    bundle = response.json()
                    entries = bundle.get("entry", [])
                    results = [entry["resource"] for entry in entries]

                    # Filter by username if specified
                    if username:
                        filtered = []
                        for event in results:
                            for entity in event.get("entity", []):
                                for detail in entity.get("detail", []):
                                    if detail.get("type") == "Custom":
                                        details_json = json.loads(detail.get("valueString", "{}"))
                                        if details_json.get("username") == username:
                                            filtered.append(event)
                                            break
                        results = filtered

                    return results
                else:
                    logger.error(f"Failed to search failed logins: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"Error retrieving failed login attempts: {e}", exc_info=True)
            return []


# Dependency injection helper for backward compatibility
async def get_audit_service() -> AuditEventService:
    """Get audit event service instance"""
    return AuditEventService()
