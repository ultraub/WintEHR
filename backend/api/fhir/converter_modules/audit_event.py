"""
FHIR AuditEvent Converter
Converts between EMR audit logs and FHIR R4 AuditEvent resources
"""

from datetime import datetime
from typing import Dict, Any, Optional, List, Union
import json
import uuid


def audit_log_to_fhir(
    audit_log: Dict[str, Any],
    base_url: str = "http://localhost:8000/fhir/R4"
) -> Dict[str, Any]:
    """
    Convert EMR audit log to FHIR R4 AuditEvent resource.
    
    Args:
        audit_log: Dictionary containing audit log data with fields:
            - id: UUID
            - user_id: UUID (optional)
            - action: str (e.g., "login", "logout", "create", "read", "update", "delete")
            - resource_type: str (optional, FHIR resource type)
            - resource_id: str (optional)
            - details: JSONB (optional)
            - ip_address: str (optional)
            - user_agent: str (optional)
            - created_at: datetime
        base_url: Base URL for the FHIR server
    
    Returns:
        FHIR R4 AuditEvent resource as dictionary
    """
    # Map actions to FHIR AuditEvent types
    action_type_map = {
        "login": {"code": "110122", "system": "http://dicom.nema.org/resources/ontology/DCM", "display": "Login"},
        "logout": {"code": "110123", "system": "http://dicom.nema.org/resources/ontology/DCM", "display": "Logout"},
        "create": {"code": "C", "system": "http://hl7.org/fhir/audit-event-action", "display": "Create"},
        "read": {"code": "R", "system": "http://hl7.org/fhir/audit-event-action", "display": "Read"},
        "update": {"code": "U", "system": "http://hl7.org/fhir/audit-event-action", "display": "Update"},
        "delete": {"code": "D", "system": "http://hl7.org/fhir/audit-event-action", "display": "Delete"},
        "execute": {"code": "E", "system": "http://hl7.org/fhir/audit-event-action", "display": "Execute"}
    }
    
    # Map actions to outcomes
    outcome_map = {
        "login": "0",  # Success
        "logout": "0",  # Success
        "create": "0",  # Success
        "read": "0",   # Success
        "update": "0",  # Success
        "delete": "0",  # Success
        "error": "4",  # Minor failure
        "denied": "8"  # Major failure
    }
    
    # Get action details
    action = audit_log.get("action", "").lower()
    action_type = action_type_map.get(action, action_type_map["read"])
    
    # Create base AuditEvent structure
    audit_event = {
        "resourceType": "AuditEvent",
        "id": str(audit_log.get("id", "")),
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        },
        "type": {
            "system": action_type["system"],
            "code": action_type["code"],
            "display": action_type["display"]
        },
        "action": action[0].upper() if action and action[0] in "crudCRUD" else "R",
        "period": {
            "start": audit_log.get("created_at", datetime.utcnow()).isoformat() + "Z",
            "end": audit_log.get("created_at", datetime.utcnow()).isoformat() + "Z"
        },
        "recorded": audit_log.get("created_at", datetime.utcnow()).isoformat() + "Z",
        "outcome": outcome_map.get(action, "0"),
        "agent": [],
        "source": {
            "observer": {
                "identifier": {
                    "value": "MedGenEMR"
                },
                "display": "MedGenEMR System"
            }
        }
    }
    
    # Add agent (user who performed the action)
    if audit_log.get("user_id"):
        agent = {
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                    "code": "IRCP",
                    "display": "information recipient"
                }]
            },
            "who": {
                "reference": f"Practitioner/{audit_log['user_id']}"
            },
            "requestor": True
        }
        
        # Add network information if available
        if audit_log.get("ip_address"):
            agent["network"] = {
                "address": audit_log["ip_address"],
                "type": "2"  # IP address
            }
        
        audit_event["agent"].append(agent)
    
    # Add system agent
    system_agent = {
        "type": {
            "coding": [{
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": "110150",
                "display": "Application"
            }]
        },
        "who": {
            "identifier": {
                "value": "MedGenEMR"
            }
        },
        "requestor": False
    }
    
    if audit_log.get("user_agent"):
        system_agent["name"] = audit_log["user_agent"][:50]  # Limit length
    
    audit_event["agent"].append(system_agent)
    
    # Add entity (what was accessed/modified)
    if audit_log.get("resource_type") and audit_log.get("resource_id"):
        entity = {
            "what": {
                "reference": f"{audit_log['resource_type']}/{audit_log['resource_id']}"
            },
            "type": {
                "system": "http://hl7.org/fhir/audit-entity-type",
                "code": "2",
                "display": "System Object"
            }
        }
        
        # Add role based on action
        if action in ["create", "update", "delete"]:
            entity["role"] = {
                "system": "http://hl7.org/fhir/object-role",
                "code": "4",
                "display": "Domain Resource"
            }
        elif action == "read":
            entity["role"] = {
                "system": "http://hl7.org/fhir/object-role",
                "code": "3",
                "display": "Report"
            }
        
        audit_event["entity"] = [entity]
    
    # Add additional details if present
    if audit_log.get("details"):
        details = audit_log["details"]
        if isinstance(details, str):
            try:
                details = json.loads(details)
            except:
                details = {"raw": details}
        
        # Add details as additional entities or in outcomeDesc
        if isinstance(details, dict):
            # Add search parameters as entities
            if "search_params" in details:
                for param, value in details["search_params"].items():
                    if "entity" not in audit_event:
                        audit_event["entity"] = []
                    audit_event["entity"].append({
                        "type": {
                            "system": "http://hl7.org/fhir/audit-entity-type",
                            "code": "2",
                            "display": "System Object"
                        },
                        "detail": [{
                            "type": param,
                            "valueString": str(value)
                        }]
                    })
            
            # Add outcome description for errors or additional info
            if "error" in details or "message" in details:
                audit_event["outcomeDesc"] = details.get("error") or details.get("message")
    
    return audit_event


