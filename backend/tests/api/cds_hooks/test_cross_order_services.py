"""
Tests for the two cross-order CDS services that demonstrate the Order
Composer's bundle-level firing (#116, Phase 4.2):

- DrugDrugInteractionCohortService — pair-finding across MedicationRequest
  drafts
- PanelComponentOverlapService — panel ∩ component detection across
  ServiceRequest lab drafts

Both services depend on `context.draftOrders` (a CDS Hooks 2.0 collection
Bundle) and intentionally need >=2 drafts in their cohort to fire.
"""
import pytest

from api.cds_hooks.services.builtin import (
    DrugDrugInteractionCohortService,
    PanelComponentOverlapService,
)


def make_bundle(*resources):
    return {
        "resourceType": "Bundle",
        "id": "cds-draft-test",
        "type": "collection",
        "entry": [{"resource": r} for r in resources],
    }


def med(text, draft_id="draft-1"):
    return {
        "resourceType": "MedicationRequest",
        "id": draft_id,
        "status": "draft",
        "medicationCodeableConcept": {"text": text},
    }


def lab(loinc_code, draft_id="lab-1", category_code="108252007"):
    return {
        "resourceType": "ServiceRequest",
        "id": draft_id,
        "status": "draft",
        "category": [{"coding": [{"system": "http://snomed.info/sct", "code": category_code}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": loinc_code}]},
    }


# =============================================================================
# DrugDrugInteractionCohortService
# =============================================================================


@pytest.fixture
def ddi():
    return DrugDrugInteractionCohortService()


@pytest.mark.asyncio
async def test_ddi_skips_single_draft(ddi):
    """Cohort of one — nothing to compare against, service stays silent."""
    ctx = {"draftOrders": make_bundle(med("warfarin 5 mg tab"))}
    assert await ddi.should_execute(ctx, {}) is False


@pytest.mark.asyncio
async def test_ddi_detects_warfarin_aspirin_pair(ddi):
    ctx = {
        "draftOrders": make_bundle(
            med("warfarin 5 mg tab", "draft-1"),
            med("aspirin 81 mg", "draft-2"),
        )
    }
    assert await ddi.should_execute(ctx, {}) is True
    cards = await ddi.execute(ctx, {})
    assert len(cards) == 1
    assert "Warfarin + Aspirin" in cards[0].summary
    assert cards[0].indicator == "critical"
    # Implicated drafts are named in the detail so students can see the link.
    assert "warfarin" in cards[0].detail.lower()
    assert "aspirin" in cards[0].detail.lower()


@pytest.mark.asyncio
async def test_ddi_each_pair_emitted_once(ddi):
    """Two warfarin drafts + two aspirin drafts → 4 logical pairs, but
    each unordered pair is emitted once (dedup by sorted draft-id key)."""
    ctx = {
        "draftOrders": make_bundle(
            med("warfarin 5 mg tab", "d1"),
            med("warfarin 2.5 mg tab", "d2"),
            med("aspirin 81 mg", "d3"),
            med("aspirin 325 mg", "d4"),
        )
    }
    cards = await ddi.execute(ctx, {})
    # 4 unique unordered pairs: (d1,d3), (d1,d4), (d2,d3), (d2,d4)
    assert len(cards) == 4
    summaries = {c.summary for c in cards}
    # All four cards share the same lookup row, so the summary is identical.
    assert summaries == {"Warfarin + Aspirin: major bleeding risk"}


@pytest.mark.asyncio
async def test_ddi_ssri_class_expansion(ddi):
    """The 'ssri' lookup needle expands to common SSRI generic names —
    tramadol + sertraline should fire serotonin-syndrome warning."""
    ctx = {
        "draftOrders": make_bundle(
            med("tramadol 50 mg cap", "d1"),
            med("sertraline 50 mg tab", "d2"),
        )
    }
    cards = await ddi.execute(ctx, {})
    assert len(cards) == 1
    assert "serotonin" in cards[0].detail.lower()


@pytest.mark.asyncio
async def test_ddi_ignores_non_medication_drafts(ddi):
    """Lab drafts in the bundle don't count toward the cohort gate."""
    ctx = {
        "draftOrders": make_bundle(
            med("warfarin 5 mg tab", "d1"),
            lab("2823-3", "lab-1"),
            lab("2160-0", "lab-2"),
        )
    }
    # Only one medication → should_execute is False even with 3 entries.
    assert await ddi.should_execute(ctx, {}) is False


@pytest.mark.asyncio
async def test_ddi_no_pair_no_cards(ddi):
    """Two non-interacting meds → no cards."""
    ctx = {
        "draftOrders": make_bundle(
            med("amoxicillin 500 mg cap", "d1"),
            med("acetaminophen 500 mg tab", "d2"),
        )
    }
    cards = await ddi.execute(ctx, {})
    assert cards == []


# =============================================================================
# PanelComponentOverlapService
# =============================================================================


@pytest.fixture
def overlap():
    return PanelComponentOverlapService()


@pytest.mark.asyncio
async def test_overlap_detects_cmp_plus_glucose(overlap):
    """CMP (24323-8) draft + standalone Glucose (2345-7) draft → one card."""
    ctx = {
        "draftOrders": make_bundle(
            lab("24323-8", "cmp"),       # CMP
            lab("2345-7", "glu"),        # Glucose — part of CMP
        )
    }
    assert await overlap.should_execute(ctx, {}) is True
    cards = await overlap.execute(ctx, {})
    assert len(cards) == 1
    assert "Comprehensive Metabolic Panel" in cards[0].summary
    assert "Glucose" in cards[0].detail
    assert cards[0].indicator == "warning"


@pytest.mark.asyncio
async def test_overlap_detects_bmp_plus_multiple_components(overlap):
    """BMP + glucose + potassium → single card listing both overlaps."""
    ctx = {
        "draftOrders": make_bundle(
            lab("24320-4", "bmp"),
            lab("2345-7", "glu"),
            lab("2823-3", "k"),
        )
    }
    cards = await overlap.execute(ctx, {})
    assert len(cards) == 1
    detail = cards[0].detail
    assert "Glucose" in detail and "Potassium" in detail
    assert "2 ordered component" in cards[0].summary


@pytest.mark.asyncio
async def test_overlap_no_panel_no_card(overlap):
    """Two standalone components without a panel — no overlap to warn about."""
    ctx = {
        "draftOrders": make_bundle(
            lab("2345-7", "glu"),
            lab("2823-3", "k"),
        )
    }
    cards = await overlap.execute(ctx, {})
    assert cards == []


@pytest.mark.asyncio
async def test_overlap_panel_alone_no_card(overlap):
    """Panel without any overlapping component — no warning."""
    ctx = {
        "draftOrders": make_bundle(
            lab("24320-4", "bmp"),
            lab("4548-4", "a1c"),  # A1C is not in any panel map
        )
    }
    cards = await overlap.execute(ctx, {})
    assert cards == []


@pytest.mark.asyncio
async def test_overlap_skips_single_draft(overlap):
    ctx = {"draftOrders": make_bundle(lab("24320-4", "bmp"))}
    assert await overlap.should_execute(ctx, {}) is False


@pytest.mark.asyncio
async def test_overlap_ignores_non_lab_service_requests(overlap):
    """Imaging-category ServiceRequest shouldn't count toward the cohort."""
    imaging = {
        "resourceType": "ServiceRequest",
        "id": "img",
        "status": "draft",
        "category": [{"coding": [{"system": "http://snomed.info/sct", "code": "363679005"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "71020"}]},
    }
    ctx = {"draftOrders": make_bundle(lab("24320-4", "bmp"), imaging)}
    # Only one lab — gate stays closed.
    assert await overlap.should_execute(ctx, {}) is False
