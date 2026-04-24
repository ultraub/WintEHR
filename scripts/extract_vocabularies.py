#!/usr/bin/env python3
"""
extract_vocabularies.py - Terminology source → FHIR-compatible JSON

Accepts two input formats:

  • OMOP CDM vocabulary CSVs (CONCEPT.csv) from Athena
  • UMLS Metathesaurus RRF files (MRCONSO.RRF) from the UTS download API

Produces per-vocabulary JSON files that scripts/load_terminology.py consumes
unchanged. The format is auto-detected based on what's in the input directory,
or can be forced with --format.

INPUT — OMOP (from https://athena.ohdsi.org/vocabulary/list):
  input_dir/
    CONCEPT.csv          — all concepts
    VOCABULARY.csv       — optional

INPUT — UMLS (from scripts/download_umls.py):
  input_dir/
    MRCONSO.RRF          — concepts and strings
    MRSAB.RRF            — optional, used for version metadata

OUTPUT (same for both input formats):
  output_dir/
    terminology/
      rxnorm.json        — RxNorm (medications)
      icd10cm.json       — ICD-10-CM (conditions)
      loinc.json         — LOINC (lab tests)
      cvx.json           — CVX (vaccines)
      hcpcs.json         — HCPCS (procedures)
      atc.json           — ATC (drug classifications)
      snomed.json        — SNOMED CT (only if --include-snomed)

LICENSE AWARENESS:
  RxNorm, ICD-10-CM, LOINC, CVX, HCPCS, ATC: included by default — all
  permissively licensed for open-web redistribution.

  SNOMED CT: opt-in via --include-snomed. Redistribution requires UMLS +
  SNOMED Affiliate licenses. Don't pass on open-web deploys.

  CPT-4, WHO ICD-10: never auto-included (paid licenses).

USAGE:
    # UMLS mode (auto-detected from MRCONSO.RRF presence)
    python3 scripts/extract_vocabularies.py ~/umls_source ~/fhir_vocabularies

    # OMOP mode (auto-detected from CONCEPT.csv presence)
    python3 scripts/extract_vocabularies.py ~/athena_vocab ~/fhir_vocabularies

    # Force format
    python3 scripts/extract_vocabularies.py ~/source ~/out --format umls

    # With SNOMED (verify license)
    python3 scripts/extract_vocabularies.py ~/umls_source ~/out --include-snomed

    # Subset for testing
    python3 scripts/extract_vocabularies.py ~/umls_source ~/out \\
        --only rxnorm loinc --max-per-vocab 1000

Requirements: Python 3.8+ (stdlib only).
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
from typing import Dict, Iterator, List, Optional, Set, Tuple

logger = logging.getLogger("extract_vocabularies")

# =============================================================================
# Canonical output schema — shared by both input modes
# =============================================================================
# Each entry maps an output file stem to the canonical FHIR system URL and
# license tier. Both OMOP and UMLS modes write into this same set of files.

OUTPUT_VOCABS = {
    "rxnorm":  {"url": "http://www.nlm.nih.gov/research/umls/rxnorm",             "name": "RxNorm",     "tier": "public"},
    "icd10cm": {"url": "http://hl7.org/fhir/sid/icd-10-cm",                       "name": "ICD-10-CM",  "tier": "public"},
    "loinc":   {"url": "http://loinc.org",                                        "name": "LOINC",      "tier": "public"},
    "cvx":     {"url": "http://hl7.org/fhir/sid/cvx",                             "name": "CVX",        "tier": "public"},
    "hcpcs":   {"url": "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets", "name": "HCPCS",      "tier": "public"},
    "ucum":    {"url": "http://unitsofmeasure.org",                               "name": "UCUM",       "tier": "public"},
    "atc":     {"url": "http://www.whocc.no/atc",                                 "name": "ATC",        "tier": "public"},
    "snomed":  {"url": "http://snomed.info/sct",                                  "name": "SNOMED CT",  "tier": "restricted"},
    "cpt4":    {"url": "http://www.ama-assn.org/go/cpt",                          "name": "CPT-4",      "tier": "commercial"},
    "icd10":   {"url": "http://hl7.org/fhir/sid/icd-10",                          "name": "ICD-10",     "tier": "commercial"},
}

# =============================================================================
# OMOP (CONCEPT.csv) input mapping
# =============================================================================
# OMOP vocabulary_id → output file stem. Two OMOP sources (RxNorm and
# RxNorm Extension) share the same FHIR url and get merged.

OMOP_VOCAB_MAP: Dict[str, str] = {
    "RxNorm":           "rxnorm",
    "RxNorm Extension": "rxnorm",
    "ICD10CM":          "icd10cm",
    "LOINC":            "loinc",
    "CVX":              "cvx",
    "HCPCS":            "hcpcs",
    "UCUM":             "ucum",
    "ATC":              "atc",
    "SNOMED":           "snomed",
    "CPT4":             "cpt4",
    "ICD10":            "icd10",
}

# =============================================================================
# UMLS (MRCONSO.RRF) input mapping
# =============================================================================
# UMLS SAB (Source ABbreviation) → output file stem. Some SABs have multiple
# variants ("SNOMEDCT_US", "SNOMEDCT_VET" — we want only US). For each SAB we
# also declare the TTY (Term Type) values we keep, which picks the "preferred"
# atom per code and filters out synonyms.

UMLS_SAB_CONFIG: Dict[str, Dict] = {
    "RXNORM": {
        "stem": "rxnorm",
        # IN: ingredient, BN: brand name, SCD: semantic clinical drug,
        # SBD: semantic branded drug, SCDC: clinical drug comp., PIN: precise ingredient
        "keep_tty": {"IN", "BN", "SCD", "SBD", "SCDC", "PIN"},
    },
    "ICD10CM": {
        "stem": "icd10cm",
        "keep_tty": {"PT", "HT"},  # PT = preferred term, HT = hierarchical term
    },
    "LNC": {
        "stem": "loinc",
        "keep_tty": {"LN", "LC", "LPN"},  # LN/LC = long/long-common names, LPN = preferred
    },
    "CVX": {
        "stem": "cvx",
        "keep_tty": {"PT"},
    },
    "HCPCS": {
        "stem": "hcpcs",
        "keep_tty": {"PT", "OP"},
    },
    "ATC": {
        "stem": "atc",
        "keep_tty": {"PT", "IN"},
    },
    "SNOMEDCT_US": {
        "stem": "snomed",
        "keep_tty": {"PT"},  # Only preferred term per concept — one row per SCUI
    },
}

# MRCONSO.RRF column positions (0-indexed). Schema is fixed per UMLS spec.
# https://www.ncbi.nlm.nih.gov/books/NBK9685/
MRCONSO_COLUMNS = {
    "CUI":      0,
    "LAT":      1,   # language; we keep only "ENG"
    "TS":       2,   # term status; P = preferred
    "LUI":      3,
    "STT":      4,
    "SUI":      5,
    "ISPREF":   6,   # Y/N; we keep Y for single preferred per source code
    "AUI":      7,
    "SAUI":     8,
    "SCUI":     9,
    "SDUI":     10,
    "SAB":      11,  # source abbreviation; our per-vocab split
    "TTY":      12,  # term type
    "CODE":     13,  # source-level code (the code we emit)
    "STR":      14,  # display string
    "SRL":      15,
    "SUPPRESS": 16,  # Y/N; we skip Y (obsolete/non-preferred)
    "CVF":      17,
}


# =============================================================================
# Format detection
# =============================================================================

def detect_format(input_dir: Path) -> str:
    """Return 'umls', 'omop', or raise if neither is detectable."""
    has_rrf = any(input_dir.glob("MRCONSO*"))
    has_csv = any(input_dir.glob("CONCEPT.csv")) or any(input_dir.glob("concept.csv"))
    if has_rrf and not has_csv:
        return "umls"
    if has_csv and not has_rrf:
        return "omop"
    if has_rrf and has_csv:
        logger.info("Both MRCONSO.RRF and CONCEPT.csv present — defaulting to UMLS")
        return "umls"
    raise SystemExit(
        f"Could not auto-detect format in {input_dir}. "
        f"Expected CONCEPT.csv (OMOP) or MRCONSO.RRF (UMLS). "
        f"Pass --format to force."
    )


# =============================================================================
# Shared: active stem selection
# =============================================================================

def compute_active_stems(
    selected_stems: Optional[Set[str]],
    include_snomed: bool,
    include_commercial: bool,
) -> Set[str]:
    """Apply license-tier rules and --only filter to decide which stems to write."""
    active: Set[str] = set()
    for stem, info in OUTPUT_VOCABS.items():
        tier = info["tier"]
        if tier == "public":
            active.add(stem)
        elif tier == "restricted" and include_snomed:
            active.add(stem)
        elif tier == "commercial" and include_commercial:
            active.add(stem)

    if selected_stems:
        unknown = selected_stems - set(OUTPUT_VOCABS.keys())
        for u in unknown:
            logger.warning("Unknown vocabulary in --only: %s", u)
        active &= selected_stems

    return active


# =============================================================================
# OMOP (CSV) extraction
# =============================================================================

def _sniff_csv_delimiter(csv_path: Path) -> str:
    """Peek to pick tab vs comma. Defaults tab (OMOP's convention)."""
    try:
        with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
            sample = f.read(4096)
    except OSError:
        return "\t"
    header = sample.split("\n", 1)[0]
    return "\t" if header.count("\t") >= header.count(",") else ","


def _find_concept_csv(input_dir: Path) -> Path:
    for name in ("CONCEPT.csv", "concept.csv", "CONCEPT.bcp", "concept.bcp"):
        p = input_dir / name
        if p.is_file():
            return p
    raise FileNotFoundError(
        f"CONCEPT.csv (or .bcp) not found in {input_dir}. Expected OMOP Athena bundle."
    )


def _omop_row_to_concept(row: dict) -> Optional[dict]:
    if (row.get("invalid_reason") or "").strip():
        return None
    code = (row.get("concept_code") or "").strip()
    display = (row.get("concept_name") or "").strip()
    if not code or not display:
        return None
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


def extract_from_omop(
    input_dir: Path,
    active_stems: Set[str],
    standard_only: bool,
    max_per_vocab: Optional[int],
    delimiter: Optional[str],
) -> Dict[str, List[dict]]:
    concept_csv = _find_concept_csv(input_dir)
    if delimiter is None:
        delimiter = _sniff_csv_delimiter(concept_csv)
        logger.info("Detected delimiter: %r", delimiter)
    logger.info("OMOP input: %s", concept_csv)

    buckets: Dict[str, List[dict]] = defaultdict(list)
    rows_read = 0
    t0 = time.time()

    with open(concept_csv, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        required = {"concept_code", "concept_name", "vocabulary_id"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"CONCEPT.csv missing required columns: {sorted(missing)}")

        for row in reader:
            rows_read += 1
            if rows_read % 500_000 == 0:
                elapsed = time.time() - t0
                kept = sum(len(v) for v in buckets.values())
                logger.info("  Read %s rows in %.1fs (%d kept)",
                            f"{rows_read:,}", elapsed, kept)

            vocab = (row.get("vocabulary_id") or "").strip()
            stem = OMOP_VOCAB_MAP.get(vocab)
            if not stem or stem not in active_stems:
                continue
            if standard_only and (row.get("standard_concept") or "").strip() not in ("S", "C"):
                continue
            if max_per_vocab and len(buckets[stem]) >= max_per_vocab:
                continue
            concept = _omop_row_to_concept(row)
            if concept:
                buckets[stem].append(concept)

    logger.info("OMOP: read %s rows in %.1fs", f"{rows_read:,}", time.time() - t0)
    return dict(buckets)


# =============================================================================
# UMLS (RRF) extraction
# =============================================================================

def _find_mrconso(input_dir: Path) -> Path:
    for name in ("MRCONSO.RRF", "mrconso.rrf"):
        p = input_dir / name
        if p.is_file():
            return p
    raise FileNotFoundError(
        f"MRCONSO.RRF not found in {input_dir}. Expected UMLS Metathesaurus."
    )


def _read_mrsab_versions(input_dir: Path) -> Dict[str, str]:
    """If MRSAB.RRF is present, extract {SAB: version} mapping for metadata."""
    mrsab = input_dir / "MRSAB.RRF"
    if not mrsab.is_file():
        mrsab = input_dir / "mrsab.rrf"
        if not mrsab.is_file():
            return {}
    versions: Dict[str, str] = {}
    # MRSAB columns: VCUI|RCUI|VSAB|RSAB|SON|SF|SVER|VSTART|VEND|IMETA|RMETA|SLC|SCC|SRL|TFR|CFR|CXTY|TTYL|ATNL|LAT|CENC|CURVER|SABIN|SSN|SCIT|
    #                0    1    2    3    4   5  6    7      8    9     10    11  12  13  14  15  16   17   18   19  20   21     22    23  24
    # RSAB at index 3, SVER at index 6, CURVER at 21 (Y/N: this is the current version)
    try:
        with open(mrsab, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                parts = line.rstrip("\r\n").split("|")
                if len(parts) < 22:
                    continue
                if parts[21] != "Y":  # CURVER
                    continue
                rsab = parts[3]
                sver = parts[6]
                if rsab and sver:
                    versions[rsab] = sver
    except OSError:
        return {}
    return versions


def extract_from_umls(
    input_dir: Path,
    active_stems: Set[str],
    max_per_vocab: Optional[int],
) -> Tuple[Dict[str, List[dict]], Dict[str, str]]:
    """Returns (buckets, versions). versions maps output stem → source version string."""
    mrconso = _find_mrconso(input_dir)
    logger.info("UMLS input: %s (%.2f GB)", mrconso, mrconso.stat().st_size / 1e9)
    sab_versions = _read_mrsab_versions(input_dir)
    if sab_versions:
        logger.info("Read %d source versions from MRSAB.RRF", len(sab_versions))

    # Determine which SABs to read based on active_stems.
    wanted_sabs = {sab: cfg for sab, cfg in UMLS_SAB_CONFIG.items()
                   if cfg["stem"] in active_stems}
    if not wanted_sabs:
        return {}, {}

    logger.info("Active UMLS sources: %s", sorted(wanted_sabs.keys()))

    # dedup key: (SAB, CODE) → preferred concept dict
    # We may see multiple rows per code (synonyms). Keep the first one whose
    # TTY is in our keep-set, preferring rows with ISPREF=Y + TS=P + SUPPRESS=N.
    # Simplest: we've already filtered by TTY at the gate; dedup just by keeping first.
    seen: Dict[Tuple[str, str], bool] = {}
    buckets: Dict[str, List[dict]] = defaultdict(list)
    version_by_stem: Dict[str, str] = {}

    rows_read = 0
    rows_kept = 0
    t0 = time.time()

    # RRF is pipe-delimited, no headers, may have trailing empty column.
    with open(mrconso, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            rows_read += 1
            if rows_read % 1_000_000 == 0:
                elapsed = time.time() - t0
                logger.info("  Read %s rows in %.1fs (%d kept across %d SABs)",
                            f"{rows_read:,}", elapsed, rows_kept, len(buckets))

            parts = line.rstrip("\r\n").split("|")
            if len(parts) < 18:
                continue

            sab = parts[MRCONSO_COLUMNS["SAB"]]
            cfg = wanted_sabs.get(sab)
            if cfg is None:
                continue

            # Fast-path filters (cheapest first)
            if parts[MRCONSO_COLUMNS["LAT"]] != "ENG":
                continue
            if parts[MRCONSO_COLUMNS["SUPPRESS"]] == "Y":
                continue

            tty = parts[MRCONSO_COLUMNS["TTY"]]
            if tty not in cfg["keep_tty"]:
                continue

            code = parts[MRCONSO_COLUMNS["CODE"]].strip()
            display = parts[MRCONSO_COLUMNS["STR"]].strip()
            if not code or not display:
                continue

            dedup_key = (sab, code)
            if dedup_key in seen:
                continue
            seen[dedup_key] = True

            stem = cfg["stem"]
            if max_per_vocab and len(buckets[stem]) >= max_per_vocab:
                continue

            buckets[stem].append({
                "code": code,
                "display": display,
                "property": {"TTY": tty, "SAB": sab},
            })
            rows_kept += 1

            if stem not in version_by_stem and sab in sab_versions:
                version_by_stem[stem] = sab_versions[sab]

    logger.info("UMLS: read %s rows in %.1fs, kept %s",
                f"{rows_read:,}", time.time() - t0, f"{rows_kept:,}")
    return dict(buckets), version_by_stem


# =============================================================================
# Write output
# =============================================================================

def write_output(
    buckets: Dict[str, List[dict]],
    output_dir: Path,
    versions: Optional[Dict[str, str]] = None,
) -> Dict[str, int]:
    """Serialize each bucket to output_dir/terminology/<stem>.json. Returns {stem: count}."""
    term_dir = output_dir / "terminology"
    term_dir.mkdir(parents=True, exist_ok=True)

    summary: Dict[str, int] = {}
    for stem in sorted(buckets.keys()):
        concepts = buckets[stem]
        info = OUTPUT_VOCABS[stem]

        data: Dict = {
            "url": info["url"],
            "name": info["name"],
            "count": len(concepts),
            "concept": concepts,
        }
        if versions and stem in versions:
            data["version"] = versions[stem]

        out_path = term_dir / f"{stem}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        size_mb = out_path.stat().st_size / (1024 * 1024)
        version_note = f" v{versions[stem]}" if versions and stem in versions else ""
        logger.info("  wrote %s: %s concepts%s (%.1f MB)",
                    out_path.name, f"{len(concepts):,}", version_note, size_mb)
        summary[stem] = len(concepts)

    return summary


# =============================================================================
# CLI
# =============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract OMOP or UMLS terminology sources to FHIR-compatible JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("input_dir", type=Path,
                        help="Directory with CONCEPT.csv (OMOP) or MRCONSO.RRF (UMLS)")
    parser.add_argument("output_dir", type=Path,
                        help="Output directory (output_dir/terminology/*.json)")
    parser.add_argument("--format", choices=("auto", "omop", "umls"), default="auto",
                        help="Input format (default: auto-detect)")
    parser.add_argument("--only", nargs="+", metavar="STEM",
                        help="Restrict to these output stems (e.g. rxnorm loinc)")
    parser.add_argument("--include-snomed", action="store_true",
                        help="Include SNOMED CT (requires UMLS + SNOMED Affiliate license)")
    parser.add_argument("--unsafe-include-commercial", action="store_true",
                        dest="include_commercial",
                        help="Include CPT-4 and WHO ICD-10 (REQUIRES paid licenses)")
    parser.add_argument("--standard-only", action="store_true",
                        help="OMOP only: keep only standard concepts (standard_concept in {S, C})")
    parser.add_argument("--max-per-vocab", type=int, metavar="N",
                        help="Cap concepts per vocabulary (for testing)")
    parser.add_argument("--delimiter", default=None,
                        help="OMOP only: CSV delimiter override (default: auto)")
    parser.add_argument("-v", "--verbose", action="store_true")

    args = parser.parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )

    if not args.input_dir.is_dir():
        logger.error("Input directory does not exist: %s", args.input_dir)
        return 2

    fmt = args.format if args.format != "auto" else detect_format(args.input_dir)
    logger.info("Format: %s", fmt)

    selected = set(args.only) if args.only else None
    active_stems = compute_active_stems(
        selected_stems=selected,
        include_snomed=args.include_snomed,
        include_commercial=args.include_commercial,
    )
    if not active_stems:
        logger.error("No vocabularies selected. Check --only, --include-snomed, "
                     "and --unsafe-include-commercial flags.")
        return 2
    logger.info("Extracting: %s", ", ".join(sorted(active_stems)))

    try:
        if fmt == "omop":
            buckets = extract_from_omop(
                input_dir=args.input_dir,
                active_stems=active_stems,
                standard_only=args.standard_only,
                max_per_vocab=args.max_per_vocab,
                delimiter=args.delimiter,
            )
            versions = {}
        else:  # umls
            buckets, versions = extract_from_umls(
                input_dir=args.input_dir,
                active_stems=active_stems,
                max_per_vocab=args.max_per_vocab,
            )
    except Exception:
        logger.exception("Extraction failed")
        return 1

    if not buckets:
        logger.warning("No matching concepts found in %s", args.input_dir)
        return 1

    summary = write_output(buckets, args.output_dir, versions=versions)

    print()
    print("Summary:")
    total = 0
    for stem, count in sorted(summary.items()):
        v = versions.get(stem, "") if versions else ""
        v_col = f"  (v{v})" if v else ""
        print(f"  {stem:12s} {count:>12,} concepts{v_col}")
        total += count
    print(f"  {'TOTAL':12s} {total:>12,} concepts")
    print()
    print("Next step — load to HAPI:")
    print(f"  python3 scripts/load_terminology.py {args.output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
