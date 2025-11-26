"""
CDS Hooks Audit Trail Router
Enhanced API endpoints for detailed audit trail viewing and analysis
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from database import get_db_session as get_db
from .service import AuditService
from .models import (
    AuditHistoryResponse, AuditAnalytics, DetailedAuditQuery,
    AuditEventEnriched, AuditTrailSummary, ActionType, AuditOutcome
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/audit",
    tags=["CDS Audit Trail"]
)

@router.get("/history", response_model=AuditHistoryResponse)
async def get_detailed_audit_history(
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    service_id: Optional[str] = Query(None, description="Filter by CDS service ID"),
    action_type: Optional[ActionType] = Query(None, description="Filter by action type"),
    outcome: Optional[AuditOutcome] = Query(None, description="Filter by outcome"),
    date_from: Optional[str] = Query(None, description="Start date (ISO format)"),
    date_to: Optional[str] = Query(None, description="End date (ISO format)"),
    limit: int = Query(50, description="Maximum number of results", ge=1, le=1000),
    offset: int = Query(0, description="Offset for pagination", ge=0),
    include_system_info: bool = Query(False, description="Include system metadata"),
    include_clinical_context: bool = Query(False, description="Include clinical context"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed audit history with advanced filtering and enrichment

    This endpoint provides comprehensive audit trail information with:
    - Advanced filtering by multiple criteria
    - Enriched event details with clinical context
    - Summary statistics and analytics
    - Pagination support
    """
    try:
        query = DetailedAuditQuery(
            patient_id=patient_id,
            user_id=user_id,
            service_id=service_id,
            action_type=action_type,
            outcome=outcome,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
            include_system_info=include_system_info,
            include_clinical_context=include_clinical_context
        )

        audit_service = AuditService(db)
        return await audit_service.get_detailed_audit_history(query)

    except Exception as e:
        logger.error(f"Error retrieving detailed audit history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve audit history: {str(e)}"
        )

@router.get("/analytics", response_model=AuditAnalytics)
async def get_audit_analytics(
    days: int = Query(30, description="Analysis period in days", ge=1, le=365),
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive audit analytics and statistics

    Provides detailed analytics including:
    - Success/failure rates
    - Action type breakdown
    - Service usage statistics
    - Performance metrics
    - Error analysis
    - Temporal patterns
    """
    try:
        audit_service = AuditService(db)
        return await audit_service.get_audit_analytics(days, patient_id)

    except Exception as e:
        logger.error(f"Error generating audit analytics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate analytics: {str(e)}"
        )

@router.get("/event/{audit_event_id}", response_model=AuditEventEnriched)
async def get_enriched_audit_event(
    audit_event_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single audit event with full enrichment

    Returns comprehensive details about a specific audit event including:
    - Complete event details
    - Patient and user information
    - Service information
    - Resource details
    - Related events
    - Clinical impact assessment
    """
    try:
        audit_service = AuditService(db)
        enriched_event = await audit_service.get_enriched_audit_event(audit_event_id)

        if not enriched_event:
            raise HTTPException(
                status_code=404,
                detail=f"Audit event {audit_event_id} not found or not a CDS action event"
            )

        return enriched_event

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving enriched audit event: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve audit event: {str(e)}"
        )

