"""Clinical task and inbox management models"""
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import uuid


class ClinicalTask(Base):
    """Clinical tasks and to-do items"""
    __tablename__ = 'clinical_tasks'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'))
    
    # Task details
    task_type = Column(String)  # result_review, medication_refill, message, general
    title = Column(String, nullable=False)
    description = Column(Text)
    priority = Column(String, default='medium')  # low, medium, high, urgent
    
    # Assignment
    assigned_to_id = Column(String, ForeignKey('providers.id'))
    assigned_by_id = Column(String, ForeignKey('providers.id'))
    assigned_at = Column(DateTime, default=datetime.utcnow)
    
    # Status tracking
    status = Column(String, default='pending')  # pending, in_progress, completed, cancelled
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    completed_by_id = Column(String, ForeignKey('providers.id'))
    
    # Related data
    related_order_id = Column(String, ForeignKey('orders.id'))
    related_result_id = Column(String, ForeignKey('diagnostic_reports.id'))
    related_note_id = Column(String, ForeignKey('clinical_notes.id'))
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - disable to avoid model registry conflicts
    # patient = relationship("Patient")
    # assigned_to = relationship("Provider", foreign_keys=[assigned_to_id])
    # assigned_by = relationship("Provider", foreign_keys=[assigned_by_id])
    # completed_by = relationship("Provider", foreign_keys=[completed_by_id])
    # related_order = relationship("Order")
    # related_result = relationship("DiagnosticReport")
    # related_note = relationship("ClinicalNote")


class InboxItem(Base):
    """Clinical inbox items for provider workflow"""
    __tablename__ = 'inbox_items'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipient_id = Column(String, ForeignKey('providers.id'), nullable=False)
    patient_id = Column(String, ForeignKey('patients.id'))
    
    # Item details
    category = Column(String)  # results, medications, messages, tasks
    item_type = Column(String)  # lab_result, imaging_result, refill_request, etc.
    title = Column(String, nullable=False)
    preview = Column(Text)
    
    # Priority and status
    priority = Column(String, default='medium')  # low, medium, high, urgent
    status = Column(String, default='unread')  # unread, read, acknowledged, forwarded
    is_abnormal = Column(Boolean, default=False)
    requires_action = Column(Boolean, default=False)
    
    # Related data
    source_id = Column(String)  # ID of the source object
    source_type = Column(String)  # Type of source (order, result, task, etc.)
    
    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime)
    acknowledged_at = Column(DateTime)
    acknowledged_by_id = Column(String, ForeignKey('providers.id'))
    
    # Forwarding
    forwarded_from_id = Column(String, ForeignKey('providers.id'))
    forwarded_at = Column(DateTime)
    forward_note = Column(Text)
    
    # Relationships - disable to avoid model registry conflicts
    # recipient = relationship("Provider", foreign_keys=[recipient_id])
    # patient = relationship("Patient")
    # acknowledged_by = relationship("Provider", foreign_keys=[acknowledged_by_id])
    # forwarded_from = relationship("Provider", foreign_keys=[forwarded_from_id])


class CareTeamMember(Base):
    """Care team assignments for patients"""
    __tablename__ = 'care_team_members'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), nullable=False)
    provider_id = Column(String, ForeignKey('providers.id'), nullable=False)
    
    # Role and period
    role = Column(String)  # attending, primary_nurse, consultant, resident
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Coverage
    is_on_call = Column(Boolean, default=False)
    coverage_notes = Column(Text)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(String, ForeignKey('providers.id'))
    
    # Relationships - disable to avoid model registry conflicts
    # patient = relationship("Patient")
    # provider = relationship("Provider", foreign_keys=[provider_id])
    # created_by = relationship("Provider", foreign_keys=[created_by_id])


class PatientList(Base):
    """Custom patient lists for providers"""
    __tablename__ = 'patient_lists'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    owner_id = Column(String, ForeignKey('providers.id'), nullable=False)
    
    # List type
    list_type = Column(String)  # personal, team, unit, custom
    is_shared = Column(Boolean, default=False)
    
    # Criteria for dynamic lists
    criteria = Column(JSON)  # Query criteria for dynamic lists
    is_dynamic = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - disable to avoid model registry conflicts
    # owner = relationship("Provider")
    patients = relationship("PatientListMembership", overlaps="patient_list")


class PatientListMembership(Base):
    """Membership of patients in lists"""
    __tablename__ = 'patient_list_memberships'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_list_id = Column(String, ForeignKey('patient_lists.id'), nullable=False)
    patient_id = Column(String, ForeignKey('patients.id'), nullable=False)
    
    # Metadata
    added_at = Column(DateTime, default=datetime.utcnow)
    added_by_id = Column(String, ForeignKey('providers.id'))
    
    # Relationships - disable to avoid model registry conflicts
    patient_list = relationship("PatientList", overlaps="patients")
    # patient = relationship("Patient")
    # added_by = relationship("Provider")