"""Roles (slice 8): validator guard rails, effective permissions, the read model,
and the override applied on every authenticated request."""

from __future__ import annotations

import pytest

from api.auth.models import User
from api.auth.service import apply_role_overrides
from api.command_center import settings_service as ss
from api.command_center.roles import KNOWN_PERMISSION_KEYS, default_roles, effective_permissions, normalize_roles
from api.command_center.router import get_roles
from api.command_center.secrets import SecretBox
from api.command_center.settings_registry import SettingValueError
from api.command_center.settings_repository import MemorySettingsRepository
from api.command_center.settings_service import SettingsService


@pytest.fixture(autouse=True)
def _isolated():
    ss.use_settings_service(None)
    yield
    ss.use_settings_service(None)


def _user(role, *perms):
    return User(id=f"u-{role}", username=role, name=role, email=f"{role}@example.com", role=role, permissions=list(perms))


def test_defaults_come_from_the_training_users():
    roles = default_roles()
    assert set(roles) >= {"physician", "nurse", "pharmacist", "admin"}
    assert "admin" in roles["admin"]["permissions"] and "system" in roles["admin"]["permissions"]
    assert roles["nurse"]["users"] == ["nurse"]


def test_validator_dedupes_rejects_unknown_and_protects_admin():
    out = normalize_roles({"nurse": {"permissions": ["read", "read", "order:imaging"]}})
    assert out == {"nurse": {"permissions": ["read", "order:imaging"]}}
    assert normalize_roles(None) == {}
    for bad in (
        [],
        {"nurse": ["read"]},
        {"nurse": {"permissions": "read"}},
        {"nurse": {"permissions": ["raed"]}},
        {"nurse": {"perms": []}},
        {"": {"permissions": []}},
        {"admin": {"permissions": ["read", "admin"]}},  # loses system
    ):
        with pytest.raises(SettingValueError):
            normalize_roles(bad)
    assert all(p in KNOWN_PERMISSION_KEYS for p in ("admin", "system", "order:lab"))


def test_effective_permissions_prefers_the_override_and_keeps_locked_ones():
    assert effective_permissions("nurse", ["read"], None) == ["read"]
    assert effective_permissions("nurse", ["read"], {"nurse": {"permissions": ["read", "write"]}}) == ["read", "write"]
    assert effective_permissions("physician", ["read"], {"nurse": {"permissions": []}}) == ["read"]
    assert set(effective_permissions("admin", ["admin"], {"admin": {"permissions": ["read"]}})) == {"read", "admin", "system"}


@pytest.mark.asyncio
async def test_roles_read_model_marks_overrides():
    svc = SettingsService(MemorySettingsRepository(), secret_box=SecretBox(None), env={})
    before = await get_roles(settings=svc)
    nurse = next(r for r in before.roles if r.role == "nurse")
    assert nurse.overridden is False and nurse.permissions == nurse.default_permissions
    assert next(r for r in before.roles if r.role == "admin").locked == ["admin", "system"]
    assert {p["key"] for p in before.permissions} == set(KNOWN_PERMISSION_KEYS)

    await svc.set("auth.roles", {"nurse": {"permissions": ["read", "write", "order:lab", "order:imaging"]}}, "demo-admin")
    after = await get_roles(settings=svc)
    nurse = next(r for r in after.roles if r.role == "nurse")
    assert nurse.overridden is True and "order:imaging" in nurse.permissions
    assert "order:imaging" not in nurse.default_permissions
    assert after.source == "database" and after.updated_by == "demo-admin"


@pytest.mark.asyncio
async def test_override_is_applied_to_the_authenticated_user_on_the_next_request():
    svc = SettingsService(MemorySettingsRepository(), secret_box=SecretBox(None), env={})
    ss.use_settings_service(svc)

    nurse = _user("nurse", "read", "write", "order:lab")
    assert (await apply_role_overrides(nurse)).permissions == ["read", "write", "order:lab"]

    await svc.set("auth.roles", {"nurse": {"permissions": ["read"]}}, "demo-admin")
    narrowed = await apply_role_overrides(nurse)
    assert narrowed.permissions == ["read"]
    assert nurse.permissions == ["read", "write", "order:lab"], "the stored session user is not mutated"

    admin = _user("admin", "read", "admin", "system")
    await svc.set("auth.roles", {"admin": {"permissions": ["read", "admin", "system"]}}, "demo-admin")
    assert "system" in (await apply_role_overrides(admin)).permissions


@pytest.mark.asyncio
async def test_settings_store_failure_leaves_builtin_permissions():
    class Broken:
        async def get_all(self):
            raise ConnectionError("postgres gone")

    ss.use_settings_service(SettingsService(Broken(), secret_box=SecretBox(None), env={}))
    user = _user("nurse", "read", "write")
    assert (await apply_role_overrides(user)).permissions == ["read", "write"]
