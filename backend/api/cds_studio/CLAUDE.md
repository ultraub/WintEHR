# CDS Studio — module reference

The CDS authoring surface: a visual builder (condition tree **or** CQL text),
a student-authored ValueSet composer, and the artifact pipeline that turns a
saved service config into a deployed FHIR `PlanDefinition` HAPI can `$apply`.

**Inherits** root + `backend/CLAUDE.md` + `backend/api/CLAUDE.md` patterns
(HAPI-FHIR-is-the-store, backend-as-proxy, async everywhere, env-driven URLs,
router/service split, educational / no-PHI). Only module-specific deltas below.

This module **authors** CDS services. The sister module `api/cds_hooks/`
**executes** them. The CQL bridge spans both — `cds_hooks/CLAUDE.md` owns the
runtime/dispatch and ELM-cache narrative; this doc owns the authoring side.
Cross-link, don't restate.

---

## Three routers — and their resolved paths

All three self-prefix the full path and register in `api/routers/__init__.py`
group 5 ("Integration Services") with **no** extra registration prefix. The
resolved base equals the `APIRouter(prefix=...)` literal — but always confirm
against `routers/__init__.py` per the backend routing rule.

| File | Router prefix = resolved base | Purpose |
|---|---|---|
| `router.py` | `/api/cds-studio` | Service registry, metrics, versioning, rollback (HAPI-`PlanDefinition`-backed) |
| `visual_builder_router.py` | `/api/cds-visual-builder` | Visual-service CRUD, test, **deploy**, CQL validate |
| `value_set_composer.py` | `/api/cds-studio/value-sets` | Student ValueSet CRUD + `$expand` proxy |

Note the trap: `router.py` and `value_set_composer.py` share the `/api/cds-studio`
stem but are **different routers**; `visual_builder_router.py` lives under a
**different** stem (`/api/cds-visual-builder`). The frontend builder UI talks to
`/api/cds-visual-builder`; the registry/dashboard talks to `/api/cds-studio`.

---

## What a saved service actually is

A visual service is one DB row in `cds_visual_builder.service_configs`
(`VisualServiceConfig`, `visual_service_config.py`). The `service_type` column
(`VARCHAR`, not an enum despite `ServiceType` existing) forks two authoring
paths — `is_cql_service_type()` is the single decider:

| Path | `service_type` | Logic stored in | Materializes to HAPI |
|---|---|---|---|
| **Visual condition tree** | anything except `cql-based` | `conditions` JSON column | nothing at save — interpreted live by `VisualServiceProvider` |
| **CQL** | `cql-based` | `cql_source` TEXT column | `Library` + `PlanDefinition` on save (see below) |

For the visual path, `ServiceCodeGenerator` (in `cds_hooks/`) writes a Python
string into `generated_code` — that string is **display/export only, never
executed**. At runtime `VisualServiceProvider` (`visual_service_provider.py`)
interprets the `conditions` JSON tree directly against HAPI. Do not treat
`generated_code` as live code.

---

## The CQL materialization pipeline (this module's core value)

`cql_artifact_builder.materialize_cql_service()` is the heart of the module.
It runs on every CQL-service create/update, and again on deploy. Steps:

1. **`inline_value_set_retrieves()`** — rewrites every `[Resource: "VS"]`
   retrieve into an inline `where exists (... C.code in {...})` clause. HAPI's
   `code:in=<canonical>` resolution needs Hibernate Search/Lucene, which the
   educational deployment does **not** run (UMLS reindex is too memory-hungry).
   The rewrite resolves the ValueSet's codes via plain `ValueSet?url=` +
   `compose.include[].concept[]` (no `$expand`) and bakes them into the CQL.
   Idempotent; unresolved ValueSets are skipped with a warning, not fatal.
   `_RETRIEVE_CODE_FIELD` maps each FHIR resource type to its codeable field —
   extend it when students start using a new resource type.
2. **Require `define Applicability:`** — `detect_cql_defines()` must find it or
   `ValueError`. It becomes `action.condition` (kind=applicability).
3. **Upload the `Library`** — draft uses `cql_dev_helper.upload_dev_library()`
   (content-hashed `Draft*` id, see `cds_hooks/CLAUDE.md` for the ELM-cache
   *why*); deploy uses `upload_stable_library()` (version baked into the name,
   `DiabetesCare` + `V` + `100` → `DiabetesCareV100`).
4. **`build_plan_definition()`** — wraps the Library: `named-event` trigger from
   `hook_type`, `action.condition` from `Applicability`, `action.dynamicValue`
   entries binding optional `CardSummary`/`CardDetail` defines to
   `action.title`/`description`, `action.priority` from card indicator
   (`INDICATOR_TO_PRIORITY`: info→routine, warning→urgent, critical→stat).
5. **PUT `PlanDefinition/{service_id}`** to HAPI, then `flush_cr_caches()`.

The PlanDefinition carries `service-origin="visual-builder"` plus
`hook-type` / `hook-service-id` extensions — that is the contract by which
`cds_hooks` dispatch finds and routes the service (see the dispatch table in
`cds_hooks/CLAUDE.md`).

### CQL define convention (students follow this)

| CQL `define` | Required | Wired into |
|---|---|---|
| `Applicability` | **yes** — boolean | `action.condition` — gates the card |
| `CardSummary` | optional — string | `dynamicValue` path=title |
| `CardDetail` | optional — string | `dynamicValue` path=description |

