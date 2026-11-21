"""Configuration export / import (slice 13): the document, the pure plan, and apply
through the settings service with its audit. No Postgres, no patch()."""

from __future__ import annotations

import json

import pytest
from fastapi import HTTPException

from api.auth.models import User
from api.command_center import settings_service as ss
from api.command_center.config_transfer import FORMAT_VERSION, apply_import, export_document, plan_import
from api.command_center.models import BuildInfo, ConfigImportRequest
from api.command_center.router import export_config, import_config
from api.command_center.secrets import SecretBox
from api.command_center.settings_registry import DEFINITIONS
from api.command_center.settings_repository import MemorySettingsRepository
from api.command_center.settings_service import SettingsError, SettingsService


class FakeAudit:
    def __init__(self):
        self.events = []

    async def log_event(self, **kwargs):
        self.events.append(kwargs)
        return "audit-1"


@pytest.fixture(autouse=True)
def _isolated():
    ss.use_settings_service(None)
    yield
    ss.use_settings_service(None)


def _svc(audit=None, env=None):
    return SettingsService(MemorySettingsRepository(), secret_box=SecretBox("pw"), audit=audit, env=env or {})


def _admin():
    return User(id="demo-admin", username="admin", name="Admin", email="a@example.com", role="admin", permissions=["admin", "system"])


async def _populated(audit=None):
    svc = _svc(audit)
    await svc.set("system.patient_count_cap", 250, "demo-admin")
    await svc.set("ui.tabs.policy", {"org": {"hidden": ["imaging"]}}, "demo-admin")
    await svc.set("auth.roles", {"nurse": {"permissions": ["read"]}}, "demo-admin")
    await svc.set("system.umls_api_key", "umls-secret-value", "demo-admin")
    return svc


# --- export -------------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_export_carries_overrides_only_and_never_a_secret_value():
    svc = await _populated()
    doc = export_document(await svc.list(), BuildInfo(version="1.2", git_commit="abc"), "demo-admin")
    assert doc.wintehr_config == FORMAT_VERSION and doc.exported_by == "demo-admin" and doc.source.git_commit == "abc"
    assert set(doc.settings) == {"system.patient_count_cap", "ui.tabs.policy", "auth.roles"}
    assert doc.settings["ui.tabs.policy"]["org"]["hidden"] == ["imaging"]
    assert doc.secrets_set == ["system.umls_api_key"]
    assert "umls-secret-value" not in doc.model_dump_json()
    # env-sourced and default values are not overrides
    env_svc = _svc(env={"HAPI_FHIR_TIMEOUT": "45"})
    assert export_document(await env_svc.list(), BuildInfo(), None).settings == {}


@pytest.mark.asyncio
async def test_export_route_can_download_as_a_file():
    svc = await _populated()
    response = await export_config(download=True, user=_admin(), settings=svc)
    assert response.media_type == "application/json"
    assert 'filename="wintehr-config-' in response.headers["content-disposition"]
    body = json.loads(response.body)
    assert body["settings"]["system.patient_count_cap"] == 250
    plain = await export_config(download=False, user=_admin(), settings=svc)
    assert plain.settings == body["settings"]


# --- plan -----------------------------------------------------------------------------------


def _doc(settings, **extra):
    return {"wintehr_config": FORMAT_VERSION, "exported_at": "2026-11-21T10:00:00+00:00",
            "source": {"git_commit": "feedface"}, "settings": settings, "secrets_set": ["system.umls_api_key"], **extra}


