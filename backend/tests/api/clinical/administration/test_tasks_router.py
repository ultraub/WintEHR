"""
Tests for the Administration Tasks-pane endpoints (#116 Phase 5.2).

Covers:
- GET  /api/clinical/administration/tasks
- POST /api/clinical/administration/record/immunization
- POST /api/clinical/administration/record/specimen
- POST /api/clinical/administration/record/procedure

The router is the system boundary; the HAPI client is mocked so these run
without a live FHIR server. The GET endpoint exercises the service-layer
bucketing/fulfilment logic; the POST endpoints exercise the status gate and
the FHIR resource shape written to HAPI.
"""

from __future__ import annotations

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

# SNOMED category codings the Order Composer emits per task type.
_CATEGORY = {
    "immunization": "33879002",
    "specimen": "108252007",
    "procedure": "387713003",
}


def service_request(
    sr_id: str = "sr-1",
    task: str = "immunization",
    status: str = "active",
    authored_on: str = "2026-05-14T08:00:00+00:00",
    code_display: str = "Influenza vaccine",
    code_value: str = "140",
) -> dict:
    return {
        "resourceType": "ServiceRequest",
        "id": sr_id,
        "status": status,
        "intent": "order",
        "authoredOn": authored_on,
        "priority": "routine",
        "subject": {"reference": "Patient/123"},
        "category": [{"coding": [{"system": "http://snomed.info/sct", "code": _CATEGORY[task]}]}],
        "code": {"coding": [{"system": "http://hl7.org/fhir/sid/cvx", "code": code_value, "display": code_display}]},
        "encounter": {"reference": "Encounter/enc-1"},
    }


def bundle(*resources: dict) -> dict:
    return {"resourceType": "Bundle", "entry": [{"resource": r} for r in resources]}


# ---------------------------------------------------------------------
# GET /tasks
# ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tasks_buckets_by_category(client):
    """One order of each type → one task in each bucket, all pending."""
    with patch("api.clinical.administration.service.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.search = AsyncMock(side_effect=[
            bundle(  # ServiceRequest
                service_request("sr-imm", "immunization"),
                service_request("sr-spec", "specimen"),
                service_request("sr-proc", "procedure"),
            ),
            bundle(),  # Immunization
            bundle(),  # Specimen
            bundle(),  # Procedure
        ])
        resp = client.get("/api/clinical/administration/tasks", params={"patient_id": "123"})

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["patient_id"] == "123"
    assert len(payload["immunizations"]) == 1
    assert len(payload["specimens"]) == 1
    assert len(payload["procedures"]) == 1
    assert payload["immunizations"][0]["service_request_id"] == "sr-imm"
    assert payload["immunizations"][0]["fulfilled"] is False
    assert payload["immunizations"][0]["code_display"] == "Influenza vaccine"


@pytest.mark.asyncio
async def test_tasks_marks_fulfilled_orders(client):
    """An Immunization whose basedOn points at the order → that task is fulfilled."""
    with patch("api.clinical.administration.service.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.search = AsyncMock(side_effect=[
            bundle(service_request("sr-imm", "immunization")),
            bundle({
                "resourceType": "Immunization", "id": "imm-99",
                "basedOn": [{"reference": "ServiceRequest/sr-imm"}],
            }),
            bundle(),
            bundle(),
        ])
        resp = client.get("/api/clinical/administration/tasks", params={"patient_id": "123"})

    assert resp.status_code == 200
    task = resp.json()["immunizations"][0]
    assert task["fulfilled"] is True
    assert task["fulfillment_id"] == "imm-99"


@pytest.mark.asyncio
async def test_tasks_skips_draft_orders(client):
    """A draft (unsigned) ServiceRequest is not yet an actionable task."""
    with patch("api.clinical.administration.service.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.search = AsyncMock(side_effect=[
            bundle(service_request("sr-draft", "procedure", status="draft")),
            bundle(), bundle(), bundle(),
        ])
        resp = client.get("/api/clinical/administration/tasks", params={"patient_id": "123"})

    assert resp.status_code == 200
    assert resp.json()["procedures"] == []


