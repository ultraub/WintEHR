"""
Tests for the critical-value reference endpoint (R33).

Covers:
- GET /api/clinical/critical-values — the single threshold table served to
  every frontend consumer.
- The shared evaluate_critical() helper the notification path and results
  router both use.

Static reference data — no FHIR server or DB needed.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.clinical.critical_values import (
    CRITICAL_VALUE_TABLE,
    evaluate_critical,
)
from api.clinical.critical_values_router import router


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


# ---------------------------------------------------------------------
# GET /api/clinical/critical-values
# ---------------------------------------------------------------------

def test_endpoint_returns_full_table(client):
    resp = client.get("/api/clinical/critical-values")
    assert resp.status_code == 200

    body = resp.json()
    entries = body["criticalValues"]
    assert body["count"] == len(entries) == len(CRITICAL_VALUE_TABLE)

    # Every entry carries the documented shape
    for entry in entries:
        assert set(entry.keys()) == {
            "loinc", "label", "unit", "criticalLow", "criticalHigh", "low", "high",
        }
        assert entry["loinc"] in CRITICAL_VALUE_TABLE


def test_potassium_2823_3_has_sane_bounds(client):
    resp = client.get("/api/clinical/critical-values")
    assert resp.status_code == 200

    by_loinc = {e["loinc"]: e for e in resp.json()["criticalValues"]}
    potassium = by_loinc["2823-3"]

    assert potassium["label"] == "Potassium"
    assert potassium["unit"] == "mmol/L"
    assert potassium["criticalLow"] == 2.5
    assert potassium["criticalHigh"] == 6.5
    # abnormal bounds sit strictly inside the critical bounds
    assert potassium["criticalLow"] < potassium["low"]
    assert potassium["low"] < potassium["high"]
    assert potassium["high"] < potassium["criticalHigh"]


def test_table_bounds_are_internally_consistent(client):
    """critical_low < low <= high < critical_high wherever bounds exist."""
    resp = client.get("/api/clinical/critical-values")
    for entry in resp.json()["criticalValues"]:
        c_low, c_high = entry["criticalLow"], entry["criticalHigh"]
        low, high = entry["low"], entry["high"]
        if c_low is not None and c_high is not None:
            assert c_low < c_high, entry["loinc"]
        if low is not None and c_low is not None:
            assert c_low < low, entry["loinc"]
        if high is not None and c_high is not None:
            assert high < c_high, entry["loinc"]
        if low is not None and high is not None:
            assert low <= high, entry["loinc"]


# ---------------------------------------------------------------------
# evaluate_critical() — shared backend helper
# ---------------------------------------------------------------------

def test_evaluate_critical_flags_critical_potassium():
    result = evaluate_critical("2823-3", 7.2, "mmol/L")
    assert result is not None
    assert result["type"] == "high"
    assert result["threshold"] == 6.5
    assert "7.2" in result["message"]

    result_low = evaluate_critical("2823-3", 2.0, "mmol/L")
    assert result_low is not None
    assert result_low["type"] == "low"
    assert result_low["threshold"] == 2.5


def test_evaluate_critical_fails_safe():
    # In-range value → not critical
    assert evaluate_critical("2823-3", 4.2, "mmol/L") is None
    # Abnormal-but-not-critical value → not critical
    assert evaluate_critical("2823-3", 5.8, "mmol/L") is None
    # Unknown code / missing inputs → never invents criticality
    assert evaluate_critical("0000-0", 999) is None
    assert evaluate_critical(None, 7.2) is None
    assert evaluate_critical("2823-3", None) is None
