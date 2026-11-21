"""WintEHR control-plane sidecar (Command Center slice 10).

The one container that holds the Docker socket. It exposes a small,
allow-listed API on the compose network only, authenticated with a shared
token, and the backend proxies it under /api/command-center/control/....

Why a sidecar: mounting the socket into the backend would make a demo-auth
web app root on the host. This process does a handful of read-only things plus one
restart, and nothing an attacker could extend into a shell:

  GET  /containers                     state of the allow-listed containers
  GET  /containers/{name}/logs         docker logs tail of one of them
  POST /containers/{name}/restart      restart one of the restartable ones
  GET  /update-check                   local HEAD vs origin (git ls-remote; never writes)
  GET  /config                         rendered nginx.conf, docker-compose.yml, .env KEY NAMES only
  GET  /host                           disk free on the repo's filesystem, memory, load (+ docker df on request)
  GET  /certificates                   expiry / issuer of every cert under certbot/conf/live (openssl x509)
  GET  /update/preview                 fetch origin (in a helper), then the commits / files / areas between HEAD and origin
  POST /update/apply {commit}          start the update helper: fast-forward to <commit>, compose build + up -d
  GET  /update/status                  the helper's state and log tail

Container names come from CONTROL_PLANE_CONTAINERS / CONTROL_PLANE_RESTARTABLE,
not from the request. Nothing here takes a free-form command, path, or
image name; the update takes a 40-hex commit that must equal origin/<branch>.

The repo is mounted read-only here. Anything that writes to it (git fetch,
the fast-forward, the image builds) runs in a HELPER CONTAINER (update.sh)
started from this same image with the host's repo path bind-mounted
read-write at the same path, the socket, and the repo owner's uid — so the
sidecar can recreate itself without dying mid-update, and nothing in .git
becomes root-owned.
"""

from __future__ import annotations

import asyncio
import hmac
import logging
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query

logger = logging.getLogger("control-plane")

TOKEN = os.getenv("CONTROL_PLANE_TOKEN", "")
DOCKER_SOCKET = os.getenv("DOCKER_SOCKET", "/var/run/docker.sock")
REPO = Path(os.getenv("CONTROL_PLANE_REPO", "/repo"))
DEFAULT_CONTAINERS = "emr-backend,emr-frontend,emr-nginx,emr-hapi-fhir,emr-postgres,emr-redis,emr-certbot,vna-arc,vna-db,vna-ldap"
DEFAULT_RESTARTABLE = "emr-backend,emr-frontend,emr-nginx,emr-hapi-fhir,emr-redis,emr-certbot"
MAX_TAIL = 5000


def _csv(name: str, default: str) -> List[str]:
    return [x.strip() for x in os.getenv(name, default).split(",") if x.strip()]


CONTAINERS = _csv("CONTROL_PLANE_CONTAINERS", DEFAULT_CONTAINERS)
RESTARTABLE = [c for c in _csv("CONTROL_PLANE_RESTARTABLE", DEFAULT_RESTARTABLE) if c in CONTAINERS]
COMPOSE_PROFILE = os.getenv("CONTROL_PLANE_COMPOSE_PROFILE", "prod")
UPDATE_SERVICES = _csv("CONTROL_PLANE_UPDATE_SERVICES", "backend-prod,frontend-prod,control-plane")
SELF_ID = os.getenv("CONTROL_PLANE_SELF", os.getenv("HOSTNAME", ""))  # docker sets HOSTNAME to the container id
UPDATER = "emr-updater"
FETCHER = "emr-updater-fetch"

app = FastAPI(title="WintEHR control plane", docs_url=None, redoc_url=None, openapi_url=None)


# --- auth -------------------------------------------------------------------------------


def require_token(authorization: Optional[str] = Header(default=None)) -> None:
    if not TOKEN:
        raise HTTPException(status_code=503, detail="CONTROL_PLANE_TOKEN is not set; the sidecar refuses every request")
    presented = authorization.split(" ", 1)[1].strip() if authorization and authorization.lower().startswith("bearer ") else ""
    if not presented or not hmac.compare_digest(presented, TOKEN):
        raise HTTPException(status_code=401, detail="Bad control-plane token")


# --- docker engine over the unix socket -----------------------------------------------------


def docker_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.AsyncHTTPTransport(uds=DOCKER_SOCKET), base_url="http://docker", timeout=30.0)


