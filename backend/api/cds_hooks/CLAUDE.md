# CDS Hooks — module reference

HL7 CDS Hooks 2.0 service engine: service discovery (`cds-services`), hook
execution, the declarative condition engine, parallel orchestration, and the
CQL authoring bridge to HAPI's Clinical Reasoning module.

**Inherits** root + `backend/CLAUDE.md` + `backend/api/CLAUDE.md` patterns
(HAPI-FHIR-is-the-store, backend-as-proxy, async everywhere, env-driven URLs,
service-layer separation, educational / no-PHI). Only module-specific deltas
are below.

Module version **3.1** (post-deduplication). Two authoring paths coexist —
Python `CDSService` classes and student-authored CQL. Don't add a third.

---

## Two ways a service exists — and how dispatch picks one

A CDS service is either a **built-in Python class** (registered in-process) or
a **HAPI `PlanDefinition`** carrying a `service-origin` extension. `cds-services`
discovery merges both. `cds_hooks_router.py` `execute_service()` routes by that
extension:

| `service-origin` extension | Provider | Path |
|---|---|---|
| (none, in-registry) | in-process `CDSService` | built-in Python |
| `"external"` | `RemoteServiceProvider` | HTTP POST to a remote CDS service |
| `"visual-builder"` + `service_type='cql-based'` | `CQLBackedServiceProvider` | CQL → HAPI `$apply` (see below) |
| `"visual-builder"` + other `service_type` | `VisualServiceProvider` | visual condition tree |
| `"built-in"` (in HAPI, not registry) | `LocalServiceProvider` | legacy fallback |

The CQL vs. visual fork is decided by `VisualServiceConfig.service_type`
(a DB column, not a PlanDefinition extension) via `is_cql_service_type()` —
both share `service-origin="visual-builder"` so discovery, audit, and feedback
flows are identical.

Providers live in `providers/` (`__init__.py` exports `BaseServiceProvider`,
`LocalServiceProvider`, `RemoteServiceProvider`, `CQLBackedServiceProvider`).

---

## The canonical patterns (don't reinvent)

- **New built-in service** → subclass `CDSService` (`services/base_service.py`):
  class-level `service_id` / `hook_type` / `title` / `prefetch_templates`,
  implement `should_execute()` + `execute()`, return `create_card(...)` results,
  then `register_service(...)` from `registry/`.
- **Conditions** → use `ConditionEngine` (`conditions/engine.py`), not scattered
  `if/else`. Factory methods: `age_at_least/age_between`, `gender_is`,
  `has_diagnosis`, `on_medication/medication_count`, `lab_above/lab_below/lab_critical`,
  `hook_is`, `all_of/any_of/none_of`. `ConditionEngine` is the **only** canonical
  evaluator — the legacy `CDSHookEngine` was removed in v3.1.
- **Multi-service execution** → `execute_hook()` (`orchestrator/`) runs all
  services for a hook in parallel (`asyncio.gather`), evaluates conditions,
  applies per-service timeouts, and isolates failures so one bad service can't
  break the response.
- **Prefetch** → `execute_prefetch()` + `PrefetchTemplates.get_for_hook()`
  (`prefetch/`) resolve FHIR query templates against HAPI.

The orchestrator response carries `cards`, `services_executed`,
`services_skipped`, `total_execution_time_ms`, and `to_cds_response()`.

---

## CQL Bridge — student-authored CDS via HAPI's `$apply`

A second authoring path lives alongside the visual condition tree: students
write Clinical Quality Language (CQL), the bridge generates a FHIR
`Library` + `PlanDefinition`, and HAPI's Clinical Reasoning module evaluates
them via the `PlanDefinition/$apply` operation. This requires
`hapi.fhir.cr.enabled=true` on HAPI (set in `docker-compose.yml`).

The reference implementation that proves the path end-to-end is preserved at
`backend/scripts/cql_bridge_poc.py` — read that first if you're new to this
surface.

### CQL pieces (where the code lives)

```
backend/api/cds_hooks/
├── cql_bridge.py                 # Validate, $apply, RequestGroup→Card translator
├── cql_dev_helper.py             # Content-hashed Library upload (cache-bust during draft)
└── providers/cql_backed_provider.py  # Service provider — calls the bridge

backend/api/cds_studio/
├── cql_artifact_builder.py       # Library + PlanDefinition generation
├── value_set_composer.py         # Student-authored ValueSet CRUD
├── hapi_admin.py                 # POST /admin/cr/flush-caches helper
└── visual_builder_router.py      # Save/test/deploy endpoints fork by service_type

backend/scripts/active/expunge_dev_libraries.py  # Periodic cleanup of orphan Draft-* libraries
```

### Authoring conventions students follow

CQL services declare a fixed set of `define` names that the artifact builder
wires into `PlanDefinition.action`. `detect_cql_defines()` in
`cql_artifact_builder.py` is the source of truth.

| CQL define | Required? | Wired into | Effect |
|---|---|---|---|
| `Applicability` | **yes** | `action.condition.expression` (kind=applicability) | Boolean — gates whether the card fires |
| `CardSummary` | optional | `action.dynamicValue` path=title | String — overrides the static card title at `$apply` time |
| `CardDetail` | optional | `action.dynamicValue` path=description | String — overrides the static card detail |

