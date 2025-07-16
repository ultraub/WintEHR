"""
Extended FHIR Models for Complete Synthea Data Support
Includes models for resources not in the base synthea_models.py
"""

from sqlalchemy import Column, String, DateTime, Boolean, Float, Integer, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base


class Medication(Base):
    """Medication definition resource"""
    __tablename__ = "medications"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Medication identification
    identifier = Column(JSON)
    code = Column(JSON, nullable=False)  # Medication code (RxNorm, etc.)
    status = Column(String, default="active")
    
    # Medication details
    manufacturer_id = Column(String, ForeignKey("organizations.id"))
    form = Column(JSON)  # Dosage form
    amount = Column(JSON)  # Amount of drug in package
    ingredient = Column(JSON)  # Active/inactive ingredients
    batch = Column(JSON)  # Batch details
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    manufacturer = relationship("Organization", foreign_keys=[manufacturer_id])


class MedicationAdministration(Base):
    """Record of medication actually administered to patient"""
    __tablename__ = "medication_administrations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"))
    medication_request_id = Column(String, ForeignKey("medication_requests.id"))
    
    # Administration details
    identifier = Column(JSON)
    status = Column(String, nullable=False)  # in-progress, completed, stopped, etc.
    status_reason = Column(JSON)
    category = Column(JSON)
    
    # What was administered
    medication_codeable_concept = Column(JSON)
    medication_reference_id = Column(String, ForeignKey("medications.id"))
    
    # When and how
    effective_datetime = Column(DateTime, index=True)
    effective_period = Column(JSON)
    performer = Column(JSON)  # Who administered
    reason_code = Column(JSON)
    reason_reference = Column(JSON)
    
    # Dosage details
    dosage = Column(JSON)
    route = Column(JSON)
    method = Column(JSON)
    dose = Column(JSON)
    rate = Column(JSON)
    
    # Device used
    device = Column(JSON)
    
    # Notes and events
    note = Column(JSON)
    event_history = Column(JSON)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id])
    encounter = relationship("Encounter", foreign_keys=[encounter_id])
    medication_request = relationship("MedicationRequest", foreign_keys=[medication_request_id])
    medication = relationship("Medication", foreign_keys=[medication_reference_id])


class CareTeam(Base):
    """Care team assigned to patient"""
    __tablename__ = "care_teams"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"))
    
    # Care team details
    identifier = Column(JSON)
    status = Column(String, default="active")
    category = Column(JSON)
    name = Column(String)
    
    # Who is involved
    subject_id = Column(String, ForeignKey("patients.id"), nullable=False)
    participant = Column(JSON)  # Team members with roles
    
    # When active
    period = Column(JSON)
    
    # Why and what
    reason_code = Column(JSON)
    reason_reference = Column(JSON)
    managing_organization = Column(JSON)
    
    # Communication
    telecom = Column(JSON)
    note = Column(JSON)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id])
    subject = relationship("Patient", foreign_keys=[subject_id])
    encounter = relationship("Encounter", foreign_keys=[encounter_id])


class PractitionerRole(Base):
    """Roles/organizations the practitioner is associated with"""
    __tablename__ = "practitioner_roles"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    practitioner_id = Column(String, ForeignKey("providers.id"), index=True)
    organization_id = Column(String, ForeignKey("organizations.id"))
    
    # Role details
    identifier = Column(JSON)
    active = Column(Boolean, default=True)
    period = Column(JSON)
    
    # What they do
    code = Column(JSON)  # Roles this practitioner has
    specialty = Column(JSON)  # Specific specialties
    
    # Where they work
    location = Column(JSON)  # Location(s) they work
    healthcare_service = Column(JSON)  # Services they provide
    
    # Contact and availability
    telecom = Column(JSON)
    available_time = Column(JSON)
    not_available = Column(JSON)
    availability_exceptions = Column(String)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    practitioner = relationship("Provider", foreign_keys=[practitioner_id])
    organization = relationship("Organization", foreign_keys=[organization_id])


class Claim(Base):
    """Insurance claim"""
    __tablename__ = "claims"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = Column(String, ForeignKey("encounters.id"))
    provider_id = Column(String, ForeignKey("organizations.id"))
    insurer_id = Column(String, ForeignKey("organizations.id"))
    
    # Claim identification
    identifier = Column(JSON)
    status = Column(String, nullable=False)
    type = Column(JSON)
    subtype = Column(JSON)
    use = Column(String, default="claim")
    
    # Parties involved
    priority = Column(JSON)
    payee = Column(JSON)
    prescription = Column(JSON)  # Original prescription reference
    
    # When and where
    created = Column(DateTime, index=True)
    billable_period = Column(JSON)
    
    # Insurance information
    insurance = Column(JSON)  # Coverage details
    accident = Column(JSON)
    
    # Claim details
    item = Column(JSON)  # Line items
    total = Column(JSON)  # Total claim amount
    
    # Supporting info
    supporting_info = Column(JSON)
    diagnosis = Column(JSON)
    procedure = Column(JSON)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id])
    encounter = relationship("Encounter", foreign_keys=[encounter_id])
    provider = relationship("Organization", foreign_keys=[provider_id])
    insurer = relationship("Organization", foreign_keys=[insurer_id])


