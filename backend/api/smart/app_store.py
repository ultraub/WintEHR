"""Persistent SMART app registrations (`smart_auth.registered_apps`).

The authorization server keeps apps in memory (demo apps registered at
startup). This store is the durable, cross-worker source for apps
registered at runtime from the Command Center: the server reloads from it
(router.get_auth_server, every few seconds) so a registration made on one
uvicorn worker is usable on the others.

Client secrets are never stored: `client_secret_hash` holds a bcrypt hash
(api/auth/jwt_handler), and the plaintext is returned exactly once, at
creation or rotation.
"""

from __future__ import annotations

import secrets as _secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol

from sqlalchemy import text

SELECT_COLUMNS = (
    "client_id, name, description, client_type, client_secret_hash, redirect_uris, scopes, "
    "launch_uri, logo_uri, tos_uri, policy_uri, contacts, is_active, approved_by, approved_at, created_at, updated_at"
)


@dataclass
class StoredApp:
    client_id: str
    name: str
    client_type: str
    redirect_uris: List[str]
    scopes: List[str]
    description: Optional[str] = None
    client_secret_hash: Optional[str] = None
    launch_uri: Optional[str] = None
    logo_uri: Optional[str] = None
    tos_uri: Optional[str] = None
    policy_uri: Optional[str] = None
    contacts: List[str] = field(default_factory=list)
    is_active: bool = True
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


UPDATABLE = {"name", "description", "redirect_uris", "scopes", "launch_uri", "logo_uri", "tos_uri",
             "policy_uri", "contacts", "is_active", "client_secret_hash"}


class SmartAppStore(Protocol):
    async def list(self) -> List[StoredApp]: ...
    async def get(self, client_id: str) -> Optional[StoredApp]: ...
    async def create(self, app: StoredApp) -> StoredApp: ...
    async def update(self, client_id: str, **fields: Any) -> Optional[StoredApp]: ...


class ClientIdTaken(Exception):
    pass


def new_client_id(name: str) -> str:
    slug = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
    slug = "-".join(part for part in slug.split("-") if part)[:40] or "app"
    return f"{slug}-{_secrets.token_hex(3)}"


def new_client_secret() -> str:
    return _secrets.token_urlsafe(32)


class MemorySmartAppStore:
    def __init__(self):
        self.rows: Dict[str, StoredApp] = {}

    async def list(self) -> List[StoredApp]:
        return sorted(self.rows.values(), key=lambda a: a.created_at or datetime.min.replace(tzinfo=timezone.utc))

    async def get(self, client_id: str) -> Optional[StoredApp]:
        return self.rows.get(client_id)

    async def create(self, app: StoredApp) -> StoredApp:
        if app.client_id in self.rows:
            raise ClientIdTaken(app.client_id)
        now = datetime.now(timezone.utc)
        app.created_at = app.created_at or now
        app.updated_at = now
        self.rows[app.client_id] = app
        return app

    async def update(self, client_id: str, **fields: Any) -> Optional[StoredApp]:
        app = self.rows.get(client_id)
        if app is None:
            return None
        unknown = set(fields) - UPDATABLE
        if unknown:
            raise ValueError(f"not updatable: {sorted(unknown)}")
        for k, v in fields.items():
            setattr(app, k, v)
        app.updated_at = datetime.now(timezone.utc)
        return app


def _row_to_app(r) -> StoredApp:
    return StoredApp(
        client_id=r[0], name=r[1], description=r[2], client_type=r[3], client_secret_hash=r[4],
        redirect_uris=list(r[5] or []), scopes=list(r[6] or []), launch_uri=r[7], logo_uri=r[8],
        tos_uri=r[9], policy_uri=r[10], contacts=list(r[11] or []), is_active=bool(r[12]),
        approved_by=r[13], approved_at=r[14], created_at=r[15], updated_at=r[16],
    )


class SqlSmartAppStore:
    """`smart_auth.registered_apps` (postgres-init/08_smart_auth.sql)."""

    def __init__(self, session_maker=None):
        self._session_maker = session_maker

    def _maker(self):
        if self._session_maker is None:
            from database import async_session_maker  # local: tests run without a DB

            self._session_maker = async_session_maker
        return self._session_maker

    async def list(self) -> List[StoredApp]:
        async with self._maker()() as session:
            rows = (await session.execute(text(f"SELECT {SELECT_COLUMNS} FROM smart_auth.registered_apps ORDER BY created_at"))).all()
        return [_row_to_app(r) for r in rows]

    async def get(self, client_id: str) -> Optional[StoredApp]:
        async with self._maker()() as session:
            row = (await session.execute(
                text(f"SELECT {SELECT_COLUMNS} FROM smart_auth.registered_apps WHERE client_id = :cid"), {"cid": client_id}
            )).first()
        return _row_to_app(row) if row else None

    async def create(self, app: StoredApp) -> StoredApp:
        from sqlalchemy.exc import IntegrityError

        async with self._maker()() as session:
            try:
                await session.execute(text("""
                    INSERT INTO smart_auth.registered_apps
                        (client_id, name, description, client_type, client_secret_hash, redirect_uris, scopes,
                         launch_uri, logo_uri, tos_uri, policy_uri, contacts, is_active, approved_by, approved_at)
                    VALUES (:client_id, :name, :description, :client_type, :client_secret_hash, :redirect_uris, :scopes,
                            :launch_uri, :logo_uri, :tos_uri, :policy_uri, :contacts, :is_active, :approved_by, NOW())
                """), {
                    "client_id": app.client_id, "name": app.name, "description": app.description,
                    "client_type": app.client_type, "client_secret_hash": app.client_secret_hash,
                    "redirect_uris": app.redirect_uris, "scopes": app.scopes, "launch_uri": app.launch_uri,
                    "logo_uri": app.logo_uri, "tos_uri": app.tos_uri, "policy_uri": app.policy_uri,
                    "contacts": app.contacts, "is_active": app.is_active, "approved_by": app.approved_by,
                })
                await session.commit()
            except IntegrityError:
                await session.rollback()
                raise ClientIdTaken(app.client_id) from None
        return await self.get(app.client_id)

    async def update(self, client_id: str, **fields: Any) -> Optional[StoredApp]:
        unknown = set(fields) - UPDATABLE
        if unknown:
            raise ValueError(f"not updatable: {sorted(unknown)}")
        if not fields:
            return await self.get(client_id)
        assignments = ", ".join(f"{k} = :{k}" for k in fields)
        async with self._maker()() as session:
            await session.execute(
                text(f"UPDATE smart_auth.registered_apps SET {assignments}, updated_at = NOW() WHERE client_id = :cid"),
                {**fields, "cid": client_id},
            )
            await session.commit()
        return await self.get(client_id)