### Why the dev-helper hashes content

cqf-fhir-cr-hapi caches compiled CQL→ELM in JVM memory keyed by Library
**name**, not (name, version). Bumping `Library.version` does NOT invalidate
the cache (confirmed empirically — `$expunge`, DELETE+PUT, and version bumps
all leave stale ELM in place). The escape hatches are: a fresh Library
identifier, a HAPI restart, or a manual `.clear()` on the cqf caches.

`cql_dev_helper.upload_dev_library()` takes the first route: each unique CQL
produces a unique `Draft{name}{sha256[:12]}` identifier, so iteration is always
cache-miss-fresh. `expunge_dev_libraries.py` reclaims the abandoned drafts.
For deploys, `upload_stable_library()` bakes the version into the Library name
(`DiabetesCareV120` for v1.2.0) — each deployed version is an immutable
artifact at a unique URL (CRMI-aligned).

### ValueSet edits and the CR cache flush

The same engine also caches **ValueSet expansions** keyed by canonical URL.
Editing codes inside an existing ValueSet doesn't change the URL, so the
expansion cache holds stale codes — and the `CodeCacheResourceChangeListener`
that should fire on PUT doesn't register in our deployment.

Fix: the HAPI overlay (`deploy/hapi-overlay/`) adds a Spring controller
exposing `POST /admin/cr/flush-caches`. `value_set_composer.py` and
`cql_artifact_builder.py` call it after every write via `hapi_admin.py`.
Failure is non-fatal (falls back to stale-until-next-write). The endpoint is
gated by `HAPI_ADMIN_TOKEN` bearer auth, reachable only inside the Docker network.

### Translator: `$apply` response → CDS Hooks `Card[]`

`CQLBridge.request_orchestration_to_cards()` locates the `RequestGroup` —
whether top-level, contained in a `CarePlan` (cqf-fhir-cr-hapi R4 default), or
wrapped in a `Bundle` — then per `action[]`:

```
action.title       → Card.summary (truncated to 140 chars)
action.description → Card.detail  (or used as summary fallback)
action.priority    → Card.indicator (routine→info, urgent→warning, stat→critical)
action.action[]    → Suggestion[] (with optional inline FHIR resources)
```

Actions with neither title nor description are skipped (structural grouping).
`OperationOutcome` warnings in `contained[]` aggregate into `ApplyResult.warnings`
(logged, non-fatal).

---

## Start here

- `cds_hooks_router.py` — discovery (`cds-services`), `execute_service()` dispatch.
- `services/base_service.py` — `CDSService` base class; the built-in pattern.
- `conditions/engine.py` — `ConditionEngine` + condition classes / factories.
- `orchestrator/service_orchestrator.py` — parallel execution + `execute_hook()`.
- `cql_bridge.py` + `backend/scripts/cql_bridge_poc.py` — the CQL path end-to-end.

Sub-routers mounted under this module's router (registered at `/api`):
`actions/router.py` (`/actions/*` — action execution) and `audit/router.py`
(`/audit/*` — CDS audit trail). `feedback/`, `hooks/`, and `prefetch/` are
support libraries, not independently-registered routers.

---

## Out of scope / what NOT to do here

- **CQL artifact generation and the visual builder UI/endpoints live in
  `api/cds_studio/`**, not here. This module *consumes* the generated
  `Library`/`PlanDefinition`; it does not author them.
- **No custom CDS storage tables.** `PlanDefinition`/`Library`/`ValueSet` live
  in HAPI (`hfj_*`); visual-builder configs live in the `cds_hooks` schema
  (`VisualServiceConfig` etc.). There is no `cds` schema — the dead
  `database_models.py` that targeted it was removed in v3.1.
- Removed in v3.1, do not resurrect: `service_executor.py`, `rules_engine/`,
  `orchestrator/hook_engine.py` (`CDSHookEngine`), `hooks/default_hooks.py`,
  and the `POST /cds-services/test/{id}` + `/rules-engine/*` endpoints.

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Service not in `cds-services` discovery | `execute_service` discovery merge — built-in registry vs. HAPI `PlanDefinition` with `service-origin` extension |
| CQL edit not taking effect after save | ELM cache keyed by Library name — `cql_dev_helper.py` should produce a fresh `Draft*` id; check the upload actually ran |
| ValueSet code change not reflected | CR expansion cache — confirm `POST /admin/cr/flush-caches` fired (HAPI overlay deployed? `HAPI_ADMIN_TOKEN` set?) |
| `$apply` returns no cards | `request_orchestration_to_cards` found no `RequestGroup`, or actions lacked title/description |
| CQL service dispatched to wrong provider | `VisualServiceConfig.service_type` — `is_cql_service_type()` decides CQL vs. visual |
| Orphan `Draft-*` libraries piling up in HAPI | run `scripts/active/expunge_dev_libraries.py` |

## See also

- `docs/STUDENT_CQL_PRIMER.md` — student-facing CQL authoring guide
- HL7 [Clinical Reasoning — CDS on FHIR](http://www.hl7.org/fhir/clinicalreasoning-cds-on-fhir.html)
