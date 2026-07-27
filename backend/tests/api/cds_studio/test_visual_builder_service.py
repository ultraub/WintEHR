"""
Visual-builder service tests — the pure logic moved in the #5 split.

The visual_builder router had no test coverage before the extraction.
These pin the two pure helpers that guard the CQL authoring flow:

- _validate_cql_valueset_urls: rejects CQL whose valueset declarations
  point at canonical URLs with no composed ValueSet behind them (the
  silent-empty-cards failure mode, caught at save time instead).
- _data_requirements_to_prefetch: DataRequirement[] -> CDS Hooks
  prefetch templates.

Plus an injection smoke test proving the service constructs with a fake
DB/HAPI client (the seam every future behavior test will use).
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from api.cds_studio.visual_builder_service import (
    VisualBuilderService,
    _data_requirements_to_prefetch,
    _validate_cql_valueset_urls,
)


def _db_with_known_urls(urls):
    """Fake AsyncSession: execute() returns rows of canonical URLs."""
    result = MagicMock()
    result.all.return_value = [(u,) for u in urls]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    return db


# ---------------------------------------------------------------------------
# ValueSet URL validation
# ---------------------------------------------------------------------------

CQL_WITH_VALUESET = """
library Demo version '1.0.0'
valueset "Diabetes Mellitus": 'http://wintehr.example.org/ValueSet/diabetes-mellitus'
"""


@pytest.mark.asyncio
async def test_known_valueset_url_passes():
    db = _db_with_known_urls(["http://wintehr.example.org/ValueSet/diabetes-mellitus"])
    await _validate_cql_valueset_urls(CQL_WITH_VALUESET, db)  # no raise


@pytest.mark.asyncio
async def test_unknown_valueset_url_fails_loudly_at_save_time():
    """The failure mode this guards: save succeeds, hook fires, retrieve
    resolves to an empty set, user sees silent {"cards": []}. The check
    must reject at save with the offending URL named."""
    db = _db_with_known_urls(["http://wintehr.example.org/ValueSet/something-else"])
    with pytest.raises(HTTPException) as exc_info:
        await _validate_cql_valueset_urls(CQL_WITH_VALUESET, db)
    assert exc_info.value.status_code == 400
    assert "diabetes-mellitus" in exc_info.value.detail


@pytest.mark.asyncio
async def test_cql_without_valuesets_skips_the_db_roundtrip():
    db = _db_with_known_urls([])
    await _validate_cql_valueset_urls("library Demo version '1.0.0'", db)
    db.execute.assert_not_called()


# ---------------------------------------------------------------------------
# DataRequirement -> prefetch translation
# ---------------------------------------------------------------------------

def test_patient_requirement_maps_to_context_patient():
    out = _data_requirements_to_prefetch([{"type": "Patient"}])
    assert out == {"patient": "Patient/{{context.patientId}}"}


def test_known_types_use_conventional_plural_keys():
    out = _data_requirements_to_prefetch([
        {"type": "Condition"},
        {"type": "AllergyIntolerance"},
    ])
    assert out["conditions"] == "Condition?patient={{context.patientId}}"
    assert out["allergies"] == "AllergyIntolerance?patient={{context.patientId}}"


def test_code_filters_become_code_clauses():
    out = _data_requirements_to_prefetch([{
        "type": "Observation",
        "codeFilter": [{"code": [{"system": "http://loinc.org", "code": "4548-4"}]}],
    }])
    assert out["observations"] == (
        "Observation?patient={{context.patientId}}&code=http://loinc.org|4548-4"
    )


def test_first_requirement_per_type_wins():
    out = _data_requirements_to_prefetch([
        {"type": "Condition"},
        {"type": "Condition",
         "codeFilter": [{"code": [{"system": "s", "code": "c"}]}]},
    ])
    assert out["conditions"] == "Condition?patient={{context.patientId}}"


def test_unknown_type_falls_back_to_camel_plural():
    out = _data_requirements_to_prefetch([{"type": "NutritionOrder"}])
    assert "nutritionOrders" in out


# ---------------------------------------------------------------------------
# Injection seam
# ---------------------------------------------------------------------------

def test_service_accepts_injected_db_and_hapi_client():
    db, hapi = AsyncMock(), AsyncMock()
    svc = VisualBuilderService(db=db, hapi_client=hapi)
    assert svc.db is db
    assert svc.hapi is hapi
