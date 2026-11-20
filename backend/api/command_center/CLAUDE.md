# Command Center backend — module reference

Admin console for a WintEHR deployment: status and settings today; jobs,
tab policy, and module management in later slices. Module key
`command-center` (frontend half: `frontend/src/modules/command-center/`).
Plan and slice order: `docs/COMMAND_CENTER.md`.

**Inherits** root, `backend/`, and `backend/api/` `CLAUDE.md`. Only this
module's deltas are here.

---

## Layout

| File | Role |
|---|---|
| `router.py` | `/api/command-center/...`. Reads depend on `require_admin` (`admin` permission); writes on `require_system` (`system`). Routes: `GET /status`, `GET /settings`, `PUT /settings/{key}`, `DELETE /settings/{key}`. |
| `service.py` | `CommandCenterService.status()`: runs the probes concurrently under the live-tier probe timeout, rolls them up. `roll_up` is pure. |
| `probes.py` | One `async` probe per deployment part: `fhir`, `database`, `redis`, `terminology`, `vna`. Exceptions and timeouts become `down`, never a 500. |
| `settings_registry.py` | **Where a setting is defined**: key, type, default, tier, env var it shadows, `used_by`. Add a setting here, and only when something reads it. |
| `settings_repository.py` | Overrides in `system.settings` (Postgres, DDL also in `postgres-init/11_system.sql`, created idempotently on first use) or in memory for tests. |
| `settings_service.py` | Precedence database → env → default; secrets encrypted/decrypted; audit on every write; `get_setting(key)` for live-tier consumers (15 s per-process cache, env/default fallback if Postgres is down). |
| `secrets.py` | `SecretBox`: Fernet keyed from `WINTEHR_SETTINGS_KEY` (any passphrase, SHA-256 → key). No key → secrets refuse to save (409), plain settings unaffected. |
| `models.py` | `ComponentStatus`, `RouterStatus`, `BuildInfo`, `StatusReport`, `SettingView`, `SettingUpdate`. |

---

## Rules specific to this module

- **Every write is audited** through `api/services/audit_event_service.py`
  (FHIR `AuditEvent`, event types `system.setting.*`). Never put a secret
  value in audit `details`. Audit failure is logged, not raised — an admin
  action must not fail because HAPI is slow.
- **Tiers are a promise to the admin.** `live` means the consumer calls
  `get_setting()` at use time (see `service.py` `_timeout()` for the
  pattern). A setting read at import time is `restart`; a `REACT_APP_*`
  value is `rebuild`. Do not mark a setting `live` unless its consumer is
  wired that way.
- **Secrets never leave through the API.** `SettingView.value` is `None` for
  secrets; `is_set` and `secrets_enabled` are all the UI gets. Internal
  consumers use `SettingsService.get()` / `get_setting()`.
- **`absent` is not a failure.** No VNA or no `REDIS_URL` reports `absent`,
  which never degrades overall status. A missing terminology index is
  `degraded` on purpose: catalogs silently fall back to static lists, the
  support case the dashboard exists to surface.
- **Inject, don't patch.** Tests pass `probes=`, `router_state=`, a
  `MemorySettingsRepository`, a `SecretBox("passphrase")`, and a fake audit.
  `settings_service.use_settings_service(svc)` swaps the process-wide
  service that `get_setting()` reads.
- **`database` probe reads `hfj_resource` directly** — the one sanctioned raw
  read of HAPI's tables (counts only).
- **Overall roll-up**: `fhir` down → `down`; any other `down`/`degraded` or a
  failed router → `degraded`; else `ok`.

---

## Env

| Var | Used for |
|---|---|
| `WINTEHR_SETTINGS_KEY` | Passphrase for secret settings. Forwarded by compose (both backends); unset = secrets cannot be saved |
| `COMMAND_CENTER_PROBE_TIMEOUT` | Env fallback for `system.probe_timeout_seconds` (default 8) |
| `WINTEHR_VERSION`, `WINTEHR_GIT_COMMIT` | Reported in `build` when the image sets them |
| `TERMINOLOGY_DB_PATH`, `REDIS_URL`, `DICOM_QIDO_URL`, `CATALOG_SCAN_MAX_RESOURCES`, `UMLS_API_KEY` | Read by probes, or shadowed by a registered setting |
