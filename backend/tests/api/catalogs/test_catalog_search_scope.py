"""
Regression: catalog search must scan the FULL dynamic catalog, not the
top-`limit` most-frequent slice.

Found live during the post-refactor workflow review: searching 'aspirin'
in the Order Composer returned "No options" because
UnifiedCatalogService extracted only the top-25 medications by frequency
and THEN filtered — any drug outside the top N was unfindable. Same
pattern existed for labs and conditions.
"""

from __future__ import annotations

import pytest

from api.catalogs.service import UnifiedCatalogService


def _catalog(n_before_target: int):
    """A frequency-ranked catalog whose target entry sits BELOW the limit."""
    entries = [
        {"code": f"c{i}", "display": f"Common Med {i}", "frequency_count": 1000 - i}
        for i in range(n_before_target)
    ]
    entries.append({"code": "asa", "display": "Aspirin 81 MG Oral Tablet", "frequency_count": 1})
    return entries


@pytest.mark.asyncio
async def test_search_finds_entries_outside_the_top_limit(monkeypatch):
    svc = UnifiedCatalogService.__new__(UnifiedCatalogService)

    calls = []

    class FakeDynamic:
        async def extract_medication_catalog(self, limit=None):
            calls.append(limit)
            full = _catalog(50)
            return full[:limit] if limit else full

    svc.dynamic_service = FakeDynamic()

    # With a search term the extraction must be UNLIMITED, and the filter
    # must find the low-frequency entry, truncated only afterwards.
    meds = await svc._dynamic_medications("aspirin", 25)
    assert calls == [None], "search extracted a truncated slice"
    assert [m["display"] for m in meds] == ["Aspirin 81 MG Oral Tablet"]

    # Without a search term the limit passes straight through (no need to
    # pull the whole catalog for a browse).
    calls.clear()
    browse = await svc._dynamic_medications(None, 25)
    assert calls == [25]
    assert len(browse) == 25


@pytest.mark.asyncio
async def test_condition_rows_report_the_system_their_code_belongs_to():
    """B9: rows must distinguish SNOMED from ICD-10, not report neither.

    The dynamic extractor emits {code, system, display}; the catalog used
    to read non-existent icd10_code/snomed_code keys, so every row came
    back with both null and the UI labeled SNOMED codes 'ICD-10'.
    """
    svc = UnifiedCatalogService.__new__(UnifiedCatalogService)

    class FakeDynamic:
        async def extract_condition_catalog(self, limit=None):
            return [
                {"code": "66383009", "system": "http://snomed.info/sct", "display": "Gingivitis"},
                {"code": "E11.9", "system": "http://hl7.org/fhir/sid/icd-10-cm", "display": "T2DM"},
            ]

    class FakeTerm:
        async def search_catalog(self, *a, **k):
            return []

    svc.dynamic_service = FakeDynamic()
    svc.terminology = FakeTerm()

    rows = await svc.search_conditions(None, 10)
    by_code = {r.id: r for r in rows}

    assert by_code["66383009"].snomed_code == "66383009"
    assert by_code["66383009"].icd10_code is None
    assert by_code["E11.9"].icd10_code == "E11.9"
    assert by_code["E11.9"].snomed_code is None


@pytest.mark.asyncio
async def test_catalog_never_asserts_facts_it_has_no_data_for():
    """Unknown is None — not a convenient default.

    The catalog previously shipped is_formulary=True,
    is_controlled_substance=False and requires_authorization=False on every
    medication, and specimen_type='blood' on every lab test, with nothing
    behind any of it. In a platform that teaches pharmacy and lab
    workflows, that taught students falsehoods (a controlled substance
    reported as uncontrolled; a urinalysis reported as a blood specimen).
    """
    svc = UnifiedCatalogService.__new__(UnifiedCatalogService)

    class FakeDynamic:
        async def extract_medication_catalog(self, limit=None):
            # The extractor's real output shape — no strength/form/route.
            return [{"id": "med_1", "code": "1", "display": "Oxycodone 5 MG Oral Tablet",
                     "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                     "frequency_count": 3, "source": "patient_data"}]

        async def extract_lab_test_catalog(self, limit=None):
            return [{"id": "lab_1", "code": "5792-7", "display": "Glucose in Urine",
                     "loinc_code": "5792-7", "category": "laboratory",
                     "specimen_type": None, "frequency_count": 2}]

    class FakeTerm:
        async def search_catalog(self, *a, **k):
            return []

    svc.dynamic_service = FakeDynamic()
    svc.terminology = FakeTerm()

    med = (await svc.search_medications(None, 10))[0]
    assert med.is_controlled_substance is None, "asserted a scheduling fact"
    assert med.is_formulary is None, "asserted formulary status"
    assert med.requires_authorization is None, "asserted an auth requirement"
    # Facts the source genuinely carries are still populated.
    assert med.generic_name == "Oxycodone 5 MG Oral Tablet"
    assert med.rxnorm_code == "1"
    assert med.usage_count == 3

    lab = (await svc.search_lab_tests(None, 10))[0]
    assert lab.specimen_type is None, "claimed a specimen it never observed"
    assert lab.loinc_code == "5792-7"
