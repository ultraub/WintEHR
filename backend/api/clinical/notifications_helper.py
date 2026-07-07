"""Helper functions for creating clinical notifications."""

from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

# HAPI FHIR Communication notification service
from api.services.notification_service import get_notification_service

# Critical-value thresholds live in api/clinical/critical_values.py (R33) —
# the single table also served at GET /api/clinical/critical-values.
from api.clinical.critical_values import evaluate_critical

async def check_and_notify_critical_values(
    db: AsyncSession,
    observation: Dict[str, Any],
    patient_id: str,
    provider_id: str
) -> Optional[Dict[str, Any]]:
    """
    Check if an observation contains critical values and create notifications.

    Args:
        db: Async database session
        observation: FHIR Observation resource
        patient_id: Patient ID
        provider_id: Provider ID to notify

    Returns:
        Created FHIR Communication notification if critical value detected, None otherwise
    """
    # Extract LOINC code and value
    loinc_code = None
    for coding in observation.get("code", {}).get("coding", []):
        if coding.get("system") == "http://loinc.org":
            loinc_code = coding.get("code")
            break
    
    # Get value from observation
    value_quantity = observation.get("valueQuantity", {})
    if not value_quantity:
        return None

    value = value_quantity.get("value")
    unit = value_quantity.get("unit", "")

    # Check against the shared critical-value table
    critical = evaluate_critical(loinc_code, value, unit)
    if not critical:
        return None
    message = critical["message"]


    # Get patient name for the notification
    patient_query = db.execute(
        "SELECT first_name, last_name FROM patient WHERE id = :patient_id",
        {"patient_id": patient_id}
    ).fetchone()
    
    patient_name = "Unknown Patient"
    if patient_query:
        patient_name = f"{patient_query.first_name} {patient_query.last_name}"
    
    # Create critical value notification using HAPI FHIR Communication
    subject = f"Critical Lab Result - {critical['label']}"
    full_message = f"{message} for patient {patient_name}. Immediate review required."

    notification_service = get_notification_service()
    notification = await notification_service.create_system_notification(
        db=db,
        recipient_id=provider_id,
        subject=subject,
        message=full_message,
        priority="stat",
        category="alert",
        patient_id=patient_id
    )

    return notification

async def notify_task_assignment(
    db: AsyncSession,
    task: Dict[str, Any],
    assignee_id: str,
    assigner_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Create a notification for task assignment.

    Args:
        db: Async database session
        task: FHIR Task resource
        assignee_id: Provider ID being assigned the task
        assigner_id: Provider ID who assigned the task (optional)

    Returns:
        Created FHIR Communication notification
    """
    task_description = task.get("description", "New task")
    priority = task.get("priority", "routine")
    
    # Map FHIR task priority to notification priority
    priority_map = {
        "stat": "stat",
        "asap": "asap",
        "urgent": "urgent",
        "routine": "routine"
    }
    notification_priority = priority_map.get(priority, "routine")
    
    # Get patient info if task is patient-related
    patient_id = None
    patient_name = ""
    
    if task.get("for"):
        patient_ref = task["for"].get("reference", "")
        if patient_ref.startswith("Patient/"):
            patient_id = patient_ref.replace("Patient/", "")
            
            patient_query = db.execute(
                "SELECT first_name, last_name FROM patient WHERE id = :patient_id",
                {"patient_id": patient_id}
            ).fetchone()
            
            if patient_query:
                patient_name = f" for {patient_query.first_name} {patient_query.last_name}"
    
    subject = "New Task Assignment"
    message = f"You have been assigned a new task: {task_description}{patient_name}"

    if assigner_id:
        assigner_query = db.execute(
            "SELECT first_name, last_name FROM provider WHERE id = :provider_id",
            {"provider_id": assigner_id}
        ).fetchone()

        if assigner_query:
            message += f" (assigned by Dr. {assigner_query.first_name} {assigner_query.last_name})"

    # Create task notification using HAPI FHIR Communication
    notification_service = get_notification_service()
    notification = await notification_service.create_system_notification(
        db=db,
        recipient_id=assignee_id,
        subject=subject,
        message=message,
        priority=notification_priority,
        category="notification",
        patient_id=patient_id
    )

    return notification

async def notify_appointment_reminder(
    db: AsyncSession,
    appointment: Dict[str, Any],
    provider_id: str,
    hours_before: int = 24
) -> Optional[Dict[str, Any]]:
    """
    Create an appointment reminder notification.

    Args:
        db: Async database session
        appointment: FHIR Appointment resource
        provider_id: Provider ID to notify
        hours_before: Hours before appointment to send reminder

    Returns:
        Created FHIR Communication notification
    """
    start_time = appointment.get("start")
    if not start_time:
        return None
    
    # Get patient info
    patient_id = None
    patient_name = "Patient"
    
    for participant in appointment.get("participant", []):
        actor_ref = participant.get("actor", {}).get("reference", "")
        if actor_ref.startswith("Patient/"):
            patient_id = actor_ref.replace("Patient/", "")
            
            patient_query = db.execute(
                "SELECT first_name, last_name FROM patient WHERE id = :patient_id",
                {"patient_id": patient_id}
            ).fetchone()
            
            if patient_query:
                patient_name = f"{patient_query.first_name} {patient_query.last_name}"
            break
    
    # Format appointment time
    try:
        appt_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        time_str = appt_time.strftime("%B %d at %I:%M %p")
    except (ValueError, TypeError):
        time_str = "upcoming appointment"
    
    subject = "Appointment Reminder"
    message = f"Reminder: {patient_name} has an appointment on {time_str}"

    # Add appointment type if available
    if appointment.get("appointmentType"):
        appt_type = appointment["appointmentType"].get("text", "")
        if appt_type:
            message += f" ({appt_type})"

    # Create appointment reminder using HAPI FHIR Communication
    notification_service = get_notification_service()
    notification = await notification_service.create_system_notification(
        db=db,
        recipient_id=provider_id,
        subject=subject,
        message=message,
        priority="routine",
        category="reminder",
        patient_id=patient_id
    )

    return notification

async def notify_medication_interaction(
    db: AsyncSession,
    provider_id: str,
    patient_id: str,
    medication1: str,
    medication2: str,
    severity: str,
    description: str
) -> Optional[Dict[str, Any]]:
    """
    Create a notification for drug-drug interactions.

    Args:
        db: Async database session
        provider_id: Provider ID to notify
        patient_id: Patient ID
        medication1: First medication name
        medication2: Second medication name
        severity: Interaction severity (high, moderate, low)
        description: Interaction description

    Returns:
        Created FHIR Communication notification
    """
    # Get patient name
    patient_query = db.execute(
        "SELECT first_name, last_name FROM patient WHERE id = :patient_id",
        {"patient_id": patient_id}
    ).fetchone()
    
    patient_name = "Unknown Patient"
    if patient_query:
        patient_name = f"{patient_query.first_name} {patient_query.last_name}"
    
    # Set priority based on severity
    priority_map = {
        "high": "urgent",
        "moderate": "asap",
        "low": "routine"
    }
    priority = priority_map.get(severity.lower(), "routine")
    
    subject = f"Drug Interaction Alert - {severity.title()} Severity"
    message = (
        f"Potential interaction detected for {patient_name}: "
        f"{medication1} + {medication2}. {description}"
    )

    # Create drug interaction alert using HAPI FHIR Communication
    notification_service = get_notification_service()
    notification = await notification_service.create_system_notification(
        db=db,
        recipient_id=provider_id,
        subject=subject,
        message=message,
        priority=priority,
        category="alert",
        patient_id=patient_id
    )

    return notification