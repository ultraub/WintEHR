"""Session store shared across uvicorn workers.

Training (`training-session-*`) and practitioner (`practitioner-session-*`)
sessions used to live in per-process dicts. The prod profile runs
`uvicorn --workers 4`, so a token minted by one worker was unknown to the
other three and every strictly authenticated request failed ~3 times in 4.

When `REDIS_URL` is set the store keeps sessions in Redis (one key per
token, with a TTL) so every worker sees every session. Without Redis, or
if Redis cannot be reached at first use, it falls back to an in-process
dict with the same TTL semantics — correct for single-worker dev, and the
fallback is logged once so a multi-worker box never silently degrades.

Sessions are plain dicts of JSON-serialisable values; `datetime` values
at the top level are stored as ISO strings and restored on read.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_SESSION_TTL_SECONDS = 24 * 60 * 60
_DATETIME_KEYS = ("created_at", "expires_at")


def _encode(session: Dict[str, Any]) -> str:
    out = dict(session)
    for key in _DATETIME_KEYS:
        value = out.get(key)
        if isinstance(value, datetime):
            out[key] = value.isoformat()
    return json.dumps(out, default=str)


def _decode(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode()
    session = json.loads(raw)
    for key in _DATETIME_KEYS:
        value = session.get(key)
        if isinstance(value, str):
            try:
                session[key] = datetime.fromisoformat(value)
            except ValueError:
                pass
    return session


class SessionStore:
    """Token → session mapping; Redis-backed when configured, else in-process."""

    def __init__(
        self,
        namespace: str,
        ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS,
        redis_url: Optional[str] = None,
        redis_client: Any = None,
    ):
        self.namespace = namespace
        self.ttl_seconds = ttl_seconds
        self._redis_url = redis_url if redis_url is not None else os.getenv("REDIS_URL")
        self._redis = redis_client
        self._redis_checked = redis_client is not None
        self._memory: Dict[str, Tuple[Dict[str, Any], datetime]] = {}

    # --- backend selection ------------------------------------------------

    def _key(self, token: str) -> str:
        return f"session:{self.namespace}:{token}"

    async def _client(self) -> Any:
        """The Redis client, or None once the in-process fallback is chosen."""
        if self._redis_checked:
            return self._redis
        self._redis_checked = True
        if not self._redis_url:
            logger.info("SessionStore[%s]: REDIS_URL unset, using in-process sessions", self.namespace)
            return None
        try:
            import redis.asyncio as aioredis

            client = aioredis.from_url(self._redis_url, socket_connect_timeout=3)
            await client.ping()
        except Exception as exc:  # noqa: BLE001 — any failure means "no shared store"
            logger.warning(
                "SessionStore[%s]: Redis at %s unreachable (%s); falling back to "
                "in-process sessions. With more than one uvicorn worker, logins "
                "will not be shared across workers.",
                self.namespace, self._redis_url, exc,
            )
            return None
        self._redis = client
        return client

    @property
    def shared(self) -> bool:
        """True once Redis is in use (meaningful after the first operation)."""
        return self._redis is not None

    # --- operations ---------------------------------------------------------

    async def put(self, token: str, session: Dict[str, Any]) -> None:
        client = await self._client()
        if client is not None:
            await client.set(self._key(token), _encode(session), ex=self.ttl_seconds)
            return
        self._memory[token] = (dict(session), datetime.utcnow() + timedelta(seconds=self.ttl_seconds))

    async def get(self, token: str) -> Optional[Dict[str, Any]]:
        client = await self._client()
        if client is not None:
            raw = await client.get(self._key(token))
            return _decode(raw) if raw is not None else None
        entry = self._memory.get(token)
        if entry is None:
            return None
        session, expires_at = entry
        if datetime.utcnow() > expires_at:
            del self._memory[token]
            return None
        return dict(session)

    async def delete(self, token: str) -> bool:
        client = await self._client()
        if client is not None:
            return bool(await client.delete(self._key(token)))
        return self._memory.pop(token, None) is not None

    async def items(self) -> List[Tuple[str, Dict[str, Any]]]:
        """Every live (token, session) pair. Small sets only — this scans."""
        client = await self._client()
        if client is not None:
            prefix = self._key("")
            found: List[Tuple[str, Dict[str, Any]]] = []
            async for key in client.scan_iter(match=prefix + "*"):
                key_str = key.decode() if isinstance(key, (bytes, bytearray)) else key
                raw = await client.get(key_str)
                if raw is not None:
                    found.append((key_str[len(prefix):], _decode(raw)))
            return found
        now = datetime.utcnow()
        return [(t, dict(s)) for t, (s, exp) in list(self._memory.items()) if exp > now]

    async def delete_where(self, predicate: Callable[[Dict[str, Any]], bool]) -> int:
        """Delete every session the predicate matches (e.g. all of one user's)."""
        removed = 0
        for token, session in await self.items():
            if predicate(session) and await self.delete(token):
                removed += 1
        return removed

    async def clear(self) -> None:
        """Test helper: drop every session in this namespace."""
        for token, _ in await self.items():
            await self.delete(token)
        self._memory.clear()
