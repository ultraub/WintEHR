"""
Regression tests for the dynamic catalog endpoints (bug B1,
docs/ARCHITECTURE_DEBT.md).

Both handlers used to construct ``DynamicCatalogService(db)`` — but the
service's ``__init__`` takes no session (it reads from HAPI over HTTP), so
every request to /api/clinical/lab-catalog and /api/clinical/condition-catalog
raised TypeError before doing any work. These tests call the endpoints
through the real router with the extraction methods stubbed, so the
construct-and-dispatch path is exercised end to end and the signature
mismatch can't come back.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.clinical.cds_clinical_data import router
from api.services.clinical.dynamic_catalog_service import DynamicCatalogService


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_lab_catalog_constructs_service_and_returns(client, monkeypatch):
    async def fake_extract(self, limit=None):
        # The EXACT shape extract_lab_test_catalog emits (see
        # dynamic_catalog_service.py) — notably NO reference_range and NO
        # value_statistics keys. An earlier fixture mirrored the handler's
        # expectations instead and masked a guaranteed KeyError on
        # lab["reference_range"]; the fixture must stay the service's REAL
        # shape, not the handler's wishes.
        return [{
            "id": "lab_718-7",
            "name": "718-7",
            "display": "Hemoglobin [Mass/volume] in Blood",
            "loinc_code": "718-7",
            "category": "laboratory",
            "specimen_type": "blood",
            "frequency_count": 42,
            "source": "patient_data",
        }]

    monkeypatch.setattr(DynamicCatalogService, "extract_lab_test_catalog", fake_extract)

    resp = client.get("/api/clinical/lab-catalog")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["loinc_code"] == "718-7"


def test_condition_catalog_constructs_service_and_returns(client, monkeypatch):
    async def fake_extract(self, limit=None):
        # The exact shape extract_condition_catalog emits.
        return [{
            "id": "cond_59621000",
            "code": "59621000",
            "display": "Essential hypertension",
            "system": "http://snomed.info/sct",
            "frequency_count": 12,
            "source": "patient_data",
        }]

    monkeypatch.setattr(DynamicCatalogService, "extract_condition_catalog", fake_extract)

    resp = client.get("/api/clinical/condition-catalog")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["snomed_code"] == "59621000"


def test_service_constructor_takes_no_session():
    """The signature the two endpoints depend on: argless construction."""
    DynamicCatalogService()  # must not raise
    with pytest.raises(TypeError):
        DynamicCatalogService(object())  # passing a session is the bug
