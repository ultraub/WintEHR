"""
Tests for OrderCompositionContextService — the reference order-select
implementation. Covers:

- _resolve_selection: parsing Bundle/<id>#<rt>/<id> reference strings
- should_execute filtering by resource type
- execute card output for each supported resource type
- recent-activity overlap detection from prefetch
"""
import pytest
from api.cds_hooks.services.builtin import OrderCompositionContextService


@pytest.fixture
def service():
    return OrderCompositionContextService()


def make_draft_orders(*resources):
    """Build a CDS Hooks 2.0 draftOrders Bundle from resource dicts."""
    return {
        "resourceType": "Bundle",
        "id": "cds-draft-test",
        "type": "collection",
        "entry": [{"resource": r} for r in resources],
    }


def make_selection(rt, draft_id, bundle_id="cds-draft-test"):
    return f"Bundle/{bundle_id}#{rt}/{draft_id}"


# ---------------------------------------------------------------------
# _resolve_selection
# ---------------------------------------------------------------------

def test_resolve_selection_finds_matching_entry(service):
    sr = {"resourceType": "ServiceRequest", "id": "draft-1", "code": {"text": "CBC"}}
    bundle = make_draft_orders(sr)
    resolved = service._resolve_selection(make_selection("ServiceRequest", "draft-1"), bundle)
    assert resolved is sr


def test_resolve_selection_returns_none_for_missing_entry(service):
    sr = {"resourceType": "ServiceRequest", "id": "draft-1"}
    bundle = make_draft_orders(sr)
    resolved = service._resolve_selection(make_selection("ServiceRequest", "draft-99"), bundle)
    assert resolved is None


def test_resolve_selection_returns_none_for_malformed_ref(service):
    bundle = make_draft_orders({"resourceType": "ServiceRequest", "id": "draft-1"})
    assert service._resolve_selection("not-a-valid-ref", bundle) is None
    assert service._resolve_selection("Bundle/abc", bundle) is None
    assert service._resolve_selection(None, bundle) is None


def test_resolve_selection_handles_empty_bundle(service):
    assert service._resolve_selection(make_selection("ServiceRequest", "draft-1"), {}) is None
    assert service._resolve_selection(make_selection("ServiceRequest", "draft-1"), None) is None


def test_resolve_selection_distinguishes_resource_types(service):
    sr = {"resourceType": "ServiceRequest", "id": "draft-1"}
    mr = {"resourceType": "MedicationRequest", "id": "draft-1"}
    bundle = make_draft_orders(sr, mr)
    assert service._resolve_selection(make_selection("ServiceRequest", "draft-1"), bundle) is sr
    assert service._resolve_selection(make_selection("MedicationRequest", "draft-1"), bundle) is mr


# ---------------------------------------------------------------------
# should_execute
# ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_should_execute_false_for_empty_selections(service):
    context = {"selections": [], "draftOrders": {}}
    assert await service.should_execute(context, {}) is False


@pytest.mark.asyncio
async def test_should_execute_false_for_unknown_resource_type(service):
    res = {"resourceType": "Procedure", "id": "draft-1"}
    context = {
        "selections": [make_selection("Procedure", "draft-1")],
        "draftOrders": make_draft_orders(res),
    }
    assert await service.should_execute(context, {}) is False


@pytest.mark.asyncio
async def test_should_execute_true_for_service_request(service):
    res = {"resourceType": "ServiceRequest", "id": "draft-1", "code": {"text": "CBC"}}
    context = {
        "selections": [make_selection("ServiceRequest", "draft-1")],
        "draftOrders": make_draft_orders(res),
    }
    assert await service.should_execute(context, {}) is True


@pytest.mark.asyncio
async def test_should_execute_true_for_medication_request(service):
    res = {"resourceType": "MedicationRequest", "id": "draft-1"}
    context = {
        "selections": [make_selection("MedicationRequest", "draft-1")],
        "draftOrders": make_draft_orders(res),
    }
    assert await service.should_execute(context, {}) is True


@pytest.mark.asyncio
async def test_should_execute_true_for_immunization(service):
    res = {"resourceType": "Immunization", "id": "draft-1"}
    context = {
        "selections": [make_selection("Immunization", "draft-1")],
        "draftOrders": make_draft_orders(res),
    }
    assert await service.should_execute(context, {}) is True


# ---------------------------------------------------------------------
# execute (card generation)
# ---------------------------------------------------------------------

