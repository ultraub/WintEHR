# Backend API layer — module reference

The FastAPI API layer: routers grouped by domain, the HAPI FHIR proxy,
auth, CDS Hooks, real-time WebSocket events, and cross-cutting services.

**Inherits** root `CLAUDE.md` + `backend/CLAUDE.md` patterns. In particular,
`backend/CLAUDE.md` owns the **routing model** and the **router/service split** —
read it there, it is not restated here. This file carries only what is specific
to navigating `api/` itself.

---

## Start here

- `routers/__init__.py` — `register_all_routers(app)`. The ONLY place routers
  are wired. Nothing is auto-discovered; a new router that is not added here is
  unreachable. Registration is a flat, ORDER-PRESERVING `ROUTERS` list with
  one `try/except` per router — a failure disables exactly that router, is
  logged, and is reported by `GET /api/health` (`FAILED_ROUTERS`). New
  routers: full `/api/...` prefix in the router file, no prefix kwarg in the
  list entry.
- `../main.py` — middleware order then `register_all_routers`.
- Each subdomain dir (`auth/`, `clinical/`, `cds_hooks/`, ...) holds its own
  `router.py` + `service.py`; several have their own `CLAUDE.md`.

---

## Subdirectory map

| Directory | Role | Has CLAUDE.md |
|---|---|---|
| `routers/` | `register_all_routers` — central registration | — |
| `auth/` | Auth; `get_current_user` is in `auth/service.py` | yes |
| `clinical/` | CPOE, pharmacy, MAR, results, tasks, alerts, inbox, notes, drug safety | yes |
| `cds_hooks/` | CDS Hooks 2.0 implementation (v3.1) | yes |
| `cds_studio/` | Visual CDS builder + ValueSet composer + HAPI `PlanDefinition` admin | — |
| `catalogs/` | Unified clinical catalogs (`/api/catalogs/...`) | — |
| `fhir/` | HAPI proxy (`proxy.py`) + relationship / search-value / schema routers | — |
| `websocket/` | Real-time events; `connection_manager.py` exports the `manager` singleton | — |
| `middleware/` | `security_middleware.py`, `performance.py`, `reference_normalizer.py` | — |
| `services/` | Cross-cutting: `audit_service.py`, `notification_service.py`, + `analytics/`, `clinical/`, `data/`, `fhir/` subpkgs | — |
| `smart/` | SMART-on-FHIR auth + token middleware | yes |
| `imaging/`, `dicom/` | Imaging studies / DICOM | — |
| `system/` | `monitoring.py`, `debug_router.py` (only when `DEBUG=true`); app health endpoints live in `../main.py` | — |
| `quality/`, `analytics/`, `scheduling/`, `questionnaires/`, `ui_composer/` | Self-named feature modules | — |

There is **no `fhir/core/` subdir** and **no `core/storage.py`**.

---

## Resolving an endpoint's real URL

**Normalized convention: the router file's own `APIRouter(prefix="/api/...")`
IS the full public prefix — registration passes no prefix.** Read the
`APIRouter(...)` line and you have the truth; no cross-referencing needed.

Exceptions deliberately outside `/api`: `fhir/proxy.py` (`/fhir/...` —
spec-visible FHIR base), `smart/router.py` (`/.well-known`, `/oauth` —
spec-mandated locations), and two pre-convention escapees pending the
proxy-config reconciliation: `clinical/documentation/notes_router.py`
(`/clinical/notes`) and `dicom/router.py` (`/dicom`).

---

## CDS Hooks — what exists now (v3.1)

The CDS Hooks subsystem was restructured. Files the prior doc named are **gone**:
`service_executor.py`, `cds_hooks_v2_complete.py`, and the `rules_engine/`
package no longer exist.

What is there:
- `cds_hooks/cds_hooks_router.py` — the HL7 endpoints. Resolves under
  `/api/cds-services` (`GET /cds-services`, `POST /cds-services/{service_id}`,
  `.../feedback`, `.../analytics`).
- `cds_hooks/orchestrator/service_orchestrator.py` — runs services (parallel
  dispatch).
- `cds_hooks/conditions/engine.py` + `conditions/evaluators/` — declarative
  condition evaluation (this replaced the old rules engine).

There is no `service_registry.register_cds_service` decorator pattern; do not
follow examples that import one.

---

## WebSocket

`websocket/websocket_router.py` exposes `/ws` and `/ws/{client_id}` (resolved
under `/api`). The frontend connects via `getWebSocketUrl()` from
`src/config/apiConfig.js` — the WS URL is **derived from `window.location`**, never
hardcoded. Do not write examples with `ws://localhost:8000`; a baked-in host
breaks every non-localhost deployment (root `CLAUDE.md` rule).

`connection_manager.py` exports a module-level `manager` singleton;
`fhir_notifications.py` (`FHIRNotificationService`) broadcasts
resource-created / updated / deleted / clinical-event messages.

---

## Cross-cutting services

- `services/audit_event_service.py` — `AuditEventService` + `AuditEventType`
  constants; writes FHIR R4 `AuditEvent` resources into HAPI. (The legacy
  SQL writer `audit_service.py` → `audit.events` was removed — that schema
  has no writers now.) Audit logging is a learning feature (event trail),
  **not** HIPAA PHI auditing — this platform handles only synthetic Synthea
  data.
- `services/notification_service.py` — critical-value, task, appointment, and
  medication notifications. (Its former wrapper,
  `clinical/notifications_helper.py`, had zero importers and was deleted in
  the dead-code purge — call the service directly.)

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Endpoint 404s | Re-derive resolved URL: router `APIRouter(...)` line + `routers/__init__.py` registration |
| New router unreachable | Not added to `register_all_routers` |
| A whole domain's routes missing | Its `try/except` block in `routers/__init__.py` swallowed an import error — grep backend logs for `Failed to register` |
| Import error `fhir.core.storage` / `FHIRStorageEngine` | Removed — use `HAPIFHIRClient` |
| CDS code referencing `service_executor` / `rules_engine` | Removed in v3.1 — use `orchestrator/` + `conditions/` |

---

## Out of scope here

- Universal rules + DB schemas → root + `backend/CLAUDE.md`.
- Router/service layering pattern → `backend/CLAUDE.md` (stated once there).
- Clinical workflow gates, drug-safety checkers → `clinical/CLAUDE.md`.
- CDS Hooks orchestration internals → `cds_hooks/CLAUDE.md`.
- Auth security model → `auth/CLAUDE.md`.
- Generic FastAPI / SQLAlchemy / Pydantic / pytest / caching / pagination /
  rate-limiting / input-validation patterns — the model knows these; they are
  deliberately not documented. Repo is on **Pydantic V2** (`pattern=`, not
  `regex=`).
