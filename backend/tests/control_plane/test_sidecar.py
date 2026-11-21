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


# --- confirmed update-apply (slice 14) --------------------------------------------------------

import os
import stat
import subprocess

UPDATE_SH = SIDECAR_DIR / "update.sh"


def _sh(cwd, *args, env=None):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=True,
                          env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@x", "GIT_COMMITTER_NAME": "t",
                               "GIT_COMMITTER_EMAIL": "t@x", **(env or {})}).stdout.strip()


def _commit(repo, path, text, message):
    (repo / path).parent.mkdir(parents=True, exist_ok=True)
    (repo / path).write_text(text)
    _sh(repo, "git", "add", "-A")
    _sh(repo, "git", "commit", "-q", "-m", message)
    return _sh(repo, "git", "rev-parse", "HEAD")


@pytest.fixture
def repos(tmp_path):
    """origin with two commits; a clone one commit behind (the host checkout)."""
    origin = tmp_path / "origin"
    origin.mkdir()
    _sh(origin, "git", "init", "-q", "-b", "master")
    _commit(origin, "README.md", "one", "initial")
    _sh(tmp_path, "git", "clone", "-q", str(origin), "repo")
    clone = tmp_path / "repo"
    ahead = _commit(origin, "backend/x.py", "x = 1", "feat: backend thing")
    _commit(origin, "frontend/src/y.js", "export const y = 1;", "feat: frontend thing")
    return origin, clone, ahead


@pytest.fixture
def update_sidecar(monkeypatch, repos):
    origin, clone, _ = repos
    monkeypatch.setenv("CONTROL_PLANE_TOKEN", "sekrit")
    monkeypatch.setenv("CONTROL_PLANE_REPO", str(clone))
    monkeypatch.setenv("CONTROL_PLANE_SELF", "selfid")
    monkeypatch.setenv("CONTROL_PLANE_UPDATE_SERVICES", "backend-prod,frontend-prod,control-plane")
    sys.path.insert(0, str(SIDECAR_DIR))
    sys.modules.pop("app", None)
    module = importlib.import_module("app")
    created = []
    state = {"updater": None}  # the fake daemon's view of emr-updater

    def handler(request: httpx.Request) -> httpx.Response:
        path, method = request.url.path, request.method
        if path == "/containers/selfid/json":
            return httpx.Response(200, json={"Image": "sha256:cafe", "Mounts": [
                {"Destination": str(clone), "Source": "/home/azureuser/WintEHR"},
                {"Destination": module.DOCKER_SOCKET, "Source": "/var/run/docker.sock"}],
                "Config": {"Labels": {"com.docker.compose.project": "wintehr"}}})
        if path == "/containers/create":
            body = json.loads(request.content)
            created.append((dict(request.url.params), body))
            name = request.url.params.get("name")
            if name == module.UPDATER:
                if state["updater"]:
                    return httpx.Response(409, json={"message": "conflict"})
                state["updater"] = {"body": body, "running": False}
            if name == module.FETCHER:
                _sh(clone, "git", "fetch", "-q", "origin", "master")  # what the helper would do on the host
            return httpx.Response(201, json={"Id": f"id-{name}"})
        if path.endswith("/start"):
            if "emr-updater" in path and state["updater"]:
                state["updater"]["running"] = True
            return httpx.Response(204)
        if path.endswith("/wait"):
            return httpx.Response(200, json={"StatusCode": 0})
        if path.endswith("/logs"):
            return httpx.Response(200, content=_frame(1, "STEP 1/4: fetch origin/master\nSTEP 3/4: build images\n"))
        if path == f"/containers/{module.UPDATER}/json":
            if not state["updater"]:
                return httpx.Response(404, json={"message": "no such container"})
            return httpx.Response(200, json={"State": {"Running": state["updater"]["running"], "ExitCode": 0, "StartedAt": "2026-11-21T10:00:00Z", "FinishedAt": "0001-01-01T00:00:00Z"},
                                             "Config": {"Labels": state["updater"]["body"]["Labels"]}})
        if method == "DELETE" and path.startswith("/containers/"):
            if module.UPDATER in path:
                state["updater"] = None
            return httpx.Response(204)
        return httpx.Response(404, json={"message": f"unexpected {method} {path}"})

    monkeypatch.setattr(module, "docker_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://docker"))
    http = httpx.AsyncClient(transport=httpx.ASGITransport(app=module.app), base_url="http://sidecar")
    yield module, http, created, state, repos
    sys.modules.pop("app", None)
    sys.path.remove(str(SIDECAR_DIR))


