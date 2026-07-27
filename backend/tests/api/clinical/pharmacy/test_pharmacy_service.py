"""
PharmacyService tests — business logic without the HTTP layer.

The point of the router/service split: this exercises queue building,
filtering, and ordering by injecting a fake HAPI client, with no
TestClient and no route in sight. Before the split the same coverage
needed a request through FastAPI because the logic lived in the handler.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from api.clinical.pharmacy.service import PharmacyService


class FakeHAPI:
    """Minimal stand-in for HAPIFHIRClient."""

    def __init__(self, bundle):
        self._bundle = bundle
        self.calls = []

    async def search(self, resource_type, params):
        self.calls.append((resource_type, params))
        return self._bundle


def _recent(hours_ago: float) -> str:
    """An authoredOn close enough to now to avoid the age-escalation rule."""
    from datetime import timedelta
    return (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat().replace("+00:00", "Z")


def _med_request(rid, *, status="active", priority=None, authored=None):
    authored = authored or _recent(1)
    resource = {
        "resourceType": "MedicationRequest",
        "id": rid,
        "status": status,
        "intent": "order",
        "subject": {"reference": "Patient/p1"},
        "authoredOn": authored,
        "medicationCodeableConcept": {"text": f"Drug {rid}"},
    }
    if priority:
        resource["priority"] = priority
    return {"resource": resource}


@pytest.mark.asyncio
async def test_stat_outranks_routine_at_the_same_age():
    hapi = FakeHAPI({"entry": [
        _med_request("routine", authored=_recent(1)),
        _med_request("stat", priority="stat", authored=_recent(1)),
    ]})
    svc = PharmacyService(hapi_client=hapi)

    queue = await svc.get_queue()

    assert queue[0].medication_request_id == "stat", "STAT order did not sort first"
    assert queue[0].priority < queue[1].priority


@pytest.mark.asyncio
async def test_waiting_orders_escalate_with_age():
    """A deliberate rule, pinned because it is easy to mistake for a bug:
    an ordinary order left waiting overtakes a fresh one. >12h reaches
    priority 2, >24h reaches priority 1 — nothing sits in the queue
    forever just because it was never urgent."""
    hapi = FakeHAPI({"entry": [
        _med_request("fresh", authored=_recent(1)),
        _med_request("half-day", authored=_recent(13)),
        _med_request("day-old", authored=_recent(30)),
    ]})
    svc = PharmacyService(hapi_client=hapi)

    by_id = {i.medication_request_id: i.priority for i in await svc.get_queue()}

    assert by_id["day-old"] == 1
    assert by_id["half-day"] == 2
    assert by_id["fresh"] > by_id["half-day"]


@pytest.mark.asyncio
async def test_patient_filter_is_passed_to_fhir_as_a_reference():
    hapi = FakeHAPI({"entry": []})
    svc = PharmacyService(hapi_client=hapi)

    await svc.get_queue(patient_id="p1")
    _, params = hapi.calls[0]
    assert params["patient"] == "Patient/p1"

    # An already-qualified reference must not be double-prefixed.
    await svc.get_queue(patient_id="Patient/p2")
    _, params = hapi.calls[1]
    assert params["patient"] == "Patient/p2"


@pytest.mark.asyncio
async def test_status_filter_reaches_fhir_and_priority_filters_locally():
    hapi = FakeHAPI({"entry": [
        _med_request("a", priority="stat", authored=_recent(1)),
        _med_request("b", authored=_recent(1)),
    ]})
    svc = PharmacyService(hapi_client=hapi)

    await svc.get_queue(status="active")
    assert hapi.calls[0][1]["status"] == "active"

    # priority is applied after building items (it is derived, not a
    # FHIR search parameter). Priority 1 is reserved for stat/urgent.
    stat_only = await svc.get_queue(priority=1)
    assert all(i.priority == 1 for i in stat_only)
    assert "a" in [i.medication_request_id for i in stat_only]


@pytest.mark.asyncio
async def test_empty_bundle_yields_empty_queue():
    svc = PharmacyService(hapi_client=FakeHAPI({}))
    assert await svc.get_queue() == []


@pytest.mark.asyncio
async def test_queue_sorts_by_hapis_real_medicationrequest_parameter():
    """Regression: the queue asked HAPI to sort by '-authored'.

    That is ServiceRequest's parameter name; MedicationRequest's is
    'authoredon'. HAPI answers 400 ("Unknown _sort parameter value"), the
    router turned it into a 500, and GET /api/clinical/pharmacy/queue was
    broken for every caller — invisible to the suite because no test
    asserted the outgoing search, and invisible in the UI because the
    Pharmacy tab reads through the FHIR context instead of this endpoint.
    """
    hapi = FakeHAPI({"entry": []})
    svc = PharmacyService(hapi_client=hapi)

    await svc.get_queue()

    _, params = hapi.calls[0]
    assert params["_sort"] == "-authoredon"
    assert "authored" not in params["_sort"].replace("authoredon", "")
