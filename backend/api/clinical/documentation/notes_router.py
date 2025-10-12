"""Clinical notes API endpoints - FHIR DocumentReference based"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from services.fhir_client_config import (
    search_resources,
    get_resource,
    create_resource,
    update_resource,
    get_fhir_server
)
from fhirclient.models.documentreference import DocumentReference
from fhirclient.models.practitioner import Practitioner

from .fhir_converters import (
    convert_note_to_document_reference,
    convert_document_reference_to_note_response,
    update_document_reference_status
)

router = APIRouter(prefix="/clinical/notes", tags=["clinical-notes"])

# Simple response schema
class Response(BaseModel):
    message: str
    data: Optional[dict] = None


# Pydantic schemas
class ClinicalNoteBase(BaseModel):
    patient_id: str
    encounter_id: Optional[str] = None
    note_type: str
    template_id: Optional[str] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    chief_complaint: Optional[str] = None
    history_present_illness: Optional[str] = None
    review_of_systems: Optional[dict] = None
    physical_exam: Optional[dict] = None


class ClinicalNoteCreate(ClinicalNoteBase):
    requires_cosignature: Optional[bool] = False
    cosigner_id: Optional[str] = None


class ClinicalNoteUpdate(BaseModel):
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    chief_complaint: Optional[str] = None
    history_present_illness: Optional[str] = None
    review_of_systems: Optional[dict] = None
    physical_exam: Optional[dict] = None
    status: Optional[str] = None


class ClinicalNoteResponse(ClinicalNoteBase):
    id: str
    author_id: str
    created_at: datetime
    updated_at: datetime
    signed_at: Optional[datetime] = None
    status: str
    version: int
    parent_note_id: Optional[str] = None
    requires_cosignature: bool
    cosigner_id: Optional[str] = None
    cosigned_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NoteTemplateCreate(BaseModel):
    name: str
    specialty: Optional[str] = None
    note_type: Optional[str] = None
    content: Optional[dict] = None
    smart_phrases: Optional[dict] = None


class NoteTemplateResponse(NoteTemplateCreate):
    id: str
    created_by: Optional[str] = None
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def get_current_user_id() -> str:
    """Get current authenticated user ID - using demo user for now"""
    # TODO: Replace with proper JWT auth from api.auth.service
    # For now, return demo practitioner ID
    practitioners = search_resources("Practitioner", {"_count": "1"})
    if practitioners:
        return practitioners[0].id
    raise HTTPException(status_code=401, detail="No authenticated user found")


def dict_to_document_reference(doc_ref_dict: dict) -> DocumentReference:
    """Convert dictionary to fhirclient DocumentReference object"""
    return DocumentReference(doc_ref_dict)


@router.post("/", response_model=ClinicalNoteResponse)
async def create_note(
    note: ClinicalNoteCreate,
    current_user_id: str = Depends(get_current_user_id)
):
    """Create a new clinical note as FHIR DocumentReference"""
    # Convert API note to FHIR DocumentReference dict
    doc_ref_dict = convert_note_to_document_reference(
        note.dict(),
        current_user_id
    )

    # Create fhirclient DocumentReference object
    doc_ref_obj = dict_to_document_reference(doc_ref_dict)

    # Create FHIR resource
    created_resource = create_resource(doc_ref_obj)

    if not created_resource:
        raise HTTPException(status_code=500, detail="Failed to create note")

    # Convert back to API response format
    return convert_document_reference_to_note_response(created_resource.as_json())


@router.get("/{note_id}", response_model=ClinicalNoteResponse)
async def get_note(note_id: str):
    """Get a specific clinical note from FHIR DocumentReference"""
    doc_ref = get_resource("DocumentReference", note_id)

    if not doc_ref:
        raise HTTPException(status_code=404, detail="Note not found")

    return convert_document_reference_to_note_response(doc_ref.as_json())


@router.get("/", response_model=List[ClinicalNoteResponse])
async def get_notes(
    patient_id: Optional[str] = Query(None),
    encounter_id: Optional[str] = Query(None),
    note_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    author_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get clinical notes with filters using FHIR search"""
    # Build FHIR search parameters
    search_params = {
        "_count": str(limit),
        "_sort": "-date"  # Most recent first
    }

    if patient_id:
        search_params["patient"] = f"Patient/{patient_id}" if not patient_id.startswith("Patient/") else patient_id

    if encounter_id:
        search_params["encounter"] = f"Encounter/{encounter_id}" if not encounter_id.startswith("Encounter/") else encounter_id

    # Map note_type to LOINC code
    note_type_codes = {
        "progress_note": "11506-3",
        "admission_note": "34849-6",
        "discharge_note": "28655-9",
        "consultation_note": "34140-6",
        "procedure_note": "28570-0",
        "addendum": "81218-0",
        "history_physical": "34117-2"
    }
    if note_type and note_type in note_type_codes:
        search_params["type"] = note_type_codes[note_type]

    # Map status to FHIR docStatus
    status_map = {
        'draft': 'preliminary',
        'signed': 'final',
        'pending_signature': 'preliminary',
        'amended': 'amended'
    }
    if status and status in status_map:
        search_params["status"] = "current"  # DocumentReference status
        # Note: docStatus is stored in the resource, not searchable by default

    if author_id:
        search_params["author"] = f"Practitioner/{author_id}" if not author_id.startswith("Practitioner/") else author_id

    # Search DocumentReference resources
    resources = search_resources("DocumentReference", search_params)

    # Convert to API response format
    notes = []
    for resource in resources:
        note_response = convert_document_reference_to_note_response(resource.as_json())

        # Filter by status if provided (since docStatus isn't searchable)
        if status and note_response.get('status') != status:
            continue

        notes.append(note_response)

    # Handle pagination offset (FHIR search doesn't support offset directly)
    if skip > 0:
        notes = notes[skip:]

    return notes[:limit]


