"""
CDS Action Execution Router
API endpoints for executing CDS Hook suggested actions
"""

from typing import Dict, List, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from database import get_db_session as get_db
from .executor import ActionExecutor, ActionExecutionRequest, ActionExecutionResult
from ..cds_hooks_router import get_persistence_manager
from ..models import CDSHookRequest

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/actions",
    tags=["CDS Action Execution"]
)

@router.post("/execute", response_model=ActionExecutionResult)
async def execute_cds_action(
    request: ActionExecutionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Execute a CDS Hook suggested action

    This endpoint takes a CDS action execution request and processes it,
    creating or modifying FHIR resources as specified by the action.
    """
    try:
        # Get the original CDS service and validate the action exists
        manager = await get_persistence_manager(db)

        # For now, we'll accept the action data in the request context
        # In a production system, you'd validate against the original hook response
        action_data = request.context.get("action_data", {})

        if not action_data:
            raise HTTPException(
                status_code=400,
                detail="Action data is required in request context"
            )

        # Create action executor
        executor = ActionExecutor(db)

        # Execute the action
        result = await executor.execute_action(request, action_data)

        # Schedule background tasks for notifications, etc.
        if result.success:
            background_tasks.add_task(
                _send_execution_notification,
                request,
                result
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing CDS action: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute action: {str(e)}"
        )

@router.post("/batch-execute")
async def batch_execute_cds_actions(
    requests: List[ActionExecutionRequest],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Execute multiple CDS actions in batch

    This is useful when a user accepts multiple suggestions at once
    """
    try:
        executor = ActionExecutor(db)
        results = []

        for request in requests:
            try:
                action_data = request.context.get("action_data", {})
                if not action_data:
                    results.append(ActionExecutionResult(
                        execution_id="",
                        success=False,
                        message="Action data is required",
                        errors=["Action data is required in request context"],
                        execution_time_ms=0
                    ))
                    continue

                result = await executor.execute_action(request, action_data)
                results.append(result)

                # Schedule notifications for successful executions
                if result.success:
                    background_tasks.add_task(
                        _send_execution_notification,
                        request,
                        result
                    )

            except Exception as e:
                logger.error(f"Error in batch execution for action {request.action_uuid}: {str(e)}")
                results.append(ActionExecutionResult(
                    execution_id="",
                    success=False,
                    message=f"Execution failed: {str(e)}",
                    errors=[str(e)],
                    execution_time_ms=0
                ))

        # Summary
        successful = len([r for r in results if r.success])
        total = len(results)

        return {
            "total_actions": total,
            "successful_executions": successful,
            "failed_executions": total - successful,
            "results": results,
            "summary": f"Executed {successful}/{total} actions successfully"
        }

    except Exception as e:
        logger.error(f"Error in batch action execution: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Batch execution failed: {str(e)}"
        )

@router.get("/validate")
async def validate_action(
    service_id: str,
    card_uuid: str,
    suggestion_uuid: str,
    action_uuid: str,
    patient_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Validate that a CDS action can be executed

    This checks permissions, resource availability, and other prerequisites
    """
    try:
        # Basic validation
        if not all([service_id, card_uuid, suggestion_uuid, action_uuid, patient_id]):
            raise HTTPException(
                status_code=400,
                detail="All parameters are required for validation"
            )

        # Check if patient exists
        executor = ActionExecutor(db)
        try:
            patient = await executor.storage.read_resource("Patient", patient_id)
            if not patient:
                return {
                    "valid": False,
                    "message": f"Patient {patient_id} not found",
                    "errors": ["Patient not found"]
                }
        except Exception as e:
            return {
                "valid": False,
                "message": f"Could not validate patient: {str(e)}",
                "errors": [str(e)]
            }

        # In a production system, you would also validate:
        # - User permissions for the action
        # - Service and action existence in the original hook response
        # - Resource constraints (e.g., appointment availability)
        # - Clinical appropriateness

        return {
            "valid": True,
            "message": "Action can be executed",
            "patient_name": patient.get("name", [{}])[0].get("text", "Unknown"),
            "patient_id": patient_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating action: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Validation failed: {str(e)}"
        )

@router.get("/history/{patient_id}")
async def get_action_execution_history(
    patient_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Get execution history for CDS actions for a patient

    This returns audit logs of executed actions
    """
    try:
        executor = ActionExecutor(db)

        # Search for audit events related to CDS action execution
        search_params = {
            "patient": f"Patient/{patient_id}",
            "type": "110100",  # Application Activity
            "_sort": "-recorded",
            "_count": str(limit),
            "_offset": str(offset)
        }

        audit_events, total = await executor.storage.search_resources(
            "AuditEvent",
            search_params
        )

        # Filter for CDS-related events and format response
        cds_events = []
        for event in audit_events:
            # Check if this is a CDS action execution
            subtype = event.get("subtype", [])
            if any(st.get("display") == "CDS Action Execution" for st in subtype):
                cds_events.append({
                    "id": event.get("id"),
                    "recorded": event.get("recorded"),
                    "outcome": event.get("outcome"),
                    "agent": event.get("agent", [{}])[0].get("who", {}).get("reference", "Unknown"),
                    "details": [
                        detail.get("valueString", "")
                        for entity in event.get("entity", [])
                        for detail in entity.get("detail", [])
                        if detail.get("type") in ["execution_result", "error"]
                    ]
                })

        return {
            "patient_id": patient_id,
            "total_events": len(cds_events),
            "events": cds_events,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "has_more": len(audit_events) == limit
            }
        }

    except Exception as e:
        logger.error(f"Error retrieving action history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve history: {str(e)}"
        )

# Background task functions
async def _send_execution_notification(
    request: ActionExecutionRequest,
    result: ActionExecutionResult
):
    """Send notification about action execution (background task)"""
    try:
        # This would integrate with a notification system
        # For now, just log the successful execution
        logger.info(
            f"CDS Action executed successfully: "
            f"Patient={request.patient_id}, "
            f"Action={request.action_uuid}, "
            f"Resource={result.resource_type}/{result.resource_id}"
        )

        # In a production system, you might:
        # - Send notifications to care team members
        # - Update workflow systems
        # - Trigger follow-up reminders
        # - Update clinical dashboards

    except Exception as e:
        logger.warning(f"Failed to send execution notification: {str(e)}")

@router.get("/stats/execution-summary")
async def get_execution_stats(
    days: int = 30,
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about CDS action executions

    This provides insights into which actions are being executed most frequently
    """
    try:
        executor = ActionExecutor(db)

        # This would typically query a dedicated analytics table
        # For now, return basic stats from audit events
        from datetime import datetime, timedelta

        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()

        search_params = {
            "type": "110100",  # Application Activity
            "date": f"ge{cutoff_date}",
            "_count": "1000"  # Large number to get all recent events
        }

        audit_events, total = await executor.storage.search_resources(
            "AuditEvent",
            search_params
        )

        # Filter and analyze CDS events
        cds_events = [
            event for event in audit_events
            if any(
                st.get("display") == "CDS Action Execution"
                for st in event.get("subtype", [])
            )
        ]

        successful = len([e for e in cds_events if e.get("outcome") == "0"])
        failed = len(cds_events) - successful

        return {
            "period_days": days,
            "total_executions": len(cds_events),
            "successful_executions": successful,
            "failed_executions": failed,
            "success_rate": (successful / len(cds_events) * 100) if cds_events else 0,
            "daily_average": len(cds_events) / days if days > 0 else 0,
            "summary": f"{successful}/{len(cds_events)} actions executed successfully in the last {days} days"
        }

    except Exception as e:
        logger.error(f"Error retrieving execution stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve stats: {str(e)}"
        )
