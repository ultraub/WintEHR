#!/usr/bin/env python3
"""Build a local SQLite terminology index for catalog search.

The clinical workspace dialogs (Add Condition, Add Medication, etc.) and the
CDS Studio's ValueSet Composer query `/api/catalogs/*` for autocomplete.
Those endpoints are layered:

  1. Dynamic results extracted from actual Synthea patient data
  2. Terminology fallback via the wintehr-* ValueSets in HAPI

Layer 2 is broken: HAPI's in-memory $expand fails with HAPI-0831 ("produced
too many codes") on the big CodeSystems (RxNorm 121K, LOINC 175K, ICD-10
98K). The HSearch infrastructure that would index those is currently
disabled for heap reasons. So search degrades to layer 1 only — typing
"diabetes" returns one ICD-10 code (E11.9) instead of the full list.

This script bypasses HAPI entirely for layer 2: it reads the same JSON
CodeSystem files that `scripts/load_terminology.py` uploads to HAPI and
builds a local SQLite index with FTS5 search over the display text.
The backend's `LocalTerminologyIndex` queries this index instead.

Domain mapping mirrors `scripts/load_terminology.py:VALUESETS` exactly so
the local index stays aligned with the wintehr-* ValueSets that already
live in HAPI:

    medications              ← rxnorm.json  (no filter)
    medication_ingredients   ← rxnorm.json  (TTY=IN filter)
    conditions_icd10         ← icd10cm.json
    conditions_snomed        ← snomed.json  (only if present; SNOMED is
                                opt-in via UMLS Affiliate license)
    lab_tests                ← loinc.json
    procedures_snomed        ← snomed.json  (same caveat)
    procedures_hcpcs         ← hcpcs.json
    vaccines                 ← cvx.json
    units                    ← ucum.json    (bundled in scripts/)
    drug_classes             ← atc.json

The build is idempotent: drops the existing tables and rebuilds. SQLite
file lives at the path passed via --output (deploy.sh writes
/app/data/terminology.db).

Usage (typically via deploy.sh; see ops):

    python3 backend/scripts/active/build_terminology_index.py \
        --json-dir /tmp/fhir_vocabularies/terminology \
        --ucum-json /tmp/ucum.json \
        --output /app/data/terminology.db
"""

from __future__ import annotations

import argparse
import json
import logging
import sqlite3
import sys
import time
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Domain → (filename in --json-dir, optional TTY filter).
# `tty_filter` is the set of property.TTY values to include; None means
# "include all concepts." Filenames without a `.json` ext are special
# (`ucum` is supplied via --ucum-json since it lives outside the
# UMLS-extracted vocabulary dir).
JSON_DOMAINS: List[Tuple[str, str, Optional[set]]] = [
    ("medications",            "rxnorm.json",  None),
    ("medication_ingredients", "rxnorm.json",  {"IN"}),
    ("conditions_icd10",       "icd10cm.json", None),
    ("conditions_snomed",      "snomed.json",  None),
    ("lab_tests",              "loinc.json",   None),
    ("procedures_snomed",      "snomed.json",  None),
    ("procedures_hcpcs",       "hcpcs.json",   None),
    ("vaccines",               "cvx.json",     None),
    ("drug_classes",           "atc.json",     None),
]

UCUM_DOMAIN = "units"


def _iter_concepts(
    code_system: dict,
    tty_filter: Optional[set],
) -> Iterable[Tuple[str, str, str]]:
    """Yield (system, code, display) tuples from a CodeSystem JSON."""
    system = code_system.get("url") or ""
    for concept in code_system.get("concept") or []:
        if not isinstance(concept, dict):
            continue
        code = concept.get("code")
        display = concept.get("display") or ""
        if not code or not display:
            continue
        if tty_filter is not None:
            tty = (concept.get("property") or {}).get("TTY")
            if tty not in tty_filter:
                continue
        yield system, code, display


def _create_schema(conn: sqlite3.Connection) -> None:
    """Drop and rebuild the schema. Idempotent across invocations."""
    cur = conn.cursor()
    cur.executescript(
        """
        DROP TABLE IF EXISTS concepts_fts;
        DROP TABLE IF EXISTS concepts;

        CREATE TABLE concepts (
            domain  TEXT NOT NULL,
            system  TEXT NOT NULL,
            code    TEXT NOT NULL,
            display TEXT NOT NULL,
            PRIMARY KEY (domain, system, code)
        );

        -- FTS5 with unicode61 + remove_diacritics so 'metformin' matches
        -- 'Metformin'. content='concepts' makes FTS a contentless shadow
        -- of the main table; rowid pairing is via the FTS-managed rowid.
        CREATE VIRTUAL TABLE concepts_fts USING fts5(
            display,
            tokenize='unicode61'
        );
        """
    )
    conn.commit()


