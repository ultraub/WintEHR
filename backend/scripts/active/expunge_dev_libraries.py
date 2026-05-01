#!/usr/bin/env python3
"""Expunge orphan dev CQL Libraries from HAPI.

Two patterns of artifacts accumulate in HAPI as students iterate:

1. Draft uploads from `cql_dev_helper.upload_dev_library` —
   ``Draft<ServiceName><sha256[:12]>`` — every CQL edit creates a fresh
   identifier so HAPI's compiled-ELM cache stays cache-miss-fresh. Drafts
   abandoned within minutes pile up; this script reclaims them.

2. Smoke-test PlanDefinitions left over from POC scripts and integration
   tests (e.g. ``phase1-smoke``, ``phase6-deploy-test``, the early
   ``vsuidvsuid``/``csciduiusd`` debugging junk). Pass ``--include-test-pds``
   to clean these up too.

Stable deploy-time libraries (``{Pascal}V{n}``) are NOT touched — those
underpin live, deployed services. Cleanup of stale stable versions is a
separate process (out of scope for this script).

Usage:

    # Dry run (default): list what would be expunged
    python3 backend/scripts/active/expunge_dev_libraries.py

    # Actually expunge draft libraries last updated > 7 days ago
    python3 backend/scripts/active/expunge_dev_libraries.py --apply --older-than-days 7

    # Also clean up known smoke-test PlanDefinitions
    python3 backend/scripts/active/expunge_dev_libraries.py --apply --include-test-pds

    # Custom HAPI URL (defaults to HAPI_FHIR_URL env var or http://hapi-fhir:8080/fhir)
    python3 backend/scripts/active/expunge_dev_libraries.py --hapi-url http://localhost:8888/fhir

The script is safe to re-run; expunge is idempotent.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

import httpx

DEFAULT_PREFIX = "Draft"  # cql_dev_helper now uses Draft{Service}{hash}, not DevLibrary
DEFAULT_HAPI_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")

# PlanDefinitions known to be smoke-test debris from POC + integration runs.
# Conservative list — only PD ids that match these patterns get touched.
SMOKE_TEST_PD_IDS = {
    "phase1-smoke",
    "phase6-cache-test",
    "phase6-deploy-test",
    # Pre-existing junk from very early debugging
    "vsuidvsuid",
    "csciduiusd",
    # Library counterparts left over from POC iterations
}

# Library ids known to be smoke-test debris (besides the prefix-matched drafts)
SMOKE_TEST_LIBRARY_IDS = {
    "PatientGreeter",          # POC iteration v0.1.0 → 0.7.0 (cache-stuck early debugging)
    "PatientGreeterV2",        # POC, the version that ultimately worked end-to-end
    "patient-greeter-cql",     # Orphan Library left over from very early POC iterations
    "Phase6CacheTestV100",     # Phase 6 stable-deploy smoke test (both versions)
    "Phase6CacheTestV200",
    "Phase6DeployTest",        # First-pass deploy-mode smoke (pre-versioned-naming)
    "SmokeTest70e8f53b5974",   # Phase 0 dev-helper round-trip smoke test
}


def _iter_dev_libraries(client: httpx.Client, hapi_url: str, prefix: str) -> Iterable[dict]:
    """Yield Library resources whose name starts with the dev-helper prefix."""
    url = f"{hapi_url}/Library"
    params = {
        "name:contains": prefix,
        "_count": "200",
        "_sort": "_lastUpdated",
    }
    while url:
        response = client.get(url, params=params)
        response.raise_for_status()
        bundle = response.json()
        for entry in bundle.get("entry", []) or []:
            resource = entry.get("resource") or {}
            if resource.get("resourceType") == "Library" and (resource.get("name") or "").startswith(prefix):
                yield resource
        # Follow `next` link if HAPI paginates
        next_url = next((l.get("url") for l in bundle.get("link", []) if l.get("relation") == "next"), None)
        url = next_url
        params = None  # next URL already includes query


def _last_updated(resource: dict) -> Optional[datetime]:
    raw = (resource.get("meta") or {}).get("lastUpdated")
    if not raw:
        return None
    try:
        # FHIR uses ISO 8601 with timezone
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _expunge(client: httpx.Client, hapi_url: str, library_id: str) -> None:
    """POST $expunge with limit + expungePreviousVersions + expungeDeletedResources."""
    url = f"{hapi_url}/Library/{library_id}/$expunge"
    body = {
        "resourceType": "Parameters",
        "parameter": [
            {"name": "limit", "valueInteger": 100},
            {"name": "expungePreviousVersions", "valueBoolean": True},
            {"name": "expungeDeletedResources", "valueBoolean": True},
        ],
    }
    # Some HAPI deployments require a DELETE first to trigger full expunge.
    delete_response = client.delete(f"{hapi_url}/Library/{library_id}")
    if delete_response.status_code not in (200, 204, 404):
        delete_response.raise_for_status()
    response = client.post(url, json=body, headers={"Content-Type": "application/fhir+json"})
    response.raise_for_status()


def _expunge_resource(client: httpx.Client, hapi_url: str, resource_type: str, resource_id: str) -> None:
    """Generic DELETE+$expunge for any resource (Library or PlanDefinition)."""
    delete_response = client.delete(f"{hapi_url}/{resource_type}/{resource_id}")
    if delete_response.status_code not in (200, 204, 404):
        delete_response.raise_for_status()
    response = client.post(
        f"{hapi_url}/{resource_type}/{resource_id}/$expunge",
        json={
            "resourceType": "Parameters",
            "parameter": [
                {"name": "limit", "valueInteger": 100},
                {"name": "expungePreviousVersions", "valueBoolean": True},
                {"name": "expungeDeletedResources", "valueBoolean": True},
            ],
        },
        headers={"Content-Type": "application/fhir+json"},
    )
    response.raise_for_status()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hapi-url", default=DEFAULT_HAPI_URL, help="HAPI FHIR base URL")
    parser.add_argument("--prefix", default=DEFAULT_PREFIX, help="Library name prefix to target")
    parser.add_argument("--older-than-days", type=int, default=7, help="Skip libraries newer than this")
    parser.add_argument("--apply", action="store_true", help="Actually expunge (default: dry run)")
    parser.add_argument(
        "--include-test-pds",
        action="store_true",
        help="Also expunge smoke-test PlanDefinitions and named test libraries listed in this script",
    )
    args = parser.parse_args()

    cutoff = datetime.now(timezone.utc) - timedelta(days=args.older_than_days)
    print(f"Cutoff: libraries last updated before {cutoff.isoformat()} (UTC)")
    print(f"HAPI:   {args.hapi_url}")
    print(f"Prefix: {args.prefix}")
    print(f"Mode:   {'APPLY (will expunge)' if args.apply else 'DRY RUN (no changes)'}")
    if args.include_test_pds:
        print(f"Also:   smoke-test PDs ({len(SMOKE_TEST_PD_IDS)}) and named test libraries ({len(SMOKE_TEST_LIBRARY_IDS)})")
    print()

    expunged = 0
    skipped_recent = 0
    failed = 0

    with httpx.Client(timeout=60.0) as client:
        # 1. Prefix-matched draft libraries (always considered).
        for lib in _iter_dev_libraries(client, args.hapi_url, args.prefix):
            lib_id = lib.get("id")
            updated = _last_updated(lib)
            if updated and updated > cutoff:
                skipped_recent += 1
                continue
            ts = updated.isoformat() if updated else "(unknown timestamp)"
            print(f"  Library/{lib_id:40s}  last_updated={ts}", end="")
            if args.apply:
                try:
                    _expunge(client, args.hapi_url, lib_id)
                    print("  [EXPUNGED]")
                    expunged += 1
                except Exception as exc:
                    print(f"  [FAILED: {exc}]")
                    failed += 1
            else:
                print("  [would expunge]")
                expunged += 1

        # 2. Named smoke-test debris (only when --include-test-pds is set).
        if args.include_test_pds:
            print("\n--- Named smoke-test artifacts ---")
            for pd_id in sorted(SMOKE_TEST_PD_IDS):
                print(f"  PlanDefinition/{pd_id:40s}", end="")
                if args.apply:
                    try:
                        _expunge_resource(client, args.hapi_url, "PlanDefinition", pd_id)
                        print("  [EXPUNGED]")
                        expunged += 1
                    except Exception as exc:
                        print(f"  [FAILED: {exc}]")
                        failed += 1
                else:
                    print("  [would expunge]")
                    expunged += 1
            for lib_id in sorted(SMOKE_TEST_LIBRARY_IDS):
                print(f"  Library/{lib_id:40s}", end="")
                if args.apply:
                    try:
                        _expunge_resource(client, args.hapi_url, "Library", lib_id)
                        print("  [EXPUNGED]")
                        expunged += 1
                    except Exception as exc:
                        print(f"  [FAILED: {exc}]")
                        failed += 1
                else:
                    print("  [would expunge]")
                    expunged += 1

    print()
    print(f"Total {'expunged' if args.apply else 'eligible'}: {expunged}")
    print(f"Skipped (too recent): {skipped_recent}")
    if failed:
        print(f"Failed: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
