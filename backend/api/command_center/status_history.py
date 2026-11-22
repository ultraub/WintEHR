"""Health history (slice 17): status over time, not just right now.

Every status report (`CommandCenterService.status()`) records one row in
`system.status_history`: when, the overall state, and each component's
state. A sampler takes a report every `COMMAND_CENTER_SAMPLE_SECONDS`
(default 300; 0 disables) so the history is continuous even when nobody
has the Status tab open. With several uvicorn workers the sampler is
elected per tick through a Redis lock (`status:sampler`, SET NX with a
TTL); without Redis each worker checks the newest row first, so at worst
a tick is sampled twice, never missed. Rows older than RETENTION_DAYS are
pruned on insert.

`history()` turns the rows into what the History card shows: the samples
in a window, uptime per component (share of samples that were `ok` or
`absent`), and incidents (contiguous runs of a component being degraded
or down, with first / last seen).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Protocol

from sqlalchemy import text

from .models import HistoryIncident, HistoryResponse, HistorySample, StatusReport

logger = logging.getLogger(__name__)

RETENTION_DAYS = int(os.getenv("COMMAND_CENTER_HISTORY_DAYS", "7"))
SAMPLE_SECONDS = int(os.getenv("COMMAND_CENTER_SAMPLE_SECONDS", "300"))
LOCK_KEY = "status:sampler"
HOURS_MAX = 24 * 7

ENSURE_SCHEMA_SQL = (
    "CREATE SCHEMA IF NOT EXISTS system",
    """
    CREATE TABLE IF NOT EXISTS system.status_history (
        id          BIGSERIAL PRIMARY KEY,
        checked_at  TIMESTAMPTZ NOT NULL,
        overall     TEXT NOT NULL,
        components  TEXT NOT NULL,
        source      TEXT NOT NULL DEFAULT 'request'
    )
    """,
    "CREATE INDEX IF NOT EXISTS system_status_history_checked_at ON system.status_history (checked_at DESC)",
)
INSERT_SQL = "INSERT INTO system.status_history (checked_at, overall, components, source) VALUES (:checked_at, :overall, :components, :source)"
PRUNE_SQL = "DELETE FROM system.status_history WHERE checked_at < :cutoff"
SELECT_SQL = "SELECT checked_at, overall, components, source FROM system.status_history WHERE checked_at >= :since ORDER BY checked_at ASC"
LATEST_SQL = "SELECT checked_at FROM system.status_history ORDER BY checked_at DESC LIMIT 1"


@dataclass(frozen=True)
class Snapshot:
    checked_at: datetime
    overall: str
    components: Dict[str, str]
    source: str = "request"


class StatusHistoryRepository(Protocol):
    async def add(self, snapshot: Snapshot) -> None: ...
    async def since(self, when: datetime) -> List[Snapshot]: ...
    async def latest_at(self) -> Optional[datetime]: ...


class MemoryStatusHistoryRepository:
    def __init__(self):
        self.rows: List[Snapshot] = []

    async def add(self, snapshot: Snapshot) -> None:
        cutoff = snapshot.checked_at - timedelta(days=RETENTION_DAYS)
        self.rows = [r for r in self.rows if r.checked_at >= cutoff]
        self.rows.append(snapshot)

    async def since(self, when: datetime) -> List[Snapshot]:
        return sorted((r for r in self.rows if r.checked_at >= when), key=lambda r: r.checked_at)

    async def latest_at(self) -> Optional[datetime]:
        return max((r.checked_at for r in self.rows), default=None)


class SqlStatusHistoryRepository:
    """`system.status_history` via the app's async engine (schema also in postgres-init/11_system.sql)."""

    def __init__(self, session_maker=None):
        self._session_maker = session_maker
        self._schema_ready = False
        self._lock = asyncio.Lock()

    def _maker(self):
        if self._session_maker is None:
            from database import async_session_maker  # local: tests run without a DB

            self._session_maker = async_session_maker
        return self._session_maker

    async def ensure_schema(self) -> None:
        if self._schema_ready:
            return
        async with self._lock:
            if self._schema_ready:
                return
            async with self._maker()() as session:
                for statement in ENSURE_SCHEMA_SQL:
                    await session.execute(text(statement))
                await session.commit()
            self._schema_ready = True

    async def add(self, snapshot: Snapshot) -> None:
        await self.ensure_schema()
        async with self._maker()() as session:
            await session.execute(text(INSERT_SQL), {"checked_at": snapshot.checked_at, "overall": snapshot.overall,
                                                     "components": json.dumps(snapshot.components), "source": snapshot.source})
            await session.execute(text(PRUNE_SQL), {"cutoff": snapshot.checked_at - timedelta(days=RETENTION_DAYS)})
            await session.commit()

    async def since(self, when: datetime) -> List[Snapshot]:
        await self.ensure_schema()
        async with self._maker()() as session:
            result = await session.execute(text(SELECT_SQL), {"since": when})
            rows = result.all()
        return [Snapshot(checked_at=r[0] if r[0].tzinfo else r[0].replace(tzinfo=timezone.utc), overall=r[1],
                         components=json.loads(r[2]), source=r[3]) for r in rows]

    async def latest_at(self) -> Optional[datetime]:
        await self.ensure_schema()
        async with self._maker()() as session:
            result = await session.execute(text(LATEST_SQL))
            row = result.first()
        if row is None:
            return None
        return row[0] if row[0].tzinfo else row[0].replace(tzinfo=timezone.utc)