@pytest.mark.asyncio
async def test_execute_emits_one_card_for_single_service_request(service):
    res = {
        "resourceType": "ServiceRequest",
        "id": "draft-1",
        "code": {"text": "Lipid panel"},
    }
    context = {
        "selections": [make_selection("ServiceRequest", "draft-1")],
        "draftOrders": make_draft_orders(res),
    }
    cards = await service.execute(context, {})
    assert len(cards) == 1
    card = cards[0]
    assert "Lipid panel" in card.summary
    assert card.indicator == "info"
    assert "Composing order: Lipid panel" in card.detail
    assert "reference example" in card.source.label.lower()


@pytest.mark.asyncio
async def test_execute_emits_one_card_per_resource_type(service):
    sr = {"resourceType": "ServiceRequest", "id": "draft-1", "code": {"text": "CBC"}}
    mr = {
        "resourceType": "MedicationRequest", "id": "draft-2",
        "medicationCodeableConcept": {"text": "Aspirin 81mg"},
    }
    iz = {"resourceType": "Immunization", "id": "draft-3",
          "vaccineCode": {"text": "Influenza"}}
    context = {
        "selections": [
            make_selection("ServiceRequest", "draft-1"),
            make_selection("MedicationRequest", "draft-2"),
            make_selection("Immunization", "draft-3"),
        ],
        "draftOrders": make_draft_orders(sr, mr, iz),
    }
    cards = await service.execute(context, {})
    assert len(cards) == 3

    summaries = [c.summary for c in cards]
    assert any("Order context" in s for s in summaries)
    assert any("Medication context" in s for s in summaries)
    assert any("Vaccine context" in s for s in summaries)


@pytest.mark.asyncio
async def test_execute_flags_recent_overlap(service):
    sr = {
        "resourceType": "ServiceRequest", "id": "draft-1",
        "code": {"text": "Lipid panel"},
    }
    context = {
        "selections": [make_selection("ServiceRequest", "draft-1")],
        "draftOrders": make_draft_orders(sr),
    }
    prefetch = {
        "recentLabOrders": {
            "entry": [
                {"resource": {
                    "resourceType": "ServiceRequest",
                    "code": {"text": "Lipid panel"},
                }}
            ]
        }
    }
    cards = await service.execute(context, prefetch)
    assert len(cards) == 1
    assert "Similar order in last 7 days: Lipid panel" in cards[0].detail


@pytest.mark.asyncio
async def test_execute_when_no_overlap_says_so(service):
    sr = {
        "resourceType": "ServiceRequest", "id": "draft-1",
        "code": {"text": "Lipid panel"},
    }
    context = {
        "selections": [make_selection("ServiceRequest", "draft-1")],
        "draftOrders": make_draft_orders(sr),
    }
    prefetch = {"recentLabOrders": {"entry": []}}
    cards = await service.execute(context, prefetch)
    assert len(cards) == 1
    assert "No similar orders found" in cards[0].detail


@pytest.mark.asyncio
async def test_execute_returns_empty_when_no_focused_resources(service):
    context = {"selections": [], "draftOrders": {}}
    cards = await service.execute(context, {})
    assert cards == []


@pytest.mark.asyncio
async def test_execute_falls_back_to_coding_display_when_no_text(service):
    res = {
        "resourceType": "ServiceRequest", "id": "draft-1",
        "code": {"coding": [{"display": "Comprehensive metabolic panel"}]},
    }
    context = {
        "selections": [make_selection("ServiceRequest", "draft-1")],
        "draftOrders": make_draft_orders(res),
    }
    cards = await service.execute(context, {})
    assert len(cards) == 1
    assert "Comprehensive metabolic panel" in cards[0].summary


@pytest.mark.asyncio
async def test_execute_truncates_long_summary(service):
    res = {
        "resourceType": "ServiceRequest", "id": "draft-1",
        "code": {"text": "A very long test name that goes on and on and on and on and on and on and on"},
    }
    context = {
        "selections": [make_selection("ServiceRequest", "draft-1")],
        "draftOrders": make_draft_orders(res),
    }
    cards = await service.execute(context, {})
    assert len(cards) == 1
    # CDS Hooks spec recommends summary <= ~140 chars; service truncates code list at 80
    summary_codes_part = cards[0].summary.split("Order context: ", 1)[1]
    assert len(summary_codes_part) <= 80
    assert summary_codes_part.endswith("...")


# ---------------------------------------------------------------------
# Service metadata sanity
# ---------------------------------------------------------------------

def test_service_metadata(service):
    from api.cds_hooks.services import HookType
    assert service.service_id == "order-composition-context"
    assert service.hook_type == HookType.ORDER_SELECT
    assert "Order Composition Context" in service.title
    assert "patient" in service.prefetch_templates
    assert "recentLabOrders" in service.prefetch_templates
    assert "recentMedications" in service.prefetch_templates
    assert "recentImmunizations" in service.prefetch_templates
