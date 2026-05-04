#!/usr/bin/env python3
"""Retire HAPI artifacts for soft-deleted CQL visual services.

Background
==========

Before the fix in PR #97, the visual-builder DELETE handler set the local
``cds_visual_builder.visual_services`` row to ``ARCHIVED`` (with
``deleted_at`` populated) but never touched the corresponding HAPI
``PlanDefinition`` / ``Library``. Their FHIR ``status`` stayed ``active``,
so the CDS Hooks discovery query (``PlanDefinition?status=active``) kept
returning them and the runtime kept firing them.

PR #97 fixes the forward path. This script reconciles the past: walk
``cds_visual_builder.service_configs`` for any row with ``deleted_at IS NOT NULL``,
look up the HAPI artifacts referenced by ``plan_definition_canonical_url`` /
``library_canonical_url``, and PUT them back with ``status = retired`` if they
aren't already.

Idempotent — safe to re-run; rows whose HAPI status is already retired are
skipped.

Usage
=====

    # Dry run (default): list what would be retired
    python3 backend/scripts/active/retire_deleted_cql_artifacts.py

    # Actually retire
    python3 backend/scripts/active/retire_deleted_cql_artifacts.py --apply

    # Custom HAPI / DB
    python3 backend/scripts/active/retire_deleted_cql_artifacts.py \\
        --hapi-url http://localhost:8888/fhir \\
        --database-url postgresql://emr_user:emr_password@localhost:5432/emr_db
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import List, Optional, Tuple

import asyncpg
import httpx

DEFAULT_HAPI_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")
# DATABASE_URL in the runtime is the asyncpg+SQLAlchemy form; strip the
# ``+asyncpg`` driver tag so plain asyncpg can use it. The script accepts
# either form via --database-url.
DEFAULT_DATABASE_URL = (
    os.getenv("DATABASE_URL", "postgresql://emr_user:emr_password@postgres:5432/emr_db")
    .replace("postgresql+asyncpg://", "postgresql://")
)


async def _fetch_deleted_services(
    conn: asyncpg.Connection,
) -> List[Tuple[str, Optional[str], Optional[str]]]:
    rows = await conn.fetch(
        """
        SELECT service_id,
               plan_definition_canonical_url,
               library_canonical_url
        FROM cds_visual_builder.service_configs
        WHERE deleted_at IS NOT NULL
        ORDER BY service_id
        """
    )
    return [(r["service_id"], r["plan_definition_canonical_url"], r["library_canonical_url"]) for r in rows]


def _resource_id_from_url(canonical_url: str) -> str:
    return canonical_url.rsplit("/", 1)[-1]


async def _retire(
    client: httpx.AsyncClient,
    hapi_url: str,
    resource_type: str,
    canonical_url: str,
    apply: bool,
) -> str:
    """Retire one HAPI resource. Returns one of: 'retired', 'already', 'missing', 'failed'."""
    resource_id = _resource_id_from_url(canonical_url)
    try:
        get_resp = await client.get(f"{hapi_url}/{resource_type}/{resource_id}")
    except Exception as exc:
        return f"failed (read: {exc})"

    if get_resp.status_code == 404:
        return "missing"
    if get_resp.status_code != 200:
        return f"failed (read HTTP {get_resp.status_code})"

    resource = get_resp.json()
    if resource.get("status") == "retired":
        return "already"

    if not apply:
        return "would-retire"

    resource["status"] = "retired"
    try:
        put_resp = await client.put(
            f"{hapi_url}/{resource_type}/{resource_id}",
            json=resource,
            headers={"Content-Type": "application/fhir+json"},
        )
    except Exception as exc:
        return f"failed (put: {exc})"

    if put_resp.status_code in (200, 201):
        return "retired"
    return f"failed (put HTTP {put_resp.status_code})"


async def main_async(args: argparse.Namespace) -> int:
    print(f"HAPI:     {args.hapi_url}")
    print(f"Database: {args.database_url.split('@', 1)[-1]}")  # don't print credentials
    print(f"Mode:     {'APPLY (will retire)' if args.apply else 'DRY RUN (no changes)'}")
    print()

    conn = await asyncpg.connect(args.database_url)
    try:
        rows = await _fetch_deleted_services(conn)
    finally:
        await conn.close()

    if not rows:
        print("No soft-deleted services found.")
        return 0

    print(f"Found {len(rows)} soft-deleted service(s):")
    print()

    counts = {"retired": 0, "already": 0, "missing": 0, "would-retire": 0, "failed": 0}
    async with httpx.AsyncClient(timeout=60.0) as client:
        for service_id, plan_def_url, library_url in rows:
            print(f"  service_id={service_id}")
            for resource_type, canonical_url in (
                ("PlanDefinition", plan_def_url),
                ("Library", library_url),
            ):
                if not canonical_url:
                    print(f"    {resource_type:14s}  (no canonical URL on file — skip)")
                    continue
                outcome = await _retire(client, args.hapi_url, resource_type, canonical_url, args.apply)
                print(f"    {resource_type:14s}  {_resource_id_from_url(canonical_url):60s}  [{outcome}]")
                bucket = outcome if outcome in counts else "failed"
                counts[bucket] += 1

    print()
    print("Summary:")
    for k, v in counts.items():
        if v:
            print(f"  {k:14s}  {v}")
    return 1 if counts["failed"] else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hapi-url", default=DEFAULT_HAPI_URL, help="HAPI FHIR base URL")
    parser.add_argument(
        "--database-url",
        default=DEFAULT_DATABASE_URL,
        help="Postgres URL (asyncpg form; drop ``+asyncpg`` driver suffix)",
    )
    parser.add_argument("--apply", action="store_true", help="Actually retire (default: dry run)")
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
