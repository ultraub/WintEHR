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
from typing import Awaitable, Callable, Dict, Optional

import httpx
from sqlalchemy import text

from services.hapi_fhir_client import HAPIFHIRClient
from services.terminology_service import DEFAULT_TERMINOLOGY_DB_PATH

from .control_plane import ControlPlaneClient, default_control_plane
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


GB = 1024 ** 3
DISK_DEGRADED_BELOW_PERCENT = 10
CERT_WARN_DAYS = 14


async def _sidecar(cp: ControlPlaneClient, path: str):
    """Sidecar GET as a probe sees it: HTTPException → the component is down with the reason."""
    from fastapi import HTTPException

    try:
        return await cp.get(path)
    except HTTPException as exc:
        raise RuntimeError(str(exc.detail)) from None


async def probe_host(cp: ControlPlaneClient) -> ComponentStatus:
    """Disk / memory / load from the control-plane sidecar. No sidecar → absent."""
    if not cp.configured:
        return ComponentStatus(name="host", status="absent", detail="Control plane not configured (host metrics need the sidecar)")
    body = await _sidecar(cp, "/host")
    disk = body.get("disk") or {}
    mem = body.get("memory") or {}
    load = body.get("load") or []
    total, free = disk.get("total") or 0, disk.get("free") or 0
    free_pct = (free / total * 100) if total else None
    data = {
        "disk_path": disk.get("path"),
        "disk_total_gb": round(total / GB, 1) if total else None,
        "disk_free_gb": round(free / GB, 1) if total else None,
        "disk_free_percent": round(free_pct, 1) if free_pct is not None else None,
        "memory_total_gb": round((mem.get("total") or 0) / GB, 1) if mem.get("total") else None,
        "memory_available_gb": round((mem.get("available") or 0) / GB, 1) if mem.get("available") else None,
        "load_1m": round(load[0], 2) if len(load) > 0 else None,
        "load_5m": round(load[1], 2) if len(load) > 1 else None,
        "load_15m": round(load[2], 2) if len(load) > 2 else None,
        "cpus": body.get("cpus"),
    }
    parts = []
    if free_pct is not None:
        parts.append(f"{data['disk_free_gb']} GB of {data['disk_total_gb']} GB free ({free_pct:.0f}%)")
    if data["memory_available_gb"] is not None:
        parts.append(f"{data['memory_available_gb']} GB memory available")
    if data["load_1m"] is not None:
        parts.append(f"load {data['load_1m']} on {data['cpus'] or '?'} CPUs")
    low = free_pct is not None and free_pct < DISK_DEGRADED_BELOW_PERCENT
    return ComponentStatus(name="host", status="degraded" if low else "ok",
                           detail=("Disk nearly full: " if low else "") + ", ".join(parts), data=data)


async def probe_tls(cp: ControlPlaneClient) -> ComponentStatus:
    """Certificates under certbot/conf/live via the sidecar. None → absent (HTTP only)."""
    if not cp.configured:
        return ComponentStatus(name="tls", status="absent", detail="Control plane not configured (certificate checks need the sidecar)")
    body = await _sidecar(cp, "/certificates")
    certs = body.get("certificates") or []
    if not certs:
        return ComponentStatus(name="tls", status="absent", detail="No certificates under certbot/conf/live (plain HTTP, or TLS terminated elsewhere)",
                               data={"domains": "", "certificates": 0})
    status, notes = "ok", []
    soonest = None
    for cert in certs:
        domain, days = cert.get("domain"), cert.get("days_left")
        if cert.get("error"):
            status, notes = "degraded", notes + [f"{domain}: {cert['error']}"]
            continue
        if days is not None and (soonest is None or days < soonest):
            soonest = days
        if cert.get("self_signed"):
            status = "degraded"
            notes.append(f"{domain}: self-signed placeholder (run deploy/init-ssl.sh)")
        elif days is not None and days < 0:
            status = "down"
            notes.append(f"{domain}: expired {abs(days):.0f} days ago")
        elif days is not None and days < CERT_WARN_DAYS:
            status = "degraded" if status != "down" else status
            notes.append(f"{domain}: expires in {days:.0f} days (certbot renews at 30; check emr-certbot)")
        else:
            notes.append(f"{domain}: valid, {days:.0f} days left" if days is not None else f"{domain}: valid")
    return ComponentStatus(name="tls", status=status, detail="; ".join(notes),
                           data={"domains": ", ".join(c.get("domain") or "?" for c in certs), "certificates": len(certs),
                                 "days_left": round(soonest) if soonest is not None else None,
                                 "issuer": certs[0].get("issuer")})


def default_probes(hapi: HAPIFHIRClient, cp: Optional[ControlPlaneClient] = None) -> Dict[str, Probe]:
    control_plane = cp or default_control_plane()

    async def fhir() -> ComponentStatus:
        return await probe_fhir(hapi)

    async def host() -> ComponentStatus:
        return await probe_host(control_plane)

    async def tls() -> ComponentStatus:
        return await probe_tls(control_plane)

    return {
        "fhir": fhir,
        "database": probe_database,
        "redis": probe_redis,
        "terminology": probe_terminology,
        "vna": probe_vna,
        "host": host,
        "tls": tls,
    }
