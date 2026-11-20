"""Storage for setting overrides: `system.settings` in Postgres, or memory for tests.

The SQL repository creates its schema on first use (idempotent, same DDL as
postgres-init/11_system.sql) so a deployment that predates the table needs
no manual migration.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional, Protocol

from sqlalchemy import text

ENSURE_SCHEMA_SQL = (
    "CREATE SCHEMA IF NOT EXISTS system",
    """
    CREATE TABLE IF NOT EXISTS system.settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
        updated_by  TEXT,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
)

SELECT_ALL_SQL = "SELECT key, value, is_secret, updated_by, updated_at FROM system.settings"
UPSERT_SQL = """
    INSERT INTO system.settings (key, value, is_secret, updated_by, updated_at)
    VALUES (:key, :value, :is_secret, :updated_by, NOW())
    ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            is_secret = EXCLUDED.is_secret,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
"""
DELETE_SQL = "DELETE FROM system.settings WHERE key = :key"


@dataclass(frozen=True)
class StoredSetting:
    key: str
    value: str  # JSON text, or Fernet ciphertext when is_secret
    is_secret: bool
    updated_by: Optional[str]
    updated_at: Optional[datetime]


class SettingsRepository(Protocol):
    async def get_all(self) -> Dict[str, StoredSetting]: ...
    async def upsert(self, key: str, value: str, is_secret: bool, updated_by: Optional[str]) -> StoredSetting: ...
    async def delete(self, key: str) -> bool: ...


class MemorySettingsRepository:
    """In-process store for tests and for a backend without Postgres."""

    def __init__(self):
        self.rows: Dict[str, StoredSetting] = {}

    async def get_all(self) -> Dict[str, StoredSetting]:
        return dict(self.rows)

    async def upsert(self, key, value, is_secret, updated_by) -> StoredSetting:
        row = StoredSetting(key, value, is_secret, updated_by, datetime.now(timezone.utc))
        self.rows[key] = row
        return row

    async def delete(self, key) -> bool:
        return self.rows.pop(key, None) is not None


class SqlSettingsRepository:
    """`system.settings` via the app's async engine (schema-qualified SQL only)."""

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

    async def get_all(self) -> Dict[str, StoredSetting]:
        await self.ensure_schema()
        async with self._maker()() as session:
            result = await session.execute(text(SELECT_ALL_SQL))
            rows = result.all()
        return {
            r[0]: StoredSetting(key=r[0], value=r[1], is_secret=bool(r[2]), updated_by=r[3], updated_at=r[4])
            for r in rows
        }

    async def upsert(self, key, value, is_secret, updated_by) -> StoredSetting:
        await self.ensure_schema()
        async with self._maker()() as session:
            await session.execute(
                text(UPSERT_SQL),
                {"key": key, "value": value, "is_secret": is_secret, "updated_by": updated_by},
            )
            await session.commit()
        return StoredSetting(key, value, is_secret, updated_by, datetime.now(timezone.utc))

    async def delete(self, key) -> bool:
        await self.ensure_schema()
        async with self._maker()() as session:
            result = await session.execute(text(DELETE_SQL), {"key": key})
            await session.commit()
        return bool(getattr(result, "rowcount", 0))
