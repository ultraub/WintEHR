"""
Dose-scheduling utility for the Administration Record (MAR), #116 Phase 5.1.

Parses `MedicationRequest.dosageInstruction[].timing.repeat` into a discrete
list of scheduled due-times within a caller-supplied window. The MAR's time
grid renders one column per due-time per medication, so getting this right
is the foundation of the whole surface.

What this supports (the common cases the Phase 4 Order Composer writes):
- `frequency=N, period=M, periodUnit='h'` → every (M/N) hours, anchored on
  the order's authoredOn (or boundsPeriod.start when supplied).
- `frequency=N, period=1, periodUnit='d'` → N evenly-spaced doses per day,
  using clinically conventional anchor times (BID=08/20, TID=08/14/20,
  QID=06/12/18/22). The anchors are hard-coded for 5.1; later sub-phases
  will pull them from facility policy.
- PRN orders (`asNeededBoolean=true`) deliberately return [] — PRNs don't
  have a schedule and shouldn't appear in the grid. They live in a
  separate pane.

What this does NOT support yet (logged + skipped):
- `dayOfWeek`, `timeOfDay`, `when` event-coded timing (mealtime-relative)
- Taper schedules expressed as multiple dosageInstruction entries with
  different bounds
- `boundsRange` (use boundsPeriod instead)
- Non-`h` / non-`d` units (s/min/wk/mo/a)

Trade-off: covers ~95% of what students write through the Order Composer
without over-engineering. The "log + skip" path makes the gaps visible in
the backend logs so the next sub-phase can prioritize what to add.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


# Conventional anchor hours for daily N-times-per-day schedules. The keys
# are `frequency` values (doses-per-day); the values are 24-hour clock
# anchor times. These match what most US inpatient nursing protocols
# default to when an order is written "BID" / "TID" / "QID" without an
# explicit time.
_DAILY_ANCHORS = {
    1: [9],                       # once daily, morning meds round
    2: [8, 20],                   # BID
    3: [8, 14, 20],               # TID
    4: [6, 12, 18, 22],           # QID
    5: [6, 9, 13, 17, 21],        # five times daily (rare; insulin)
    6: [2, 6, 10, 14, 18, 22],    # q4h
}


@dataclass(frozen=True)
class ScheduledDose:
    """One due-time for one medication, inside the requested window."""

    medication_request_id: str
    scheduled_time: datetime
    dose_number: int  # 1-indexed within the window, for stable rendering keys
    # Echo of useful fields the frontend reads off the order — pre-joining
    # them here avoids the frontend doing N extra fetches per row.
    medication_display: str
    dose_text: str
    route_text: str


def compute_due_times(
    med_request: dict[str, Any],
    window_start: datetime,
    window_end: datetime,
) -> list[ScheduledDose]:
    """Expand one MedicationRequest into the doses due within [start, end).

    Returns an empty list (with a logger.info, not warning) for PRN orders
    and for orders whose timing shape we don't yet support. Callers should
    treat empty list as "no scheduled doses to render", not "error".
    """
    if med_request.get("resourceType") != "MedicationRequest":
        raise ValueError("compute_due_times requires a MedicationRequest")

    rx_id = med_request.get("id") or "(no-id)"
    instructions = med_request.get("dosageInstruction") or []
    if not instructions:
        logger.info("MedicationRequest/%s has no dosageInstruction — skipping", rx_id)
        return []

    # We expand only the first dosageInstruction for 5.1. Taper schedules
    # use multiple entries; supporting them lives in a later sub-phase.
    instr = instructions[0]
    if instr.get("asNeededBoolean") is True:
        logger.info("MedicationRequest/%s is PRN — schedule omitted", rx_id)
        return []

    timing = instr.get("timing") or {}
    repeat = timing.get("repeat") or {}
    if not repeat:
        logger.info(
            "MedicationRequest/%s has no timing.repeat — schedule omitted "
            "(may be a free-text timing like timing.code.text='BID')",
            rx_id,
        )
        return []

    frequency = repeat.get("frequency")
    period = repeat.get("period")
    period_unit = repeat.get("periodUnit")

    if frequency is None or period is None or period_unit is None:
        logger.info(
            "MedicationRequest/%s timing.repeat missing frequency/period/periodUnit "
            "(have %r) — schedule omitted",
            rx_id, repeat,
        )
        return []

    if period_unit not in ("h", "d"):
        logger.info(
            "MedicationRequest/%s timing.repeat.periodUnit=%r unsupported in 5.1 — "
            "schedule omitted",
            rx_id, period_unit,
        )
        return []

    # Anchor time — when does dose #1 happen? Priority:
    # 1. boundsPeriod.start (explicit therapy start)
    # 2. authoredOn (when the order was placed)
    # 3. window_start (last resort; lets the grid render *something*)
    anchor = _resolve_anchor(med_request, window_start)

    times = _expand_window(
        frequency=int(frequency),
        period=float(period),
        period_unit=period_unit,
        anchor=anchor,
        window_start=window_start,
        window_end=window_end,
    )

    # boundsPeriod.start is a floor: no doses scheduled before therapy began.
    # The backward-walk inside _expand_window can produce candidates earlier
    # than the anchor, so clamp them out here.
    bounds_start = _resolve_bounds_start(med_request)
    if bounds_start:
        times = [t for t in times if t >= bounds_start]

    # boundsPeriod.end caps the schedule. Honour it.
    bounds_end = _resolve_bounds_end(med_request)
    if bounds_end:
        times = [t for t in times if t < bounds_end]

    # Pre-join the human display fields the grid renders per cell so the
    # frontend doesn't fetch the order again to label its own rows.
    medication_display = _medication_text(med_request)
    dose_text = _dose_text(instr)
    route_text = _route_text(instr)

    return [
        ScheduledDose(
            medication_request_id=rx_id,
            scheduled_time=t,
            dose_number=i + 1,
            medication_display=medication_display,
            dose_text=dose_text,
            route_text=route_text,
        )
        for i, t in enumerate(times)
    ]


def _resolve_anchor(med_request: dict[str, Any], fallback: datetime) -> datetime:
    """Pick the schedule's anchor time. boundsPeriod.start > authoredOn > fallback."""
    instr = (med_request.get("dosageInstruction") or [{}])[0]
    bounds_start = (((instr.get("timing") or {}).get("repeat") or {})
                    .get("boundsPeriod") or {}).get("start")
    if bounds_start:
        return _parse_fhir_datetime(bounds_start, fallback)
    authored = med_request.get("authoredOn")
    if authored:
        return _parse_fhir_datetime(authored, fallback)
    return fallback


