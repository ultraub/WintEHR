"""The control-plane sidecar (control-plane/app.py): token gate, allow-list,
log demux, update check, config view that never leaks .env values, host
metrics, certificate inspection (never the key)."""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import httpx
import pytest

SIDECAR_DIR = Path(__file__).resolve().parents[3] / "control-plane"


@pytest.fixture
def sidecar(monkeypatch, tmp_path):
    monkeypatch.setenv("CONTROL_PLANE_TOKEN", "sekrit")
    monkeypatch.setenv("CONTROL_PLANE_REPO", str(tmp_path))
    monkeypatch.setenv("CONTROL_PLANE_CONTAINERS", "emr-backend,emr-postgres")
    monkeypatch.setenv("CONTROL_PLANE_RESTARTABLE", "emr-backend,not-listed")
    sys.path.insert(0, str(SIDECAR_DIR))
    sys.modules.pop("app", None)
    module = importlib.import_module("app")
    yield module, tmp_path
    sys.modules.pop("app", None)
    sys.path.remove(str(SIDECAR_DIR))


def _frame(stream: int, text: str) -> bytes:
    data = text.encode()
    return bytes([stream, 0, 0, 0]) + len(data).to_bytes(4, "big") + data


def _fake_docker(calls):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path, dict(request.url.params)))
        if request.url.path == "/containers/json":
            return httpx.Response(200, json=[
                {"Names": ["/emr-backend"], "State": "running", "Status": "Up 3 hours (healthy)", "Image": "wintehr-backend-prod", "Id": "abcdef0123456789", "Created": 1},
                {"Names": ["/emr-nginx"], "State": "running", "Status": "Up 3 hours", "Image": "nginx", "Id": "ffff", "Created": 1},
            ])
        if request.url.path == "/containers/emr-backend/logs":
            return httpx.Response(200, content=_frame(1, "2026-11-20T17:00:00Z INFO one\n") + _frame(2, "2026-11-20T17:00:01Z ERROR two\n"))
        if request.url.path == "/containers/emr-backend/restart":
            return httpx.Response(204)
        return httpx.Response(404, json={"message": "no such container"})
    return handler


