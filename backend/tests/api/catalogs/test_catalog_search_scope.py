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
