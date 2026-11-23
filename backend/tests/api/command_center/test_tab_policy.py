"""Tab policy (slice 7): shape validation, the json setting type, the public read model."""

from __future__ import annotations

import json

import pytest

from api.command_center.models import TabPolicyResponse
from api.command_center.router import get_ui_policy
from api.command_center.secrets import SecretBox
from api.command_center.settings_registry import SettingValueError, get_definition
from api.command_center.settings_repository import MemorySettingsRepository
from api.command_center.settings_service import SettingsService
from api.command_center.tab_policy import EMPTY_POLICY, known_roles, normalize_tab_policy


def test_normalize_fills_every_layer_and_dedupes():
    doc = {"org": {"hidden": ["inbox", "inbox", "pharmacy"]}, "roles": {"nurse": {"default": "administration", "order": ["summary", "administration"]}}}
    out = normalize_tab_policy(doc)
    assert out["org"] == {"hidden": ["inbox", "pharmacy"], "order": [], "default": None, "sections": {}, "nav": {"hidden": []}}
    assert out["roles"]["nurse"] == {"hidden": [], "order": ["summary", "administration"], "default": "administration", "sections": {}, "nav": {"hidden": []}}
    assert out["contexts"] == {}
    assert normalize_tab_policy(None) == EMPTY_POLICY


def test_summary_can_never_be_hidden():
    out = normalize_tab_policy({"org": {"hidden": ["summary", "inbox"]}, "roles": {"nurse": {"hidden": ["summary"]}}})
    assert out["org"]["hidden"] == ["inbox"] and out["roles"]["nurse"]["hidden"] == []


@pytest.mark.parametrize("doc", [
    [], "x",
    {"bogus": {}},
    {"org": {"hidden": "inbox"}},
    {"org": {"hidden": [1]}},
    {"org": {"extra": True}},
    {"org": {"default": ""}},
    {"org": {"hidden": ["inbox"], "default": "inbox"}},
    {"roles": []},
    {"roles": {"": {}}},
    {"org": {"nav": []}},
    {"org": {"nav": {"hidden": "dashboard"}}},
    {"org": {"nav": {"order": ["dashboard"]}}},
])
def test_bad_shapes_are_rejected(doc):
    with pytest.raises(SettingValueError):
        normalize_tab_policy(doc)


def test_json_setting_parses_dicts_and_strings_through_the_validator():
    definition = get_definition("ui.tabs.policy")
    assert definition.type == "json" and definition.tier == "live"
    assert definition.parse({"org": {"hidden": ["inbox"]}})["org"]["hidden"] == ["inbox"]
    assert definition.parse('{"roles": {"nurse": {"hidden": ["orders"]}}}')["roles"]["nurse"]["hidden"] == ["orders"]
    with pytest.raises(SettingValueError):
        definition.parse("{not json")
    with pytest.raises(SettingValueError):
        definition.parse({"org": {"hidden": ["summary", 3]}})


@pytest.mark.asyncio
async def test_policy_round_trips_through_the_settings_store_and_public_endpoint():
    svc = SettingsService(MemorySettingsRepository(), secret_box=SecretBox(None), env={})

    before = await get_ui_policy(settings=svc)
    assert isinstance(before, TabPolicyResponse)
    assert before.policy == EMPTY_POLICY and before.source == "default"
    assert "nurse" in before.roles and "physician" in before.roles
    assert before.always_visible == ["summary"]

    await svc.set("ui.tabs.policy", {"org": {"hidden": ["inbox"]}, "roles": {"nurse": {"hidden": ["orders"], "default": "administration"}}}, "demo-admin")
    after = await get_ui_policy(settings=svc)
    assert after.source == "database" and after.updated_by == "demo-admin"
    assert after.policy["org"]["hidden"] == ["inbox"]
    assert after.policy["roles"]["nurse"]["default"] == "administration"
    # Stored as JSON text, normalized.
    stored = json.loads(svc.repository.rows["ui.tabs.policy"].value)
    assert stored["contexts"] == {} and stored["org"]["order"] == []

    await svc.reset("ui.tabs.policy", "demo-admin")
    assert (await get_ui_policy(settings=svc)).policy == EMPTY_POLICY


def test_sections_per_tab_are_validated_and_empty_specs_dropped():
    out = normalize_tab_policy({"org": {"sections": {"chart-review": {"hidden": ["documents"], "added": ["flowsheet", "flowsheet"]}, "results": {}}}})
    assert out["org"]["sections"] == {"chart-review": {"hidden": ["documents"], "order": [], "added": ["flowsheet"]}}
    for bad in (
        {"org": {"sections": []}},
        {"org": {"sections": {"chart-review": {"hidden": "documents"}}}},
        {"org": {"sections": {"chart-review": {"bogus": []}}}},
        {"org": {"sections": {"": {}}}},
    ):
        with pytest.raises(SettingValueError):
            normalize_tab_policy(bad)


def test_known_roles_covers_training_users():
    assert set(known_roles()) >= {"physician", "nurse", "pharmacist", "admin"}


def test_nav_layer_hides_primary_navigation_but_never_patients_or_the_command_center():
    out = normalize_tab_policy({
        "org": {"nav": {"hidden": ["dashboard", "patients", "dashboard"]}},
        "roles": {"nurse": {"nav": {"hidden": ["command-center", "analytics"]}}},
        "contexts": {"clinic": {}},
    })
    assert out["org"]["nav"] == {"hidden": ["dashboard"]}
    assert out["roles"]["nurse"]["nav"] == {"hidden": ["analytics"]}
    assert out["contexts"]["clinic"]["nav"] == {"hidden": []}
    assert EMPTY_POLICY["org"]["nav"] == {"hidden": []}


@pytest.mark.asyncio
async def test_ui_policy_names_the_locked_nav_items():
    svc = SettingsService(MemorySettingsRepository(), secret_box=SecretBox(None), env={})
    out = await get_ui_policy(settings=svc)
    assert out.always_visible_nav == ["patients", "command-center"]
