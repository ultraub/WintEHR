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

Naming: `system.<name>` for platform settings, `ui.<name>` for policies the
frontend applies (tab policy), `auth.<name>` for identity (role overrides),
`module.<key>.<name>` for module-owned settings (docs/COMMAND_CENTER.md).

Only register a setting something actually reads: `used_by` is shown to
the admin and must name a real consumer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Dict, Literal, Optional

SettingType = Literal["int", "float", "bool", "str", "secret", "json"]
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
    # json settings: structural validator, returns the normalized document.
    validator: Optional[Callable[[Any], Any]] = None
    # False: the value is left out of the audit event (it holds password hashes).
    audit_value: bool = True

    @property
    def is_secret(self) -> bool:
        return self.type == "secret"

    def parse(self, raw: Any) -> Any:
        """Coerce and validate a value from JSON, a form, or an env var string."""
        if raw is None:
            raise SettingValueError(f"{self.key}: a value is required")
        if self.type == "json":
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except json.JSONDecodeError as exc:
                    raise SettingValueError(f"{self.key}: not valid JSON ({exc.msg})") from None
            return self.validator(raw) if self.validator else raw
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
            used_by="Command Center job runner (Synthea load refuses to exceed it)",
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
            used_by="Command Center terminology job (injected as UMLS_API_KEY); deploy.sh reads the env var",
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
            key="system.hapi_timeout_seconds",
            type="float",
            default=30.0,
            tier="restart",
            label="HAPI FHIR request timeout",
            description="Seconds the backend waits for any single HAPI FHIR request, for the /fhir proxy and its own calls. "
                        "Raise it if large searches fail with 'Request to FHIR server timed out'.",
            used_by="services/hapi_fhir_client.py and api/fhir/proxy.py (read at startup)",
            env_var="HAPI_FHIR_TIMEOUT",
            minimum=5,
            maximum=600,
        ),
        SettingDefinition(
            key="ui.tabs.policy",
            type="json",
            default={"org": {"hidden": [], "order": [], "default": None, "sections": {}, "nav": {"hidden": []}}, "roles": {}, "contexts": {}},
            tier="live",
            label="Chart workspace tabs",
            description="Which chart tabs and primary navigation pages are shown, in what order, and which tab opens first — for the whole "
                        "organization and per role. Edited on the Command Center's Tabs tab.",
            used_by="frontend useEffectiveTabs() (tab strip, keyboard shortcuts, hidden-tab fallback) and useEffectiveNavigation() (app shell menu, rail, command palette)",
            validator=lambda doc: _normalize_tab_policy(doc),
        ),
        SettingDefinition(
            key="auth.users",
            type="json",
            default={},
            tier="live",
            label="Users",
            description="Custom logins (bcrypt password hashes) and disabled built-in users. Read at login and on "
                        "every request, so disabling takes effect immediately. Edited on the Command Center's Users tab.",
            used_by="api/auth/service.resolve_login_user and get_current_user (user_disabled)",
            validator=lambda doc: _normalize_users(doc),
            audit_value=False,
        ),
        SettingDefinition(
            key="auth.require_passwords",
            type="bool",
            default=False,
            tier="live",
            label="Require a password for every login",
            description="Off (the default): the demo logins are one click on the login page and share the training password. "
                        "On: the login page asks for a username and password and lists no users; a built-in user with no password "
                        "of its own cannot log in (set one on the Users tab first), and the passwordless practitioner login is closed. "
                        "The administrator can always log in with WINTEHR_ADMIN_PASSWORD from the server's .env.",
            used_by="api/auth/service.resolve_login_user, GET /api/auth/config and POST /api/auth/practitioners/login",
        ),
        SettingDefinition(
            key="auth.roles",
            type="json",
            default={},
            tier="live",
            label="Role permissions",
            description="Overrides a role's permission list. Applied on every request, so it takes effect "
                        "without a new login. Edited on the Command Center's Roles tab.",
            used_by="api/auth/service.get_current_user (effective_permissions)",
            validator=lambda doc: _normalize_roles(doc),
        ),
    ]
}


def _normalize_users(doc):
    from .users import normalize_users  # local import: users imports SettingValueError from here

    return normalize_users(doc)


def _normalize_roles(doc):
    from .roles import normalize_roles  # local import: roles imports SettingValueError from here

    return normalize_roles(doc)


def _normalize_tab_policy(doc):
    from .tab_policy import normalize_tab_policy  # local import: tab_policy imports SettingValueError from here

    return normalize_tab_policy(doc)


def get_definition(key: str) -> SettingDefinition:
    try:
        return DEFINITIONS[key]
    except KeyError:
        raise KeyError(f"Unknown setting '{key}'") from None
