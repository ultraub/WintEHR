"""Command Center HTTP surface — thin stubs over the module's services.

Registers via MODULE_ROUTERS in api/routers/__init__.py; disable per
deployment with WINTEHR_DISABLED_MODULES=command-center.

Permissions: reads need `admin`; anything that changes the deployment
(settings now, jobs later) needs `system`. Both are plain entries in
User.permissions (api/auth/config.py).
"""

from typing import Any, Dict, List, Optional

import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.auth.models import User

from .audit import LIMIT_DEFAULT as AUDIT_LIMIT_DEFAULT, AuditClient, default_audit_client
from .jobs_service import JobsError, JobsService, default_jobs_service
from .logs import LEVELS, export_logs, read_logs
from .modules import module_inventory
from .control_plane import ControlPlaneClient, default_control_plane
from .models import (
    AuditResponse,
    JobKindView,
    JobLogChunk,
    JobStartRequest,
    JobView,
    LogLine,
    LogsResponse,
    ModulesResponse,
    RoleView,
    RolesResponse,
    SettingUpdate,
    SettingView,
    StatusReport,
    TabPolicyResponse,
)
from .service import CommandCenterService, get_command_center_service
from .settings_service import SettingsError, SettingsService, default_settings_service
from .roles import KNOWN_PERMISSIONS, LOCKED, default_roles, effective_permissions
from .tab_policy import ALWAYS_VISIBLE, EMPTY_POLICY, known_roles

TAB_POLICY_SETTING = "ui.tabs.policy"
ROLES_SETTING = "auth.roles"

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/command-center", tags=["Command Center"])


# The two permission gates live in api/auth/permissions.py so other admin
# surfaces (SMART app registration) use the same ones; re-exported here.
from api.auth.permissions import require_admin, require_system  # noqa: E402,F401


def get_settings_service() -> SettingsService:
    return default_settings_service()


def get_jobs_service() -> JobsService:
    return default_jobs_service()


# --- status ---------------------------------------------------------------------


@router.get("/status", response_model=StatusReport)
async def get_status(
    _user: User = Depends(require_admin),
    service: CommandCenterService = Depends(get_command_center_service),
):
    """Deployment status: routers, FHIR store, database, Redis, terminology index, VNA."""
    return await service.status()


# --- settings -------------------------------------------------------------------


@router.get("/settings", response_model=List[SettingView])
async def list_settings(
    _user: User = Depends(require_admin),
    settings: SettingsService = Depends(get_settings_service),
):
    """Every managed setting with its effective value, source, and tier."""
    return await settings.list()


@router.put("/settings/{key}", response_model=SettingView)
async def update_setting(
    key: str,
    body: SettingUpdate,
    user: User = Depends(require_system),
    settings: SettingsService = Depends(get_settings_service),
):
    """Store an override. Secrets require WINTEHR_SETTINGS_KEY on the backend."""
    try:
        return await settings.set(key, body.value, user.id)
    except SettingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.delete("/settings/{key}", response_model=SettingView)
async def reset_setting(
    key: str,
    user: User = Depends(require_system),
    settings: SettingsService = Depends(get_settings_service),
):
    """Drop the override; the setting falls back to its env var or default."""
    try:
        return await settings.reset(key, user.id)
    except SettingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


# --- roles ----------------------------------------------------------------------------


@router.get("/roles", response_model=RolesResponse)
async def get_roles(
    _user: User = Depends(require_admin),
    settings: SettingsService = Depends(get_settings_service),
):
    """Every role with its default and effective permissions, plus the permission vocabulary."""
    view = next((v for v in await settings.list() if v.key == ROLES_SETTING), None)
    overrides = view.value if view and isinstance(view.value, dict) else {}
    defaults = default_roles()
    names = sorted(set(defaults) | set(overrides))
    roles = []
    for name in names:
        base = defaults.get(name, {"permissions": [], "users": []})
        effective = effective_permissions(name, base["permissions"], overrides)
        roles.append(RoleView(
            role=name, permissions=effective, default_permissions=base["permissions"],
            overridden=name in overrides, locked=LOCKED.get(name, []), users=base["users"],
        ))
    return RolesResponse(
        roles=roles, permissions=KNOWN_PERMISSIONS,
        source=view.source if view else "default",
        updated_by=view.updated_by if view else None, updated_at=view.updated_at if view else None,
    )


# --- tab policy (public read) ------------------------------------------------------


