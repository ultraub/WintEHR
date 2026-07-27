"""
OrdersService tests — the CPOE safety gates, without the HTTP layer.

The orders router had ZERO test coverage before the #5 service split; these
pin the two load-bearing behaviors found while extracting it:

1. The order-time safety gate in create_medication_order: a high-severity
   alert (documented allergy) blocks the order — order_saved=False and NO
   FHIR write — unless the prescriber explicitly overrides, in which case
   the override is stamped onto the resource as extensions.
2. The discontinue status gate: only active/draft orders can be
   discontinued, and the terminal status is per-resource-type
   (MedicationRequest -> stopped + statusReason, ServiceRequest -> revoked
   + note) because R4 ServiceRequest has neither 'stopped' nor statusReason.

Same injection pattern as the pharmacy tests: construct the service with a
fake HAPI client, no patch(), no TestClient.
"""

from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from api.auth.models import User
from api.clinical.orders.models import MedicationDetails, MedicationOrderCreate
from api.clinical.orders.service import (
    OrdersService,
    _determine_order_type,
    check_medication_alerts_fhir,
)

USER = User(
    id="prov-1",
    username="demo",
    name="Demo Physician",
    email="demo@example.com",
    role="physician",
    permissions=[],
)


def _order(medication_name="Warfarin", override_alerts=False) -> MedicationOrderCreate:
    return MedicationOrderCreate(
        patient_id="p1",
        order_type="medication",
        override_alerts=override_alerts,
        medication_details=MedicationDetails(
            medication_name=medication_name,
            dose=5.0,
            dose_unit="mg",
            route="oral",
            frequency="daily",
        ),
    )


def _bundle(*resources):
    return {"entry": [{"resource": r} for r in resources]}


def _allergy(text):
    return {"resourceType": "AllergyIntolerance", "code": {"text": text}}


def _active_med(text):
    return {
        "resourceType": "MedicationRequest",
        "status": "active",
        "medicationCodeableConcept": {"text": text},
    }


def _client(allergies=(), active_meds=()):
    """Fake HAPI client whose search answers by resource type."""
    client = AsyncMock()

    async def search(resource_type, params):
        if resource_type == "AllergyIntolerance":
            return _bundle(*allergies)
        if resource_type == "MedicationRequest":
            return _bundle(*active_meds)
        return {"entry": []}

    client.search = AsyncMock(side_effect=search)
    client.create = AsyncMock(return_value={
        "id": "mr-1", "status": "active",
        "authoredOn": "2026-07-26T00:00:00",
        "meta": {"lastUpdated": "2026-07-26T00:00:00"},
    })
    return client


# ---------------------------------------------------------------------------
# The order-blocking gate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_documented_allergy_blocks_the_order_without_a_write():
    client = _client(allergies=[_allergy("Warfarin hypersensitivity")])
    svc = OrdersService(hapi_client=client)

    result = await svc.create_medication_order(order=_order("Warfarin"), current_user=USER)

    assert result["order_saved"] is False
    assert any(a["severity"] == "high" and a["type"] == "allergy" for a in result["alerts"])
    client.create.assert_not_called()


@pytest.mark.asyncio
async def test_override_saves_the_order_and_stamps_the_override():
    client = _client(allergies=[_allergy("Warfarin hypersensitivity")])
    svc = OrdersService(hapi_client=client)

    result = await svc.create_medication_order(
        order=_order("Warfarin", override_alerts=True), current_user=USER
    )

    assert result["order_saved"] is True
    client.create.assert_awaited_once()
    _, resource = client.create.await_args.args
    urls = [e["url"] for e in resource.get("extension", [])]
    assert any(u.endswith("/alerts-overridden") for u in urls), (
        "override must leave an audit trail on the resource"
    )


@pytest.mark.asyncio
async def test_drug_interaction_warns_but_does_not_block():
    """Interactions are medium severity — they surface as alerts but only
    HIGH (allergy) alerts block. Pinned so nobody 'promotes' interactions
    to blocking without deciding to."""
    client = _client(active_meds=[_active_med("Aspirin 81mg")])
    svc = OrdersService(hapi_client=client)

    result = await svc.create_medication_order(order=_order("Warfarin"), current_user=USER)

    assert result["order_saved"] is True
    assert any(a["type"] == "drug_interaction" and a["severity"] == "medium"
               for a in result["alerts"])


@pytest.mark.asyncio
async def test_safety_check_failure_is_fail_safe_warn_and_proceed():
    """If HAPI is unreachable the check appends a 'manual review required'
    warning instead of silently passing — and the warning, not being high,
    does not block the order."""
    client = _client()
    client.search = AsyncMock(side_effect=ConnectionError("hapi down"))
    svc = OrdersService(hapi_client=client)

    result = await svc.create_medication_order(order=_order(), current_user=USER)

    assert result["order_saved"] is True
    assert any(a["type"] == "system_error" for a in result["alerts"])


@pytest.mark.asyncio
async def test_allergy_match_is_substring_case_insensitive():
    alerts = await check_medication_alerts_fhir(
        patient_id="p1",
        medication=_order("warfarin").medication_details,
        hapi_client=_client(allergies=[_allergy("WARFARIN sodium")]),
    )
    assert [a["severity"] for a in alerts] == ["high"]