_HEALTH = re.compile(r"\((healthy|unhealthy|health: starting)\)")


def _allowed(name: str) -> str:
    if name not in CONTAINERS:
        raise HTTPException(status_code=404, detail=f"{name!r} is not an allow-listed container")
    return name


def demux(payload: bytes) -> str:
    """Docker's multiplexed log stream (8-byte frame headers) → plain text; TTY logs pass through."""
    if len(payload) < 8 or payload[0] not in (0, 1, 2) or payload[1:4] != b"\x00\x00\x00":
        return payload.decode("utf-8", errors="replace")
    out: List[bytes] = []
    i = 0
    while i + 8 <= len(payload):
        size = int.from_bytes(payload[i + 4:i + 8], "big")
        out.append(payload[i + 8:i + 8 + size])
        i += 8 + size
    return b"".join(out).decode("utf-8", errors="replace")


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "configured": bool(TOKEN), "containers": CONTAINERS, "restartable": RESTARTABLE}


@app.get("/containers", dependencies=[Depends(require_token)])
async def containers() -> Dict[str, Any]:
    async with docker_client() as client:
        resp = await client.get("/containers/json", params={"all": "true"})
    resp.raise_for_status()
    by_name = {}
    for c in resp.json():
        for raw in c.get("Names", []):
            by_name[raw.lstrip("/")] = c
    rows = []
    for name in CONTAINERS:
        c = by_name.get(name)
        if c is None:
            rows.append({"name": name, "present": False, "state": "absent", "status": "", "health": None, "image": None, "id": None, "restartable": False})
            continue
        m = _HEALTH.search(c.get("Status", ""))
        rows.append({
            "name": name, "present": True, "state": c.get("State"), "status": c.get("Status", ""),
            "health": m.group(1) if m else None, "image": c.get("Image"), "id": (c.get("Id") or "")[:12],
            "created": c.get("Created"), "restartable": name in RESTARTABLE,
        })
    return {"containers": rows, "checked_at": datetime.now(timezone.utc).isoformat()}


@app.get("/containers/{name}/logs", dependencies=[Depends(require_token)])
async def container_logs(name: str, tail: int = Query(200, ge=1, le=MAX_TAIL), since: Optional[int] = Query(None, ge=0)) -> Dict[str, Any]:
    _allowed(name)
    params = {"stdout": "true", "stderr": "true", "timestamps": "true", "tail": str(tail)}
    if since:
        params["since"] = str(since)
    async with docker_client() as client:
        resp = await client.get(f"/containers/{name}/logs", params=params)
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail=f"container {name} is not running on this host")
    resp.raise_for_status()
    text = demux(resp.content)
    lines = text.splitlines()
    return {"name": name, "tail": tail, "lines": lines, "truncated": len(lines) >= tail}


async def _restart(name: str) -> None:
    try:
        async with docker_client() as client:
            resp = await client.post(f"/containers/{name}/restart", params={"t": "10"}, timeout=60.0)
        logger.info("restart %s → %s", name, resp.status_code)
    except Exception as exc:  # noqa: BLE001
        logger.error("restart %s failed: %s", name, exc)


@app.post("/containers/{name}/restart", dependencies=[Depends(require_token)], status_code=202)
async def restart_container(name: str, background: BackgroundTasks) -> Dict[str, Any]:
    _allowed(name)
    if name not in RESTARTABLE:
        raise HTTPException(status_code=403, detail=f"{name} is not restartable from the Command Center")
    # Run after the response: restarting emr-backend kills the caller's own proxied request otherwise.
    background.add_task(_restart, name)
    return {"accepted": True, "name": name}


# --- git / config, read-only ---------------------------------------------------------------

