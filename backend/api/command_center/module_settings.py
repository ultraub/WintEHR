"""Module-owned settings (slice 9, docs/COMMAND_CENTER.md → Extensions).

A backend module may ship `settings.py` next to its router with

    SETTINGS = [SettingDefinition(key="module.<module-key>.<name>", ...), ...]

`discover_module_settings()` imports it for every enabled module when the
routers are registered and adds the definitions to the Command Center
registry, so the Settings tab renders them with the same tiers, secrets
and audit as platform settings — a module gets an admin surface without
writing one. Keys MUST live under `module.<module-key>.`; anything else is
refused and logged, because a module must not redefine a platform
setting.
"""

from __future__ import annotations

import importlib
import logging
from typing import Dict, Iterable, List, Tuple

from .settings_registry import DEFINITIONS, SettingDefinition

logger = logging.getLogger(__name__)

# module key → setting keys it declared (filled by discover_module_settings)
MODULE_SETTINGS: Dict[str, List[str]] = {}


def _packages_for(entries: Iterable[Tuple[str, str, str, dict]]) -> List[str]:
    """Backend packages a module's router entries live in, e.g. api.clinical.flowsheets."""
    packages: List[str] = []
    for _name, module_path, _attr, _kwargs in entries:
        package = module_path.rsplit(".", 1)[0] if "." in module_path else module_path
        if package not in packages:
            packages.append(package)
    return packages


def register_module_settings(module_key: str, definitions: Iterable[SettingDefinition]) -> List[str]:
    """Add a module's definitions to the registry; returns the keys accepted."""
    prefix = f"module.{module_key}."
    accepted: List[str] = []
    for definition in definitions:
        if not isinstance(definition, SettingDefinition):
            logger.error("Module %s: SETTINGS entries must be SettingDefinition, got %r", module_key, definition)
            continue
        if not definition.key.startswith(prefix):
            logger.error("Module %s: setting %r must start with %r; skipped", module_key, definition.key, prefix)
            continue
        if definition.key in DEFINITIONS and DEFINITIONS[definition.key] is not definition:
            logger.warning("Module %s: setting %r already registered; keeping the first", module_key, definition.key)
            accepted.append(definition.key)
            continue
        DEFINITIONS[definition.key] = definition
        accepted.append(definition.key)
    MODULE_SETTINGS[module_key] = accepted
    return accepted


def discover_module_settings(module_routers: Dict[str, list], disabled: Iterable[str] = ()) -> Dict[str, List[str]]:
    """Import `<package>.settings` for every enabled module and register its SETTINGS."""
    disabled = set(disabled)
    for module_key, entries in module_routers.items():
        if module_key in disabled:
            continue
        for package in _packages_for(entries):
            try:
                module = importlib.import_module(f"{package}.settings")
            except ModuleNotFoundError as exc:
                if exc.name == f"{package}.settings":
                    continue  # no settings.py — the normal case
                logger.error("Module %s: %s.settings failed to import: %s", module_key, package, exc)
                continue
            except Exception as exc:  # noqa: BLE001 — a broken settings.py must not break startup
                logger.error("Module %s: %s.settings failed to import: %s", module_key, package, exc)
                continue
            definitions = getattr(module, "SETTINGS", None)
            if not definitions:
                continue
            keys = register_module_settings(module_key, definitions)
            if keys:
                logger.info("Module %s: registered settings %s", module_key, keys)
    return dict(MODULE_SETTINGS)
