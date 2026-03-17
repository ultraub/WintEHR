"""
Questionnaires & Forms API endpoints.

Provides questionnaire management for the WintEHR educational EHR system.
All FHIR Questionnaire and QuestionnaireResponse resources are stored in
HAPI FHIR via HAPIFHIRClient. The backend adds seeding of standard clinical
questionnaires (PHQ-9, GAD-7, Patient Intake) and convenience endpoints
for listing and completing forms.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
import logging

from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/questionnaires", tags=["Questionnaires"])


# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------

class QuestionnaireResponseCreate(BaseModel):
    """Request body for saving a completed QuestionnaireResponse."""
    resourceType: str = Field("QuestionnaireResponse", description="FHIR resource type")
    status: str = Field("completed", description="Response status")
    questionnaire: str = Field(..., description="Reference to the Questionnaire (e.g. 'Questionnaire/abc')")
    subject: Dict[str, Any] = Field(..., description="Patient reference")
    encounter: Optional[Dict[str, Any]] = Field(None, description="Encounter reference")
    authored: Optional[str] = Field(None, description="ISO-8601 datetime when completed")
    item: List[Dict[str, Any]] = Field(default_factory=list, description="Answered items")


class SeedResult(BaseModel):
    """Result of the seed operation."""
    seeded: List[str] = Field(default_factory=list, description="Titles of seeded questionnaires")
    skipped: List[str] = Field(default_factory=list, description="Titles of already-existing questionnaires")
    errors: List[str] = Field(default_factory=list, description="Any errors encountered")


# ---------------------------------------------------------------------------
# Standard questionnaire definitions
# ---------------------------------------------------------------------------

PHQ9_ANSWER_OPTIONS = [
    {"valueCoding": {"system": "http://loinc.org/vs/LL358-3", "code": "0", "display": "Not at all"}},
    {"valueCoding": {"system": "http://loinc.org/vs/LL358-3", "code": "1", "display": "Several days"}},
    {"valueCoding": {"system": "http://loinc.org/vs/LL358-3", "code": "2", "display": "More than half the days"}},
    {"valueCoding": {"system": "http://loinc.org/vs/LL358-3", "code": "3", "display": "Nearly every day"}},
]

PHQ9_ITEMS = [
    {"linkId": "phq9-1", "text": "Little interest or pleasure in doing things", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
    {"linkId": "phq9-2", "text": "Feeling down, depressed, or hopeless", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
    {"linkId": "phq9-3", "text": "Trouble falling or staying asleep, or sleeping too much", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
    {"linkId": "phq9-4", "text": "Feeling tired or having little energy", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
    {"linkId": "phq9-5", "text": "Poor appetite or overeating", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
    {"linkId": "phq9-6", "text": "Feeling bad about yourself — or that you are a failure or have let yourself or your family down", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
    {"linkId": "phq9-7", "text": "Trouble concentrating on things, such as reading the newspaper or watching television", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
    {"linkId": "phq9-8", "text": "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
    {"linkId": "phq9-9", "text": "Thoughts that you would be better off dead or of hurting yourself in some way", "type": "choice", "answerOption": PHQ9_ANSWER_OPTIONS},
]

PHQ9_QUESTIONNAIRE = {
    "resourceType": "Questionnaire",
    "status": "active",
    "name": "PHQ9",
    "title": "PHQ-9 Patient Health Questionnaire",
    "description": "A 9-item depression screening tool. Each item is scored 0-3, yielding a total score of 0-27.",
    "purpose": "Depression screening and severity assessment",
    "code": [{"system": "http://loinc.org", "code": "44249-1", "display": "PHQ-9 quick depression assessment panel"}],
    "subjectType": ["Patient"],
    "item": PHQ9_ITEMS,
}

GAD7_ANSWER_OPTIONS = [
    {"valueCoding": {"system": "http://loinc.org/vs/LL358-3", "code": "0", "display": "Not at all"}},
    {"valueCoding": {"system": "http://loinc.org/vs/LL358-3", "code": "1", "display": "Several days"}},
    {"valueCoding": {"system": "http://loinc.org/vs/LL358-3", "code": "2", "display": "More than half the days"}},
    {"valueCoding": {"system": "http://loinc.org/vs/LL358-3", "code": "3", "display": "Nearly every day"}},
]

GAD7_ITEMS = [
    {"linkId": "gad7-1", "text": "Feeling nervous, anxious, or on edge", "type": "choice", "answerOption": GAD7_ANSWER_OPTIONS},
    {"linkId": "gad7-2", "text": "Not being able to stop or control worrying", "type": "choice", "answerOption": GAD7_ANSWER_OPTIONS},
    {"linkId": "gad7-3", "text": "Worrying too much about different things", "type": "choice", "answerOption": GAD7_ANSWER_OPTIONS},
    {"linkId": "gad7-4", "text": "Trouble relaxing", "type": "choice", "answerOption": GAD7_ANSWER_OPTIONS},
    {"linkId": "gad7-5", "text": "Being so restless that it is hard to sit still", "type": "choice", "answerOption": GAD7_ANSWER_OPTIONS},
    {"linkId": "gad7-6", "text": "Becoming easily annoyed or irritable", "type": "choice", "answerOption": GAD7_ANSWER_OPTIONS},
    {"linkId": "gad7-7", "text": "Feeling afraid, as if something awful might happen", "type": "choice", "answerOption": GAD7_ANSWER_OPTIONS},
]

GAD7_QUESTIONNAIRE = {
    "resourceType": "Questionnaire",
    "status": "active",
    "name": "GAD7",
    "title": "GAD-7 Generalized Anxiety Disorder Scale",
    "description": "A 7-item anxiety screening tool. Each item is scored 0-3, yielding a total score of 0-21.",
    "purpose": "Anxiety screening and severity assessment",
    "code": [{"system": "http://loinc.org", "code": "69737-5", "display": "GAD-7 Generalized anxiety disorder 7 item"}],
    "subjectType": ["Patient"],
    "item": GAD7_ITEMS,
}

PAIN_SCALE_OPTIONS = [
    {"valueCoding": {"code": str(i), "display": str(i)}} for i in range(11)
]

INTAKE_FORM_ITEMS = [
    {"linkId": "intake-1", "text": "Full Legal Name", "type": "string"},
    {"linkId": "intake-2", "text": "Reason for Visit", "type": "string"},
    {"linkId": "intake-3", "text": "Are you currently taking any medications?", "type": "boolean"},
    {"linkId": "intake-4", "text": "If yes, please list current medications", "type": "text"},
    {"linkId": "intake-5", "text": "Known allergies (describe)", "type": "text"},
    {"linkId": "intake-6", "text": "Current pain level (0-10)", "type": "choice", "answerOption": PAIN_SCALE_OPTIONS},
    {"linkId": "intake-7", "text": "Date of last physical exam", "type": "string"},
    {"linkId": "intake-8", "text": "Do you use tobacco products?", "type": "boolean"},
    {"linkId": "intake-9", "text": "Do you consume alcohol?", "type": "boolean"},
    {"linkId": "intake-10", "text": "Additional concerns or comments", "type": "text"},
]

INTAKE_QUESTIONNAIRE = {
    "resourceType": "Questionnaire",
    "status": "active",
    "name": "PatientIntake",
    "title": "Patient Intake Form",
    "description": "Standard new patient intake form collecting demographics, medications, allergies, and chief complaint.",
    "purpose": "New patient registration and initial assessment",
    "code": [{"system": "http://wintehr.edu/questionnaire", "code": "patient-intake", "display": "Patient Intake Form"}],
    "subjectType": ["Patient"],
    "item": INTAKE_FORM_ITEMS,
}

STANDARD_QUESTIONNAIRES = [PHQ9_QUESTIONNAIRE, GAD7_QUESTIONNAIRE, INTAKE_QUESTIONNAIRE]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_questionnaires(
    status: Optional[str] = Query("active", description="Filter by status (active, draft, retired)"),
    _count: int = Query(50, ge=1, le=200, description="Maximum results"),
):
    """
    List available questionnaires from HAPI FHIR.

    Returns a simplified list of Questionnaire resources with id, title,
    status, code, and item count.
    """
    try:
        hapi = HAPIFHIRClient()
        params: Dict[str, Any] = {"_count": str(_count), "_sort": "-_lastUpdated"}
        if status:
            params["status"] = status

        bundle = await hapi.search("Questionnaire", params)
        entries = bundle.get("entry", [])

        questionnaires = []
        for entry in entries:
            resource = entry.get("resource", {})
            questionnaires.append({
                "id": resource.get("id"),
                "title": resource.get("title", resource.get("name", "Untitled")),
                "status": resource.get("status"),
                "description": resource.get("description"),
                "code": resource.get("code", []),
                "itemCount": len(resource.get("item", [])),
                "item": resource.get("item", []),
            })

        return {
            "total": bundle.get("total", len(questionnaires)),
            "questionnaires": questionnaires,
        }

    except Exception as e:
        logger.error(f"Error listing questionnaires: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list questionnaires: {str(e)}")


@router.post("/seed", response_model=SeedResult)
async def seed_standard_questionnaires():
    """
    Seed standard clinical questionnaires into HAPI FHIR.

    Creates PHQ-9, GAD-7, and Patient Intake Form questionnaires if they
    do not already exist (matched by name). Idempotent: re-running will
    skip questionnaires that have already been seeded.
    """
    hapi = HAPIFHIRClient()
    result = SeedResult()

    for questionnaire in STANDARD_QUESTIONNAIRES:
        title = questionnaire.get("title", "Unknown")
        name = questionnaire.get("name", "")

        try:
            # Check if questionnaire already exists by name
            existing = await hapi.search("Questionnaire", {"name": name, "_count": "1"})
            existing_entries = existing.get("entry", [])

            if existing_entries:
                result.skipped.append(title)
                logger.info(f"Questionnaire already exists, skipping: {title}")
                continue

            # Create the questionnaire
            created = await hapi.create("Questionnaire", questionnaire)
            created_id = created.get("id", "unknown")
            result.seeded.append(f"{title} (id: {created_id})")
            logger.info(f"Seeded questionnaire: {title} with id {created_id}")

        except Exception as e:
            error_msg = f"Failed to seed {title}: {str(e)}"
            result.errors.append(error_msg)
            logger.error(error_msg)

    return result


# NOTE: /responses endpoints are defined BEFORE /{questionnaire_id} so that
# FastAPI does not match "responses" as a path parameter.

@router.get("/responses")
async def list_questionnaire_responses(
    patient: str = Query(..., description="Patient ID (e.g. 'Patient/abc' or just 'abc')"),
    questionnaire: Optional[str] = Query(None, description="Filter by questionnaire reference"),
    _count: int = Query(50, ge=1, le=200, description="Maximum results"),
):
    """
    Get completed QuestionnaireResponse resources for a patient.

    Returns responses with computed scores for standardised instruments
    (PHQ-9, GAD-7).
    """
    try:
        hapi = HAPIFHIRClient()

        # Normalise patient reference
        patient_ref = patient if patient.startswith("Patient/") else f"Patient/{patient}"

        params: Dict[str, Any] = {
            "subject": patient_ref,
            "_count": str(_count),
            "_sort": "-authored",
        }
        if questionnaire:
            params["questionnaire"] = questionnaire

        bundle = await hapi.search("QuestionnaireResponse", params)
        entries = bundle.get("entry", [])

        responses = []
        for entry in entries:
            resource = entry.get("resource", {})
            score = _compute_score(resource)
            responses.append({
                "id": resource.get("id"),
                "questionnaire": resource.get("questionnaire"),
                "status": resource.get("status"),
                "authored": resource.get("authored"),
                "item": resource.get("item", []),
                "score": score,
            })

        return {
            "total": bundle.get("total", len(responses)),
            "responses": responses,
        }

    except Exception as e:
        logger.error(f"Error listing questionnaire responses: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list responses: {str(e)}")


@router.post("/responses")
async def create_questionnaire_response(body: QuestionnaireResponseCreate):
    """
    Save a completed QuestionnaireResponse to HAPI FHIR.

    The frontend submits answered items; this endpoint persists the
    QuestionnaireResponse resource and returns the created resource
    including the server-assigned ID.
    """
    try:
        hapi = HAPIFHIRClient()

        resource = body.model_dump(exclude_none=True)
        # Ensure resourceType is set
        resource["resourceType"] = "QuestionnaireResponse"

        created = await hapi.create("QuestionnaireResponse", resource)
        logger.info(
            f"Created QuestionnaireResponse {created.get('id')} "
            f"for questionnaire {body.questionnaire}"
        )
        return created

    except Exception as e:
        logger.error(f"Error creating questionnaire response: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save response: {str(e)}")


@router.get("/{questionnaire_id}")
async def get_questionnaire(questionnaire_id: str):
    """
    Get a specific questionnaire by ID.

    Returns the full FHIR Questionnaire resource including all items
    and answer options.
    """
    try:
        hapi = HAPIFHIRClient()
        resource = await hapi.read("Questionnaire", questionnaire_id)

        if not resource or resource.get("resourceType") != "Questionnaire":
            raise HTTPException(status_code=404, detail=f"Questionnaire {questionnaire_id} not found")

        return resource

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reading questionnaire {questionnaire_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read questionnaire: {str(e)}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_score(response: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Compute a total score for standardised questionnaires (PHQ-9, GAD-7).

    Returns None if the questionnaire is not a scored instrument, or if
    item answers do not contain numeric codes.
    """
    questionnaire_ref = (response.get("questionnaire") or "").lower()
    items = response.get("item", [])

    # Determine if this is a scored instrument by checking linkId prefixes
    is_phq9 = any(item.get("linkId", "").startswith("phq9-") for item in items)
    is_gad7 = any(item.get("linkId", "").startswith("gad7-") for item in items)

    if not is_phq9 and not is_gad7:
        return None

    total = 0
    answered = 0

    for item in items:
        answers = item.get("answer", [])
        if not answers:
            continue
        answer = answers[0]
        coding = answer.get("valueCoding", {})
        code = coding.get("code")
        if code is not None:
            try:
                total += int(code)
                answered += 1
            except (ValueError, TypeError):
                continue

    if answered == 0:
        return None

    instrument = "PHQ-9" if is_phq9 else "GAD-7"
    max_score = 27 if is_phq9 else 21
    severity = _severity_label(instrument, total)

    return {
        "instrument": instrument,
        "total": total,
        "maxScore": max_score,
        "answered": answered,
        "severity": severity,
    }


def _severity_label(instrument: str, score: int) -> str:
    """Return a clinical severity label for a screening score."""
    if instrument == "PHQ-9":
        if score <= 4:
            return "Minimal"
        elif score <= 9:
            return "Mild"
        elif score <= 14:
            return "Moderate"
        elif score <= 19:
            return "Moderately Severe"
        else:
            return "Severe"
    elif instrument == "GAD-7":
        if score <= 4:
            return "Minimal"
        elif score <= 9:
            return "Mild"
        elif score <= 14:
            return "Moderate"
        else:
            return "Severe"
    return "Unknown"
