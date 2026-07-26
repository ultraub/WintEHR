"""
Router-registration hardening tests (opportunity #4, docs/ARCHITECTURE_DEBT.md).

Pins three properties:
1. Every router in ROUTERS actually registers on a clean app — a broken
   import in any feature module fails THIS test instead of silently 404ing
   at runtime.
2. Isolation: one failing router does not take down the others (the old
   group-level try/except disabled all 12 clinical routers when any one of
   them failed to import).
3. /api/health belongs to main.py and reports the failures (it was shadowed
   by the CDS Hooks router's generic /health for months — bug B3).
"""

from __future__ import annotations

import importlib

from fastapi import FastAPI
from fastapi.testclient import TestClient

import api.routers as routers_module
from api.routers import ROUTERS, FAILED_ROUTERS, register_all_routers


def _registered_paths(app: FastAPI) -> set[str]:
    """FastAPI 0.140 includes routers lazily (_IncludedRouter) — app.routes
    doesn't flatten. The OpenAPI schema is the truthful enumeration."""
    return set(app.openapi().get("paths", {}))


def test_every_router_registers_cleanly():
    app = FastAPI()
    register_all_routers(app)

    assert FAILED_ROUTERS == [], (
        "Router(s) failed to register — a feature area would 404 at runtime: "
        f"{FAILED_ROUTERS}"
    )
    # The full surface is ~270 paths; a floor of 200 catches a large silent
    # loss without pinning the exact count.
    assert len(_registered_paths(app)) > 200


def test_one_bad_router_does_not_take_down_the_rest(monkeypatch):
    """The old group try/except made 12 clinical routers all-or-nothing."""
    real_import = importlib.import_module

    def failing_import(name, *args, **kwargs):
        if name == "api.clinical.inbox.router":
            raise ImportError("simulated broken import")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(importlib, "import_module", failing_import)

    app = FastAPI()
    register_all_routers(app)

    # Exactly the broken router failed, and it is identifiable.
    assert [f["module"] for f in FAILED_ROUTERS] == ["api.clinical.inbox.router"]

    # Its clinical siblings are still up — pharmacy is in the same (former)
    # group and used to die with it.
    paths = _registered_paths(app)
    assert any(p.startswith("/api/clinical/pharmacy") for p in paths), (
        "Pharmacy routes missing — a single bad import still disables siblings"
    )

    # Cleanup: re-register on a fresh app so FAILED_ROUTERS doesn't leak
    # simulated state into other tests (monkeypatch is undone by teardown,
    # but FAILED_ROUTERS is module-level).
    monkeypatch.undo()
    register_all_routers(FastAPI())
    assert FAILED_ROUTERS == []


def test_api_health_is_mains_and_reports_router_failures():
    from main import app  # noqa: PLC0415 — the real app, real route order

    # No context manager: skip lifespan (init_db) — the route needs no I/O.
    client = TestClient(app)
    resp = client.get("/api/health")

    assert resp.status_code == 200
    body = resp.json()
    # The app-level payload — NOT the CDS Hooks diagnostic payload that used
    # to shadow this path (it reported "service": "CDS Hooks").
    assert body["service"] == "Teaching EMR API"
    assert "routers" in body
    assert body["routers"]["failed"] == []
    assert body["status"] == "healthy"


def test_cds_hooks_health_moved_not_removed():
    from api.cds_hooks.cds_hooks_router import router

    paths = {getattr(r, "path", None) for r in router.routes}
    assert "/cds-hooks/health" in paths
    assert "/health" not in paths, (
        "A bare /health on this router resolves to /api/health and shadows "
        "the app health endpoint (B3) — keep it namespaced"
    )
