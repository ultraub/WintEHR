"""
Enhanced SQLAlchemy models for Synthea data with full FHIR R4 compliance
Includes missing critical fields and new resources for comprehensive healthcare data
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Date, Boolean, Text, JSON, ForeignKey, UniqueConstraint, Index, CheckConstraint
from sqlalchemy.orm import relationship
from database import Base
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
    
    # Relationships - commented out as they reference non-existent models
    # Use FHIR storage engine instead for these relationships
    # encounters = relationship("Encounter", back_populates="patient")
    # conditions = relationship("Condition", back_populates="patient")
    # medications = relationship("Medication", back_populates="patient")
    # observations = relationship("Observation", back_populates="patient")
    # procedures = relationship("Procedure", back_populates="patient")
    # immunizations = relationship("Immunization", back_populates="patient")
    # allergies = relationship("Allergy", back_populates="patient")
    # careplans = relationship("CarePlan", back_populates="patient")
    # claims = relationship("Claim", back_populates="patient")
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
    # appointment_id = Column(String, ForeignKey("appointments.id"))  # Disabled due to duplicate table
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
    # appointment = relationship("Appointment", back_populates="encounters")  # Disabled due to duplicate table
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

# Enhanced existing models with FHIR storage
class DiagnosticReport(Base):
    """DiagnosticReport model for laboratory, imaging, and other diagnostic reports"""
    __tablename__ = "diagnostic_reports"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Report identification
    identifier = Column(JSON)  # Report identifiers
    based_on = Column(JSON)  # ServiceRequest references
    status = Column(String, nullable=False, default="final", index=True)
    category = Column(JSON)  # Service category
    code = Column(JSON, nullable=False)  # Report code
    
    # Subject and context
    subject_id = Column(String, ForeignKey("patients.id"), nullable=False)
    effective_datetime = Column(DateTime, index=True)
    effective_period = Column(JSON)
    issued = Column(DateTime, index=True)
    
    # Performers
    performer = Column(JSON)  # Who performed the diagnostic service
    results_interpreter = Column(JSON)  # Who interpreted the results
    
    # Specimens
    specimen = Column(JSON)  # Specimen references
    
    # Results
    result = Column(JSON)  # Observation references
    imaging_study = Column(JSON)  # ImagingStudy references
    media = Column(JSON)  # Images or other media
    
    # Conclusion
    conclusion = Column(Text)
    conclusion_code = Column(JSON)  # Coded conclusion
    
    # Presentation
    presented_form = Column(JSON)  # Entire report as attachment
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('registered', 'partial', 'preliminary', 'final', 'amended', 'corrected', 'appended', 'cancelled', 'entered-in-error', 'unknown')", name='check_diagnostic_report_status'),
        Index('idx_diagnostic_report_patient_date', 'patient_id', 'effective_datetime'),
        Index('idx_diagnostic_report_status', 'status'),
    )
    
    # Relationships
    patient = relationship("Patient")
    encounter = relationship("Encounter")


class ImagingStudy(Base):
    """ImagingStudy model for diagnostic imaging procedures"""
    __tablename__ = "imaging_studies"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"), index=True)
    
    # Study identification
    identifier = Column(JSON)  # Study identifiers
    status = Column(String, nullable=False, default="available", index=True)
    modality_list = Column(JSON)  # List of modalities
    
    # Subject and context
    subject_id = Column(String, ForeignKey("patients.id"), nullable=False)
    started = Column(DateTime, index=True)
    number_of_series = Column(Integer, default=0)
    number_of_instances = Column(Integer, default=0)
    
    # Clinical context
    procedure_reference = Column(JSON)  # Reference to Procedure
    procedure_code = Column(JSON)  # What was performed
    reason_code = Column(JSON)  # Why study was requested
    reason_reference = Column(JSON)  # Reference to Condition/Observation
    
    # Description and notes
    description = Column(Text)
    note = Column(JSON)
    
    # Series information (simplified - full series in separate table)
    series = Column(JSON)  # Series data
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('registered', 'available', 'cancelled', 'entered-in-error', 'unknown')", name='check_imaging_study_status'),
        Index('idx_imaging_study_patient_date', 'patient_id', 'started'),
        Index('idx_imaging_study_status', 'status'),
    )
    
    # Relationships
    patient = relationship("Patient")
    encounter = relationship("Encounter")
    dicom_study = relationship("DICOMStudy", back_populates="imaging_study", uselist=False)


class Device(Base):
    """Device model for medical and non-medical devices"""
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"))  # If device is affixed to patient
    owner_id = Column(String, ForeignKey("organizations.id"))  # Organization responsible
    location_id = Column(String, ForeignKey("locations.id"))  # Where device is found
    parent_id = Column(String, ForeignKey("devices.id"))  # Parent device
    
    # Device identifiers
    identifier = Column(JSON)  # Instance identifiers
    udi_carrier = Column(JSON)  # Unique Device Identifier info
    
    # Device status
    status = Column(String, default="active", index=True)
    status_reason = Column(JSON)  # Why device is/is not active
    
    # Device details
    definition = Column(JSON)  # Reference to DeviceDefinition
    distinct_identifier = Column(String)  # Unique instance ID
    manufacturer = Column(String, index=True)
    manufacture_date = Column(Date)
    expiration_date = Column(Date)
    lot_number = Column(String)
    serial_number = Column(String, unique=True)
    model_number = Column(String, index=True)
    part_number = Column(String)
    
    # Device classification
    type = Column(JSON)  # Device type/kind
    specialization = Column(JSON)  # Device capabilities and standards
    version = Column(JSON)  # Device/software versions
    
    # Device properties
    property = Column(JSON)  # Device characteristics
    safety = Column(JSON)  # Safety characteristics
    
    # Additional information
    device_name = Column(JSON)  # Device names
    note = Column(JSON)  # Additional notes
    contact = Column(JSON)  # Contact details
    url = Column(String)  # Network address
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive', 'entered-in-error', 'unknown')", name='check_device_status'),
        Index('idx_device_patient', 'patient_id'),
        Index('idx_device_manufacturer_model', 'manufacturer', 'model_number'),
        Index('idx_device_status', 'status'),
    )
    
    # Relationships
    patient = relationship("Patient")
    owner = relationship("Organization")
    location = relationship("Location")
    parent = relationship("Device", remote_side=[id])


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
    category = Column(JSON)
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


class Provider(Base):
    """Provider model for healthcare practitioners"""
    __tablename__ = "providers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Identifiers
    npi = Column(String, unique=True, index=True)  # National Provider Identifier
    dea = Column(String)  # DEA number for prescribing
    state_license = Column(String)
    
    # Name components
    prefix = Column(String)
    first_name = Column(String, nullable=False, index=True)
    middle_name = Column(String)
    last_name = Column(String, nullable=False, index=True)
    suffix = Column(String)
    
    # Contact information
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone = Column(String)
    email = Column(String)
    
    # Professional information
    specialty = Column(String, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"))
    active = Column(Boolean, default=True)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        Index('idx_provider_name', 'last_name', 'first_name'),
        Index('idx_provider_specialty', 'specialty'),
        Index('idx_provider_org', 'organization_id'),
    )
    
    # Relationships
    encounters = relationship("Encounter", back_populates="provider")
    organization = relationship("Organization")


class Organization(Base):
    """Organization model for healthcare facilities"""
    __tablename__ = "organizations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Basic information
    name = Column(String, nullable=False, index=True)
    alias = Column(String)
    type = Column(String, index=True)
    active = Column(Boolean, default=True)
    
    # Contact information
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone = Column(String)
    email = Column(String)
    website = Column(String)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        Index('idx_organization_name', 'name'),
        Index('idx_organization_type', 'type'),
    )
    
    # Relationships
    providers = relationship("Provider", back_populates="organization")
    encounters = relationship("Encounter", back_populates="organization", foreign_keys="[Encounter.organization_id]")


class Location(Base):
    """Location model for places where healthcare is provided"""
    __tablename__ = "locations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Basic information
    name = Column(String, nullable=False, index=True)
    alias = Column(String)
    status = Column(String, default="active")
    mode = Column(String)  # instance | kind
    type = Column(JSON)  # CodeableConcept
    
    # Contact and address
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone = Column(String)
    
    # Physical details
    position = Column(JSON)  # Longitude/latitude
    managing_organization_id = Column(String, ForeignKey("organizations.id"))
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        Index('idx_location_name', 'name'),
        Index('idx_location_org', 'managing_organization_id'),
    )
    
    # Relationships
    managing_organization = relationship("Organization")


class Payer(Base):
    """Payer model for insurance companies and coverage providers"""
    __tablename__ = "payers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Basic information
    name = Column(String, nullable=False, index=True)
    type = Column(String, index=True)  # government, commercial, etc.
    active = Column(Boolean, default=True)
    
    # Contact information
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone = Column(String)
    email = Column(String)
    website = Column(String)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        Index('idx_payer_name', 'name'),
        Index('idx_payer_type', 'type'),
    )


class Coverage(Base):
    """Coverage model for insurance coverage information"""
    __tablename__ = "coverage"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    payer_id = Column(String, ForeignKey("payers.id"), index=True)
    
    # Coverage details
    identifier = Column(JSON)  # Coverage identifiers
    status = Column(String, default="active", index=True)
    type = Column(JSON)  # Type of coverage
    policy_holder_id = Column(String, ForeignKey("patients.id"))
    subscriber_id = Column(String, ForeignKey("patients.id"))
    beneficiary_id = Column(String, ForeignKey("patients.id"), nullable=False)
    dependent = Column(String)  # Dependent number
    
    # Coverage period
    period_start = Column(Date)
    period_end = Column(Date)
    
    # Network
    network = Column(String)
    
    # Order of coverage
    order = Column(Integer, default=1)
    
    # Class information (e.g., group, plan, subgroup)
    class_info = Column(JSON)
    
    # Cost information
    cost_to_beneficiary = Column(JSON)
    
    # Payor information
    payor = Column(JSON)  # References to Organization or Patient
    
    # Contract and subrogation
    contract = Column(JSON)  # References to Contract
    subrogation = Column(Boolean, default=False)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    extensions = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('active', 'cancelled', 'draft', 'entered-in-error')", name='check_coverage_status'),
        Index('idx_coverage_patient', 'patient_id'),
        Index('idx_coverage_payer', 'payer_id'),
        Index('idx_coverage_status', 'status'),
        Index('idx_coverage_period', 'period_start', 'period_end'),
    )
    
    # Relationships
    patient = relationship("Patient")
    payer = relationship("Payer")
    policy_holder = relationship("Patient", foreign_keys=[policy_holder_id])
    subscriber = relationship("Patient", foreign_keys=[subscriber_id])
    beneficiary = relationship("Patient", foreign_keys=[beneficiary_id])


# Add indexes to existing models
Patient.__table_args__ = Patient.__table_args__ + (
    Index('idx_patients_managing_org', 'managing_organization_id'),
    Index('idx_patients_gp', 'general_practitioner_id'),
)