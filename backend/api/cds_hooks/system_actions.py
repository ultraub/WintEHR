"""
CDS Hooks System Actions Handler
Processes systemActions from CDS responses to auto-apply FHIR resource changes
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import json
from sqlalchemy.ext.asyncio import AsyncSession

from services.fhir_client_config import create_resource, update_resource, delete_resource
from .models import SystemAction

logger = logging.getLogger(__name__)


class SystemActionsHandler:
    """
    Handles processing of systemActions from CDS Hooks responses

    SystemActions allow CDS services to automatically apply changes to FHIR resources
    without requiring user interaction. This is a powerful feature in CDS Hooks 2.0
    that enables automated clinical workflows.
    """

    def __init__(self):
        """Initialize SystemActionsHandler (no storage engine needed with HAPI FHIR)"""
        pass
        
    async def process_system_actions(
        self,
        system_actions: List[SystemAction],
        context: Dict[str, Any],
        db: AsyncSession,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Process a list of system actions
        
        Args:
            system_actions: List of SystemAction objects to process
            context: Request context (patient, user, etc.)
            db: Database session
            dry_run: If True, validate but don't apply changes
            
        Returns:
            Dict containing results of processing
        """
        results = {
            "processed": [],
            "failed": [],
            "dry_run": dry_run
        }
        
        for action in system_actions:
            try:
                result = await self._process_single_action(action, context, db, dry_run)
                results["processed"].append(result)
            except Exception as e:
                logger.error(f"Failed to process system action: {str(e)}")
                results["failed"].append({
                    "action": action.dict(),
                    "error": str(e)
                })
        
        return results
    
    async def _process_single_action(
        self,
        action: SystemAction,
        context: Dict[str, Any],
        db: AsyncSession,
        dry_run: bool
    ) -> Dict[str, Any]:
        """Process a single system action"""
        
        # Validate the action
        await self._validate_action(action, context)
        
        # Extract resource information
        resource = action.resource
        resource_type = resource.get("resourceType")
        resource_id = resource.get("id")
        
        if not resource_type:
            raise ValueError("Resource must have a resourceType")
        
        # Add audit metadata
        resource = self._add_audit_metadata(resource, context)
        
        result = {
            "action_type": action.type,
            "resource_type": resource_type,
            "resource_id": resource_id
        }
        
        if dry_run:
            result["status"] = "validated"
            result["message"] = "Action validated but not applied (dry run)"
            return result
        
        # Process based on action type
        if action.type == "create":
            created_resource = create_resource(resource)
            result["resource_id"] = created_resource.get("id")
            result["status"] = "created"

        elif action.type == "update":
            if not resource_id:
                raise ValueError("Update action requires resource id")

            updated_resource = update_resource(resource_type, resource_id, resource)
            result["status"] = "updated"

        elif action.type == "delete":
            if not resource_id:
                raise ValueError("Delete action requires resource id")

            delete_resource(resource_type, resource_id)
            result["status"] = "deleted"
            
        else:
            raise ValueError(f"Unknown action type: {action.type}")
        
        # Log the action
        await self._log_system_action(action, result, context, db)
        
        return result
    
    async def _validate_action(self, action: SystemAction, context: Dict[str, Any]):
        """Validate a system action before processing"""
        
        # Check action type
        if action.type not in ["create", "update", "delete"]:
            raise ValueError(f"Invalid action type: {action.type}")
        
        # Validate resource
        if not action.resource:
            raise ValueError("Action must include a resource")
        
        resource_type = action.resource.get("resourceType")
        if not resource_type:
            raise ValueError("Resource must have a resourceType")
        
        # Additional validations based on action type
        if action.type in ["update", "delete"]:
            if not action.resource.get("id"):
                raise ValueError(f"{action.type} action requires resource id")
        
        # Validate patient association (most resources should be linked to a patient)
        if resource_type not in ["Organization", "Practitioner", "Location"]:
            patient_ref = self._get_patient_reference(action.resource)
            if not patient_ref:
                logger.warning(f"Resource type {resource_type} has no patient reference")
    
    def _get_patient_reference(self, resource: Dict[str, Any]) -> Optional[str]:
        """Extract patient reference from a resource"""
        
        # Common patient reference fields
        if "patient" in resource:
            return resource["patient"].get("reference")
        elif "subject" in resource:
            return resource["subject"].get("reference")
        elif resource.get("resourceType") == "Patient":
            return f"Patient/{resource.get('id')}"
        
        return None
    
    def _add_audit_metadata(self, resource: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Add audit metadata to resource"""
        
        # Add extension for CDS system action
        if "extension" not in resource:
            resource["extension"] = []
        
        resource["extension"].append({
            "url": "https://wintehr.com/fhir/StructureDefinition/cds-system-action",
            "valueObject": {
                "timestamp": datetime.utcnow().isoformat(),
                "userId": context.get("userId"),
                "hookInstance": context.get("hookInstance"),
                "serviceId": context.get("serviceId")
            }
        })
        
        return resource
    
    async def _log_system_action(
        self,
        action: SystemAction,
        result: Dict[str, Any],
        context: Dict[str, Any],
        db: AsyncSession
    ):
        """Log system action for audit trail"""
        
        # This would typically write to an audit log table
        # For now, we'll just log it
        logger.info(f"System action executed: {json.dumps({
            'action_type': action.type,
            'resource_type': result.get('resource_type'),
            'resource_id': result.get('resource_id'),
            'status': result.get('status'),
            'user_id': context.get('userId'),
            'patient_id': context.get('patientId'),
            'hook_instance': context.get('hookInstance'),
            'service_id': context.get('serviceId')
        })}")


class SystemActionsValidator:
    """Validates system actions before execution"""
    
    @staticmethod
    def validate_fhir_resource(resource: Dict[str, Any]) -> bool:
        """
        Basic FHIR resource validation
        
        In a production system, this would use a full FHIR validator
        """
        required_fields = ["resourceType"]
        
        for field in required_fields:
            if field not in resource:
                return False
        
        # Check for valid resource type
        valid_resource_types = [
            "Patient", "Practitioner", "Organization", "Location",
            "Encounter", "Condition", "Procedure", "Observation",
            "MedicationRequest", "ServiceRequest", "DiagnosticReport",
            "CarePlan", "Goal", "CareTeam", "Task"
        ]
        
        if resource["resourceType"] not in valid_resource_types:
            return False
        
        return True
    
    @staticmethod
    def check_permissions(
        action: SystemAction,
        user_context: Dict[str, Any]
    ) -> bool:
        """
        Check if user has permission to perform the action
        
        This is a placeholder - real implementation would check:
        - User roles and permissions
        - Resource-specific access controls
        - Organization policies
        """
        # For now, allow all actions
        # In production, implement proper RBAC
        return True