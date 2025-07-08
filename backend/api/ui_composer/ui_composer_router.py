"""
UI Composer API Router
Provides endpoints for dynamic UI generation using Claude CLI
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional
import json
import uuid
from datetime import datetime
import logging
from pathlib import Path

from database import get_db_session
from .models import (
    AnalyzeRequest, AnalyzeResponse,
    GenerateRequest, GenerateResponse,
    RefineRequest, RefineResponse,
    TestClaudeResponse,
    SaveDashboardRequest, SaveDashboardResponse,
    SessionInfo, UISpecification, UIComponent
)
from .claude_cli_service import claude_cli_service
from .ui_composer_service import ui_composer_service
from .session_manager import SessionManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ui-composer", tags=["UI Composer"])

# Initialize session manager
session_manager = SessionManager()

@router.get("/test-claude", response_model=TestClaudeResponse)
async def test_claude():
    """Test if Claude is available and working across all methods"""
    try:
        # Get status for all methods
        method_status = await ui_composer_service.get_method_status()
        
        # Check if any method is available
        any_available = any(status.get("available", False) for status in method_status.values())
        
        return TestClaudeResponse(
            available=any_available,
            method_status=method_status,
            message="Multiple authentication methods available" if any_available else "No authentication methods available"
        )
    except Exception as e:
        logger.error(f"Error testing Claude: {e}")
        return TestClaudeResponse(
            available=False,
            error=str(e),
            message="Error checking Claude availability"
        )

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_ui_request(
    request: AnalyzeRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Analyze natural language UI request"""
    try:
        # Get or create session
        session_id = request.session_id or str(uuid.uuid4())
        session = await session_manager.get_or_create_session(session_id)
        
        # Use UI Composer service for analysis
        result = await ui_composer_service.analyze_request(
            request.request, 
            request.context or {},
            method=request.method
        )
        
        if not result.get("success"):
            raise ValueError(result.get("error", "Analysis failed"))
        
        analysis_data = result.get("analysis", {})
        
        # Create UI specification from analysis
        # Process components from analysis
        components = []
        for i, comp in enumerate(analysis_data.get("components", [])):
            component = UIComponent(
                id=f"comp-{i}",
                type=comp.get("type", "container"),
                props=comp.get("displayProperties", {}),
                dataBinding=comp.get("dataBinding"),
                children=[]
            )
            components.append(component)
        
        ui_spec = UISpecification(
            metadata={
                "name": f"Generated UI - {datetime.now().isoformat()}",
                "description": analysis_data.get("intent", request.request),
                "clinicalContext": {
                    "scope": analysis_data.get("scope", "patient"),
                    "dataRequirements": analysis_data.get("requiredData", [])
                }
            },
            layout={
                "type": analysis_data.get("layoutType", "dashboard"),
                "structure": analysis_data.get("layout", {})
            },
            dataSources=[
                {
                    "id": f"ds-{i}",
                    "resourceType": rt,
                    "query": {}
                }
                for i, rt in enumerate(analysis_data.get("requiredData", []))
            ],
            components=components
        )
        
        # Update session
        session.current_specification = ui_spec
        session.conversation_history.append({
            "type": "analyze",
            "request": request.request,
            "response": analysis_data,
            "timestamp": datetime.now().isoformat()
        })
        await session_manager.save_session(session)
        
        return AnalyzeResponse(
            success=True,
            specification=ui_spec,
            analysis=analysis_data,
            reasoning=analysis_data.get("intent"),
            session_id=session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing UI request: {e}", exc_info=True)
        return AnalyzeResponse(
            success=False,
            error=str(e)
        )

@router.post("/generate", response_model=GenerateResponse)
async def generate_ui_components(
    request: GenerateRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Generate React components from UI specification"""
    try:
        # Get session if provided
        session = None
        if request.session_id:
            session = await session_manager.get_session(request.session_id)
        
        # Use UI Composer service to generate components
        components = await ui_composer_service.generate_components(
            request.specification.dict(),
            method=request.method
        )
        
        # Update session if exists
        if session:
            session.conversation_history.append({
                "type": "generate",
                "components_count": len(components),
                "timestamp": datetime.now().isoformat()
            })
            await session_manager.save_session(session)
        
        return GenerateResponse(
            success=True,
            components=components,
            session_id=request.session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating UI components: {e}", exc_info=True)
        return GenerateResponse(
            success=False,
            error=str(e)
        )

@router.post("/refine", response_model=RefineResponse)
async def refine_ui(
    request: RefineRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Refine UI based on user feedback"""
    try:
        # Get session if provided
        session = None
        if request.session_id:
            session = await session_manager.get_session(request.session_id)
        
        # Use UI Composer service to refine UI
        result = await ui_composer_service.refine_ui(
            request.feedback,
            request.specification.dict(),
            feedback_type=request.feedback_type,
            selected_component=request.selected_component,
            method=request.method
        )
        
        if not result.get("success"):
            raise ValueError(result.get("error", "Refinement failed"))
        
        refinement_data = {
            "changes": result.get("changes", []),
            "reasoning": result.get("reasoning", "")
        }
        
        # Apply changes to specification (simplified for now)
        # In a real implementation, you would apply each change to the spec
        refined_spec = request.specification.copy(deep=True)
        
        # Update session if exists
        if session:
            session.current_specification = refined_spec
            session.conversation_history.append({
                "type": "refine",
                "feedback": request.feedback,
                "changes": refinement_data.get("changes", []),
                "timestamp": datetime.now().isoformat()
            })
            await session_manager.save_session(session)
        
        return RefineResponse(
            success=True,
            specification=refined_spec,
            changes=refinement_data.get("changes", []),
            session_id=request.session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refining UI: {e}", exc_info=True)
        return RefineResponse(
            success=False,
            error=str(e)
        )

@router.post("/save", response_model=SaveDashboardResponse)
async def save_dashboard(
    request: SaveDashboardRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Save dashboard specification"""
    try:
        # For now, save to filesystem
        # In production, this would save to database
        dashboard_id = str(uuid.uuid4())
        
        dashboard_data = {
            "id": dashboard_id,
            "name": request.name,
            "description": request.description,
            "specification": request.specification.dict(),
            "metadata": request.metadata or {},
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Save to file (temporary solution)
        dashboards_dir = Path(".claude/sessions/ui-composer/dashboards")
        dashboards_dir.mkdir(parents=True, exist_ok=True)
        
        dashboard_file = dashboards_dir / f"{dashboard_id}.json"
        dashboard_file.write_text(json.dumps(dashboard_data, indent=2))
        
        return SaveDashboardResponse(
            success=True,
            dashboard_id=dashboard_id
        )
        
    except Exception as e:
        logger.error(f"Error saving dashboard: {e}", exc_info=True)
        return SaveDashboardResponse(
            success=False,
            error=str(e)
        )

@router.get("/sessions/{session_id}", response_model=SessionInfo)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Get session information"""
    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found"
        )
    return session