# ---------------------------------------------------------------------
# POST /record/immunization
# ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_record_immunization_creates_resource_with_basedon(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=service_request("sr-imm", "immunization"))
        instance.create = AsyncMock(return_value={"id": "imm-1", "resourceType": "Immunization"})
        resp = client.post(
            "/api/clinical/administration/record/immunization",
            json={
                "service_request_id": "sr-imm",
                "lot_number": "LOT-42",
                "route": "IM",
                "site": "left deltoid",
                "dose_value": 0.5,
                "dose_unit": "mL",
            },
        )

    assert resp.status_code == 201
    body = resp.json()
    assert body["resource_id"] == "imm-1"
    assert body["resource_type"] == "Immunization"

    sent = instance.create.call_args.args[1]
    assert instance.create.call_args.args[0] == "Immunization"
    assert sent["status"] == "completed"
    assert sent["basedOn"][0]["reference"] == "ServiceRequest/sr-imm"
    assert sent["vaccineCode"]["coding"][0]["code"] == "140"
    assert sent["lotNumber"] == "LOT-42"
    assert sent["doseQuantity"]["value"] == 0.5
    assert sent["encounter"]["reference"] == "Encounter/enc-1"


@pytest.mark.asyncio
async def test_record_immunization_not_done_requires_reason(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=service_request("sr-imm", "immunization"))
        resp = client.post(
            "/api/clinical/administration/record/immunization",
            json={"service_request_id": "sr-imm", "status": "not-done"},
        )
    assert resp.status_code == 400
    assert "status_reason" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_record_immunization_against_draft_order_409s(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=service_request("sr-imm", "immunization", status="draft"))
        resp = client.post(
            "/api/clinical/administration/record/immunization",
            json={"service_request_id": "sr-imm"},
        )
    assert resp.status_code == 409
    assert "draft" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_record_immunization_missing_order_404s(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=None)
        resp = client.post(
            "/api/clinical/administration/record/immunization",
            json={"service_request_id": "sr-nope"},
        )
    assert resp.status_code == 404


# ---------------------------------------------------------------------
# POST /record/specimen
# ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_record_specimen_creates_resource_with_request_link(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=service_request("sr-spec", "specimen"))
        instance.create = AsyncMock(return_value={"id": "spec-1", "resourceType": "Specimen"})
        resp = client.post(
            "/api/clinical/administration/record/specimen",
            json={
                "service_request_id": "sr-spec",
                "specimen_type": "Whole blood",
                "container": "EDTA tube",
                "body_site": "left antecubital",
            },
        )

    assert resp.status_code == 201
    sent = instance.create.call_args.args[1]
    assert instance.create.call_args.args[0] == "Specimen"
    assert sent["status"] == "available"
    assert sent["request"][0]["reference"] == "ServiceRequest/sr-spec"
    assert sent["type"]["text"] == "Whole blood"
    assert sent["collection"]["bodySite"]["text"] == "left antecubital"
    assert sent["container"][0]["type"]["text"] == "EDTA tube"


@pytest.mark.asyncio
async def test_record_specimen_against_draft_order_409s(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=service_request("sr-spec", "specimen", status="draft"))
        resp = client.post(
            "/api/clinical/administration/record/specimen",
            json={"service_request_id": "sr-spec"},
        )
    assert resp.status_code == 409


# ---------------------------------------------------------------------
# POST /record/procedure
# ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_record_procedure_creates_resource_with_basedon(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=service_request("sr-proc", "procedure"))
        instance.create = AsyncMock(return_value={"id": "proc-1", "resourceType": "Procedure"})
        resp = client.post(
            "/api/clinical/administration/record/procedure",
            json={
                "service_request_id": "sr-proc",
                "outcome": "successful",
                "notes": "No complications.",
            },
        )

    assert resp.status_code == 201
    sent = instance.create.call_args.args[1]
    assert instance.create.call_args.args[0] == "Procedure"
    assert sent["status"] == "completed"
    assert sent["basedOn"][0]["reference"] == "ServiceRequest/sr-proc"
    assert sent["outcome"]["text"] == "successful"
    assert sent["note"][0]["text"] == "No complications."


@pytest.mark.asyncio
async def test_record_procedure_not_done_requires_reason(client):
    with patch("api.clinical.administration.router.HAPIFHIRClient") as MockHapi:
        instance = MockHapi.return_value
        instance.read = AsyncMock(return_value=service_request("sr-proc", "procedure"))
        resp = client.post(
            "/api/clinical/administration/record/procedure",
            json={"service_request_id": "sr-proc", "status": "not-done"},
        )
    assert resp.status_code == 400
    assert "status_reason" in resp.json()["detail"]
