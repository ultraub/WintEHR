"""Settings store (slice 2): registry validation, precedence, secrets, audit, gates.

Everything runs against MemorySettingsRepository and an injected env — no
Postgres, no patch(). The SQL repository is exercised through a fake
session maker that records the statements it is asked to run.
"""

from __future__ import annotations

import json

import pytest
from fastapi import HTTPException

from api.auth.models import User
from api.command_center import settings_service as ss
from api.command_center.router import require_system
from api.command_center.secrets import SecretBox
from api.command_center.service import CommandCenterService
from api.command_center.models import ComponentStatus
from api.command_center.settings_registry import DEFINITIONS, SettingValueError, get_definition
from api.command_center.settings_repository import (
    ENSURE_SCHEMA_SQL,
    MemorySettingsRepository,
    SqlSettingsRepository,
)
from api.command_center.settings_service import SettingsError, SettingsService, get_setting


class FakeAudit:
    def __init__(self):
        self.events = []

    async def log_event(self, **kwargs):
        self.events.append(kwargs)
        return "audit-1"


def _service(env=None, key="test-passphrase", audit=None):
    return SettingsService(
        MemorySettingsRepository(),
        secret_box=SecretBox(key),
        audit=audit,
        env=env or {},
    )


@pytest.fixture(autouse=True)
def _isolated_default_service():
    ss.use_settings_service(None)
    yield
    ss.use_settings_service(None)


# --- registry -----------------------------------------------------------------


def test_every_definition_names_a_consumer_and_is_namespaced():
    for d in DEFINITIONS.values():
        assert d.key.startswith(("system.", "ui.", "module.")), d.key
        assert d.used_by, d.key
        assert d.tier in ("live", "restart", "rebuild")


def test_parse_coerces_and_bounds():
    cap = get_definition("system.patient_count_cap")
    assert cap.parse("250") == 250
    assert cap.parse(250.0) == 250
    with pytest.raises(SettingValueError):
        cap.parse(0)
    with pytest.raises(SettingValueError):
        cap.parse("lots")
    with pytest.raises(SettingValueError):
        cap.parse(True)

    from api.command_center.settings_registry import SettingDefinition

    flag = SettingDefinition(key="system.flag", type="bool", default=False, tier="live", label="f", description="", used_by="test")
    assert flag.parse("yes") is True and flag.parse("off") is False and flag.parse(True) is True
    with pytest.raises(SettingValueError):
        flag.parse("maybe")

    timeout = get_definition("system.hapi_timeout_seconds")
    assert timeout.tier == "restart" and timeout.env_var == "HAPI_FHIR_TIMEOUT"
    assert timeout.parse("45") == 45.0
    with pytest.raises(SettingValueError):
        timeout.parse(1)

    with pytest.raises(SettingValueError):
        get_definition("system.umls_api_key").parse("   ")
    with pytest.raises(KeyError):
        get_definition("system.nope")


# --- precedence -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_database_beats_environment_beats_default():
    svc = _service(env={"CATALOG_SCAN_MAX_RESOURCES": "2000"})
    key = "system.catalog_scan_max_resources"

    view = next(v for v in await svc.list() if v.key == key)
    assert (view.value, view.source) == (2000, "environment")

    await svc.set(key, 5000, user_id="demo-admin")
    view = next(v for v in await svc.list() if v.key == key)
    assert (view.value, view.source, view.updated_by) == (5000, "database", "demo-admin")
    assert await svc.get(key) == 5000

    await svc.reset(key, user_id="demo-admin")
    assert await svc.get(key) == 2000

    plain = _service()
    view = next(v for v in await plain.list() if v.key == key)
    assert (view.value, view.source) == (100000, "default")


@pytest.mark.asyncio
async def test_unparseable_env_is_ignored_not_fatal():
    svc = _service(env={"CATALOG_SCAN_MAX_RESOURCES": "banana"})
    assert await svc.get("system.catalog_scan_max_resources") == 100000


@pytest.mark.asyncio
async def test_set_rejects_unknown_key_and_bad_values_with_http_codes():
    svc = _service()
    with pytest.raises(SettingsError) as exc:
        await svc.set("system.nope", 1, "u")
    assert exc.value.status_code == 404
    with pytest.raises(SettingsError) as exc:
        await svc.set("system.patient_count_cap", "many", "u")
    assert exc.value.status_code == 400


# --- secrets --------------------------------------------------------------------


@pytest.mark.asyncio
async def test_secrets_are_encrypted_at_rest_masked_in_views_and_decrypted_for_consumers():
    svc = _service(key="pass")
    await svc.set("system.umls_api_key", "umls-abc-123", "demo-admin")

    stored = svc.repository.rows["system.umls_api_key"]
    assert stored.is_secret and "umls-abc-123" not in stored.value

    view = next(v for v in await svc.list() if v.key == "system.umls_api_key")
    assert view.value is None and view.default is None
    assert view.is_set is True and view.secrets_enabled is True
    assert "umls-abc-123" not in json.dumps(view.model_dump(), default=str)

    assert await svc.get("system.umls_api_key") == "umls-abc-123"


@pytest.mark.asyncio
async def test_secret_cannot_be_stored_without_a_key_but_env_still_works():
    svc = _service(key=None, env={"UMLS_API_KEY": "from-env"})
    with pytest.raises(SettingsError) as exc:
        await svc.set("system.umls_api_key", "x", "u")
    assert exc.value.status_code == 409 and "WINTEHR_SETTINGS_KEY" in exc.value.detail

    view = next(v for v in await svc.list() if v.key == "system.umls_api_key")
    assert view.is_set is True and view.source == "environment" and view.secrets_enabled is False
    assert await svc.get("system.umls_api_key") == "from-env"


