#!/usr/bin/env python3
"""Expunge orphan visual-builder PlanDefinitions from HAPI.

Before the deploy path was switched to upsert against a stable id
(``vb-{service_id}``), each `Deploy` of a visual-builder service in the
CDS Studio created a brand-new PlanDefinition in HAPI. Discovery returns
all of them, so the same service shows up Nx in ``/api/cds-services`` and
Nx as a card on the patient chart.

This script reclaims those orphans:

1. Query HAPI for every PlanDefinition with the ``service-origin``
   extension set to ``visual-builder``.
2. Group by the ``hook-service-id`` extension.
3. For any group with more than one entry, keep the most recently
   updated PlanDefinition and expunge the rest.

The discovery endpoint already dedupes by hook-service-id at read time,
so the cards stay correct without this script — but running it removes
the wasted storage and stops the warning log.

Usage:

    # Dry run (default): list what would be expunged
    python3 backend/scripts/active/expunge_orphan_visual_plan_definitions.py

    # Actually expunge
    python3 backend/scripts/active/expunge_orphan_visual_plan_definitions.py --apply

    # Custom HAPI URL (defaults to HAPI_FHIR_URL env var or http://hapi-fhir:8080/fhir)
    python3 backend/scripts/active/expunge_orphan_visual_plan_definitions.py \\
        --hapi-url http://localhost:8888/fhir

The script is safe to re-run; expunge is idempotent.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from typing import Dict, Iterable, List, Optional

import httpx

DEFAULT_HAPI_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")
SERVICE_ORIGIN_URL = "http://wintehr.local/fhir/StructureDefinition/service-origin"
HOOK_SERVICE_ID_URL = "http://wintehr.local/fhir/StructureDefinition/hook-service-id"


def _extension_value(resource: dict, url: str) -> Optional[str]:
    for ext in resource.get("extension", []) or []:
        if ext.get("url") == url:
            return ext.get("valueString") or ext.get("valueCode")
    return None


def _iter_visual_plan_definitions(client: httpx.Client, hapi_url: str) -> Iterable[dict]:
    """Yield every PlanDefinition that originated from the visual builder."""
    url = f"{hapi_url}/PlanDefinition"
    params = {"_count": "200", "_sort": "_lastUpdated"}
    while url:
        response = client.get(url, params=params)
        response.raise_for_status()
        bundle = response.json()
        for entry in bundle.get("entry", []) or []:
            resource = entry.get("resource") or {}
            if resource.get("resourceType") != "PlanDefinition":
                continue
            if _extension_value(resource, SERVICE_ORIGIN_URL) != "visual-builder":
                continue
            yield resource
        next_url = next(
            (link.get("url") for link in bundle.get("link", []) if link.get("relation") == "next"),
            None,
        )
        url = next_url
        params = None


def _expunge(client: httpx.Client, hapi_url: str, plan_def_id: str) -> None:
    """DELETE then $expunge to fully reclaim the resource."""
    delete_response = client.delete(f"{hapi_url}/PlanDefinition/{plan_def_id}")
    if delete_response.status_code not in (200, 204, 404):
        delete_response.raise_for_status()
    response = client.post(
        f"{hapi_url}/PlanDefinition/{plan_def_id}/$expunge",
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
    parser.add_argument("--apply", action="store_true", help="Actually expunge (default: dry run)")
    args = parser.parse_args()

    print(f"HAPI: {args.hapi_url}")
    print(f"Mode: {'APPLY (will expunge)' if args.apply else 'DRY RUN (no changes)'}")
    print()

    groups: Dict[str, List[dict]] = defaultdict(list)
    with httpx.Client(timeout=60.0) as client:
        for plan_def in _iter_visual_plan_definitions(client, args.hapi_url):
            service_id = _extension_value(plan_def, HOOK_SERVICE_ID_URL) or plan_def.get("id")
            if not service_id:
                continue
            groups[service_id].append(plan_def)

        expunged = 0
        failed = 0
        for service_id, plan_defs in sorted(groups.items()):
            if len(plan_defs) <= 1:
                continue
            # Keep the most recently updated; expunge the rest.
            plan_defs.sort(
                key=lambda r: (r.get("meta") or {}).get("lastUpdated") or "",
                reverse=True,
            )
            keeper = plan_defs[0]
            orphans = plan_defs[1:]
            print(f"service_id={service_id}  total={len(plan_defs)}  keeping={keeper.get('id')}")
            for orphan in orphans:
                orphan_id = orphan.get("id")
                last_updated = (orphan.get("meta") or {}).get("lastUpdated") or "(unknown)"
                print(f"  PlanDefinition/{orphan_id:32s}  last_updated={last_updated}", end="")
                if args.apply:
                    try:
                        _expunge(client, args.hapi_url, orphan_id)
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
    if failed:
        print(f"Failed: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
