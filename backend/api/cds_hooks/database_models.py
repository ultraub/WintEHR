"""
CDS Hooks Database Models
SQLAlchemy models for CDS Hooks 2.0 data persistence
"""

from sqlalchemy import Column, String, Text, JSON, Boolean, DateTime, ForeignKey, ARRAY, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

from database import Base


class CDSService(Base):
    """CDS Service configuration and metadata"""
    __tablename__ = "cds_services"
    __table_args__ = {"schema": "cds"}
    
    id = Column(String, primary_key=True)
    hook = Column(String, nullable=False)
    title = Column(String)
    description = Column(Text, nullable=False)
    enabled = Column(Boolean, default=True)
    prefetch = Column(JSON)  # Prefetch templates
    usage_requirements = Column(Text)
    
    # Service implementation details
    implementation_type = Column(String, default="config")  # config, code, external
    implementation_code = Column(Text)  # For code-based services
    implementation_url = Column(String)  # For external services
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String)
    version = Column(String, default="1.0")
    
    # Relationships
    feedback = relationship("CDSFeedback", back_populates="service", cascade="all, delete-orphan")
    executions = relationship("CDSExecution", back_populates="service", cascade="all, delete-orphan")


class CDSFeedback(Base):
    """Feedback tracking for CDS card outcomes"""
    __tablename__ = "cds_feedback"
    __table_args__ = {"schema": "cds"}
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(String, ForeignKey("cds.cds_services.id"), nullable=False)
    card_uuid = Column(String, nullable=False)
    outcome = Column(String, nullable=False)  # accepted, overridden
    outcome_timestamp = Column(DateTime(timezone=True), nullable=False)
    
    # Outcome-specific fields
    accepted_suggestions = Column(ARRAY(String))  # List of suggestion UUIDs
    override_reason_key = Column(String)
    override_reason_comment = Column(Text)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    patient_id = Column(String)  # Optional patient tracking
    user_id = Column(String)  # Optional user tracking
    
    # Relationships
    service = relationship("CDSService", back_populates="feedback")


class CDSExecution(Base):
    """Track CDS service executions for audit and analytics"""
    __tablename__ = "cds_executions"
    __table_args__ = {"schema": "cds"}
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(String, ForeignKey("cds.cds_services.id"), nullable=False)
    hook_instance = Column(String, nullable=False)  # UUID from request
    hook = Column(String, nullable=False)
    
    # Request details
    patient_id = Column(String)
    user_id = Column(String)
    encounter_id = Column(String)
    fhir_server = Column(String)
    
    # Response details
    cards_returned = Column(Integer, default=0)
    system_actions_returned = Column(Integer, default=0)
    execution_time_ms = Column(Integer)
    
    # Full request/response for debugging (optional)
    request_context = Column(JSON)
    response_cards = Column(JSON)
    response_system_actions = Column(JSON)
    
    # Metadata
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    error_message = Column(Text)  # If execution failed
    
    # Relationships
    service = relationship("CDSService", back_populates="executions")


class CDSCardTemplate(Base):
    """Templates for common CDS card patterns"""
    __tablename__ = "cds_card_templates"
    __table_args__ = {"schema": "cds"}
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String)  # medication, preventive-care, lab, etc.
    
    # Template structure
    card_template = Column(JSON, nullable=False)
    override_reasons = Column(JSON)  # Available override reasons
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String)
    is_public = Column(Boolean, default=True)


class CDSOverrideReason(Base):
    """Predefined override reasons for services"""
    __tablename__ = "cds_override_reasons"
    __table_args__ = {"schema": "cds"}
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(String, ForeignKey("cds.cds_services.id"), nullable=False)
    key = Column(String, nullable=False)  # Unique key for the reason
    display = Column(String, nullable=False)  # Human-readable text
    code = Column(String)  # Optional code
    system = Column(String)  # Optional code system
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime(timezone=True))