@pytest.mark.asyncio
async def test_secret_saved_under_another_key_falls_through_to_env():
    writer = _service(key="old-key")
    await writer.set("system.umls_api_key", "secret", "u")
    reader = SettingsService(writer.repository, secret_box=SecretBox("new-key"), env={"UMLS_API_KEY": "env"})
    assert await reader.get("system.umls_api_key") == "env"


def test_secret_box_round_trip_and_wrong_key():
    box = SecretBox("one")
    token = box.encrypt("hello")
    assert token != "hello" and box.decrypt(token) == "hello"
    with pytest.raises(RuntimeError):
        SecretBox("two").decrypt(token)
    assert SecretBox("").available is False


# --- audit ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_writes_are_audited_without_secret_values():
    audit = FakeAudit()
    svc = _service(audit=audit)
    await svc.set("system.patient_count_cap", 42, "demo-admin")
    await svc.set("system.umls_api_key", "sekrit", "demo-admin")
    await svc.reset("system.patient_count_cap", "demo-admin")
    await svc.reset("system.patient_count_cap", "demo-admin")  # nothing to reset → no event

    types = [e["event_type"] for e in audit.events]
    assert types == ["system.setting.updated", "system.setting.updated", "system.setting.reset"]
    assert audit.events[0]["details"]["value"] == 42
    assert audit.events[0]["user_id"] == "demo-admin"
    assert "value" not in audit.events[1]["details"]
    assert "sekrit" not in json.dumps(audit.events)


@pytest.mark.asyncio
async def test_audit_failure_does_not_block_the_write():
    class Boom:
        async def log_event(self, **kwargs):
            raise ConnectionError("HAPI down")

    svc = _service(audit=Boom())
    view = await svc.set("system.patient_count_cap", 7, "u")
    assert view.value == 7


# --- live-tier helper -------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_setting_caches_briefly_and_invalidates_on_write(monkeypatch):
    svc = _service()
    ss.use_settings_service(svc)
    now = [1000.0]
    monkeypatch.setattr(ss, "_clock", lambda: now[0])

    assert await get_setting("system.patient_count_cap") == 500
    await svc.repository.upsert("system.patient_count_cap", "9", False, "u")  # behind the cache's back
    assert await get_setting("system.patient_count_cap") == 500, "served from cache"
    now[0] += ss.SETTING_CACHE_SECONDS + 1
    assert await get_setting("system.patient_count_cap") == 9, "cache expired"

    await svc.set("system.patient_count_cap", 11, "u")
    assert await get_setting("system.patient_count_cap") == 11, "write invalidates"


@pytest.mark.asyncio
async def test_get_setting_falls_back_to_env_when_the_store_is_down(monkeypatch):
    class Broken:
        async def get_all(self):
            raise ConnectionError("postgres gone")

    ss.use_settings_service(SettingsService(Broken(), secret_box=SecretBox(None), env={}))
    monkeypatch.setenv("COMMAND_CENTER_PROBE_TIMEOUT", "3")
    assert await get_setting("system.probe_timeout_seconds") == 3.0


@pytest.mark.asyncio
async def test_status_report_reads_the_live_probe_timeout():
    svc = _service()
    ss.use_settings_service(svc)
    await svc.set("system.probe_timeout_seconds", 2.5, "u")

    seen = {}

    async def probe():
        return ComponentStatus(name="fhir", status="ok")

    cc = CommandCenterService(hapi_client=object(), probes={"fhir": probe}, router_state=lambda: {})
    assert await cc._timeout() == 2.5
    report = await cc.status()
    assert report.status == "ok"
    assert seen == {}


# --- SQL repository ---------------------------------------------------------------


class _FakeResult:
    def __init__(self, rows=(), rowcount=0):
        self._rows = rows
        self.rowcount = rowcount

    def all(self):
        return self._rows


class _FakeSession:
    def __init__(self, log):
        self.log = log

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.log.append((sql.strip().split()[0].upper(), params))
        if sql.strip().upper().startswith("SELECT"):
            return _FakeResult(rows=[("system.patient_count_cap", "3", False, "u", None)])
        if sql.strip().upper().startswith("DELETE"):
            return _FakeResult(rowcount=1)
        return _FakeResult()

    async def commit(self):
        self.log.append(("COMMIT", None))


@pytest.mark.asyncio
async def test_sql_repository_creates_schema_once_and_uses_qualified_statements():
    log = []
    repo = SqlSettingsRepository(session_maker=lambda: _FakeSession(log))

    rows = await repo.get_all()
    assert rows["system.patient_count_cap"].value == "3"
    assert [op for op, _ in log][: len(ENSURE_SCHEMA_SQL)] == ["CREATE"] * len(ENSURE_SCHEMA_SQL)

    await repo.upsert("system.patient_count_cap", "4", False, "u")
    assert await repo.delete("system.patient_count_cap") is True
    creates = [op for op, _ in log if op == "CREATE"]
    assert len(creates) == len(ENSURE_SCHEMA_SQL), "schema DDL runs once per process"
    assert any(p == {"key": "system.patient_count_cap", "value": "4", "is_secret": False, "updated_by": "u"} for _, p in log)
    for statement in ENSURE_SCHEMA_SQL:
        assert "IF NOT EXISTS" in statement


# --- permission gate -------------------------------------------------------------


def _user(*permissions):
    return User(id="u1", username="x", name="X", email="x@example.com", role="admin", permissions=list(permissions))


def test_require_system_rejects_plain_admins():
    with pytest.raises(HTTPException) as exc:
        require_system(_user("read", "admin"))
    assert exc.value.status_code == 403
    user = _user("admin", "system")
    assert require_system(user) is user
