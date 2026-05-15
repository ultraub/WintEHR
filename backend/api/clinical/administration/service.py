"""
Administration service — aggregates active MedicationRequests with their
expanded schedules and existing MedicationAdministrations to produce the
data the MAR time grid renders.

The orchestration shape mirrors `drug_interactions.get_patient_medication_summary`
(parallel HAPI queries, pre-join everything the frontend needs to avoid
N-extra fetches per grid row). The novel piece here is the cross-reference
between scheduled doses (from `dose_scheduler`) and recorded
MedicationAdministrations — that's how the grid decides whether a cell is
"due" (no admin yet) versus "given" (a matching admin exists).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from services.dose_scheduler import ScheduledDose, compute_due_times
from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)

# Status whitelist mirroring `DISPENSABLE_STATUSES` from pharmacy_router.py:142.
# A draft, cancelled, or stopped order must not produce schedule rows — the
# nurse should not be invited to give doses against an unsigned or revoked
# order. Active is the only state where new administrations should happen;
# completed is included for the (rare) replay/audit case where someone
# documents a missed dose for a now-finished course.
ADMINISTRABLE_STATUSES = frozenset({"active", "completed"})

# How wide is the "given is a match for this scheduled dose" window? If a
# nurse charts a dose 45 minutes late, we still want the cell to flip to
# "given" rather than show both "given" AND "missed". The convention here
# matches what most US inpatient eMARs use: +/- 60 minutes from the
# scheduled time. Adjust later if a specific facility policy demands tighter.
ADMIN_MATCH_WINDOW = timedelta(minutes=60)

# ServiceRequest.category codings the Order Composer emits for the three
# non-medication task types the MAR Tasks pane (#116 Phase 5.2) records
# against. Matching is tolerant: a code OR a lower-cased category text.
# Immunization orders use SNOMED 33879002 (ImmunizationOrderTab); lab
# orders SNOMED 108252007; procedure orders SNOMED 387713003.
TASK_CATEGORY_IMMUNIZATION = frozenset({"33879002", "immunization"})
TASK_CATEGORY_SPECIMEN = frozenset({"108252007", "laboratory", "laboratory-procedure"})
TASK_CATEGORY_PROCEDURE = frozenset({"387713003", "procedure"})

# FHIR R4 `Immunization` has no `basedOn` element (it was added in R5).
# To still link a recorded Immunization back to its ordering ServiceRequest
# we carry the reference on this custom extension. Procedure (`basedOn`) and
# Specimen (`request`) use their native R4 elements — no extension needed.
IMMUNIZATION_ORDER_EXTENSION = "http://wintehr.local/fhir/StructureDefinition/immunization-order"


@dataclass(frozen=True)
class AdminRecord:
    """The relevant fields off a MedicationAdministration for grid rendering."""

    id: str
    medication_request_id: Optional[str]
    effective_datetime: datetime
    status: str  # 'completed', 'not-done', 'in-progress', 'on-hold', 'entered-in-error'
    performer_reference: Optional[str]
    dose_text: Optional[str]
    notes: Optional[str]
    # For 'not-done' admins, the documented reason ("patient refused", etc.)
    status_reason: Optional[str]


@dataclass(frozen=True)
class ScheduledTaskBundle:
    """The complete payload the MAR endpoint returns."""

    patient_id: str
    window_start: datetime
    window_end: datetime
    # Each scheduled dose, possibly matched to an admin record by time proximity
    scheduled: list[dict[str, Any]]
    # Active PRN orders — surfaced separately because they don't appear on the grid
    prn_orders: list[dict[str, Any]]
    # Admins that didn't match any scheduled time (late-charted unsolicited doses)
    unscheduled_admins: list[dict[str, Any]]


@dataclass(frozen=True)
class AdministrationTasksBundle:
    """Non-medication recording tasks for the MAR Tasks pane (#116 Phase 5.2).

    Each list holds the active ServiceRequest orders of one task type, with a
    `fulfilled` flag set when a recording resource already references the
    order. The frontend renders pending tasks as actionable cards and
    fulfilled ones as a muted "done" row.
    """

    patient_id: str
    immunizations: list[dict[str, Any]]
    specimens: list[dict[str, Any]]
    procedures: list[dict[str, Any]]


async def get_scheduled_tasks(
    patient_id: str,
    window_start: datetime,
    window_end: datetime,
) -> ScheduledTaskBundle:
    """Build the MAR payload: scheduled doses + admin matches + PRN list.

    Parallel HAPI queries for MedicationRequest and MedicationAdministration,
    then in-process expansion + matching. No DB writes — pure computation.
    """
    hapi = HAPIFHIRClient()

    # We deliberately do NOT filter MedicationRequest by status at the HAPI
    # level — the grid wants to surface "this order was just signed" too,
    # and we apply the administrability gate in code below where we can log
    # what we skipped for debuggability.
    med_request_bundle, admin_bundle = await _parallel_search(
        hapi,
        ("MedicationRequest", {"patient": f"Patient/{patient_id}", "_count": 200}),
        ("MedicationAdministration", {
            "patient": f"Patient/{patient_id}",
            # Effective date inside (or near) the window
            "effective-time": f"ge{(window_start - timedelta(hours=2)).isoformat()}",
            "_count": 500,
        }),
    )

    med_requests = _entries(med_request_bundle)
    admins = [_parse_admin(e["resource"]) for e in _entries(admin_bundle)]
    admins = [a for a in admins if a is not None]

    scheduled: list[dict[str, Any]] = []
    prn_orders: list[dict[str, Any]] = []
    consumed_admin_ids: set[str] = set()

    for entry in med_requests:
        med = entry["resource"]
        status = med.get("status")
        if status not in ADMINISTRABLE_STATUSES:
            logger.debug(
                "MedicationRequest/%s status=%r — skipping for MAR",
                med.get("id"), status,
            )
            continue

        instr = (med.get("dosageInstruction") or [{}])[0]
        if instr.get("asNeededBoolean") is True:
            prn_orders.append(_render_prn(med, admins))
            continue

        doses = compute_due_times(med, window_start, window_end)
        for dose in doses:
            scheduled.append(_match_dose(dose, admins, consumed_admin_ids, med))

    unscheduled_admins = [
        _render_admin(a) for a in admins if a.id not in consumed_admin_ids
    ]

    return ScheduledTaskBundle(
        patient_id=patient_id,
        window_start=window_start,
        window_end=window_end,
        scheduled=sorted(scheduled, key=lambda s: (s["scheduled_time"], s["medication_request_id"])),
        prn_orders=prn_orders,
        unscheduled_admins=unscheduled_admins,
    )


async def get_administration_tasks(patient_id: str) -> AdministrationTasksBundle:
    """Build the Tasks-pane payload: pending non-medication recording tasks.

    Parallel-queries the patient's ServiceRequests and the three recording
    resource types (Immunization / Specimen / Procedure), buckets the
    ServiceRequests by category coding, and marks each order fulfilled when a
    recording resource already links back to it. Pure read — no DB writes.
    """
    hapi = HAPIFHIRClient()

    sr_bundle, imm_bundle, spec_bundle, proc_bundle = await _parallel_search(
        hapi,
        ("ServiceRequest", {"patient": f"Patient/{patient_id}", "_count": 200}),
        ("Immunization", {"patient": f"Patient/{patient_id}", "_count": 200}),
        ("Specimen", {"patient": f"Patient/{patient_id}", "_count": 200}),
        ("Procedure", {"patient": f"Patient/{patient_id}", "_count": 200}),
    )

    # ServiceRequest id -> id of the recording resource that fulfils it.
    # Procedure links via `basedOn`, Specimen via `request` (both native R4
    # elements); Immunization has no R4 order element so it links via the
    # `IMMUNIZATION_ORDER_EXTENSION` extension.
    imm_by_order = _immunization_fulfillment_map(imm_bundle)
    spec_by_order = _fulfillment_map(spec_bundle, "request")
    proc_by_order = _fulfillment_map(proc_bundle, "basedOn")

    immunizations: list[dict[str, Any]] = []
    specimens: list[dict[str, Any]] = []
    procedures: list[dict[str, Any]] = []

    for entry in _entries(sr_bundle):
        sr = entry.get("resource") or {}
        if sr.get("status") not in ADMINISTRABLE_STATUSES:
            # Unsigned (draft) or revoked orders are not actionable tasks.
            continue
        codes = _sr_category_codes(sr)
        if codes & TASK_CATEGORY_IMMUNIZATION:
            immunizations.append(_render_task(sr, imm_by_order, "immunization"))
        elif codes & TASK_CATEGORY_SPECIMEN:
            specimens.append(_render_task(sr, spec_by_order, "specimen"))
        elif codes & TASK_CATEGORY_PROCEDURE:
            procedures.append(_render_task(sr, proc_by_order, "procedure"))

    return AdministrationTasksBundle(
        patient_id=patient_id,
        immunizations=_sort_tasks(immunizations),
        specimens=_sort_tasks(specimens),
        procedures=_sort_tasks(procedures),
    )


# ---------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------

async def _parallel_search(
    hapi: HAPIFHIRClient,
    *queries: tuple[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Run multiple HAPI searches concurrently. Each query is (resourceType, params)."""
    import asyncio

    return await asyncio.gather(
        *(hapi.search(rt, params) for rt, params in queries)
    )


def _entries(bundle: dict[str, Any]) -> list[dict[str, Any]]:
    """Pull the entry list from a FHIR Bundle, tolerating shape variations."""
    if not bundle:
        return []
    return bundle.get("entry") or []


def _parse_admin(resource: dict[str, Any]) -> Optional[AdminRecord]:
    """Convert a FHIR MedicationAdministration into the AdminRecord we work with.

    Returns None when the resource is missing required fields — we'd rather
    skip a malformed admin than crash the whole MAR fetch.
    """
    if not resource.get("id"):
        return None
    effective = resource.get("effectiveDateTime")
    if not effective:
        # FHIR allows effectivePeriod too; ignore for 5.1 since the
        # creation path always writes effectiveDateTime.
        return None
    try:
        parsed = datetime.fromisoformat(effective.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None

    request_ref = (resource.get("request") or {}).get("reference") or ""
    request_id = request_ref.split("/", 1)[1] if "/" in request_ref else None

    performer = (resource.get("performer") or [{}])[0]
    performer_ref = (performer.get("actor") or {}).get("reference")

    dose = ((resource.get("dosage") or {}).get("dose") or {})
    dose_text = None
    if dose.get("value") is not None and dose.get("unit"):
        dose_text = f"{dose['value']} {dose['unit']}"

    note = (resource.get("note") or [{}])[0]
    notes = note.get("text")

    status_reason = None
    sr = resource.get("statusReason") or []
    if sr:
        first = sr[0]
        status_reason = first.get("text") or (first.get("coding") or [{}])[0].get("display")

    return AdminRecord(
        id=resource["id"],
        medication_request_id=request_id,
        effective_datetime=parsed,
        status=resource.get("status", "unknown"),
        performer_reference=performer_ref,
        dose_text=dose_text,
        notes=notes,
        status_reason=status_reason,
    )


def _match_dose(
    dose: ScheduledDose,
    admins: list[AdminRecord],
    consumed_admin_ids: set[str],
    med_request: dict[str, Any],
) -> dict[str, Any]:
    """Find the best-matching admin for a scheduled dose, or return an unmatched cell."""
    # Best match = same MedicationRequest id, status=completed/in-progress,
    # effective time within ADMIN_MATCH_WINDOW of the scheduled time, and
    # not already consumed by an earlier scheduled dose. Closest-in-time wins.
    best: Optional[AdminRecord] = None
    best_delta: Optional[timedelta] = None
    for admin in admins:
        if admin.id in consumed_admin_ids:
            continue
        if admin.medication_request_id != dose.medication_request_id:
            continue
        # Held/not-done admins should also match their scheduled dose so the
        # cell can render the hold/refuse state instead of staying "due".
        delta = abs(admin.effective_datetime - dose.scheduled_time)
        if delta > ADMIN_MATCH_WINDOW:
            continue
        if best is None or delta < best_delta:
            best = admin
            best_delta = delta

    if best is not None:
        consumed_admin_ids.add(best.id)

    return {
        "medication_request_id": dose.medication_request_id,
        "scheduled_time": dose.scheduled_time.isoformat(),
        "dose_number": dose.dose_number,
        "medication_display": dose.medication_display,
        "dose_text": dose.dose_text,
        "route_text": dose.route_text,
        "high_alert": _is_high_alert(med_request),
        "indication": _indication_text(med_request),
        "administration": _render_admin(best) if best else None,
    }


def _render_admin(admin: AdminRecord) -> dict[str, Any]:
    return {
        "id": admin.id,
        "effective_datetime": admin.effective_datetime.isoformat(),
        "status": admin.status,
        "performer_reference": admin.performer_reference,
        "dose_text": admin.dose_text,
        "notes": admin.notes,
        "status_reason": admin.status_reason,
    }


def _render_prn(med_request: dict[str, Any], admins: list[AdminRecord]) -> dict[str, Any]:
    rx_id = med_request.get("id")
    instr = (med_request.get("dosageInstruction") or [{}])[0]
    related = [
        a for a in admins
        if a.medication_request_id == rx_id and a.status == "completed"
    ]
    related.sort(key=lambda a: a.effective_datetime, reverse=True)
    last_given = related[0].effective_datetime.isoformat() if related else None
    # Count administrations in the trailing 24h — a PRN "max dose/24h"
    # surfacing the count helps the nurse decide if another dose is safe.
    now = datetime.now(timezone.utc)
    last_24h = sum(
        1 for a in related
        if (now - a.effective_datetime) <= timedelta(hours=24)
    )
    medication_display = (
        (med_request.get("medicationCodeableConcept") or {}).get("text")
        or "(medication)"
    )
    return {
        "medication_request_id": rx_id,
        "medication_display": medication_display,
        "dose_text": instr.get("text") or "",
        "route_text": (instr.get("route") or {}).get("text") or "",
        "prn_reason": (instr.get("asNeededCodeableConcept") or {}).get("text")
                       or (instr.get("text") or ""),  # Some orders bury reason in text
        "high_alert": _is_high_alert(med_request),
        "indication": _indication_text(med_request),
        "last_given": last_given,
        "doses_in_last_24h": last_24h,
    }


# Hand-curated class list for the 5.1 high-alert badge. The full
# ISMP high-alert list is much longer; this is the "students will
# realistically see this on a Synthea patient" subset. Later sub-phases
# should pull from a ValueSet for completeness.
_HIGH_ALERT_KEYWORDS = (
    "warfarin", "heparin", "enoxaparin", "apixaban", "rivaroxaban",
    "insulin",
    "morphine", "fentanyl", "hydromorphone", "oxycodone", "methadone",
    "potassium chloride", "magnesium sulfate",
    "digoxin",
    "methotrexate",
)


def _is_high_alert(med_request: dict[str, Any]) -> bool:
    name = ((med_request.get("medicationCodeableConcept") or {}).get("text") or "").lower()
    return any(k in name for k in _HIGH_ALERT_KEYWORDS)


def _indication_text(med_request: dict[str, Any]) -> Optional[str]:
    reason_code = (med_request.get("reasonCode") or [{}])[0]
    text = reason_code.get("text") or (reason_code.get("coding") or [{}])[0].get("display")
    return text or None


def _sr_category_codes(sr: dict[str, Any]) -> set[str]:
    """Collect every category coding `code` plus lower-cased category `text`."""
    codes: set[str] = set()
    for cat in sr.get("category") or []:
        for coding in cat.get("coding") or []:
            code = coding.get("code")
            if code:
                codes.add(code)
        text = cat.get("text")
        if text:
            codes.add(text.strip().lower())
    return codes


def _fulfillment_map(bundle: dict[str, Any], ref_field: str) -> dict[str, str]:
    """Map ServiceRequest id -> id of a resource whose `ref_field` points at it.

    `ref_field` is `basedOn` (Immunization/Procedure) or `request` (Specimen);
    both are lists of FHIR References.
    """
    out: dict[str, str] = {}
    for entry in _entries(bundle):
        res = entry.get("resource") or {}
        res_id = res.get("id")
        if not res_id:
            continue
        for ref in res.get(ref_field) or []:
            target = (ref or {}).get("reference") or ""
            if target.startswith("ServiceRequest/"):
                # First fulfilment wins — a re-recorded order is rare and the
                # pane only needs *a* link to flip the card to "done".
                out.setdefault(target.split("/", 1)[1], res_id)
    return out


def _immunization_fulfillment_map(bundle: dict[str, Any]) -> dict[str, str]:
    """Map ServiceRequest id -> Immunization id via `IMMUNIZATION_ORDER_EXTENSION`.

    Separate from `_fulfillment_map` because R4 Immunization carries the order
    link on an extension rather than a `basedOn`/`request` element.
    """
    out: dict[str, str] = {}
    for entry in _entries(bundle):
        res = entry.get("resource") or {}
        res_id = res.get("id")
        if not res_id:
            continue
        for ext in res.get("extension") or []:
            if ext.get("url") != IMMUNIZATION_ORDER_EXTENSION:
                continue
            target = (ext.get("valueReference") or {}).get("reference") or ""
            if target.startswith("ServiceRequest/"):
                out.setdefault(target.split("/", 1)[1], res_id)
    return out


def _render_task(
    sr: dict[str, Any],
    fulfillment_map: dict[str, str],
    task_type: str,
) -> dict[str, Any]:
    sr_id = sr.get("id")
    code = sr.get("code") or {}
    first_coding = (code.get("coding") or [{}])[0]
    code_display = (
        code.get("text")
        or first_coding.get("display")
        or "(unspecified)"
    )
    fulfillment_id = fulfillment_map.get(sr_id)
    return {
        "service_request_id": sr_id,
        "task_type": task_type,
        "code": first_coding.get("code"),
        "code_system": first_coding.get("system"),
        "code_display": code_display,
        "ordered_datetime": sr.get("authoredOn"),
        "priority": sr.get("priority"),
        "order_status": sr.get("status"),
        "fulfilled": fulfillment_id is not None,
        "fulfillment_id": fulfillment_id,
    }


def _sort_tasks(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pending tasks first, each group most-recently-ordered first."""
    def _ordered(t: dict[str, Any]) -> str:
        return t.get("ordered_datetime") or ""

    pending = sorted((t for t in tasks if not t["fulfilled"]), key=_ordered, reverse=True)
    done = sorted((t for t in tasks if t["fulfilled"]), key=_ordered, reverse=True)
    return pending + done
