"""Backend half of the control plane (slice 10): proxy routes, gates, not-configured
and unreachable behaviour, audit on restart."""

from __future__ import annotations

import json

import httpx
import pytest

from api.command_center.control_plane import ControlPlaneClient, use_control_plane
from api.command_center.router import get_container_logs, get_control, get_control_config, get_update_check, restart_container


def _sidecar(calls):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path, dict(request.url.params), request.headers.get("authorization")))
        if request.url.path == "/containers":
            return httpx.Response(200, json={"containers": [{"name": "emr-backend", "state": "running"}], "checked_at": "now"})
        if request.url.path == "/containers/emr-backend/logs":
            return httpx.Response(200, json={"name": "emr-backend", "lines": ["a", "b"], "tail": 2, "truncated": True})
        if request.url.path == "/containers/emr-backend/restart":
            return httpx.Response(202, json={"accepted": True, "name": "emr-backend"})
        if request.url.path == "/containers/emr-postgres/restart":
            return httpx.Response(403, json={"detail": "emr-postgres is not restartable from the Command Center"})
        if request.url.path == "/update-check":
            return httpx.Response(200, json={"branch": "master", "update_available": False})
        if request.url.path == "/config":
            return httpx.Response(200, json={"nginx": None, "compose": "services: {}", "env_keys": ["X"]})
        return httpx.Response(404, json={"detail": "nope"})
    return handler


@pytest.fixture
def cp():
    calls = []
    client = ControlPlaneClient(base_url="http://sidecar", token="tok", transport=httpx.MockTransport(_sidecar(calls)))
    use_control_plane(client)
    yield client, calls
    use_control_plane(None)


class _User:
    id = "admin"


@pytest.mark.asyncio
async def test_control_proxies_with_the_token(cp):
    client, calls = cp
    body = await get_control(_user=_User(), cp=client)
    assert body["configured"] and body["reachable"] and body["containers"][0]["name"] == "emr-backend"
    assert calls[0][3] == "Bearer tok"
    logs = await get_container_logs("emr-backend", tail=99999, since=None, _user=_User(), cp=client)
    assert logs["lines"] == ["a", "b"] and calls[-1][2]["tail"] == "5000"
    assert (await get_update_check(_user=_User(), cp=client))["branch"] == "master"
    assert (await get_control_config(_user=_User(), cp=client))["env_keys"] == ["X"]


@pytest.mark.asyncio
async def test_restart_passes_through_sidecar_verdicts(cp, monkeypatch):
    client, calls = cp
    audited = []

    class FakeAudit:
        async def log_event(self, **kw):
            audited.append(kw)

    import api.services.audit_event_service as aes
    monkeypatch.setattr(aes, "AuditEventService", lambda: FakeAudit())
    body = await restart_container("emr-backend", user=_User(), cp=client)
    assert body == {"accepted": True, "name": "emr-backend"}
    assert audited and audited[0]["event_type"] == "system.control.restart" and audited[0]["details"] == {"container": "emr-backend"}
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await restart_container("emr-postgres", user=_User(), cp=client)
    assert exc.value.status_code == 403 and "not restartable" in exc.value.detail


@pytest.mark.asyncio
async def test_not_configured_and_unreachable_are_not_500s():
    unconfigured = ControlPlaneClient(base_url="", token="")
    body = await get_control(_user=_User(), cp=unconfigured)
    assert body["configured"] is False and "CONTROL_PLANE_TOKEN" in body["how_to"]
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await get_update_check(_user=_User(), cp=unconfigured)
    assert exc.value.status_code == 503

    def down(request):
        raise httpx.ConnectError("refused")
    dead = ControlPlaneClient(base_url="http://sidecar", token="tok", transport=httpx.MockTransport(down))
    body = await get_control(_user=_User(), cp=dead)
    assert body["configured"] and not body["reachable"] and "unreachable" in body["error"]


def test_route_gates():
    from api.command_center.router import router
    from api.auth.permissions import require_admin, require_system
    gates = {}
    for route in router.routes:
        if "/control" in route.path:
            deps = {d.call for d in route.dependant.dependencies}
            gates[(next(iter(route.methods)), route.path)] = "system" if require_system in deps else "admin" if require_admin in deps else None
    assert gates[("POST", "/api/command-center/control/containers/{name}/restart")] == "system"
    assert all(v == "admin" for k, v in gates.items() if k[0] == "GET")


@pytest.mark.asyncio
async def test_update_preview_apply_and_status_proxy_and_audit(monkeypatch):
    from api.command_center.router import UpdateApplyRequest, apply_update, get_update_preview, get_update_status

    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path, request.content))
        if request.url.path == "/update/preview":
            return httpx.Response(200, json={"branch": "master", "commits": [{"sha": "b" * 40}], "can_apply": True, "blockers": [], "remote": "b" * 40})
        if request.url.path == "/update/apply":
            return httpx.Response(202, json={"accepted": True, "updater": "id-emr-updater", "from": "a" * 40, "to": "b" * 40,
                                             "services": ["backend-prod"], "profile": "prod"})
        if request.url.path == "/update/status":
            return httpx.Response(200, json={"present": True, "running": True, "lines": ["STEP 1/4: fetch"]})
        return httpx.Response(404, json={"detail": "nope"})

    client = ControlPlaneClient(base_url="http://sidecar", token="tok", transport=httpx.MockTransport(handler))
    audited = []

    class FakeAudit:
        async def log_event(self, **kw):
            audited.append(kw)

    import api.services.audit_event_service as aes
    monkeypatch.setattr(aes, "AuditEventService", lambda: FakeAudit())

    preview = await get_update_preview(_user=_User(), cp=client)
    assert preview["can_apply"] is True
    result = await apply_update(UpdateApplyRequest(commit="b" * 40), user=_User(), cp=client)
    assert result["accepted"] is True
    assert calls[-1][0] == "POST" and json.loads(calls[-1][2]) == {"commit": "b" * 40}
    assert audited[0]["event_type"] == "system.control.update" and audited[0]["details"]["to"] == "b" * 40
    assert audited[0]["details"]["from"] == "a" * 40 and audited[0]["details"]["services"] == ["backend-prod"]
    status = await get_update_status(_user=_User(), cp=client)
    assert status["running"] is True
    # the commit is validated before anything reaches the sidecar
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        UpdateApplyRequest(commit="main")