@router.put("/{note_id}", response_model=ClinicalNoteResponse)
async def update_note(
    note_id: str,
    note_update: ClinicalNoteUpdate,
    current_user_id: str = Depends(get_current_user_id)
):
    """Update a clinical note (FHIR DocumentReference)"""
    # Get existing note
    doc_ref = get_resource("DocumentReference", note_id)

    if not doc_ref:
        raise HTTPException(status_code=404, detail="Note not found")

    doc_ref_dict = doc_ref.as_json()

    # Check if user can edit
    author_ref = doc_ref_dict.get('author', [{}])[0].get('reference', '')
    author_id = author_ref.split('/')[-1] if author_ref else None

    if doc_ref_dict.get('docStatus') == 'final' and author_id != current_user_id:
        raise HTTPException(status_code=403, detail="Cannot edit signed note")

    # Update fields - need to reconstruct content
    update_data = note_update.dict(exclude_unset=True)

    # Get current note data
    current_note = convert_document_reference_to_note_response(doc_ref_dict)

    # Merge updates
    for field, value in update_data.items():
        current_note[field] = value

    # Create updated DocumentReference dict
    updated_doc_ref_dict = convert_note_to_document_reference(
        current_note,
        author_id
    )

    # Preserve ID and increment version
    updated_doc_ref_dict['id'] = note_id

    # Create fhirclient object and update
    updated_doc_ref_obj = dict_to_document_reference(updated_doc_ref_dict)
    result = update_resource(updated_doc_ref_obj)

    if not result:
        raise HTTPException(status_code=500, detail="Failed to update note")

    # Retrieve updated resource
    final_doc_ref = get_resource("DocumentReference", note_id)

    return convert_document_reference_to_note_response(final_doc_ref.as_json())


