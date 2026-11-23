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


# --- passwords: the administrator's own, per-user, and required for everyone --------------------

@pytest.fixture
def admin_password(monkeypatch):
    from api.auth import config

    monkeypatch.setattr(config, "ADMIN_PASSWORD", "from-the-server")
    yield "from-the-server"


async def _set(svc_pair, key, value):
    users, _audit = svc_pair
    await users.settings.set(key, value, "tester")


@pytest.mark.asyncio
async def test_admin_stops_taking_the_training_password_once_the_server_sets_one(svc, admin_password):
    assert await resolve_login_user("admin", "password") is None
    assert (await resolve_login_user("admin", admin_password)).username == "admin"
    # the other demo logins are untouched
    assert (await resolve_login_user("demo", "password")).username == "demo"


@pytest.mark.asyncio
async def test_a_builtin_user_given_a_password_takes_only_that_and_keeps_it_when_disabled_and_re_enabled(svc):
    users, audit = svc
    view = await users.update("nurse", UserUpdate(password="night-shift"), "admin-1")
    assert view.credential == "own"
    assert await resolve_login_user("nurse", "password") is None
    assert (await resolve_login_user("nurse", "night-shift")).username == "nurse"

    await users.update("nurse", UserUpdate(disabled=True), "admin-1")
    assert await resolve_login_user("nurse", "night-shift") is None
    await users.update("nurse", UserUpdate(disabled=False), "admin-1")
    assert (await resolve_login_user("nurse", "night-shift")).username == "nurse"

    view = await users.update("nurse", UserUpdate(remove_password=True), "admin-1")
    assert view.credential == "training"
    assert (await resolve_login_user("nurse", "password")).username == "nurse"
    assert USERS_SETTING and "nurse" not in await users.doc()   # back to the code's defaults: nothing stored
    assert all("night-shift" not in json.dumps(e, default=str) for e in audit.events)


@pytest.mark.asyncio
async def test_admin_accepts_its_stored_password_and_the_server_one_as_recovery(svc, admin_password):
    users, _ = svc
    await users.update("admin", UserUpdate(password="chosen-in-the-ui"), "admin-1")
    assert (await resolve_login_user("admin", "chosen-in-the-ui")).username == "admin"
    assert (await resolve_login_user("admin", admin_password)).username == "admin"
    assert await resolve_login_user("admin", "password") is None


@pytest.mark.asyncio
async def test_requiring_passwords_closes_every_login_without_one_and_hides_the_user_list(svc):
    from api.auth.service import login_options

    users, _ = svc
    options = await login_options()
    assert options["require_passwords"] is False
    by_name = {u["username"]: u for u in options["users"]}
    assert by_name["demo"]["password_required"] is False

    await users.update("demo", UserUpdate(password="clinic-pass"), "admin-1")
    by_name = {u["username"]: u for u in (await login_options())["users"]}
    assert by_name["demo"]["password_required"] is True and by_name["nurse"]["password_required"] is False

    await users.update("admin", UserUpdate(password="admin-pass"), "admin-1")   # required before the switch
    await _set(svc, "auth.require_passwords", True)
    assert await login_options() == {"require_passwords": True, "users": []}
    assert await resolve_login_user("nurse", "password") is None          # no password of its own
    assert (await resolve_login_user("demo", "clinic-pass")).username == "demo"
    assert await resolve_login_user("admin", "password") is None


def test_validator_accepts_a_builtin_password_hash_and_nothing_else():
    out = normalize_users({"admin": {"password_hash": HASH}, "nurse": {"disabled": True, "password_hash": HASH}})
    assert out == {"admin": {"password_hash": HASH}, "nurse": {"disabled": True, "password_hash": HASH}}
    with pytest.raises(SettingValueError):
        normalize_users({"admin": {"password_hash": "plain"}})
    with pytest.raises(SettingValueError):
        normalize_users({"nurse": {"name": "Renamed"}})


@pytest.mark.asyncio
async def test_passwords_cannot_be_required_or_the_admin_password_removed_into_a_lockout(svc):
    users, _ = svc
    with pytest.raises(SettingsError) as refused:
        await users.settings.set("auth.require_passwords", True, "tester")
    assert refused.value.status_code == 409

    await users.update("admin", UserUpdate(password="chosen-in-the-ui"), "admin-1")
    await users.settings.set("auth.require_passwords", True, "tester")
    with pytest.raises(SettingsError) as locked:
        await users.update("admin", UserUpdate(remove_password=True), "admin-1")
    assert locked.value.status_code == 409
    assert (await resolve_login_user("admin", "chosen-in-the-ui")).username == "admin"
