"""Clinical notes API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from database import get_db_session as get_db
from models.clinical.notes import ClinicalNote, NoteTemplate
from models.models import Provider

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


def get_current_user(db: Session = Depends(get_db)) -> Provider:
    """Mock function to get current user - replace with real auth"""
    # For now, return first provider
    provider = db.query(Provider).first()
    if not provider:
        raise HTTPException(status_code=404, detail="No provider found")
    return provider


@router.post("/", response_model=ClinicalNoteResponse)
async def create_note(
    note: ClinicalNoteCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new clinical note"""
    db_note = ClinicalNote(
        **note.dict(exclude={'requires_cosignature', 'cosigner_id'}),
        author_id=current_user.id,
        requires_cosignature=note.requires_cosignature,
        cosigner_id=note.cosigner_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


@router.get("/{note_id}", response_model=ClinicalNoteResponse)
async def get_note(
    note_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific clinical note"""
    note = db.query(ClinicalNote).filter(
        ClinicalNote.id == note_id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.get("/", response_model=List[ClinicalNoteResponse])
async def get_notes(
    patient_id: Optional[str] = Query(None),
    encounter_id: Optional[str] = Query(None),
    note_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    author_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get clinical notes with filters"""
    query = db.query(ClinicalNote)
    
    if patient_id:
        query = query.filter(ClinicalNote.patient_id == patient_id)
    if encounter_id:
        query = query.filter(ClinicalNote.encounter_id == encounter_id)
    if note_type:
        query = query.filter(ClinicalNote.note_type == note_type)
    if status:
        query = query.filter(ClinicalNote.status == status)
    if author_id:
        query = query.filter(ClinicalNote.author_id == author_id)
    
    return query.order_by(ClinicalNote.created_at.desc()).offset(skip).limit(limit).all()


@router.put("/{note_id}", response_model=ClinicalNoteResponse)
async def update_note(
    note_id: str,
    note_update: ClinicalNoteUpdate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Update a clinical note"""
    note = db.query(ClinicalNote).filter(
        ClinicalNote.id == note_id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Check if user can edit
    if note.status == "signed" and note.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit signed note")
    
    # Update fields
    update_data = note_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)
    
    note.updated_at = datetime.utcnow()
    note.version += 1
    
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}/sign")
async def sign_note(
    note_id: str,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Sign a clinical note"""
    note = db.query(ClinicalNote).filter(
        ClinicalNote.id == note_id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note.author_id != current_user.id and note.cosigner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to sign this note")
    
    if note.author_id == current_user.id:
        note.status = "signed" if not note.requires_cosignature else "pending_signature"
        note.signed_at = datetime.utcnow()
    elif note.cosigner_id == current_user.id:
        note.cosigned_at = datetime.utcnow()
        if note.signed_at:
            note.status = "signed"
    
    db.commit()
    return {"message": "Note signed successfully", "status": note.status}


@router.post("/{note_id}/addendum", response_model=ClinicalNoteResponse)
async def create_addendum(
    note_id: str,
    addendum: ClinicalNoteCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create an addendum to an existing note"""
    parent_note = db.query(ClinicalNote).filter(
        ClinicalNote.id == note_id
    ).first()
    
    if not parent_note:
        raise HTTPException(status_code=404, detail="Parent note not found")
    
    if parent_note.status != "signed":
        raise HTTPException(status_code=400, detail="Can only add addendum to signed notes")
    
    addendum_data = addendum.dict()
    addendum_data['note_type'] = 'addendum'  # Override note_type
    
    db_addendum = ClinicalNote(
        **addendum_data,
        author_id=current_user.id,
        parent_note_id=note_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(db_addendum)
    db.commit()
    db.refresh(db_addendum)
    return db_addendum


# Template endpoints
@router.get("/templates/", response_model=List[NoteTemplateResponse])
async def get_templates(
    specialty: Optional[str] = Query(None),
    note_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get available note templates"""
    query = db.query(NoteTemplate).filter(NoteTemplate.is_active == True)
    
    if specialty:
        query = query.filter(NoteTemplate.specialty == specialty)
    if note_type:
        query = query.filter(NoteTemplate.note_type == note_type)
    
    return query.all()


@router.post("/templates/", response_model=NoteTemplateResponse)
async def create_template(
    template: NoteTemplateCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new note template"""
    db_template = NoteTemplate(
        **template.dict(),
        created_by=current_user.id,
        is_system=False,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template