"""Configuration export / import (slice 13).

One JSON document carries every override an admin has made in the Command
Center: plain settings, the chart tab policy (`ui.tabs.policy`) and the
role overrides (`auth.roles`) are all settings, so the document is simply
the `database`-sourced settings with their values. Secrets are listed by
key only (`secrets_set`); their values never leave the backend.

Import is a two-step: `plan_import()` is pure and says, key by key, what
would happen (set / unchanged / reset / skip with a reason) so the UI can
show a preview; `apply_import()` runs the plan through the ordinary
SettingsService writes, so every change is validated, cached, versioned
and audited exactly like a save on the Settings tab.

Unknown keys are skipped, not refused: a document exported from a build
with a module this deployment lacks must still import the rest.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from .models import BuildInfo, ConfigDocument, ConfigImportItem, ConfigImportPlan, SettingView
from .settings_registry import SettingDefinition, SettingValueError
from .settings_service import SettingsError, SettingsService

FORMAT_VERSION = 1


def export_document(views: Iterable[SettingView], build: BuildInfo, exported_by: Optional[str]) -> ConfigDocument:
    """The overrides (database-sourced, non-secret) plus the keys of the secrets that are set."""
    settings: Dict[str, Any] = {}
    secrets_set: List[str] = []
    for view in views:
        if view.is_secret:
            if view.is_set:
                secrets_set.append(view.key)
            continue
        if view.source == "database":
            settings[view.key] = view.value
    return ConfigDocument(
        wintehr_config=FORMAT_VERSION,
        exported_at=datetime.now(timezone.utc),
        exported_by=exported_by,
        source=build,
        settings=settings,
        secrets_set=sorted(secrets_set),
    )


def plan_import(
    document: Dict[str, Any],
    views: Iterable[SettingView],
    definitions: Dict[str, SettingDefinition],
    replace: bool = False,
) -> ConfigImportPlan:
    """What importing `document` would change. Pure: no writes, no I/O.

    replace=True also resets every current override the document does not
    mention, so the deployment ends up exactly as the file describes.
    """
    if not isinstance(document, dict):
        raise SettingsError(400, "config document must be a JSON object")
    version = document.get("wintehr_config")
    if version != FORMAT_VERSION:
        raise SettingsError(400, f"config document: expected wintehr_config {FORMAT_VERSION}, got {version!r}")
    incoming = document.get("settings")
    if not isinstance(incoming, dict):
        raise SettingsError(400, "config document: 'settings' must be an object keyed by setting key")

    current = {v.key: v for v in views}
    items: List[ConfigImportItem] = []
    for key, raw in incoming.items():
        definition = definitions.get(key)
        if definition is None:
            items.append(ConfigImportItem(key=key, action="skip", incoming=raw, reason="unknown setting on this deployment"))
            continue
        if definition.is_secret:
            items.append(ConfigImportItem(key=key, action="skip", reason="secrets are never imported from a file"))
            continue
        try:
            value = definition.parse(raw)
        except SettingValueError as exc:
            items.append(ConfigImportItem(key=key, action="skip", incoming=raw, reason=str(exc)))
            continue
        view = current.get(key)
        if view is not None and view.source == "database" and view.value == value:
            items.append(ConfigImportItem(key=key, action="unchanged", current=view.value, incoming=value, tier=definition.tier))
        else:
            items.append(ConfigImportItem(key=key, action="set", current=view.value if view else None, incoming=value, tier=definition.tier,
                                          current_source=view.source if view else None))
    if replace:
        for key, view in current.items():
            if view.source == "database" and not view.is_secret and key not in incoming:
                items.append(ConfigImportItem(key=key, action="reset", current=view.value, tier=view.tier, current_source="database",
                                              reason="not in the file (replace mode)"))

    return ConfigImportPlan(
        replace=replace,
        items=items,
        counts={a: sum(1 for i in items if i.action == a) for a in ("set", "reset", "unchanged", "skip")},
        restart_required=any(i.tier == "restart" and i.action in ("set", "reset") for i in items),
        rebuild_required=any(i.tier == "rebuild" and i.action in ("set", "reset") for i in items),
        secrets_set=[k for k in (document.get("secrets_set") or []) if isinstance(k, str)],
        source=document.get("source") if isinstance(document.get("source"), dict) else None,
        exported_at=document.get("exported_at") if isinstance(document.get("exported_at"), str) else None,
    )


async def apply_import(plan: ConfigImportPlan, settings: SettingsService, user_id: Optional[str]) -> ConfigImportPlan:
    """Run a plan through the settings service. Each item records its outcome;
    one failed key does not stop the others (the admin sees exactly what landed)."""
    for item in plan.items:
        try:
            if item.action == "set":
                await settings.set(item.key, item.incoming, user_id)
                item.applied = True
            elif item.action == "reset":
                await settings.reset(item.key, user_id)
                item.applied = True
        except SettingsError as exc:
            item.applied = False
            item.reason = exc.detail
    plan.applied = True
    applied = [i for i in plan.items if i.applied]
    failed = [i for i in plan.items if i.applied is False]
    await _audit(settings, user_id, {
        "action": "execute", "replace": plan.replace,
        "set": [i.key for i in applied if i.action == "set"],
        "reset": [i.key for i in applied if i.action == "reset"],
        "failed": [i.key for i in failed],
        "source_commit": (plan.source or {}).get("git_commit") if plan.source else None,
    })
    return plan


async def _audit(settings: SettingsService, user_id: Optional[str], details: Dict[str, Any]) -> None:
    if settings.audit is None:
        return
    try:
        await settings.audit.log_event(event_type="system.config.imported", user_id=user_id, action="execute",
                                       outcome="success" if not details["failed"] else "failure", details=details)
    except Exception:  # noqa: BLE001 — audit must never block an admin action
        pass