@router.get("/summary/{context_type}/{context_id}", response_model=AuditTrailSummary)
async def get_audit_trail_summary(
    context_type: str,
    context_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit trail summary for a specific context

    Provides summary information for:
    - Patient-specific audit trails (context_type='patient')
    - User-specific audit trails (context_type='user')
    - Service-specific audit trails (context_type='service')

    Returns summary statistics, risk indicators, and activity patterns.
    """
    try:
        if context_type not in ["patient", "user", "service"]:
            raise HTTPException(
                status_code=400,
                detail="Context type must be 'patient', 'user', or 'service'"
            )

        audit_service = AuditService(db)
        return await audit_service.get_audit_trail_summary(context_type, context_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating audit trail summary: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate summary: {str(e)}"
        )

@router.get("/patient/{patient_id}/timeline")
async def get_patient_audit_timeline(
    patient_id: str,
    days: int = Query(90, description="Timeline period in days", ge=1, le=365),
    db: AsyncSession = Depends(get_db)
):
    """
    Get patient-specific audit timeline

    Returns a chronological timeline of all CDS actions for a patient,
    formatted for timeline visualization components.
    """
    try:
        audit_service = AuditService(db)

        # Get patient audit history
        query = DetailedAuditQuery(
            patient_id=patient_id,
            limit=1000,
            include_clinical_context=True
        )

        history = await audit_service.get_detailed_audit_history(query)

        # Format as timeline events
        timeline_events = []
        for event in history.events:
            timeline_events.append({
                "id": event.execution_id,
                "timestamp": event.recorded,
                "type": "cds_action",
                "action": event.action_type.value,
                "service": event.service_id,
                "outcome": event.outcome.value,
                "message": event.message,
                "details": {
                    "execution_time": event.execution_time_ms,
                    "created_resources": event.created_resources,
                    "updated_resources": event.updated_resources,
                    "clinical_context": event.clinical_context
                },
                "severity": "success" if event.outcome == AuditOutcome.SUCCESS else "error"
            })

        return {
            "patient_id": patient_id,
            "timeline_period_days": days,
            "total_events": len(timeline_events),
            "events": sorted(timeline_events, key=lambda x: x["timestamp"], reverse=True),
            "summary": history.summary
        }

    except Exception as e:
        logger.error(f"Error generating patient audit timeline: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate timeline: {str(e)}"
        )

@router.get("/service/{service_id}/performance")
async def get_service_performance_metrics(
    service_id: str,
    days: int = Query(30, description="Analysis period in days", ge=1, le=365),
    db: AsyncSession = Depends(get_db)
):
    """
    Get performance metrics for a specific CDS service

    Returns detailed performance analysis including:
    - Execution frequency and patterns
    - Success/failure rates
    - Performance metrics
    - User adoption statistics
    - Resource creation patterns
    """
    try:
        audit_service = AuditService(db)

        # Get service-specific analytics
        query = DetailedAuditQuery(
            service_id=service_id,
            limit=1000,
            include_system_info=True
        )

        history = await audit_service.get_detailed_audit_history(query)

        # Calculate service-specific metrics
        total_executions = len(history.events)
        successful_executions = len([e for e in history.events if e.outcome == AuditOutcome.SUCCESS])

        # Get unique users
        unique_users = set(e.user_id for e in history.events)

        # Get resource creation stats
        resource_stats = {}
        for event in history.events:
            for resource in event.created_resources:
                res_type = resource["resourceType"]
                resource_stats[res_type] = resource_stats.get(res_type, 0) + 1

        # Calculate average execution time
        execution_times = [e.execution_time_ms for e in history.events if e.execution_time_ms > 0]
        avg_execution_time = sum(execution_times) / len(execution_times) if execution_times else 0

        return {
            "service_id": service_id,
            "analysis_period_days": days,
            "total_executions": total_executions,
            "successful_executions": successful_executions,
            "success_rate": (successful_executions / total_executions * 100) if total_executions > 0 else 0,
            "unique_users": len(unique_users),
            "average_execution_time_ms": avg_execution_time,
            "resource_creation_stats": resource_stats,
            "daily_average_executions": total_executions / days if days > 0 else 0,
            "user_adoption_rate": len(unique_users),
            "performance_trends": {
                "execution_frequency": "stable",  # This would be calculated from time series
                "success_rate_trend": "stable",
                "performance_trend": "stable"
            }
        }

    except Exception as e:
        logger.error(f"Error generating service performance metrics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate metrics: {str(e)}"
        )

@router.post("/search")
async def search_audit_events(
    search_query: str = Query(..., description="Search query for audit events"),
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    limit: int = Query(50, description="Maximum number of results", ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    Search audit events by text query

    Searches through audit event messages, error descriptions, and other text fields
    to find relevant audit events. Useful for troubleshooting and investigation.
    """
    try:
        audit_service = AuditService(db)

        # Get audit history with basic filters
        query = DetailedAuditQuery(
            patient_id=patient_id,
            limit=limit * 2,  # Get more to filter by search
            include_system_info=True
        )

        history = await audit_service.get_detailed_audit_history(query)

        # Filter events by search query
        search_lower = search_query.lower()
        matching_events = []

        for event in history.events:
            # Search in various fields
            searchable_text = " ".join([
                event.message.lower(),
                event.service_id.lower(),
                event.action_type.value.lower(),
                " ".join(event.errors).lower(),
                " ".join(event.warnings).lower()
            ])

            if search_lower in searchable_text:
                matching_events.append({
                    "event": event,
                    "relevance_score": searchable_text.count(search_lower)
                })

        # Sort by relevance
        matching_events.sort(key=lambda x: x["relevance_score"], reverse=True)

        # Return top results
        results = [item["event"] for item in matching_events[:limit]]

        return {
            "search_query": search_query,
            "total_matches": len(matching_events),
            "returned_results": len(results),
            "events": results,
            "search_metadata": {
                "patient_filter": patient_id,
                "search_fields": ["message", "service_id", "action_type", "errors", "warnings"]
            }
        }

    except Exception as e:
        logger.error(f"Error searching audit events: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )
