"""
Administration Record (MAR) router — #116 Phase 5.1 + 5.2.

Endpoints (all under `/api/clinical/administration`):

- `GET /scheduled-tasks?patient_id=...&window_start=...&window_end=...`
  MAR grid payload: scheduled doses (with admin matches), PRN orders,
  unscheduled admins. Pure read.

- `GET /tasks?patient_id=...`  (Phase 5.2)
  Tasks-pane payload: pending non-medication recording tasks, bucketed into
  immunization / specimen / procedure ServiceRequest orders.

- `POST /record`
  Creates a MedicationAdministration against a signed MedicationRequest.

- `POST /record/immunization`, `/record/specimen`, `/record/procedure`  (Phase 5.2)
  Records a non-medication clinical event (Immunization / Specimen /
  Procedure) against its signed ServiceRequest order.

Every record endpoint refuses orders whose `status` is not in
`ADMINISTRABLE_STATUSES` (mirrors the pharmacy dispense gate from PR #139 —
a draft order is not yet a real instruction and must not produce a record).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status
from pydantic import BaseModel, Field

from services.hapi_fhir_client import HAPIFHIRClient
from api.websocket.fhir_notifications import notification_service

from .service import (
    ADMINISTRABLE_STATUSES,
    IMMUNIZATION_ORDER_EXTENSION,
    get_administration_tasks,
    get_scheduled_tasks,
)

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


@router.get("/tasks")
async def administration_tasks_endpoint(
    patient_id: str = Query(..., description="Bare patient FHIR id (no 'Patient/' prefix)"),
) -> dict[str, Any]:
    """Tasks-pane payload: pending non-medication recording tasks (#116 Phase 5.2).

    Returns active ServiceRequest orders bucketed into immunization /
    specimen / procedure tasks, each flagged `fulfilled` when a recording
    resource already links back to the order.
    """
    bundle = await get_administration_tasks(patient_id)
    return {
        "patient_id": bundle.patient_id,
        "immunizations": bundle.immunizations,
        "specimens": bundle.specimens,
        "procedures": bundle.procedures,
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

    # Broadcast so peer MAR views refetch live (failure-proof)
    patient_ref = (med_admin.get("subject") or {}).get("reference", "")
    await notification_service.notify_clinical_event(
        event_type="medication.administered",
        resource_type="MedicationAdministration",
        resource_id=new_id,
        patient_id=patient_ref.replace("Patient/", "") or None,
        details={
            "medication_request_id": body.medication_request_id,
            "action": body.action,
        },
    )

    return RecordAdministrationResponse(
        medication_administration_id=new_id,
        status=fhir_status,
        effective_datetime=effective,
    )


# =====================================================================
# Phase 5.2 — non-medication recording (Immunization / Specimen / Procedure)
# =====================================================================


class RecordImmunizationRequest(BaseModel):
    """Body for POST /record/immunization."""

    service_request_id: str = Field(..., description="The signed ServiceRequest immunization order")
    status: Literal["completed", "not-done", "entered-in-error"] = "completed"
    occurrence_datetime: Optional[datetime] = Field(None, description="When given; defaults to now")
    lot_number: Optional[str] = None
    expiration_date: Optional[str] = Field(None, description="Vaccine lot expiration (FHIR date)")
    route: Optional[str] = Field(None, description="Route, e.g. IM/SC/IN")
    site: Optional[str] = Field(None, description="Body site, e.g. left deltoid")
    dose_value: Optional[float] = Field(None, description="Dose quantity")
    dose_unit: Optional[str] = Field(None, description="Dose unit, e.g. mL")
    performer_reference: Optional[str] = Field(None, description="Practitioner/{id}; defaults to current user")
    reaction: Optional[str] = Field(None, description="Free-text adverse reaction, if any")
    status_reason: Optional[str] = Field(None, description="Required when status='not-done'")
    notes: Optional[str] = None


class RecordSpecimenRequest(BaseModel):
    """Body for POST /record/specimen."""

    service_request_id: str = Field(..., description="The signed ServiceRequest lab order")
    specimen_type: Optional[str] = Field(None, description="Specimen type text; defaults to the order's code")
    collected_datetime: Optional[datetime] = Field(None, description="When collected; defaults to now")
    collector_reference: Optional[str] = Field(None, description="Practitioner/{id}; defaults to current user")
    body_site: Optional[str] = Field(None, description="Collection body site")
    container: Optional[str] = Field(None, description="Container type, e.g. EDTA tube")
    quantity_value: Optional[float] = Field(None, description="Collected quantity")
    quantity_unit: Optional[str] = Field(None, description="Quantity unit, e.g. mL")
    notes: Optional[str] = None


class RecordProcedureRequest(BaseModel):
    """Body for POST /record/procedure."""

    service_request_id: str = Field(..., description="The signed ServiceRequest procedure order")
    status: Literal["completed", "in-progress", "not-done"] = "completed"
    performed_datetime: Optional[datetime] = Field(None, description="When performed; defaults to now")
    performer_reference: Optional[str] = Field(None, description="Practitioner/{id}; defaults to current user")
    outcome: Optional[str] = Field(None, description="Procedure outcome, e.g. successful")
    complication: Optional[str] = Field(None, description="Free-text complication, if any")
    status_reason: Optional[str] = Field(None, description="Required when status='not-done'")
    notes: Optional[str] = None


class RecordTaskResponse(BaseModel):
    """Shared response for the three Phase 5.2 record endpoints."""

    resource_id: str
    resource_type: str
    status: str


async def _read_administrable_service_request(
    hapi: HAPIFHIRClient,
    service_request_id: str,
) -> dict[str, Any]:
    """Read a ServiceRequest and enforce the administrability status gate.

    Mirrors the MedicationRequest gate in `record_administration_endpoint`:
    a draft (unsigned) or revoked order must not produce a recorded event.
    """
    service_request = await hapi.read("ServiceRequest", service_request_id)
    if not service_request:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"ServiceRequest/{service_request_id} not found",
        )
    order_status = service_request.get("status")
    if order_status not in ADMINISTRABLE_STATUSES:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot record against ServiceRequest in status '{order_status}'. "
                f"The order must be signed (status='active') before recording."
            ),
        )
    return service_request


async def _create_or_500(hapi: HAPIFHIRClient, resource_type: str, resource: dict[str, Any]) -> dict[str, Any]:
    """Write a resource to HAPI, mapping any failure to a 500 (logged)."""
    try:
        return await hapi.create(resource_type, resource)
    except Exception as exc:
        logger.error("Failed to create %s: %s", resource_type, exc, exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record {resource_type}: {exc}",
        ) from exc


@router.post(
    "/record/immunization",
    response_model=RecordTaskResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def record_immunization_endpoint(body: RecordImmunizationRequest) -> RecordTaskResponse:
    """Record an `Immunization` against a signed immunization ServiceRequest."""
    hapi = HAPIFHIRClient()
    service_request = await _read_administrable_service_request(hapi, body.service_request_id)

    if body.status == "not-done" and not body.status_reason:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="A status_reason is required when status='not-done'.",
        )

    occurrence = body.occurrence_datetime or datetime.now(timezone.utc)
    if occurrence.tzinfo is None:
        occurrence = occurrence.replace(tzinfo=timezone.utc)

    immunization: dict[str, Any] = {
        "resourceType": "Immunization",
        "status": body.status,
        # The order's `code` carries the CVX coding the prescriber chose.
        "vaccineCode": service_request.get("code") or {"text": "Unspecified vaccine"},
        "patient": service_request.get("subject") or {},
        "occurrenceDateTime": occurrence.isoformat(),
        "recorded": datetime.now(timezone.utc).isoformat(),
        # R4 Immunization has no `basedOn`; carry the order link on an extension.
        "extension": [{
            "url": IMMUNIZATION_ORDER_EXTENSION,
            "valueReference": {"reference": f"ServiceRequest/{body.service_request_id}"},
        }],
    }
    if service_request.get("encounter"):
        immunization["encounter"] = service_request["encounter"]
    if body.lot_number:
        immunization["lotNumber"] = body.lot_number
    if body.expiration_date:
        immunization["expirationDate"] = body.expiration_date
    if body.route:
        immunization["route"] = {"text": body.route}
    if body.site:
        immunization["site"] = {"text": body.site}
    if body.dose_value is not None and body.dose_unit:
        immunization["doseQuantity"] = {
            "value": body.dose_value,
            "unit": body.dose_unit,
            "system": "http://unitsofmeasure.org",
            "code": body.dose_unit,
        }
    immunization["performer"] = [{
        "actor": {"reference": body.performer_reference or "Practitioner/demo-physician"},
    }]
    if body.status == "not-done":
        immunization["statusReason"] = {"text": body.status_reason}

    # FHIR R4 Immunization.reaction.detail references an Observation; for the
    # educational use case a free-text reaction is recorded as a note rather
    # than spawning a dangling Observation reference.
    notes: list[dict[str, Any]] = []
    if body.reaction:
        notes.append({"text": f"Reaction: {body.reaction}"})
    if body.notes:
        notes.append({"text": body.notes})
    if notes:
        immunization["note"] = notes

    created = await _create_or_500(hapi, "Immunization", immunization)
    new_id = created.get("id")
    logger.info("Recorded Immunization/%s for ServiceRequest/%s", new_id, body.service_request_id)
    return RecordTaskResponse(resource_id=new_id, resource_type="Immunization", status=body.status)


@router.post(
    "/record/specimen",
    response_model=RecordTaskResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def record_specimen_endpoint(body: RecordSpecimenRequest) -> RecordTaskResponse:
    """Record a `Specimen` collection against a signed lab ServiceRequest."""
    hapi = HAPIFHIRClient()
    service_request = await _read_administrable_service_request(hapi, body.service_request_id)

    collected = body.collected_datetime or datetime.now(timezone.utc)
    if collected.tzinfo is None:
        collected = collected.replace(tzinfo=timezone.utc)

    specimen: dict[str, Any] = {
        "resourceType": "Specimen",
        "status": "available",
        "type": {"text": body.specimen_type} if body.specimen_type else (service_request.get("code") or {}),
        "subject": service_request.get("subject") or {},
        "receivedTime": datetime.now(timezone.utc).isoformat(),
        "request": [{"reference": f"ServiceRequest/{body.service_request_id}"}],
    }
    collection: dict[str, Any] = {"collectedDateTime": collected.isoformat()}
    collection["collector"] = {
        "reference": body.collector_reference or "Practitioner/demo-physician",
    }
    if body.body_site:
        collection["bodySite"] = {"text": body.body_site}
    if body.quantity_value is not None and body.quantity_unit:
        collection["quantity"] = {"value": body.quantity_value, "unit": body.quantity_unit}
    specimen["collection"] = collection
    if body.container:
        specimen["container"] = [{"type": {"text": body.container}}]
    if body.notes:
        specimen["note"] = [{"text": body.notes}]

    created = await _create_or_500(hapi, "Specimen", specimen)
    new_id = created.get("id")
    logger.info("Recorded Specimen/%s for ServiceRequest/%s", new_id, body.service_request_id)
    return RecordTaskResponse(resource_id=new_id, resource_type="Specimen", status="available")


@router.post(
    "/record/procedure",
    response_model=RecordTaskResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def record_procedure_endpoint(body: RecordProcedureRequest) -> RecordTaskResponse:
    """Record a `Procedure` against a signed procedure ServiceRequest."""
    hapi = HAPIFHIRClient()
    service_request = await _read_administrable_service_request(hapi, body.service_request_id)

    if body.status == "not-done" and not body.status_reason:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="A status_reason is required when status='not-done'.",
        )

    performed = body.performed_datetime or datetime.now(timezone.utc)
    if performed.tzinfo is None:
        performed = performed.replace(tzinfo=timezone.utc)

    procedure: dict[str, Any] = {
        "resourceType": "Procedure",
        "status": body.status,
        "code": service_request.get("code") or {"text": "Unspecified procedure"},
        "subject": service_request.get("subject") or {},
        "performedDateTime": performed.isoformat(),
        "basedOn": [{"reference": f"ServiceRequest/{body.service_request_id}"}],
    }
    if service_request.get("encounter"):
        procedure["encounter"] = service_request["encounter"]
    procedure["performer"] = [{
        "actor": {"reference": body.performer_reference or "Practitioner/demo-physician"},
    }]
    if body.outcome:
        procedure["outcome"] = {"text": body.outcome}
    if body.complication:
        procedure["complication"] = [{"text": body.complication}]
    if body.status == "not-done":
        procedure["statusReason"] = {"text": body.status_reason}
    if body.notes:
        procedure["note"] = [{"text": body.notes}]

    created = await _create_or_500(hapi, "Procedure", procedure)
    new_id = created.get("id")
    logger.info("Recorded Procedure/%s for ServiceRequest/%s", new_id, body.service_request_id)
    return RecordTaskResponse(resource_id=new_id, resource_type="Procedure", status=body.status)
