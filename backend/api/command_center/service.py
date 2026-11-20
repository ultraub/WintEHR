"""Command Center business logic.

Module of the pluggable-module platform (docs/MODULES.md). Slice 1 is a
read-only status report: every probe runs concurrently under one timeout,
failures become `down` components instead of exceptions, and the report
rolls the components up into one overall state.

Roll-up rule (deliberately simple so the dashboard is predictable):
  - `fhir` down            → overall `down`   (nothing works without the store)
  - any other down/degraded, or any failed router → overall `degraded`
  - `absent` components never count
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from services.hapi_fhir_client import HAPIFHIRClient

from .models import BuildInfo, ComponentStatus, RouterStatus, StatusReport
from .probes import Probe, default_probes
from .settings_service import get_setting

logger = logging.getLogger(__name__)

PROBE_TIMEOUT_SETTING = "system.probe_timeout_seconds"  # live tier; resolved per report

RouterStateReader = Callable[[], Dict[str, Any]]


def read_router_state() -> Dict[str, Any]:
    """What api/routers/__init__.py recorded at startup (local import: no cycle)."""
    from api.routers import DISABLED_MODULES, FAILED_ROUTERS, MODULE_ROUTERS, ROUTERS

    module_router_count = sum(
        len(entries) for key, entries in MODULE_ROUTERS.items() if key not in DISABLED_MODULES
    )
    return {
        "registered": len(ROUTERS) + module_router_count - len(FAILED_ROUTERS),
        "failed": list(FAILED_ROUTERS),
        "disabled_modules": list(DISABLED_MODULES),
        "modules": sorted(MODULE_ROUTERS),
    }


def read_build_info() -> BuildInfo:
    return BuildInfo(
        version=os.getenv("WINTEHR_VERSION"),
        git_commit=os.getenv("WINTEHR_GIT_COMMIT"),
        environment=os.getenv("ENVIRONMENT"),
    )


class CommandCenterService:
    """Status over the deployment's parts (one injected HAPI client)."""

    def __init__(
        self,
        hapi_client: Optional[HAPIFHIRClient] = None,
        probes: Optional[Dict[str, Probe]] = None,
        router_state: RouterStateReader = read_router_state,
        timeout_seconds: Optional[float] = None,
    ):
        self.hapi = hapi_client or HAPIFHIRClient()
        self.probes = probes if probes is not None else default_probes(self.hapi)
        self.router_state = router_state
        # None → read the live-tier setting when the report is built.
        self.timeout_seconds = timeout_seconds

    async def _timeout(self) -> float:
        if self.timeout_seconds is not None:
            return self.timeout_seconds
        return float(await get_setting(PROBE_TIMEOUT_SETTING))

    async def _run_probe(self, name: str, probe: Probe, timeout: float) -> ComponentStatus:
        try:
            result = await asyncio.wait_for(probe(), timeout=timeout)
        except asyncio.TimeoutError:
            return ComponentStatus(name=name, status="down", detail=f"Probe timed out after {timeout:g}s")
        except Exception as exc:  # a probe must never take the report down with it
            logger.warning("Command Center probe %s failed: %s", name, exc)
            return ComponentStatus(name=name, status="down", detail=f"{type(exc).__name__}: {exc}")
        if result.name != name:
            result = result.model_copy(update={"name": name})
        return result

    async def status(self) -> StatusReport:
        timeout = await self._timeout()
        components = list(
            await asyncio.gather(*(self._run_probe(n, p, timeout) for n, p in self.probes.items()))
        )
        routers = RouterStatus(**self.router_state())
        return StatusReport(
            status=roll_up(components, routers),
            checked_at=datetime.now(timezone.utc),
            build=read_build_info(),
            routers=routers,
            components=components,
        )


def roll_up(components: list[ComponentStatus], routers: RouterStatus) -> str:
    by_name = {c.name: c for c in components}
    fhir = by_name.get("fhir")
    if fhir is not None and fhir.status == "down":
        return "down"
    if routers.failed or any(c.status in ("down", "degraded") for c in components):
        return "degraded"
    return "ok"


def get_command_center_service() -> CommandCenterService:
    """FastAPI dependency — one service per request."""
    return CommandCenterService()
