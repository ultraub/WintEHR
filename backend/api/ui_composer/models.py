"""
UI Composer Models
Pydantic models for UI Composer API requests and responses
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime
from enum import Enum

class UIRequestType(str, Enum):
    ANALYZE = "analyze"
    GENERATE = "generate"
    REFINE = "refine"

class UIComponentType(str, Enum):
    CHART = "chart"
    GRID = "grid"
    SUMMARY = "summary"
    TIMELINE = "timeline"
    FORM = "form"
    CONTAINER = "container"
    TEXT = "text"
    STAT = "stat"

class UILayoutType(str, Enum):
    DASHBOARD = "dashboard"
    REPORT = "report"
    FOCUSED_VIEW = "focused-view"

class DataScope(str, Enum):
    POPULATION = "population"
    PATIENT = "patient"
    ENCOUNTER = "encounter"

class AuthMethod(str, Enum):
    HOOKS = "hooks"
    SDK = "sdk"
    CLI = "cli"
    DEVELOPMENT = "development"

class AnalyzeRequest(BaseModel):
    """Request to analyze natural language UI description"""
    request: str = Field(..., description="Natural language description of desired UI")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional context")
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity")
    method: Optional[AuthMethod] = Field(None, description="Authentication method to use")

class UIComponent(BaseModel):
    """UI Component specification"""
    id: str
    type: UIComponentType
    props: Dict[str, Any]
    dataBinding: Optional[Dict[str, Any]] = None
    children: List["UIComponent"] = Field(default_factory=list)

class UISpecification(BaseModel):
    """Complete UI specification"""
    version: str = "1.0"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    layout: Dict[str, Any] = Field(default_factory=dict)
    dataSources: List[Dict[str, Any]] = Field(default_factory=list)
    components: List[UIComponent] = Field(default_factory=list)

class AnalyzeResponse(BaseModel):
    """Response from analysis"""
    success: bool
    specification: Optional[UISpecification] = None
    analysis: Optional[Dict[str, Any]] = None
    reasoning: Optional[str] = None
    error: Optional[str] = None
    session_id: Optional[str] = None
    method: Optional[str] = None

class GenerateRequest(BaseModel):
    """Request to generate UI components"""
    specification: UISpecification
    session_id: Optional[str] = None
    progressive: bool = Field(True, description="Use progressive loading")
    method: Optional[AuthMethod] = Field(None, description="Authentication method to use")

class GenerateResponse(BaseModel):
    """Response with generated components"""
    success: bool
    components: Optional[Dict[str, str]] = Field(None, description="Component ID to code mapping")
    error: Optional[str] = None
    session_id: Optional[str] = None

class RefineRequest(BaseModel):
    """Request to refine UI based on feedback"""
    feedback: str = Field(..., description="User feedback text")
    feedback_type: Optional[str] = Field("general", description="Type of feedback")
    specification: UISpecification
    selected_component: Optional[str] = Field(None, description="ID of selected component")
    session_id: Optional[str] = None
    method: Optional[AuthMethod] = Field(None, description="Authentication method to use")

class RefineResponse(BaseModel):
    """Response with refined UI"""
    success: bool
    specification: Optional[UISpecification] = None
    changes: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None
    session_id: Optional[str] = None

class TestClaudeResponse(BaseModel):
    """Response from Claude CLI test"""
    available: bool
    response: Optional[str] = None
    path: Optional[str] = None
    version: Optional[str] = None
    error: Optional[str] = None
    searched_paths: Optional[List[str]] = None
    message: Optional[str] = None
    developmentMode: Optional[bool] = None
    method_status: Optional[Dict[str, Any]] = None

class SaveDashboardRequest(BaseModel):
    """Request to save dashboard"""
    name: str
    description: Optional[str] = None
    specification: UISpecification
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class SaveDashboardResponse(BaseModel):
    """Response from save operation"""
    success: bool
    dashboard_id: Optional[str] = None
    error: Optional[str] = None

class SessionInfo(BaseModel):
    """Session information"""
    session_id: str
    created_at: datetime
    updated_at: datetime
    request_count: int = 0
    current_specification: Optional[UISpecification] = None
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)

# Enable forward references for recursive models
UIComponent.model_rebuild()