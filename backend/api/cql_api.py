"""
CQL API endpoints for executing CQL measures and translating CQL to SQL
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import json

from database import get_db_session as get_db
from api.services.clinical.cql_engine import CQLTranslationEngine, SimplifiedCQLExecutor
from api.auth import get_current_user


router = APIRouter(prefix="/api/cql", tags=["CQL"])


class CQLExecutionRequest(BaseModel):
    cql_content: str
    patient_id: Optional[int] = None
    parameters: Optional[Dict[str, Any]] = None


class CQLTranslationRequest(BaseModel):
    cql_expression: str
    context: Optional[Dict[str, Any]] = None


class ValueSetRequest(BaseModel):
    name: str
    codes: List[str]
    description: Optional[str] = None


class SimplifiedMeasureRequest(BaseModel):
    measure_type: str  # "diabetes_control", "mammography_screening", etc.
    parameters: Optional[Dict[str, Any]] = None


@router.post("/execute")
async def execute_cql_measure(
    request: CQLExecutionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Execute a CQL measure and return results"""
    try:
        engine = CQLTranslationEngine(db)
        results = engine.execute_measure(
            request.cql_content,
            patient_id=request.patient_id
        )
        
        return {
            "success": True,
            "results": results,
            "executed_by": current_user["username"],
            "patient_specific": request.patient_id is not None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/translate")
async def translate_cql_to_sql(
    request: CQLTranslationRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Translate CQL expression to SQL (for debugging/learning)"""
    try:
        engine = CQLTranslationEngine(db)
        parsed = engine.parse_cql(request.cql_expression)
        
        # For demonstration, show the parsed structure
        # In a full implementation, this would show actual SQL
        return {
            "success": True,
            "parsed": parsed,
            "message": "CQL parsed successfully. SQL translation requires specific context."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/parse")
async def parse_cql(
    request: CQLExecutionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Parse CQL content and return structured representation"""
    try:
        # Create a dummy session for parsing (no DB access needed)
        from database import SessionLocal
        db = SessionLocal()
        engine = CQLTranslationEngine(db)
        parsed = engine.parse_cql(request.cql_content)
        db.close()
        
        return {
            "success": True,
            "parsed": parsed
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/value-sets")
async def get_value_sets(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all available value sets"""
    engine = CQLTranslationEngine(db)
    return {
        "value_sets": engine.value_sets,
        "count": len(engine.value_sets)
    }


@router.post("/value-sets")
async def create_value_set(
    request: ValueSetRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create or update a value set"""
    engine = CQLTranslationEngine(db)
    engine.add_value_set(request.name, request.codes)
    
    return {
        "success": True,
        "message": f"Value set '{request.name}' created/updated with {len(request.codes)} codes"
    }


@router.post("/execute-simplified")
async def execute_simplified_measure(
    request: SimplifiedMeasureRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Execute pre-built simplified measures that work with current schema"""
    try:
        executor = SimplifiedCQLExecutor(db)
        
        if request.measure_type == "diabetes_control":
            results = executor.execute_diabetes_control_measure()
        elif request.measure_type in ["mammography", "colonoscopy"]:
            results = executor.execute_preventive_screening_measure(request.measure_type)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown measure type: {request.measure_type}")
        
        return {
            "success": True,
            "results": results,
            "executed_by": current_user["username"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/validate")
async def validate_cql(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Validate uploaded CQL file"""
    try:
        content = await file.read()
        cql_content = content.decode('utf-8')
        
        # Create a dummy session for parsing
        from database import SessionLocal
        db = SessionLocal()
        engine = CQLTranslationEngine(db)
        parsed = engine.parse_cql(cql_content)
        db.close()
        
        # Basic validation
        issues = []
        if not parsed["library"]:
            issues.append("Missing library declaration")
        if not parsed["using"]:
            issues.append("Missing using statement (should include FHIR)")
        if not parsed["definitions"]:
            issues.append("No definitions found")
        
        # Check for required measure components
        definition_names = [d["name"] for d in parsed["definitions"]]
        required_components = ["InitialPopulation", "Denominator", "Numerator"]
        missing_components = [c for c in required_components if c not in definition_names]
        
        if missing_components:
            issues.append(f"Missing required measure components: {', '.join(missing_components)}")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "parsed": parsed,
            "filename": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/examples")
async def get_cql_examples(
    current_user: dict = Depends(get_current_user)
):
    """Get example CQL measures"""
    examples = [
        {
            "name": "Diabetes HbA1c Control",
            "description": "Patients with diabetes who have HbA1c < 9%",
            "filename": "DiabetesHbA1cControl.cql",
            "content": """library DiabetesHbA1cControl version '1.0.0'

using FHIR version '4.0.1'

context Patient

define "Initial Population":
  exists([Condition: "Diabetes"])

define "Denominator":
  "Initial Population"

define "Numerator":
  exists(
    [Observation: "HbA1c"] A
      where A.effectiveDateTime during "Measurement Period"
        and A.value < 9 '%'
  )"""
        },
        {
            "name": "Preventive Care - Mammography",
            "description": "Women 50-74 who had mammography in last 2 years",
            "filename": "MammographyScreening.cql",
            "content": """library MammographyScreening version '1.0.0'

using FHIR version '4.0.1'

context Patient

define "Initial Population":
  Patient.gender = 'female'
    and AgeInYears() between 50 and 74

define "Denominator":
  "Initial Population"

define "Numerator":
  exists(
    [Observation: "Mammography"] M
      where M.effectiveDateTime during "Measurement Period"
        or M.effectiveDateTime 2 years or less before end of "Measurement Period"
  )"""
        },
        {
            "name": "Medication Adherence",
            "description": "Patients on chronic medications with good adherence",
            "filename": "MedicationAdherence.cql",
            "content": """library MedicationAdherence version '1.0.0'

using FHIR version '4.0.1'

context Patient

define "Initial Population":
  exists([MedicationRequest: "Chronic Medications"])

define "Denominator":
  "Initial Population"

define "Numerator":
  "PDC Score" >= 0.8

define "PDC Score":
  // Proportion of Days Covered calculation
  // Simplified for demonstration
  0.85"""
        }
    ]
    
    return {
        "examples": examples,
        "count": len(examples)
    }


# Add helper endpoint for testing
@router.get("/test-connection")
async def test_cql_connection(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Test CQL engine connection and basic functionality"""
    try:
        engine = CQLTranslationEngine(db)
        
        # Test basic query
        patient_count = db.query(engine.session.query(Patient).count()).scalar()
        
        return {
            "status": "connected",
            "patient_count": patient_count,
            "value_sets_loaded": len(engine.value_sets),
            "engine_version": "1.0.0"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))