"""Storage for jobs: `system.jobs` in Postgres, or memory for tests.

The single-active-job rule is a partial unique index in Postgres (see
postgres-init/11_system.sql), so two workers racing to start a job cannot
both win; the memory repository emulates it.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

ACTIVE_STATUSES = ("queued", "running")

ENSURE_SCHEMA_SQL = (
    "CREATE SCHEMA IF NOT EXISTS system",
    """
    CREATE TABLE IF NOT EXISTS system.jobs (
        id                TEXT PRIMARY KEY,
        kind              TEXT NOT NULL,
        params            TEXT NOT NULL DEFAULT '{}',
        status            TEXT NOT NULL,
        progress          DOUBLE PRECISION,
        message           TEXT,
        started_by        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at        TIMESTAMPTZ,
        finished_at       TIMESTAMPTZ,
        heartbeat_at      TIMESTAMPTZ,
        cancel_requested  BOOLEAN NOT NULL DEFAULT FALSE,
        exit_code         INTEGER,
        log_path          TEXT,
        worker            TEXT
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS system_jobs_one_active
        ON system.jobs ((TRUE)) WHERE status IN ('queued', 'running')
    """,
    "CREATE INDEX IF NOT EXISTS system_jobs_created_at ON system.jobs (created_at DESC)",
)

_COLUMNS = (
    "id, kind, params, status, progress, message, started_by, created_at, started_at, "
    "finished_at, heartbeat_at, cancel_requested, exit_code, log_path, worker"
)
INSERT_SQL = f"""
    INSERT INTO system.jobs ({_COLUMNS})
    VALUES (:id, :kind, :params, :status, :progress, :message, :started_by, :created_at, :started_at,
            :finished_at, :heartbeat_at, :cancel_requested, :exit_code, :log_path, :worker)
"""
SELECT_ONE_SQL = f"SELECT {_COLUMNS} FROM system.jobs WHERE id = :id"
SELECT_RECENT_SQL = f"SELECT {_COLUMNS} FROM system.jobs ORDER BY created_at DESC LIMIT :limit"
SELECT_ACTIVE_SQL = f"SELECT {_COLUMNS} FROM system.jobs WHERE status IN ('queued', 'running')"
UPDATABLE = {"status", "progress", "message", "started_at", "finished_at", "heartbeat_at",
             "cancel_requested", "exit_code", "log_path", "worker"}


class ActiveJobExists(Exception):
    """Another job is queued or running."""


@dataclass(frozen=True)
class StoredJob:
    id: str
    kind: str
    params: str  # JSON text
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None
    started_by: Optional[str] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    heartbeat_at: Optional[datetime] = None
    cancel_requested: bool = False
    exit_code: Optional[int] = None
    log_path: Optional[str] = None
    worker: Optional[str] = None


class JobsRepository(Protocol):
    async def insert(self, job: StoredJob) -> StoredJob: ...
    async def get(self, job_id: str) -> Optional[StoredJob]: ...
    async def recent(self, limit: int = 50) -> List[StoredJob]: ...
    async def active(self) -> List[StoredJob]: ...
    async def update(self, job_id: str, **fields: Any) -> Optional[StoredJob]: ...


class MemoryJobsRepository:
    def __init__(self):
        self.rows: Dict[str, StoredJob] = {}

    async def insert(self, job: StoredJob) -> StoredJob:
        if job.status in ACTIVE_STATUSES and any(r.status in ACTIVE_STATUSES for r in self.rows.values()):
            raise ActiveJobExists()
        self.rows[job.id] = job
        return job

    async def get(self, job_id: str) -> Optional[StoredJob]:
        return self.rows.get(job_id)

    async def recent(self, limit: int = 50) -> List[StoredJob]:
        rows = sorted(self.rows.values(), key=lambda r: r.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return rows[:limit]

    async def active(self) -> List[StoredJob]:
        return [r for r in self.rows.values() if r.status in ACTIVE_STATUSES]

    async def update(self, job_id: str, **fields: Any) -> Optional[StoredJob]:
        row = self.rows.get(job_id)
        if row is None:
            return None
        unknown = set(fields) - UPDATABLE
        if unknown:
            raise ValueError(f"not updatable: {sorted(unknown)}")
        row = replace(row, **fields)
        self.rows[job_id] = row
        return row


def _row_to_job(r) -> StoredJob:
    return StoredJob(
        id=r[0], kind=r[1], params=r[2], status=r[3], progress=r[4], message=r[5], started_by=r[6],
        created_at=r[7], started_at=r[8], finished_at=r[9], heartbeat_at=r[10],
        cancel_requested=bool(r[11]), exit_code=r[12], log_path=r[13], worker=r[14],
    )


class SqlJobsRepository:
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

    async def insert(self, job: StoredJob) -> StoredJob:
        await self.ensure_schema()
        params = {k: getattr(job, k) for k in UPDATABLE | {"id", "kind", "params", "started_by", "created_at"}}
        async with self._maker()() as session:
            try:
                await session.execute(text(INSERT_SQL), params)
                await session.commit()
            except IntegrityError as exc:
                await session.rollback()
                if "system_jobs_one_active" in str(exc.orig if hasattr(exc, "orig") else exc):
                    raise ActiveJobExists() from None
                raise
        return job

    async def get(self, job_id: str) -> Optional[StoredJob]:
        await self.ensure_schema()
        async with self._maker()() as session:
            row = (await session.execute(text(SELECT_ONE_SQL), {"id": job_id})).first()
        return _row_to_job(row) if row else None

    async def recent(self, limit: int = 50) -> List[StoredJob]:
        await self.ensure_schema()
        async with self._maker()() as session:
            rows = (await session.execute(text(SELECT_RECENT_SQL), {"limit": limit})).all()
        return [_row_to_job(r) for r in rows]

    async def active(self) -> List[StoredJob]:
        await self.ensure_schema()
        async with self._maker()() as session:
            rows = (await session.execute(text(SELECT_ACTIVE_SQL))).all()
        return [_row_to_job(r) for r in rows]

    async def update(self, job_id: str, **fields: Any) -> Optional[StoredJob]:
        await self.ensure_schema()
        unknown = set(fields) - UPDATABLE
        if unknown:
            raise ValueError(f"not updatable: {sorted(unknown)}")
        if not fields:
            return await self.get(job_id)
        assignments = ", ".join(f"{k} = :{k}" for k in fields)
        async with self._maker()() as session:
            await session.execute(text(f"UPDATE system.jobs SET {assignments} WHERE id = :id"), {**fields, "id": job_id})
            await session.commit()
        return await self.get(job_id)
