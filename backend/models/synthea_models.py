"""
SQLAlchemy models for Synthea data
Designed to store comprehensive FHIR R4 data from Synthea
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Date, Boolean, Text, JSON, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from database.database import Base
import uuid
from datetime import datetime

class Patient(Base):
    """Patient model with Synthea fields"""
    __tablename__ = "patients"
    
    # Primary key
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Synthea identifiers
    synthea_id = Column(String, unique=True, index=True)  # From Synthea Id field
    mrn = Column(String, unique=True, index=True)
    ssn = Column(String)
    drivers = Column(String)
    passport = Column(String)
    
    # Demographics
    prefix = Column(String)
    first_name = Column(String, nullable=False, index=True)
    middle_name = Column(String)
    last_name = Column(String, nullable=False, index=True)
    suffix = Column(String)
    maiden_name = Column(String)
    
    # Personal information
    date_of_birth = Column(Date, nullable=False)
    date_of_death = Column(Date)
    gender = Column(String, nullable=False)
    marital_status = Column(String)
    race = Column(String)
    ethnicity = Column(String)
    
    # Contact information
    address = Column(String)
    city = Column(String)
    state = Column(String)
    county = Column(String)
    zip_code = Column(String)
    lat = Column(Float)  # Latitude
    lon = Column(Float)  # Longitude
    
    # Additional demographics
    phone = Column(String)
    email = Column(String)
    language = Column(String)
    
    # Insurance information
    healthcare_expenses = Column(Float)
    healthcare_coverage = Column(Float)
    insurance_name = Column(String)
    insurance_id = Column(String)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    encounters = relationship("Encounter", back_populates="patient", cascade="all, delete-orphan")
    conditions = relationship("Condition", back_populates="patient", cascade="all, delete-orphan")
    medications = relationship("Medication", back_populates="patient", cascade="all, delete-orphan")
    observations = relationship("Observation", back_populates="patient", cascade="all, delete-orphan")
    procedures = relationship("Procedure", back_populates="patient", cascade="all, delete-orphan")
    immunizations = relationship("Immunization", back_populates="patient", cascade="all, delete-orphan")
    allergies = relationship("Allergy", back_populates="patient", cascade="all, delete-orphan")
    careplans = relationship("CarePlan", back_populates="patient", cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="patient", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="patient", cascade="all, delete-orphan")
    diagnostic_reports = relationship("DiagnosticReport", back_populates="patient", cascade="all, delete-orphan")
    imaging_studies = relationship("ImagingStudy", back_populates="patient", cascade="all, delete-orphan")
    dicom_studies = relationship("DICOMStudy", back_populates="patient", cascade="all, delete-orphan")

class Provider(Base):
    """Provider/Practitioner model"""
    __tablename__ = "providers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    npi = Column(String, unique=True)
    
    # Name
    first_name = Column(String)
    last_name = Column(String)
    prefix = Column(String)
    suffix = Column(String)
    
    # Professional info
    specialty = Column(String)
    organization_id = Column(String, ForeignKey("organizations.id"))
    
    # Contact
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone = Column(String)
    email = Column(String)
    
    # Additional fields
    gender = Column(String)
    active = Column(Boolean, default=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="providers")
    encounters = relationship("Encounter", back_populates="provider")

class Organization(Base):
    """Healthcare organization model"""
    __tablename__ = "organizations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    name = Column(String, nullable=False)
    type = Column(String)  # Hospital, Clinic, etc.
    
    # Contact
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone = Column(String)
    
    # Additional fields
    active = Column(Boolean, default=True)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    providers = relationship("Provider", back_populates="organization")
    encounters = relationship("Encounter", back_populates="organization")
    locations = relationship("Location", back_populates="organization")

class Location(Base):
    """Physical location model (rooms, departments, buildings)"""
    __tablename__ = "locations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    name = Column(String, nullable=False)
    type = Column(String)  # Room, Ward, Department, Building, etc.
    description = Column(String)
    
    # Managing Organization
    organization_id = Column(String, ForeignKey("organizations.id"))
    
    # Physical location
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    
    # Position (GPS)
    latitude = Column(Float)
    longitude = Column(Float)
    
    # Status
    status = Column(String, default="active")  # active, suspended, inactive
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = relationship("Organization", back_populates="locations")
    encounters = relationship("Encounter", back_populates="location")

class Encounter(Base):
    """Encounter model with Synthea fields"""
    __tablename__ = "encounters"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    provider_id = Column(String, ForeignKey("providers.id"))
    organization_id = Column(String, ForeignKey("organizations.id"))
    location_id = Column(String, ForeignKey("locations.id"))
    payer_id = Column(String, ForeignKey("payers.id"))
    
    # Encounter details
    encounter_date = Column(DateTime, nullable=False, index=True)
    encounter_end = Column(DateTime)
    encounter_type = Column(String, nullable=False)  # ambulatory, emergency, inpatient, etc.
    encounter_class = Column(String)  # FHIR class
    
    # Clinical information
    reason_code = Column(String)  # SNOMED code
    reason_description = Column(String)
    chief_complaint = Column(Text)
    notes = Column(Text)
    
    # Costs
    base_encounter_cost = Column(Float)
    total_claim_cost = Column(Float)
    payer_coverage = Column(Float)
    
    # Status
    status = Column(String, default="finished")  # planned, in-progress, finished, cancelled
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", back_populates="encounters")
    provider = relationship("Provider", back_populates="encounters")
    organization = relationship("Organization", back_populates="encounters")
    location = relationship("Location", back_populates="encounters")
    payer = relationship("Payer", back_populates="encounters")
    conditions = relationship("Condition", back_populates="encounter")
    medications = relationship("Medication", back_populates="encounter")
    observations = relationship("Observation", back_populates="encounter")
    procedures = relationship("Procedure", back_populates="encounter")
    claims = relationship("Claim", back_populates="encounter")
    diagnostic_reports = relationship("DiagnosticReport", back_populates="encounter")

class Condition(Base):
    """Condition/Diagnosis model"""
    __tablename__ = "conditions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Condition details
    onset_date = Column(DateTime, nullable=False)
    abatement_date = Column(DateTime)
    
    # Coding
    snomed_code = Column(String, index=True)  # SNOMED CT code
    icd10_code = Column(String, index=True)   # For compatibility
    description = Column(String, nullable=False)
    
    # Status
    clinical_status = Column(String, default="active")  # active, resolved, inactive
    verification_status = Column(String, default="confirmed")
    severity = Column(String)
    
    # System fields
    recorded_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", back_populates="conditions")
    encounter = relationship("Encounter", back_populates="conditions")

class Medication(Base):
    """Medication model"""
    __tablename__ = "medications"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    prescriber_id = Column(String, ForeignKey("providers.id"))
    payer_id = Column(String, ForeignKey("payers.id"))
    
    # Medication details
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    
    # Coding
    rxnorm_code = Column(String, index=True)
    medication_name = Column(String, nullable=False)
    
    # Dosage
    dosage = Column(String)
    dosage_value = Column(Float)
    dosage_unit = Column(String)
    frequency = Column(String)
    route = Column(String)
    
    # Reason
    reason_code = Column(String)  # SNOMED code
    reason_description = Column(String)
    
    # Cost
    base_cost = Column(Float)
    payer_coverage = Column(Float)
    
    # Status
    status = Column(String, default="active")  # active, completed, stopped
    
    # Supply
    dispense_quantity = Column(Float)
    days_supply = Column(Integer)
    
    # Relationships
    patient = relationship("Patient", back_populates="medications")
    encounter = relationship("Encounter", back_populates="medications")
    prescriber = relationship("Provider")
    payer = relationship("Payer", back_populates="medications")

class Observation(Base):
    """Observation model (vitals, labs, etc.)"""
    __tablename__ = "observations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Observation details
    observation_date = Column(DateTime, nullable=False, index=True)
    observation_type = Column(String, index=True)  # vital-signs, laboratory, etc.
    category = Column(String)  # More specific category
    
    # Coding
    loinc_code = Column(String, index=True)  # LOINC code
    display = Column(String, nullable=False)
    
    # Value (handling different types)
    value = Column(String)  # String representation
    value_quantity = Column(Float)  # Numeric value
    value_unit = Column(String)
    value_code = Column(String)  # For coded values
    
    # Interpretation
    interpretation = Column(String)  # Normal, High, Low, etc.
    reference_range_low = Column(Float)
    reference_range_high = Column(Float)
    
    # Additional fields
    status = Column(String, default="final")
    
    # Relationships
    patient = relationship("Patient", back_populates="observations")
    encounter = relationship("Encounter", back_populates="observations")

class Procedure(Base):
    """Procedure model"""
    __tablename__ = "procedures"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Procedure details
    procedure_date = Column(DateTime, nullable=False, index=True)
    
    # Coding
    snomed_code = Column(String, index=True)
    description = Column(String, nullable=False)
    
    # Reason
    reason_code = Column(String)
    reason_description = Column(String)
    
    # Cost
    base_cost = Column(Float)
    
    # Additional fields
    status = Column(String, default="completed")
    outcome = Column(String)
    
    # Relationships
    patient = relationship("Patient", back_populates="procedures")
    encounter = relationship("Encounter", back_populates="procedures")

class Immunization(Base):
    """Immunization model"""
    __tablename__ = "immunizations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Immunization details
    immunization_date = Column(DateTime, nullable=False, index=True)
    
    # Coding
    cvx_code = Column(String, index=True)  # CVX vaccine code
    description = Column(String, nullable=False)
    
    # Cost
    base_cost = Column(Float)
    
    # Additional fields
    status = Column(String, default="completed")
    dose_quantity = Column(Float)
    
    # Relationships
    patient = relationship("Patient", back_populates="immunizations")
    encounter = relationship("Encounter")

class Allergy(Base):
    """Allergy model"""
    __tablename__ = "allergies"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Allergy details
    onset_date = Column(DateTime)
    resolution_date = Column(DateTime)
    
    # Coding
    snomed_code = Column(String, index=True)
    description = Column(String, nullable=False)
    
    # Type and severity
    allergy_type = Column(String)  # food, medication, environment
    category = Column(String)      # food, medication, biologic, environment
    severity = Column(String)      # mild, moderate, severe
    
    # Reactions
    reaction = Column(String)
    
    # Status
    clinical_status = Column(String, default="active")
    verification_status = Column(String, default="confirmed")
    
    # Relationships
    patient = relationship("Patient", back_populates="allergies")
    encounter = relationship("Encounter")

class CarePlan(Base):
    """Care Plan model"""
    __tablename__ = "careplans"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Care plan details
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    
    # Coding
    snomed_code = Column(String, index=True)
    description = Column(String, nullable=False)
    
    # Reason
    reason_code = Column(String)
    reason_description = Column(String)
    
    # Status
    status = Column(String, default="active")
    intent = Column(String, default="plan")
    
    # Activities
    activities = Column(JSON)  # Store as JSON array
    
    # Relationships
    patient = relationship("Patient", back_populates="careplans")
    encounter = relationship("Encounter")

class Payer(Base):
    """Insurance Payer model"""
    __tablename__ = "payers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    name = Column(String, nullable=False)
    type = Column(String)  # private, government, etc.
    
    # Coverage details
    ownership = Column(String)
    
    # Relationships
    encounters = relationship("Encounter", back_populates="payer")
    medications = relationship("Medication", back_populates="payer")
    claims = relationship("Claim", back_populates="payer")

class Claim(Base):
    """Insurance Claim model"""
    __tablename__ = "claims"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    payer_id = Column(String, ForeignKey("payers.id"))
    
    # Claim details
    claim_date = Column(DateTime)
    
    # Amounts
    total_cost = Column(Float)
    covered_cost = Column(Float)
    patient_cost = Column(Float)
    
    # Status
    status = Column(String, default="active")
    
    # Claim items
    items = Column(JSON)  # Store line items as JSON
    
    # Relationships
    patient = relationship("Patient", back_populates="claims")
    encounter = relationship("Encounter", back_populates="claims")
    payer = relationship("Payer", back_populates="claims")

class Device(Base):
    """Medical Device model"""
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    
    # Device details
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    
    # Coding
    snomed_code = Column(String, index=True)
    description = Column(String, nullable=False)
    
    # UDI
    udi = Column(String)
    
    # Status
    status = Column(String, default="active")
    
    # Relationships
    patient = relationship("Patient", back_populates="devices")

class DiagnosticReport(Base):
    """Diagnostic Report model"""
    __tablename__ = "diagnostic_reports"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Report details
    report_date = Column(DateTime, nullable=False, index=True)
    
    # Coding
    loinc_code = Column(String, index=True)
    description = Column(String, nullable=False)
    
    # Status
    status = Column(String, default="final")
    
    # Results (reference to observations)
    result_observations = Column(JSON)  # Array of observation IDs
    
    # Relationships
    patient = relationship("Patient", back_populates="diagnostic_reports")
    encounter = relationship("Encounter", back_populates="diagnostic_reports")

class ImagingStudy(Base):
    """Imaging Study model"""
    __tablename__ = "imaging_studies"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    
    # Study details
    study_date = Column(DateTime, nullable=False, index=True)
    
    # Coding
    snomed_code = Column(String, index=True)
    description = Column(String, nullable=False)
    
    # Modality
    modality = Column(String)  # CT, MR, US, etc.
    body_part = Column(String)
    
    # Series and instances
    number_of_series = Column(Integer)
    number_of_instances = Column(Integer)
    
    # Status
    status = Column(String, default="available")
    
    # Relationships
    patient = relationship("Patient", back_populates="imaging_studies")
    dicom_study = relationship("DICOMStudy", back_populates="imaging_study", uselist=False)

# Create indexes for common queries
Index('idx_encounters_date', Encounter.encounter_date)
Index('idx_conditions_snomed', Condition.snomed_code)
Index('idx_medications_rxnorm', Medication.rxnorm_code)
Index('idx_observations_loinc', Observation.loinc_code)
Index('idx_procedures_snomed', Procedure.snomed_code)