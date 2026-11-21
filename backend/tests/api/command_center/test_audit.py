"""Audit trail reader (slice 12): flattening of AuditEvents as the writer
produces them, HAPI-side vs page-side filters, limit clamp, store errors → 503."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import httpx
import pytest
from fastapi import HTTPException

from api.command_center.audit import AuditClient, LIMIT_MAX, flatten, use_audit_client
from api.command_center.router import get_audit


def _event(id, code, user="demo-admin", outcome="success", action="U", details=None, patient=None, entity="Setting/system.patient_count_cap", ip=None, recorded="2026-11-21T10:00:00Z"):
    agent = {"who": {"display": user}, "requestor": True}
    if ip:
        agent["network"] = {"address": ip, "type": "2"}
    entities = []
    if patient:
        entities.append({"what": {"display": patient}, "role": {"code": "1"}, "type": {"code": "1"}})
    if entity:
        ent = {"what": {"display": entity}, "type": {"code": "2"}}
        if details is not None:
            ent["detail"] = [{"type": "Custom", "valueString": json.dumps(details)}, {"type": "User-Agent", "valueString": "curl"}]
        entities.append(ent)
    return {"resourceType": "AuditEvent", "id": id, "recorded": recorded, "action": action, "outcome": "0" if outcome == "success" else "8",
            "outcomeDesc": outcome, "subtype": [{"code": code}], "type": {"code": "110100"}, "agent": [agent], "entity": entities}


EVENTS = [
    _event("1", "system.setting.updated", details={"key": "system.patient_count_cap", "tier": "live"}, ip="10.0.0.5"),
    _event("2", "auth.login.failure", user="nurse", outcome="failure", action="E", entity=None, recorded="2026-11-21T09:59:00Z"),
    _event("3", "system.control.restart", user="demo-admin", action="E", entity="Container/emr-certbot", details={"container": "emr-certbot"}),
    _event("4", "fhir.resource.read", user="demo", action="R", patient="Patient/abc", entity="Observation/1"),
]


def _hapi(calls, events=EVENTS, total=None, status=200):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url)
        if status != 200:
            return httpx.Response(status, json={"resourceType": "OperationOutcome"})
        subtype = request.url.params.get("subtype")
        chosen = [e for e in events if not subtype or e["subtype"][0]["code"] == subtype]
        return httpx.Response(200, json={"resourceType": "Bundle", "total": total if total is not None else len(chosen),
                                         "entry": [{"resource": e} for e in chosen]})
    return handler


def test_flatten_reads_user_ip_patient_entity_details_and_words():
    row = flatten(EVENTS[0])
    assert row.event_type == "system.setting.updated" and row.category == "system"
    assert row.user == "demo-admin" and row.ip == "10.0.0.5" and row.action == "update" and row.outcome == "success"
    assert row.entity == "Setting/system.patient_count_cap" and row.details == {"key": "system.patient_count_cap", "tier": "live"}
    assert row.recorded == datetime(2026, 11, 21, 10, 0, tzinfo=timezone.utc)
    fhir = flatten(EVENTS[3])
    assert fhir.patient == "Patient/abc" and fhir.entity == "Observation/1" and fhir.action == "read"
    legacy = flatten({"resourceType": "AuditEvent", "id": "x", "type": {"code": "rest"}, "outcome": "8"})
    assert legacy.event_type == "rest" and legacy.outcome == "serious failure" and legacy.user is None


@pytest.mark.asyncio
async def test_window_and_event_type_go_to_hapi_user_and_text_filter_the_page():
    calls = []
    client = AuditClient(base_url="http://hapi/fhir", transport=httpx.MockTransport(_hapi(calls)))
    since = datetime(2026, 11, 21, 9, 0, tzinfo=timezone.utc)
    body = await client.read(since=since, limit=50)
    url = calls[0]
    assert url.path == "/fhir/AuditEvent" and url.params["_sort"] == "-date" and url.params["_count"] == "50"
    assert url.params["date"] == "ge2026-11-21T09:00:00+00:00"
    assert [e.id for e in body.events] == ["1", "2", "3", "4"] and body.fetched == 4 and body.truncated is False
    assert body.event_types == ["auth.login.failure", "fhir.resource.read", "system.control.restart", "system.setting.updated"]

    only = await client.read(event_type="system.control.restart")
    assert calls[-1].params["subtype"] == "system.control.restart" and [e.id for e in only.events] == ["3"]

    assert [e.id for e in (await client.read(user="ADMIN")).events] == ["1", "3"]
    assert [e.id for e in (await client.read(category="auth")).events] == ["2"]
    assert [e.id for e in (await client.read(query="certbot")).events] == ["3"]
    assert [e.id for e in (await client.read(query="patient_count_cap")).events] == ["1"]


@pytest.mark.asyncio
async def test_limit_is_clamped_and_truncation_reflects_the_window():
    calls = []
    client = AuditClient(base_url="http://hapi/fhir", transport=httpx.MockTransport(_hapi(calls, total=900)))
    body = await client.read(limit=99999)
    assert calls[0].params["_count"] == str(LIMIT_MAX) and body.limit == LIMIT_MAX
    assert body.truncated is True and body.total == 900


@pytest.mark.asyncio
async def test_store_errors_are_503_not_500():
    down = AuditClient(base_url="http://hapi/fhir", transport=httpx.MockTransport(_hapi([], status=500)))
    with pytest.raises(HTTPException) as exc:
        await down.read()
    assert exc.value.status_code == 503

    def boom(request):
        raise httpx.ConnectError("refused")
    with pytest.raises(HTTPException) as exc:
        await AuditClient(base_url="http://hapi/fhir", transport=httpx.MockTransport(boom)).read()
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_route_parses_the_window_and_uses_the_injected_client():
    calls = []
    client = AuditClient(base_url="http://hapi/fhir", transport=httpx.MockTransport(_hapi(calls)))
    use_audit_client(client)
    try:
        body = await get_audit(since="2026-11-21T09:30:00Z", until=None, event_type=None, category=None, user=None, q=None, limit=10,
                               _user=object(), audit=client)
        assert calls[0].params["date"] == "ge2026-11-21T09:30:00+00:00" and len(body.events) == 4
        with pytest.raises(HTTPException) as exc:
            await get_audit(since="yesterday", until=None, event_type=None, category=None, user=None, q=None, limit=10, _user=object(), audit=client)
        assert exc.value.status_code == 400
    finally:
        use_audit_client(None)


def test_writer_keeps_details_without_a_resource_entity_and_the_reader_shows_them():
    """Settings, jobs, restarts and failed logins log details but no resource;
    the writer used to drop those details. Round-trip through flatten()."""
    from api.services.audit_event_service import AuditEventService, build_audit_event

    svc = AuditEventService(hapi_base_url="http://hapi/fhir")
    restart = build_audit_event(svc, "system.control.restart", user_id="demo-admin", action="execute", details={"container": "emr-certbot"})
    row = flatten(dict(restart, id="r1"))
    assert row.entity == "emr-certbot" and row.details == {"container": "emr-certbot"} and row.user == "demo-admin"

    failed = build_audit_event(svc, "auth.login.failure", user_id=None, action="login", outcome="failure",
                               details={"username": "nurse", "failure_reason": "bad password"}, ip_address="10.0.0.9")
    row = flatten(dict(failed, id="f1"))
    assert row.user == "WintEHR System" and row.entity == "nurse" and row.details["failure_reason"] == "bad password" and row.ip == "10.0.0.9"

    # with a resource entity the details ride on it, exactly as before (no duplicate entity)
    with_res = build_audit_event(svc, "fhir.resource.update", user_id="demo", resource_type="Observation", resource_id="1", details={"x": 1})
    assert len(with_res["entity"]) == 1 and flatten(dict(with_res, id="o1")).entity == "Observation/1"
    assert len(build_audit_event(svc, "auth.logout", user_id="demo", action="logout")["entity"]) == 0
