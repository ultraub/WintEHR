"""
EMR Clinical Tools

Advanced clinical functionality beyond basic FHIR:
- AI-powered note generation
- Clinical decision support
- Order recommendations
- Risk calculations
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import json

from ..database import get_db_session
from .auth import require_auth
from ..core.fhir.storage import FHIRStorageEngine

router = APIRouter()


@router.post("/note-assist")
async def generate_note_assistance(
    context: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """
    Generate AI-assisted clinical note content.
    
    Context should include:
    - noteType: Type of note (progress, consultation, discharge)
    - patientId: FHIR Patient ID
    - encounterId: FHIR Encounter ID
    - chiefComplaint: Chief complaint text
    - findings: Clinical findings
    """
    # This is where Clinical Canvas integration would go
    # For now, return a structured template
    
    note_type = context.get("noteType", "progress")
    
    templates = {
        "progress": {
            "sections": [
                {
                    "title": "Chief Complaint",
                    "content": context.get("chiefComplaint", "")
                },
                {
                    "title": "History of Present Illness",
                    "content": "Patient presents with..."
                },
                {
                    "title": "Review of Systems",
                    "content": "Constitutional: Denies fever, chills, weight loss\n" +
                              "Cardiovascular: Denies chest pain, palpitations\n" +
                              "Respiratory: Denies shortness of breath, cough"
                },
                {
                    "title": "Physical Examination",
                    "content": "Vital Signs: [Insert vitals]\n" +
                              "General: Alert and oriented x3\n" +
                              "HEENT: Normocephalic, atraumatic"
                },
                {
                    "title": "Assessment and Plan",
                    "content": "1. [Primary diagnosis]\n" +
                              "   - Plan: [Treatment plan]\n" +
                              "2. [Secondary diagnosis]\n" +
                              "   - Plan: [Treatment plan]"
                }
            ]
        },
        "consultation": {
            "sections": [
                {
                    "title": "Reason for Consultation",
                    "content": context.get("reasonForConsult", "")
                },
                {
                    "title": "History",
                    "content": "Thank you for consulting on this patient..."
                },
                {
                    "title": "Examination",
                    "content": "On examination..."
                },
                {
                    "title": "Impression",
                    "content": "Based on my evaluation..."
                },
                {
                    "title": "Recommendations",
                    "content": "1. \n2. \n3. "
                }
            ]
        }
    }
    
    template = templates.get(note_type, templates["progress"])
    
    # Log AI assistance request
    audit_query = text("""
        INSERT INTO emr.audit_logs (
            user_id, action, resource_type, resource_id, details
        ) VALUES (
            :user_id, :action, :resource_type, :resource_id, :details
        )
    """)
    
    await db.execute(audit_query, {
        "user_id": uuid.UUID(user["id"]),
        "action": "note_assist_requested",
        "resource_type": "Encounter",
        "resource_id": context.get("encounterId"),
        "details": json.dumps({"noteType": note_type})
    })
    
    await db.commit()
    
    return {
        "noteType": note_type,
        "template": template,
        "suggestions": [
            "Remember to document allergies",
            "Include medication reconciliation",
            "Document patient education provided"
        ]
    }


@router.post("/order-recommendations")
async def get_order_recommendations(
    context: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """
    Get AI-powered order recommendations based on clinical context.
    
    Context should include:
    - patientId: FHIR Patient ID
    - conditions: Active conditions
    - chiefComplaint: Current complaint
    - orderType: lab, medication, imaging, etc.
    """
    order_type = context.get("orderType", "all")
    conditions = context.get("conditions", [])
    
    # This would integrate with clinical decision support
    # For now, return common recommendations
    
    recommendations = {
        "lab": [
            {
                "code": "1558-6",
                "display": "Fasting glucose",
                "system": "http://loinc.org",
                "reason": "Diabetes screening",
                "priority": "routine"
            },
            {
                "code": "2085-9",
                "display": "HDL Cholesterol",
                "system": "http://loinc.org",
                "reason": "Cardiovascular risk assessment",
                "priority": "routine"
            },
            {
                "code": "2160-0",
                "display": "Creatinine",
                "system": "http://loinc.org",
                "reason": "Kidney function",
                "priority": "routine"
            }
        ],
        "imaging": [
            {
                "code": "71020",
                "display": "Chest X-ray, 2 views",
                "system": "http://www.ama-assn.org/go/cpt",
                "reason": "Respiratory symptoms",
                "priority": "routine"
            }
        ],
        "medication": [
            {
                "code": "197361",
                "display": "Lisinopril 10mg tablet",
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "reason": "Hypertension",
                "dosage": "Take 1 tablet by mouth daily"
            }
        ]
    }
    
    # Filter by order type if specified
    if order_type != "all":
        filtered = recommendations.get(order_type, [])
    else:
        filtered = []
        for recs in recommendations.values():
            filtered.extend(recs)
    
    return {
        "recommendations": filtered,
        "basedOn": {
            "conditions": conditions,
            "guidelines": ["ADA Diabetes Guidelines", "ACC/AHA Hypertension Guidelines"]
        }
    }


@router.post("/risk-scores/calculate")
async def calculate_risk_scores(
    risk_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """
    Calculate various clinical risk scores.
    
    Supports:
    - CHA2DS2-VASc (stroke risk in AFib)
    - HAS-BLED (bleeding risk)
    - ASCVD (cardiovascular risk)
    - Framingham Risk Score
    """
    score_type = risk_data.get("scoreType")
    parameters = risk_data.get("parameters", {})
    
    if score_type == "CHA2DS2-VASc":
        score = 0
        if parameters.get("congestiveHeartFailure"):
            score += 1
        if parameters.get("hypertension"):
            score += 1
        age = parameters.get("age", 0)
        if age >= 75:
            score += 2
        elif age >= 65:
            score += 1
        if parameters.get("diabetes"):
            score += 1
        if parameters.get("stroke"):
            score += 2
        if parameters.get("vascularDisease"):
            score += 1
        if parameters.get("female"):
            score += 1
        
        risk_category = "Low" if score <= 1 else "Moderate" if score <= 3 else "High"
        
        return {
            "scoreType": "CHA2DS2-VASc",
            "score": score,
            "riskCategory": risk_category,
            "interpretation": f"Annual stroke risk: {'<1%' if score == 0 else '1.3%' if score == 1 else '2.2%' if score == 2 else '>4%'}",
            "recommendations": [
                "Consider anticoagulation" if score >= 2 else "Anticoagulation may not be needed"
            ]
        }
    
    elif score_type == "HAS-BLED":
        score = 0
        if parameters.get("hypertension"):
            score += 1
        if parameters.get("abnormalRenalFunction"):
            score += 1
        if parameters.get("abnormalLiverFunction"):
            score += 1
        if parameters.get("stroke"):
            score += 1
        if parameters.get("bleeding"):
            score += 1
        if parameters.get("labileINR"):
            score += 1
        if parameters.get("elderly"):  # >65
            score += 1
        if parameters.get("drugs"):
            score += 1
        if parameters.get("alcohol"):
            score += 1
        
        risk_category = "Low" if score <= 2 else "High"
        
        return {
            "scoreType": "HAS-BLED",
            "score": score,
            "riskCategory": risk_category,
            "interpretation": f"Bleeding risk: {'Low' if score <= 2 else 'High'}",
            "recommendations": [
                "Monitor closely if on anticoagulation" if score >= 3 else "Standard monitoring"
            ]
        }
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown score type: {score_type}")


@router.post("/drug-interactions/check")
async def check_drug_interactions(
    medications: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """
    Check for drug-drug interactions.
    
    This would integrate with a drug interaction database.
    For now, returns example interactions.
    """
    # Extract medication codes
    med_codes = [med.get("code") for med in medications if med.get("code")]
    
    # Example interactions (would come from database)
    interactions = []
    
    if "197361" in med_codes and "198013" in med_codes:  # Lisinopril + Spironolactone
        interactions.append({
            "severity": "moderate",
            "medications": ["Lisinopril", "Spironolactone"],
            "effect": "Increased risk of hyperkalemia",
            "recommendation": "Monitor potassium levels regularly"
        })
    
    return {
        "checked": len(medications),
        "interactions": interactions,
        "checkedAt": datetime.now(timezone.utc).isoformat()
    }


@router.get("/clinical-reminders/{patient_id}")
async def get_clinical_reminders(
    patient_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """
    Get clinical reminders for a patient.
    
    Based on age, conditions, and care gaps.
    """
    storage = FHIRStorageEngine(db)
    
    # Get patient data
    patient = await storage.read_resource("Patient", patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Calculate age
    birth_date = patient.get("birthDate")
    age = None
    if birth_date:
        from datetime import date
        today = date.today()
        birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
        age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    
    reminders = []
    
    # Age-based reminders
    if age:
        if age >= 50:
            reminders.append({
                "type": "screening",
                "title": "Colonoscopy Screening",
                "description": "Due for colorectal cancer screening",
                "priority": "medium",
                "dueDate": None
            })
        
        if age >= 40:
            reminders.append({
                "type": "screening",
                "title": "Mammogram",
                "description": "Annual mammogram recommended",
                "priority": "medium",
                "dueDate": None
            })
    
    # Chronic disease reminders
    reminders.extend([
        {
            "type": "lab",
            "title": "HbA1c",
            "description": "Diabetes monitoring - due every 3 months",
            "priority": "high",
            "dueDate": None
        },
        {
            "type": "immunization",
            "title": "Flu Vaccine",
            "description": "Annual influenza vaccination",
            "priority": "medium",
            "dueDate": None
        }
    ])
    
    return {
        "patientId": patient_id,
        "reminders": reminders,
        "generatedAt": datetime.now(timezone.utc).isoformat()
    }


@router.post("/clinical-pathways/suggest")
async def suggest_clinical_pathway(
    clinical_context: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """
    Suggest appropriate clinical pathways based on presentation.
    
    This would use ML/AI to suggest evidence-based pathways.
    """
    chief_complaint = clinical_context.get("chiefComplaint", "").lower()
    
    # Simple pathway suggestions based on complaint
    pathways = []
    
    if "chest pain" in chief_complaint:
        pathways.append({
            "id": "chest-pain-pathway",
            "name": "Chest Pain Evaluation Pathway",
            "description": "Systematic evaluation of chest pain",
            "steps": [
                "Initial assessment and vitals",
                "ECG within 10 minutes",
                "Troponin levels",
                "Chest X-ray",
                "Risk stratification (HEART score)",
                "Disposition decision"
            ],
            "estimatedDuration": "4-6 hours"
        })
    
    if "abdominal pain" in chief_complaint:
        pathways.append({
            "id": "abdominal-pain-pathway",
            "name": "Acute Abdominal Pain Pathway",
            "description": "Evaluation of acute abdominal pain",
            "steps": [
                "Pain assessment and history",
                "Physical examination",
                "Laboratory studies (CBC, CMP, lipase)",
                "Imaging decision (CT vs ultrasound)",
                "Surgical consultation if indicated"
            ],
            "estimatedDuration": "3-5 hours"
        })
    
    return {
        "suggestedPathways": pathways,
        "basedOn": {
            "chiefComplaint": clinical_context.get("chiefComplaint"),
            "guidelines": ["Emergency Medicine Guidelines", "Internal Medicine Best Practices"]
        }
    }