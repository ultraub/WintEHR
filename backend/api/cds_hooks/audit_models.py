"""
CDS Hooks Audit Trail Models
Enhanced models for detailed audit trail tracking and analysis
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum

class AuditOutcome(str, Enum):
    """Audit outcome codes following FHIR AuditEvent outcome values"""
    SUCCESS = "0"      # Success
    MINOR_FAILURE = "4"  # Minor failure
    SERIOUS_FAILURE = "8"  # Serious failure
    MAJOR_FAILURE = "12"   # Major failure

class ActionType(str, Enum):
    """CDS Action types"""
    CREATE = "create"
    UPDATE = "update" 
    DELETE = "delete"
    ORDER = "order"
    PRESCRIBE = "prescribe"
    SCHEDULE = "schedule"

class AuditEventDetail(BaseModel):
    """Detailed audit event information"""
    execution_id: str = Field(..., description="Unique execution ID")
    action_type: ActionType = Field(..., description="Type of action executed")
    service_id: str = Field(..., description="CDS service that provided the action")
    card_uuid: str = Field(..., description="UUID of the card")
    suggestion_uuid: str = Field(..., description="UUID of the suggestion")
    action_uuid: str = Field(..., description="UUID of the action")
    patient_id: str = Field(..., description="Patient ID")
    user_id: str = Field(..., description="User who executed the action")
    encounter_id: Optional[str] = Field(None, description="Encounter context")
    recorded: str = Field(..., description="ISO timestamp when action was recorded")
    outcome: AuditOutcome = Field(..., description="Outcome of the action")
    execution_time_ms: int = Field(..., description="Execution time in milliseconds")
    message: str = Field(..., description="Human-readable result message")
    errors: List[str] = Field(default_factory=list, description="Any errors encountered")
    warnings: List[str] = Field(default_factory=list, description="Any warnings")
    
    # Resource impact
    created_resources: List[Dict[str, str]] = Field(default_factory=list, description="Resources created")
    updated_resources: List[Dict[str, str]] = Field(default_factory=list, description="Resources updated")
    deleted_resources: List[Dict[str, str]] = Field(default_factory=list, description="Resources deleted")
    
    # Clinical context
    clinical_context: Optional[Dict[str, Any]] = Field(None, description="Clinical context data")
    
    # System metadata
    system_info: Dict[str, Any] = Field(default_factory=dict, description="System metadata")

class AuditHistoryResponse(BaseModel):
    """Response for audit history queries"""
    patient_id: str = Field(..., description="Patient ID")
    total_events: int = Field(..., description="Total number of audit events")
    events: List[AuditEventDetail] = Field(..., description="List of audit events")
    pagination: Dict[str, Any] = Field(..., description="Pagination information")
    summary: Dict[str, Any] = Field(default_factory=dict, description="Summary statistics")

class AuditAnalytics(BaseModel):
    """Analytics data for audit events"""
    period_days: int = Field(..., description="Analysis period in days")
    total_executions: int = Field(..., description="Total number of executions")
    successful_executions: int = Field(..., description="Number of successful executions")
    failed_executions: int = Field(..., description="Number of failed executions")
    success_rate: float = Field(..., description="Success rate as percentage")
    daily_average: float = Field(..., description="Average executions per day")
    
    # Breakdown by action type
    action_type_breakdown: Dict[str, int] = Field(default_factory=dict, description="Actions by type")
    
    # Breakdown by service
    service_breakdown: Dict[str, int] = Field(default_factory=dict, description="Actions by service")
    
    # Performance metrics
    avg_execution_time_ms: float = Field(0.0, description="Average execution time")
    max_execution_time_ms: int = Field(0, description="Maximum execution time")
    min_execution_time_ms: int = Field(0, description="Minimum execution time")
    
    # Error analysis
    most_common_errors: List[Dict[str, Any]] = Field(default_factory=list, description="Most common errors")
    
    # Temporal patterns
    hourly_distribution: List[int] = Field(default_factory=list, description="Executions by hour")
    daily_distribution: List[int] = Field(default_factory=list, description="Executions by day")

class DetailedAuditQuery(BaseModel):
    """Query parameters for detailed audit retrieval"""
    patient_id: Optional[str] = Field(None, description="Filter by patient ID")
    user_id: Optional[str] = Field(None, description="Filter by user ID")
    service_id: Optional[str] = Field(None, description="Filter by CDS service")
    action_type: Optional[ActionType] = Field(None, description="Filter by action type")
    outcome: Optional[AuditOutcome] = Field(None, description="Filter by outcome")
    date_from: Optional[str] = Field(None, description="Start date (ISO format)")
    date_to: Optional[str] = Field(None, description="End date (ISO format)")
    limit: int = Field(50, description="Maximum number of results", ge=1, le=1000)
    offset: int = Field(0, description="Offset for pagination", ge=0)
    include_system_info: bool = Field(False, description="Include system metadata")
    include_clinical_context: bool = Field(False, description="Include clinical context")

class AuditEventEnriched(BaseModel):
    """Enriched audit event with additional context"""
    base_event: AuditEventDetail = Field(..., description="Base audit event data")
    patient_info: Optional[Dict[str, Any]] = Field(None, description="Patient information")
    user_info: Optional[Dict[str, Any]] = Field(None, description="User information")
    service_info: Optional[Dict[str, Any]] = Field(None, description="CDS service information")
    resource_details: List[Dict[str, Any]] = Field(default_factory=list, description="Detailed resource information")
    related_events: List[str] = Field(default_factory=list, description="IDs of related audit events")
    clinical_impact_score: Optional[float] = Field(None, description="Estimated clinical impact score")

class AuditTrailSummary(BaseModel):
    """Summary of audit trail for a specific context"""
    context_type: str = Field(..., description="Type of context (patient, service, user)")
    context_id: str = Field(..., description="ID of the context")
    total_events: int = Field(..., description="Total audit events")
    date_range: Dict[str, str] = Field(..., description="Date range of events")
    outcome_summary: Dict[str, int] = Field(..., description="Summary by outcome")
    action_summary: Dict[str, int] = Field(..., description="Summary by action type")
    most_active_periods: List[Dict[str, Any]] = Field(default_factory=list, description="Most active time periods")
    risk_indicators: List[Dict[str, Any]] = Field(default_factory=list, description="Risk indicators identified")