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
from .cost_tracker import cost_tracker
from .llm_service import unified_llm_service

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
        logger.info(f"Received analyze request: method='{request.method}', model='{request.context.get('model') if request.context else 'unknown'}'")
        
        # Get or create session
        session_id = request.session_id or str(uuid.uuid4())
        session = await session_manager.get_or_create_session(session_id)
        
        # Add session_id to context for cost tracking
        context = request.context or {}
        context['session_id'] = session_id
        
        # Use UI Composer service for analysis with database session
        result = await ui_composer_service.analyze_request(
            request.request, 
            context,
            method=request.method,
            db_session=db
        )
        
        if not result.get("success"):
            logger.error(f"Analysis failed: {result.get('error', 'Unknown error')}")
            raise ValueError(result.get("error", "Analysis failed"))
        
        logger.info(f"Analysis successful using method: {result.get('method', 'unknown')}")
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
        
        # Build metadata including agent pipeline data if available
        metadata = {
            "name": f"Generated UI - {datetime.now().isoformat()}",
            "description": analysis_data.get("intent", request.request),
            "clinicalContext": {
                "scope": analysis_data.get("scope", "patient"),
                "dataRequirements": analysis_data.get("requiredData", [])
            },
            "generationMode": context.get("generationMode", "mixed")
        }
        
        # Include agent pipeline data if available
        if result.get("agentPipelineData"):
            metadata["agentPipeline"] = result["agentPipelineData"]
        
        ui_spec = UISpecification(
            metadata=metadata,
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
            session_id=session_id,
            method=result.get("method")  # Include which method was actually used
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
        
        # Add session_id to specification for cost tracking
        spec_dict = request.specification.dict()
        if request.session_id:
            spec_dict['session_id'] = request.session_id
        
        # Use UI Composer service to generate components
        components = await ui_composer_service.generate_components(
            spec_dict,
            method=request.method,
            db_session=db
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
        
        # Add session_id to specification for cost tracking
        spec_dict = request.specification.dict()
        if request.session_id:
            spec_dict['session_id'] = request.session_id
        
        # Use UI Composer service to refine UI
        result = await ui_composer_service.refine_ui(
            request.feedback,
            spec_dict,
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

@router.get("/sessions/{session_id}/cost")
async def get_session_cost(session_id: str):
    """Get cost information for a session"""
    cost_data = cost_tracker.get_session_cost(session_id)
    return cost_data

# New endpoints for multi-LLM support

@router.get("/providers/status")
async def get_providers_status():
    """Get availability status of all LLM providers"""
    try:
        status = await unified_llm_service.get_available_providers()
        return status
    except Exception as e:
        logger.error(f"Error checking provider status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compare")
async def compare_providers(
    request_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session)
):
    """Compare analysis results across multiple LLM providers"""
    try:
        request_text = request_data.get("request", "")
        context = request_data.get("context", {})
        providers = request_data.get("providers", None)
        
        # Run comparison
        comparison_result = await unified_llm_service.analyze_request_comparison(
            request_text, 
            context, 
            providers
        )
        
        return comparison_result
    except Exception as e:
        logger.error(f"Error in provider comparison: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compare/fhir-queries")
async def compare_fhir_queries(
    request_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session)
):
    """Compare FHIR query generation across providers"""
    try:
        clinical_request = request_data.get("request", "")
        available_resources = request_data.get("available_resources", [
            "Patient", "Observation", "Condition", "MedicationRequest",
            "AllergyIntolerance", "Procedure", "DiagnosticReport"
        ])
        providers = request_data.get("providers", None)
        
        comparison_result = await unified_llm_service.generate_fhir_queries_comparison(
            clinical_request,
            available_resources,
            providers
        )
        
        return comparison_result
    except Exception as e:
        logger.error(f"Error in FHIR query comparison: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-with-provider")
async def generate_with_specific_provider(
    request_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session)
):
    """Generate UI component using a specific LLM provider"""
    try:
        specification = request_data.get("specification", {})
        fhir_data = request_data.get("fhir_data", {})
        provider = request_data.get("provider", None)
        
        component_code = await unified_llm_service.generate_ui_component(
            specification,
            fhir_data,
            provider
        )
        
        return {
            "success": True,
            "component": component_code,
            "provider": provider
        }
    except Exception as e:
        logger.error(f"Error generating with provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))