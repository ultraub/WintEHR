"""User management (slice 16): validator guard rails, the service over the setting
(audit without hashes), login with custom / disabled users, the per-request
disabled check, and the login picker. No Postgres, no patch()."""

from __future__ import annotations

import json

import pytest
from fastapi import HTTPException

from api.auth.jwt_handler import get_password_hash
from api.auth.service import enabled_usernames, resolve_login_user, user_disabled
from api.command_center import settings_service as ss
from api.command_center.models import UserCreate, UserUpdate
from api.command_center.secrets import SecretBox
from api.command_center.settings_registry import SettingValueError, get_definition
from api.command_center.settings_repository import MemorySettingsRepository
from api.command_center.settings_service import SettingsError, SettingsService
from api.command_center.users import USERS_SETTING, UsersService, normalize_users, user_record


class FakeAudit:
    def __init__(self):
        self.events = []

    async def log_event(self, **kw):
        self.events.append(kw)


@pytest.fixture
def svc():
    audit = FakeAudit()
    service = SettingsService(MemorySettingsRepository(), secret_box=SecretBox("pw"), audit=audit, env={})
    ss.use_settings_service(service)   # so the auth path's get_setting() sees the same store
    yield UsersService(service), audit
    ss.use_settings_service(None)


HASH = get_password_hash("s3cret")


def test_validator_separates_builtin_from_custom_and_protects_admin():
    out = normalize_users({"nurse": {"disabled": True}, "jsmith": {"name": "Jane", "role": "nurse", "password_hash": HASH, "permissions": ["read", "read"]}})
    assert out["nurse"] == {"disabled": True}
    assert out["jsmith"]["email"] == "jsmith@wintehr.example.com" and out["jsmith"]["permissions"] == ["read"] and out["jsmith"]["disabled"] is False
    assert normalize_users({"nurse": {"disabled": False}}) == {}   # a built-in that is enabled is the default; nothing stored
    for bad in (
        [], {"Bad Name": {}}, {"nurse": {"name": "x"}}, {"admin": {"disabled": True}},
        {"jsmith": {"role": "nurse", "password_hash": HASH}}, {"jsmith": {"name": "J", "password_hash": HASH}},
        {"jsmith": {"name": "J", "role": "nurse", "password_hash": "plain"}},
        {"jsmith": {"name": "J", "role": "nurse", "password_hash": HASH, "permissions": ["raed"]}},
        {"jsmith": {"name": "J", "role": "nurse", "password_hash": HASH, "shoe_size": 9}},
    ):
        with pytest.raises(SettingValueError):
            normalize_users(bad)
    assert get_definition(USERS_SETTING).audit_value is False


