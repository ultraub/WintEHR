# WintEHR Backend — module reference

FastAPI backend: an intelligent proxy over HAPI FHIR plus business logic
(clinical workflows, CDS Hooks, auth, real-time events, catalogs).

**Inherits** root `CLAUDE.md` patterns (HAPI FHIR is the FHIR store, backend is
a proxy that adds value then delegates, async everywhere, env-driven URLs,
educational / no-PHI). Do not restate those here — only backend-specific
deltas are below.

---

## Start here

- `main.py` — app construction: middleware order, then `register_all_routers`.
- `api/routers/__init__.py` — **the single source of truth for routing.** Every
  router is registered here, in numbered groups. A router's real URL is its own
  prefix *plus* whatever `prefix=` is passed at registration. Read this file
  before wiring any frontend call (see "Routing" below).
- `services/hapi_fhir_client.py` — `HAPIFHIRClient`: the only sanctioned path to
  FHIR data. Methods: `search`, `read`, `create`, `update`, `delete`,
  `search_with_includes`, `operation` (for `$everything` etc.), `bulk_patch`.
- `database.py` — `get_db_session` (the real one) + `get_db_context`.

---

## Routing — confirm the resolved path, never trust the prefix

Routers are **inconsistent**: some carry a full `/api/...` prefix in their own
`APIRouter(prefix=...)`, some carry a short prefix and get `/api` prepended at
registration, some carry no prefix at all. The resolved path is
`router-file prefix` + `registration prefix`.

| Router | File prefix | Registered with | Resolved base |
|---|---|---|---|
| `api/fhir/proxy.py` | (none) | (none) | `/fhir/...` (HAPI proxy) |
| `api/auth/router.py` | `/api/auth` | (none) | `/api/auth` |
| `api/cds_hooks/cds_hooks_router.py` | (none) | `prefix="/api"` | `/api/cds-services` |
| `api/clinical/orders/orders_router.py` | `/clinical/orders` | `prefix="/api"` | `/api/clinical/orders` |
| `api/clinical/drug_safety_router.py` | `/drug-safety` | `prefix="/api/clinical"` | `/api/clinical/drug-safety` |
| `api/catalogs/router.py` | `/api/catalogs` | (none) | `/api/catalogs` |
| `api/websocket/websocket_router.py` | (none) | `prefix="/api"` | `/api/ws` |

When in doubt, grep `api/routers/__init__.py` for the `include_router` call —
that, plus the `APIRouter(...)` line in the router file, gives the truth.

**`api/dependencies.py` is dead code.** Its `get_db_session` yields an
`AsyncMock()`. Routers import `from database import get_db_session` — the real
one. Do not import from `api/dependencies.py`.

---

## Router / service split (owned here; child docs link up)

This is the canonical statement of the layering — `api/CLAUDE.md` and clinical
sub-module docs reference it rather than restating.

- **Router** (`*/router.py`, `*/{name}_router.py`): HTTP surface only — parse
  request, call a service, map errors to `HTTPException`. No DB queries, no
  business logic in the router body.
- **Service** (`*/service.py`): business logic, DB access, HAPI calls. Takes an
  `AsyncSession` in `__init__`; injected via a `get_*_service` dependency.
- **FHIR resources**: services call `HAPIFHIRClient`, never SQL. There is no
  `FHIRStorageEngine` and no custom FHIR ORM — both were removed.

A new router must be registered in `api/routers/__init__.py`; nothing is
auto-discovered.

---

## Module map