# ---------------------------------------------------------------------------
# The discontinue gate
# ---------------------------------------------------------------------------

def _svc_with_resource(resource):
    client = AsyncMock()
    client.read = AsyncMock(return_value=resource)
    client.update = AsyncMock(side_effect=lambda rt, rid, res: res)
    return OrdersService(hapi_client=client), client


@pytest.mark.asyncio
@pytest.mark.parametrize("blocked_status", ["completed", "stopped", "cancelled", "entered-in-error"])
async def test_discontinue_rejects_terminal_statuses(blocked_status):
    svc, client = _svc_with_resource(
        {"resourceType": "MedicationRequest", "id": "mr-1", "status": blocked_status}
    )
    with pytest.raises(HTTPException) as exc_info:
        await svc.discontinue_order(
            order_id="mr-1", resource_type="MedicationRequest",
            reason="dup", current_user=USER,
        )
    assert exc_info.value.status_code == 400
    assert blocked_status in exc_info.value.detail
    client.update.assert_not_called()


@pytest.mark.asyncio
async def test_discontinue_404_when_order_missing():
    svc, _ = _svc_with_resource(None)
    with pytest.raises(HTTPException) as exc_info:
        await svc.discontinue_order(
            order_id="nope", resource_type="MedicationRequest",
            reason="dup", current_user=USER,
        )
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_medication_request_discontinues_to_stopped_with_status_reason():
    svc, client = _svc_with_resource(
        {"resourceType": "MedicationRequest", "id": "mr-1", "status": "active"}
    )
    await svc.discontinue_order(
        order_id="mr-1", resource_type="MedicationRequest",
        reason="adverse reaction", current_user=USER,
    )
    _, _, updated = client.update.await_args.args
    assert updated["status"] == "stopped"
    assert updated["statusReason"]["text"] == "adverse reaction"
    urls = [e["url"] for e in updated["extension"]]
    assert any(u.endswith("/discontinued-by") for u in urls)


@pytest.mark.asyncio
async def test_service_request_discontinues_to_revoked_with_note():
    """R4 ServiceRequest has no 'stopped' status and no statusReason —
    writing them would be an invalid resource. It revokes, with the
    reason preserved in a note."""
    svc, client = _svc_with_resource(
        {"resourceType": "ServiceRequest", "id": "sr-1", "status": "active"}
    )
    await svc.discontinue_order(
        order_id="sr-1", resource_type="ServiceRequest",
        reason="no longer indicated", current_user=USER,
    )
    _, _, updated = client.update.await_args.args
    assert updated["status"] == "revoked"
    assert "statusReason" not in updated
    assert any("no longer indicated" in n["text"] for n in updated["note"])


# ---------------------------------------------------------------------------
# Order-set action typing
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("system,expected", [
    ("http://www.nlm.nih.gov/research/umls/rxnorm", "medication"),
    ("http://loinc.org", "laboratory"),
    ("http://snomed.info/sct", "imaging"),
    ("", "medication"),  # documented default
])
def test_determine_order_type_infers_from_code_system(system, expected):
    action = {"code": [{"coding": [{"system": system}]}]} if system else {}
    assert _determine_order_type(action) == expected


def test_determine_order_type_extension_wins_over_code_system():
    action = {
        "extension": [{"url": "http://x/order-type", "valueString": "laboratory"}],
        "code": [{"coding": [{"system": "http://snomed.info/sct"}]}],
    }
    assert _determine_order_type(action) == "laboratory"


# ---------------------------------------------------------------------------
# get_orders / get_active_orders — pinned after two live-only failures
# ---------------------------------------------------------------------------

class _RecordingHAPI:
    """Records every outgoing search; answers with an empty bundle."""

    def __init__(self):
        self.calls = []

    async def search(self, resource_type, params):
        # dict(params) — the service mutates one shared params dict per loop
        self.calls.append((resource_type, dict(params)))
        return {"entry": []}


@pytest.mark.asyncio
async def test_get_orders_uses_each_types_real_hapi_sort_parameter():
    """Regression (B13, B12's twin): one shared '_sort=-authored' was sent to
    both types. ServiceRequest accepts it; MedicationRequest's parameter is
    'authoredon', so HAPI answered 400 and GET /api/clinical/orders/ was a
    500 for every caller since inception — surfaced only by curling the
    deployed endpoint after the #5 extraction."""
    hapi = _RecordingHAPI()
    svc = OrdersService(hapi_client=hapi)

    await svc.get_orders(current_user=USER)

    sorts = {rt: params["_sort"] for rt, params in hapi.calls}
    assert sorts == {
        "MedicationRequest": "-authoredon",
        "ServiceRequest": "-authored",
    }


@pytest.mark.asyncio
async def test_get_active_orders_delegates_through_self():
    """Regression: after the extraction, get_active_orders still called its
    old sibling HANDLER by bare name -> NameError -> 500 in production while
    the suite stayed green (nothing exercised the delegation)."""
    hapi = _RecordingHAPI()
    svc = OrdersService(hapi_client=hapi)

    result = await svc.get_active_orders(current_user=USER)

    assert result == []
    assert all(params["status"] == "active" for _, params in hapi.calls)
    assert len(hapi.calls) == 2  # both resource types queried
