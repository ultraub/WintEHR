"""Module inventory for the Command Center (slice 9).

What the backend knows about each pluggable module: its routers, whether
they registered, whether the deployment disabled it, where it came from
(builtin or vendored by scripts/sync-modules.py), and the settings it
declared. The frontend half (tabs, pages, sections, slots, permissions)
comes from the manifests in the bundle; the Modules tab joins the two by
module key.

Read-only on purpose: enabling or disabling is a deploy-time decision
(`WINTEHR_DISABLED_MODULES` → restart, `REACT_APP_DISABLED_MODULES` →
rebuild) and the tab says exactly that, with the lines to set.
"""

from __future__ import annotations

from typing import Any, Dict, List

from .models import ModuleView


def module_inventory() -> List[ModuleView]:
    from api.routers import DISABLED_MODULES, FAILED_ROUTERS, MODULE_ROUTERS
    from api.routers.modules_generated import EXTERNAL_MODULE_ROUTERS

    from .module_settings import MODULE_SETTINGS

    failed_by_name: Dict[str, Dict[str, Any]] = {f["router"]: f for f in FAILED_ROUTERS}
    views: List[ModuleView] = []
    for key, entries in MODULE_ROUTERS.items():
        router_names = [name for name, _path, _attr, _kwargs in entries]
        failures = [failed_by_name[n] for n in router_names if n in failed_by_name]
        disabled = key in DISABLED_MODULES
        views.append(ModuleView(
            key=key,
            source="external" if key in EXTERNAL_MODULE_ROUTERS else "builtin",
            backend_routers=router_names,
            disabled=disabled,
            registered=not disabled and not failures,
            failed=[{"router": f["router"], "error": f.get("error", "")} for f in failures],
            settings=list(MODULE_SETTINGS.get(key, [])),
        ))
    return sorted(views, key=lambda v: v.key)