@router.get("/ui-policy", response_model=TabPolicyResponse)
async def get_ui_policy(settings: SettingsService = Depends(get_settings_service)):
    """The chart tab policy every client applies. Not sensitive, so no auth:
    it only says which tabs are hidden for whom, and the workspace needs it
    before the user object is loaded."""
    view = next((v for v in await settings.list() if v.key == TAB_POLICY_SETTING), None)
    policy = view.value if view and isinstance(view.value, dict) else EMPTY_POLICY
    return TabPolicyResponse(
        policy=policy,
        roles=known_roles(),
        contexts=sorted(policy.get("contexts", {}).keys()),
        always_visible=list(ALWAYS_VISIBLE),
        source=view.source if view else "default",
        updated_at=view.updated_at if view else None,
        updated_by=view.updated_by if view else None,
    )


# --- jobs ------------------------------------------------------------------------


@router.get("/jobs/kinds", response_model=List[JobKindView])
async def list_job_kinds(
    _user: User = Depends(require_admin),
    jobs: JobsService = Depends(get_jobs_service),
):
    """The jobs this deployment can run, with their parameter schemas."""
    return jobs.kinds_view()


@router.get("/jobs", response_model=List[JobView])
async def list_jobs(
    limit: int = 50,
    _user: User = Depends(require_admin),
    jobs: JobsService = Depends(get_jobs_service),
):
    """Recent jobs, newest first. Also reconciles jobs whose worker died."""
    return await jobs.list(limit=max(1, min(limit, 500)))


@router.post("/jobs", response_model=JobView, status_code=status.HTTP_202_ACCEPTED)
async def start_job(
    body: JobStartRequest,
    user: User = Depends(require_system),
    jobs: JobsService = Depends(get_jobs_service),
):
    """Start a job. 409 if one is already active or a patient cap would be exceeded."""
    try:
        return await jobs.start(body.kind, body.params, user.id)
    except JobsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.get("/jobs/{job_id}", response_model=JobView)
async def get_job(
    job_id: str,
    _user: User = Depends(require_admin),
    jobs: JobsService = Depends(get_jobs_service),
):
    try:
        return await jobs.get(job_id)
    except JobsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.get("/jobs/{job_id}/log", response_model=JobLogChunk)
async def get_job_log(
    job_id: str,
    offset: int = 0,
    _user: User = Depends(require_admin),
    jobs: JobsService = Depends(get_jobs_service),
):
    """A chunk of the job's log from `offset`; poll with `next_offset` until `finished`."""
    try:
        return await jobs.tail_log(job_id, offset=max(0, offset))
    except JobsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.post("/jobs/{job_id}/cancel", response_model=JobView)
async def cancel_job(
    job_id: str,
    user: User = Depends(require_system),
    jobs: JobsService = Depends(get_jobs_service),
):
    """Request cancellation; the running worker terminates the process at its next heartbeat."""
    try:
        return await jobs.cancel(job_id, user.id)
    except JobsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


# --- backend logs -------------------------------------------------------------------


