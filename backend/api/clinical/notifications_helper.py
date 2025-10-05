"""Helper functions for creating clinical notifications."""

from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
# DEPRECATED (2025-10-05): Notifications need to be migrated to HAPI FHIR
# Old create_system_notification used deprecated fhir.resources table
# TODO: Migrate to create Communication resources and send to HAPI FHIR
# from fhir.api.notifications import create_system_notification
import asyncio

# Critical value ranges for common lab tests
CRITICAL_VALUES = {
    # Electrolytes
    "2951-2": {  # Sodium
        "name": "Sodium",
        "unit": "mmol/L",
        "low": 120,
        "high": 160,
        "low_message": "Critical low sodium level: {value} {unit}",
        "high_message": "Critical high sodium level: {value} {unit}"
    },
    "2823-3": {  # Potassium
        "name": "Potassium",
        "unit": "mmol/L", 
        "low": 2.5,
        "high": 6.5,
        "low_message": "Critical low potassium level: {value} {unit}",
        "high_message": "Critical high potassium level: {value} {unit}"
    },
    "2075-0": {  # Chloride
        "name": "Chloride",
        "unit": "mmol/L",
        "low": 80,
        "high": 120,
        "low_message": "Critical low chloride level: {value} {unit}",
        "high_message": "Critical high chloride level: {value} {unit}"
    },
    
    # Renal function
    "2160-0": {  # Creatinine
        "name": "Creatinine",
        "unit": "mg/dL",
        "high": 4.0,
        "high_message": "Critical high creatinine level: {value} {unit}"
    },
    
    # Glucose
    "2345-7": {  # Glucose
        "name": "Glucose",
        "unit": "mg/dL",
        "low": 40,
        "high": 500,
        "low_message": "Critical low glucose level: {value} {unit}",
        "high_message": "Critical high glucose level: {value} {unit}"
    },
    
    # Cardiac markers
    "2157-6": {  # Troponin I
        "name": "Troponin I",
        "unit": "ng/mL",
        "high": 0.04,
        "high_message": "Elevated troponin I level: {value} {unit} - possible myocardial injury"
    },
    
    # Hematology
    "718-7": {  # Hemoglobin
        "name": "Hemoglobin",
        "unit": "g/dL",
        "low": 7.0,
        "high": 20.0,
        "low_message": "Critical low hemoglobin level: {value} {unit}",
        "high_message": "Critical high hemoglobin level: {value} {unit}"
    },
    "777-3": {  # Platelet count
        "name": "Platelet count",
        "unit": "10*3/uL",
        "low": 20,
        "high": 1000,
        "low_message": "Critical low platelet count: {value} {unit}",
        "high_message": "Critical high platelet count: {value} {unit}"
    },
    "6690-2": {  # WBC count
        "name": "WBC count",
        "unit": "10*3/uL",
        "low": 1.0,
        "high": 30.0,
        "low_message": "Critical low WBC count: {value} {unit}",
        "high_message": "Critical high WBC count: {value} {unit}"
    },
    
    # Coagulation
    "5902-2": {  # PT
        "name": "Prothrombin time",
        "unit": "s",
        "high": 40,
        "high_message": "Critical prolonged PT: {value} {unit}"
    },
    "5964-2": {  # INR
        "name": "INR",
        "unit": "",
        "high": 5.0,
        "high_message": "Critical high INR: {value} - bleeding risk"
    }
}