@pytest.mark.asyncio
async def test_update_preview_fetches_in_a_helper_and_lists_the_change(update_sidecar):
    module, http, created, _, (origin, clone, _) = update_sidecar
    body = (await http.get("/update/preview", headers=AUTH)).json()
    assert body["branch"] == "master" and body["update_available"] is True and body["fast_forward"] is True
    assert [c["subject"] for c in body["commits"]] == ["feat: frontend thing", "feat: backend thing"]
    assert body["remote"] == _sh(origin, "git", "rev-parse", "HEAD") and body["local"] == _sh(clone, "git", "rev-parse", "HEAD")
    assert body["files"] == 2 and body["areas"] == {"backend": 1, "frontend": 1} and body["insertions"] == 2
    assert body["can_apply"] is True and body["blockers"] == [] and body["dirty"] == []
    assert body["services"] == ["backend-prod", "frontend-prod", "control-plane"] and body["profile"] == "prod"
    assert body["updater"] == {"present": False, "running": False}
    # the fetch ran in a helper built from the sidecar's own image, as the repo owner, at the host path
    params, spec = created[-1]
    assert params["name"] == module.FETCHER
    assert spec["Image"] == "sha256:cafe" and spec["Cmd"] == ["/srv/update.sh", "fetch"]
    assert spec["WorkingDir"] == "/home/azureuser/WintEHR"
    assert spec["HostConfig"]["Binds"] == ["/home/azureuser/WintEHR:/home/azureuser/WintEHR", f"/var/run/docker.sock:{module.DOCKER_SOCKET}"]
    st = os.stat(clone)
    assert spec["User"] == f"{st.st_uid}:{st.st_gid}"
    assert "COMPOSE_PROJECT_NAME=wintehr" in spec["Env"] and "UPDATE_SERVICES=backend-prod frontend-prod control-plane" in spec["Env"]


@pytest.mark.asyncio
async def test_update_apply_checks_the_commit_starts_the_helper_and_reports_status(update_sidecar):
    module, http, created, state, (origin, clone, _) = update_sidecar
    remote = _sh(origin, "git", "rev-parse", "HEAD")
    await http.get("/update/preview", headers=AUTH)  # fetch so origin/master is known
    assert (await http.post("/update/apply", headers=AUTH, json={"commit": "abc"})).status_code == 400
    assert (await http.post("/update/apply", headers=AUTH, json={"commit": "f" * 40})).status_code == 409
    resp = await http.post("/update/apply", headers=AUTH, json={"commit": remote})
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["accepted"] is True and body["to"] == remote and body["from"] == _sh(clone, "git", "rev-parse", "HEAD")
    params, spec = created[-1]
    assert params["name"] == module.UPDATER and spec["Cmd"] == ["/srv/update.sh", "apply", remote]
    assert spec["Labels"]["wintehr.updater.commit"] == remote
    status = (await http.get("/update/status", headers=AUTH)).json()
    assert status["present"] and status["running"] and status["commit"] == remote and status["succeeded"] is None
    assert status["message"] == "STEP 3/4: build images" and len(status["lines"]) == 2
    # a second apply while one runs is refused, and the preview says so without fetching again
    assert (await http.post("/update/apply", headers=AUTH, json={"commit": remote})).status_code == 409
    fetches_before = sum(1 for p, _ in created if p.get("name") == module.FETCHER)
    preview = (await http.get("/update/preview", headers=AUTH)).json()
    assert "an update is already running" in preview["blockers"] and preview["can_apply"] is False
    assert sum(1 for p, _ in created if p.get("name") == module.FETCHER) == fetches_before
    # once finished, status reports the outcome
    state["updater"]["running"] = False
    status = (await http.get("/update/status", headers=AUTH)).json()
    assert status["running"] is False and status["exit_code"] == 0 and status["succeeded"] is True


@pytest.mark.asyncio
async def test_update_preview_blocks_a_diverged_or_current_checkout(update_sidecar):
    module, http, _, _, (origin, clone, _) = update_sidecar
    _commit(clone, "local.txt", "hotfix", "local only")
    body = (await http.get("/update/preview", headers=AUTH)).json()
    assert body["fast_forward"] is False and any("origin does not" in b for b in body["blockers"])
    _sh(clone, "git", "reset", "-q", "--hard", "origin/master")
    body = (await http.get("/update/preview", headers=AUTH)).json()
    assert body["update_available"] is False and body["blockers"] == ["already up to date"] and body["commits"] == []
    assert (await http.post("/update/apply", headers=AUTH, json={"commit": body["remote"]})).status_code == 409


def test_update_sh_fetches_fast_forwards_and_calls_compose(repos, tmp_path):
    origin, clone, _ = repos
    remote = _sh(origin, "git", "rev-parse", "HEAD")
    before = _sh(clone, "git", "rev-parse", "HEAD")
    # a fake docker on PATH records what compose is asked to do
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    log = tmp_path / "docker.log"
    fake = fake_bin / "docker"
    fake.write_text(f"#!/bin/sh\necho \"$@\" >> {log}\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    env = {"PATH": f"{fake_bin}:{os.environ['PATH']}", "UPDATE_SERVICES": "backend-prod control-plane", "COMPOSE_PROFILE": "prod"}

    out = _sh(clone, "sh", str(UPDATE_SH), "fetch", env=env)
    assert "STEP 1/4" in out and out.endswith("DONE: fetched") and not log.exists()
    assert _sh(clone, "git", "rev-parse", "HEAD") == before

    wrong = subprocess.run(["sh", str(UPDATE_SH), "apply", "f" * 40], cwd=clone, capture_output=True, text=True, env={**os.environ, **env})
    assert wrong.returncode == 3 and "✗ origin/master moved" in wrong.stdout
    assert _sh(clone, "git", "rev-parse", "HEAD") == before

    out = _sh(clone, "sh", str(UPDATE_SH), "apply", remote, env=env)
    assert _sh(clone, "git", "rev-parse", "HEAD") == remote
    assert "STEP 2/4" in out and "STEP 3/4" in out and "STEP 4/4" in out and "DONE: now at" in out
    assert log.read_text().splitlines() == [
        "compose --profile prod build backend-prod control-plane",
        "compose --profile prod up -d --no-deps backend-prod control-plane",
    ]