def _parse_when(value: Optional[str], name: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{name} must be an ISO-8601 timestamp") from None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _log_dir() -> Path:
    from logging_setup import log_dir

    return log_dir()


@router.get("/logs", response_model=LogsResponse)
async def get_backend_logs(
    level: Optional[str] = None,
    q: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    limit: int = 500,
    _user: User = Depends(require_admin),
):
    """The backend's own log lines (every worker), newest last, filtered."""
    if level and level.upper() not in LEVELS:
        raise HTTPException(status_code=400, detail=f"level must be one of {LEVELS}")
    records, total, files = read_logs(
        _log_dir(), level=level, query=q, since=_parse_when(since, "since"), until=_parse_when(until, "until"), limit=limit,
    )
    return LogsResponse(
        lines=[LogLine(ts=r.ts, level=r.level, pid=r.pid, logger=r.logger, message=r.message, file=r.file) for r in records],
        total=total, files=len(files), levels=LEVELS, truncated=total > len(records),
    )


@router.get("/logs/export")
async def export_backend_logs(
    since: Optional[str] = None,
    until: Optional[str] = None,
    level: Optional[str] = None,
    _user: User = Depends(require_admin),
):
    """Plain-text download of the log lines in a time window."""
    start, end = _parse_when(since, "since"), _parse_when(until, "until")
    text = export_logs(_log_dir(), since=start, until=end, level=level)
    stamp = lambda d: d.strftime("%Y%m%dT%H%M%SZ") if d else "all"  # noqa: E731
    filename = f"wintehr-backend-logs-{stamp(start)}-{stamp(end)}.txt"
    return Response(content=text, media_type="text/plain", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# --- modules ----------------------------------------------------------------------------


@router.get("/modules", response_model=ModulesResponse)
async def get_modules(_user: User = Depends(require_admin)):
    """Every pluggable module the backend knows: routers, status, source, declared settings."""
    from api.routers import DISABLED_MODULES

    return ModulesResponse(
        modules=module_inventory(),
        disabled_backend=list(DISABLED_MODULES),
        how_to={
            "backend": "Set WINTEHR_DISABLED_MODULES=<key>,<key> in .env and restart emr-backend (restart tier).",
            "frontend": "Set REACT_APP_DISABLED_MODULES=<key>,<key> in .env and rebuild the frontend image (rebuild tier).",
            "external": "List the module in wintehr.modules.json and run scripts/sync-modules.py, then rebuild (docs/MODULES.md).",
        },
    )


# --- audit trail ---------------------------------------------------------------------------


@router.get("/audit", response_model=AuditResponse)
async def get_audit(
    since: Optional[str] = None,
    until: Optional[str] = None,
    event_type: Optional[str] = None,
    category: Optional[str] = None,
    user: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = AUDIT_LIMIT_DEFAULT,
    _user: User = Depends(require_admin),
    audit: AuditClient = Depends(default_audit_client),
):
    """FHIR AuditEvents newest first: who changed what, logins, restarts. Window and
    event type filter in HAPI; user / category / text filter within the fetched page."""
    return await audit.read(since=_parse_when(since, "since"), until=_parse_when(until, "until"),
                            event_type=event_type, category=category, user=user, query=q, limit=limit)


# --- control plane (sidecar) -------------------------------------------------------------


@router.get("/control")
async def get_control(_user: User = Depends(require_admin), cp: ControlPlaneClient = Depends(default_control_plane)):
    """Container states from the sidecar; `configured=False` when the sidecar is not set up."""
    if not cp.configured:
        return {"configured": False, "reachable": False, "containers": [], "error": None,
                "how_to": "Set CONTROL_PLANE_TOKEN in .env (any long random string) and start the control-plane service; the backend reads CONTROL_PLANE_URL from compose."}
    try:
        body = await cp.get("/containers")
    except HTTPException as exc:
        return {"configured": True, "reachable": False, "containers": [], "error": exc.detail, "how_to": None}
    return {"configured": True, "reachable": True, "containers": body["containers"], "checked_at": body.get("checked_at"), "error": None, "how_to": None}


@router.get("/control/containers/{name}/logs")
async def get_container_logs(name: str, tail: int = 200, since: Optional[int] = None,
                             _user: User = Depends(require_admin), cp: ControlPlaneClient = Depends(default_control_plane)):
    params: Dict[str, Any] = {"tail": max(1, min(tail, 5000))}
    if since:
        params["since"] = since
    return await cp.get(f"/containers/{name}/logs", params)


@router.post("/control/containers/{name}/restart", status_code=202)
async def restart_container(name: str, user: User = Depends(require_system), cp: ControlPlaneClient = Depends(default_control_plane)):
    """Restart one of the sidecar's restartable containers. Audited."""
    body = await cp.post(f"/containers/{name}/restart")
    try:
        from api.services.audit_event_service import AuditEventService

        await AuditEventService().log_event(event_type="system.control.restart", user_id=getattr(user, "id", None),
                                            action="execute", outcome="success", details={"container": name})
    except Exception as exc:  # noqa: BLE001 — audit must never block an admin action
        logger.warning("Audit of container restart failed: %s", exc)
    return body


@router.get("/control/update-check")
async def get_update_check(_user: User = Depends(require_admin), cp: ControlPlaneClient = Depends(default_control_plane)):
    return await cp.get("/update-check")


@router.get("/control/config")
async def get_control_config(_user: User = Depends(require_admin), cp: ControlPlaneClient = Depends(default_control_plane)):
    """Rendered nginx.conf, docker-compose.yml, and .env variable NAMES (never values)."""
    return await cp.get("/config")


@router.get("/control/host")
async def get_control_host(df: bool = False, _user: User = Depends(require_admin), cp: ControlPlaneClient = Depends(default_control_plane)):
    """Disk / memory / load from the sidecar; `df=true` adds docker image / volume / cache bytes (slow)."""
    return await cp.get("/host", {"df": "1"} if df else None)


@router.get("/control/certificates")
async def get_control_certificates(_user: User = Depends(require_admin), cp: ControlPlaneClient = Depends(default_control_plane)):
    """Expiry / issuer of every certificate under certbot/conf/live (never the keys)."""
    return await cp.get("/certificates")
