"""Simple session management without complex relationships"""
from sqlalchemy import Column, String, DateTime, Boolean
from database import Base
from datetime import datetime
import uuid

class UserSession(Base):
    """Simple user session management"""
    __tablename__ = 'user_sessions'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_id = Column(String, nullable=False)  # References providers.id
    
    # Session details
    session_token = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_activity = Column(DateTime, default=datetime.utcnow)
    
    # Session metadata
    ip_address = Column(String)
    user_agent = Column(String)
    is_active = Column(Boolean, default=True)

class PatientProviderAssignment(Base):
    """Simple patient-provider assignments"""
    __tablename__ = 'patient_provider_assignments'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, nullable=False)  # References patients.id
    provider_id = Column(String, nullable=False)  # References providers.id
    
    # Assignment details
    assignment_type = Column(String, nullable=False, default='primary')
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Notes
    assignment_notes = Column(String)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    assigned_by_id = Column(String)  # References providers.id