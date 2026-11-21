"""Active sessions (slice 15): who is logged in right now, and revoking them.

Training (`training-session-*`) and practitioner (`practitioner-session-*`)
logins live in the shared SessionStore (api/auth/session_store.py), one
namespace each, so every uvicorn worker sees the same list. This module
reads both stores and never exposes a token: a session is addressed by
`session_id()`, the first 16 hex of its SHA-256, which is enough to pick a
row and useless for authenticating.

JWT mode has no server-side session, so the list is empty with a note.

Revoking (`system`) deletes the token from the store; the user's next
request is a 401 and the client sends them back to login. Audited as
`system.session.revoked` (never with the token).
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from api.auth.session_store import SessionStore

from .models import SessionView, SessionsResponse

logger = logging.getLogger(__name__)


def session_id(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:16]


def _utc(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return None


def session_view(kind: str, token: str, session: Dict[str, Any], ttl_seconds: int, current_token: Optional[str]) -> SessionView:
    user = session.get("user") or {}
    created = _utc(session.get("created_at"))
    expires = _utc(session.get("expires_at")) or (created + timedelta(seconds=ttl_seconds) if created else None)
    return SessionView(
        id=session_id(token), kind=kind,
        user_id=user.get("id"), username=user.get("username"), name=user.get("name"), role=user.get("role"),
        permissions=list(user.get("permissions") or []),
        created_at=created, expires_at=expires,
        ip=session.get("ip_address"), user_agent=session.get("user_agent"),
        current=bool(current_token) and token == current_token,
    )


class SessionsService:
    def __init__(self, stores: Dict[str, SessionStore], audit: Any = None, jwt_enabled: bool = False):
        self.stores = stores
        self.audit = audit
        self.jwt_enabled = jwt_enabled

    async def _all(self) -> List[tuple[str, str, Dict[str, Any], SessionStore]]:
        rows = []
        for kind, store in self.stores.items():
            for token, session in await store.items():
                rows.append((kind, token, session, store))
        return rows

    async def list(self, current_token: Optional[str] = None) -> SessionsResponse:
        if self.jwt_enabled:
            return SessionsResponse(mode="jwt", sessions=[], shared=None,
                                    note="JWT mode: tokens are self-contained and not tracked server-side, so there is nothing to list or revoke.")
        views = [session_view(kind, token, session, store.ttl_seconds, current_token) for kind, token, session, store in await self._all()]
        views.sort(key=lambda v: v.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        shared = any(store.shared for store in self.stores.values()) if self.stores else None
        return SessionsResponse(mode="training", sessions=views, shared=shared, note=None if shared else
                                "Sessions are in-process on this worker (no Redis); with several workers this list is partial.")

    async def revoke(self, sid: str, revoked_by: Optional[str]) -> int:
        removed = 0
        for kind, token, session, store in await self._all():
            if session_id(token) == sid and await store.delete(token):
                removed += 1
                await self._audit(revoked_by, {"action": "delete", "session": sid, "kind": kind,
                                               "user": (session.get("user") or {}).get("username")})
        return removed

    async def revoke_user(self, user_id: str, revoked_by: Optional[str]) -> int:
        removed = 0
        for kind, token, session, store in await self._all():
            if (session.get("user") or {}).get("id") == user_id and await store.delete(token):
                removed += 1
        if removed:
            await self._audit(revoked_by, {"action": "delete", "user_id": user_id, "sessions": removed})
        return removed

    async def _audit(self, user_id: Optional[str], details: Dict[str, Any]) -> None:
        if self.audit is None:
            return
        try:
            await self.audit.log_event(event_type="system.session.revoked", user_id=user_id, action="delete", outcome="success", details=details)
        except Exception as exc:  # noqa: BLE001 — audit must never block an admin action
            logger.warning("Audit of session revoke failed: %s", exc)


_default: Optional[SessionsService] = None


def default_sessions_service() -> SessionsService:
    global _default
    if _default is None:
        from api.auth.config import JWT_ENABLED
        from api.auth.practitioner_auth_service import get_practitioner_auth_service
        from api.auth.service import AuthService
        from api.services.audit_event_service import AuditEventService

        _default = SessionsService(
            {"training": AuthService.training_sessions, "practitioner": get_practitioner_auth_service().active_sessions},
            audit=AuditEventService(), jwt_enabled=JWT_ENABLED,
        )
    return _default


def use_sessions_service(service: Optional[SessionsService]) -> None:
    global _default
    _default = service
