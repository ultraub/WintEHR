"""Tests for the local terminology index — build script + LocalTerminologyIndex.

Round-trips fixture JSON through `build_terminology_index.py` into a
tmpdir SQLite file, then exercises the search behaviors that catalog
endpoints depend on. These tests don't touch HAPI or the database — the
index is intentionally HAPI-independent.
"""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

import pytest

# `backend/` is the repo's PYTHONPATH root in production (uvicorn runs
# from there); test-time we have to add it explicitly because pytest's
# rootdir is the repo root.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))
sys.path.insert(0, str(BACKEND_ROOT / "scripts" / "active"))

import build_terminology_index  # noqa: E402
from services.local_terminology_index import (  # noqa: E402
    LocalTerminologyIndex,
    _build_fts_query,
)


@pytest.fixture
def fixture_json_dir(tmp_path: Path) -> Path:
    """Write small CodeSystem JSON fixtures the build script can read."""
    rxnorm = {
        "url": "http://www.nlm.nih.gov/research/umls/rxnorm",
        "name": "RxNorm",
        "concept": [
            {"code": "860975", "display": "Metformin hydrochloride 500 MG Tablet", "property": {"TTY": "SCD"}},
            {"code": "6809",   "display": "metformin",                              "property": {"TTY": "IN"}},
            {"code": "1551291","display": "lisinopril 10 MG Oral Tablet",           "property": {"TTY": "SCD"}},
            {"code": "29046",  "display": "lisinopril",                             "property": {"TTY": "IN"}},
        ],
    }
    icd = {
        "url": "http://hl7.org/fhir/sid/icd-10-cm",
        "name": "ICD-10-CM",
        "concept": [
            {"code": "E11.9",  "display": "Type 2 diabetes mellitus without complications"},
            {"code": "E11.65", "display": "Type 2 diabetes mellitus with hyperglycemia"},
            {"code": "I10",    "display": "Essential (primary) hypertension"},
        ],
    }
    (tmp_path / "rxnorm.json").write_text(json.dumps(rxnorm))
    (tmp_path / "icd10cm.json").write_text(json.dumps(icd))
    return tmp_path


@pytest.fixture
def built_db(tmp_path: Path, fixture_json_dir: Path) -> Path:
    """Run the build script against the fixture JSON; return the DB path."""
    output = tmp_path / "terminology.db"
    total = build_terminology_index.build_index(
        json_dir=fixture_json_dir,
        ucum_path=None,
        output_db=output,
    )
    # 4 medications + 2 ingredients (TTY=IN filter) + 3 ICD-10 conditions
    assert total == 9
    return output


# -- _build_fts_query -------------------------------------------------------

def test_fts_query_simple_word():
    assert _build_fts_query("metformin") == '"metformin"*'


def test_fts_query_multiple_tokens_anded():
    # FTS5 default operator is AND; both tokens must match.
    assert _build_fts_query("type 2 diabetes") == '"type"* "2"* "diabetes"*'


def test_fts_query_strips_punctuation():
    # Apostrophes/parens shouldn't reach FTS5 — they break the parser.
    assert _build_fts_query("Patient's (chronic)") == '"Patient"* "s"* "chronic"*'


def test_fts_query_empty_input():
    assert _build_fts_query("") == ""
    assert _build_fts_query("   ") == ""
    assert _build_fts_query("()") == ""


# -- build_index ------------------------------------------------------------

def test_build_index_creates_expected_schema(built_db: Path):
    conn = sqlite3.connect(str(built_db))
    tables = {row[0] for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'"
    )}
    conn.close()
    assert "concepts" in tables
    assert "concepts_fts" in tables
    assert "idx_concepts_domain" in tables


