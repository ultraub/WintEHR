"""Default status probes for the Command Center.

Each probe is an `async def` taking no arguments and returning one
ComponentStatus. The service runs them concurrently under a timeout and
turns any exception into a `down` component, so a probe only has to
describe the happy path and the "deliberately absent" case.

Probes are plain functions so tests inject fakes through
CommandCenterService(probes={...}) — no patch() needed.
"""

from __future__ import annotations

import asyncio
import os
import sqlite3
from pathlib import Path
from typing import Awaitable, Callable, Dict

import httpx
from sqlalchemy import text

from services.hapi_fhir_client import HAPIFHIRClient
from services.terminology_service import DEFAULT_TERMINOLOGY_DB_PATH

from .models import ComponentStatus

Probe = Callable[[], Awaitable[ComponentStatus]]

PROBE_HTTP_TIMEOUT = 5.0


async def probe_fhir(hapi: HAPIFHIRClient) -> ComponentStatus:
    """HAPI FHIR: capability statement plus the patient count."""
    async with httpx.AsyncClient(timeout=PROBE_HTTP_TIMEOUT) as client:
        resp = await client.get(f"{hapi.base_url}/metadata", params={"_summary": "true"})
        resp.raise_for_status()
        capability = resp.json()
    bundle = await hapi.search("Patient", {"_summary": "count"})
    software = capability.get("software") or {}
    return ComponentStatus(
        name="fhir",
        status="ok",
        detail=f"{software.get('name', 'FHIR server')} {software.get('version', '')}".strip(),
        data={
            "url": hapi.base_url,
            "fhir_version": capability.get("fhirVersion"),
            "software": software.get("name"),
            "software_version": software.get("version"),
            "patient_count": bundle.get("total"),
        },
    )


async def probe_database() -> ComponentStatus:
    """PostgreSQL: resource counts by type from HAPI's hfj_resource table."""
    from database import async_session_maker  # local import: tests run without a DB

    async with async_session_maker() as session:
        result = await session.execute(
            text(
                "SELECT res_type, COUNT(*) AS n FROM hfj_resource "
                "WHERE res_deleted_at IS NULL GROUP BY res_type ORDER BY n DESC"
            )
        )
        rows = result.all()
    counts = {res_type: int(n) for res_type, n in rows}
    return ComponentStatus(
        name="database",
        status="ok",
        detail=f"{sum(counts.values())} FHIR resources across {len(counts)} types",
        data={"resource_counts": counts, "total_resources": sum(counts.values())},
    )


async def probe_redis() -> ComponentStatus:
    url = os.getenv("REDIS_URL")
    if not url:
        return ComponentStatus(name="redis", status="absent", detail="REDIS_URL not set")
    import redis.asyncio as aioredis  # local import: optional dependency path

    client = aioredis.from_url(url, socket_connect_timeout=PROBE_HTTP_TIMEOUT)
    try:
        await client.ping()
    finally:
        await client.aclose()
    return ComponentStatus(name="redis", status="ok", detail="ping ok")


def _count_terminology(db_path: str) -> Dict[str, int]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT system, COUNT(*) FROM concepts GROUP BY system ORDER BY 2 DESC"
        ).fetchall()
    finally:
        conn.close()
    return {system: int(n) for system, n in rows}


async def probe_terminology() -> ComponentStatus:
    """The local SQLite terminology index the catalog autocomplete reads.

    Missing index is `degraded`, not `absent`: the UI silently falls back
    to small static lists, which is exactly the "where are my labs"
    support case the index exists to prevent.
    """
    db_path = os.getenv("TERMINOLOGY_DB_PATH", DEFAULT_TERMINOLOGY_DB_PATH)
    if not Path(db_path).exists():
        return ComponentStatus(
            name="terminology",
            status="degraded",
            detail=(
                "Terminology index not built; catalog search falls back to static "
                "lists. Run build_terminology_index.py and restart the backend "
                "(docs/TERMINOLOGY_SETUP.md, step 5)."
            ),
            data={"path": db_path, "present": False},
        )
    counts = await asyncio.to_thread(_count_terminology, db_path)
    total = sum(counts.values())
    return ComponentStatus(
        name="terminology",
        status="ok" if total else "degraded",
        detail=f"{total} concepts indexed" if total else "Index present but empty",
        data={"path": db_path, "present": True, "concepts_by_system": counts, "total": total},
    )


async def probe_vna() -> ComponentStatus:
    """dcm4chee VNA via QIDO-RS. Not configured means absent, not down."""
    qido = os.getenv("DICOM_QIDO_URL")
    if not qido:
        return ComponentStatus(
            name="vna",
            status="absent",
            detail="DICOM_QIDO_URL not set (dicom profile not enabled)",
        )
    url = qido.rstrip("/") + "/studies"
    async with httpx.AsyncClient(timeout=PROBE_HTTP_TIMEOUT) as client:
        resp = await client.get(url, params={"limit": 1}, headers={"Accept": "application/dicom+json"})
    if resp.status_code not in (200, 204):
        return ComponentStatus(
            name="vna",
            status="down",
            detail=f"QIDO-RS returned HTTP {resp.status_code}",
            data={"url": qido},
        )
    return ComponentStatus(name="vna", status="ok", detail="QIDO-RS reachable", data={"url": qido})


def default_probes(hapi: HAPIFHIRClient) -> Dict[str, Probe]:
    async def fhir() -> ComponentStatus:
        return await probe_fhir(hapi)

    return {
        "fhir": fhir,
        "database": probe_database,
        "redis": probe_redis,
        "terminology": probe_terminology,
        "vna": probe_vna,
    }