def _load_codesystem_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _ingest_domain(
    conn: sqlite3.Connection,
    domain: str,
    code_system: Optional[dict],
    tty_filter: Optional[set],
) -> int:
    """Insert all concepts for one domain, including FTS rows. Returns count."""
    if code_system is None:
        return 0
    cur = conn.cursor()
    rows: List[Tuple[str, str, str, str]] = []
    fts_rows: List[Tuple[str, int]] = []

    # Insert in one batch so FTS rowids line up. We rely on autoincrement-style
    # rowid alignment between `concepts` and `concepts_fts` — both tables
    # start empty after _create_schema and are written in lockstep.
    for system, code, display in _iter_concepts(code_system, tty_filter):
        rows.append((domain, system, code, display))

    if not rows:
        return 0

    cur.executemany(
        "INSERT OR IGNORE INTO concepts (domain, system, code, display) "
        "VALUES (?, ?, ?, ?)",
        rows,
    )
    # Sync FTS table from main table so rowids line up. We pull only the
    # rows we just inserted (filter by domain). Doing this after the
    # main insert (rather than via INSERT triggers) keeps the build script
    # straightforward and idempotent.
    cur.execute(
        "INSERT INTO concepts_fts (rowid, display) "
        "SELECT rowid, display FROM concepts WHERE domain = ?",
        (domain,),
    )
    conn.commit()
    return len(rows)


def build_index(
    json_dir: Path,
    ucum_path: Optional[Path],
    output_db: Path,
) -> int:
    """Build the SQLite index. Returns total concept count."""
    output_db.parent.mkdir(parents=True, exist_ok=True)
    if output_db.exists():
        output_db.unlink()

    conn = sqlite3.connect(str(output_db))
    # WAL gives concurrent readers + a single writer, the right shape for
    # a backend that holds a long-lived read connection.
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")

    try:
        _create_schema(conn)

        total = 0
        loaded_files: dict = {}  # filename → parsed CodeSystem JSON, cached
        for domain, filename, tty_filter in JSON_DOMAINS:
            if filename not in loaded_files:
                loaded_files[filename] = _load_codesystem_json(json_dir / filename)
            cs = loaded_files[filename]
            count = _ingest_domain(conn, domain, cs, tty_filter)
            status = "ok" if cs is not None else "missing"
            logger.info("  %-26s %-15s %8d concepts  (%s)", domain, filename, count, status)
            total += count

        # UCUM lives outside the UMLS-extracted vocabulary dir.
        if ucum_path is not None:
            ucum_cs = _load_codesystem_json(ucum_path)
            count = _ingest_domain(conn, UCUM_DOMAIN, ucum_cs, None)
            status = "ok" if ucum_cs is not None else "missing"
            logger.info("  %-26s %-15s %8d concepts  (%s)", UCUM_DOMAIN, ucum_path.name, count, status)
            total += count
        else:
            logger.info("  %-26s (no --ucum-json provided; skipping)", UCUM_DOMAIN)

        # Helper indexes for the most common access patterns. The PRIMARY
        # KEY already covers (domain, system, code) lookups; add a domain-
        # only index for "list everything in this domain" pagination.
        conn.execute("CREATE INDEX idx_concepts_domain ON concepts(domain)")
        conn.commit()

        # ANALYZE so the SQLite query planner picks reasonable plans for
        # the prefix-match queries the backend issues.
        conn.execute("ANALYZE")
    finally:
        conn.close()

    return total


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json-dir",
        required=True,
        type=Path,
        help="Directory containing rxnorm.json, icd10cm.json, etc.",
    )
    parser.add_argument(
        "--ucum-json",
        type=Path,
        default=None,
        help="Path to scripts/ucum.json (units catalog, not in UMLS extract).",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Where to write the SQLite database file.",
    )
    args = parser.parse_args()

    if not args.json_dir.is_dir():
        logger.error("--json-dir does not exist: %s", args.json_dir)
        return 2

    started = time.monotonic()
    logger.info("Building terminology index → %s", args.output)
    total = build_index(args.json_dir, args.ucum_json, args.output)
    elapsed = time.monotonic() - started
    size_mb = args.output.stat().st_size / (1024 * 1024)
    logger.info(
        "Done. %d concepts, %.1f MB, %.1fs",
        total, size_mb, elapsed,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
