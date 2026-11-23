"""SessionStore: sessions must be visible from every uvicorn worker.

Regression for the prod-profile bug where `training-session-*` tokens lived
in a per-process dict and `uvicorn --workers 4` rejected ~3 of 4 requests
with a valid token. A FakeRedis stands in for the shared store; two
SessionStore instances sharing it model two workers.
"""

from __future__ import annotations

import fnmatch
from datetime import datetime, timedelta

import pytest

from api.auth.models import User
from api.auth.practitioner_auth_service import PractitionerAuthService
from api.auth.service import AuthService
from api.auth.session_store import SessionStore


class FakeRedis:
    """The subset of redis.asyncio the store uses, with TTL bookkeeping."""

    def __init__(self):
        self.data: dict[str, tuple[str, int | None]] = {}
        self.set_calls: list[tuple[str, int | None]] = []

    async def ping(self):
        return True

    async def set(self, key, value, ex=None):
        self.data[key] = (value, ex)
        self.set_calls.append((key, ex))

    async def get(self, key):
        entry = self.data.get(key)
        return entry[0].encode() if entry else None

    async def delete(self, key):
        return 1 if self.data.pop(key, None) is not None else 0

    async def scan_iter(self, match="*"):
        for key in list(self.data):
            if fnmatch.fnmatch(key, match):
                yield key.encode()

    async def aclose(self):
        pass


def _user(uid="demo-physician", *permissions):
    return User(
        id=uid, username="demo", name="Demo", email="demo@example.com", role="physician",
        permissions=list(permissions) or ["read"],
    )


# --- the store itself -----------------------------------------------------


@pytest.mark.asyncio
async def test_two_workers_share_sessions_through_redis():
    redis = FakeRedis()
    worker_a = SessionStore("training", ttl_seconds=60, redis_client=redis)
    worker_b = SessionStore("training", ttl_seconds=60, redis_client=redis)

    await worker_a.put("tok", {"user": {"id": "u1"}, "created_at": datetime(2026, 1, 1, 12, 0)})

    session = await worker_b.get("tok")
    assert session["user"]["id"] == "u1"
    assert session["created_at"] == datetime(2026, 1, 1, 12, 0), "datetimes round-trip"
    assert worker_a.shared and worker_b.shared
    assert redis.set_calls == [("session:training:tok", 60)], "every key carries the TTL"


@pytest.mark.asyncio
async def test_namespaces_do_not_collide():
    redis = FakeRedis()
    training = SessionStore("training", redis_client=redis)
    practitioner = SessionStore("practitioner", redis_client=redis)
    await training.put("same-token", {"user": {"id": "t"}})
    await practitioner.put("same-token", {"user": {"id": "p"}})
    assert (await training.get("same-token"))["user"]["id"] == "t"
    assert (await practitioner.get("same-token"))["user"]["id"] == "p"
    assert len(await training.items()) == 1


@pytest.mark.asyncio
async def test_delete_where_removes_only_matching_sessions_on_the_shared_store():
    redis = FakeRedis()
    store = SessionStore("training", redis_client=redis)
    await store.put("a", {"user": {"id": "u1"}})
    await store.put("b", {"user": {"id": "u1"}})
    await store.put("c", {"user": {"id": "u2"}})

    removed = await store.delete_where(lambda s: s["user"]["id"] == "u1")

    assert removed == 2
    assert await store.get("a") is None and await store.get("b") is None
    assert (await store.get("c"))["user"]["id"] == "u2"


@pytest.mark.asyncio
async def test_in_process_fallback_when_redis_is_unset_expires_sessions():
    store = SessionStore("training", ttl_seconds=60, redis_url="")
    await store.put("tok", {"user": {"id": "u1"}})
    assert (await store.get("tok"))["user"]["id"] == "u1"
    assert store.shared is False

    # Age the entry past its TTL.
    session, _ = store._memory["tok"]
    store._memory["tok"] = (session, datetime.utcnow() - timedelta(seconds=1))
    assert await store.get("tok") is None
    assert await store.items() == []


@pytest.mark.asyncio
async def test_unreachable_redis_falls_back_instead_of_failing_logins(caplog):
    # A URL nothing listens on: the first operation must degrade, not raise.
    store = SessionStore("training", redis_url="redis://127.0.0.1:1/0")
    await store.put("tok", {"user": {"id": "u1"}})
    assert (await store.get("tok"))["user"]["id"] == "u1"
    assert store.shared is False
    assert "falling back to in-process sessions" in caplog.text


# --- the two auth services on top of it -----------------------------------


@pytest.mark.asyncio
async def test_training_login_on_one_worker_resolves_on_another(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(AuthService, "training_sessions", SessionStore("training", redis_client=redis))
    monkeypatch.setattr("api.auth.service.JWT_ENABLED", False)

    class _Audit:
        async def log_login_attempt(self, **kwargs):
            pass

    monkeypatch.setattr("api.auth.service.AuditEventService", lambda *a, **k: _Audit())

    worker_a = AuthService(db=None)
    response = await worker_a.login("demo", "password")
    token = response["session_token"]
    assert token.startswith("training-session-")

    # A fresh AuthService (another worker) with the same Redis sees the login.
    monkeypatch.setattr(AuthService, "training_sessions", SessionStore("training", redis_client=redis))
    worker_b = AuthService(db=None)
    user = await worker_b.get_current_user_from_token(token)
    assert user is not None and user.username == "demo"
    # the demo physician is a clinician, not an administrator
    assert "prescribe" in user.permissions and "admin" not in user.permissions

    # Logout from worker B drops the session for worker A too.
    await AuthService.training_sessions.delete_where(lambda s: s["user"]["id"] == user.id)
    assert await worker_a.get_current_user_from_token(token) is None


@pytest.mark.asyncio
async def test_practitioner_sessions_round_trip_and_expire():
    redis = FakeRedis()
    svc = PractitionerAuthService()
    svc.active_sessions = SessionStore("practitioner", redis_client=redis)
    user = _user("prac-1", "read", "write")

    await svc.active_sessions.put("practitioner-session-x", {
        "user": user.dict(),
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "ip_address": "127.0.0.1",
    })
    resolved = await svc.validate_session("practitioner-session-x")
    assert isinstance(resolved, User) and resolved.id == "prac-1"

    await svc.active_sessions.put("practitioner-session-old", {
        "user": user.dict(),
        "created_at": datetime.utcnow() - timedelta(days=2),
        "expires_at": datetime.utcnow() - timedelta(days=1),
    })
    assert await svc.validate_session("practitioner-session-old") is None
    assert await svc.active_sessions.get("practitioner-session-old") is None, "expired session is purged"

    assert await svc.logout("practitioner-session-x") is True
    assert await svc.logout("practitioner-session-x") is False