class ExplanationOfBenefit(Base):
    """Insurance payment explanation"""
    __tablename__ = "explanation_of_benefits"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    claim_id = Column(String, ForeignKey("claims.id"))
    provider_id = Column(String, ForeignKey("organizations.id"))
    insurer_id = Column(String, ForeignKey("organizations.id"))
    
    # EOB identification
    identifier = Column(JSON)
    status = Column(String, nullable=False)
    type = Column(JSON)
    subtype = Column(JSON)
    use = Column(String, default="claim")
    
    # When processed
    created = Column(DateTime, index=True)
    billable_period = Column(JSON)
    
    # Outcome
    outcome = Column(String)  # queued, complete, error, partial
    disposition = Column(String)
    
    # Insurance information
    insurance = Column(JSON)
    
    # Payment details
    item = Column(JSON)  # Line items with adjudication
    adjudication = Column(JSON)  # Overall adjudication
    total = Column(JSON)  # Category totals
    payment = Column(JSON)  # Payment details
    
    # Benefits
    benefit_balance = Column(JSON)  # Balance by category
    benefit_period = Column(JSON)
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id])
    claim = relationship("Claim", foreign_keys=[claim_id])
    provider = relationship("Organization", foreign_keys=[provider_id])
    insurer = relationship("Organization", foreign_keys=[insurer_id])


class SupplyDelivery(Base):
    """Delivery of medical supplies"""
    __tablename__ = "supply_deliveries"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # Foreign keys
    patient_id = Column(String, ForeignKey("patients.id"), index=True)
    
    # Delivery identification
    identifier = Column(JSON)
    status = Column(String)  # in-progress, completed, abandoned, cancelled
    
    # What was delivered
    type = Column(JSON)  # Category of supply
    supplied_item = Column(JSON)  # The item delivered
    quantity = Column(JSON)
    
    # When and where
    occurrence_datetime = Column(DateTime, index=True)
    occurrence_period = Column(JSON)
    occurrence_timing = Column(JSON)
    
    # Who was involved
    supplier_id = Column(String, ForeignKey("organizations.id"))
    destination_id = Column(String, ForeignKey("locations.id"))
    receiver = Column(JSON)
    
    # Based on what
    based_on = Column(JSON)  # SupplyRequest reference
    part_of = Column(JSON)  # Part of what event
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id])
    supplier = relationship("Organization", foreign_keys=[supplier_id])
    destination = relationship("Location", foreign_keys=[destination_id])


class Provenance(Base):
    """Resource versioning and audit trail"""
    __tablename__ = "provenances"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    synthea_id = Column(String, unique=True, index=True)
    
    # What this is about
    target = Column(JSON, nullable=False)  # Resource(s) this is about
    
    # When and why
    occurred_period = Column(JSON)
    occurred_datetime = Column(DateTime)
    recorded = Column(DateTime, nullable=False, index=True)
    policy = Column(JSON)  # Policy or plan
    location_id = Column(String, ForeignKey("locations.id"))
    reason = Column(JSON)
    activity = Column(JSON)  # Activity that occurred
    
    # Who was involved
    agent = Column(JSON, nullable=False)  # Who participated
    
    # Additional info
    entity = Column(JSON)  # Entities used
    signature = Column(JSON)  # Digital signatures
    
    # FHIR storage
    fhir_json = Column(JSON)
    fhir_meta = Column(JSON)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    location = relationship("Location", foreign_keys=[location_id])


# Create indexes for better query performance
Index('idx_medication_code', Medication.code)
Index('idx_med_admin_patient_date', MedicationAdministration.patient_id, MedicationAdministration.effective_datetime)
Index('idx_care_team_patient_status', CareTeam.patient_id, CareTeam.status)
Index('idx_practitioner_role_active', PractitionerRole.practitioner_id, PractitionerRole.active)
Index('idx_claim_patient_created', Claim.patient_id, Claim.created)
Index('idx_eob_patient_created', ExplanationOfBenefit.patient_id, ExplanationOfBenefit.created)
Index('idx_supply_delivery_patient', SupplyDelivery.patient_id)