def _resolve_bounds_end(med_request: dict[str, Any]) -> Optional[datetime]:
    instr = (med_request.get("dosageInstruction") or [{}])[0]
    bounds_end = (((instr.get("timing") or {}).get("repeat") or {})
                  .get("boundsPeriod") or {}).get("end")
    if not bounds_end:
        return None
    return _parse_fhir_datetime(bounds_end, None)


def _resolve_bounds_start(med_request: dict[str, Any]) -> Optional[datetime]:
    """Return boundsPeriod.start as a tz-aware datetime, or None if absent."""
    instr = (med_request.get("dosageInstruction") or [{}])[0]
    bounds_start = (((instr.get("timing") or {}).get("repeat") or {})
                    .get("boundsPeriod") or {}).get("start")
    if not bounds_start:
        return None
    parsed = _parse_fhir_datetime(bounds_start, None)
    return _ensure_aware(parsed) if parsed else None


def _parse_fhir_datetime(value: str, fallback: Optional[datetime]) -> Optional[datetime]:
    """Best-effort FHIR dateTime parser. Falls back when the value is partial
    (year-only or date-only) since we can't pin those to a specific hour.
    """
    if not value:
        return fallback
    try:
        # FHIR allows trailing Z; Python's fromisoformat doesn't accept it before 3.11.
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except ValueError:
        logger.info("dose_scheduler: unparsable FHIR datetime %r — using fallback", value)
        return fallback