@pytest.mark.asyncio
async def test_plan_classifies_every_key_without_writing():
    svc = await _populated()
    views = await svc.list()
    plan = plan_import(_doc({
        "system.patient_count_cap": 250,                    # same as current override → unchanged
        "system.hapi_timeout_seconds": "60",                # new override (restart tier) → set, parsed
        "ui.tabs.policy": {"org": {"hidden": ["timeline"]}},  # differs → set
        "module.gone.flag": True,                           # not on this deployment → skip
        "system.umls_api_key": "leaked?",                   # secrets never import → skip
        "system.probe_timeout_seconds": "fast",             # invalid → skip with the parse error
    }), views, DEFINITIONS)
    by_key = {i.key: i for i in plan.items}
    assert by_key["system.patient_count_cap"].action == "unchanged"
    assert by_key["system.hapi_timeout_seconds"].action == "set" and by_key["system.hapi_timeout_seconds"].incoming == 60.0
    assert by_key["system.hapi_timeout_seconds"].current_source == "default"
    assert by_key["ui.tabs.policy"].action == "set" and by_key["ui.tabs.policy"].incoming["org"]["hidden"] == ["timeline"]
    assert by_key["module.gone.flag"].action == "skip" and "unknown" in by_key["module.gone.flag"].reason
    assert by_key["system.umls_api_key"].action == "skip" and "secret" in by_key["system.umls_api_key"].reason
    assert by_key["system.probe_timeout_seconds"].action == "skip" and "expected float" in by_key["system.probe_timeout_seconds"].reason
    assert plan.counts == {"set": 2, "reset": 0, "unchanged": 1, "skip": 3}
    assert plan.restart_required is True and plan.rebuild_required is False
    assert plan.secrets_set == ["system.umls_api_key"] and plan.source == {"git_commit": "feedface"}
    assert not plan.applied
    # nothing was written
    assert await svc.get("system.hapi_timeout_seconds") == 30.0
    # auth.roles stayed, because replace was off
    assert all(i.action != "reset" for i in plan.items)


@pytest.mark.asyncio
async def test_replace_mode_resets_overrides_the_file_does_not_mention():
    svc = await _populated()
    plan = plan_import(_doc({"system.patient_count_cap": 300}), await svc.list(), DEFINITIONS, replace=True)
    resets = sorted(i.key for i in plan.items if i.action == "reset")
    assert resets == ["auth.roles", "ui.tabs.policy"]       # the secret override is left alone
    assert plan.counts["set"] == 1 and plan.counts["reset"] == 2


def test_plan_refuses_a_document_it_cannot_read():
    for bad in ([], {"settings": {}}, {"wintehr_config": 99, "settings": {}}, {"wintehr_config": 1, "settings": []}):
        with pytest.raises(SettingsError) as exc:
            plan_import(bad, [], DEFINITIONS)
        assert exc.value.status_code == 400


# --- apply ------------------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_apply_writes_through_the_settings_service_and_audits_once_as_a_whole():
    audit = FakeAudit()
    svc = await _populated(audit)
    audit.events.clear()
    plan = plan_import(_doc({"system.patient_count_cap": 300, "system.hapi_timeout_seconds": 60, "module.gone.flag": 1}),
                       await svc.list(), DEFINITIONS, replace=True)
    result = await apply_import(plan, svc, "demo-admin")
    assert result.applied is True
    assert await svc.get("system.patient_count_cap") == 300
    assert await svc.get("system.hapi_timeout_seconds") == 60.0
    assert (await svc.get("ui.tabs.policy"))["org"]["hidden"] == []      # reset to default
    assert await svc.get("auth.roles") == {}
    assert await svc.get("system.umls_api_key") == "umls-secret-value"  # untouched
    by_key = {i.key: i for i in result.items}
    assert by_key["system.patient_count_cap"].applied is True and by_key["ui.tabs.policy"].applied is True
    assert by_key["module.gone.flag"].applied is None
    summary = [e for e in audit.events if e["event_type"] == "system.config.imported"]
    assert len(summary) == 1
    details = summary[0]["details"]
    assert sorted(details["set"]) == ["system.hapi_timeout_seconds", "system.patient_count_cap"]
    assert sorted(details["reset"]) == ["auth.roles", "ui.tabs.policy"] and details["failed"] == []
    assert details["replace"] is True and details["source_commit"] == "feedface"
    assert "umls" not in json.dumps(details)
    # the per-key writes are audited too, like any Settings-tab save
    assert sum(1 for e in audit.events if e["event_type"] == "system.setting.updated") == 2


@pytest.mark.asyncio
async def test_import_route_previews_by_default_and_applies_on_request():
    svc = await _populated()
    body = ConfigImportRequest(document=_doc({"system.patient_count_cap": 400}))
    preview = await import_config(body, user=_admin(), settings=svc)
    assert preview.applied is False and await svc.get("system.patient_count_cap") == 250
    applied = await import_config(ConfigImportRequest(document=_doc({"system.patient_count_cap": 400}), apply=True), user=_admin(), settings=svc)
    assert applied.applied is True and await svc.get("system.patient_count_cap") == 400
    with pytest.raises(HTTPException) as exc:
        await import_config(ConfigImportRequest(document={"settings": {}}), user=_admin(), settings=svc)
    assert exc.value.status_code == 400