@pytest.mark.asyncio
async def test_create_update_disable_delete_through_the_setting_with_hashless_audit(svc):
    users, audit = svc
    view = await users.create(UserCreate(username="jsmith", name="Jane Smith", role="nurse", password="s3cret", department="ICU"), "demo-admin")
    assert view.source == "custom" and view.permissions == ["read", "write", "order:lab"] and not view.permissions_explicit
    assert view.id == "user-jsmith" and view.email == "jsmith@wintehr.example.com"
    assert "password" not in view.model_dump_json() and "$2" not in view.model_dump_json()
    with pytest.raises(SettingsError) as exc:
        await users.create(UserCreate(username="jsmith", name="x", role="nurse", password="abcd"), "demo-admin")
    assert exc.value.status_code == 409
    with pytest.raises(SettingsError):
        await users.create(UserCreate(username="nurse", name="x", role="nurse", password="abcd"), "demo-admin")

    assert await resolve_login_user("jsmith", "s3cret") is not None
    assert await resolve_login_user("jsmith", "wrong") is None

    view = await users.update("jsmith", UserUpdate(role="pharmacist", password="newpass"), "demo-admin")
    assert view.role == "pharmacist" and view.permissions == ["read", "write", "pharmacy:dispense", "pharmacy:review"]
    assert await resolve_login_user("jsmith", "newpass") is not None and await resolve_login_user("jsmith", "s3cret") is None

    view = await users.update("jsmith", UserUpdate(disabled=True), "demo-admin")
    assert view.disabled and await resolve_login_user("jsmith", "newpass") is None and await user_disabled("jsmith")

    # built-ins: disable / enable only
    view = await users.update("nurse", UserUpdate(disabled=True), "demo-admin")
    assert view.disabled and view.source == "builtin"
    assert await resolve_login_user("nurse", "password") is None and await user_disabled("nurse")
    view = await users.update("nurse", UserUpdate(disabled=False), "demo-admin")
    assert not view.disabled and await resolve_login_user("nurse", "password") is not None
    with pytest.raises(SettingsError):
        await users.update("nurse", UserUpdate(name="Renamed"), "demo-admin")
    with pytest.raises(SettingsError):
        await users.update("admin", UserUpdate(disabled=True), "demo-admin")
    with pytest.raises(SettingsError) as exc:
        await users.update("admin", UserUpdate(disabled=True), "demo-admin", acting_username="admin")
    assert exc.value.status_code == 409
    with pytest.raises(SettingsError):
        await users.delete("nurse", "demo-admin")
    with pytest.raises(SettingsError):
        await users.delete("jsmith", "demo-admin", acting_username="jsmith")
    await users.delete("jsmith", "demo-admin")
    assert [u.username for u in await users.list()] == ["demo", "nurse", "pharmacist", "admin"]
    with pytest.raises(SettingsError) as exc:
        await users.delete("jsmith", "demo-admin")
    assert exc.value.status_code == 404

    types = [e["event_type"] for e in audit.events]
    assert types.count("system.user.created") == 1 and types.count("system.user.deleted") == 1 and types.count("system.user.updated") == 4
    dumped = json.dumps(audit.events, default=str)
    assert "$2" not in dumped and "newpass" not in dumped and "s3cret" not in dumped   # hashes and passwords never reach the audit trail
    assert all("value" not in e["details"] for e in audit.events if e["event_type"] == "system.setting.updated")


@pytest.mark.asyncio
async def test_login_picker_and_user_records_follow_the_setting(svc):
    users, _ = svc
    assert await enabled_usernames() == ["demo", "nurse", "pharmacist", "admin"]
    await users.create(UserCreate(username="jsmith", name="Jane", role="nurse", password="s3cret", permissions=["read"]), "demo-admin")
    await users.update("pharmacist", UserUpdate(disabled=True), "demo-admin")
    assert await enabled_usernames() == ["demo", "nurse", "admin", "jsmith"]
    doc = await users.doc()
    assert user_record("jsmith", doc)["permissions"] == ["read"] and user_record("nobody", doc) is None
    assert user_record("pharmacist", doc)["disabled"] is True and user_record("demo", doc)["disabled"] is False


@pytest.mark.asyncio
async def test_a_disabled_user_is_refused_on_their_next_request(svc, monkeypatch):
    users, _ = svc
    from api.auth import service as auth_service
    from api.auth.models import User
    from api.auth.service import get_current_user

    await users.update("nurse", UserUpdate(disabled=True), "demo-admin")

    class FakeAuth:
        def __init__(self, db):
            pass

        async def get_current_user_from_token(self, token):
            return User(id="demo-nurse", username="nurse", name="N", email="n@example.com", role="nurse", permissions=["read"])

    class Ctx:
        async def __aenter__(self):
            return None

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(auth_service, "AuthService", FakeAuth)
    monkeypatch.setattr(auth_service, "get_db_context", lambda: Ctx())
    with pytest.raises(HTTPException) as exc:
        await get_current_user(credentials=None, authorization="Bearer training-session-x")
    assert exc.value.status_code == 401 and "disabled" in exc.value.detail
    await users.update("nurse", UserUpdate(disabled=False), "demo-admin")
    assert (await get_current_user(credentials=None, authorization="Bearer training-session-x")).username == "nurse"
