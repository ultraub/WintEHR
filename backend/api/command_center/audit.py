"""Audit trail reader for the Command Center (slice 12).

Every admin write (settings, roles, tab policy, jobs, SMART apps, external
services, container restarts) and every login already lands in HAPI as a
FHIR AuditEvent (api/services/audit_event_service.py). This reads them
back, newest first, flattened for a table.

HAPI does the heavy filtering (window via `date`, exact event type via
`subtype`, `_count`); the user and free-text filters apply to the fetched
page, because the writer stores the user in `agent.who.display`, which is
not a search parameter. The response says how many were fetched and
whether the window held more, so the UI can say "within the newest N".
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException

from .models import AuditEventView, AuditResponse

logger = logging.getLogger(__name__)

LIMIT_DEFAULT = 200
LIMIT_MAX = 500

ACTION_WORDS = {"C": "create", "R": "read", "U": "update", "D": "delete", "E": "execute"}
OUTCOME_WORDS = {"0": "success", "4": "minor failure", "8": "serious failure", "12": "major failure"}


def _display(ref: Optional[Dict[str, Any]]) -> Optional[str]:
    if not ref:
        return None
    return ref.get("display") or ref.get("reference")


def flatten(resource: Dict[str, Any]) -> AuditEventView:
    """FHIR AuditEvent → the row the table shows. Tolerates events written by older code."""
    subtype = (resource.get("subtype") or [{}])[0]
    code = subtype.get("code") or ((resource.get("type") or {}).get("code")) or "unknown"
    agents = resource.get("agent") or []
    who = agents[0] if agents else {}
    ip = ((who.get("network") or {}).get("address")) if who else None
    patient = entity = None
    details: Dict[str, Any] = {}
    for ent in resource.get("entity") or []:
        role = ((ent.get("role") or {}).get("code"))
        kind = ((ent.get("type") or {}).get("code"))
        if role == "1" and patient is None:
            patient = _display(ent.get("what"))
        elif kind == "2" and entity is None:
            entity = _display(ent.get("what"))
        for detail in ent.get("detail") or []:
            if detail.get("type") == "Custom" and detail.get("valueString"):
                try:
                    parsed = json.loads(detail["valueString"])
                    if isinstance(parsed, dict):
                        details.update(parsed)
                except ValueError:
                    details["raw"] = detail["valueString"]
    recorded = None
    raw_recorded = resource.get("recorded")
    if raw_recorded:
        try:
            recorded = datetime.fromisoformat(str(raw_recorded).replace("Z", "+00:00"))
        except ValueError:
            recorded = None
    outcome_code = str(resource.get("outcome", "0"))
    return AuditEventView(
        id=resource.get("id") or "",
        recorded=recorded,
        event_type=code,
        category=code.split(".")[0] if "." in code else code,
        action=ACTION_WORDS.get(resource.get("action") or "", resource.get("action")),
        outcome=resource.get("outcomeDesc") or OUTCOME_WORDS.get(outcome_code, outcome_code),
        user=_display(who.get("who")) if who else None,
        ip=ip,
        patient=patient,
        entity=entity,
        details=details,
    )


class AuditClient:
    """Reads AuditEvents from HAPI. `transport` lets tests answer the search."""

    def __init__(self, base_url: Optional[str] = None, timeout: float = 20.0,
                 transport: Optional[httpx.AsyncBaseTransport] = None):
        from services.hapi_fhir_client import HAPI_FHIR_BASE_URL

        self.base_url = (base_url or os.getenv("HAPI_FHIR_URL") or HAPI_FHIR_BASE_URL).rstrip("/")
        self.timeout = timeout
        self._transport = transport

    async def read(
        self,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        event_type: Optional[str] = None,
        category: Optional[str] = None,
        user: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = LIMIT_DEFAULT,
    ) -> AuditResponse:
        limit = max(1, min(int(limit), LIMIT_MAX))
        params: List[tuple] = [("_sort", "-date"), ("_count", str(limit)), ("_total", "accurate")]
        if since:
            params.append(("date", f"ge{since.isoformat()}"))
        if until:
            params.append(("date", f"le{until.isoformat()}"))
        if event_type:
            params.append(("subtype", event_type))
        try:
            async with httpx.AsyncClient(timeout=self.timeout, transport=self._transport) as client:
                resp = await client.get(f"{self.base_url}/AuditEvent", params=params,
                                        headers={"Accept": "application/fhir+json"})
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail=f"FHIR store unreachable: {exc.__class__.__name__}") from exc
        if resp.status_code >= 400:
            raise HTTPException(status_code=503, detail=f"FHIR store returned HTTP {resp.status_code} for AuditEvent search")
        bundle = resp.json()
        resources = [e.get("resource") or {} for e in bundle.get("entry") or []]
        fetched = [flatten(r) for r in resources if r.get("resourceType") == "AuditEvent"]
        total = bundle.get("total")

        events = fetched
        if category:
            events = [e for e in events if e.category == category]
        if user:
            needle = user.strip().lower()
            events = [e for e in events if e.user and needle in e.user.lower()]
        if query:
            needle = query.strip().lower()

            def hit(e: AuditEventView) -> bool:
                hay = " ".join(filter(None, [e.event_type, e.user, e.entity, e.patient, e.outcome, e.action, json.dumps(e.details)]))
                return needle in hay.lower()

            events = [e for e in events if hit(e)]
        return AuditResponse(
            events=events,
            total=total if isinstance(total, int) else None,
            fetched=len(fetched),
            limit=limit,
            truncated=(isinstance(total, int) and total > len(fetched)) or len(fetched) >= limit,
            event_types=sorted({e.event_type for e in fetched}),
        )


_default_client: Optional[AuditClient] = None


def default_audit_client() -> AuditClient:
    global _default_client
    if _default_client is None:
        _default_client = AuditClient()
    return _default_client


def use_audit_client(client: Optional[AuditClient]) -> None:
    global _default_client
    _default_client = client
