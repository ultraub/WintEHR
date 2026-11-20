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
| `router.py` | `/api/command-center/...`. Reads depend on `require_admin` (`admin` permission); writes on `require_system` (`system`). Routes: `GET /status`; `GET /settings`, `PUT` / `DELETE /settings/{key}`; `GET /jobs/kinds`, `GET /jobs`, `POST /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/log?offset=`, `POST /jobs/{id}/cancel`. |
| `service.py` | `CommandCenterService.status()`: runs the probes concurrently under the live-tier probe timeout, rolls them up. `roll_up` is pure. |
| `probes.py` | One `async` probe per deployment part: `fhir`, `database`, `redis`, `terminology`, `vna`. Exceptions and timeouts become `down`, never a 500. |
| `settings_registry.py` | **Where a setting is defined**: key, type, default, tier, env var it shadows, `used_by`. Add a setting here, and only when something reads it. |
| `settings_repository.py` | Overrides in `system.settings` (Postgres, DDL also in `postgres-init/11_system.sql`, created idempotently on first use) or in memory for tests. |
| `settings_service.py` | Precedence database → env → default; secrets encrypted/decrypted; audit on every write; `get_setting(key)` for live-tier consumers (15 s per-process cache, env/default fallback if Postgres is down). |
| `secrets.py` | `SecretBox`: Fernet keyed from `WINTEHR_SETTINGS_KEY` (any passphrase, SHA-256 → key). No key → secrets refuse to save (409), plain settings unaffected. |
| `jobs_registry.py` | **Where a job kind is defined**: validated params → argv allow-list (never a shell string), a `ProgressParser` for its output, `patients_added` for the cap check, `secret_env` for settings the subprocess needs as env vars. Kinds: `synthea_load` (`scripts/synthea_to_hapi_pipeline.py`), `terminology_load` (`scripts/terminology/run_pipeline.py`, gets `UMLS_API_KEY` from `system.umls_api_key`), `dicom_generate` (`scripts/active/run_imaging_pipeline.py`). Orchestrators print `STEP i/N:` lines for `StepProgress`. |
| `jobs_repository.py` | `system.jobs` (Postgres; DDL also in `postgres-init/11_system.sql`, created on first use) or memory. The single-active-job rule is the partial unique index `system_jobs_one_active`, so two workers cannot both start one. |
| `jobs_service.py` | Start / list / get / tail log / cancel. The accepting worker runs the subprocess, streams its output to `/app/data/jobs/<id>.log`, heartbeats the row, and honours `cancel_requested` set by any worker. `list()` marks jobs with a stale heartbeat `lost`. |
| `models.py` | `ComponentStatus`, `RouterStatus`, `BuildInfo`, `StatusReport`, `SettingView`, `SettingUpdate`, `JobKindView`, `JobStartRequest`, `JobView`, `JobLogChunk`. |

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
- **Jobs are polled, not pushed.** The websocket manager is per worker, so a
  broadcast from the worker running a job reaches a quarter of the clients
  on a 4-worker box. The UI polls `GET /jobs/{id}` and `/log?offset=`;
  both read the shared row and the shared log file.
- **A job kind is an allow-list.** Params are validated into typed values
  and placed into an argv list; nothing from the request reaches a shell.
  Adding a kind means adding a `JobKind` with its own validator and parser.
- **Secrets reach jobs as env vars, never argv or the log.** `secret_env`
  maps `ENV_VAR → setting key`; the service decrypts via `get_setting()` and
  passes the value to the subprocess only. The log records the variable
  *name*. Grep a job log for a key value in review if you touch this.
- **`database` probe reads `hfj_resource` directly** — the one sanctioned raw
  read of HAPI's tables (counts only).
- **Overall roll-up**: `fhir` down → `down`; any other `down`/`degraded` or a
  failed router → `degraded`; else `ok`.

---

## Env

| Var | Used for |
|---|---|
| `WINTEHR_SETTINGS_KEY` | Passphrase for secret settings. Forwarded by compose (both backends); unset = secrets cannot be saved |
| `COMMAND_CENTER_JOB_LOG_DIR` | Job logs (default `/app/data/jobs`, on the `./data` bind mount) |
| `COMMAND_CENTER_JOB_HEARTBEAT` | Seconds between heartbeats while a job runs (default 5); a job is `lost` after 12 missed beats |
| `COMMAND_CENTER_PROBE_TIMEOUT` | Env fallback for `system.probe_timeout_seconds` (default 8) |
| `HAPI_FHIR_TIMEOUT` | Env fallback for `system.hapi_timeout_seconds` (default 30; read at startup by `services/hapi_fhir_client.py` and the `/fhir` proxy) |
| `WINTEHR_VERSION`, `WINTEHR_GIT_COMMIT` | Reported in `build` when the image sets them |
| `TERMINOLOGY_DB_PATH`, `REDIS_URL`, `DICOM_QIDO_URL`, `CATALOG_SCAN_MAX_RESOURCES`, `UMLS_API_KEY` | Read by probes, or shadowed by a registered setting |