def create_audit_event(
    action: str,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    outcome: str = "success",
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new FHIR AuditEvent resource.
    
    Args:
        action: The action performed (login, logout, create, read, update, delete)
        user_id: ID of the user who performed the action
        resource_type: FHIR resource type that was accessed
        resource_id: ID of the resource that was accessed
        outcome: Outcome of the action (success, error, denied)
        details: Additional details about the action
        ip_address: IP address of the client
        user_agent: User agent string of the client
    
    Returns:
        FHIR R4 AuditEvent resource as dictionary
    """
    audit_log = {
        "id": str(uuid.uuid4()),
        "action": action,
        "user_id": user_id,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "created_at": datetime.utcnow()
    }
    
    return audit_log_to_fhir(audit_log)


def search_audit_events(
    params: Dict[str, Any],
    audit_logs: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Search audit events based on FHIR search parameters.
    
    Supported parameters:
    - date: When the activity occurred
    - agent: Who participated
    - entity: Specific instance of resource
    - type: Type of action performed
    - action: Type of action performed (C,R,U,D,E)
    - outcome: Whether the event succeeded or failed
    
    Args:
        params: Search parameters
        audit_logs: List of audit log dictionaries
    
    Returns:
        List of FHIR AuditEvent resources matching the search criteria
    """
    results = []
    
    for log in audit_logs:
        audit_event = audit_log_to_fhir(log)
        match = True
        
        # Filter by date
        if "date" in params:
            date_param = params["date"]
            event_date = log.get("created_at")
            if not event_date:
                match = False
            else:
                # Handle date range operators (gt, lt, ge, le, eq)
                if date_param.startswith("gt"):
                    match = event_date > datetime.fromisoformat(date_param[2:])
                elif date_param.startswith("lt"):
                    match = event_date < datetime.fromisoformat(date_param[2:])
                elif date_param.startswith("ge"):
                    match = event_date >= datetime.fromisoformat(date_param[2:])
                elif date_param.startswith("le"):
                    match = event_date <= datetime.fromisoformat(date_param[2:])
                else:
                    # Exact date match (same day)
                    target_date = datetime.fromisoformat(date_param)
                    match = event_date.date() == target_date.date()
        
        # Filter by agent (user)
        if "agent" in params and match:
            agent_ref = params["agent"]
            if not any(agent.get("who", {}).get("reference", "").endswith(agent_ref) 
                      for agent in audit_event.get("agent", [])):
                match = False
        
        # Filter by entity (resource)
        if "entity" in params and match:
            entity_ref = params["entity"]
            if not any(entity.get("what", {}).get("reference", "").endswith(entity_ref)
                      for entity in audit_event.get("entity", [])):
                match = False
        
        # Filter by type
        if "type" in params and match:
            if audit_event.get("type", {}).get("code") != params["type"]:
                match = False
        
        # Filter by action
        if "action" in params and match:
            if audit_event.get("action") != params["action"].upper():
                match = False
        
        # Filter by outcome
        if "outcome" in params and match:
            if audit_event.get("outcome") != params["outcome"]:
                match = False
        
        if match:
            results.append(audit_event)
    
    return results