`APPLICABILITY_DEFINE` / `CARD_SUMMARY_DEFINE` / `CARD_DETAIL_DEFINE` constants
in `cql_artifact_builder.py` are the source of truth — `cds_hooks/cql_bridge.py`
keeps an independent copy of this same convention.

---

## ValueSet composer

Students build small ValueSets from catalog codes. `value_set_composer.py`
PUTs a FHIR `ValueSet` to HAPI (codes grouped by system under
`compose.include[]`) **and** mirrors metadata into
`cds_visual_builder.value_sets` (`VisualValueSet`) for fast list/search.

- `vs_id` is kebab-cased from the name; `wintehr-*` ids are **reserved** for the
  system terminology loaded by `scripts/load_terminology.py` and rejected.
- `ValueSet.name` allows spaces (it is FHIR datatype `string`, not `id`) —
  deliberately, so CQL `[Condition: "Diabetes Mellitus"]` retrieves match. The
  name is whitespace-normalized on save to kill invisible trailing-space bugs.
- Every write calls `flush_cr_caches()` (`hapi_admin.py`) — editing codes
  in-place doesn't change the canonical URL, so HAPI's CR expansion cache would
  otherwise serve stale codes. See the cache narrative in `cds_hooks/CLAUDE.md`.
- `visual_builder_router._validate_cql_valueset_urls()` rejects CQL on save
  whose `valueset` declarations point at canonical URLs with no matching
  composed ValueSet — fails loud instead of a silent runtime `{"cards": []}`.

---

## Draft vs. deploy

`POST /api/cds-visual-builder/services` (create) and `PUT .../services/{id}`
(update) materialize CQL in **draft mode** (`stable=False`) — content-hashed
Library, fast iteration. `POST .../services/{id}/deploy` re-materializes in
**stable mode** (`stable=True`) at a version-tagged canonical URL, version
`1.0.{service.version}` from the auto-incremented config column.

CQL create/update is **transactional against HAPI**: if `materialize_cql_service`
throws, the `VisualServiceConfig` row is deleted/rolled back so no CQL row is
left without its HAPI artifacts.

---

## Start here

- `cql_artifact_builder.py` — `materialize_cql_service()` + `build_plan_definition()`.
  The whole CQL authoring pipeline. Read its module docstring first.
- `visual_service_config.py` — `VisualServiceConfig` / `VisualValueSet` ORM
  models + `is_cql_service_type()`. The DB schema mapping notes are load-bearing.
- `visual_builder_router.py` — `create` / `update` / `deploy` show the
  fork-by-`service_type` save flow end-to-end.
- `visual_service_provider.py` — `VisualServiceProvider.execute()` — how a
  condition-tree (non-CQL) service runs.
- `cds_hooks/CLAUDE.md` — the runtime/dispatch side and CQL-bridge cache *why*.

---

## Out of scope / what NOT to do here

- **CQL execution, `$apply`, the RequestGroup→Card translator, the ELM-cache
  rationale** → `api/cds_hooks/` (`cql_bridge.py`, `cql_dev_helper.py`). This
  module generates artifacts; it does not run them.
- **No `cds` schema, no custom FHIR tables.** `Library`/`PlanDefinition`/
  `ValueSet` live in HAPI `hfj_*`; builder configs live in the
  `cds_visual_builder` schema (`postgres-init/06_cds_visual_builder.sql`) — note
  that is a distinct schema from `cds_hooks`.
- `IMPLEMENTATION_SUMMARY.md` and `README.md` in this dir are dated
  (Oct 2025, "Phase 1") and describe the original built-in-Python-service vision
  before the CQL path landed — treat them as historical, verify against code.
- Student-facing CQL authoring guidance → `docs/STUDENT_CQL_PRIMER.md`,
  `docs/CQL_AUTHORING_PROMPT.md`, `docs/CDS_STUDIO_*.md`.

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Save 400 "missing `define Applicability:`" | CQL has no Applicability gate — `detect_cql_defines` in `cql_artifact_builder.py` |
| Save 400 "references ValueSet canonical URL(s) that don't match" | `_validate_cql_valueset_urls` — canonical URL is kebab-case from the VS name; compose the VS first |
| Save 502 "Failed to upload CQL artifacts" | `materialize_cql_service` threw — HAPI down or rejected the Library/PlanDefinition; DB row was rolled back |
| CQL edit not taking effect | Draft Library is content-hashed; check the `Draft*` id changed. Deeper ELM-cache notes in `cds_hooks/CLAUDE.md` |
| ValueSet code change not reflected at runtime | CR expansion cache — confirm `flush_cr_caches()` fired (`HAPI_ADMIN_TOKEN` set, overlay deployed) |
| `[Resource: "VS"]` retrieve returns empty at runtime | `inline_value_set_retrieves` skipped it — resource type missing from `_RETRIEVE_CODE_FIELD`, or VS had no explicit codes |
| Test panel: "$apply returned no cards" | `Applicability` evaluated false for that patient — not an error |
| CQL service deployed but not firing | PlanDefinition missing `service-origin`/`hook-type` extensions, or wrong dispatch fork — see `cds_hooks/CLAUDE.md` |
| Frontend builder call 404s | `/api/cds-visual-builder` vs `/api/cds-studio` stem confusion — see router table above |
