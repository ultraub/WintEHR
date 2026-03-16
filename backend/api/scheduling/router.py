"""
Scheduling & Appointments API endpoints.

Provides appointment management for the WintEHR educational EHR system.
All FHIR Appointment resources are stored in HAPI FHIR via HAPIFHIRClient.
The backend adds business logic (status transition validation, search
convenience, provider listing) on top of the standard FHIR operations.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone
from pydantic import BaseModel, Field
import logging

from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scheduling", tags=["Scheduling"])

# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------

class AppointmentCreateRequest(BaseModel):
    """Request body for creating a new appointment."""
    patientId: str = Field(..., description="FHIR Patient resource ID (e.g. 'abc-123')")
    practitionerId: str = Field(..., description="FHIR Practitioner resource ID")
    appointmentType: str = Field(
        "ROUTINE",
        description="Appointment type code (ROUTINE, WALKIN, CHECKUP, FOLLOWUP, EMERGENCY)",
    )
    start: str = Field(..., description="ISO-8601 start datetime (e.g. '2026-03-15T09:00:00Z')")
    end: str = Field(..., description="ISO-8601 end datetime (e.g. '2026-03-15T09:30:00Z')")
    reason: Optional[str] = Field(None, description="Free-text reason for the appointment")


class AppointmentStatusUpdate(BaseModel):
    """Request body for updating appointment status."""
    status: str = Field(
        ...,
        description="New status: proposed, pending, booked, arrived, fulfilled, cancelled, noshow",
    )


class AppointmentSummary(BaseModel):
    """Flattened appointment summary returned to the frontend."""
    id: str
    status: str
    appointmentType: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    patientId: Optional[str] = None
    patientName: Optional[str] = None
    practitionerId: Optional[str] = None
    practitionerName: Optional[str] = None
    reason: Optional[str] = None


class ProviderSummary(BaseModel):
    """Lightweight practitioner record for dropdowns."""
    id: str
    name: str
    specialty: Optional[str] = None


# ---------------------------------------------------------------------------
# Valid FHIR Appointment statuses and allowed transitions
# ---------------------------------------------------------------------------

VALID_STATUSES = {
    "proposed", "pending", "booked", "arrived",
    "fulfilled", "cancelled", "noshow", "entered-in-error",
}

# Allowed status transitions (simplified for educational purposes)
ALLOWED_TRANSITIONS: Dict[str, set] = {
    "proposed": {"pending", "booked", "cancelled"},
    "pending": {"booked", "cancelled"},
    "booked": {"arrived", "cancelled", "noshow"},
    "arrived": {"fulfilled", "cancelled", "noshow"},
    "fulfilled": set(),
    "cancelled": set(),
    "noshow": set(),
    "entered-in-error": set(),
}

APPOINTMENT_TYPE_DISPLAY: Dict[str, str] = {
    "ROUTINE": "Routine",
    "WALKIN": "Walk-in",
    "CHECKUP": "Checkup",
    "FOLLOWUP": "Follow-up",
    "EMERGENCY": "Emergency",
}

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _extract_appointment_summary(resource: Dict[str, Any]) -> AppointmentSummary:
    """
    Transform a raw FHIR Appointment resource dict into a flat
    AppointmentSummary suitable for the frontend.
    """
    patient_id = None
    patient_name = None
    practitioner_id = None
    practitioner_name = None

    for participant in resource.get("participant", []):
        actor = participant.get("actor", {})
        reference = actor.get("reference", "")
        display = actor.get("display")

        if reference.startswith("Patient/"):
            patient_id = reference.replace("Patient/", "")
            patient_name = display
        elif reference.startswith("Practitioner/"):
            practitioner_id = reference.replace("Practitioner/", "")
            practitioner_name = display

    # Extract appointment type display text
    appt_type = None
    appt_type_obj = resource.get("appointmentType")
    if appt_type_obj:
        codings = appt_type_obj.get("coding", [])
        if codings:
            appt_type = codings[0].get("display") or codings[0].get("code")

    # Extract reason text
    reason = None
    reason_codes = resource.get("reasonCode", [])
    if reason_codes:
        reason = reason_codes[0].get("text")

    return AppointmentSummary(
        id=resource.get("id", ""),
        status=resource.get("status", "unknown"),
        appointmentType=appt_type,
        start=resource.get("start"),
        end=resource.get("end"),
        patientId=patient_id,
        patientName=patient_name,
        practitionerId=practitioner_id,
        practitionerName=practitioner_name,
        reason=reason,
    )


def _build_fhir_appointment(req: AppointmentCreateRequest) -> Dict[str, Any]:
    """Build a FHIR Appointment resource dict from the create request."""
    display = APPOINTMENT_TYPE_DISPLAY.get(req.appointmentType, req.appointmentType)

    resource: Dict[str, Any] = {
        "resourceType": "Appointment",
        "status": "booked",
        "appointmentType": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                    "code": req.appointmentType,
                    "display": display,
                }
            ],
            "text": display,
        },
        "start": req.start,
        "end": req.end,
        "participant": [
            {
                "actor": {"reference": f"Patient/{req.patientId}"},
                "required": "required",
                "status": "accepted",
            },
            {
                "actor": {"reference": f"Practitioner/{req.practitionerId}"},
                "required": "required",
                "status": "accepted",
            },
        ],
    }

    if req.reason:
        resource["reasonCode"] = [{"text": req.reason}]

    return resource


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/appointments", response_model=List[AppointmentSummary])
async def list_appointments(
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD)"),
    provider: Optional[str] = Query(None, description="Practitioner FHIR ID"),
    patient: Optional[str] = Query(None, description="Patient FHIR ID"),
    status: Optional[str] = Query(None, description="Appointment status filter"),
):
    """
    Search for appointments with optional filters.

    Queries HAPI FHIR for Appointment resources and returns a flattened
    list with patient name, provider, time, type, and status.
    """
    hapi_client = HAPIFHIRClient()
    params: Dict[str, str] = {"_sort": "date", "_count": "100"}

    if date:
        params["date"] = date
    if provider:
        params["actor"] = f"Practitioner/{provider}"
    if patient:
        params["actor"] = f"Patient/{patient}"
    if status:
        params["status"] = status

    try:
        bundle = await hapi_client.search("Appointment", params)
        entries = bundle.get("entry", [])
        return [
            _extract_appointment_summary(entry.get("resource", entry))
            for entry in entries
        ]
    except Exception as e:
        logger.error(f"Failed to search appointments: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve appointments")


@router.get("/appointments/today", response_model=List[AppointmentSummary])
async def list_todays_appointments(
    provider: Optional[str] = Query(None, description="Practitioner FHIR ID"),
):
    """
    Convenience endpoint returning today's appointments.

    Useful for the daily schedule view on the frontend.
    """
    hapi_client = HAPIFHIRClient()
    today_str = date.today().isoformat()
    params: Dict[str, str] = {
        "date": today_str,
        "_sort": "date",
        "_count": "100",
    }

    if provider:
        params["actor"] = f"Practitioner/{provider}"

    try:
        bundle = await hapi_client.search("Appointment", params)
        entries = bundle.get("entry", [])
        return [
            _extract_appointment_summary(entry.get("resource", entry))
            for entry in entries
        ]
    except Exception as e:
        logger.error(f"Failed to fetch today's appointments: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve today's appointments")


@router.post("/appointments", response_model=AppointmentSummary, status_code=201)
async def create_appointment(request: AppointmentCreateRequest):
    """
    Create a new FHIR Appointment resource.

    Validates the request, builds a FHIR-compliant Appointment resource,
    and persists it via HAPI FHIR. Defaults status to 'booked'.
    """
    hapi_client = HAPIFHIRClient()

    # Validate datetime parsing
    try:
        datetime.fromisoformat(request.start.replace("Z", "+00:00"))
        datetime.fromisoformat(request.end.replace("Z", "+00:00"))
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid datetime format. Use ISO-8601 (e.g. 2026-03-15T09:00:00Z): {e}",
        )

    # Validate referenced resources exist
    try:
        await hapi_client.read("Patient", request.patientId)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Patient/{request.patientId} not found in FHIR server")

    try:
        await hapi_client.read("Practitioner", request.practitionerId)
    except Exception:
        raise HTTPException(
            status_code=404,
            detail=f"Practitioner/{request.practitionerId} not found in FHIR server",
        )

    fhir_resource = _build_fhir_appointment(request)

    try:
        created = await hapi_client.create("Appointment", fhir_resource)
        return _extract_appointment_summary(created)
    except Exception as e:
        logger.error(f"Failed to create appointment: {e}")
        raise HTTPException(status_code=500, detail="Failed to create appointment")


@router.put("/appointments/{appointment_id}/status", response_model=AppointmentSummary)
async def update_appointment_status(
    appointment_id: str,
    body: AppointmentStatusUpdate,
):
    """
    Update the status of an existing appointment.

    Validates the requested status transition against allowed FHIR
    Appointment status workflows before persisting the change.
    """
    hapi_client = HAPIFHIRClient()
    new_status = body.status.lower()

    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    # Read existing appointment
    try:
        existing = await hapi_client.read("Appointment", appointment_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Appointment/{appointment_id} not found")

    current_status = existing.get("status", "")

    # Validate transition
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Cannot transition from '{current_status}' to '{new_status}'. "
                f"Allowed transitions: {', '.join(sorted(allowed)) if allowed else 'none (terminal state)'}"
            ),
        )

    existing["status"] = new_status

    try:
        updated = await hapi_client.update("Appointment", appointment_id, existing)
        return _extract_appointment_summary(updated)
    except Exception as e:
        logger.error(f"Failed to update appointment status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update appointment status")


@router.get("/providers", response_model=List[ProviderSummary])
async def list_providers():
    """
    List available practitioners from HAPI FHIR.

    Returns a simplified provider list suitable for scheduling UI
    dropdowns and provider selection.
    """
    hapi_client = HAPIFHIRClient()

    try:
        bundle = await hapi_client.search("Practitioner", {"_count": "100", "active": "true"})
        entries = bundle.get("entry", [])
        providers: List[ProviderSummary] = []

        for entry in entries:
            resource = entry.get("resource", entry)
            practitioner_id = resource.get("id", "")

            # Build display name from HumanName
            names = resource.get("name", [])
            display_name = "Unknown"
            if names:
                name_obj = names[0]
                family = name_obj.get("family", "")
                given = " ".join(name_obj.get("given", []))
                prefix = " ".join(name_obj.get("prefix", []))
                parts = [p for p in [prefix, given, family] if p]
                display_name = " ".join(parts) if parts else "Unknown"

            # Extract specialty from qualification if available
            specialty = None
            qualifications = resource.get("qualification", [])
            if qualifications:
                code_obj = qualifications[0].get("code", {})
                coding = code_obj.get("coding", [])
                if coding:
                    specialty = coding[0].get("display")
                if not specialty:
                    specialty = code_obj.get("text")

            providers.append(
                ProviderSummary(
                    id=practitioner_id,
                    name=display_name,
                    specialty=specialty,
                )
            )

        return providers
    except Exception as e:
        logger.error(f"Failed to list providers: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve provider list")
