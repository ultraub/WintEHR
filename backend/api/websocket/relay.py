"""Cross-worker relay for WebSocket broadcasts.

The prod profile runs `uvicorn --workers 4`, and each worker keeps its own
in-memory table of connected browsers. A broadcast raised in one worker
therefore reached only the browsers that happened to be connected to that
same worker — about one in four.

With `REDIS_URL` set, every worker publishes its broadcasts to one Redis
pub/sub channel and listens on it. A worker always delivers to its own
connections directly (so live updates never depend on Redis being up) and
relays to the others; each message carries the publishing worker's id so a
worker skips its own echo.

Without Redis, or if Redis cannot be reached, the relay is simply off:
delivery stays in-process, which is correct for single-worker dev. The
fallback is logged once so a multi-worker box never degrades silently. This
mirrors `api/auth/session_store.py`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from typing import Any, Awaitable, Callable, Dict, Optional

logger = logging.getLogger(__name__)

CHANNEL = "wintehr:ws:broadcast"

Handler = Callable[[Dict[str, Any]], Awaitable[None]]


class BroadcastRelay:
    """Publishes broadcast envelopes to peers and hands peers' envelopes to a handler."""

    def __init__(
        self,
        redis_url: Optional[str] = None,
        redis_client: Any = None,
        channel: str = CHANNEL,
        retry_seconds: float = 2.0,
    ):
        self.origin = uuid.uuid4().hex
        self.channel = channel
        self.retry_seconds = retry_seconds
        self._redis_url = redis_url if redis_url is not None else os.getenv("REDIS_URL")
        self._redis = redis_client
        self._handler: Optional[Handler] = None
        self._task: Optional[asyncio.Task] = None
        self._listening = asyncio.Event()

    @property
    def shared(self) -> bool:
        """True while broadcasts are being relayed to other workers."""
        return self._redis is not None and self._task is not None and not self._task.done()

    async def start(self, handler: Handler) -> bool:
        """Connect and start listening. Returns False when the relay stays off."""
        if self._task is not None and not self._task.done():
            return True
        self._handler = handler

        if self._redis is None:
            if not self._redis_url:
                logger.info("WebSocket relay: REDIS_URL unset, broadcasts stay in-process")
                return False
            try:
                import redis.asyncio as aioredis

                client = aioredis.from_url(
                    self._redis_url, socket_connect_timeout=3, health_check_interval=30
                )
                await client.ping()
            except Exception as exc:  # noqa: BLE001 — any failure means "no relay"
                logger.warning(
                    "WebSocket relay: Redis at %s unreachable (%s); broadcasts stay "
                    "in-process. With more than one uvicorn worker, live updates "
                    "will only reach clients on the worker that handled the write.",
                    self._redis_url, exc,
                )
                return False
            self._redis = client

        self._listening.clear()
        self._task = asyncio.create_task(self._listen())
        logger.info("WebSocket relay: started on channel %s (worker %s)", self.channel, self.origin[:8])
        return True

    async def wait_until_listening(self, timeout: float = 5.0) -> bool:
        """Block until the subscription is live (used by tests and startup checks)."""
        try:
            await asyncio.wait_for(self._listening.wait(), timeout)
            return True
        except asyncio.TimeoutError:
            return False

    async def stop(self) -> None:
        task, self._task = self._task, None
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass

    async def publish(self, envelope: Dict[str, Any]) -> bool:
        """Relay an envelope to the other workers. Never raises."""
        if self._redis is None or self._task is None:
            return False
        try:
            payload = json.dumps({"origin": self.origin, "envelope": envelope}, default=str)
            await self._redis.publish(self.channel, payload)
            return True
        except Exception as exc:  # noqa: BLE001 — relaying must never break a write
            logger.warning("WebSocket relay: publish failed (%s)", exc)
            return False

    async def _listen(self) -> None:
        """Receive peers' envelopes forever, resubscribing after any failure."""
        while True:
            pubsub = None
            try:
                pubsub = self._redis.pubsub()
                await pubsub.subscribe(self.channel)
                self._listening.set()
                while True:
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
                    if message is None:
                        continue
                    await self._dispatch(message.get("data"))
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — keep listening through Redis restarts
                self._listening.clear()
                logger.warning("WebSocket relay: listener error (%s); retrying in %ss", exc, self.retry_seconds)
                await asyncio.sleep(self.retry_seconds)
            finally:
                if pubsub is not None:
                    try:
                        await pubsub.aclose()
                    except Exception:  # noqa: BLE001
                        pass

    async def _dispatch(self, raw: Any) -> None:
        try:
            if isinstance(raw, (bytes, bytearray)):
                raw = raw.decode()
            parsed = json.loads(raw)
            if parsed.get("origin") == self.origin:
                return  # our own echo — already delivered locally
            envelope = parsed.get("envelope")
            if isinstance(envelope, dict) and self._handler is not None:
                await self._handler(envelope)
        except Exception as exc:  # noqa: BLE001 — one bad message must not stop the listener
            logger.warning("WebSocket relay: dropped a message (%s)", exc)