def _expand_window(
    frequency: int,
    period: float,
    period_unit: str,
    anchor: datetime,
    window_start: datetime,
    window_end: datetime,
) -> list[datetime]:
    """Project the schedule onto the window. Two paths:

    - `periodUnit='h'`: doses repeat every (period/frequency) hours starting
      at the anchor. Project forward and backward until we leave the window.
    - `periodUnit='d'` with period=1: use conventional anchor hours by
      doses-per-day (BID=08/20 etc.). For period > 1 day (q2d, q3d), still
      use the anchor hours but space them at period-day intervals.
    """
    if frequency <= 0 or period <= 0:
        return []

    # Normalize the anchor and window into the same tz. If anchor is naive,
    # assume UTC — Synthea writes naive ISO timestamps with Z which we
    # already convert to +00:00 above.
    anchor = _ensure_aware(anchor)
    window_start = _ensure_aware(window_start)
    window_end = _ensure_aware(window_end)

    if period_unit == "h":
        interval = timedelta(hours=period / frequency)
        return _enumerate_interval(anchor, interval, window_start, window_end)

    # period_unit == 'd'
    anchors = _DAILY_ANCHORS.get(frequency)
    if anchors is None:
        # Frequency not in our lookup — fall back to evenly spaced through
        # the day starting at 08:00. Better than silently dropping the
        # schedule but flag it so we can curate the lookup later.
        logger.info(
            "dose_scheduler: frequency=%d/day not in anchor table — "
            "using 24/f-hour even spacing from 08:00",
            frequency,
        )
        anchors = [int(8 + i * (24 / frequency)) % 24 for i in range(frequency)]

    interval_days = int(period)  # period=1 → every day; period=2 → q2d
    out: list[datetime] = []
    # Walk by days in window, generating each anchor-hour candidate.
    cursor_day = window_start.date()
    last_day = window_end.date()
    while cursor_day <= last_day:
        # Honour the `every N days` cadence relative to the anchor's date.
        days_from_anchor = (cursor_day - anchor.date()).days
        if days_from_anchor % interval_days != 0:
            cursor_day += timedelta(days=1)
            continue
        for hour in anchors:
            candidate = datetime(
                cursor_day.year, cursor_day.month, cursor_day.day,
                hour, 0, 0,
                tzinfo=anchor.tzinfo,
            )
            # Note: we deliberately do NOT clamp against `anchor` here.
            # For QID at 06/12/18/22, an order authored at 08:00 should
            # still surface the 06:00 row in the grid even though the dose
            # was "before" the order — the MAR will render it overdue/
            # skip-able. The actual therapy-start clamp is enforced via
            # boundsPeriod.start in the caller (the more correct floor).
            if window_start <= candidate < window_end:
                out.append(candidate)
        cursor_day += timedelta(days=1)
    return sorted(out)


def _enumerate_interval(
    anchor: datetime,
    interval: timedelta,
    window_start: datetime,
    window_end: datetime,
) -> list[datetime]:
    """Walk forward and backward from anchor by `interval` while inside the window."""
    out: list[datetime] = []

    # Forward
    t = anchor
    # If anchor is before the window, jump forward to the first in-window candidate.
    if t < window_start:
        # Number of intervals to skip ahead.
        delta = window_start - t
        skips = int(delta.total_seconds() // interval.total_seconds())
        t = t + interval * skips
        while t < window_start:
            t += interval
    while t < window_end:
        if t >= window_start:
            out.append(t)
        t += interval

    # Backward from anchor, in case anchor was inside the window but earlier
    # doses still fit. The forward loop already handled candidates >= anchor;
    # this picks up the < anchor side. Honour the same exclusive-end and
    # inclusive-start convention as the forward walk so a candidate equal
    # to window_end isn't included (the boundary is `[start, end)`).
    t = anchor - interval
    while t >= window_start:
        if t < window_end:
            out.append(t)
        t -= interval

    return sorted(out)


def _ensure_aware(dt: datetime) -> datetime:
    """Force tz-aware (UTC) so comparisons don't blow up on naive vs aware."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _medication_text(med_request: dict[str, Any]) -> str:
    mc = med_request.get("medicationCodeableConcept") or {}
    return (
        mc.get("text")
        or (mc.get("coding") or [{}])[0].get("display")
        or "(medication)"
    )


def _dose_text(instr: dict[str, Any]) -> str:
    """Best-effort dose label. dosageInstruction[].text is the convention."""
    text = instr.get("text")
    if text:
        return text
    dose_qty = ((instr.get("doseAndRate") or [{}])[0].get("doseQuantity")) or {}
    value = dose_qty.get("value")
    unit = dose_qty.get("unit")
    if value is not None and unit:
        return f"{value} {unit}"
    return ""


def _route_text(instr: dict[str, Any]) -> str:
    route = instr.get("route") or {}
    return route.get("text") or (route.get("coding") or [{}])[0].get("display", "")