| Directory | What it is |
|---|---|
| `api/auth/` | Auth. `get_current_user` lives in `api/auth/service.py`. Demo-mode + JWT. See `api/auth/CLAUDE.md` — auth is intentionally insecure for the training platform. |
| `api/clinical/` | CPOE, pharmacy, MAR, results, tasks, alerts, inbox, notes, drug safety. Safety-critical. See `api/clinical/CLAUDE.md`. |
| `api/cds_hooks/` | CDS Hooks 2.0 (module v3.1). `orchestrator/` runs services; `conditions/` evaluates declarative rules. See `api/cds_hooks/CLAUDE.md`. |
| `api/cds_studio/` | Visual CDS builder; ValueSet composer; HAPI `PlanDefinition` admin. |
| `api/catalogs/` | Unified clinical catalogs at `/api/catalogs/...`. |
| `api/fhir/` | HAPI FHIR proxy (`proxy.py`) + relationship/search-value/schema routers. No `core/` subdir. |
| `api/websocket/` | Real-time events. `connection_manager.py` exports the `manager` singleton; `fhir_notifications.py` broadcasts resource changes. |
| `api/middleware/` | `security_middleware.py` (`setup_security_middleware`), `performance.py`, `reference_normalizer.py`. |
| `api/services/` | Cross-cutting services: `audit_service.py`, `notification_service.py`, plus `analytics/`, `clinical/`, `data/`, `fhir/`. |
| `api/smart/` | SMART-on-FHIR authorization + token middleware. |
| `api/imaging/`, `api/dicom/` | Imaging studies / DICOM. |
| `api/system/` | `health.py`, `monitoring.py`, `debug_router.py` (only registered when `DEBUG=true`). |
| `api/quality/`, `api/analytics/`, `api/scheduling/`, `api/questionnaires/`, `api/ui_composer/` | Self-named feature modules. |
| `clinical_canvas/` | AI-driven UI generation (top-level, not under `api/`). |
| `scripts/` | Data tooling: `active/`, `data/`, `migrations/`, `synthea/`. |

---

## Database

FHIR data is in HAPI's `hfj_*` tables — never write them directly. The async
engine sets `search_path = fhir,cds_hooks,public`, so custom (non-FHIR) tables
live in named schemas.

| Schema | Purpose |
|---|---|
| `hfj_*` (public) | HAPI FHIR JPA storage — read-only to us |
| `auth.*` | Authentication |
| `cds_hooks.*` | CDS Studio visual-builder configs + execution logs |
| `dicom.*` | DICOM file metadata |
| `audit.*` | Legacy audit-trail schema — **no writers remain**; audit events are FHIR `AuditEvent` resources in HAPI (`api/services/audit_event_service.py`) |

```sql
-- Resource counts (the only correct way — there is no fhir.resources table)
SELECT res_type, COUNT(*) FROM hfj_resource
WHERE res_deleted_at IS NULL GROUP BY res_type;
```

---

## Commands

```bash
./deploy.sh dev                       # full stack via Docker
docker-compose logs backend-dev -f    # backend logs
cd backend && python main.py          # direct run (needs PG + Redis + HAPI up)

pytest tests/ -v                      # all tests
pytest tests/ -m "not integration"    # skip service-dependent tests
```

Test markers: `asyncio`, `integration`, `unit`, `slow`. Swagger at
`/docs`, health at `/health`.

Key env vars: `DATABASE_URL`, `HAPI_FHIR_URL`, `REDIS_URL`, `JWT_ENABLED`,
`CORS_ORIGINS`, `ENVIRONMENT`, `DEBUG`.

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Frontend call 404s | Prefix mismatch — re-derive the resolved path from `api/routers/__init__.py` + the router's `APIRouter(...)` line |
| New router never reachable | Not added to `register_all_routers` in `api/routers/__init__.py` |
| Endpoint returns mock/empty data with no error | Something imported `get_db_session` from `api/dependencies.py` (yields `AsyncMock`) instead of `database.py` |
| `register_all_routers` silently skips a group | Each numbered block is wrapped in `try/except` that logs and continues — check backend logs for `Failed to register ...` |
| FHIR write "succeeds" but data missing | Wrote to a custom table instead of HAPI — all FHIR resources go through `HAPIFHIRClient` |
| Import error for `FHIRStorageEngine` / `fhir.core.storage` | Both removed; use `HAPIFHIRClient` |

---

## Out of scope here

- Universal rules (HAPI-is-store, async, env-URLs, no-PHI) → root `CLAUDE.md`.
- Clinical workflow specifics (order/dispense/admin gates) → `api/clinical/CLAUDE.md`.
- CDS Hooks internals → `api/cds_hooks/CLAUDE.md`.
- Auth security warnings → `api/auth/CLAUDE.md`.
- Generic FastAPI / SQLAlchemy / Pydantic usage — not documented here; the model
  knows it. This repo is on **Pydantic V2** (`pattern=`, not `regex=`).
