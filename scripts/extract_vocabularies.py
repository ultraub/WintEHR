#!/usr/bin/env python3
"""
extract_vocabularies.py - OMOP CDM vocabulary CSVs → FHIR-compatible JSON

Reads the OMOP Athena vocabulary bundle (CONCEPT.csv plus friends) and produces
per-vocabulary JSON files that scripts/load_terminology.py consumes unchanged.

This is the missing first half of the terminology pipeline. Output format matches
what load_terminology.py expects: one JSON file per vocabulary under
output_dir/terminology/, keyed by the lowercase vocab filename stem (rxnorm.json,
icd10cm.json, loinc.json, ...).

INPUT (OMOP CDM vocabulary download from https://athena.ohdsi.org/vocabulary/list):
  athena_dir/
    CONCEPT.csv          — all concepts (large; typical 1-5 GB, 8M+ rows)
    VOCABULARY.csv       — vocabulary metadata (optional, used for version info)

OUTPUT:
  output_dir/
    terminology/
      rxnorm.json        — RxNorm
      icd10cm.json       — ICD-10-CM
      loinc.json         — LOINC
      cvx.json           — CVX vaccine codes
      hcpcs.json         — HCPCS Level II
      ucum.json          — UCUM units
      atc.json           — ATC drug classification
      snomed.json        — (only if --include-snomed)

LICENSE AWARENESS:
  RxNorm, ICD-10-CM, LOINC, CVX, HCPCS, UCUM, ATC are included by default
  (all public-domain or permissive licenses safe for open-web redistribution).

  SNOMED CT is OPT-IN via --include-snomed. Redistribution requires a UMLS
  Metathesaurus License (free, NLM registration) and in non-US contexts a
  SNOMED International Affiliate License. Do not --include-snomed for
  public-web deployments unless your target audience is only UMLS-licensed
  users or you've arranged SNOMED International terms.

  CPT-4 and WHO ICD-10 are never included unless --unsafe-include-commercial.
  Both require paid licenses and are excluded from any non-licensed packaging.

USAGE:
    # Default set (client-VPC safe, no SNOMED):
    python3 scripts/extract_vocabularies.py /path/to/athena_csv ./fhir_vocabularies

    # Include SNOMED (verify license before using):
    python3 scripts/extract_vocabularies.py /path/to/athena_csv ./fhir_vocabularies \
        --include-snomed

    # Subset for testing:
    python3 scripts/extract_vocabularies.py /path/to/athena_csv ./fhir_vocabularies \
        --only rxnorm loinc --max-per-vocab 1000

    # Then load to HAPI:
    python3 scripts/load_terminology.py ./fhir_vocabularies

Requirements: Python 3.8+ (no external packages — stdlib only).
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Set

logger = logging.getLogger("extract_vocabularies")

# =============================================================================
# Vocabulary mapping
# =============================================================================
# Maps the OMOP `vocabulary_id` column value → (output file stem, canonical
# FHIR system URL, license tier). Filename stem must match the lowercased key
# in load_terminology.py's FHIR_SYSTEMS dict — the loader derives the FHIR ID
# from the filename.
#
# License tiers govern default inclusion:
#   "public"     : Default-on. Safe for open-web redistribution.
#   "restricted" : Default-off. Requires UMLS + SNOMED Affiliate license.
#   "commercial" : Default-off. Requires paid license (AMA for CPT-4, WHO for ICD-10).
#
# Two OMOP vocabularies (RxNorm and RxNorm Extension) share the same FHIR
# system URL and get merged into a single rxnorm.json output file — HAPI
# FHIR treats them as one CodeSystem.

VOCAB_MAP: Dict[str, tuple] = {
    # Public — default-on
    "RxNorm":           ("rxnorm",   "http://www.nlm.nih.gov/research/umls/rxnorm",             "public"),
    "RxNorm Extension": ("rxnorm",   "http://www.nlm.nih.gov/research/umls/rxnorm",             "public"),
    "ICD10CM":          ("icd10cm",  "http://hl7.org/fhir/sid/icd-10-cm",                       "public"),
    "LOINC":            ("loinc",    "http://loinc.org",                                        "public"),
    "CVX":              ("cvx",      "http://hl7.org/fhir/sid/cvx",                             "public"),
    "HCPCS":            ("hcpcs",    "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets", "public"),
    "UCUM":             ("ucum",     "http://unitsofmeasure.org",                               "public"),
    "ATC":              ("atc",      "http://www.whocc.no/atc",                                 "public"),

    # Restricted — opt-in via --include-snomed
    "SNOMED":           ("snomed",   "http://snomed.info/sct",                                  "restricted"),

    # Commercial — opt-in via --unsafe-include-commercial
    "CPT4":             ("cpt4",     "http://www.ama-assn.org/go/cpt",                          "commercial"),
    "ICD10":            ("icd10",    "http://hl7.org/fhir/sid/icd-10",                          "commercial"),
}

# Display name for CodeSystem.name / .title
VOCAB_DISPLAY_NAMES: Dict[str, str] = {
    "rxnorm":  "RxNorm",
    "snomed":  "SNOMED CT",
    "icd10cm": "ICD-10-CM",
    "icd10":   "ICD-10 (WHO)",
    "loinc":   "LOINC",
    "cvx":     "CVX",
    "hcpcs":   "HCPCS",
    "ucum":    "UCUM",
    "atc":     "ATC",
    "cpt4":    "CPT-4",
}

# Expected OMOP CONCEPT.csv columns. If any are missing, we warn but continue
# (using .get() lookups, so missing columns produce None).
REQUIRED_OMOP_COLUMNS = {
    "concept_code", "concept_name", "vocabulary_id",
}
OPTIONAL_OMOP_COLUMNS = {
    "domain_id", "concept_class_id", "standard_concept", "invalid_reason",
}


# =============================================================================
# CSV streaming
# =============================================================================

def sniff_delimiter(csv_path: Path) -> str:
    """Peek at the first 4 KB to pick tab vs comma. Falls back to tab (OMOP default)."""
    try:
        with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
            sample = f.read(4096)
    except OSError:
        return "\t"
    header_line = sample.split("\n", 1)[0]
    tab_count = header_line.count("\t")
    comma_count = header_line.count(",")
    return "\t" if tab_count >= comma_count else ","


def find_concept_csv(athena_dir: Path) -> Path:
    """Athena distributions use various casings. Find whichever exists."""
    for name in ("CONCEPT.csv", "concept.csv", "CONCEPT.bcp", "concept.bcp"):
        candidate = athena_dir / name
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        f"Could not find CONCEPT.csv (or .bcp) in {athena_dir}. "
        "Expected an OMOP Athena vocabulary bundle."
    )


def iter_concept_rows(csv_path: Path, delimiter: str) -> Iterator[dict]:
    """Stream rows from OMOP CONCEPT.csv. Skips malformed rows with a warning."""
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        fieldnames = set(reader.fieldnames or [])
        missing = REQUIRED_OMOP_COLUMNS - fieldnames
        if missing:
            raise ValueError(
                f"CONCEPT.csv is missing required columns: {sorted(missing)}. "
                f"Found columns: {sorted(fieldnames)}"
            )
        absent_optional = OPTIONAL_OMOP_COLUMNS - fieldnames
        if absent_optional:
            logger.warning(
                "CONCEPT.csv is missing optional columns %s — some FHIR properties won't be emitted",
                sorted(absent_optional),
            )
        yield from reader


# =============================================================================
# Row → FHIR-compatible concept
# =============================================================================

def build_concept(row: dict) -> Optional[dict]:
    """
    Transform one OMOP CONCEPT row into the dict load_terminology.py consumes.
    Returns None if the concept should be skipped (deprecated or missing data).
    """
    # Skip deprecated concepts (OMOP marks these with non-empty invalid_reason)
    if (row.get("invalid_reason") or "").strip():
        return None

    code = (row.get("concept_code") or "").strip()
    display = (row.get("concept_name") or "").strip()
    if not code or not display:
        return None

    # OMOP-derived filterable properties. Emitted as a dict here;
    # load_terminology.py's transform_concept_to_fhir() converts it to the
    # FHIR "property" array shape.
    properties: Dict[str, str] = {}
    for omop_col, fhir_prop in (
        ("domain_id", "domain"),
        ("concept_class_id", "conceptClass"),
        ("standard_concept", "standardConcept"),
    ):
        v = (row.get(omop_col) or "").strip()
        if v:
            properties[fhir_prop] = v

    concept = {"code": code, "display": display}
    if properties:
        concept["property"] = properties
    return concept


# =============================================================================
# Extraction driver
# =============================================================================

def extract(
    athena_dir: Path,
    output_dir: Path,
    selected_stems: Optional[Set[str]] = None,
    include_snomed: bool = False,
    include_commercial: bool = False,
    standard_only: bool = False,
    max_per_vocab: Optional[int] = None,
    delimiter: Optional[str] = None,
) -> Dict[str, int]:
    """Run extraction. Returns {file_stem: concept_count}."""
    concept_csv = find_concept_csv(athena_dir)
    if delimiter is None:
        delimiter = sniff_delimiter(concept_csv)
        logger.info("Detected delimiter: %r", delimiter)

    term_dir = output_dir / "terminology"
    term_dir.mkdir(parents=True, exist_ok=True)

    # Build the set of stems we're actually extracting, respecting license tiers.
    all_stems = {stem for stem, _, _ in VOCAB_MAP.values()}
    active_stems: Set[str] = set()
    for _omop_id, (stem, _url, tier) in VOCAB_MAP.items():
        if tier == "public":
            active_stems.add(stem)
        elif tier == "restricted" and include_snomed:
            active_stems.add(stem)
        elif tier == "commercial" and include_commercial:
            active_stems.add(stem)

    # Apply user-provided --only filter (intersection).
    if selected_stems:
        unknown = selected_stems - all_stems
        for u in unknown:
            logger.warning("Unknown vocabulary in --only: %s", u)
        active_stems &= selected_stems

    if not active_stems:
        raise SystemExit(
            "No vocabularies selected. Check --only, --include-snomed, and "
            "--unsafe-include-commercial flags."
        )

    skipped_stems = sorted(all_stems - active_stems)
    logger.info("Extracting:  %s", ", ".join(sorted(active_stems)))
    if skipped_stems:
        logger.info("Skipping:    %s", ", ".join(skipped_stems))
    if standard_only:
        logger.info("Filter:      OMOP standard concepts only (standard_concept in {S, C})")
    if max_per_vocab:
        logger.info("Cap:         %d concepts per vocabulary", max_per_vocab)
    logger.info("Input:       %s", concept_csv)
    logger.info("Output:      %s", term_dir)
    logger.info("")

    # Stream CONCEPT.csv once, bucket by output stem.
    buckets: Dict[str, List[dict]] = defaultdict(list)
    rows_read = 0
    rows_kept = 0
    t0 = time.time()

    for row in iter_concept_rows(concept_csv, delimiter):
        rows_read += 1

        if rows_read % 500_000 == 0:
            elapsed = time.time() - t0
            logger.info(
                "  Read %s rows in %.1fs (%d kept across %d vocabs)",
                f"{rows_read:,}", elapsed, rows_kept, len(buckets),
            )

        vocab = (row.get("vocabulary_id") or "").strip()
        mapping = VOCAB_MAP.get(vocab)
        if not mapping:
            continue
        stem, _url, _tier = mapping
        if stem not in active_stems:
            continue

        if standard_only:
            sc = (row.get("standard_concept") or "").strip()
            if sc not in ("S", "C"):
                continue

        if max_per_vocab and len(buckets[stem]) >= max_per_vocab:
            continue

        concept = build_concept(row)
        if concept is None:
            continue

        buckets[stem].append(concept)
        rows_kept += 1

    # Deduplicate within each bucket (RxNorm + RxNorm Extension can overlap on code).
    for stem, concepts in buckets.items():
        seen: Set[str] = set()
        deduped: List[dict] = []
        for c in concepts:
            if c["code"] in seen:
                continue
            seen.add(c["code"])
            deduped.append(c)
        if len(deduped) != len(concepts):
            logger.info("  %s: deduplicated %d → %d concepts",
                        stem, len(concepts), len(deduped))
        buckets[stem] = deduped

    # Write one JSON per vocabulary.
    summary: Dict[str, int] = {}
    for stem in sorted(buckets.keys()):
        concepts = buckets[stem]

        # Look up canonical URL from the first OMOP mapping that pointed here.
        url = next(u for _om, (s, u, _t) in VOCAB_MAP.items() if s == stem)

        data = {
            "url": url,
            "name": VOCAB_DISPLAY_NAMES.get(stem, stem),
            "count": len(concepts),
            "concept": concepts,  # load_terminology.py reads data["concept"]
        }

        out_path = term_dir / f"{stem}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        size_mb = out_path.stat().st_size / (1024 * 1024)
        logger.info("  wrote %s: %s concepts (%.1f MB)",
                    out_path.name, f"{len(concepts):,}", size_mb)
        summary[stem] = len(concepts)

    elapsed = time.time() - t0
    logger.info("")
    logger.info("Done in %.1fs — read %s rows, kept %s.",
                elapsed, f"{rows_read:,}", f"{rows_kept:,}")
    return summary


# =============================================================================
# CLI
# =============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract OMOP CDM vocabulary CSVs to FHIR-compatible JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "The output is consumed by scripts/load_terminology.py, which POSTs\n"
            "CodeSystem and ValueSet resources into HAPI FHIR. See the docstring\n"
            "at the top of this file for the end-to-end workflow."
        ),
    )
    parser.add_argument("athena_dir", type=Path,
                        help="Directory containing CONCEPT.csv from an Athena download")
    parser.add_argument("output_dir", type=Path,
                        help="Output directory (will create output_dir/terminology/*.json)")
    parser.add_argument("--only", nargs="+", metavar="STEM",
                        help="Restrict to these stems (e.g. rxnorm loinc icd10cm)")
    parser.add_argument("--include-snomed", action="store_true",
                        help="Include SNOMED CT (requires UMLS/Affiliate license — see top of file)")
    parser.add_argument("--unsafe-include-commercial", action="store_true",
                        dest="include_commercial",
                        help="Include CPT-4 and WHO ICD-10 (REQUIRES paid licenses)")
    parser.add_argument("--standard-only", action="store_true",
                        help="Keep only OMOP standard concepts (standard_concept in {S, C})")
    parser.add_argument("--max-per-vocab", type=int, metavar="N",
                        help="Cap extracted concepts per vocabulary (for testing)")
    parser.add_argument("--delimiter", default=None,
                        help="CSV delimiter (default: auto-detect; fallback tab)")
    parser.add_argument("-v", "--verbose", action="store_true")

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )

    if not args.athena_dir.is_dir():
        logger.error("Athena directory does not exist: %s", args.athena_dir)
        return 2

    selected: Optional[Set[str]] = set(args.only) if args.only else None

    try:
        summary = extract(
            athena_dir=args.athena_dir,
            output_dir=args.output_dir,
            selected_stems=selected,
            include_snomed=args.include_snomed,
            include_commercial=args.include_commercial,
            standard_only=args.standard_only,
            max_per_vocab=args.max_per_vocab,
            delimiter=args.delimiter,
        )
    except Exception:
        logger.exception("Extraction failed")
        return 1

    print()
    print("Summary:")
    total = 0
    for stem, count in sorted(summary.items()):
        print(f"  {stem:12s} {count:>12,} concepts")
        total += count
    print(f"  {'TOTAL':12s} {total:>12,} concepts")
    print()
    print("Next step — load to HAPI:")
    print(f"  python3 scripts/load_terminology.py {args.output_dir}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
