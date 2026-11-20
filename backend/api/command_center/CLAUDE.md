# Command Center backend — module reference

Admin console for a WintEHR deployment: status, and in later slices
settings, jobs, tab policy, and module management. Module key
`command-center` (frontend half: `frontend/src/modules/command-center/`).
Plan and slice order: `docs/COMMAND_CENTER.md`.

**Inherits** root, `backend/`, and `backend/api/` `CLAUDE.md`. Only this
module's deltas are here.

---

## Layout

| File | Role |
|---|---|
| `router.py` | `/api/command-center/...`. Every route depends on `require_admin` (the `admin` permission). Writes, when they arrive, will require `system`. |
| `service.py` | `CommandCenterService.status()`: runs the probes concurrently under one timeout, rolls them up. `roll_up` is a pure function. |
| `probes.py` | One `async` probe per deployment part: `fhir`, `database`, `redis`, `terminology`, `vna`. Each returns a `ComponentStatus`; exceptions and timeouts become `down` in the service, never a 500. |
| `models.py` | `ComponentStatus` (`ok` / `degraded` / `down` / `absent`), `RouterStatus`, `BuildInfo`, `StatusReport`. |

---

## Rules specific to this module

- **Read-only until the settings slice lands.** Slice 1 ships no table and
  no write path. Do not add a write route without the audit hook
  (`api/services/audit_event_service.py` — FHIR `AuditEvent`, not the dead
  `audit.*` schema).
- **`absent` is not a failure.** A deployment without a VNA or without
  `REDIS_URL` reports `absent`, which never degrades the overall status.
  A missing terminology index is `degraded` on purpose: catalogs silently
  fall back to static lists, which is the support case the dashboard exists
  to surface.
- **Probes are injected, not patched.** Tests pass `probes={...}` and
  `router_state=...` to the constructor. Default probes only run in the
  real app.
- **`database` probe reads `hfj_resource` directly.** That is the one
  sanctioned raw read of HAPI's tables (resource counts; see
  `backend/CLAUDE.md`). Nothing here writes FHIR data outside
  `HAPIFHIRClient`.
- **Overall roll-up**: `fhir` down → `down`; any other `down`/`degraded` or a
  failed router → `degraded`; else `ok`.

---

## Env

| Var | Used for |
|---|---|
| `COMMAND_CENTER_PROBE_TIMEOUT` | Per-probe timeout, seconds (default 8) |
| `WINTEHR_VERSION`, `WINTEHR_GIT_COMMIT` | Reported in `build`; set by the image build when available |
| `TERMINOLOGY_DB_PATH`, `REDIS_URL`, `DICOM_QIDO_URL` | Read by the probes; same names the rest of the backend uses |
