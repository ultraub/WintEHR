"""
Regression: patient-derived catalogs must be built from ALL matching
resources, and imaging study types must be readable from Synthea data.

Found on a fresh 100-patient deploy: every extractor read one search page
(HAPI caps a page at 500) with no sort, so the procedure catalog held 94
of 372 distinct codes and changed between calls; the per-instance cache
never hit because the service is constructed per request; and the imaging
extractor read top-level `description`/`modality`, which Synthea does not
populate, collapsing 70 studies into one "Unknown Study" row.
"""

from __future__ import annotations

import pytest

from api.services.clinical import dynamic_catalog_service as dcs
from api.services.clinical.dynamic_catalog_service import DynamicCatalogService
from services.hapi_fhir_client import HAPIFHIRClient


@pytest.fixture(autouse=True)
def _clean_cache():
    dcs._CACHE.clear()
    dcs._SCANS.clear()
    yield
    dcs._CACHE.clear()
    dcs._SCANS.clear()


def _procedure(code):
    return {"resource": {"resourceType": "Procedure", "code": {
        "coding": [{"system": "http://snomed.info/sct", "code": code, "display": f"Procedure {code}"}]}}}


def _fake_hapi(monkeypatch, resources, fail_after_first_page=False):
    """Serve `resources` through offset paging; record each call's params."""
    calls = []

    async def search(self, resource_type, params=None):
        calls.append(dict(params))
        offset = int(params["_offset"])
        if fail_after_first_page and offset > 0:
            raise RuntimeError("HAPI went away")
        return {"entry": resources[offset:offset + int(params["_count"])]}

    monkeypatch.setattr(HAPIFHIRClient, "search", search)
    return calls


async def _scans_finished():
    for _, task in list(dcs._SCANS.values()):
        await task


@pytest.mark.asyncio
async def test_catalog_covers_resources_beyond_the_first_page(monkeypatch):
    # 1,200 procedures: the common code fills page one, the rare one is last.
    resources = [_procedure("common")] * 1199 + [_procedure("rare")]
    calls = _fake_hapi(monkeypatch, resources)

    # First request answers from page one without waiting for the scan...
    first = await DynamicCatalogService().extract_procedure_catalog()
    assert [p["code"] for p in first] == ["common"]

    # ...and the scan it started fills in the rest, for every later request
    # and every later instance.
    await _scans_finished()
    full = await DynamicCatalogService().extract_procedure_catalog()
    assert {p["code"]: p["frequency_count"] for p in full} == {"common": 1199, "rare": 1}

    assert all(c["_sort"] == "_id" for c in calls), "offset paging without a stable sort"
    n_calls = len(calls)
    await DynamicCatalogService().extract_procedure_catalog(limit=1)
    assert len(calls) == n_calls, "a cached, complete catalog went back to HAPI"


@pytest.mark.asyncio
async def test_single_page_catalog_needs_no_scan(monkeypatch):
    calls = _fake_hapi(monkeypatch, [_procedure("a"), _procedure("b"), _procedure("a")])

    procs = await DynamicCatalogService().extract_procedure_catalog()
    assert [(p["code"], p["frequency_count"]) for p in procs] == [("a", 2), ("b", 1)]
    assert dcs._SCANS == {}
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_failed_scan_keeps_serving_the_first_page(monkeypatch):
    _fake_hapi(monkeypatch, [_procedure("common")] * 600, fail_after_first_page=True)

    svc = DynamicCatalogService()
    assert [p["code"] for p in await svc.extract_procedure_catalog()] == ["common"]
    await _scans_finished()
    assert [p["code"] for p in await svc.extract_procedure_catalog()] == ["common"]
    assert dcs._CACHE["procedures"].complete is False


@pytest.mark.asyncio
async def test_imaging_catalog_reads_synthea_shaped_studies(monkeypatch):
    def study(code, display, modality, body_site):
        # What Synthea emits: no top-level description or modality.
        return {"resource": {
            "resourceType": "ImagingStudy",
            "procedureCode": [{"coding": [{"system": "http://snomed.info/sct", "code": code, "display": display}],
                               "text": display}],
            "series": [{"modality": {"code": modality}, "bodySite": {"display": body_site}}],
        }}

    _fake_hapi(monkeypatch, [
        study("399208008", "Plain chest X-ray (procedure)", "CR", "Thoracic structure (body structure)"),
        study("40701008", "Echocardiography (procedure)", "US", "Heart structure (body structure)"),
        study("399208008", "Plain chest X-ray (procedure)", "CR", "Thoracic structure (body structure)"),
        # A server that does populate the top-level fields keeps working.
        {"resource": {"resourceType": "ImagingStudy", "description": "CT Head", "modality": [{"code": "CT"}]}},
    ])

    imaging = await DynamicCatalogService().extract_imaging_catalog()
    assert [(s["code"], s["display"], s["modality"], s["body_site"], s["frequency_count"]) for s in imaging] == [
        ("399208008", "Plain chest X-ray (procedure)", "CR", "Thoracic structure (body structure)", 2),
        ("40701008", "Echocardiography (procedure)", "US", "Heart structure (body structure)", 1),
        ("CT Head", "CT Head", "CT", None, 1),
    ]
