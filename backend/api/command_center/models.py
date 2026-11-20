"""Command Center response models.

Slice 1 of the Command Center (docs/COMMAND_CENTER.md): a read-only status
report. Every probe answers with one ComponentStatus; the service rolls
them up into a StatusReport. Later slices add settings, jobs, and policy
models here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ComponentState = Literal["ok", "degraded", "down", "absent"]
OverallState = Literal["ok", "degraded", "down"]


class ComponentStatus(BaseModel):
    """One probed part of the deployment.

    status semantics:
      ok       — reachable and doing its job
      degraded — reachable, but something the UI depends on is missing
                 (e.g. terminology index not built)
      down     — expected to be there and is not reachable / errored
      absent   — deliberately not part of this deployment (e.g. no VNA);
                 never counts against the overall status
    """

    name: str
    status: ComponentState
    detail: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


class RouterStatus(BaseModel):
    """What api/routers/__init__.py recorded at startup."""

    registered: int = 0
    failed: List[Dict[str, Any]] = Field(default_factory=list)
    disabled_modules: List[str] = Field(default_factory=list)
    modules: List[str] = Field(default_factory=list)


class BuildInfo(BaseModel):
    version: Optional[str] = None
    git_commit: Optional[str] = None
    environment: Optional[str] = None


class StatusReport(BaseModel):
    status: OverallState
    checked_at: datetime
    build: BuildInfo
    routers: RouterStatus
    components: List[ComponentStatus]


# --- settings (slice 2) -------------------------------------------------------

SettingSource = Literal["database", "environment", "default"]


class SettingView(BaseModel):
    """One setting as the admin sees it. Secrets never carry their value."""

    key: str
    label: str
    description: str
    type: Literal["int", "float", "bool", "str", "secret", "json"]
    tier: Literal["live", "restart", "rebuild"]
    used_by: str
    env_var: Optional[str] = None
    default: Any = None
    value: Any = None
    is_secret: bool = False
    is_set: bool = False
    source: SettingSource
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    # For secrets only: whether the backend can store one (WINTEHR_SETTINGS_KEY set).
    secrets_enabled: Optional[bool] = None


class SettingUpdate(BaseModel):
    value: Any


class RoleView(BaseModel):
    role: str
    permissions: List[str]
    default_permissions: List[str]
    overridden: bool = False
    locked: List[str] = Field(default_factory=list)
    users: List[str] = Field(default_factory=list)


class RolesResponse(BaseModel):
    roles: List[RoleView]
    permissions: List[Dict[str, str]]
    source: SettingSource = "default"
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None


class TabPolicyResponse(BaseModel):
    """Public read model of `ui.tabs.policy` (see tab_policy.py)."""

    policy: Dict[str, Any]
    roles: List[str]
    contexts: List[str] = Field(default_factory=list)
    always_visible: List[str] = Field(default_factory=list)
    source: SettingSource = "default"
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


# --- jobs (slice 3) ----------------------------------------------------------------

JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled", "lost"]


class JobKindView(BaseModel):
    key: str
    label: str
    description: str
    notes: str = ""
    param_schema: Dict[str, Any] = Field(default_factory=dict)
    adds_patients: bool = False
    # Setting keys the job reads (e.g. the UMLS key); the UI can warn when unset.
    required_settings: List[str] = Field(default_factory=list)


class JobStartRequest(BaseModel):
    kind: str
    params: Dict[str, Any] = Field(default_factory=dict)


class JobView(BaseModel):
    id: str
    kind: str
    params: Dict[str, Any]
    status: JobStatus
    progress: Optional[float] = None
    message: Optional[str] = None
    started_by: Optional[str] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    cancel_requested: bool = False
    exit_code: Optional[int] = None
    worker: Optional[str] = None


class JobLogChunk(BaseModel):
    job_id: str
    offset: int
    next_offset: int
    text: str
    finished: bool


# --- backend logs (slice 6) ---------------------------------------------------------

class LogLine(BaseModel):
    ts: datetime
    level: str
    pid: int
    logger: str
    message: str
    file: str


class LogsResponse(BaseModel):
    lines: List[LogLine]
    total: int          # matches before the limit was applied
    files: int          # log files consulted
    levels: List[str]
    truncated: bool


# --- modules (slice 9) ----------------------------------------------------------------

class ModuleView(BaseModel):
    key: str
    source: Literal["builtin", "external"] = "builtin"
    backend_routers: List[str] = Field(default_factory=list)
    disabled: bool = False
    registered: bool = True
    failed: List[Dict[str, str]] = Field(default_factory=list)
    settings: List[str] = Field(default_factory=list)


class ModulesResponse(BaseModel):
    modules: List[ModuleView]
    disabled_backend: List[str]
    how_to: Dict[str, str]
