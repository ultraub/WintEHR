"""Settings store: definitions from the registry, overrides from the repository.

Effective value precedence: database override → env var → code default.
Secrets are encrypted at rest and never leave the service through the API;
`SettingsService.get()` decrypts for internal consumers (jobs), the views
only say whether a secret is set.

Every write is audited as a FHIR AuditEvent (`system.setting.*`) through the
existing AuditEventService. Secret values are never put in audit details.

`get_setting(key)` is the module-level helper live-tier consumers call at
use time; it caches per process for a few seconds so hot paths do not hit
Postgres on every request.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Callable, Dict, List, Mapping, Optional

from .models import SettingView
from .secrets import ENV_VAR as SECRETS_ENV_VAR, SecretBox, secret_box_from_env
from .settings_registry import DEFINITIONS, SettingDefinition, SettingValueError, get_definition
from .settings_repository import MemorySettingsRepository, SettingsRepository, SqlSettingsRepository, StoredSetting

logger = logging.getLogger(__name__)

SETTING_CACHE_SECONDS = 15.0


class SettingsError(Exception):
    """A request the service refuses; `status_code` maps straight to HTTP."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class SettingsService:
    def __init__(
        self,
        repository: SettingsRepository,
        secret_box: Optional[SecretBox] = None,
        audit: Any = None,
        env: Mapping[str, str] = os.environ,
        definitions: Dict[str, SettingDefinition] = DEFINITIONS,
    ):
        self.repository = repository
        self.secret_box = secret_box if secret_box is not None else secret_box_from_env()
        self.audit = audit
        self.env = env
        self.definitions = definitions

    # --- resolution ---------------------------------------------------------

    def _env_value(self, definition: SettingDefinition) -> Optional[Any]:
        if not definition.env_var:
            return None
        raw = self.env.get(definition.env_var)
        if raw is None or raw == "":
            return None
        try:
            return definition.parse(raw)
        except SettingValueError as exc:
            logger.warning("Ignoring env %s: %s", definition.env_var, exc)
            return None

    def _stored_value(self, definition: SettingDefinition, row: StoredSetting) -> Any:
        if definition.is_secret:
            return self.secret_box.decrypt(row.value)
        return definition.parse(json.loads(row.value))

    def _resolve(self, definition: SettingDefinition, rows: Dict[str, StoredSetting]):
        """(value, source, row) — value is decrypted for secrets."""
        row = rows.get(definition.key)
        if row is not None:
            try:
                return self._stored_value(definition, row), "database", row
            except (RuntimeError, SettingValueError, ValueError) as exc:
                logger.error("Stored value for %s unusable (%s); falling through", definition.key, exc)
        env_value = self._env_value(definition)
        if env_value is not None:
            return env_value, "environment", None
        return definition.default, "default", None

    def _view(self, definition: SettingDefinition, value: Any, source: str, row: Optional[StoredSetting]) -> SettingView:
        is_set = value is not None and value != ""
        return SettingView(
            key=definition.key,
            label=definition.label,
            description=definition.description,
            type=definition.type,
            tier=definition.tier,
            used_by=definition.used_by,
            env_var=definition.env_var,
            default=None if definition.is_secret else definition.default,
            value=None if definition.is_secret else value,
            is_secret=definition.is_secret,
            is_set=is_set,
            source=source,
            updated_by=row.updated_by if row else None,
            updated_at=row.updated_at if row else None,
            secrets_enabled=self.secret_box.available if definition.is_secret else None,
        )

    # --- reads --------------------------------------------------------------

    async def list(self) -> List[SettingView]:
        rows = await self.repository.get_all()
        return [self._view(d, *self._resolve(d, rows)) for d in self.definitions.values()]

    async def get(self, key: str) -> Any:
        """Effective value for internal consumers; secrets come back decrypted."""
        definition = get_definition(key)
        rows = await self.repository.get_all()
        value, _, _ = self._resolve(definition, rows)
        return value

    # --- writes -------------------------------------------------------------

    async def set(self, key: str, raw_value: Any, user_id: Optional[str]) -> SettingView:
        try:
            definition = get_definition(key)
        except KeyError as exc:
            raise SettingsError(404, str(exc)) from None
        try:
            value = definition.parse(raw_value)
        except SettingValueError as exc:
            raise SettingsError(400, str(exc)) from None

        if definition.is_secret:
            if not self.secret_box.available:
                raise SettingsError(
                    409,
                    f"Secrets cannot be stored until {SECRETS_ENV_VAR} is set on the backend "
                    "(any long random string); restart the backend after setting it.",
                )
            stored = self.secret_box.encrypt(value)
        else:
            stored = json.dumps(value)

        row = await self.repository.upsert(definition.key, stored, definition.is_secret, user_id)
        _cache_invalidate(definition.key)
        await self._audit(
            "system.setting.updated", user_id, definition,
            {"key": definition.key, "tier": definition.tier, "action": "update",
             **({} if definition.is_secret else {"value": value})},
        )
        return self._view(definition, value, "database", row)

    async def reset(self, key: str, user_id: Optional[str]) -> SettingView:
        try:
            definition = get_definition(key)
        except KeyError as exc:
            raise SettingsError(404, str(exc)) from None
        removed = await self.repository.delete(definition.key)
        _cache_invalidate(definition.key)
        if removed:
            await self._audit(
                "system.setting.reset", user_id, definition,
                {"key": definition.key, "tier": definition.tier, "action": "reset"},
            )
        rows = await self.repository.get_all()
        return self._view(definition, *self._resolve(definition, rows))

    async def _audit(self, event_type: str, user_id: Optional[str], definition: SettingDefinition, details: Dict[str, Any]) -> None:
        if self.audit is None:
            return
        try:
            await self.audit.log_event(
                event_type=event_type,
                user_id=user_id,
                action=details.get("action"),
                outcome="success",
                details=details,
            )
        except Exception as exc:  # audit must never block an admin action
            logger.warning("Audit of %s failed: %s", definition.key, exc)


# --- process-wide default service + live-tier helper -------------------------

_default_service: Optional[SettingsService] = None
_cache: Dict[str, tuple[Any, float]] = {}
_clock: Callable[[], float] = time.monotonic


def default_settings_service() -> SettingsService:
    global _default_service
    if _default_service is None:
        from api.services.audit_event_service import AuditEventService

        _default_service = SettingsService(SqlSettingsRepository(), audit=AuditEventService())
    return _default_service


def use_settings_service(service: Optional[SettingsService]) -> None:
    """Swap the process-wide service (tests; a backend without Postgres)."""
    global _default_service
    _default_service = service
    _cache.clear()


def _cache_invalidate(key: str) -> None:
    _cache.pop(key, None)


async def get_setting(key: str) -> Any:
    """Effective value of a live-tier setting, cached briefly per process.

    Falls back to env/default if the store is unreachable, so a Postgres
    hiccup degrades to "as configured at deploy" rather than an exception
    in whatever request happened to read a setting.
    """
    now = _clock()
    hit = _cache.get(key)
    if hit is not None and hit[1] > now:
        return hit[0]
    definition = get_definition(key)
    try:
        value = await default_settings_service().get(key)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Settings store unavailable for %s (%s); using env/default", key, exc)
        fallback = SettingsService(MemorySettingsRepository(), secret_box=SecretBox(None))
        value, _, _ = fallback._resolve(definition, {})
    _cache[key] = (value, now + SETTING_CACHE_SECONDS)
    return value
