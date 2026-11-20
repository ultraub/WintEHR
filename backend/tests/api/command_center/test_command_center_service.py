"""CommandCenterService tests — inject fake probes and router state, no patch()."""

from __future__ import annotations

import asyncio
import sqlite3

import pytest
from fastapi import HTTPException

from api.auth.models import User
from api.command_center.models import ComponentStatus, RouterStatus
from api.command_center.probes import probe_terminology, probe_vna
from api.command_center.router import require_admin
from api.command_center.service import CommandCenterService, roll_up


def _ok(name):
    async def probe():
        return ComponentStatus(name=name, status="ok")

    return probe


def _state(**overrides):
    base = {"registered": 40, "failed": [], "disabled_modules": [], "modules": ["flowsheets"]}
    base.update(overrides)
    return lambda: base


def _service(probes, state=None, timeout=1.0):
    return CommandCenterService(
        hapi_client=object(), probes=probes, router_state=state or _state(), timeout_seconds=timeout
    )


@pytest.mark.asyncio
async def test_all_ok_rolls_up_to_ok():
    report = await _service({"fhir": _ok("fhir"), "database": _ok("database")}).status()
    assert report.status == "ok"
    assert {c.name for c in report.components} == {"fhir", "database"}
    assert report.routers.registered == 40


@pytest.mark.asyncio
async def test_fhir_down_is_down_but_anything_else_is_degraded():
    async def down():
        return ComponentStatus(name="x", status="down")

    assert (await _service({"fhir": down, "redis": _ok("redis")}).status()).status == "down"
    assert (await _service({"fhir": _ok("fhir"), "redis": down}).status()).status == "degraded"


@pytest.mark.asyncio
async def test_absent_components_never_degrade():
    async def absent():
        return ComponentStatus(name="vna", status="absent", detail="not configured")

    report = await _service({"fhir": _ok("fhir"), "vna": absent}).status()
    assert report.status == "ok"


@pytest.mark.asyncio
async def test_failed_router_degrades():
    state = _state(failed=[{"router": "Flowsheets", "error": "boom"}])
    report = await _service({"fhir": _ok("fhir")}, state=state).status()
    assert report.status == "degraded"
    assert report.routers.failed[0]["router"] == "Flowsheets"


@pytest.mark.asyncio
async def test_probe_exception_becomes_down_component_not_a_500():
    async def explode():
        raise ConnectionError("refused")

    report = await _service({"fhir": _ok("fhir"), "redis": explode}).status()
    redis = next(c for c in report.components if c.name == "redis")
    assert redis.status == "down"
    assert "ConnectionError" in redis.detail and "refused" in redis.detail
    assert report.status == "degraded"


@pytest.mark.asyncio
async def test_probe_timeout_becomes_down_component():
    async def slow():
        await asyncio.sleep(5)
        return ComponentStatus(name="database", status="ok")

    report = await _service({"fhir": _ok("fhir"), "database": slow}, timeout=0.05).status()
    database = next(c for c in report.components if c.name == "database")
    assert database.status == "down"
    assert "timed out" in database.detail


@pytest.mark.asyncio
async def test_component_is_named_after_its_probe_key():
    async def mislabelled():
        return ComponentStatus(name="whatever", status="ok")

    report = await _service({"fhir": mislabelled}).status()
    assert report.components[0].name == "fhir"


def test_roll_up_is_pure():
    routers = RouterStatus()
    assert roll_up([ComponentStatus(name="fhir", status="ok")], routers) == "ok"
    assert roll_up([ComponentStatus(name="fhir", status="degraded")], routers) == "degraded"
    assert roll_up([], RouterStatus(failed=[{"router": "x"}])) == "degraded"


# --- real probes against local fixtures -------------------------------------


@pytest.mark.asyncio
async def test_terminology_probe_reports_missing_index_as_degraded(tmp_path, monkeypatch):
    monkeypatch.setenv("TERMINOLOGY_DB_PATH", str(tmp_path / "missing.db"))
    result = await probe_terminology()
    assert result.status == "degraded"
    assert result.data["present"] is False
    assert "build_terminology_index.py" in result.detail


@pytest.mark.asyncio
async def test_terminology_probe_counts_concepts_by_system(tmp_path, monkeypatch):
    db = tmp_path / "terminology.db"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE concepts (domain TEXT, system TEXT, code TEXT, display TEXT)")
    conn.executemany(
        "INSERT INTO concepts VALUES (?, ?, ?, ?)",
        [
            ("lab", "http://loinc.org", "2345-7", "Glucose"),
            ("lab", "http://loinc.org", "718-7", "Hemoglobin"),
            ("medication", "http://www.nlm.nih.gov/research/umls/rxnorm", "1", "Aspirin"),
        ],
    )
    conn.commit()
    conn.close()
    monkeypatch.setenv("TERMINOLOGY_DB_PATH", str(db))

    result = await probe_terminology()
    assert result.status == "ok"
    assert result.data["total"] == 3
    assert result.data["concepts_by_system"]["http://loinc.org"] == 2


@pytest.mark.asyncio
async def test_vna_probe_is_absent_when_not_configured(monkeypatch):
    monkeypatch.delenv("DICOM_QIDO_URL", raising=False)
    result = await probe_vna()
    assert result.status == "absent"


# --- permission gate ----------------------------------------------------------


def _user(*permissions):
    return User(
        id="u1", username="x", name="X", email="x@example.com", role="nurse",
        permissions=list(permissions),
    )


def test_require_admin_rejects_users_without_admin_permission():
    with pytest.raises(HTTPException) as exc:
        require_admin(_user("read", "write"))
    assert exc.value.status_code == 403


def test_require_admin_passes_admins_through():
    user = _user("read", "admin")
    assert require_admin(user) is user
