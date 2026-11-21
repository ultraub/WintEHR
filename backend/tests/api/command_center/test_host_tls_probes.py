"""Host and TLS probes (slice 11): absent without a sidecar, mapped from the
sidecar's /host and /certificates, degraded / down on low disk, placeholder
or expiring certs, and an unreachable sidecar reads as down with the reason."""

from __future__ import annotations

import httpx
import pytest

from api.command_center.control_plane import ControlPlaneClient
from api.command_center.probes import probe_host, probe_tls
from api.command_center.service import CommandCenterService

GB = 1024 ** 3


def _cp(handler):
    return ControlPlaneClient(base_url="http://sidecar", token="tok", transport=httpx.MockTransport(handler))


def _sidecar(host=None, certs=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/host":
            return httpx.Response(200, json=host or {})
        if request.url.path == "/certificates":
            return httpx.Response(200, json={"certificates": certs or []})
        return httpx.Response(404, json={"detail": "nope"})
    return handler


@pytest.mark.asyncio
async def test_without_a_sidecar_both_are_absent():
    cp = ControlPlaneClient(base_url="", token="")
    assert (await probe_host(cp)).status == "absent"
    assert (await probe_tls(cp)).status == "absent"


@pytest.mark.asyncio
async def test_host_maps_bytes_to_gb_and_flags_a_nearly_full_disk():
    ok = await probe_host(_cp(_sidecar(host={
        "disk": {"path": "/repo", "total": 100 * GB, "used": 55 * GB, "free": 45 * GB},
        "memory": {"total": 16 * GB, "available": 10 * GB}, "load": [0.5, 0.4, 0.3], "cpus": 2,
    })))
    assert ok.status == "ok"
    assert ok.data["disk_free_gb"] == 45.0 and ok.data["disk_free_percent"] == 45.0
    assert ok.data["memory_available_gb"] == 10.0 and ok.data["load_1m"] == 0.5 and ok.data["cpus"] == 2
    assert "45.0 GB of 100.0 GB free (45%)" in ok.detail
    low = await probe_host(_cp(_sidecar(host={"disk": {"total": 100 * GB, "used": 95 * GB, "free": 5 * GB}})))
    assert low.status == "degraded" and low.detail.startswith("Disk nearly full")


@pytest.mark.asyncio
async def test_tls_states():
    assert (await probe_tls(_cp(_sidecar(certs=[])))).status == "absent"
    good = await probe_tls(_cp(_sidecar(certs=[{"domain": "a.example", "days_left": 61.2, "self_signed": False, "issuer": "C = US, O = Let's Encrypt"}])))
    assert good.status == "ok" and good.data["days_left"] == 61 and "61 days left" in good.detail
    placeholder = await probe_tls(_cp(_sidecar(certs=[{"domain": "a.example", "days_left": 300, "self_signed": True}])))
    assert placeholder.status == "degraded" and "init-ssl" in placeholder.detail
    soon = await probe_tls(_cp(_sidecar(certs=[{"domain": "a.example", "days_left": 5.5, "self_signed": False}])))
    assert soon.status == "degraded" and "expires in 6 days" in soon.detail
    expired = await probe_tls(_cp(_sidecar(certs=[{"domain": "a.example", "days_left": -3, "self_signed": False},
                                                  {"domain": "b.example", "days_left": 80, "self_signed": False}])))
    assert expired.status == "down" and "expired 3 days ago" in expired.detail and expired.data["domains"] == "a.example, b.example"
    broken = await probe_tls(_cp(_sidecar(certs=[{"domain": "a.example", "error": "openssl x509 failed"}])))
    assert broken.status == "degraded" and "openssl" in broken.detail


@pytest.mark.asyncio
async def test_unreachable_sidecar_is_down_with_the_reason_and_the_report_still_builds():
    def boom(request):
        raise httpx.ConnectError("refused")
    cp = _cp(boom)

    async def host():
        return await probe_host(cp)

    async def ok():
        from api.command_center.models import ComponentStatus
        return ComponentStatus(name="fhir", status="ok", data={"patient_count": 3})

    async def no_secret(_key):
        return False

    svc = CommandCenterService(hapi_client=object(), probes={"fhir": ok, "host": host}, timeout_seconds=2.0,
                               router_state=lambda: {"registered": 1, "failed": [], "disabled_modules": [], "modules": []},
                               env={"ENVIRONMENT": "prod"}, secret_is_set=no_secret)
    report = await svc.status()
    host_c = next(c for c in report.components if c.name == "host")
    assert host_c.status == "down" and "unreachable" in host_c.detail
    assert report.status == "degraded"
    ids = [i.id for i in report.readiness]
    assert "control_plane" in ids and next(i for i in report.readiness if i.id == "control_plane").status == "fail"
    assert next(i for i in report.readiness if i.id == "umls_key").status == "warn"
