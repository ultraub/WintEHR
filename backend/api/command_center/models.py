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
