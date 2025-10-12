"""Clinical documentation models for EMR system"""
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import uuid


class ClinicalNote(Base):
    """Clinical documentation model supporting SOAP format and versioning"""
    __tablename__ = 'clinical_notes'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), nullable=False)
    encounter_id = Column(String, ForeignKey('encounters.id'))
    note_type = Column(String, nullable=False)  # progress, consult, procedure, discharge
    template_id = Column(String, ForeignKey('note_templates.id'))
    
    # SOAP structure
    subjective = Column(Text)
    objective = Column(Text)
    assessment = Column(Text)
    plan = Column(Text)
    
    # Additional sections
    chief_complaint = Column(Text)
    history_present_illness = Column(Text)
    review_of_systems = Column(JSON)  # Structured ROS data
    physical_exam = Column(JSON)      # Structured PE data
    
    # Metadata
    author_id = Column(String, ForeignKey('providers.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    signed_at = Column(DateTime)
    status = Column(String, default='draft')  # draft, pending_signature, signed, amended
    
    # Versioning
    version = Column(Integer, default=1)
    parent_note_id = Column(String, ForeignKey('clinical_notes.id'))
    
    # Co-signature
    requires_cosignature = Column(Boolean, default=False)
    cosigner_id = Column(String, ForeignKey('providers.id'))
    cosigned_at = Column(DateTime)
    
    # Relationships - disable to avoid model registry conflicts
    # patient = relationship("Patient")
    # encounter = relationship("Encounter")
    # author = relationship("Provider", foreign_keys=[author_id])
    # cosigner = relationship("Provider", foreign_keys=[cosigner_id])
    amendments = relationship("ClinicalNote", backref="parent_note", remote_side=[id])
    template = relationship("NoteTemplate", overlaps="notes")


class NoteTemplate(Base):
    """Templates for clinical documentation"""
    __tablename__ = 'note_templates'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    specialty = Column(String)
    note_type = Column(String)
    content = Column(JSON)  # Template structure with sections and defaults
    smart_phrases = Column(JSON)  # Key-value pairs for text expansion
    created_by = Column(String, ForeignKey('providers.id'))
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - disable to avoid model registry conflicts
    # creator = relationship("Provider")
    notes = relationship("ClinicalNote", overlaps="template")