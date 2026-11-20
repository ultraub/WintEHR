"""A shared write counter for per-worker caches.

Several uvicorn workers each cache something read from Postgres (settings,
SMART app registrations). A writer bumps a Redis counter; readers re-check
it at most once per `check_seconds` and drop their cache when it moved.
Without Redis (dev, single worker) `changed()` always says "unchanged" and
callers fall back to their own TTL.

    counter = SharedVersionCounter("smart:apps:version")
    if await counter.changed(): reload()
    ...
    await counter.bump()   # after a write
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class SharedVersionCounter:
    def __init__(self, key: str, check_seconds: float = 1.0, client_factory: Optional[Callable[[], Any]] = None,
                 clock: Callable[[], float] = time.monotonic):
        self.key = key
        self.check_seconds = check_seconds
        self._client_factory = client_factory
        self._clock = clock
        self._client: Any = None          # redis client, or False once given up
        self._seen: Optional[str] = None
        self._checked_at: float = -1.0

    async def _redis(self) -> Any:
        if self._client is None:
            try:
                if self._client_factory is not None:
                    self._client = self._client_factory()
                else:
                    url = os.getenv("REDIS_URL")
                    if not url:
                        self._client = False
                    else:
                        import redis.asyncio as aioredis

                        self._client = aioredis.from_url(url, socket_connect_timeout=2)
                        await self._client.ping()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Shared counter %s unavailable (%s); callers rely on their TTL", self.key, exc)
                self._client = False
        return self._client or None

    async def current(self) -> Optional[str]:
        now = self._clock()
        if now - self._checked_at < self.check_seconds:
            return self._seen
        client = await self._redis()
        if client is None:
            return None
        try:
            raw = await client.get(self.key)
            self._seen = raw.decode() if isinstance(raw, (bytes, bytearray)) else (str(raw) if raw is not None else "0")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Shared counter %s read failed (%s)", self.key, exc)
        self._checked_at = now
        return self._seen

    async def changed(self, since: Optional[str]) -> bool:
        """True when the counter differs from `since` (a value `current()` returned earlier)."""
        now = await self.current()
        return now is not None and now != since

    async def bump(self) -> None:
        client = await self._redis()
        if client is None:
            return
        try:
            await client.incr(self.key)
            self._checked_at = -1.0  # this process re-reads on its next check
        except Exception as exc:  # noqa: BLE001
            logger.warning("Shared counter %s bump failed (%s)", self.key, exc)

    def reset(self) -> None:
        """Test hook."""
        self._client = None
        self._seen = None
        self._checked_at = -1.0
