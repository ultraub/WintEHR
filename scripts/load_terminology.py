#!/usr/bin/env python3
"""
load_terminology.py - Load FHIR terminology resources into HAPI FHIR for WinTEHR

Reads extracted vocabulary JSON files (from extract_vocabularies.py) and loads:
  1. CodeSystem resources — per vocabulary, with concept properties for filtering
  2. ValueSet resources — per clinical domain, aligned with catalog endpoints
  3. ConceptMap resources — cross-vocabulary mappings

Usage:
    # Against Azure deployment (default)
    python3 scripts/load_terminology.py /path/to/fhir_vocabularies

    # Against local dev
    python3 scripts/load_terminology.py /path/to/fhir_vocabularies --hapi-url http://localhost:8888/fhir

    # Selective loading
    python3 scripts/load_terminology.py /path/to/fhir_vocabularies --only rxnorm loinc cvx
    python3 scripts/load_terminology.py /path/to/fhir_vocabularies --skip-codesystems

Requirements: Python 3.8+, httpx (pip install httpx)
"""

import json
import httpx
import argparse
import time
import sys
import math
from pathlib import Path
from collections import defaultdict

# ============================================================
# FHIR System URIs (must match extract_vocabularies.py)
# ============================================================

FHIR_SYSTEMS = {
    "snomed": "http://snomed.info/sct",
    "icd10cm": "http://hl7.org/fhir/sid/icd-10-cm",
    "icd9cm": "http://hl7.org/fhir/sid/icd-9-cm",
    "rxnorm": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "rxnorm_extension": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "loinc": "http://loinc.org",
    "cvx": "http://hl7.org/fhir/sid/cvx",
    "ucum": "http://unitsofmeasure.org",
    "atc": "http://www.whocc.no/atc",
    "hcpcs": "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets",
}

WINTEHR_BASE_URL = "https://wintehr.eastus2.cloudapp.azure.com/fhir"

# Max concepts per CodeSystem upload before splitting.
# HAPI's default 2GB heap can OOM indexing very large CodeSystems.
# 10K concepts per chunk keeps memory manageable.
CODESYSTEM_CHUNK_SIZE = 10_000

# Max mapping entries per ConceptMap upload.
# Smaller chunks prevent HAPI OOM during indexing.
CONCEPTMAP_CHUNK_SIZE = 5_000

# Seconds to pause between large uploads to let HAPI GC
INTER_CHUNK_DELAY = 2


# ============================================================
# HAPI FHIR Client Helpers
# ============================================================

def hapi_exists(client: httpx.Client, resource_type: str, resource_id: str) -> bool:
    """Check if a FHIR resource already exists."""
    url = f"/{resource_type}/{resource_id}"
    try:
        resp = client.get(url, timeout=10,
                          headers={"Accept": "application/fhir+json"},
                          params={"_elements": "id"})
        return resp.status_code == 200
    except Exception:
        return False


def hapi_put(client: httpx.Client, resource_type: str, resource_id: str,
             resource: dict, timeout: float = 300, skip_existing: bool = False) -> bool:
    """PUT a FHIR resource (create or update). Returns True on success."""
    if skip_existing and hapi_exists(client, resource_type, resource_id):
        print(f"    SKIP: {resource_type}/{resource_id} already exists")
        return True

    url = f"/{resource_type}/{resource_id}"
    try:
        resp = client.put(url, json=resource, timeout=timeout,
                          headers={"Content-Type": "application/fhir+json"})
        if resp.status_code in (200, 201):
            return True
        print(f"    WARNING: PUT {resource_type}/{resource_id} returned {resp.status_code}")
        print(f"    {resp.text[:500]}")
        return False
    except httpx.TimeoutException:
        print(f"    TIMEOUT: PUT {resource_type}/{resource_id} (try increasing --timeout)")
        return False
    except httpx.RequestError as e:
        print(f"    ERROR: {e}")
        return False


