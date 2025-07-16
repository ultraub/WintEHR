"""
FHIR R4 Appointment resource converter
Converts between database models and FHIR R4 Appointment resources
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from models.clinical.appointments import Appointment, AppointmentParticipant, AppointmentStatus, ParticipantStatus, ParticipantRequired


def appointment_to_fhir(appointment: Appointment) -> Dict[str, Any]:
    """
    Convert database Appointment model to FHIR R4 Appointment resource
    Reference: https://www.hl7.org/fhir/appointment.html
    """
    fhir_appointment = {
        "resourceType": "Appointment",
        "id": str(appointment.id),
        "meta": appointment.meta if appointment.meta else {
            "lastUpdated": appointment.last_updated.isoformat() if appointment.last_updated else datetime.utcnow().isoformat()
        },
        "status": appointment.status.value if appointment.status else "booked"
    }
    
    # Add text narrative if present
    if appointment.text:
        fhir_appointment["text"] = appointment.text
    
    # Add identifiers
    if appointment.identifier:
        fhir_appointment["identifier"] = appointment.identifier
    
    # Add cancellation reason
    if appointment.cancellation_reason:
        fhir_appointment["cancelationReason"] = appointment.cancellation_reason
    
    # Add service categories
    if appointment.service_category:
        fhir_appointment["serviceCategory"] = appointment.service_category
    
    # Add service types
    if appointment.service_type:
        fhir_appointment["serviceType"] = appointment.service_type
    
    # Add specialty
    if appointment.specialty:
        fhir_appointment["specialty"] = appointment.specialty
    
    # Add appointment type
    if appointment.appointment_type:
        fhir_appointment["appointmentType"] = appointment.appointment_type
    
    # Add reason codes
    if appointment.reason_code:
        fhir_appointment["reasonCode"] = appointment.reason_code
    
    # Add reason references
    if appointment.reason_reference:
        fhir_appointment["reasonReference"] = appointment.reason_reference
    
    # Add priority
    if appointment.priority is not None:
        fhir_appointment["priority"] = appointment.priority
    
    # Add description
    if appointment.description:
        fhir_appointment["description"] = appointment.description
    
    # Add supporting information
    if appointment.supporting_information:
        fhir_appointment["supportingInformation"] = appointment.supporting_information
    
    # Add start time (required)
    if appointment.start:
        fhir_appointment["start"] = appointment.start.isoformat()
    
    # Add end time (required)
    if appointment.end:
        fhir_appointment["end"] = appointment.end.isoformat()
    
    # Add minutes duration
    if appointment.minutes_duration:
        fhir_appointment["minutesDuration"] = appointment.minutes_duration
    
    # Add slots
    if appointment.slot:
        fhir_appointment["slot"] = appointment.slot
    
    # Add created date
    if appointment.created:
        fhir_appointment["created"] = appointment.created.isoformat()
    
    # Add comment
    if appointment.comment:
        fhir_appointment["comment"] = appointment.comment
    
    # Add patient instruction
    if appointment.patient_instruction:
        fhir_appointment["patientInstruction"] = appointment.patient_instruction
    
    # Add based on references
    if appointment.based_on:
        fhir_appointment["basedOn"] = appointment.based_on
    
    # Add requested periods
    if appointment.requested_period:
        fhir_appointment["requestedPeriod"] = appointment.requested_period
    
    # Add participants
    if appointment.participants:
        fhir_appointment["participant"] = [
            participant_to_fhir(participant) for participant in appointment.participants
        ]
    
    return fhir_appointment


def participant_to_fhir(participant: AppointmentParticipant) -> Dict[str, Any]:
    """Convert AppointmentParticipant to FHIR participant structure"""
    fhir_participant = {
        "status": participant.status.value if participant.status else "accepted"
    }
    
    # Add participant type
    if participant.type:
        fhir_participant["type"] = participant.type
    
    # Add actor reference
    if participant.actor_type and participant.actor_id:
        fhir_participant["actor"] = {
            "reference": f"{participant.actor_type}/{participant.actor_id}",
            "type": participant.actor_type
        }
    
    # Add required status
    if participant.required:
        fhir_participant["required"] = participant.required.value
    
    # Add period
    if participant.period:
        fhir_participant["period"] = participant.period
    
    return fhir_participant


def fhir_to_appointment(fhir_data: Dict[str, Any], appointment: Optional[Appointment] = None) -> Appointment:
    """
    Convert FHIR R4 Appointment resource to database Appointment model
    """
    if not appointment:
        appointment = Appointment()
    
    # Set basic fields
    if "id" in fhir_data:
        appointment.id = fhir_data["id"]
    
    # Set status (required)
    if "status" in fhir_data:
        try:
            appointment.status = AppointmentStatus(fhir_data["status"])
        except ValueError:
            appointment.status = AppointmentStatus.BOOKED  # Default
    
    # Set identifiers
    if "identifier" in fhir_data:
        appointment.identifier = fhir_data["identifier"]
    
    # Set cancellation reason
    if "cancelationReason" in fhir_data:
        appointment.cancellation_reason = fhir_data["cancelationReason"]
    
    # Set service category
    if "serviceCategory" in fhir_data:
        appointment.service_category = fhir_data["serviceCategory"]
    
    # Set service type
    if "serviceType" in fhir_data:
        appointment.service_type = fhir_data["serviceType"]
    
    # Set specialty
    if "specialty" in fhir_data:
        appointment.specialty = fhir_data["specialty"]
    
    # Set appointment type
    if "appointmentType" in fhir_data:
        appointment.appointment_type = fhir_data["appointmentType"]
    
    # Set reason codes
    if "reasonCode" in fhir_data:
        appointment.reason_code = fhir_data["reasonCode"]
    
    # Set reason references
    if "reasonReference" in fhir_data:
        appointment.reason_reference = fhir_data["reasonReference"]
    
    # Set priority
    if "priority" in fhir_data:
        appointment.priority = fhir_data["priority"]
    
    # Set description
    if "description" in fhir_data:
        appointment.description = fhir_data["description"]
    
    # Set supporting information
    if "supportingInformation" in fhir_data:
        appointment.supporting_information = fhir_data["supportingInformation"]
    
    # Set start time (required)
    if "start" in fhir_data:
        appointment.start = datetime.fromisoformat(fhir_data["start"].replace("Z", "+00:00"))
    
    # Set end time (required)
    if "end" in fhir_data:
        appointment.end = datetime.fromisoformat(fhir_data["end"].replace("Z", "+00:00"))
    
    # Set minutes duration
    if "minutesDuration" in fhir_data:
        appointment.minutes_duration = fhir_data["minutesDuration"]
    
    # Set slots
    if "slot" in fhir_data:
        appointment.slot = fhir_data["slot"]
    
    # Set created date
    if "created" in fhir_data:
        appointment.created = datetime.fromisoformat(fhir_data["created"].replace("Z", "+00:00"))
    
    # Set comment
    if "comment" in fhir_data:
        appointment.comment = fhir_data["comment"]
    
    # Set patient instruction
    if "patientInstruction" in fhir_data:
        appointment.patient_instruction = fhir_data["patientInstruction"]
    
    # Set based on references
    if "basedOn" in fhir_data:
        appointment.based_on = fhir_data["basedOn"]
    
    # Set requested periods
    if "requestedPeriod" in fhir_data:
        appointment.requested_period = fhir_data["requestedPeriod"]
    
    # Set meta
    if "meta" in fhir_data:
        appointment.meta = fhir_data["meta"]
    
    # Set text
    if "text" in fhir_data:
        appointment.text = fhir_data["text"]
    
    return appointment


def fhir_to_participant(fhir_participant: Dict[str, Any], participant: Optional[AppointmentParticipant] = None) -> AppointmentParticipant:
    """Convert FHIR participant structure to AppointmentParticipant"""
    if not participant:
        participant = AppointmentParticipant()
    
    # Set status (required)
    if "status" in fhir_participant:
        try:
            participant.status = ParticipantStatus(fhir_participant["status"])
        except ValueError:
            participant.status = ParticipantStatus.ACCEPTED  # Default
    
    # Set type
    if "type" in fhir_participant:
        participant.type = fhir_participant["type"]
    
    # Set actor reference
    if "actor" in fhir_participant and "reference" in fhir_participant["actor"]:
        reference = fhir_participant["actor"]["reference"]
        if "/" in reference:
            participant.actor_type, participant.actor_id = reference.split("/", 1)
    
    # Set required status
    if "required" in fhir_participant:
        try:
            participant.required = ParticipantRequired(fhir_participant["required"])
        except ValueError:
            participant.required = ParticipantRequired.REQUIRED  # Default
    
    # Set period
    if "period" in fhir_participant:
        participant.period = fhir_participant["period"]
    
    return participant