"""
Clinical Canvas API Router

Provides endpoints for AI-powered clinical UI generation.
Works with any FHIR-compliant backend.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db_session
from api.auth import get_current_user
from .canvas_service import ClinicalCanvasService

router = APIRouter(prefix="/api/clinical-canvas", tags=["Clinical Canvas"])


@router.post("/generate")
async def generate_clinical_ui(
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate a clinical UI from natural language prompt.
    
    Request body:
    {
        "prompt": "Show me the patient's vital signs and recent lab results",
        "context": {
            "patientId": "12345",
            "encounterId": "67890",
            "authToken": "..." // Optional, for external FHIR servers
        },
        "preferences": {
            "theme": "light",
            "density": "comfortable"
        }
    }
    
    Returns UI specification that can be rendered by the frontend.
    """
    prompt = request.get("prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    
    context = request.get("context", {})
    if not context.get("patientId"):
        raise HTTPException(status_code=400, detail="Patient ID is required in context")
    
    # Add user information to context
    context["userId"] = user["id"]
    context["userRole"] = user["role"]
    
    # Get FHIR base URL from request or use default
    fhir_base_url = request.get("fhirBaseUrl")
    
    # Initialize service
    service = ClinicalCanvasService(fhir_base_url)
    
    try:
        # Generate UI specification
        ui_spec = await service.generate_ui_from_prompt(
            prompt=prompt,
            context=context,
            session=db
        )
        
        # Add user preferences
        if request.get("preferences"):
            ui_spec["preferences"] = request["preferences"]
        
        # Log UI generation for analytics
        await _log_ui_generation(db, user["id"], prompt, ui_spec)
        
        return ui_spec
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate UI: {str(e)}"
        )