def verify_hapi(client: httpx.Client) -> bool:
    """Check that HAPI FHIR is reachable."""
    try:
        resp = client.get("/metadata", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            version = data.get("fhirVersion", "unknown")
            software = data.get("software", {}).get("name", "unknown")
            print(f"  Connected: {software}, FHIR {version}")
            return True
    except Exception as e:
        print(f"  ERROR: Cannot reach HAPI FHIR: {e}")
    return False


# ============================================================
# Phase 1: Load CodeSystem Resources
# ============================================================

def transform_concept_to_fhir(concept: dict) -> dict:
    """Transform extracted concept to proper FHIR CodeSystem.concept format."""
    fhir_concept = {
        "code": concept["code"],
        "display": concept["display"],
    }

    # Convert property dict to FHIR property array
    props = concept.get("property", {})
    if props:
        fhir_props = []
        for key, value in props.items():
            if value:
                fhir_props.append({"code": key, "valueString": str(value)})
        if fhir_props:
            fhir_concept["property"] = fhir_props

    return fhir_concept


def build_code_system(vocab_id: str, data: dict, concepts: list) -> dict:
    """Build a FHIR CodeSystem resource from extracted vocabulary data."""
    system_url = data.get("url", FHIR_SYSTEMS.get(vocab_id, f"urn:oid:{vocab_id}"))

    cs = {
        "resourceType": "CodeSystem",
        "id": f"wintehr-{vocab_id}",
        "url": system_url,
        "name": data.get("name", vocab_id),
        "title": f"WinTEHR {data.get('name', vocab_id)} Terminology",
        "status": "active",
        "content": "complete" if len(concepts) == data.get("count", 0) else "fragment",
        "count": len(concepts),
        # Declare filterable properties
        "property": [
            {
                "code": "domain",
                "description": "Clinical domain (Condition, Drug, Procedure, etc.)",
                "type": "string",
            },
            {
                "code": "conceptClass",
                "description": "Vocabulary-specific concept classification",
                "type": "string",
            },
            {
                "code": "standardConcept",
                "description": "OMOP standard concept flag (S=Standard, C=Classification)",
                "type": "string",
            },
        ],
        "concept": [transform_concept_to_fhir(c) for c in concepts],
    }

    return cs


def load_code_systems(client: httpx.Client, vocab_dir: Path, timeout: float,
                      only: set = None, base_url: str = WINTEHR_BASE_URL):
    """Load CodeSystem resources from terminology/ directory."""
    term_dir = vocab_dir / "terminology"
    if not term_dir.exists():
        print("  ERROR: terminology/ directory not found")
        return

    files = sorted(term_dir.glob("*.json"))

    # UCUM isn't distributed via UMLS or OMOP. Ship a curated ~60-unit subset
    # alongside the load script and always include it. The extractors do not
    # produce ucum.json; if a user has somehow written one into term_dir
    # it wins (their list, their rules).
    bundled_ucum = Path(__file__).resolve().parent / "ucum.json"
    if bundled_ucum.is_file() and not (term_dir / "ucum.json").exists():
        files = list(files) + [bundled_ucum]
        print(f"  (including bundled UCUM from {bundled_ucum.name})")

    print(f"\n  Found {len(files)} vocabulary files")

    for filepath in files:
        vocab_id = filepath.stem  # e.g., "rxnorm", "snomed", "icd10cm"
        # FHIR IDs cannot contain underscores
        fhir_vocab_id = vocab_id.replace("_", "-")

        if only and vocab_id not in only:
            print(f"  Skipping {vocab_id} (not in --only list)")
            continue

        print(f"\n  Loading {vocab_id}...")
        t0 = time.time()

        with open(filepath) as f:
            data = json.load(f)

        concepts = data.get("concept", [])
        total = len(concepts)
        print(f"    {total:,} concepts")

        if total <= CODESYSTEM_CHUNK_SIZE:
            # Single upload
            cs = build_code_system(fhir_vocab_id, data, concepts)
            ok = hapi_put(client, "CodeSystem", f"wintehr-{fhir_vocab_id}", cs, timeout)
            status = "OK" if ok else "FAILED"
        else:
            # Split into supplement chunks
            # First: upload the base CodeSystem with first chunk
            n_chunks = math.ceil(total / CODESYSTEM_CHUNK_SIZE)
            print(f"    Splitting into {n_chunks} chunks of {CODESYSTEM_CHUNK_SIZE:,}")

            all_ok = True
            for i in range(n_chunks):
                start = i * CODESYSTEM_CHUNK_SIZE
                end = min(start + CODESYSTEM_CHUNK_SIZE, total)
                chunk = concepts[start:end]
                chunk_id = f"wintehr-{fhir_vocab_id}" if i == 0 else f"wintehr-{fhir_vocab_id}-part{i+1}"

                if i == 0:
                    # Base CodeSystem with first chunk
                    cs = build_code_system(fhir_vocab_id, data, chunk)
                    cs["count"] = total  # Report total count
                    cs["content"] = "fragment"
                else:
                    # CodeSystem supplement for additional chunks
                    system_url = data.get("url", FHIR_SYSTEMS.get(vocab_id))
                    cs = {
                        "resourceType": "CodeSystem",
                        "id": chunk_id,
                        "url": f"{base_url}/CodeSystem/{chunk_id}",
                        "name": f"{data.get('name', vocab_id)} Part {i+1}",
                        "status": "active",
                        "content": "supplement",
                        "supplements": system_url,
                        "count": len(chunk),
                        "property": [
                            {"code": "domain", "type": "string"},
                            {"code": "conceptClass", "type": "string"},
                            {"code": "standardConcept", "type": "string"},
                        ],
                        "concept": [transform_concept_to_fhir(c) for c in chunk],
                    }

                ok = hapi_put(client, "CodeSystem", chunk_id, cs, timeout)
                print(f"    Chunk {i+1}/{n_chunks} ({len(chunk):,} concepts): {'OK' if ok else 'FAILED'}")
                if not ok:
                    all_ok = False
                if i < n_chunks - 1:
                    time.sleep(INTER_CHUNK_DELAY)

            status = "OK" if all_ok else "PARTIAL"

        elapsed = time.time() - t0
        print(f"    {status} ({elapsed:.1f}s)")


# ============================================================
# Phase 2: Load ValueSet Resources (aligned with catalog domains)
# ============================================================

# NB: Filter design evolved with the move to UMLS as the primary input.
# OMOP/Athena provided domain/conceptClass/standardConcept properties; UMLS
# does not. Filters below use properties that either mode can emit:
#   - Medication ingredient split uses UMLS TTY=IN (OMOP mode won't match;
#     OMOP users who need this distinction should keep the Athena path)
#   - SNOMED Condition/Procedure domain split is DROPPED — UMLS has no
#     equivalent property. Both ValueSets return all SNOMED concepts;
#     autocomplete search still works, just across the full set.
VALUESETS = [
    {
        "id": "wintehr-medications",
        "name": "WinTEHR Medications",
        "title": "WinTEHR Medication Catalog",
        "description": "All medications for order entry — searchable via $expand",
        "compose": {
            "include": [
                {"system": "http://www.nlm.nih.gov/research/umls/rxnorm"},
            ]
        },
    },
    {
        "id": "wintehr-medication-ingredients",
        "name": "WinTEHR Medication Ingredients",
        "title": "WinTEHR Medication Ingredients (for allergies)",
        "description": "RxNorm ingredients for allergy substance selection",
        "compose": {
            "include": [
                {
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    # UMLS TTY=IN (Ingredient). For OMOP input, the equivalent
                    # conceptClass=Ingredient isn't emitted as a TTY property,
                    # so this filter returns empty for OMOP-only deploys.
                    "filter": [
                        {"property": "TTY", "op": "=", "value": "IN"}
                    ],
                },
            ]
        },
    },
    {
        "id": "wintehr-conditions-snomed",
        "name": "WinTEHR Conditions (SNOMED)",
        "title": "WinTEHR SNOMED CT Conditions",
        # Previously filtered by OMOP domain=Condition. UMLS has no such
        # property, so this ValueSet now returns all SNOMED CT concepts
        # (findings, procedures, anatomy, situations — everything). Users
        # relying on autocomplete search for specific conditions still get
        # good matches; browsing without a search shows a mixed list.
        "description": "SNOMED CT concepts for problem list entry (full terminology)",
        "compose": {
            "include": [
                {"system": "http://snomed.info/sct"},
            ]
        },
    },
    {
        "id": "wintehr-conditions-icd10",
        "name": "WinTEHR Conditions (ICD-10-CM)",
        "title": "WinTEHR ICD-10-CM Diagnosis Codes",
        "description": "ICD-10-CM codes for diagnosis coding",
        "compose": {
            "include": [
                {"system": "http://hl7.org/fhir/sid/icd-10-cm"},
            ]
        },
    },
    {
        "id": "wintehr-lab-tests",
        "name": "WinTEHR Lab Tests",
        "title": "WinTEHR Laboratory Test Catalog",
        "description": "LOINC codes for lab test ordering",
        "compose": {
            "include": [
                {"system": "http://loinc.org"},
            ]
        },
    },
    {
        "id": "wintehr-procedures-snomed",
        "name": "WinTEHR Procedures (SNOMED)",
        "title": "WinTEHR SNOMED CT Procedures",
        # Previously filtered by OMOP domain=Procedure. Same caveat as
        # wintehr-conditions-snomed — returns all SNOMED CT.
        "description": "SNOMED CT concepts for procedure entry (full terminology)",
        "compose": {
            "include": [
                {"system": "http://snomed.info/sct"},
            ]
        },
    },
    {
        "id": "wintehr-procedures-hcpcs",
        "name": "WinTEHR Procedures (HCPCS)",
        "title": "WinTEHR HCPCS Procedure Codes",
        "description": "HCPCS codes for procedure coding",
        "compose": {
            "include": [
                {"system": "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets"},
            ]
        },
    },
    {
        "id": "wintehr-vaccines",
        "name": "WinTEHR Vaccines",
        "title": "WinTEHR Vaccine Catalog",
        "description": "CVX vaccine codes for immunization entry",
        "compose": {
            "include": [
                {"system": "http://hl7.org/fhir/sid/cvx"},
            ]
        },
    },
    {
        "id": "wintehr-units",
        "name": "WinTEHR Units",
        "title": "WinTEHR Units of Measure",
        "description": "UCUM units for observations and dosing",
        "compose": {
            "include": [
                {"system": "http://unitsofmeasure.org"},
            ]
        },
    },
    {
        "id": "wintehr-drug-classes",
        "name": "WinTEHR Drug Classes",
        "title": "WinTEHR ATC Drug Classification",
        "description": "WHO ATC classification for drug grouping",
        "compose": {
            "include": [
                {"system": "http://www.whocc.no/atc"},
            ]
        },
    },
]


def load_value_sets(client: httpx.Client, timeout: float,
                    base_url: str = WINTEHR_BASE_URL):
    """Load ValueSet resources for catalog domain search."""
    print(f"\n  Loading {len(VALUESETS)} ValueSets...")

    for vs_def in VALUESETS:
        vs = {
            "resourceType": "ValueSet",
            "id": vs_def["id"],
            "url": f"{base_url}/ValueSet/{vs_def['id']}",
            "name": vs_def["name"],
            "title": vs_def.get("title", vs_def["name"]),
            "status": "active",
            "description": vs_def.get("description", ""),
            "compose": vs_def["compose"],
        }

        ok = hapi_put(client, "ValueSet", vs_def["id"], vs, timeout)
        status = "OK" if ok else "FAILED"
        print(f"    {vs_def['id']}: {status}")


# ============================================================
# Phase 3: Load ConceptMap Resources
# ============================================================

def load_concept_maps(client: httpx.Client, vocab_dir: Path, timeout: float,
                      only: set = None, base_url: str = WINTEHR_BASE_URL):
    """Load ConceptMap resources from mappings/ directory."""
    map_dir = vocab_dir / "mappings"
    if not map_dir.exists():
        print("  ERROR: mappings/ directory not found")
        return

    files = sorted(map_dir.glob("*.json"))
    print(f"\n  Found {len(files)} mapping files")

    for filepath in files:
        map_id = filepath.stem  # e.g., "icd10cm_to_snomed"
        # FHIR IDs cannot contain underscores — use hyphens
        fhir_id = map_id.replace("_", "-")

        with open(filepath) as f:
            data = json.load(f)

        elements = data.get("group", [{}])[0].get("element", [])
        total = len(elements)

        if total == 0:
            continue

        # Filter by vocabulary if --only specified
        if only:
            source_vocab = map_id.split("_to_")[0] if "_to_" in map_id else ""
            target_vocab = map_id.split("_to_")[1] if "_to_" in map_id else ""
            if source_vocab not in only and target_vocab not in only:
                continue

        print(f"\n  Loading {map_id} ({total:,} mappings)...")
        t0 = time.time()

        if total <= CONCEPTMAP_CHUNK_SIZE:
            # Single upload
            cm = build_concept_map(fhir_id, data, elements, base_url)
            ok = hapi_put(client, "ConceptMap", f"wintehr-{fhir_id}", cm, timeout,
                          skip_existing=True)
            status = "OK" if ok else "FAILED"
        else:
            # Split into chunks
            n_chunks = math.ceil(total / CONCEPTMAP_CHUNK_SIZE)
            print(f"    Splitting into {n_chunks} chunks")
            all_ok = True

            for i in range(n_chunks):
                start = i * CONCEPTMAP_CHUNK_SIZE
                end = min(start + CONCEPTMAP_CHUNK_SIZE, total)
                chunk = elements[start:end]
                chunk_id = f"wintehr-{fhir_id}-part{i+1}"

                cm = build_concept_map(fhir_id, data, chunk, base_url)
                cm["id"] = chunk_id
                cm["url"] = f"{base_url}/ConceptMap/{chunk_id}"
                cm["name"] = f"{data.get('name', map_id)} (Part {i+1})"

                ok = hapi_put(client, "ConceptMap", chunk_id, cm, timeout,
                              skip_existing=True)
                print(f"    Chunk {i+1}/{n_chunks} ({len(chunk):,} mappings): {'OK' if ok else 'FAILED'}")
                if not ok:
                    all_ok = False
                if i < n_chunks - 1:
                    time.sleep(INTER_CHUNK_DELAY)

            status = "OK" if all_ok else "PARTIAL"

        elapsed = time.time() - t0
        print(f"    {status} ({elapsed:.1f}s)")


def build_concept_map(map_id: str, data: dict, elements: list,
                      base_url: str = WINTEHR_BASE_URL) -> dict:
    """Build a FHIR ConceptMap from extracted mapping data."""
    source_system = data.get("sourceUri", "")
    target_system = data.get("targetUri", "")

    safe_id = map_id.replace("_", "-")
    cm = {
        "resourceType": "ConceptMap",
        "id": f"wintehr-{safe_id}",
        "url": f"{base_url}/ConceptMap/{safe_id}",
        "name": data.get("name", map_id),
        "title": f"WinTEHR {data.get('name', map_id)}",
        "status": "active",
        "sourceUri": source_system,
        "targetUri": target_system,
        "group": [
            {
                "source": source_system,
                "target": target_system,
                "element": elements,
            }
        ],
    }

    return cm


# ============================================================
# Main
# ============================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description="Load FHIR terminology into HAPI FHIR for WinTEHR"
    )
    parser.add_argument(
        "vocab_dir",
        type=Path,
        help="Path to fhir_vocabularies/ directory (from extract_vocabularies.py)",
    )
    parser.add_argument(
        "--hapi-url",
        default="https://wintehr.eastus2.cloudapp.azure.com/fhir",
        help="HAPI FHIR base URL (default: Azure deployment)",
    )
    parser.add_argument(
        "--base-url",
        default=WINTEHR_BASE_URL,
        help="Canonical base URL for ValueSet/ConceptMap URIs",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=300,
        help="HTTP timeout in seconds for large uploads (default: 300)",
    )
    parser.add_argument(
        "--skip-codesystems",
        action="store_true",
        help="Skip CodeSystem loading (load only ValueSets and ConceptMaps)",
    )
    parser.add_argument(
        "--skip-valuesets",
        action="store_true",
        help="Skip ValueSet loading",
    )
    parser.add_argument(
        "--skip-conceptmaps",
        action="store_true",
        help="Skip ConceptMap loading",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        help="Only load specific vocabularies (e.g., --only rxnorm loinc cvx)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    only = set(args.only) if args.only else None

    base_url = args.base_url

    print("=" * 60)
    print("WinTEHR Terminology Loader")
    print(f"  Source:    {args.vocab_dir}")
    print(f"  HAPI URL:  {args.hapi_url}")
    print(f"  Base URL:  {base_url}")
    print(f"  Timeout:   {args.timeout}s")
    if only:
        print(f"  Only:      {', '.join(only)}")
    print("=" * 60)

    # Verify source directory
    if not args.vocab_dir.exists():
        print(f"ERROR: Directory not found: {args.vocab_dir}")
        sys.exit(1)

    # Connect to HAPI FHIR
    print("\n[Connecting to HAPI FHIR]")
    client = httpx.Client(base_url=args.hapi_url)
    if not verify_hapi(client):
        print("Cannot proceed without HAPI FHIR connection.")
        sys.exit(1)

    t_start = time.time()

    # Phase 1: CodeSystems
    if not args.skip_codesystems:
        print("\n[Phase 1] Loading CodeSystem resources...")
        load_code_systems(client, args.vocab_dir, args.timeout, only, base_url)
    else:
        print("\n[Phase 1] Skipping CodeSystems")

    # Phase 2: ValueSets
    if not args.skip_valuesets:
        print("\n[Phase 2] Loading ValueSet resources...")
        load_value_sets(client, args.timeout, base_url)
    else:
        print("\n[Phase 2] Skipping ValueSets")

    # Phase 3: ConceptMaps
    if not args.skip_conceptmaps:
        print("\n[Phase 3] Loading ConceptMap resources...")
        load_concept_maps(client, args.vocab_dir, args.timeout, only, base_url)
    else:
        print("\n[Phase 3] Skipping ConceptMaps")

    total_time = time.time() - t_start
    print(f"\n{'=' * 60}")
    print(f"Terminology loading complete in {total_time:.1f}s")
    print(f"{'=' * 60}")

    client.close()


if __name__ == "__main__":
    main()
