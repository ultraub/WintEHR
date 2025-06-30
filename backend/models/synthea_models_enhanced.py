"""
Enhanced SQLAlchemy models for Synthea data with full FHIR R4 compliance
Includes missing critical fields and new resources for comprehensive healthcare data
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Date, Boolean, Text, JSON, ForeignKey, UniqueConstraint, Index, CheckConstraint
from sqlalchemy.orm import relationship
from database.database import Base
import uuid
from datetime import datetime

class Patient(Base):
    """Enhanced Patient model with comprehensive FHIR R4 fields"""
    __tablename__ = "patients"
    
    # Primary key
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Synthea identifiers
    synthea_id = Column(String, unique=True, index=True)
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
    date_of_birth = Column(Date, nullable=False, index=True)
    birth_time = Column(String)  # Time of birth for precision
    date_of_death = Column(Date, index=True)
    deceased_boolean = Column(Boolean, default=False)  # Quick deceased check
    gender = Column(String, nullable=False, index=True)
    marital_status = Column(String)
    race = Column(String)
    ethnicity = Column(String)
    
    # Multiple birth information
    multiple_birth_boolean = Column(Boolean, default=False)
    multiple_birth_integer = Column(Integer)
    
    # Contact information
    address = Column(String)
    city = Column(String)
    state = Column(String)
    county = Column(String)
    zip_code = Column(String, index=True)
    lat = Column(Float)
    lon = Column(Float)
    phone = Column(String)
    email = Column(String)
    
    # Healthcare
    healthcare_expenses = Column(Float, default=0.0)
    healthcare_coverage = Column(Float, default=0.0)
    income = Column(Integer)
    
    # FHIR R4 enhancements
    managing_organization_id = Column(String, ForeignKey("organizations.id"))
    general_practitioner_id = Column(String, ForeignKey("providers.id"))
    communication = Column(JSON)  # Languages and preferences
    photo = Column(JSON)  # Patient photos
    link = Column(JSON)  # Links to related Patient resources
    
    # Raw FHIR storage for extensibility
    fhir_json = Column(JSON)  # Complete FHIR resource
    fhir_meta = Column(JSON)  # FHIR meta information
    extensions = Column(JSON)  # FHIR extensions
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("gender IN ('male', 'female', 'other', 'unknown')", name='check_patient_gender'),
        Index('idx_patients_name', 'last_name', 'first_name'),
        Index('idx_patients_dob_gender', 'date_of_birth', 'gender'),
    )
    
    # Relationships
    encounters = relationship("Encounter", back_populates="patient")
    conditions = relationship("Condition", back_populates="patient")
    medications = relationship("Medication", back_populates="patient")
    observations = relationship("Observation", back_populates="patient")
    procedures = relationship("Procedure", back_populates="patient")
    immunizations = relationship("Immunization", back_populates="patient")
    allergies = relationship("Allergy", back_populates="patient")
    careplans = relationship("CarePlan", back_populates="patient")
    claims = relationship("Claim", back_populates="patient")
    managing_organization = relationship("Organization", foreign_keys=[managing_organization_id])
    general_practitioner = relationship("Provider", foreign_keys=[general_practitioner_id])

class Encounter(Base):
    """Enhanced Encounter model with comprehensive FHIR R4 fields"""
    __tablename__ = "encounters"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    provider_id = Column(String, ForeignKey("providers.id"), index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), index=True)
    payer_id = Column(String, ForeignKey("payers.id"), index=True)
    
    # FHIR R4 enhancements
    appointment_id = Column(String, ForeignKey("appointments.id"))
    part_of_id = Column(String, ForeignKey("encounters.id"))  # Episode of care
    service_provider_id = Column(String, ForeignKey("organizations.id"))
    
    # Encounter details
    start_time = Column(DateTime, index=True)
    end_time = Column(DateTime)
    encounter_class = Column(String, nullable=False, index=True)
    encounter_type = Column(String)
    status = Column(String, default="finished", index=True)
    
    # Financial
    base_encounter_cost = Column(Float, default=0.0)
    total_claim_cost = Column(Float, default=0.0)
    payer_coverage = Column(Float, default=0.0)
    
    # Clinical context
    diagnosis = Column(JSON)  # Encounter-specific diagnoses with ranks
    participant = Column(JSON)  # Encounter participants with roles
    hospitalization = Column(JSON)  # Admission/discharge details
    length = Column(JSON)  # Duration of encounter
    reason_code = Column(JSON)  # Reason for encounter
    reason_reference = Column(JSON)  # Reference to conditions
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("encounter_class IN ('AMB', 'EMER', 'IMP', 'OBSENC', 'PRENC', 'SS')", name='check_encounter_class'),
        CheckConstraint("status IN ('planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown')", name='check_encounter_status'),
        Index('idx_encounters_patient_date', 'patient_id', 'start_time'),
        Index('idx_encounters_provider_date', 'provider_id', 'start_time'),
        Index('idx_encounters_class_status', 'encounter_class', 'status'),
    )
    
    # Relationships
    patient = relationship("Patient", back_populates="encounters")
    provider = relationship("Provider", back_populates="encounters", foreign_keys=[provider_id])
    organization = relationship("Organization", back_populates="encounters", foreign_keys=[organization_id])
    payer = relationship("Payer")
    appointment = relationship("Appointment", back_populates="encounters")
    service_provider = relationship("Organization", foreign_keys=[service_provider_id])
    part_of = relationship("Encounter", remote_side=[id])

class DocumentReference(Base):
    """Document Reference model for clinical documents"""
    __tablename__ = "document_references"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    custodian_id = Column(String, ForeignKey("organizations.id"))
    
    # Document metadata
    master_identifier = Column(String, unique=True)
    identifier = Column(JSON)  # Additional identifiers
    status = Column(String, nullable=False, default="current")
    doc_status = Column(String)  # preliminary, final, amended, etc.
    
    # Document classification
    type = Column(JSON)  # Document type coding
    category = Column(JSON)  # Document category
    subject_id = Column(String, ForeignKey("patients.id"), nullable=False)
    
    # Content and timing
    date = Column(DateTime, default=datetime.utcnow, index=True)
    author = Column(JSON)  # Author references
    authenticator_id = Column(String, ForeignKey("providers.id"))
    
    # Document content
    content = Column(JSON)  # Attachment data with URLs, format, etc.
    context = Column(JSON)  # Clinical context
    description = Column(Text)
    
    # Security and access
    security_label = Column(JSON)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('current', 'superseded', 'entered-in-error')", name='check_docref_status'),
        Index('idx_docref_patient_date', 'patient_id', 'date'),
        Index('idx_docref_type_status', 'status'),
    )
    
    # Relationships
    patient = relationship("Patient")
    encounter = relationship("Encounter")
    custodian = relationship("Organization")
    authenticator = relationship("Provider")

class ServiceRequest(Base):
    """Service Request model for orders and referrals"""
    __tablename__ = "service_requests"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    requester_id = Column(String, ForeignKey("providers.id"), index=True)
    
    # Request details
    identifier = Column(JSON)
    instantiates_canonical = Column(String)  # Protocol/guideline
    instantiates_uri = Column(String)
    based_on = Column(JSON)  # Request references
    replaces = Column(JSON)  # Replaced requests
    requisition = Column(String)  # Composite request identifier
    
    # Status and intent
    status = Column(String, nullable=False, default="draft", index=True)
    intent = Column(String, nullable=False, default="order")
    category = Column(JSON)
    priority = Column(String, default="routine")
    do_not_perform = Column(Boolean, default=False)
    
    # What is being requested
    code = Column(JSON, nullable=False)  # What is being requested
    order_detail = Column(JSON)  # Additional order details
    quantity_quantity = Column(JSON)
    quantity_ratio = Column(JSON)
    quantity_range = Column(JSON)
    
    # Subject and timing
    subject_id = Column(String, ForeignKey("patients.id"), nullable=False)
    occurrence_datetime = Column(DateTime)
    occurrence_period = Column(JSON)
    occurrence_timing = Column(JSON)
    as_needed_boolean = Column(Boolean, default=False)
    as_needed_codeable_concept = Column(JSON)
    authored_on = Column(DateTime, default=datetime.utcnow)
    
    # Who should perform
    performer_type = Column(JSON)
    performer = Column(JSON)  # Performer references
    location_code = Column(JSON)
    location_reference = Column(JSON)
    
    # Clinical reasoning
    reason_code = Column(JSON)
    reason_reference = Column(JSON)
    insurance = Column(JSON)
    supporting_info = Column(JSON)
    
    # Specimens and body sites
    specimen = Column(JSON)
    body_site = Column(JSON)
    
    # Instructions and notes
    note = Column(JSON)
    patient_instruction = Column(Text)
    relevant_history = Column(JSON)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown')", name='check_servicerequest_status'),
        CheckConstraint("intent IN ('proposal', 'plan', 'directive', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option')", name='check_servicerequest_intent'),
        CheckConstraint("priority IN ('routine', 'urgent', 'asap', 'stat')", name='check_servicerequest_priority'),
        Index('idx_servicerequest_patient_status', 'patient_id', 'status'),
        Index('idx_servicerequest_requester_date', 'requester_id', 'authored_on'),
    )
    
    # Relationships
    patient = relationship("Patient")
    encounter = relationship("Encounter")
    requester = relationship("Provider")

class Specimen(Base):
    """Specimen model for laboratory workflows"""
    __tablename__ = "specimens"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    
    # Specimen identification
    identifier = Column(JSON)
    accession_identifier = Column(String, unique=True, index=True)
    
    # Status
    status = Column(String, default="available", index=True)
    
    # Specimen details
    type = Column(JSON)  # Specimen type coding
    subject_id = Column(String, ForeignKey("patients.id"), nullable=False)
    received_time = Column(DateTime, index=True)
    
    # Collection information
    collection = Column(JSON)  # Collection procedures and details
    collected_datetime = Column(DateTime)
    collector_id = Column(String, ForeignKey("providers.id"))
    
    # Processing and handling
    processing = Column(JSON)  # Processing procedures
    container = Column(JSON)  # Container details
    condition = Column(JSON)  # Specimen condition
    
    # Relationships to other resources
    parent = Column(JSON)  # Parent specimen references
    request = Column(JSON)  # ServiceRequest references
    
    # Notes
    note = Column(JSON)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('available', 'unavailable', 'unsatisfactory', 'entered-in-error')", name='check_specimen_status'),
        Index('idx_specimen_patient_received', 'patient_id', 'received_time'),
        Index('idx_specimen_collector_date', 'collector_id', 'collected_datetime'),
    )
    
    # Relationships
    patient = relationship("Patient")
    collector = relationship("Provider")

class Appointment(Base):
    """Appointment model for scheduling"""
    __tablename__ = "appointments"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Appointment identification
    identifier = Column(JSON)
    
    # Status and classification
    status = Column(String, nullable=False, default="proposed", index=True)
    cancellation_reason = Column(JSON)
    service_category = Column(JSON)
    service_type = Column(JSON)
    specialty = Column(JSON)
    appointment_type = Column(JSON)
    reason_code = Column(JSON)
    reason_reference = Column(JSON)
    priority = Column(Integer, default=0)
    
    # Scheduling
    description = Column(Text)
    supporting_information = Column(JSON)
    start = Column(DateTime, index=True)
    end = Column(DateTime)
    minutes_duration = Column(Integer)
    slot = Column(JSON)
    
    # Metadata
    created = Column(DateTime, default=datetime.utcnow)
    comment = Column(Text)
    patient_instruction = Column(Text)
    
    # Participants (stored as JSON for flexibility)
    participant = Column(JSON)  # Required participants with status
    
    # Requested period
    requested_period = Column(JSON)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist')", name='check_appointment_status'),
        Index('idx_appointment_start_status', 'start', 'status'),
        Index('idx_appointment_created', 'created'),
    )
    
    # Relationships
    encounters = relationship("Encounter", back_populates="appointment")

# Enhanced existing models with FHIR storage
class Observation(Base):
    """Enhanced Observation model with comprehensive FHIR R4 fields"""
    __tablename__ = "observations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    device_id = Column(String, ForeignKey("devices.id"))
    specimen_id = Column(String, ForeignKey("specimens.id"))
    
    # FHIR R4 enhancements
    based_on = Column(JSON)  # ServiceRequest references
    part_of = Column(JSON)  # Procedure references
    
    # Observation metadata
    status = Column(String, default="final", index=True)
    category = Column(JSON, index=True)
    code = Column(JSON, nullable=False)  # What was observed
    
    # Values
    value_quantity = Column(JSON)
    value_codeable_concept = Column(JSON)
    value_string = Column(String)
    value_boolean = Column(Boolean)
    value_integer = Column(Integer)
    value_range = Column(JSON)
    value_ratio = Column(JSON)
    value_sampled_data = Column(JSON)
    value_time = Column(String)
    value_datetime = Column(DateTime)
    value_period = Column(JSON)
    
    # Data absent reason
    data_absent_reason = Column(JSON)
    
    # Interpretation and notes
    interpretation = Column(JSON)
    note = Column(JSON)
    
    # Body site and method
    body_site = Column(JSON)
    method = Column(JSON)
    
    # Timing
    effective_datetime = Column(DateTime, index=True)
    effective_period = Column(JSON)
    effective_timing = Column(JSON)
    effective_instant = Column(DateTime)
    
    # Issued
    issued = Column(DateTime)
    
    # Performer
    performer = Column(JSON)
    
    # Reference ranges
    reference_range = Column(JSON)
    
    # Related observations
    has_member = Column(JSON)  # Panel member observations
    derived_from = Column(JSON)  # Source observations
    component = Column(JSON)  # Multi-component observations
    
    # Focus (what observation is about)
    focus = Column(JSON)
    
    # Legacy fields for backward compatibility
    loinc_code = Column(String, index=True)
    observation_name = Column(String)
    value = Column(String)
    unit = Column(String)
    observation_date = Column(Date)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown')", name='check_observation_status'),
        Index('idx_observation_patient_date', 'patient_id', 'effective_datetime'),
        Index('idx_observation_loinc_status', 'loinc_code', 'status'),
        Index('idx_observation_category_status', 'status'),
    )
    
    # Relationships
    patient = relationship("Patient", back_populates="observations")
    encounter = relationship("Encounter")
    device = relationship("Device")
    specimen = relationship("Specimen")

# Add indexes to existing models
Patient.__table_args__ = Patient.__table_args__ + (
    Index('idx_patients_managing_org', 'managing_organization_id'),
    Index('idx_patients_gp', 'general_practitioner_id'),
)

# Add FHIR storage columns to all existing models that don't have them
for model_class in [Provider, Organization, Location, Condition, Medication, Procedure, Immunization, Allergy, CarePlan, Payer, Claim, Device, DiagnosticReport, ImagingStudy]:
    if not hasattr(model_class, 'fhir_json'):
        model_class.fhir_json = Column(JSON)
        model_class.fhir_meta = Column(JSON)
        model_class.extensions = Column(JSON)