def test_build_index_tty_filter_for_ingredients(built_db: Path):
    """medication_ingredients only contains TTY=IN concepts."""
    conn = sqlite3.connect(str(built_db))
    rows = conn.execute(
        "SELECT code, display FROM concepts WHERE domain = 'medication_ingredients' ORDER BY code"
    ).fetchall()
    conn.close()
    assert rows == [
        ("29046", "lisinopril"),
        ("6809",  "metformin"),
    ]


def test_build_index_idempotent(tmp_path: Path, fixture_json_dir: Path):
    """Running the build twice produces the same row count, no duplication."""
    output = tmp_path / "terminology.db"
    build_terminology_index.build_index(fixture_json_dir, None, output)
    first = sqlite3.connect(str(output)).execute("SELECT COUNT(*) FROM concepts").fetchone()[0]
    build_terminology_index.build_index(fixture_json_dir, None, output)
    second = sqlite3.connect(str(output)).execute("SELECT COUNT(*) FROM concepts").fetchone()[0]
    assert first == second == 9


def test_build_index_handles_missing_files(tmp_path: Path):
    """If a domain's source JSON is absent, that domain is empty (not an error)."""
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()
    output = tmp_path / "terminology.db"
    total = build_terminology_index.build_index(empty_dir, None, output)
    assert total == 0
    conn = sqlite3.connect(str(output))
    # Schema still exists so search returns [] cleanly rather than crashing.
    rows = conn.execute("SELECT COUNT(*) FROM concepts").fetchone()
    assert rows == (0,)


# -- LocalTerminologyIndex search ------------------------------------------

@pytest.mark.asyncio
async def test_search_catalog_prefix_match(built_db: Path):
    """Typing 'metf' returns both metformin medication entries."""
    idx = LocalTerminologyIndex(str(built_db))
    try:
        results = await idx.search_catalog("medications", "metf", count=10)
    finally:
        idx.close()
    codes = {r["code"] for r in results}
    assert codes == {"860975", "6809"}


@pytest.mark.asyncio
async def test_search_catalog_multi_token_anded(built_db: Path):
    """'type 2' returns both Type 2 diabetes rows but not hypertension."""
    idx = LocalTerminologyIndex(str(built_db))
    try:
        results = await idx.search_catalog("conditions_icd10", "type 2 diabetes", count=10)
    finally:
        idx.close()
    codes = {r["code"] for r in results}
    assert codes == {"E11.9", "E11.65"}


@pytest.mark.asyncio
async def test_search_catalog_no_filter_returns_all(built_db: Path):
    """No filter returns every concept in the domain (up to count)."""
    idx = LocalTerminologyIndex(str(built_db))
    try:
        results = await idx.search_catalog("conditions_icd10", None, count=100)
    finally:
        idx.close()
    assert len(results) == 3


@pytest.mark.asyncio
async def test_search_catalog_unknown_domain_empty(built_db: Path):
    idx = LocalTerminologyIndex(str(built_db))
    try:
        results = await idx.search_catalog("not_a_real_domain", "anything", count=10)
    finally:
        idx.close()
    assert results == []


@pytest.mark.asyncio
async def test_search_catalog_missing_db_returns_empty(tmp_path: Path):
    """Missing index file shouldn't crash — return [] so callers degrade gracefully."""
    idx = LocalTerminologyIndex(str(tmp_path / "does-not-exist.db"))
    results = await idx.search_catalog("medications", "anything", count=10)
    assert results == []


@pytest.mark.asyncio
async def test_search_multi_runs_concurrently(built_db: Path):
    """search_multi returns one entry per requested domain."""
    idx = LocalTerminologyIndex(str(built_db))
    try:
        results = await idx.search_multi(
            ["medications", "conditions_icd10"], "lisinopril", count=10
        )
    finally:
        idx.close()
    assert set(results.keys()) == {"medications", "conditions_icd10"}
    # 'lisinopril' matches both lisinopril rows in medications and nothing
    # in conditions.
    assert {r["code"] for r in results["medications"]} == {"1551291", "29046"}
    assert results["conditions_icd10"] == []
