"""Order management models for CPOE system"""
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import uuid


class Order(Base):
    """Base order model for all order types"""
    __tablename__ = 'orders'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey('patients.id'), nullable=False)
    encounter_id = Column(String, ForeignKey('encounters.id'))
    ordering_provider_id = Column(String, ForeignKey('providers.id'), nullable=False)
    
    order_type = Column(String, nullable=False)  # medication, laboratory, imaging, procedure
    order_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    priority = Column(String, default='routine')  # routine, urgent, stat
    status = Column(String, default='pending')  # pending, active, completed, discontinued, cancelled
    
    # Clinical information
    indication = Column(Text)
    clinical_information = Column(Text)
    
    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    discontinued_at = Column(DateTime)
    discontinued_by_id = Column(String, ForeignKey('providers.id'))
    discontinue_reason = Column(Text)
    
    # Relationships - disable to avoid model registry conflicts
    # patient = relationship("Patient")
    # encounter = relationship("Encounter")
    # ordering_provider = relationship("Provider", foreign_keys=[ordering_provider_id])
    # discontinued_by = relationship("Provider", foreign_keys=[discontinued_by_id])


class MedicationOrder(Base):
    """Medication order details"""
    __tablename__ = 'medication_orders'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey('orders.id'), nullable=False)
    
    # Medication details
    medication_id = Column(String)
    medication_name = Column(String, nullable=False)
    medication_code = Column(String)  # RxNorm code
    
    # Dosing
    dose = Column(Float)
    dose_unit = Column(String)
    route = Column(String)
    frequency = Column(String)
    duration = Column(String)
    
    # PRN information
    prn = Column(Boolean, default=False)
    prn_reason = Column(String)
    max_dose_per_period = Column(String)
    
    # Prescribing details
    dispense_quantity = Column(Integer)
    dispense_unit = Column(String)
    refills = Column(Integer, default=0)
    generic_allowed = Column(Boolean, default=True)
    pharmacy_notes = Column(Text)
    
    # Safety checks
    override_alerts = Column(JSON)  # Document overridden alerts
    
    # Relationships - disable to avoid model registry conflicts
    # order = relationship("Order", backref="medication_order")


class LaboratoryOrder(Base):
    """Laboratory order details"""
    __tablename__ = 'laboratory_orders'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey('orders.id'), nullable=False)
    
    # Test details
    test_name = Column(String, nullable=False)
    test_code = Column(String)  # LOINC code
    specimen_type = Column(String)
    specimen_source = Column(String)
    
    # Collection instructions
    collection_datetime = Column(DateTime)
    fasting_required = Column(Boolean, default=False)
    special_instructions = Column(Text)
    
    # Relationships - disable to avoid model registry conflicts
    # order = relationship("Order", backref="laboratory_order")


class ImagingOrder(Base):
    """Imaging order details"""
    __tablename__ = 'imaging_orders'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey('orders.id'), nullable=False)
    
    # Imaging details
    modality = Column(String, nullable=False)  # CT, MRI, X-ray, US, etc.
    body_site = Column(String)
    laterality = Column(String)  # left, right, bilateral
    contrast = Column(Boolean, default=False)
    
    # Clinical context
    reason_for_exam = Column(Text)
    relevant_clinical_info = Column(Text)
    transport_mode = Column(String)  # ambulatory, wheelchair, stretcher
    
    # Scheduling
    preferred_datetime = Column(DateTime)
    
    # Relationships - disable to avoid model registry conflicts
    # order = relationship("Order", backref="imaging_order")


class OrderSet(Base):
    """Predefined order sets for common scenarios"""
    __tablename__ = 'order_sets'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String)  # admission, procedure, condition-specific
    specialty = Column(String)
    
    # Order templates
    orders = Column(JSON)  # Array of order templates
    
    # Metadata
    created_by = Column(String, ForeignKey('providers.id'))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - disable to avoid model registry conflicts
    # creator = relationship("Provider")