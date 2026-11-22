# Command Center backend — module reference

Admin console for a WintEHR deployment: status with a readiness checklist
and a history, settings (with export / import), jobs, tab policy, roles, users, apps, logs,
audit trail, active sessions, modules, and the control-plane sidecar (with
confirmed update-apply). Module key
`command-center` (frontend half: `frontend/src/modules/command-center/`).
Plan and slice order: `docs/COMMAND_CENTER.md`.

**Inherits** root, `backend/`, and `backend/api/` `CLAUDE.md`. Only this
module's deltas are here.

---

## Layout

| File | Role |
|---|---|
| `router.py` | `/api/command-center/...`. Reads depend on `require_admin` (`admin` permission); writes on `require_system` (`system`). Routes: `GET /status`, `GET /status/history?hours=`; `GET /settings`, `PUT` / `DELETE /settings/{key}`; `GET /ui-policy` (no auth); `GET /roles`; `GET /logs`, `GET /logs/export`; `GET /audit`; `GET /users`, `POST /users`, `PUT /users/{username}`, `DELETE /users/{username}` (system, audited); `GET /sessions`, `DELETE /sessions/{id}` and `DELETE /sessions?user_id=` (system, audited); `GET /config/export` (`?download=1` for a file), `POST /config/import` (system; preview unless `apply`); `GET /modules`; `GET /control`, `GET /control/containers/{name}/logs`, `POST /control/containers/{name}/restart` (system, audited), `GET /control/update-check`, `GET /control/update/preview` (fetches), `POST /control/update/apply` (system, audited `system.control.update`, body `{commit}` = origin's tip from the preview), `GET /control/update/status`, `GET /control/config`, `GET /control/host`, `GET /control/certificates`; `GET /jobs/kinds`, `GET /jobs`, `POST /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/log?offset=`, `POST /jobs/{id}/cancel`. |
| `service.py` | `CommandCenterService.status()`: runs the probes concurrently under the live-tier probe timeout, rolls them up. `roll_up` is pure. |
| `status_history.py` | `system.status_history` (Sql / Memory repositories, DDL also in `postgres-init/11_system.sql`), `summarize()` (pure: uptime per component, incidents), `StatusHistoryService.record()` called by every `status()` (never raises), the sampler (`run_sampler` started from `main.py`, `sampler_tick` elected per tick via the `status:sampler` Redis lock, freshness check first). `use_status_history()` swaps it in tests; `CommandCenterService(history=None)` records nothing. |
| `probes.py` | One `async` probe per deployment part: `fhir`, `database`, `redis`, `terminology`, `vna`, plus `host` (disk / memory / load) and `tls` (certificate expiry) through the sidecar, `absent` when it is not configured. Exceptions and timeouts become `down`, never a 500. |
| `readiness.py` | `readiness_checks(components, env, umls_key_set)`: the Status tab's checklist (profile, example secrets, settings key, auth mode, patients, terminology, UMLS key, Redis, control plane, disk, HTTPS, VNA) with a fix per item. Pure; the example-secret lists mirror `deploy/secrets_policy.py` and a test keeps them equal. |
| `settings_registry.py` | **Where a setting is defined**: key, type, default, tier, env var it shadows, `used_by`; `audit_value=False` keeps a json value (password hashes) out of the audit event. Add a setting here, and only when something reads it. |
| `settings_repository.py` | Overrides in `system.settings` (Postgres, DDL also in `postgres-init/11_system.sql`, created idempotently on first use) or in memory for tests. |
| `settings_service.py` | Precedence database → env → default; secrets encrypted/decrypted; audit on every write; `get_setting(key)` for live-tier consumers (15 s per-process cache, env/default fallback if Postgres is down). |
| `config_transfer.py` | `export_document()` (database-sourced non-secret settings + the keys of set secrets), `plan_import()` (pure: set / reset / unchanged / skip per key, tier flags, 400 on an unreadable document), `apply_import()` (writes through `SettingsService.set/reset`, so each change is validated, versioned and audited; one `system.config.imported` summary event). Unknown keys skip so a file from a build with other modules still imports. |
| `users.py` | `normalize_users` (validator for `auth.users`: built-ins may only carry `disabled`, custom users need name / role / bcrypt `password_hash`, `admin` never disabled), `user_record()` (what login and `get_current_user` read), `UsersService` (create / update / delete through `SettingsService.set`, one `system.user.*` audit event naming the user; hashes never reach the audit trail or the API). |
| `sessions.py` | `SessionsService` over both `SessionStore` namespaces (training, practitioner): `list(current_token)` → `SessionView`s with a token digest as id (`session_id()`), `revoke(sid)` / `revoke_user(user_id)` delete from the store and audit `system.session.revoked`. JWT mode → empty list with a note. `use_sessions_service()` swaps it in tests. |
| `audit.py` | `AuditClient.read()`: FHIR `AuditEvent`s from HAPI newest first, flattened (`flatten`) for the Audit tab. Window and exact `subtype` filter in HAPI; user / category / text filter within the fetched page (the writer puts the user in `agent.who.display`, not a search param). `use_audit_client()` swaps it in tests. |
| `logs.py` | Reads `backend.<pid>.log*` from `WINTEHR_LOG_DIR` (written by `backend/logging_setup.py`), merges workers by timestamp, attaches tracebacks to their record, filters by level / text / window; `export_logs` for the download. |
| `module_settings.py` | Discovers `api/<pkg>/settings.py` → `SETTINGS` for every enabled module at router registration and adds them to the registry; refuses keys outside `module.<key>.`. `MODULE_SETTINGS` maps module → keys. |
| `modules.py` | `module_inventory()`: per module key, routers, registered / failed / disabled, builtin or external, declared settings. |
| `control_plane.py` | `ControlPlaneClient`: token-bearing httpx client for the sidecar (`control-plane/app.py`) at `CONTROL_PLANE_URL`. Unconfigured → `configured=False`; unreachable → 503; sidecar verdicts (401/403/404/409) pass through. `get(path, params, timeout=)` / `post(path, json=)`. `use_control_plane()` swaps it in tests. |
| `roles.py` | `KNOWN_PERMISSIONS` (the vocabulary the code assigns or checks), `default_roles()` from `TRAINING_USERS`, validator for the `auth.roles` setting (unknown permission → 400; `admin` must keep `admin` and `system`), `effective_permissions()`. Applied on every request by `api/auth/service.apply_role_overrides`. |
| `tab_policy.py` | Shape validation for `ui.tabs.policy` (org / roles / contexts layers of hidden, order, default; `summary` stripped from hidden) and `known_roles()`. Tab ids are not validated here — the catalog is a frontend build artifact; the client resolver ignores unknown ids with a warning. |
| `secrets.py` | `SecretBox`: Fernet keyed from `WINTEHR_SETTINGS_KEY` (any passphrase, SHA-256 → key). No key → secrets refuse to save (409), plain settings unaffected. |
| `jobs_registry.py` | **Where a job kind is defined**: validated params → argv allow-list (never a shell string), a `ProgressParser` for its output, `patients_added` for the cap check, `secret_env` for settings the subprocess needs as env vars. Kinds: `synthea_load` (`scripts/synthea_to_hapi_pipeline.py`), `terminology_load` (`scripts/terminology/run_pipeline.py`, gets `UMLS_API_KEY` from `system.umls_api_key`), `dicom_generate` (`scripts/active/run_imaging_pipeline.py`). Orchestrators print `STEP i/N:` lines for `StepProgress`. |
| `jobs_repository.py` | `system.jobs` (Postgres; DDL also in `postgres-init/11_system.sql`, created on first use) or memory. The single-active-job rule is the partial unique index `system_jobs_one_active`, so two workers cannot both start one. |
| `jobs_service.py` | Start / list / get / tail log / cancel. The accepting worker runs the subprocess, streams its output to `/app/data/jobs/<id>.log`, heartbeats the row, and honours `cancel_requested` set by any worker. `list()` marks jobs with a stale heartbeat `lost`. |
| `models.py` | `ComponentStatus`, `RouterStatus`, `BuildInfo`, `ReadinessItem`, `StatusReport`, `SettingView`, `SettingUpdate`, `JobKindView`, `JobStartRequest`, `JobView`, `JobLogChunk`. |

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
- **The sidecar is the control plane; the backend never gets the socket.**
  Anything that needs Docker or the host goes through `control-plane/app.py`
  and its env allow-lists. Add an endpoint there only if it takes no
  free-form input (no command, path, or image from the request). The one
  write to the host, update-apply, takes a 40-hex commit that must equal
  `origin/<branch>` and runs in a helper container (`control-plane/update.sh`)
  because the sidecar's repo mount is read-only.
- **Overall roll-up**: `fhir` down → `down`; any other `down`/`degraded` or a
  failed router → `degraded`; else `ok`.

---

## Env

| Var | Used for |
|---|---|
| `WINTEHR_SETTINGS_KEY` | Passphrase for secret settings. Forwarded by compose (both backends); unset = secrets cannot be saved |
| `COMMAND_CENTER_JOB_LOG_DIR` | Job logs (default `/app/data/jobs`, on the `./data` bind mount) |
| `COMMAND_CENTER_JOB_HEARTBEAT` | Seconds between heartbeats while a job runs (default 5); a job is `lost` after 12 missed beats |
| `LOG_LEVEL`, `WINTEHR_LOG_DIR`, `LOG_RETENTION_DAYS` | Backend logging (`logging_setup.py`): level, where the per-worker files go (default `/app/logs`, the `./logs` bind mount), how long they are kept (7 days) |
| `CONTROL_PLANE_URL`, `CONTROL_PLANE_TOKEN` | Where the sidecar is (compose default `http://control-plane:9000`) and the shared token; both empty = Control tab says not configured |
| `COMMAND_CENTER_SAMPLE_SECONDS`, `COMMAND_CENTER_HISTORY_DAYS` | Status sampler interval (default 300; 0 disables) and history retention (default 7 days) |
| `COMMAND_CENTER_PROBE_TIMEOUT` | Env fallback for `system.probe_timeout_seconds` (default 8) |
| `HAPI_FHIR_TIMEOUT` | Env fallback for `system.hapi_timeout_seconds` (default 30; read at startup by `services/hapi_fhir_client.py` and the `/fhir` proxy) |
| `WINTEHR_VERSION`, `WINTEHR_GIT_COMMIT` | Reported in `build` when the image sets them |
| `TERMINOLOGY_DB_PATH`, `REDIS_URL`, `DICOM_QIDO_URL`, `CATALOG_SCAN_MAX_RESOURCES`, `UMLS_API_KEY` | Read by probes, or shadowed by a registered setting |
