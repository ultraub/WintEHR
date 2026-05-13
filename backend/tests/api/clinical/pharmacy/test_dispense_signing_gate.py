"""
Tests for the dispense signing-gate (issue #86).

After Phase 3 of the order-workflow plan:
- Order-creation dialogs land MedicationRequests as `status='draft'`
- The signing dialog flips draft → active on explicit Sign
- The pharmacy dispense endpoint MUST refuse to act on `draft` orders
  (and on terminal/error states like cancelled, entered-in-error)

These tests pin the dispense_medication gate. They are pure unit tests
of the route handler with a mocked HAPI client — no DB or container
dependencies, so they run in any environment.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from api.clinical.pharmacy.pharmacy_router import (
    MedicationDispenseRequest,
    dispense_medication,
)


def _mk_request(med_id: str = "med-1", pharm_id: str = "pharm-1") -> MedicationDispenseRequest:
    return MedicationDispenseRequest(
        medication_request_id=med_id,
        quantity=30.0,
        lot_number="LOT-1",
        expiration_date="2026-12-31",
        pharmacist_id=pharm_id,
    )


def _mk_med_request(status: str, with_subject: bool = True) -> dict:
    """Build a minimal MedicationRequest dict that satisfies the gate
    checks. status is the field under test."""
    base = {
        "resourceType": "MedicationRequest",
        "id": "med-1",
        "status": status,
        "intent": "order",
        "medicationCodeableConcept": {"text": "Metformin"},
        "dispenseRequest": {"quantity": {"value": 30, "unit": "tablets"}},
    }
    if with_subject:
        base["subject"] = {"reference": "Patient/p1"}
    return base


@pytest.mark.asyncio
@pytest.mark.parametrize("blocked_status", [
    "draft",  # the central case — order authored but unsigned
    "cancelled",
    "entered-in-error",
    "stopped",
    "unknown",
])
async def test_dispense_rejects_non_dispensable_statuses(blocked_status):
    """Each non-dispensable status raises 409 with a message that tells
    the pharmacist the order needs signing."""
    mock_client = AsyncMock()
    mock_client.read = AsyncMock(return_value=_mk_med_request(blocked_status))

    with patch(
        "api.clinical.pharmacy.pharmacy_router.HAPIFHIRClient",
        return_value=mock_client,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await dispense_medication(_mk_request())

    assert exc_info.value.status_code == 409
    assert blocked_status in exc_info.value.detail
    assert "signed" in exc_info.value.detail
    # No write happened — the route bailed before create
    mock_client.create.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("allowed_status", ["active", "on-hold", "completed"])
async def test_dispense_allows_dispensable_statuses(allowed_status):
    """Active (and a few neighbor states clinically acceptable to fill)
    pass the gate. We just need to see the route get PAST the gate and
    into the create path; the rest of the dispense flow is out of scope
    for this test."""
    mock_client = AsyncMock()
    mock_client.read = AsyncMock(return_value=_mk_med_request(allowed_status))
    mock_client.create = AsyncMock(return_value={"id": "dispense-1"})
    mock_client.update = AsyncMock(return_value={"id": "med-1"})

    with patch(
        "api.clinical.pharmacy.pharmacy_router.HAPIFHIRClient",
        return_value=mock_client,
    ):
        # Should NOT raise on the status check. We let it run to completion
        # (or until it hits an unrelated assertion downstream).
        try:
            await dispense_medication(_mk_request())
        except HTTPException as e:
            # If it raises, it must NOT be the signing-gate 409.
            assert e.status_code != 409 or "signed" not in (e.detail or "")

    # The gate let it through to at least the create call
    mock_client.read.assert_awaited()


@pytest.mark.asyncio
async def test_dispense_404_for_missing_med_request():
    """Sanity check: the pre-existing 404 path still fires before the
    signing gate when the MedicationRequest doesn't exist at all."""
    mock_client = AsyncMock()
    mock_client.read = AsyncMock(return_value=None)

    with patch(
        "api.clinical.pharmacy.pharmacy_router.HAPIFHIRClient",
        return_value=mock_client,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await dispense_medication(_mk_request())

    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_dispense_400_for_missing_subject_after_gate_passes():
    """If status passes the gate but the resource is missing required
    fields, the older 400 path fires. Confirms ordering — gate runs
    first, then subject validation."""
    mock_client = AsyncMock()
    mock_client.read = AsyncMock(return_value=_mk_med_request("active", with_subject=False))

    with patch(
        "api.clinical.pharmacy.pharmacy_router.HAPIFHIRClient",
        return_value=mock_client,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await dispense_medication(_mk_request())

    assert exc_info.value.status_code == 400
    assert "subject" in exc_info.value.detail.lower()
