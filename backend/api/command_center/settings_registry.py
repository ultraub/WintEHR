"""The settings the Command Center manages — defined in code, overridden in the DB.

A setting's identity, type, default, tier, and the env var it shadows are
facts about the code that reads it, so they live here, not in a table.
`system.settings` (postgres-init/11_system.sql) stores only the values an
admin has changed.

Tiers say when a change takes effect, and the UI shows them beside every
control so the page never claims more than it can deliver:
  live     — read at use time through `get_setting()`; next request sees it
  restart  — read once at process start (module constant); `emr-backend`
             must restart
  rebuild  — baked into the frontend image (REACT_APP_*); rebuild required

Naming: `system.<name>` for platform settings. Module-owned settings will
use `module.<key>.<name>` (docs/COMMAND_CENTER.md, Extensions).

Only register a setting something actually reads: `used_by` is shown to
the admin and must name a real consumer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Literal, Optional

SettingType = Literal["int", "float", "bool", "str", "secret"]
Tier = Literal["live", "restart", "rebuild"]

_TRUE = {"true", "1", "yes", "on"}
_FALSE = {"false", "0", "no", "off", ""}


class SettingValueError(ValueError):
    """The supplied value does not fit the setting's type or bounds."""


@dataclass(frozen=True)
class SettingDefinition:
    key: str
    type: SettingType
    default: Any
    tier: Tier
    label: str
    description: str
    used_by: str
    env_var: Optional[str] = None
    minimum: Optional[float] = None
    maximum: Optional[float] = None

    @property
    def is_secret(self) -> bool:
        return self.type == "secret"

    def parse(self, raw: Any) -> Any:
        """Coerce and validate a value from JSON, a form, or an env var string."""
        if raw is None:
            raise SettingValueError(f"{self.key}: a value is required")
        try:
            if self.type == "int":
                if isinstance(raw, bool):
                    raise ValueError
                value: Any = int(raw) if not isinstance(raw, str) else int(raw.strip())
            elif self.type == "float":
                if isinstance(raw, bool):
                    raise ValueError
                value = float(raw)
            elif self.type == "bool":
                if isinstance(raw, bool):
                    value = raw
                elif isinstance(raw, (int, float)) and raw in (0, 1):
                    value = bool(raw)
                elif isinstance(raw, str) and raw.strip().lower() in _TRUE | _FALSE:
                    value = raw.strip().lower() in _TRUE
                else:
                    raise ValueError
            else:  # str, secret
                if not isinstance(raw, str):
                    raise ValueError
                value = raw
                if self.type == "secret" and not value.strip():
                    raise SettingValueError(f"{self.key}: secret cannot be blank")
        except (TypeError, ValueError):
            raise SettingValueError(f"{self.key}: expected {self.type}, got {raw!r}") from None

        if self.minimum is not None and value < self.minimum:
            raise SettingValueError(f"{self.key}: must be at least {self.minimum:g}")
        if self.maximum is not None and value > self.maximum:
            raise SettingValueError(f"{self.key}: must be at most {self.maximum:g}")
        return value


DEFINITIONS: Dict[str, SettingDefinition] = {
    d.key: d
    for d in [
        SettingDefinition(
            key="system.probe_timeout_seconds",
            type="float",
            default=8.0,
            tier="live",
            label="Status probe timeout",
            description="Seconds each Command Center status probe may take before it is reported as down.",
            used_by="api/command_center/service.py (status report)",
            env_var="COMMAND_CENTER_PROBE_TIMEOUT",
            minimum=1,
            maximum=120,
        ),
        SettingDefinition(
            key="system.patient_count_cap",
            type="int",
            default=500,
            tier="live",
            label="Patient count cap",
            description="Upper bound on the number of patients a Synthea load job may bring the deployment to.",
            used_by="Command Center job runner (slice 3, Synthea load)",
            minimum=1,
            maximum=100000,
        ),
        SettingDefinition(
            key="system.umls_api_key",
            type="secret",
            default=None,
            tier="live",
            label="UMLS API key",
            description="Licence key for downloading UMLS vocabularies (LOINC, RxNorm, SNOMED) in the terminology load job.",
            used_by="Command Center terminology job (slice 4); deploy.sh reads the same UMLS_API_KEY env var",
            env_var="UMLS_API_KEY",
        ),
        SettingDefinition(
            key="system.catalog_scan_max_resources",
            type="int",
            default=100000,
            tier="restart",
            label="Catalog scan limit",
            description="Maximum resources scanned per patient-derived catalog (medications, procedures, imaging, ...).",
            used_by="api/services/clinical/dynamic_catalog_service.py (read at import)",
            env_var="CATALOG_SCAN_MAX_RESOURCES",
            minimum=500,
        ),
        SettingDefinition(
            key="system.console_logging",
            type="bool",
            default=False,
            tier="live",
            label="Browser console logging",
            description="When on, the frontend logger writes debug output to the browser console for every user.",
            used_by="Command Center settings UI (slice 5) → frontend logger",
        ),
    ]
}


def get_definition(key: str) -> SettingDefinition:
    try:
        return DEFINITIONS[key]
    except KeyError:
        raise KeyError(f"Unknown setting '{key}'") from None
