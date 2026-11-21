# Command Center — admin console plan

The Command Center is the `command-center` module: one Administration-nav
page where an admin sees the state of a deployment and, in later slices,
changes it. This file is the in-repo plan; the shareable version with the
architecture diagram lives in the maintainer's Claude doc.

> Audience: contributors building the slices below. Keep this file and
> `backend/api/command_center/CLAUDE.md` in step with the code.

---

## Why it is shaped this way

Two gaps in the architecture decide everything else:

1. **No control plane.** The backend container has no Docker socket and no
   host shell. Docker logs, restarts, nginx, compose, and update checks are
   impossible from the backend. Mounting the socket into the backend would
   make a demo-auth web app root on the host, so those features go through a
   separate, allow-list-only **sidecar agent** (Phase 3, read-only first).
2. **No settings store.** Every setting is an env var, read at request time,
   at process start, or baked into the frontend build. A settings table with
   an explicit **tier** per setting (live / restart required / rebuild
   required) is what makes a settings UI honest.

On top of those, a **job runner** (Synthea load, terminology load, DICOM
generation — the scripts `deploy.sh` runs today) is the backbone of the
content-generation features.

Permissions: the whole module requires `admin`; anything that writes or
starts a job requires `system`. Both already exist in
`backend/api/auth/config.py`. Every write goes through the audit path
(`api/services/audit_event_service.py` — FHIR `AuditEvent`).

Settings are **defined in code** (`backend/api/command_center/settings_registry.py`:
key, type, default, tier, env var, `used_by`) and only their overrides are
stored (`system.settings`). A setting is registered only when something
reads it; `live` means the consumer calls `get_setting()` at use time.

---

## Build order