@router.put("/{note_id}/sign")
async def sign_note(
    note_id: str,
    current_user_id: str = Depends(get_current_user_id)
):
    """Sign a clinical note (update FHIR DocumentReference status)"""
    # Get existing note
    doc_ref = get_resource("DocumentReference", note_id)

    if not doc_ref:
        raise HTTPException(status_code=404, detail="Note not found")

    doc_ref_dict = doc_ref.as_json()

    # Get author and cosigner from extensions
    author_ref = doc_ref_dict.get('author', [{}])[0].get('reference', '')
    author_id = author_ref.split('/')[-1] if author_ref else None

    cosigner_id = None
    for ext in doc_ref_dict.get('extension', []):
        if ext.get('url') == "http://wintehr.org/fhir/StructureDefinition/cosigner":
            cosigner_ref = ext.get('valueReference', {}).get('reference', '')
            cosigner_id = cosigner_ref.split('/')[-1] if cosigner_ref else None

    # Check authorization
    if author_id != current_user_id and cosigner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to sign this note")

    # Determine requires_cosignature
    requires_cosignature = False
    for ext in doc_ref_dict.get('extension', []):
        if ext.get('url') == "http://wintehr.org/fhir/StructureDefinition/requires-cosignature":
            requires_cosignature = ext.get('valueBoolean', False)

    # Update status based on who's signing
    if author_id == current_user_id:
        new_status = "signed" if not requires_cosignature else "pending_signature"
        doc_ref_dict = update_document_reference_status(doc_ref_dict, new_status, current_user_id)
    elif cosigner_id == current_user_id:
        # Check if already signed by author
        already_signed = doc_ref_dict.get('docStatus') == 'final' or \
                        any(ext.get('url') == "http://wintehr.org/fhir/StructureDefinition/signed-by"
                            for ext in doc_ref_dict.get('extension', []))

        if already_signed or requires_cosignature:
            doc_ref_dict = update_document_reference_status(doc_ref_dict, "signed", current_user_id)

            # Add cosigner signature extension
            if 'extension' not in doc_ref_dict:
                doc_ref_dict['extension'] = []

            doc_ref_dict['extension'].append({
                "url": "http://wintehr.org/fhir/StructureDefinition/cosigned-at",
                "valueDateTime": datetime.utcnow().isoformat()
            })

    # Update resource
    updated_doc_ref_obj = dict_to_document_reference(doc_ref_dict)
    result = update_resource(updated_doc_ref_obj)

    if not result:
        raise HTTPException(status_code=500, detail="Failed to sign note")

    # Get final status
    final_doc_ref = get_resource("DocumentReference", note_id)
    final_note = convert_document_reference_to_note_response(final_doc_ref.as_json())

    return {"message": "Note signed successfully", "status": final_note.get('status')}


@router.post("/{note_id}/addendum", response_model=ClinicalNoteResponse)
async def create_addendum(
    note_id: str,
    addendum: ClinicalNoteCreate,
    current_user_id: str = Depends(get_current_user_id)
):
    """Create an addendum to an existing note (FHIR DocumentReference with relatesTo)"""
    # Get parent note
    parent_doc_ref = get_resource("DocumentReference", note_id)

    if not parent_doc_ref:
        raise HTTPException(status_code=404, detail="Parent note not found")

    parent_dict = parent_doc_ref.as_json()

    # Check parent note is signed
    if parent_dict.get('docStatus') != 'final':
        raise HTTPException(status_code=400, detail="Can only add addendum to signed notes")

    # Create addendum data
    addendum_data = addendum.dict()
    addendum_data['note_type'] = 'addendum'  # Override note_type
    addendum_data['parent_note_id'] = note_id  # Link to parent

    # Convert to FHIR DocumentReference dict
    addendum_doc_ref_dict = convert_note_to_document_reference(
        addendum_data,
        current_user_id
    )

    # Create fhirclient object
    addendum_doc_ref_obj = dict_to_document_reference(addendum_doc_ref_dict)

    # Create addendum resource
    created_resource = create_resource(addendum_doc_ref_obj)

    if not created_resource:
        raise HTTPException(status_code=500, detail="Failed to create addendum")

    return convert_document_reference_to_note_response(created_resource.as_json())


# Template endpoints
# TODO: Migrate to FHIR resources
# NoteTemplate could be stored as:
# - FHIR Basic resource with custom profile
# - FHIR PlanDefinition resource
# - FHIR Questionnaire resource
# For now, templates are not migrated - need decision on FHIR resource type

@router.get("/templates/", response_model=List[NoteTemplateResponse])
async def get_templates(
    specialty: Optional[str] = Query(None),
    note_type: Optional[str] = Query(None)
):
    """
    Get available note templates

    TODO: Migrate to FHIR-based template storage
    """
    # Placeholder - templates not yet migrated
    raise HTTPException(
        status_code=501,
        detail="Template endpoints not yet migrated to FHIR. Use static templates or wait for migration."
    )


@router.post("/templates/", response_model=NoteTemplateResponse)
async def create_template(
    template: NoteTemplateCreate
):
    """
    Create a new note template

    TODO: Migrate to FHIR-based template storage
    """
    # Placeholder - templates not yet migrated
    raise HTTPException(
        status_code=501,
        detail="Template endpoints not yet migrated to FHIR. Use static templates or wait for migration."
    )