def snapshot_of(report: StatusReport, source: str = "request") -> Snapshot:
    return Snapshot(checked_at=report.checked_at, overall=report.status,
                    components={c.name: c.status for c in report.components}, source=source)


HEALTHY = ("ok", "absent")


def summarize(rows: List[Snapshot], hours: int, now: Optional[datetime] = None) -> HistoryResponse:
    """Pure: samples → uptime per component and incidents (runs of not-healthy)."""
    now = now or datetime.now(timezone.utc)
    names: List[str] = []
    for r in rows:
        for name in r.components:
            if name not in names:
                names.append(name)
    uptime: Dict[str, float] = {}
    incidents: List[HistoryIncident] = []
    for name in names:
        seen = [(r.checked_at, r.components[name]) for r in rows if name in r.components]
        if not seen:
            continue
        uptime[name] = round(100.0 * sum(1 for _, s in seen if s in HEALTHY) / len(seen), 1)
        current: Optional[HistoryIncident] = None
        for when, state in seen:
            if state in HEALTHY:
                if current is not None:
                    incidents.append(current)
                    current = None
            elif current is None or current.status != state:
                if current is not None:
                    incidents.append(current)
                current = HistoryIncident(component=name, status=state, first_seen=when, last_seen=when, samples=1, ongoing=False)
            else:
                current = current.model_copy(update={"last_seen": when, "samples": current.samples + 1})
        if current is not None:
            incidents.append(current.model_copy(update={"ongoing": True}))
    overall_uptime = round(100.0 * sum(1 for r in rows if r.overall == "ok") / len(rows), 1) if rows else None
    incidents.sort(key=lambda i: i.first_seen, reverse=True)
    return HistoryResponse(
        hours=hours, since=now - timedelta(hours=hours), samples=[HistorySample(t=r.checked_at, overall=r.overall, components=r.components, source=r.source) for r in rows],
        uptime=uptime, overall_uptime=overall_uptime, incidents=incidents, sample_seconds=SAMPLE_SECONDS, retention_days=RETENTION_DAYS,
    )


class StatusHistoryService:
    def __init__(self, repository: StatusHistoryRepository, lock_client: Any = None):
        self.repository = repository
        self._lock_client = lock_client   # redis-like with set(name, value, nx=, ex=); None = no election

    async def record(self, report: StatusReport, source: str = "request") -> None:
        try:
            await self.repository.add(snapshot_of(report, source))
        except Exception as exc:  # noqa: BLE001 — history must never fail a status request
            logger.warning("Status history write failed: %s", exc)

    async def history(self, hours: int) -> HistoryResponse:
        hours = max(1, min(int(hours), HOURS_MAX))
        now = datetime.now(timezone.utc)
        return summarize(await self.repository.since(now - timedelta(hours=hours)), hours, now)

    async def should_sample(self, interval: float, now: Optional[datetime] = None) -> bool:
        """This worker takes the sample only if the newest row is older than the interval
        and (when Redis is there) it wins the per-tick lock."""
        now = now or datetime.now(timezone.utc)
        latest = await self.repository.latest_at()
        if latest is not None and (now - latest).total_seconds() < interval * 0.9:
            return False
        if self._lock_client is None:
            return True
        try:
            won = await self._lock_client.set(LOCK_KEY, "1", nx=True, ex=max(1, int(interval * 0.9)))
            return bool(won)
        except Exception as exc:  # noqa: BLE001 — a lock hiccup must not stop sampling
            logger.warning("Status sampler lock failed (%s); sampling without election", exc)
            return True


# --- process-wide service + sampler -----------------------------------------------------------

_default: Optional[StatusHistoryService] = None


def default_status_history() -> StatusHistoryService:
    global _default
    if _default is None:
        _default = StatusHistoryService(SqlStatusHistoryRepository(), lock_client=_redis_or_none())
    return _default


def use_status_history(service: Optional[StatusHistoryService]) -> None:
    global _default
    _default = service


def _redis_or_none() -> Any:
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    try:
        import redis.asyncio as aioredis

        return aioredis.from_url(url, socket_connect_timeout=2)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Status sampler: Redis unavailable (%s); no election between workers", exc)
        return None


async def sampler_tick(service: Optional[StatusHistoryService] = None, interval: float = SAMPLE_SECONDS) -> bool:
    """One sampler round: take a status report if it is this worker's turn. Returns whether it did."""
    service = service or default_status_history()
    if not await service.should_sample(interval):
        return False
    from .service import CommandCenterService

    report = await CommandCenterService(history=None).status()
    await service.record(report, source="sampler")
    return True


async def run_sampler(interval: float = SAMPLE_SECONDS, first_delay: float = 20.0) -> None:
    """The background loop started at app startup (one per worker; election inside the tick)."""
    if interval <= 0:
        return
    await asyncio.sleep(first_delay)
    while True:
        try:
            await sampler_tick(interval=interval)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Status sampler tick failed: %s", exc)
        await asyncio.sleep(interval)


def start_sampler() -> Optional[asyncio.Task]:
    if SAMPLE_SECONDS <= 0:
        logger.info("Status sampler disabled (COMMAND_CENTER_SAMPLE_SECONDS=0)")
        return None
    return asyncio.create_task(run_sampler(), name="command-center-status-sampler")