@router.post("/enhance")
async def enhance_clinical_ui(
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Enhance an existing UI with natural language feedback.
    
    Request body:
    {
        "currentUi": { ... existing UI specification ... },
        "enhancement": "Make the vital signs panel larger and add trending",
        "context": {
            "patientId": "12345"
        }
    }
    """
    current_ui = request.get("currentUi")
    if not current_ui:
        raise HTTPException(status_code=400, detail="Current UI specification is required")
    
    enhancement = request.get("enhancement")
    if not enhancement:
        raise HTTPException(status_code=400, detail="Enhancement prompt is required")
    
    context = request.get("context", {})
    context["userId"] = user["id"]
    
    # Initialize service
    service = ClinicalCanvasService(request.get("fhirBaseUrl"))
    
    try:
        # Enhance UI
        enhanced_ui = await service.enhance_existing_ui(
            current_ui=current_ui,
            enhancement_prompt=enhancement,
            context=context
        )
        
        return enhanced_ui
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to enhance UI: {str(e)}"
        )


@router.post("/validate")
async def validate_ui_spec(
    ui_spec: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Validate a UI specification.
    
    Checks for:
    - Required fields
    - Valid component types
    - Data binding consistency
    - Action definitions
    """
    service = ClinicalCanvasService()
    
    is_valid, errors = await service.validate_ui_spec(ui_spec)
    
    return {
        "valid": is_valid,
        "errors": errors
    }


@router.get("/templates")
async def get_ui_templates(
    category: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get pre-built UI templates.
    
    Categories:
    - patient-summary: Patient overview dashboards
    - clinical-notes: Note-taking interfaces
    - order-entry: Order management UIs
    - results-review: Lab and imaging review
    - medication-management: Medication lists and ordering
    """
    templates = {
        "patient-summary": [
            {
                "id": "basic-patient-dashboard",
                "name": "Basic Patient Dashboard",
                "description": "Overview with vitals, problems, and medications",
                "prompt": "Show patient summary with vital signs, active problems, current medications, and recent labs",
                "thumbnail": "/templates/basic-dashboard.png"
            },
            {
                "id": "comprehensive-summary",
                "name": "Comprehensive Summary",
                "description": "Full patient overview including timeline",
                "prompt": "Create comprehensive patient view with demographics, allergies, vitals trending, problem list, medications, recent encounters, and lab results timeline",
                "thumbnail": "/templates/comprehensive.png"
            }
        ],
        "clinical-notes": [
            {
                "id": "soap-note",
                "name": "SOAP Note Interface",
                "description": "Structured SOAP note with smart features",
                "prompt": "Create SOAP note interface with patient context, vital signs display, and sections for subjective, objective, assessment, and plan",
                "thumbnail": "/templates/soap-note.png"
            },
            {
                "id": "progress-note",
                "name": "Progress Note",
                "description": "Daily progress note template",
                "prompt": "Generate progress note interface with problem-oriented sections, medication changes, and care plan updates",
                "thumbnail": "/templates/progress-note.png"
            }
        ],
        "order-entry": [
            {
                "id": "lab-orders",
                "name": "Lab Order Entry",
                "description": "Laboratory test ordering interface",
                "prompt": "Create lab ordering interface with common panels, custom tests, and order history",
                "thumbnail": "/templates/lab-orders.png"
            },
            {
                "id": "medication-orders",
                "name": "Medication Ordering",
                "description": "Prescription and medication ordering",
                "prompt": "Build medication ordering UI with drug search, dosing calculator, interaction checking, and current medications list",
                "thumbnail": "/templates/med-orders.png"
            }
        ],
        "results-review": [
            {
                "id": "lab-results-table",
                "name": "Lab Results Table",
                "description": "Tabular lab results with trends",
                "prompt": "Show laboratory results in organized table with reference ranges, abnormal highlighting, and trending indicators",
                "thumbnail": "/templates/lab-table.png"
            },
            {
                "id": "results-timeline",
                "name": "Results Timeline",
                "description": "Chronological results view",
                "prompt": "Display all test results on interactive timeline with filtering by type and abnormal values highlighted",
                "thumbnail": "/templates/timeline.png"
            }
        ],
        "medication-management": [
            {
                "id": "med-reconciliation",
                "name": "Medication Reconciliation",
                "description": "Admission/discharge reconciliation",
                "prompt": "Create medication reconciliation interface showing home meds, hospital meds, and discharge meds with actions for each",
                "thumbnail": "/templates/med-rec.png"
            },
            {
                "id": "med-administration",
                "name": "Medication Administration",
                "description": "MAR for medication administration",
                "prompt": "Build medication administration record with scheduled times, administration status, and documentation fields",
                "thumbnail": "/templates/mar.png"
            }
        ]
    }
    
    if category:
        return {
            "category": category,
            "templates": templates.get(category, [])
        }
    
    return {
        "categories": list(templates.keys()),
        "templates": templates
    }


@router.get("/components")
async def get_available_components(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get list of available UI components."""
    return {
        "components": [
            {
                "type": "PatientHeader",
                "description": "Patient demographics and alerts banner",
                "props": ["patientId", "showDemographics", "showAlerts"]
            },
            {
                "type": "VitalSignsPanel",
                "description": "Vital signs display with optional trends",
                "props": ["displayMode", "showTrends", "editable"]
            },
            {
                "type": "LabResultsDisplay",
                "description": "Laboratory results table or chart",
                "props": ["displayType", "groupByPanel", "showReferenceRanges", "highlightAbnormal"]
            },
            {
                "type": "MedicationList",
                "description": "Current medications with actions",
                "props": ["view", "showDosage", "showRefills", "allowDiscontinue", "allowRenew"]
            },
            {
                "type": "ProblemList",
                "description": "Active problems and diagnoses",
                "props": ["groupByCategory", "showOnsetDate", "allowEdit"]
            },
            {
                "type": "AllergyAlert",
                "description": "Allergy and intolerance warnings",
                "props": ["displayMode", "showReactions", "severity"]
            },
            {
                "type": "ClinicalTimeline",
                "description": "Chronological event timeline",
                "props": ["startDate", "endDate", "eventTypes", "interactive"]
            },
            {
                "type": "NoteEditor",
                "description": "Rich text clinical note editor",
                "props": ["noteType", "templates", "autoSave", "speechToText"]
            },
            {
                "type": "OrderPanel",
                "description": "Order entry and management",
                "props": ["orderTypes", "favorites", "protocols"]
            },
            {
                "type": "ImagingViewer",
                "description": "Medical imaging display",
                "props": ["studyId", "tools", "layout"]
            },
            {
                "type": "FlowSheet",
                "description": "Tabular data entry grid",
                "props": ["parameters", "timeInterval", "editable"]
            },
            {
                "type": "ActionBar",
                "description": "Action buttons and controls",
                "props": ["actions", "position", "sticky"]
            }
        ]
    }


@router.post("/examples")
async def get_example_prompts(
    context: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get example prompts based on current context.
    
    Provides contextual suggestions for what the user might want to see.
    """
    examples = []
    
    # Basic examples always available
    examples.extend([
        "Show me the patient summary",
        "Display vital signs from the last 24 hours",
        "Show all active medications",
        "Display recent lab results"
    ])
    
    # Context-specific examples
    if context.get("encounterId"):
        examples.extend([
            "Show all data from this encounter",
            "Create a discharge summary for this visit",
            "Display all orders placed during this encounter"
        ])
    
    if context.get("conditionId"):
        examples.extend([
            "Show all data related to this condition",
            "Display treatment history for this diagnosis",
            "Show relevant clinical guidelines"
        ])
    
    if context.get("medicationId"):
        examples.extend([
            "Show administration history for this medication",
            "Display dosing calculator",
            "Check for drug interactions"
        ])
    
    # Role-specific examples
    if user.get("role") == "physician":
        examples.extend([
            "Create a progress note interface",
            "Show decision support for current problems",
            "Display order sets for admission"
        ])
    elif user.get("role") == "nurse":
        examples.extend([
            "Show medication administration record",
            "Display nursing assessment form",
            "Create intake and output flowsheet"
        ])
    
    return {
        "examples": examples,
        "context": context
    }


async def _log_ui_generation(
    db: AsyncSession,
    user_id: str,
    prompt: str,
    ui_spec: Dict[str, Any]
):
    """Log UI generation for analytics and improvement."""
    from sqlalchemy import text
    import json
    import uuid
    
    query = text("""
        INSERT INTO emr.audit_logs (
            user_id, action, resource_type, details
        ) VALUES (
            :user_id, :action, :resource_type, :details
        )
    """)
    
    await db.execute(query, {
        "user_id": uuid.UUID(user_id),
        "action": "clinical_canvas_generate",
        "resource_type": "UISpecification",
        "details": json.dumps({
            "prompt": prompt,
            "componentCount": len(ui_spec.get("components", [])),
            "fhirResources": ui_spec.get("metadata", {}).get("fhirResources", [])
        })
    })
    
    await db.commit()