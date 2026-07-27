"""
Tests for the legacy /mar/administer signature gate.

The MAR module's record endpoint (administration/router.py) has always
gated on ADMINISTRABLE_STATUSES — but the legacy pharmacy route
POST /api/clinical/pharmacy/mar/administer had no gate at all, so a draft
(unsigned) order could be charted from PharmacyTab while the MAR refused
it. These tests pin the gate to the same semantics.

The gate now lives in PharmacyService.record_medication_administration
(extracted from the router in the #5 service split). The service takes an
injected HAPI client — no patching, no dotted paths that can dangle.
"""

from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from api.clinical.pharmacy.models import MedicationAdministrationRequest
from api.clinical.pharmacy.service import PharmacyService


def _mk_request(med_id: str = "med-1") -> MedicationAdministrationRequest:
    return MedicationAdministrationRequest(
        medication_request_id=med_id,
        patient_id="p1",
        administered_by="nurse-1",
        status="completed",
        dose_given=500.0,
        dose_unit="mg",
    )


def _mk_med_request(status: str) -> dict:
    return {
        "resourceType": "MedicationRequest",
        "id": "med-1",
        "status": status,
        "intent": "order",
        "medicationCodeableConcept": {"text": "Metformin"},
        "subject": {"reference": "Patient/p1"},
    }


def _svc(mock_client: AsyncMock) -> PharmacyService:
    return PharmacyService(hapi_client=mock_client)


@pytest.mark.asyncio
@pytest.mark.parametrize("blocked_status", [
    "draft",  # the central case — charting against an unsigned order
    "cancelled",
    "stopped",
    "entered-in-error",
    "on-hold",
    "unknown",
])
async def test_mar_administer_rejects_non_administrable_statuses(blocked_status):
    """Non-administrable statuses raise 409 before any write happens —
    mirroring ADMINISTRABLE_STATUSES in administration/service.py."""
    mock_client = AsyncMock()
    mock_client.read = AsyncMock(return_value=_mk_med_request(blocked_status))

    with pytest.raises(HTTPException) as exc_info:
        await _svc(mock_client).record_medication_administration(_mk_request())

    assert exc_info.value.status_code == 409
    assert blocked_status in exc_info.value.detail
    assert "signed" in exc_info.value.detail
    mock_client.create.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("allowed_status", ["active", "completed"])
async def test_mar_administer_allows_administrable_statuses(allowed_status):
    """Signed (and completed, e.g. final-dose charting) orders pass the
    gate through to the create path."""
    mock_client = AsyncMock()
    mock_client.read = AsyncMock(return_value=_mk_med_request(allowed_status))
    mock_client.create = AsyncMock(return_value={"id": "admin-1"})

    try:
        await _svc(mock_client).record_medication_administration(_mk_request())
    except HTTPException as e:
        # If something downstream raises, it must not be the gate 409
        assert e.status_code != 409 or "signed" not in (e.detail or "")

    mock_client.read.assert_awaited()


@pytest.mark.asyncio
async def test_mar_administer_404_before_gate():
    """The missing-order 404 still fires first."""
    mock_client = AsyncMock()
    mock_client.read = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await _svc(mock_client).record_medication_administration(_mk_request())

    assert exc_info.value.status_code == 404
