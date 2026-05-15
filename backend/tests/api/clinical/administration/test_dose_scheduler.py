"""
Tests for the dose-scheduling utility that powers the MAR time grid
(#116, Phase 5.1).

Each test names the FHIR shape it covers and the clinical behaviour it
locks in — so the next sub-phase that adds dayOfWeek / timeOfDay support
can extend without breaking these guarantees.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from services.dose_scheduler import compute_due_times


def _med(**overrides):
    """Minimal MedicationRequest scaffold with a single dosageInstruction."""
    base = {
        "resourceType": "MedicationRequest",
        "id": "rx-1",
        "status": "active",
        "authoredOn": "2026-05-14T08:00:00+00:00",
        "medicationCodeableConcept": {"text": "Metformin 500 mg"},
        "dosageInstruction": [{
            "text": "500 mg PO",
            "route": {"text": "PO"},
            "timing": {"repeat": {}},
        }],
    }
    instr_overrides = overrides.pop("dosageInstruction", None)
    if instr_overrides is not None:
        base["dosageInstruction"][0] = {**base["dosageInstruction"][0], **instr_overrides}
    repeat = overrides.pop("repeat", None)
    if repeat is not None:
        base["dosageInstruction"][0]["timing"]["repeat"] = repeat
    base.update(overrides)
    return base


WINDOW_START = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
WINDOW_END = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------
# Hourly cadence: q4h, q8h, etc.
# ---------------------------------------------------------------------

def test_every_4_hours_starts_at_anchor_and_repeats():
    # frequency=1, period=4, periodUnit='h' → every 4h
    rx = _med(
        authoredOn="2026-05-14T06:00:00+00:00",
        repeat={"frequency": 1, "period": 4, "periodUnit": "h"},
    )
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    # Anchor 06:00 → expect 02, 06, 10, 14, 18, 22 in a 24h window
    hours = [d.scheduled_time.hour for d in doses]
    assert hours == [2, 6, 10, 14, 18, 22]
    # dose_number is 1-indexed and stable
    assert [d.dose_number for d in doses] == [1, 2, 3, 4, 5, 6]


def test_q8h_yields_three_doses_per_day():
    rx = _med(
        authoredOn="2026-05-14T08:00:00+00:00",
        repeat={"frequency": 1, "period": 8, "periodUnit": "h"},
    )
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert [d.scheduled_time.hour for d in doses] == [0, 8, 16]


def test_window_clipping_keeps_only_in_range_doses():
    # 24h window starting noon → should miss the 06:00 dose but include 14:00 onward
    rx = _med(
        authoredOn="2026-05-14T06:00:00+00:00",
        repeat={"frequency": 1, "period": 4, "periodUnit": "h"},
    )
    half_window_start = datetime(2026, 5, 14, 12, 0, tzinfo=timezone.utc)
    half_window_end = datetime(2026, 5, 14, 23, 0, tzinfo=timezone.utc)
    doses = compute_due_times(rx, half_window_start, half_window_end)
    assert [d.scheduled_time.hour for d in doses] == [14, 18, 22]


def test_frequency_greater_than_one_divides_period():
    # frequency=2, period=12, periodUnit='h' → every 6h
    rx = _med(
        authoredOn="2026-05-14T06:00:00+00:00",
        repeat={"frequency": 2, "period": 12, "periodUnit": "h"},
    )
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert [d.scheduled_time.hour for d in doses] == [0, 6, 12, 18]


# ---------------------------------------------------------------------
# Daily cadence: BID/TID/QID anchor conventions
# ---------------------------------------------------------------------

def test_bid_anchors_to_8am_and_8pm():
    rx = _med(repeat={"frequency": 2, "period": 1, "periodUnit": "d"})
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert [d.scheduled_time.hour for d in doses] == [8, 20]


def test_tid_anchors_to_8_14_20():
    rx = _med(repeat={"frequency": 3, "period": 1, "periodUnit": "d"})
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert [d.scheduled_time.hour for d in doses] == [8, 14, 20]


def test_qid_anchors_to_6_12_18_22():
    rx = _med(repeat={"frequency": 4, "period": 1, "periodUnit": "d"})
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert [d.scheduled_time.hour for d in doses] == [6, 12, 18, 22]


def test_once_daily_anchors_to_morning():
    rx = _med(repeat={"frequency": 1, "period": 1, "periodUnit": "d"})
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert [d.scheduled_time.hour for d in doses] == [9]


def test_every_other_day_skips_intermediate_days():
    # frequency=1, period=2, periodUnit='d' anchored on May 14
    rx = _med(
        authoredOn="2026-05-14T09:00:00+00:00",
        repeat={"frequency": 1, "period": 2, "periodUnit": "d"},
    )
    three_day_end = datetime(2026, 5, 17, 0, 0, tzinfo=timezone.utc)
    doses = compute_due_times(rx, WINDOW_START, three_day_end)
    # Expect May 14 (day 0) and May 16 (day 2), not May 15
    days = sorted({d.scheduled_time.day for d in doses})
    assert days == [14, 16]


# ---------------------------------------------------------------------
# boundsPeriod clipping
# ---------------------------------------------------------------------

def test_bounds_period_start_anchors_schedule():
    # boundsPeriod.start=10:00 → first dose at 10:00 even though authoredOn=08:00
    rx = _med(
        authoredOn="2026-05-14T08:00:00+00:00",
        repeat={
            "frequency": 1,
            "period": 6,
            "periodUnit": "h",
            "boundsPeriod": {"start": "2026-05-14T10:00:00+00:00"},
        },
    )
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert [d.scheduled_time.hour for d in doses] == [10, 16, 22]


def test_bounds_period_end_truncates_schedule():
    rx = _med(
        authoredOn="2026-05-14T08:00:00+00:00",
        repeat={
            "frequency": 1,
            "period": 6,
            "periodUnit": "h",
            "boundsPeriod": {"end": "2026-05-14T18:00:00+00:00"},
        },
    )
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    hours = [d.scheduled_time.hour for d in doses]
    # Without bounds we'd see 02, 08, 14, 20 — end clips to <18:00.
    assert hours == [2, 8, 14]


# ---------------------------------------------------------------------
# Empty / skip cases — schedule should silently return []
# ---------------------------------------------------------------------

def test_prn_returns_empty_schedule():
    rx = _med(dosageInstruction={"asNeededBoolean": True})
    rx["dosageInstruction"][0]["asNeededBoolean"] = True
    rx["dosageInstruction"][0]["timing"]["repeat"] = {
        "frequency": 1, "period": 4, "periodUnit": "h",
    }
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert doses == []


def test_missing_timing_repeat_returns_empty():
    rx = _med()
    rx["dosageInstruction"][0]["timing"] = {"code": {"text": "BID"}}  # no .repeat
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert doses == []


def test_partial_repeat_returns_empty():
    # frequency without period
    rx = _med(repeat={"frequency": 2})
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert doses == []


def test_unsupported_period_unit_returns_empty():
    # Minutes — not in our 5.1 scope
    rx = _med(repeat={"frequency": 1, "period": 30, "periodUnit": "min"})
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert doses == []


def test_zero_frequency_returns_empty():
    rx = _med(repeat={"frequency": 0, "period": 1, "periodUnit": "d"})
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert doses == []


def test_no_dosage_instruction_returns_empty():
    rx = {"resourceType": "MedicationRequest", "id": "rx-x", "dosageInstruction": []}
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert doses == []


# ---------------------------------------------------------------------
# Echoed display fields — frontend renders directly from these
# ---------------------------------------------------------------------

def test_doses_echo_medication_dose_and_route_text():
    rx = _med(
        repeat={"frequency": 2, "period": 1, "periodUnit": "d"},
    )
    rx["dosageInstruction"][0]["text"] = "Custom dose label"
    rx["dosageInstruction"][0]["route"] = {"text": "IV"}
    rx["medicationCodeableConcept"] = {"text": "Vancomycin 1 g"}
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert doses[0].medication_display == "Vancomycin 1 g"
    assert doses[0].dose_text == "Custom dose label"
    assert doses[0].route_text == "IV"


def test_dose_falls_back_to_doseQuantity_when_text_missing():
    rx = _med(repeat={"frequency": 1, "period": 1, "periodUnit": "d"})
    rx["dosageInstruction"][0].pop("text")
    rx["dosageInstruction"][0]["doseAndRate"] = [
        {"doseQuantity": {"value": 500, "unit": "mg"}},
    ]
    doses = compute_due_times(rx, WINDOW_START, WINDOW_END)
    assert doses[0].dose_text == "500 mg"


# ---------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------

def test_non_medication_request_raises():
    with pytest.raises(ValueError):
        compute_due_times(
            {"resourceType": "ServiceRequest", "id": "x"},
            WINDOW_START, WINDOW_END,
        )


# ---------------------------------------------------------------------
# Multi-anchor edge case: window earlier than anchor
# ---------------------------------------------------------------------

def test_window_earlier_than_anchor_still_walks_backward_to_in_window_doses():
    # Anchor at 22:00. Window is just earlier than that. Backward walk
    # should still pick up 02:00, 06:00, ... etc.
    rx = _med(
        authoredOn="2026-05-14T22:00:00+00:00",
        repeat={"frequency": 1, "period": 4, "periodUnit": "h"},
    )
    earlier_window_end = datetime(2026, 5, 14, 18, 0, tzinfo=timezone.utc)
    doses = compute_due_times(rx, WINDOW_START, earlier_window_end)
    assert [d.scheduled_time.hour for d in doses] == [2, 6, 10, 14]