_GIT_ENV = {**os.environ, "GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "safe.directory", "GIT_CONFIG_VALUE_0": "*", "GIT_TERMINAL_PROMPT": "0"}


def _git(*args: str, timeout: int = 20) -> str:
    result = subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True, timeout=timeout, env=_GIT_ENV)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout).strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def update_check() -> Dict[str, Any]:
    out: Dict[str, Any] = {"repo": str(REPO), "checked_at": datetime.now(timezone.utc).isoformat(), "error": None,
                           "branch": None, "local": None, "remote": None, "update_available": None}
    try:
        out["branch"] = _git("rev-parse", "--abbrev-ref", "HEAD")
        out["local"] = _git("rev-parse", "HEAD")
        out["local_subject"] = _git("log", "-1", "--format=%s (%ci)")
    except Exception as exc:  # noqa: BLE001
        out["error"] = f"local checkout: {exc}"
        return out
    try:
        if out["branch"] == "HEAD":
            raise RuntimeError("detached HEAD; nothing to compare against")
        listing = _git("ls-remote", "--heads", "origin", out["branch"], timeout=25)
        remote = listing.split()[0] if listing else None
        out["remote"] = remote
        out["update_available"] = bool(remote) and remote != out["local"]
        if remote is None:
            out["error"] = f"origin has no branch {out['branch']!r}"
    except Exception as exc:  # noqa: BLE001
        out["error"] = f"origin: {exc}"
    return out


@app.get("/update-check", dependencies=[Depends(require_token)])
async def get_update_check() -> Dict[str, Any]:
    return await asyncio.to_thread(update_check)


def _read(path: Path, limit: int = 512 * 1024) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8", errors="replace")[:limit]
    except OSError:
        return None


_ENV_KEY = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=")


def env_key_names(text: Optional[str]) -> List[str]:
    """Only the variable NAMES from a .env file; values never leave the sidecar."""
    if not text:
        return []
    names = []
    for line in text.splitlines():
        m = _ENV_KEY.match(line)
        if m and m.group(1) not in names:
            names.append(m.group(1))
    return names


def config_view() -> Dict[str, Any]:
    return {
        "nginx": _read(REPO / "deploy" / "rendered" / "nginx.conf"),
        "nginx_path": "deploy/rendered/nginx.conf",
        "compose": _read(REPO / "docker-compose.yml"),
        "env_keys": env_key_names(_read(REPO / ".env")),
    }


@app.get("/config", dependencies=[Depends(require_token)])
async def get_config() -> Dict[str, Any]:
    return await asyncio.to_thread(config_view)


# --- host and certificates, read-only --------------------------------------------------------


