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

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, Field

from api.auth.models import User

from .audit import LIMIT_DEFAULT as AUDIT_LIMIT_DEFAULT, AuditClient, default_audit_client
from .jobs_service import JobsError, JobsService, default_jobs_service
from .logs import LEVELS, export_logs, read_logs
from .modules import module_inventory
from .control_plane import ControlPlaneClient, default_control_plane
from .models import (
    AuditResponse,
    ConfigDocument,
    HistoryResponse,
    ConfigImportPlan,
    ConfigImportRequest,
    JobKindView,
    JobLogChunk,
    JobStartRequest,
    JobView,
    LogLine,
    LogsResponse,
    ModulesResponse,
    RoleView,
    RolesResponse,
    SessionsResponse,
    SettingUpdate,
    SettingView,
    UserCreate,
    UserUpdate,
    UserView,
    StatusReport,
    TabPolicyResponse,
)
from .config_transfer import apply_import, export_document, plan_import
from .service import CommandCenterService, get_command_center_service, read_build_info
from .sessions import SessionsService, default_sessions_service
from .status_history import StatusHistoryService, default_status_history
from .users import UsersService
from .settings_service import SettingsError, SettingsService, default_settings_service
from .roles import KNOWN_PERMISSIONS, LOCKED, default_roles, effective_permissions
from .tab_policy import ALWAYS_VISIBLE, ALWAYS_VISIBLE_NAV, EMPTY_POLICY, known_roles

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


@router.get("/status/history", response_model=HistoryResponse)
async def get_status_history(
    hours: int = 24,
    _user: User = Depends(require_admin),
    history: StatusHistoryService = Depends(default_status_history),
):
    """Status samples in the window (1 h to 7 days): uptime per component and incidents."""
    return await history.history(hours)


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


# --- configuration export / import ---------------------------------------------------------


