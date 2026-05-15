"""
Tests for the Administration Record router (#116 Phase 5.1).

Covers the two endpoints:
- GET /api/clinical/administration/scheduled-tasks
- POST /api/clinical/administration/record

The router is the system-boundary; we mock the HAPI client so these tests
run without a live FHIR server. The service-layer aggregation logic is
exercised through the GET endpoint; the dose_scheduler is tested separately
in test_dose_scheduler.py.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.clinical.administration.router import router


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


# ---------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------

def med_request(
    rx_id: str = "rx-1",
    status: str = "active",
    frequency: int = 2,
    period: int = 1,
    period_unit: str = "d",
    authored_on: str = "2026-05-14T08:00:00+00:00",
    prn: bool = False,
    medication_text: str = "Metformin 500 mg",
) -> dict:
    instr: dict = {
        "text": "500 mg PO",
        "route": {"text": "PO"},
        "timing": {"repeat": {
            "frequency": frequency,
            "period": period,
            "periodUnit": period_unit,
        }},
    }
    if prn:
        instr["asNeededBoolean"] = True
        instr["asNeededCodeableConcept"] = {"text": "for pain"}
    return {
        "resourceType": "MedicationRequest",
        "id": rx_id,
        "status": status,
        "authoredOn": authored_on,
        "subject": {"reference": "Patient/123"},
        "medicationCodeableConcept": {"text": medication_text},
        "dosageInstruction": [instr],
    }


def med_admin(
    admin_id: str,
    rx_id: str,
    effective: str,
    status: str = "completed",
) -> dict:
    return {
        "resourceType": "MedicationAdministration",
        "id": admin_id,
        "status": status,
        "effectiveDateTime": effective,
        "subject": {"reference": "Patient/123"},
        "request": {"reference": f"MedicationRequest/{rx_id}"},
        "performer": [{"actor": {"reference": "Practitioner/n1"}}],
    }


def bundle(*resources: dict) -> dict:
    return {
        "resourceType": "Bundle",
        "entry": [{"resource": r} for r in resources],
    }


# ---------------------------------------------------------------------
# GET /scheduled-tasks
# ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_scheduled_tasks_returns_grid_payload(client):
    """Active BID order → 2 scheduled rows in a 24h window; no admins → both due."""
    with patch("api.clinical.administration.service.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.search = AsyncMock(side_effect=[
            bundle(med_request()),  # MedicationRequest search
            bundle(),                # MedicationAdministration search (empty)
        ])
        resp = client.get(
            "/api/clinical/administration/scheduled-tasks",
            params={
                "patient_id": "123",
                "window_start": "2026-05-14T00:00:00+00:00",
                "window_end": "2026-05-15T00:00:00+00:00",
            },
        )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["patient_id"] == "123"
    assert len(payload["scheduled"]) == 2  # BID anchors at 08 + 20
    assert {s["scheduled_time"][11:13] for s in payload["scheduled"]} == {"08", "20"}
    assert all(s["administration"] is None for s in payload["scheduled"])
    assert payload["prn_orders"] == []
    assert payload["unscheduled_admins"] == []


@pytest.mark.asyncio
async def test_admin_matches_scheduled_dose_within_window(client):
    """An admin recorded within ±60min of a scheduled time flips the cell to 'given'."""
    with patch("api.clinical.administration.service.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.search = AsyncMock(side_effect=[
            bundle(med_request()),
            bundle(med_admin("adm-1", "rx-1", "2026-05-14T08:15:00+00:00")),
        ])
        resp = client.get(
            "/api/clinical/administration/scheduled-tasks",
            params={
                "patient_id": "123",
                "window_start": "2026-05-14T00:00:00+00:00",
                "window_end": "2026-05-15T00:00:00+00:00",
            },
        )
    payload = resp.json()
    # The 08:00 row should have admin=adm-1; the 20:00 row should still be due
    by_hour = {s["scheduled_time"][11:13]: s for s in payload["scheduled"]}
    assert by_hour["08"]["administration"]["id"] == "adm-1"
    assert by_hour["20"]["administration"] is None


@pytest.mark.asyncio
async def test_admin_outside_match_window_lands_in_unscheduled(client):
    """An admin recorded >60min from any scheduled time stays in unscheduled_admins."""
    with patch("api.clinical.administration.service.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.search = AsyncMock(side_effect=[
            bundle(med_request()),
            # 10:00 admin is 2h from 08:00 and 10h from 20:00 — no match
            bundle(med_admin("adm-2", "rx-1", "2026-05-14T10:00:00+00:00")),
        ])
        resp = client.get(
            "/api/clinical/administration/scheduled-tasks",
            params={
                "patient_id": "123",
                "window_start": "2026-05-14T00:00:00+00:00",
                "window_end": "2026-05-15T00:00:00+00:00",
            },
        )
    payload = resp.json()
    assert all(s["administration"] is None for s in payload["scheduled"])
    assert len(payload["unscheduled_admins"]) == 1
    assert payload["unscheduled_admins"][0]["id"] == "adm-2"


@pytest.mark.asyncio
async def test_draft_orders_excluded_from_grid(client):
    """Draft orders must not produce schedule rows. Mirrors the PR #139 gate philosophy."""
    with patch("api.clinical.administration.service.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.search = AsyncMock(side_effect=[
            bundle(
                med_request(rx_id="rx-active", status="active"),
                med_request(rx_id="rx-draft", status="draft"),
            ),
            bundle(),
        ])
        resp = client.get(
            "/api/clinical/administration/scheduled-tasks",
            params={
                "patient_id": "123",
                "window_start": "2026-05-14T00:00:00+00:00",
                "window_end": "2026-05-15T00:00:00+00:00",
            },
        )
    payload = resp.json()
    rx_ids = {s["medication_request_id"] for s in payload["scheduled"]}
    assert rx_ids == {"rx-active"}


