"""Module inventory + module-owned settings discovery (slice 9)."""

from __future__ import annotations

import sys
import types

import pytest
from fastapi import FastAPI

from api.command_center import module_settings as ms
from api.command_center.modules import module_inventory
from api.command_center.router import get_modules
from api.command_center.settings_registry import DEFINITIONS, SettingDefinition
from api.routers import DISABLED_MODULES, FAILED_ROUTERS, MODULE_ROUTERS, register_all_routers


@pytest.fixture(autouse=True)
def _clean_registry():
    added = set()
    yield added
    for key in list(DEFINITIONS):
        if key.startswith("module."):
            del DEFINITIONS[key]
    ms.MODULE_SETTINGS.clear()
    for name in list(sys.modules):
        if name.startswith("fake_mod"):
            del sys.modules[name]


def _fake_package(name: str, settings):
    pkg = types.ModuleType(name)
    pkg.__path__ = []
    sys.modules[name] = pkg
    mod = types.ModuleType(f"{name}.settings")
    mod.SETTINGS = settings
    sys.modules[f"{name}.settings"] = mod


def _definition(key, **overrides):
    base = dict(key=key, type="int", default=1, tier="live", label=key, description="", used_by="test")
    base.update(overrides)
    return SettingDefinition(**base)


def test_discovery_registers_namespaced_settings_and_refuses_others():
    _fake_package("fake_mod_a", [
        _definition("module.alpha.window_hours"),
        _definition("system.sneaky"),            # wrong namespace → refused
        _definition("module.beta.not_mine"),     # another module's namespace → refused
        "not a definition",
    ])
    _fake_package("fake_mod_b", [])
    routers = {
        "alpha": [("Alpha", "fake_mod_a.router", "router", {})],
        "beta": [("Beta", "fake_mod_b.router", "router", {})],
        "gamma": [("Gamma", "fake_mod_missing.router", "router", {})],  # no settings.py at all
        "off": [("Off", "fake_mod_a.router", "router", {})],
    }
    found = ms.discover_module_settings(routers, disabled=["off"])
    assert found["alpha"] == ["module.alpha.window_hours"]
    assert "module.alpha.window_hours" in DEFINITIONS
    assert "system.sneaky" not in DEFINITIONS and "module.beta.not_mine" not in DEFINITIONS
    assert "beta" not in found and "gamma" not in found and "off" not in found


def test_discovery_survives_a_broken_settings_module():
    pkg = types.ModuleType("fake_mod_broken")
    pkg.__path__ = []
    sys.modules["fake_mod_broken"] = pkg

    class Boom(types.ModuleType):
        pass

    def _raise(*a, **k):
        raise RuntimeError("syntax error in settings.py")

    import importlib

    real = importlib.import_module
    importlib.import_module = lambda name, *a, **k: _raise() if name == "fake_mod_broken.settings" else real(name, *a, **k)
    try:
        assert ms.discover_module_settings({"broken": [("B", "fake_mod_broken.router", "router", {})]}) == {}
    finally:
        importlib.import_module = real


def test_inventory_reports_status_source_and_settings(monkeypatch):
    monkeypatch.delenv("WINTEHR_DISABLED_MODULES", raising=False)
    register_all_routers(FastAPI())
    views = {v.key: v for v in module_inventory()}
    assert set(views) == set(MODULE_ROUTERS)
    assert views["flowsheets"].registered and views["flowsheets"].source == "builtin"
    assert views["command-center"].backend_routers == ["Command Center"]

    monkeypatch.setenv("WINTEHR_DISABLED_MODULES", "imaging")
    register_all_routers(FastAPI())
    views = {v.key: v for v in module_inventory()}
    assert views["imaging"].disabled and not views["imaging"].registered
    assert "imaging" in DISABLED_MODULES
    monkeypatch.delenv("WINTEHR_DISABLED_MODULES", raising=False)
    register_all_routers(FastAPI())
    assert FAILED_ROUTERS == []


@pytest.mark.asyncio
async def test_modules_endpoint_shape(monkeypatch):
    monkeypatch.delenv("WINTEHR_DISABLED_MODULES", raising=False)
    register_all_routers(FastAPI())
    body = await get_modules()
    assert {m.key for m in body.modules} == set(MODULE_ROUTERS)
    assert body.disabled_backend == []
    assert "WINTEHR_DISABLED_MODULES" in body.how_to["backend"] and "rebuild" in body.how_to["frontend"]
