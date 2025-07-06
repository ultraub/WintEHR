"""
Appointment model for FHIR R4 compliant appointment management
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text, Enum, JSON
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime


class AppointmentStatus(enum.Enum):
    """FHIR R4 Appointment status codes"""
    PROPOSED = "proposed"
    PENDING = "pending"
    BOOKED = "booked"
    ARRIVED = "arrived"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"
    NOSHOW = "noshow"
    ENTERED_IN_ERROR = "entered-in-error"
    CHECKED_IN = "checked-in"
    WAITLIST = "waitlist"


class ParticipantStatus(enum.Enum):
    """FHIR R4 Participant status codes"""
    ACCEPTED = "accepted"
    DECLINED = "declined"
    TENTATIVE = "tentative"
    NEEDS_ACTION = "needs-action"


class ParticipantRequired(enum.Enum):
    """FHIR R4 Participant required codes"""
    REQUIRED = "required"
    OPTIONAL = "optional"
    INFORMATION_ONLY = "information-only"


class Appointment(Base):
    """
    FHIR R4 compliant Appointment resource
    Reference: https://www.hl7.org/fhir/appointment.html
    """
    __tablename__ = 'appointments'
    
    # Primary key
    id = Column(String, primary_key=True)
    
    # Identifiers
    identifier = Column(JSON)  # External identifiers
    
    # Status - required
    status = Column(Enum(AppointmentStatus), nullable=False)
    
    # Cancellation reason
    cancellation_reason = Column(JSON)  # CodeableConcept
    
    # Service category
    service_category = Column(JSON)  # CodeableConcept[]
    
    # Service type
    service_type = Column(JSON)  # CodeableConcept[]
    
    # Specialty
    specialty = Column(JSON)  # CodeableConcept[]
    
    # Appointment type
    appointment_type = Column(JSON)  # CodeableConcept
    
    # Reason codes
    reason_code = Column(JSON)  # CodeableConcept[]
    
    # Reason references (to Condition, Procedure, Observation, ImmunizationRecommendation)
    reason_reference = Column(JSON)  # Reference[]
    
    # Priority (0 = urgent)
    priority = Column(Integer, default=5)
    
    # Description
    description = Column(Text)
    
    # Supporting information
    supporting_information = Column(JSON)  # Reference[]
    
    # Start time - required
    start = Column(DateTime, nullable=False)
    
    # End time - required
    end = Column(DateTime, nullable=False)
    
    # Minutes duration
    minutes_duration = Column(Integer)
    
    # Slots
    slot = Column(JSON)  # Reference[] to Slot resources
    
    # Created date
    created = Column(DateTime, default=datetime.utcnow)
    
    # Last updated
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Comment
    comment = Column(Text)
    
    # Patient instructions
    patient_instruction = Column(Text)
    
    # References to other appointments
    based_on = Column(JSON)  # Reference[]
    
    # Requested periods
    requested_period = Column(JSON)  # Period[]
    
    # Meta information
    meta = Column(JSON)
    
    # Text narrative
    text = Column(JSON)
    
    # Relationships to participants are in AppointmentParticipant table


class AppointmentParticipant(Base):
    """
    FHIR R4 compliant Appointment.participant
    """
    __tablename__ = 'appointment_participants'
    
    # Primary key
    id = Column(String, primary_key=True)
    
    # Foreign key to appointment
    appointment_id = Column(String, ForeignKey('appointments.id', ondelete='CASCADE'), nullable=False)
    
    # Participant type
    type = Column(JSON)  # CodeableConcept[]
    
    # Participant actor (reference to Patient, Practitioner, PractitionerRole, RelatedPerson, Device, Location, HealthcareService)
    actor_type = Column(String)  # e.g., 'Patient', 'Practitioner', 'Location'
    actor_id = Column(String)  # ID of the referenced resource
    
    # Required participation
    required = Column(Enum(ParticipantRequired), default=ParticipantRequired.REQUIRED)
    
    # Participation status
    status = Column(Enum(ParticipantStatus), nullable=False)
    
    # Period of participation
    period = Column(JSON)  # Period
    
    # Relationships
    appointment = relationship("Appointment", backref="participants")
    
    # Helper properties for common participant types
    @property
    def actor_reference(self):
        """Return FHIR reference format"""
        if self.actor_type and self.actor_id:
            return f"{self.actor_type}/{self.actor_id}"
        return None
    
    @actor_reference.setter
    def actor_reference(self, value):
        """Parse FHIR reference format"""
        if value and '/' in value:
            self.actor_type, self.actor_id = value.split('/', 1)