@router.get("/config/export", response_model=ConfigDocument)
async def export_config(
    download: bool = False,
    user: User = Depends(require_admin),
    settings: SettingsService = Depends(get_settings_service),
):
    """Every override (settings, tab policy, roles) as one JSON document. Secrets by key only."""
    document = export_document(await settings.list(), read_build_info(), getattr(user, "id", None))
    if not download:
        return document
    stamp = document.exported_at.strftime("%Y%m%dT%H%M%SZ")
    return Response(content=document.model_dump_json(indent=2), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="wintehr-config-{stamp}.json"'})


@router.post("/config/import", response_model=ConfigImportPlan)
async def import_config(
    body: ConfigImportRequest,
    user: User = Depends(require_system),
    settings: SettingsService = Depends(get_settings_service),
):
    """Preview (default) or apply a configuration document. Unknown keys and secrets are
    skipped; `replace` also resets overrides the file does not mention. Audited as one event."""
    try:
        plan = plan_import(body.document, await settings.list(), settings.definitions, replace=body.replace)
        if body.apply:
            plan = await apply_import(plan, settings, getattr(user, "id", None))
    except SettingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None
    return plan


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
    users_doc = next((v.value for v in await settings.list() if v.key == "auth.users"), None) or {}
    for username, spec in users_doc.items():
        if isinstance(spec, dict) and spec.get("role"):
            defaults.setdefault(spec["role"], {"permissions": [], "users": []})["users"].append(username)
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
        always_visible_nav=list(ALWAYS_VISIBLE_NAV),
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


# --- users ----------------------------------------------------------------------------------


def get_users_service(settings: SettingsService = Depends(get_settings_service)) -> UsersService:
    return UsersService(settings)


@router.get("/users", response_model=List[UserView])
async def list_users(_user: User = Depends(require_admin), users: UsersService = Depends(get_users_service)):
    """Built-in training users plus the custom users in `auth.users`; never a password hash."""
    return await users.list()


@router.post("/users", response_model=UserView, status_code=201)
async def create_user(body: UserCreate, user: User = Depends(require_system), users: UsersService = Depends(get_users_service)):
    """Add a custom login (password stored as a bcrypt hash). Audited `system.user.created`."""
    try:
        return await users.create(body, getattr(user, "id", None))
    except SettingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.put("/users/{username}", response_model=UserView)
async def update_user(username: str, body: UserUpdate, user: User = Depends(require_system), users: UsersService = Depends(get_users_service)):
    """Change a custom user, reset its password, or disable / enable any user (built-ins: disabled only).
    You cannot disable yourself; `admin` can never be disabled. Audited."""
    try:
        return await users.update(username, body, getattr(user, "id", None), acting_username=getattr(user, "username", None))
    except SettingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.delete("/users/{username}", status_code=204)
async def delete_user(username: str, user: User = Depends(require_system), users: UsersService = Depends(get_users_service)):
    """Remove a custom user (built-ins can only be disabled). Their sessions end on the next request. Audited."""
    try:
        await users.delete(username, getattr(user, "id", None), acting_username=getattr(user, "username", None))
    except SettingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None
    return Response(status_code=204)


# --- active sessions -------------------------------------------------------------------


def _bearer(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip() or None
    return None


@router.get("/sessions", response_model=SessionsResponse)
async def list_sessions(
    authorization: Optional[str] = Header(default=None),
    _user: User = Depends(require_admin),
    sessions: SessionsService = Depends(default_sessions_service),
):
    """Every live training / practitioner session (never the tokens), newest first; `current` marks the caller's."""
    return await sessions.list(current_token=_bearer(authorization))


@router.delete("/sessions/{sid}", status_code=200)
async def revoke_session(
    sid: str,
    user: User = Depends(require_system),
    sessions: SessionsService = Depends(default_sessions_service),
):
    """Revoke one session by its id (the digest from the list). Audited. Revoking your own logs you out."""
    removed = await sessions.revoke(sid, getattr(user, "id", None))
    if not removed:
        raise HTTPException(status_code=404, detail="No such session (it may have expired or been revoked already)")
    return {"revoked": removed}


@router.delete("/sessions", status_code=200)
async def revoke_user_sessions(
    user_id: str,
    user: User = Depends(require_system),
    sessions: SessionsService = Depends(default_sessions_service),
):
    """Revoke every session of one user. Audited."""
    return {"revoked": await sessions.revoke_user(user_id, getattr(user, "id", None))}


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


@router.get("/control/update/preview")
async def get_update_preview(_user: User = Depends(require_admin), cp: ControlPlaneClient = Depends(default_control_plane)):
    """Fetch origin (in the sidecar's helper) and list the commits / files / areas an update would bring.
    `can_apply` and `blockers` say whether the fast-forward is possible."""
    return await cp.get("/update/preview", timeout=120.0)


class UpdateApplyRequest(BaseModel):
    commit: str = Field(pattern=r"^[0-9a-f]{40}$")


@router.post("/control/update/apply", status_code=202)
async def apply_update(body: UpdateApplyRequest, user: User = Depends(require_system), cp: ControlPlaneClient = Depends(default_control_plane)):
    """Start the update helper: fast-forward the host checkout to `commit` (which must be origin's tip
    at that moment) and rebuild + recreate the configured services. Images only. Audited."""
    result = await cp.post("/update/apply", json={"commit": body.commit})
    try:
        from api.services.audit_event_service import AuditEventService

        await AuditEventService().log_event(event_type="system.control.update", user_id=getattr(user, "id", None),
                                            action="execute", outcome="success",
                                            details={"from": result.get("from"), "to": result.get("to"), "services": result.get("services"),
                                                     "profile": result.get("profile")})
    except Exception as exc:  # noqa: BLE001 — audit must never block an admin action
        logger.warning("Audit of update apply failed: %s", exc)
    return result


@router.get("/control/update/status")
async def get_update_status(_user: User = Depends(require_admin), cp: ControlPlaneClient = Depends(default_control_plane)):
    """State and log tail of the update helper (survives the backend's own recreation: it is a separate container)."""
    return await cp.get("/update/status")


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