async def check_and_notify_critical_values(
    db: Session,
    observation: Dict[str, Any],
    patient_id: str,
    provider_id: str
) -> Optional[Dict[str, Any]]:
    """
    Check if an observation contains critical values and create notifications.
    
    Args:
        db: Database session
        observation: FHIR Observation resource
        patient_id: Patient ID
        provider_id: Provider ID to notify
        
    Returns:
        Created notification if critical value detected, None otherwise
    """
    # Extract LOINC code and value
    loinc_code = None
    for coding in observation.get("code", {}).get("coding", []):
        if coding.get("system") == "http://loinc.org":
            loinc_code = coding.get("code")
            break
    
    if not loinc_code or loinc_code not in CRITICAL_VALUES:
        return None
    
    # Get value from observation
    value_quantity = observation.get("valueQuantity", {})
    if not value_quantity:
        return None
    
    value = value_quantity.get("value")
    unit = value_quantity.get("unit", "")
    
    if value is None:
        return None
    
    # Check against critical ranges
    critical_config = CRITICAL_VALUES[loinc_code]
    is_critical = False
    message = None
    
    if "low" in critical_config and value < critical_config["low"]:
        is_critical = True
        message = critical_config["low_message"].format(
            value=value,
            unit=unit or critical_config["unit"]
        )
    elif "high" in critical_config and value > critical_config["high"]:
        is_critical = True
        message = critical_config["high_message"].format(
            value=value,
            unit=unit or critical_config["unit"]
        )
    
    if not is_critical:
        return None
    
    # Get patient name for the notification
    patient_query = db.execute(
        "SELECT first_name, last_name FROM patient WHERE id = :patient_id",
        {"patient_id": patient_id}
    ).fetchone()
    
    patient_name = "Unknown Patient"
    if patient_query:
        patient_name = f"{patient_query.first_name} {patient_query.last_name}"
    
    # Create critical value notification
    subject = f"Critical Lab Result - {critical_config['name']}"
    full_message = f"{message} for patient {patient_name}. Immediate review required."

    # TODO (2025-10-05): Migrate to HAPI FHIR Communication resources
    # notification = await create_system_notification(
    #     db=db,
    #     recipient_id=provider_id,
    #     subject=subject,
    #     message=full_message,
    #     priority="stat",
    #     category="alert",
    #     patient_id=patient_id
    # )
    notification = None  # Temporarily disabled pending HAPI FHIR migration
    
    return notification

async def notify_task_assignment(
    db: Session,
    task: Dict[str, Any],
    assignee_id: str,
    assigner_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a notification for task assignment.
    
    Args:
        db: Database session
        task: FHIR Task resource
        assignee_id: Provider ID being assigned the task
        assigner_id: Provider ID who assigned the task (optional)
        
    Returns:
        Created notification
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

    # TODO (2025-10-05): Migrate to HAPI FHIR Communication resources
    # notification = await create_system_notification(
    #     db=db,
    #     recipient_id=assignee_id,
    #     subject=subject,
    #     message=message,
    #     priority=notification_priority,
    #     category="notification",
    #     patient_id=patient_id
    # )
    notification = None  # Temporarily disabled pending HAPI FHIR migration
    
    return notification

async def notify_appointment_reminder(
    db: Session,
    appointment: Dict[str, Any],
    provider_id: str,
    hours_before: int = 24
) -> Dict[str, Any]:
    """
    Create an appointment reminder notification.
    
    Args:
        db: Database session
        appointment: FHIR Appointment resource
        provider_id: Provider ID to notify
        hours_before: Hours before appointment to send reminder
        
    Returns:
        Created notification
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
    except:
        time_str = "upcoming appointment"
    
    subject = "Appointment Reminder"
    message = f"Reminder: {patient_name} has an appointment on {time_str}"

    # Add appointment type if available
    if appointment.get("appointmentType"):
        appt_type = appointment["appointmentType"].get("text", "")
        if appt_type:
            message += f" ({appt_type})"

    # TODO (2025-10-05): Migrate to HAPI FHIR Communication resources
    # notification = await create_system_notification(
    #     db=db,
    #     recipient_id=provider_id,
    #     subject=subject,
    #     message=message,
    #     priority="routine",
    #     category="reminder",
    #     patient_id=patient_id
    # )
    notification = None  # Temporarily disabled pending HAPI FHIR migration

    return notification

async def notify_medication_interaction(
    db: Session,
    provider_id: str,
    patient_id: str,
    medication1: str,
    medication2: str,
    severity: str,
    description: str
) -> Dict[str, Any]:
    """
    Create a notification for drug-drug interactions.
    
    Args:
        db: Database session
        provider_id: Provider ID to notify
        patient_id: Patient ID
        medication1: First medication name
        medication2: Second medication name
        severity: Interaction severity (high, moderate, low)
        description: Interaction description
        
    Returns:
        Created notification
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

    # TODO (2025-10-05): Migrate to HAPI FHIR Communication resources
    # notification = await create_system_notification(
    #     db=db,
    #     recipient_id=provider_id,
    #     subject=subject,
    #     message=message,
    #     priority=priority,
    #     category="alert",
    #     patient_id=patient_id
    # )
    notification = None  # Temporarily disabled pending HAPI FHIR migration

    return notification