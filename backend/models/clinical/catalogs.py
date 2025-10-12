"""
Clinical catalog models for medications, labs, and other orderable items
"""
from sqlalchemy import Column, String, Text, Boolean, Float, Integer, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid


class MedicationCatalog(Base):
    """Medication catalog for CPOE ordering"""
    __tablename__ = 'medication_catalog'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Basic medication info
    generic_name = Column(String, nullable=False, index=True)
    brand_name = Column(String, index=True)
    strength = Column(String)  # e.g., "10mg", "5mg/ml"
    dosage_form = Column(String)  # tablet, capsule, injection, etc.
    
    # Drug classification
    drug_class = Column(String, index=True)  # therapeutic class
    therapeutic_category = Column(String)
    
    # Coding systems
    rxnorm_code = Column(String, index=True)
    ndc_code = Column(String)
    
    # Clinical information
    route = Column(String)  # oral, IV, IM, etc.
    frequency_options = Column(JSON)  # ["once daily", "twice daily", "three times daily", "four times daily", "as needed"]
    standard_doses = Column(JSON)  # ["5mg", "10mg", "20mg"]
    
    # Safety and constraints
    max_daily_dose = Column(String)
    contraindications = Column(Text)
    warnings = Column(Text)
    pregnancy_category = Column(String)
    
    # Administrative
    is_controlled_substance = Column(Boolean, default=False)
    controlled_substance_schedule = Column(String)  # I, II, III, IV, V
    requires_authorization = Column(Boolean, default=False)
    is_formulary = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<MedicationCatalog(name='{self.generic_name}', strength='{self.strength}')>"


class LabTestCatalog(Base):
    """Laboratory test catalog for CPOE ordering"""
    __tablename__ = 'lab_test_catalog'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Basic test info
    test_name = Column(String, nullable=False, index=True)
    test_code = Column(String, unique=True, nullable=False, index=True)
    test_description = Column(Text)
    
    # Classification
    test_category = Column(String, index=True)  # Chemistry, Hematology, Microbiology, etc.
    test_panel = Column(String)  # Basic Metabolic Panel, Complete Blood Count, etc.
    specimen_type = Column(String)  # Blood, Urine, Stool, etc.
    
    # Coding systems
    loinc_code = Column(String, index=True)
    cpt_code = Column(String)
    
    # Test specifications
    reference_range_text = Column(String)
    reference_range_low = Column(Float)
    reference_range_high = Column(Float)
    reference_units = Column(String)
    
    # Collection requirements
    fasting_required = Column(Boolean, default=False)
    special_instructions = Column(Text)
    container_type = Column(String)  # Red top, Lavender top, etc.
    
    # Timing and frequency
    typical_turnaround_time = Column(String)  # "2-4 hours", "1-2 days"
    stat_available = Column(Boolean, default=True)
    
    # Administrative
    is_active = Column(Boolean, default=True)
    requires_authorization = Column(Boolean, default=False)
    cost = Column(Float)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<LabTestCatalog(name='{self.test_name}', code='{self.test_code}')>"


class ImagingStudyCatalog(Base):
    """Imaging study catalog for CPOE ordering"""
    __tablename__ = 'imaging_study_catalog'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Basic study info
    study_name = Column(String, nullable=False, index=True)
    study_code = Column(String, unique=True, nullable=False, index=True)
    study_description = Column(Text)
    
    # Classification
    modality = Column(String, index=True)  # X-Ray, CT, MRI, Ultrasound, etc.
    body_part = Column(String, index=True)  # Chest, Abdomen, Head, etc.
    study_type = Column(String)  # With contrast, Without contrast, etc.
    
    # Coding systems
    cpt_code = Column(String)
    snomed_code = Column(String)
    
    # Clinical requirements
    contrast_required = Column(Boolean, default=False)
    prep_instructions = Column(Text)
    contraindications = Column(Text)
    
    # Administrative
    typical_duration = Column(String)  # "15 minutes", "45 minutes"
    typical_turnaround_time = Column(String)
    requires_authorization = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ImagingStudyCatalog(name='{self.study_name}', modality='{self.modality}')>"


class ClinicalOrderSet(Base):
    """Predefined order sets for common clinical scenarios"""
    __tablename__ = 'clinical_order_sets'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Order set info
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    clinical_indication = Column(String, index=True)
    
    # Order set contents (JSON structure with medications, labs, imaging)
    orders = Column(JSON, nullable=False)
    # Example structure:
    # {
    #   "medications": [
    #     {"medication_id": "uuid", "dose": "10mg", "frequency": "once daily", "duration": "7 days"},
    #     ...
    #   ],
    #   "lab_tests": [
    #     {"test_id": "uuid", "frequency": "daily", "duration": "3 days"},
    #     ...
    #   ],
    #   "imaging": [
    #     {"study_id": "uuid", "urgency": "routine"},
    #     ...
    #   ]
    # }
    
    # Administrative
    specialty = Column(String, index=True)  # Cardiology, Emergency, etc.
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    
    # Metadata
    created_by = Column(String)  # Provider ID
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ClinicalOrderSet(name='{self.name}', indication='{self.clinical_indication}')>"