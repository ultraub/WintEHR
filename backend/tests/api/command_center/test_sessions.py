"""Active sessions (slice 15): listing from both stores without tokens, the current
marker, revoke by id and by user with audit, JWT mode, in-process note."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from api.auth.session_store import SessionStore
from api.command_center.router import list_sessions, revoke_session, revoke_user_sessions
from api.command_center.sessions import SessionsService, session_id


class FakeAudit:
    def __init__(self):
        self.events = []

    async def log_event(self, **kw):
        self.events.append(kw)


class _User:
    id = "demo-admin"


def _user(uid, username, role="physician"):
    return {"id": uid, "username": username, "name": username.title(), "role": role, "permissions": ["read"]}


async def _service(audit=None):
    training = SessionStore("training", ttl_seconds=3600, redis_url="")
    practitioner = SessionStore("practitioner", ttl_seconds=7200, redis_url="")
    from datetime import datetime, timedelta
    await training.put("training-session-AAA", {"user": _user("demo-physician", "demo"), "created_at": datetime(2026, 11, 21, 10, 0), "ip_address": "10.0.0.5", "user_agent": "Firefox"})
    await training.put("training-session-BBB", {"user": _user("demo-admin", "admin", "admin"), "created_at": datetime(2026, 11, 21, 11, 0)})
    await training.put("training-session-CCC", {"user": _user("demo-physician", "demo"), "created_at": datetime(2026, 11, 21, 9, 0)})
    await practitioner.put("practitioner-session-PPP", {"user": _user("78", "Reilly981"), "created_at": datetime(2026, 11, 21, 8, 0),
                                                        "expires_at": datetime(2026, 11, 21, 8, 0) + timedelta(hours=24), "ip_address": "10.0.0.9"})
    return SessionsService({"training": training, "practitioner": practitioner}, audit=audit), training, practitioner


@pytest.mark.asyncio
async def test_list_shows_every_store_newest_first_without_tokens_and_marks_the_caller():
    svc, _, _ = await _service()
    body = await list_sessions(authorization="Bearer training-session-BBB", _user=_User(), sessions=svc)
    assert body.mode == "training" and body.shared is False and "in-process" in body.note
    assert [s.username for s in body.sessions] == ["admin", "demo", "demo", "Reilly981"]
    assert [s.kind for s in body.sessions] == ["training", "training", "training", "practitioner"]
    me = body.sessions[0]
    assert me.current is True and me.role == "admin" and me.id == session_id("training-session-BBB")
    assert all(not s.current for s in body.sessions[1:])
    demo = body.sessions[1]
    assert demo.ip == "10.0.0.5" and demo.user_agent == "Firefox"
    assert demo.expires_at.isoformat().startswith("2026-11-21T11:00:00")  # created + the store's TTL
    assert body.sessions[3].expires_at.isoformat().startswith("2026-11-22T08:00:00")  # explicit expires_at wins
    dumped = body.model_dump_json()
    for token in ("training-session-AAA", "training-session-BBB", "practitioner-session-PPP"):
        assert token not in dumped
    assert len(me.id) == 16


@pytest.mark.asyncio
async def test_revoke_one_and_revoke_all_for_a_user_are_audited_without_tokens():
    audit = FakeAudit()
    svc, training, practitioner = await _service(audit)
    sid = session_id("training-session-AAA")
    assert await revoke_session(sid, user=_User(), sessions=svc) == {"revoked": 1}
    assert await training.get("training-session-AAA") is None and await training.get("training-session-CCC") is not None
    assert audit.events[-1]["event_type"] == "system.session.revoked" and audit.events[-1]["details"]["session"] == sid
    assert audit.events[-1]["details"]["user"] == "demo" and "training-session" not in str(audit.events[-1])
    with pytest.raises(HTTPException) as exc:
        await revoke_session(sid, user=_User(), sessions=svc)
    assert exc.value.status_code == 404

    assert await revoke_user_sessions(user_id="demo-physician", user=_User(), sessions=svc) == {"revoked": 1}  # CCC
    assert await revoke_user_sessions(user_id="demo-physician", user=_User(), sessions=svc) == {"revoked": 0}
    assert audit.events[-1]["details"] == {"action": "delete", "user_id": "demo-physician", "sessions": 1}
    remaining = (await svc.list()).sessions
    assert sorted(s.username for s in remaining) == ["Reilly981", "admin"]
    assert await practitioner.get("practitioner-session-PPP") is not None


@pytest.mark.asyncio
async def test_jwt_mode_has_nothing_to_list():
    svc = SessionsService({}, jwt_enabled=True)
    body = await svc.list()
    assert body.mode == "jwt" and body.sessions == [] and "JWT" in body.note