@pytest.fixture
def client(sidecar, monkeypatch):
    module, _ = sidecar
    calls = []
    monkeypatch.setattr(module, "docker_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(_fake_docker(calls)), base_url="http://docker"))
    transport = httpx.ASGITransport(app=module.app)
    return httpx.AsyncClient(transport=transport, base_url="http://sidecar"), calls


AUTH = {"Authorization": "Bearer sekrit"}


@pytest.mark.asyncio
async def test_token_gate(client):
    http, _ = client
    assert (await http.get("/health")).json()["configured"] is True
    assert (await http.get("/containers")).status_code == 401
    assert (await http.get("/containers", headers={"Authorization": "Bearer nope"})).status_code == 401
    assert (await http.get("/containers", headers=AUTH)).status_code == 200


@pytest.mark.asyncio
async def test_unset_token_refuses_everything(monkeypatch, tmp_path):
    monkeypatch.setenv("CONTROL_PLANE_TOKEN", "")
    monkeypatch.setenv("CONTROL_PLANE_REPO", str(tmp_path))
    sys.path.insert(0, str(SIDECAR_DIR))
    sys.modules.pop("app", None)
    try:
        module = importlib.import_module("app")
        http = httpx.AsyncClient(transport=httpx.ASGITransport(app=module.app), base_url="http://sidecar")
        assert (await http.get("/health")).json()["configured"] is False
        assert (await http.get("/containers", headers={"Authorization": "Bearer "})).status_code == 503
    finally:
        sys.modules.pop("app", None)
        sys.path.remove(str(SIDECAR_DIR))


@pytest.mark.asyncio
async def test_containers_are_the_allow_list_only(client):
    http, _ = client
    rows = (await http.get("/containers", headers=AUTH)).json()["containers"]
    assert [r["name"] for r in rows] == ["emr-backend", "emr-postgres"]  # emr-nginx not listed → not shown
    backend, postgres = rows
    assert backend["health"] == "healthy" and backend["id"] == "abcdef012345" and backend["restartable"] is True
    assert postgres["present"] is False and postgres["state"] == "absent" and postgres["restartable"] is False


@pytest.mark.asyncio
async def test_logs_are_demuxed_and_names_are_checked(client):
    http, calls = client
    body = (await http.get("/containers/emr-backend/logs", headers=AUTH, params={"tail": 50})).json()
    assert body["lines"] == ["2026-11-20T17:00:00Z INFO one", "2026-11-20T17:00:01Z ERROR two"] and body["truncated"] is False
    assert calls[-1][2]["tail"] == "50" and calls[-1][2]["timestamps"] == "true"
    assert (await http.get("/containers/emr-nginx/logs", headers=AUTH)).status_code == 404
    assert (await http.get("/containers/../../etc/logs", headers=AUTH)).status_code == 404
    assert (await http.get("/containers/emr-backend/logs", headers=AUTH, params={"tail": 999999})).status_code == 422


def test_demux_passes_tty_output_through(sidecar):
    module, _ = sidecar
    assert module.demux(b"plain tty text\n") == "plain tty text\n"
    assert module.demux(_frame(1, "a") + _frame(2, "b")) == "ab"


@pytest.mark.asyncio
async def test_restart_is_allow_listed_and_deferred(client):
    http, calls = client
    resp = await http.post("/containers/emr-backend/restart", headers=AUTH)
    assert resp.status_code == 202 and resp.json() == {"accepted": True, "name": "emr-backend"}
    assert ("POST", "/containers/emr-backend/restart", {"t": "10"}) in calls  # background task ran under ASGITransport
    assert (await http.post("/containers/emr-postgres/restart", headers=AUTH)).status_code == 403
    assert (await http.post("/containers/emr-nginx/restart", headers=AUTH)).status_code == 404


def test_update_check_reports_local_and_remote(sidecar, monkeypatch):
    module, _ = sidecar
    answers = {("rev-parse", "--abbrev-ref", "HEAD"): "master", ("rev-parse", "HEAD"): "a" * 40,
               ("log", "-1", "--format=%s (%ci)"): "feat: x (2026-11-20)", ("ls-remote", "--heads", "origin", "master"): "b" * 40 + "\trefs/heads/master"}
    monkeypatch.setattr(module, "_git", lambda *args, timeout=20: answers[args])
    out = module.update_check()
    assert out["branch"] == "master" and out["local"] == "a" * 40 and out["remote"] == "b" * 40 and out["update_available"] is True and out["error"] is None

    answers[("ls-remote", "--heads", "origin", "master")] = "a" * 40 + "\trefs/heads/master"
    assert module.update_check()["update_available"] is False

    def boom(*args, timeout=20):
        raise RuntimeError("fatal: not a git repository")
    monkeypatch.setattr(module, "_git", boom)
    out = module.update_check()
    assert out["local"] is None and "not a git repository" in out["error"]


def test_config_view_exposes_env_names_never_values(sidecar):
    module, repo = sidecar
    (repo / "deploy" / "rendered").mkdir(parents=True)
    (repo / "deploy" / "rendered" / "nginx.conf").write_text("server { server_name example.test; }")
    (repo / "docker-compose.yml").write_text("services: {}")
    (repo / ".env").write_text("# comment\nPOSTGRES_PASSWORD=hunter2\nexport JWT_SECRET_KEY='abc'\nCONTROL_PLANE_TOKEN=sekrit\n\nBROKEN LINE\n")
    view = module.config_view()
    assert "example.test" in view["nginx"] and view["compose"] == "services: {}"
    assert view["env_keys"] == ["POSTGRES_PASSWORD", "JWT_SECRET_KEY", "CONTROL_PLANE_TOKEN"]
    assert "hunter2" not in json.dumps(view) and "sekrit" not in json.dumps(view)
    (repo / "deploy" / "rendered" / "nginx.conf").unlink()
    assert module.config_view()["nginx"] is None


def test_host_view_reports_the_repo_disk_memory_and_load(sidecar):
    module, repo = sidecar
    body = module.host_view()
    assert body["disk"]["path"] == str(repo) and body["disk"]["total"] > 0 and body["disk"]["free"] >= 0
    assert body["disk"]["total"] >= body["disk"]["free"]
    assert isinstance(body["load"], list) and body["cpus"] >= 1
    assert "total" in body["memory"] and "available" in body["memory"]  # None off Linux; bytes on Linux


def test_certificates_view_reads_expiry_and_spots_self_signed(sidecar):
    import shutil, subprocess
    module, repo = sidecar
    assert module.certificates_view()["certificates"] == []
    if not shutil.which("openssl"):
        pytest.skip("openssl CLI not available")
    live = repo / "certbot" / "conf" / "live" / "example.test"
    live.mkdir(parents=True)
    (repo / "certbot" / "conf" / "live" / "README").write_text("certbot drops a README here too")
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=example.test", "-days", "20",
                    "-keyout", str(live / "privkey.pem"), "-out", str(live / "fullchain.pem")], check=True, capture_output=True)
    certs = module.certificates_view()["certificates"]
    assert [c["domain"] for c in certs] == ["example.test"]
    c = certs[0]
    assert c["self_signed"] is True and c["error"] is None
    assert 18 < c["days_left"] < 21 and c["not_after"].endswith("+00:00")
    assert "example.test" in c["subject"]
    assert "PRIVATE" not in json.dumps(c)
    (live / "fullchain.pem").write_text("not a cert")
    assert module.certificates_view()["certificates"][0]["error"]