| # | Slice | Delivers | Depends on |
|---|---|---|---|
| 1 | Scaffold and status dashboard | `GET /api/command-center/status`: routers, FHIR store, database counts, Redis, terminology index, VNA. Read-only. **Shipped.** | — |
| 2 | Settings store core | `system.settings` table, registry of definitions with tiers, `get_setting()` with env fallback, Fernet-encrypted secrets (`WINTEHR_SETTINGS_KEY`), settings API behind `system`, FHIR `AuditEvent` on every write. **Shipped.** | 1 |
| 3 | Job runner and first job | `system.jobs` table (one active job per deployment via a partial unique index), subprocess runner with a log file per job under `/app/data/jobs`, heartbeat + lost-job reconciliation, cancel from any worker, polling log API (multi-worker safe; no websocket), Synthea load with the patient cap enforced. **Shipped.** | 2 |
| 4 | Content generation | Job kinds `terminology_load` (download → extract → index → HAPI load, in-image scripts, UMLS key injected from the secret setting) and `dicom_generate` (generate → STOW → endpoints); the terminology index is picked up without a restart; Jobs tab in the Command Center with schema-driven forms, progress, live log, cancel, history. **Shipped.** | 3 |
| 5 | Settings UI | Settings tab: every managed setting with tier (live / restart / rebuild) and source (override / env var / default) chips, typed editors, write-only secrets, save and reset behind `system`. `HAPI_FHIR_TIMEOUT` made configurable and registered as `system.hapi_timeout_seconds` (restart tier). System Health and About moved out of the user Settings page into the Command Center. **Shipped.** | 2 |
| 6 | Backend log viewer | `logging_setup.py`: root logger at `LOG_LEVEL` with a parseable line format, stderr plus a rotating file per worker under `./logs` (7-day retention). `GET /api/command-center/logs` merges every worker's file with level / text / time filters; `/logs/export` downloads a window. Logs tab with auto-refresh. Container logs (nginx, HAPI, Postgres) still need the sidecar. **Shipped.** | 1 |
| 7 | Configurable tabs | `ui.tabs.policy` (json setting, live tier, validated by `tab_policy.py`), public `GET /api/command-center/ui-policy`, `useEffectiveTabs()` in the tab strip / keyboard shortcuts / shortcut help / hidden-tab fallback, Tabs tab with the tabs × (organization, role) matrix, default picker and live preview. Contexts are in the policy shape and resolver but have no picker yet. **Shipped.** | 2 |
| 7b | Sections within tabs | Section registry (`sectionRegistry.js`: Chart Review's eight panels as builtin sections; hostable sections `imaging-studies` and module `flowsheet`), `useEffectiveSections(tabId)`, `HostedSectionPanel`, `sections` per tab in every policy layer (hide / order / add), Tabs tab rows expand to their sections with an add-section picker. Follow-up: the Results, Pharmacy and Care Plan sub-tab strips are sections too (`useSectionStrip`), so hide / order / add reach them. **Shipped.** | 7 |
| 8a | Roles and service registrations | Roles tab: roles × permissions matrix over the `auth.roles` json setting (live; applied in `get_current_user` on every request, no re-login; `admin` keeps `admin` + `system`; unknown permissions rejected), `GET /api/command-center/roles`. Apps tab: external services (list / register / activate / deactivate / health-check / delete over the existing `/api/external-services` API), SMART apps read-only. **Shipped.** | 2 |
| 8b | SMART app registration | `smart_auth.registered_apps` is the durable, cross-worker store (`api/smart/app_store.py`; the authorization server reloads it every 5 s), `POST /api/smart/apps` / `PUT` / `rotate-secret` behind `system`, bcrypt-hashed client secrets returned exactly once, **the token endpoint now verifies confidential clients' secrets** (it never did), Apps tab registers apps and shows the secret once. Demo apps stay code-defined and read-only. **Shipped.** | 8a |
| 9 | Module management | `GET /api/command-center/modules` (routers, registered / failed / disabled, builtin vs external, declared settings) joined on the Modules tab with the frontend manifests (tabs, pages, sections, slots, `permissions`). Backend modules declare settings in `api/<pkg>/settings.py` (`SETTINGS`, keys `module.<key>.*`), discovered at router registration into the Settings tab. Enable/disable stays deploy-time and the tab says which env var and tier. **Shipped.** | 5 |
| 10 | Control plane sidecar | `control-plane/` compose service (the only container with the Docker socket; never published; `CONTROL_PLANE_TOKEN` gate; allow-lists from env, nothing free-form). Backend proxies it under `/api/command-center/control/...`: container state, docker logs of any listed container, restarts of restartable ones (`system`, audited `system.control.restart`), update check (`git ls-remote`, read-only), config view (rendered nginx.conf, compose file, `.env` variable names only). Control tab. **Shipped.** | 1 |
| 11 | Readiness and host | Status tab gains two sidecar-backed components, `host` (disk free on the repo mount, memory, load; degraded under 10% disk) and `tls` (every cert under `certbot/conf/live`: expiry, self-signed placeholder, expiring within 14 days; none → absent, i.e. plain HTTP), plus a **readiness checklist** (`readiness.py`): profile, example secrets, settings key, auth mode, patients loaded, terminology index, UMLS key, Redis, control plane, disk, HTTPS, VNA — each with a fix. `GET /control/host` and `/control/certificates` proxies. **Shipped.** | 1, 10 |
| 12 | Audit trail | `GET /api/command-center/audit` reads the FHIR `AuditEvent`s every admin write and login already produce (newest first; window and event type filtered by HAPI, user / category / text within the fetched page) and the Audit tab shows them with expandable details. **Shipped.** | 1 |
| 13 | Configuration export / import | `GET /api/command-center/config/export` writes every override (settings, `ui.tabs.policy`, `auth.roles`) as one JSON document with secrets listed by key only; `POST /config/import` plans (set / reset / unchanged / skip, with the tier so the UI can say "restart needed") and, on `apply`, writes through the settings service so every change is validated and audited; `replace` also resets overrides the file omits; unknown keys skip rather than fail. Settings tab bar with a preview dialog (`config_transfer.py`, `ConfigTransfer.jsx`). **Shipped.** | 2 |
| 14 | Confirmed update-apply | Control tab → Updates: **Preview** (`GET /control/update/preview`) fetches origin and lists the commits, files by area (backend / frontend / control-plane / deploy), whether a fast-forward is possible and what blocks it; **Apply** (`POST /control/update/apply {commit}`, `system`, confirmed, audited `system.control.update`) fast-forwards the host checkout to the previewed commit, `docker compose build` + `up -d` the configured services (`CONTROL_PLANE_UPDATE_SERVICES`, default the three app images; `CONTROL_PLANE_COMPOSE_PROFILE`), images only: nginx config and `.env` are never touched; `GET /control/update/status` polls. The repo is read-only in the sidecar, so everything that writes runs in a **helper container** (`control-plane/update.sh`) started from the sidecar's own image with the host repo path bind-mounted read-write at the same path, the socket, and the repo owner's uid: the sidecar can recreate itself without dying mid-update and `.git` never becomes root-owned. No automatic rollback (the previous commit is in the audit event). **Shipped.** | 10 |

Definition of done per slice: backend tests in `backend/tests/api/command_center/`,
frontend tests beside the components, the module `CLAUDE.md` current, and a
`docs/MODULES.md` note whenever a manifest field changes.

---

## Configurable tabs (slice 7) — design

The chart tab list is a build-time constant today (`CLINICAL_TABS` in
`clinicalTabRegistry.js`, imported directly by eight files). The design is a
layered policy where each layer can only narrow or reorder the one above it:

| Layer | Who sets it | Where |
|---|---|---|
| Platform registry | code + module manifests | `clinicalTabRegistry.js`, `registry.generated.js` |
| Organization policy | `system` admin | settings key `ui.tabs.org` |
| Role policy | `admin` | `ui.tabs.role.<role>` |
| Workflow context | `admin` | `ui.tabs.context.<context>` (inpatient, surgical, …) |
| User preference | the user | per-user, later |

Rules: unknown tab ids are ignored with a warning; Summary can never be
removed; a deep link to a hidden tab falls back to the default tab with a
notice; module tabs are governed by tab id like any other.

Implementation (shipped): the policy is ONE json setting, `ui.tabs.policy`
(`backend/api/command_center/tab_policy.py` validates shape only — tab ids
are a frontend fact). `src/components/clinical/workspace/tabPolicy.js` is
the pure resolver, `tabPolicyStore.js` the per-page cache of
`GET /api/command-center/ui-policy` (no auth: it only says what is hidden),
`useEffectiveTabs.js` the hook. The registry stays the catalog of what
exists; the hook is what is shown.

---

## Extensions — what the Command Center must leave room for

WintEHR's extension seams are build-time external modules
(`wintehr.modules.json` + `scripts/sync-modules.py`), external CDS services
by URL, SMART apps, and slots. The Command Center manages those; it does not
add runtime loading of frontend code. To keep extensions first-class:

- setting keys are namespaced: `module.<key>.<name>` vs `system.<name>`;
- a manifest may declare a `settings` schema (key, type, default, tier,
  label) that the Command Center renders as a form;
- a manifest may declare `permissions` it requires, shown before enabling;
- the "app store" idea becomes a catalog that writes
  `wintehr.modules.json` entries and prompts a rebuild.

---

## Parked

LDAP, Epic sandbox, FHIRCast, *unattended* auto-apply of updates (apply is confirmed by hand, slice 14), HAPI `application.yaml`
editing (boot-time; expose a read-only subset), in-browser editing of
compose/nginx. Accessibility settings stay in the user-facing Settings page.