@pytest.mark.asyncio
async def test_prn_orders_appear_in_prn_list_not_grid(client):
    """PRN meds skip the grid and surface in the prn_orders array."""
    with patch("api.clinical.administration.service.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.search = AsyncMock(side_effect=[
            bundle(
                med_request(rx_id="rx-prn", prn=True, medication_text="Oxycodone 5 mg"),
                med_request(rx_id="rx-scheduled"),
            ),
            bundle(),
        ])
        resp = client.get(
            "/api/clinical/administration/scheduled-tasks",
            params={
                "patient_id": "123",
                "window_start": "2026-05-14T00:00:00+00:00",
                "window_end": "2026-05-15T00:00:00+00:00",
            },
        )
    payload = resp.json()
    assert len(payload["prn_orders"]) == 1
    prn = payload["prn_orders"][0]
    assert prn["medication_request_id"] == "rx-prn"
    assert prn["high_alert"] is True  # Oxycodone is on the curated list
    # Scheduled rows only come from the non-PRN order
    assert all(s["medication_request_id"] == "rx-scheduled" for s in payload["scheduled"])


@pytest.mark.asyncio
async def test_invalid_window_400s(client):
    resp = client.get(
        "/api/clinical/administration/scheduled-tasks",
        params={
            "patient_id": "123",
            "window_start": "2026-05-14T12:00:00+00:00",
            "window_end": "2026-05-14T11:00:00+00:00",
        },
    )
    assert resp.status_code == 400
    assert "window_end" in resp.json()["detail"]


# ---------------------------------------------------------------------
# POST /record
# ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_record_given_creates_completed_administration(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=med_request())
        instance.create = AsyncMock(return_value={"id": "new-admin-1", "resourceType": "MedicationAdministration"})
        resp = client.post(
            "/api/clinical/administration/record",
            json={
                "medication_request_id": "rx-1",
                "action": "given",
                "scheduled_time": "2026-05-14T08:00:00+00:00",
                "effective_datetime": "2026-05-14T08:07:00+00:00",
                "dose_value": 500,
                "dose_unit": "mg",
                "route": "PO",
            },
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["medication_administration_id"] == "new-admin-1"
    assert body["status"] == "completed"

    # Inspect what was sent to HAPI — it should include the dose, the
    # request link, and the scheduled-time extension.
    create_call = instance.create.call_args
    assert create_call.args[0] == "MedicationAdministration"
    sent = create_call.args[1]
    assert sent["status"] == "completed"
    assert sent["request"]["reference"] == "MedicationRequest/rx-1"
    assert sent["dosage"]["dose"]["value"] == 500
    ext_urls = {e["url"] for e in sent.get("extension", [])}
    assert "http://wintehr.local/fhir/StructureDefinition/scheduled-dose-time" in ext_urls


@pytest.mark.asyncio
async def test_record_refused_requires_reason(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=med_request())
        resp = client.post(
            "/api/clinical/administration/record",
            json={"medication_request_id": "rx-1", "action": "refused"},
        )
    assert resp.status_code == 400
    assert "reason is required" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_record_held_with_reason_writes_statusReason(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=med_request())
        instance.create = AsyncMock(return_value={"id": "new-admin-2"})
        resp = client.post(
            "/api/clinical/administration/record",
            json={
                "medication_request_id": "rx-1",
                "action": "held",
                "reason": "NPO for procedure",
            },
        )
    assert resp.status_code == 201
    sent = instance.create.call_args.args[1]
    assert sent["status"] == "on-hold"
    assert sent["statusReason"][0]["text"] == "NPO for procedure"


@pytest.mark.asyncio
async def test_record_against_draft_order_409s(client):
    """The pharmacy-style gate — draft orders are not yet administrable."""
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=med_request(status="draft"))
        resp = client.post(
            "/api/clinical/administration/record",
            json={"medication_request_id": "rx-1", "action": "given"},
        )
    assert resp.status_code == 409
    assert "draft" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_record_against_missing_order_404s(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=None)
        resp = client.post(
            "/api/clinical/administration/record",
            json={"medication_request_id": "rx-nope", "action": "given"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_record_late_given_flags_late_charted_extension(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=med_request())
        instance.create = AsyncMock(return_value={"id": "new-admin-3"})
        resp = client.post(
            "/api/clinical/administration/record",
            json={
                "medication_request_id": "rx-1",
                "action": "late-given",
                "scheduled_time": "2026-05-14T08:00:00+00:00",
                "effective_datetime": "2026-05-14T11:30:00+00:00",
                "dose_value": 500,
                "dose_unit": "mg",
            },
        )
    assert resp.status_code == 201
    sent = instance.create.call_args.args[1]
    late_ext = [e for e in sent["extension"] if e["url"].endswith("/late-charted")]
    assert late_ext and late_ext[0]["valueBoolean"] is True
    # Status is still "completed" — late is a derived signal, not a FHIR status
    assert sent["status"] == "completed"