def _meminfo() -> Dict[str, int]:
    """MemTotal / MemAvailable in bytes from /proc/meminfo (host-wide: not namespaced)."""
    out: Dict[str, int] = {}
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, _, rest = line.partition(":")
            if key in ("MemTotal", "MemAvailable"):
                out[key] = int(rest.split()[0]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return out


def host_view() -> Dict[str, Any]:
    """Disk is measured on the repo bind mount: that is where data/, logs/, the
    DICOM store and the terminology work dir live, i.e. the disk that fills up."""
    target = REPO if REPO.exists() else Path("/")
    usage = shutil.disk_usage(target)
    mem = _meminfo()
    try:
        load = list(os.getloadavg())
    except OSError:
        load = []
    return {
        "disk": {"path": str(target), "total": usage.total, "used": usage.used, "free": usage.free},
        "memory": {"total": mem.get("MemTotal"), "available": mem.get("MemAvailable")},
        "load": load,
        "cpus": os.cpu_count(),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


async def docker_df() -> Dict[str, Any]:
    """Image / container / volume / build-cache bytes from the engine. Can take
    seconds on a busy host, so it is opt-in (`?df=1`), not part of the status probe."""
    async with docker_client() as client:
        resp = await client.get("/system/df", timeout=60.0)
    resp.raise_for_status()
    body = resp.json()
    images = sum(int(i.get("Size") or 0) for i in body.get("Images") or [])
    containers = sum(int(c.get("SizeRw") or 0) for c in body.get("Containers") or [])
    volumes = sum(int(((v.get("UsageData") or {}).get("Size") or 0)) for v in body.get("Volumes") or [])
    cache = sum(int(b.get("Size") or 0) for b in body.get("BuildCache") or [])
    return {"images": images, "containers": containers, "volumes": volumes, "build_cache": cache}


@app.get("/host", dependencies=[Depends(require_token)])
async def get_host(df: bool = Query(False)) -> Dict[str, Any]:
    body = await asyncio.to_thread(host_view)
    if df:
        try:
            body["docker"] = await docker_df()
        except Exception as exc:  # noqa: BLE001
            body["docker"] = {"error": f"{type(exc).__name__}: {exc}"}
    return body


_X509_DATE = "%b %d %H:%M:%S %Y %Z"


def cert_info(domain: str, pem: Path) -> Dict[str, Any]:
    """What `openssl x509` says about one fullchain.pem; never the key, never the body."""
    info: Dict[str, Any] = {"domain": domain, "path": str(pem), "subject": None, "issuer": None,
                            "not_before": None, "not_after": None, "days_left": None, "self_signed": None, "error": None}
    try:
        result = subprocess.run(
            ["openssl", "x509", "-noout", "-subject", "-issuer", "-startdate", "-enddate", "-in", str(pem)],
            capture_output=True, text=True, timeout=10,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        info["error"] = f"openssl: {exc}"
        return info
    if result.returncode != 0:
        info["error"] = (result.stderr or result.stdout).strip().splitlines()[-1:] or ["openssl x509 failed"]
        info["error"] = info["error"][0]
        return info
    fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    info["subject"] = (fields.get("subject") or "").strip()
    info["issuer"] = (fields.get("issuer") or "").strip()
    info["self_signed"] = bool(info["subject"]) and info["subject"] == info["issuer"]
    now = datetime.now(timezone.utc)
    for key, field in (("not_before", "notBefore"), ("not_after", "notAfter")):
        raw = (fields.get(field) or "").strip()
        try:
            when = datetime.strptime(raw, _X509_DATE).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        info[key] = when.isoformat()
        if key == "not_after":
            info["days_left"] = (when - now).total_seconds() / 86400
    return info


def certificates_view() -> Dict[str, Any]:
    live = REPO / "certbot" / "conf" / "live"
    certs: List[Dict[str, Any]] = []
    if live.is_dir():
        for entry in sorted(live.iterdir()):
            pem = entry / "fullchain.pem"
            if entry.is_dir() and pem.is_file():
                certs.append(cert_info(entry.name, pem))
    return {"certificates": certs, "path": "certbot/conf/live", "checked_at": datetime.now(timezone.utc).isoformat()}


@app.get("/certificates", dependencies=[Depends(require_token)])
async def get_certificates() -> Dict[str, Any]:
    return await asyncio.to_thread(certificates_view)


# --- confirmed update-apply ---------------------------------------------------------------------

_SHA = re.compile(r"^[0-9a-f]{40}$")
_AREAS = (("backend/", "backend"), ("frontend/", "frontend"), ("control-plane/", "control-plane"),
          ("docker-compose", "deploy"), ("deploy/", "deploy"), ("deploy.sh", "deploy"), ("nginx", "deploy"))


def _area(path: str) -> str:
    for prefix, area in _AREAS:
        if path.startswith(prefix):
            return area
    return "other"


def _git_ok(*args: str) -> bool:
    """A git predicate (exit 0 / 1), e.g. merge-base --is-ancestor."""
    return subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True, timeout=20, env=_GIT_ENV).returncode == 0


async def self_inspect(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Where the host keeps the repo and the socket, and which image this is —
    read from this container's own inspect so the helper needs no extra env."""
    resp = await client.get(f"/containers/{SELF_ID}/json")
    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail=f"cannot inspect the sidecar container ({SELF_ID!r}): is HOSTNAME the container id?")
    info = resp.json()
    mounts = {m.get("Destination"): m.get("Source") for m in info.get("Mounts") or []}
    host_repo, host_sock = mounts.get(str(REPO)), mounts.get(DOCKER_SOCKET)
    if not host_repo or not host_sock:
        raise HTTPException(status_code=503, detail="the sidecar needs the repo and the docker socket bind-mounted to start an update helper")
    labels = (info.get("Config") or {}).get("Labels") or {}
    return {"image": info.get("Image"), "host_repo": host_repo, "host_sock": host_sock,
            "project": labels.get("com.docker.compose.project")}


def _repo_owner() -> str:
    st = os.stat(REPO)
    return f"{st.st_uid}:{st.st_gid}"


def _socket_gid() -> Optional[str]:
    try:
        return str(os.stat(DOCKER_SOCKET).st_gid)
    except OSError:
        return None


def helper_spec(self_info: Dict[str, Any], mode: str, commit: Optional[str]) -> Dict[str, Any]:
    """The docker create body for one helper run. Pure, so tests can read it."""
    env = ["HOME=/tmp", "DOCKER_CONFIG=/tmp/.docker", "GIT_TERMINAL_PROMPT=0",
           f"COMPOSE_PROFILE={COMPOSE_PROFILE}", f"UPDATE_SERVICES={' '.join(UPDATE_SERVICES)}"]
    if self_info.get("project"):
        env.append(f"COMPOSE_PROJECT_NAME={self_info['project']}")
    cmd = ["/srv/update.sh", mode] + ([commit] if commit else [])
    host_config: Dict[str, Any] = {
        "Binds": [f"{self_info['host_repo']}:{self_info['host_repo']}", f"{self_info['host_sock']}:{DOCKER_SOCKET}"],
        "AutoRemove": False,
    }
    gid = _socket_gid()
    if gid:
        host_config["GroupAdd"] = [gid]
    return {"Image": self_info["image"], "Cmd": cmd, "WorkingDir": self_info["host_repo"], "User": _repo_owner(), "Env": env,
            "Labels": {"wintehr.updater": mode, "wintehr.updater.commit": commit or ""}, "HostConfig": host_config}


async def _remove(client: httpx.AsyncClient, name: str, force: bool = False) -> None:
    await client.delete(f"/containers/{name}", params={"force": "true" if force else "false"})


async def _start_helper(client: httpx.AsyncClient, name: str, mode: str, commit: Optional[str]) -> str:
    info = await self_inspect(client)
    resp = await client.post("/containers/create", params={"name": name}, json=helper_spec(info, mode, commit))
    if resp.status_code == 409:
        raise HTTPException(status_code=409, detail=f"{name} already exists; an update is running or its result has not been read")
    if resp.status_code >= 400:
        raise HTTPException(status_code=503, detail=f"docker refused to create {name}: {resp.text[:300]}")
    cid = resp.json()["Id"]
    started = await client.post(f"/containers/{cid}/start")
    if started.status_code >= 400:
        await _remove(client, cid, force=True)
        raise HTTPException(status_code=503, detail=f"docker refused to start {name}: {started.text[:300]}")
    return cid


async def _helper_logs(client: httpx.AsyncClient, name: str, tail: int = 200) -> List[str]:
    resp = await client.get(f"/containers/{name}/logs", params={"stdout": "true", "stderr": "true", "tail": str(tail)})
    return demux(resp.content).splitlines() if resp.status_code == 200 else []


async def run_fetch(client: httpx.AsyncClient, timeout: float = 90.0) -> List[str]:
    """`git fetch` in a throw-away helper (the repo is read-only here); returns its log."""
    await _remove(client, FETCHER, force=True)
    cid = await _start_helper(client, FETCHER, "fetch", None)
    try:
        waited = await client.post(f"/containers/{cid}/wait", timeout=timeout)
        lines = await _helper_logs(client, cid)
        code = (waited.json() or {}).get("StatusCode", 1) if waited.status_code == 200 else 1
        if code != 0:
            raise HTTPException(status_code=502, detail="git fetch failed: " + (lines[-1] if lines else f"exit {code}"))
        return lines
    finally:
        await _remove(client, cid, force=True)


def update_diff() -> Dict[str, Any]:
    """HEAD vs origin/<branch> after a fetch: commits, files by area, dirty files, fast-forwardable?"""
    out: Dict[str, Any] = {"branch": None, "local": None, "remote": None, "commits": [], "files": 0, "areas": {},
                           "insertions": 0, "deletions": 0, "dirty": [], "fast_forward": None, "update_available": None, "error": None}
    try:
        out["branch"] = branch = _git("rev-parse", "--abbrev-ref", "HEAD")
        out["local"] = _git("rev-parse", "HEAD")
        out["local_subject"] = _git("log", "-1", "--format=%s (%ci)")
        if branch == "HEAD":
            out["error"] = "detached HEAD; check out a branch on the host first"
            return out
        out["remote"] = remote = _git("rev-parse", f"origin/{branch}")
        rng = f"HEAD..origin/{branch}"
        log = _git("log", "--max-count=100", "--format=%H%x1f%an%x1f%cI%x1f%s", rng)
        for line in log.splitlines():
            sha, author, date, subject = (line.split("\x1f") + ["", "", "", ""])[:4]
            out["commits"].append({"sha": sha, "author": author, "date": date, "subject": subject})
        files = [f for f in _git("diff", "--name-only", rng).splitlines() if f]
        out["files"] = len(files)
        for f in files:
            out["areas"][_area(f)] = out["areas"].get(_area(f), 0) + 1
        m = re.search(r"(\d+) insertions?", _git("diff", "--shortstat", rng) or "")
        out["insertions"] = int(m.group(1)) if m else 0
        m = re.search(r"(\d+) deletions?", _git("diff", "--shortstat", rng) or "")
        out["deletions"] = int(m.group(1)) if m else 0
        out["dirty"] = [f for f in _git("diff-index", "--name-only", "HEAD", "--").splitlines() if f]
        out["update_available"] = remote != out["local"]
        out["fast_forward"] = _git_ok("merge-base", "--is-ancestor", "HEAD", remote)
    except Exception as exc:  # noqa: BLE001
        out["error"] = str(exc)
    return out


def _blockers(diff: Dict[str, Any], updater: Dict[str, Any]) -> List[str]:
    reasons = []
    if diff.get("error"):
        reasons.append(diff["error"])
    if diff.get("update_available") is False:
        reasons.append("already up to date")
    if diff.get("fast_forward") is False:
        reasons.append("the host checkout has commits origin does not; resolve on the host")
    changed = set()
    if diff.get("dirty"):
        changed = set(_git("diff", "--name-only", f"HEAD..origin/{diff['branch']}").splitlines()) if diff.get("branch") else set()
        clash = sorted(set(diff["dirty"]) & changed)
        if clash:
            reasons.append(f"local modifications would be overwritten: {', '.join(clash[:5])}")
    if updater.get("running"):
        reasons.append("an update is already running")
    return reasons


async def updater_status(client: httpx.AsyncClient) -> Dict[str, Any]:
    resp = await client.get(f"/containers/{UPDATER}/json")
    if resp.status_code != 200:
        return {"present": False, "running": False}
    info = resp.json()
    state = info.get("State") or {}
    labels = (info.get("Config") or {}).get("Labels") or {}
    lines = await _helper_logs(client, UPDATER)
    running = bool(state.get("Running"))
    exit_code = state.get("ExitCode") if not running else None
    return {"present": True, "running": running, "exit_code": exit_code,
            "succeeded": (exit_code == 0) if not running else None,
            "started_at": state.get("StartedAt"), "finished_at": state.get("FinishedAt") if not running else None,
            "commit": labels.get("wintehr.updater.commit") or None, "lines": lines,
            "message": next((l for l in reversed(lines) if l.startswith(("STEP", "DONE", "✗"))), None)}


@app.get("/update/preview", dependencies=[Depends(require_token)])
async def get_update_preview() -> Dict[str, Any]:
    async with docker_client() as client:
        status = await updater_status(client)
        if status.get("running"):
            diff = await asyncio.to_thread(update_diff)   # no fetch while an update runs
        else:
            await run_fetch(client)
            diff = await asyncio.to_thread(update_diff)
    blockers = await asyncio.to_thread(_blockers, diff, status)
    return {**diff, "profile": COMPOSE_PROFILE, "services": UPDATE_SERVICES, "blockers": blockers, "can_apply": not blockers,
            "updater": status, "checked_at": datetime.now(timezone.utc).isoformat()}


@app.post("/update/apply", dependencies=[Depends(require_token)], status_code=202)
async def post_update_apply(body: Dict[str, Any]) -> Dict[str, Any]:
    commit = str((body or {}).get("commit") or "").strip().lower()
    if not _SHA.match(commit):
        raise HTTPException(status_code=400, detail="commit must be the 40-hex sha the preview reported")
    diff = await asyncio.to_thread(update_diff)
    async with docker_client() as client:
        status = await updater_status(client)
        blockers = await asyncio.to_thread(_blockers, diff, status)
        if blockers:
            raise HTTPException(status_code=409, detail="; ".join(blockers))
        if diff.get("remote") != commit:
            raise HTTPException(status_code=409, detail=f"origin/{diff.get('branch')} is at {diff.get('remote')}, not {commit}; preview again")
        if status.get("present"):
            await _remove(client, UPDATER, force=True)   # the previous run's result has been superseded
        cid = await _start_helper(client, UPDATER, "apply", commit)
    return {"accepted": True, "updater": cid[:12], "from": diff.get("local"), "to": commit,
            "services": UPDATE_SERVICES, "profile": COMPOSE_PROFILE}


@app.get("/update/status", dependencies=[Depends(require_token)])
async def get_update_status() -> Dict[str, Any]:
    async with docker_client() as client:
        return {**(await updater_status(client)), "checked_at": datetime.now(timezone.utc).isoformat()}
