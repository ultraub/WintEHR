"""
Module-registration tests (docs/MODULES.md).

Pins the platform's disable semantics on top of the hardening properties
test_router_registration.py already covers:
- every module registers cleanly by default (a converted domain must not
  regress into a silent 404),
- WINTEHR_DISABLED_MODULES removes exactly the named modules' routes and
  reports them as disabled — deliberately absent, never "failed",
- a typo'd module key warns loudly and disables nothing.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI

from api.routers import (
    DISABLED_MODULES,
    FAILED_ROUTERS,
    MODULE_ROUTERS,
    register_all_routers,
)

# One representative public prefix per module key — kept in sync with each
# router file's APIRouter(prefix=...). If a module gains routers, any one
# prefix is enough: the test asserts presence/absence of the module, not
# its full surface.
MODULE_PREFIX = {
    "flowsheets": "/api/clinical/flowsheets",
    "imaging": "/api/dicom",
    "ai-tools": "/api/ui-composer",
    "quality-analytics": "/api/quality/measures",
    "scheduling": "/api/scheduling",
    "questionnaires": "/api/questionnaires",
    "inpatient": "/api/inpatient",
}


def _paths(app: FastAPI) -> set[str]:
    return set(app.openapi().get("paths", {}))


def _register(monkeypatch, disabled: str | None = None) -> FastAPI:
    if disabled is None:
        monkeypatch.delenv("WINTEHR_DISABLED_MODULES", raising=False)
    else:
        monkeypatch.setenv("WINTEHR_DISABLED_MODULES", disabled)
    app = FastAPI()
    register_all_routers(app)
    return app


def _cleanup(monkeypatch):
    """Re-register cleanly so module-level state doesn't leak across tests."""
    monkeypatch.delenv("WINTEHR_DISABLED_MODULES", raising=False)
    register_all_routers(FastAPI())


def test_prefix_table_covers_every_module_key():
    """A new MODULE_ROUTERS key must add its prefix here or this suite
    silently stops covering it."""
    assert set(MODULE_PREFIX) == set(MODULE_ROUTERS)


def test_all_modules_register_by_default(monkeypatch):
    app = _register(monkeypatch)
    assert FAILED_ROUTERS == []
    assert DISABLED_MODULES == []
    paths = _paths(app)
    for key, prefix in MODULE_PREFIX.items():
        assert any(p.startswith(prefix) for p in paths), (
            f"module '{key}' contributed no paths under {prefix}"
        )


def test_disabled_modules_drop_their_routes_and_are_reported(monkeypatch):
    app = _register(monkeypatch, disabled="imaging, ai-tools")
    paths = _paths(app)

    for key in ("imaging", "ai-tools"):
        assert not any(p.startswith(MODULE_PREFIX[key]) for p in paths), (
            f"disabled module '{key}' still has routes"
        )
    for key in ("flowsheets", "quality-analytics", "scheduling", "questionnaires"):
        assert any(p.startswith(MODULE_PREFIX[key]) for p in paths), (
            f"module '{key}' was collaterally disabled"
        )

    assert sorted(DISABLED_MODULES) == ["ai-tools", "imaging"]
    # Disabled is not failed — the distinction /api/health reports.
    assert FAILED_ROUTERS == []
    _cleanup(monkeypatch)


def test_unknown_disable_key_warns_and_disables_nothing(monkeypatch, caplog):
    with caplog.at_level(logging.WARNING, logger="api.routers"):
        app = _register(monkeypatch, disabled="flowseets")  # typo on purpose

    assert "flowseets" in caplog.text, "typo'd key must be named in a warning"
    assert DISABLED_MODULES == []
    paths = _paths(app)
    assert any(p.startswith(MODULE_PREFIX["flowsheets"]) for p in paths)
    _cleanup(monkeypatch)
