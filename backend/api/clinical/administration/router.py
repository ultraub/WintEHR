"""
Administration Record (MAR) router — #116 Phase 5.1.

Two endpoints:

- `GET /api/clinical/administration/scheduled-tasks?patient_id=...&window_start=...&window_end=...`
  Returns the MAR payload: scheduled doses (with admin matches), PRN orders,
  unscheduled admins. Pure read, no DB writes.

- `POST /api/clinical/administration/record`
  Creates a MedicationAdministration resource in HAPI. Refuses orders where
  `status` is not in `ADMINISTRABLE_STATUSES` (mirrors the pharmacy dispense
  gate from PR #139 — same philosophy: a draft order is not yet a real
  instruction and must not produce a recorded administration).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status
from pydantic import BaseModel, Field

from services.hapi_fhir_client import HAPIFHIRClient

from .service import ADMINISTRABLE_STATUSES, get_scheduled_tasks

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/clinical/administration",
    tags=["Clinical Administration (MAR)"],
)


class RecordAdministrationRequest(BaseModel):
    """Body for POST /record.

    The action field switches the resource shape we build:
    - "given" → MedicationAdministration.status = "completed"
    - "held" → MedicationAdministration.status = "on-hold" + statusReason
    - "refused" → MedicationAdministration.status = "not-done" + statusReason
    - "late-given" → same as "given" but flags that effectiveDateTime is
      after the scheduled time
    """
    medication_request_id: str = Field(..., description="The signed MedicationRequest to chart against")
    action: Literal["given", "held", "refused", "late-given"]
    scheduled_time: Optional[datetime] = Field(
        None,
        description="The grid cell's scheduled time. Carried on a Provenance-style "
                    "extension so audit logs can correlate the chart cell to the record.",
    )
    effective_datetime: Optional[datetime] = Field(
        None,
        description="When the dose was actually given/withheld. Defaults to now.",
    )
    dose_value: Optional[float] = Field(None, description="Dose quantity actually given")
    dose_unit: Optional[str] = Field(None, description="Dose unit (mg, mL, units, ...)")
    route: Optional[str] = Field(None, description="Route of administration, e.g. PO/IV/SC")
    site: Optional[str] = Field(None, description="Body site / injection location")
    performer_reference: Optional[str] = Field(
        None,
        description="Practitioner/{id} reference; defaults to current user",
    )
    reason: Optional[str] = Field(
        None,
        description="Required for held/refused: documented reason "
                    "(e.g., 'patient refused', 'NPO for procedure').",
    )
    notes: Optional[str] = Field(None, description="Free-text note added to the record")


class RecordAdministrationResponse(BaseModel):
    medication_administration_id: str
    status: str
    effective_datetime: datetime


@router.get("/scheduled-tasks")
async def scheduled_tasks_endpoint(
    patient_id: str = Query(..., description="Bare patient FHIR id (no 'Patient/' prefix)"),
    window_start: Optional[datetime] = Query(
        None,
        description="ISO start of the MAR window. Defaults to 6h before now.",
    ),
    window_end: Optional[datetime] = Query(
        None,
        description="ISO end of the MAR window. Defaults to 6h after now.",
    ),
) -> dict[str, Any]:
    """Build the MAR payload for a single patient.

    The default 12h window (6h back + 6h forward) matches the grid's
    default column span. Callers can shrink/widen it.
    """
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    window_start = window_start or (now - timedelta(hours=6))
    window_end = window_end or (now + timedelta(hours=6))

    # tz-aware all the way through; if a caller sent naive datetimes
    # (which FastAPI sometimes does for ?param=...), pin to UTC.
    if window_start.tzinfo is None:
        window_start = window_start.replace(tzinfo=timezone.utc)
    if window_end.tzinfo is None:
        window_end = window_end.replace(tzinfo=timezone.utc)

    if window_end <= window_start:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="window_end must be strictly after window_start",
        )

    bundle = await get_scheduled_tasks(patient_id, window_start, window_end)

    return {
        "patient_id": bundle.patient_id,
        "window_start": bundle.window_start.isoformat(),
        "window_end": bundle.window_end.isoformat(),
        "scheduled": bundle.scheduled,
        "prn_orders": bundle.prn_orders,
        "unscheduled_admins": bundle.unscheduled_admins,
    }


@router.post(
    "/record",
    response_model=RecordAdministrationResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def record_administration_endpoint(body: RecordAdministrationRequest) -> RecordAdministrationResponse:
    """Create a `MedicationAdministration` resource against a signed order.

    Status gate (mirrors `DISPENSABLE_STATUSES` from `pharmacy_router.py:142`):
    refuses orders that are not in `ADMINISTRABLE_STATUSES`. A draft order
    is not yet a real instruction — recording an admin against one would
    create an unauditable mismatch between the chart and the order.
    """
    hapi = HAPIFHIRClient()

    med_request = await hapi.read("MedicationRequest", body.medication_request_id)
    if not med_request:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"MedicationRequest/{body.medication_request_id} not found",
        )

    order_status = med_request.get("status")
    if order_status not in ADMINISTRABLE_STATUSES:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot record administration for MedicationRequest in status "
                f"'{order_status}'. The order must be signed (status='active') "
                f"before administration recording."
            ),
        )

    # Held / refused must carry a reason — clinical guidelines and audit
    # require it. We enforce it here so the resource is well-formed before
    # it lands in HAPI.
    if body.action in ("held", "refused") and not body.reason:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"A reason is required when action='{body.action}'.",
        )

    effective = body.effective_datetime or datetime.now(timezone.utc)
    if effective.tzinfo is None:
        effective = effective.replace(tzinfo=timezone.utc)

    # Translate the action into FHIR status. The spec values used here
    # match what `pharmacy_router.record_medication_administration` writes,
    # so existing readers (the dispense flow, future reports) keep working.
    status_map = {
        "given": "completed",
        "late-given": "completed",
        "held": "on-hold",
        "refused": "not-done",
    }
    fhir_status = status_map[body.action]

    # Build the MedicationAdministration. Pre-populates from the order so
    # consumers don't have to read both resources to render dose/route/etc.
    subject = med_request.get("subject") or {}
    med_admin: dict[str, Any] = {
        "resourceType": "MedicationAdministration",
        "status": fhir_status,
        "medicationCodeableConcept": med_request.get("medicationCodeableConcept"),
        "subject": subject,
        "effectiveDateTime": effective.isoformat(),
        "request": {"reference": f"MedicationRequest/{body.medication_request_id}"},
    }
    if med_request.get("encounter"):
        med_admin["context"] = med_request["encounter"]

    performer_ref = body.performer_reference or "Practitioner/demo-physician"
    med_admin["performer"] = [{"actor": {"reference": performer_ref}}]

    if body.action in ("given", "late-given"):
        dose: dict[str, Any] = {}
        if body.dose_value is not None and body.dose_unit:
            dose["dose"] = {
                "value": body.dose_value,
                "unit": body.dose_unit,
                "system": "http://unitsofmeasure.org",
                "code": body.dose_unit,
            }
        if body.route:
            dose["route"] = {"text": body.route}
        if body.site:
            dose["site"] = {"text": body.site}
        if dose:
            med_admin["dosage"] = dose

    if body.reason:
        # FHIR spec: reason for held/refused goes on `statusReason`; reason
        # for given (rare — usually for late doses) goes on `reasonCode`.
        # The text-only shape is sufficient for the educational use case.
        target = "statusReason" if body.action in ("held", "refused") else "reasonCode"
        med_admin[target] = [{"text": body.reason}]

    if body.notes:
        med_admin["note"] = [{"text": body.notes, "time": effective.isoformat()}]

    # Carry the grid-cell scheduled time on a non-standard extension. The
    # nurse-side audit can now answer "was this on-time?" without
    # re-deriving the schedule from the MedicationRequest.
    if body.scheduled_time:
        scheduled = body.scheduled_time
        if scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=timezone.utc)
        med_admin["extension"] = [{
            "url": "http://wintehr.local/fhir/StructureDefinition/scheduled-dose-time",
            "valueDateTime": scheduled.isoformat(),
        }]
        # Late-given is a derived signal — we still write status="completed"
        # but document the lateness on a separate extension for clarity.
        if body.action == "late-given":
            med_admin["extension"].append({
                "url": "http://wintehr.local/fhir/StructureDefinition/late-charted",
                "valueBoolean": True,
            })

    try:
        created = await hapi.create("MedicationAdministration", med_admin)
    except Exception as exc:
        logger.error(
            "Failed to create MedicationAdministration for MedicationRequest/%s: %s",
            body.medication_request_id, exc, exc_info=True,
        )
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record administration: {exc}",
        ) from exc

    new_id = created.get("id")
    logger.info(
        "Recorded MedicationAdministration/%s (action=%s) for MedicationRequest/%s",
        new_id, body.action, body.medication_request_id,
    )

    return RecordAdministrationResponse(
        medication_administration_id=new_id,
        status=fhir_status,
        effective_datetime=effective,
    )
