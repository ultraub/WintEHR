# Architecture Debt & Opportunity Map

**Last Updated**: July 2026

A measured survey of cleaning / harmonizing / modularity opportunities across
WintEHR, produced by four parallel static-analysis sweeps (frontend data-access
census, frontend reachability census, backend structure survey, extensibility
audit) plus first-hand findings from the MIMIC-on-FHIR import work. Numbers
below are measured — import-graph analysis, route resolution, literal counts —
not impressions. This document tracks the findings and the agreed remediation
order; strike items through (with the PR number) as they land.

---

## Motivating case study

Rendering a medication's *name* required fixes in **six** places (PRs #275,
#277, #279, #281, #282, #283) because six code paths privately re-implemented
"resolve what to call this medication": the patient preview page, Chart Review,
the FHIRResourceContext fetch stamps, Pharmacy's lookup path, mixture
(ingredient-traversal) handling, and the Orders tab's private search service.
That is the signature of the debt catalogued here: the platform repeatedly
solves one concept in N private copies, and the copies drift.

---

## Findings (measured)

### F1 — ~43% of the frontend is unreachable dead code

283 of 662 non-test source files (~98,000 LOC) are unreachable from
`src/index.js`. Verified two ways: static import graph (including literal lazy
`import()` chunks) plus a path-based reference scan of all live code. It
clusters into whole abandoned subsystems rather than scattering:

- `components/clinical/results/` — 11/11 files dead (5,041 LOC)
- `components/clinical/dialogs/` — 13 files, an entire second dialog framework
- `components/clinical/workspace/cds/` — 12 files, a complete CDS card-builder UI
- `components/fhir-explorer-v4/query-building/components/` — 6/6 dead
- `services/` — 27 of 54 files dead (~14,300 LOC), incl. two circular-barrel
  "unified facades" (`services/cds/`, `services/medication/`) nothing imports
- Two failed consolidation layers: `HttpClientFactory.js` (569 LOC, 0 importers)
  and the `utils/{date,status,fhir,collection,string}` TS layer (2 live consumers)
- `hooks/` — 33 backwards-compat re-export shims, 17 with zero importers
- Backend: ~3,680 dead lines incl. `api/services/data/` and
  `api/services/analytics/` (whole subpackages), verified by repo-wide grep

Tooling: `frontend/scripts/find-dead-code.mjs` (reachability + orphan-test +
grep safety nets). Re-run it before and after any deletion PR.

### F2 — No single data-access path (the medication saga, generalized)

- ~30 distinct fetch entry points; 118 files import `fhirClient` directly
  (301 call sites); 60 of them are components.
- **Four parallel HTTP transports** reach the same FHIR server: `fhirClient`
  (axios + cache + queue), raw `fetch` (`enhancedOrderSearch`,
  `enhancedImagingSearch`, `providerResolverService`), raw axios + `buildUrl`
  (`cdsClinicalDataService` — 31 importers, the most-imported data service),
  and `services/api.js`.
- **46 independent `Map` caches across 30 files, 25 uncoordinated TTLs.** The
  same Observation can be "fresh" for 5, 10, or 30 minutes depending on which
  layer answers. `fhirClient.ts` and `clientConfig.ts` declare contradictory
  TTL/maxSize for the same client.
- 9 of 11 clinical tabs mix ≥2 data paths; 6 bypass the context entirely.
- Bundle `entry→resource` normalization is re-implemented in 29 files;
  `_include` handling in 29; patient-reference parsing in 31.

### F3 — Resource-type knowledge has no home

- 163 hardcoded resource-type array literals (75 frontend / 88 backend).
- 14 parallel frontend metadata catalogs (icons, colors, labels, groups) with
  memberships from 6 to ~140 types; 4 independent timeline implementations
  each with per-type switches.
- 7 conflicting copies of "which resources to load for a patient, at what
  priority" — measurably drifted (e.g. `AllergyIntolerance` is critical in one
  copy, important in another).
- Backend: two `REFERENCE_FIELDS` maps (25 vs 13 resource types) — the
  relationships API advertises links the traversal engine cannot follow.
- Sort-param knowledge (`authoredon` vs `authored` etc.) inlined as string
  literals at ~15 sites; the only structured mapping has 2 entries.

### F4 — Backend structure violates its own stated rules

- 13 files >800 lines under `api/` (15,745 lines = 26% of `api/`); the four
  god routers (cds_hooks 1,770 · orders 1,567 · visual_builder 1,539 ·
  pharmacy 1,526) hold business logic inline — 331-line handlers exist.
- 14 of 23 router directories have **no `service.py`**; `HAPIFHIRClient()` is
  constructed 137 times, never injected; 17 files bypass it with raw httpx.
- Route registration: 6 distinct prefix conventions across 37 registrations,
  leaking into **three proxy configs that disagree** (`vite.config.js`,
  `nginx-default.conf`, `nginx-ssl.conf`).
- `api/routers/__init__.py` try/except groups are all-or-nothing: one bad
  import in any of 12 clinical routers silently 404s all 12 (22 of 37 routers
  sit in two such blocks). The `FAILED_ROUTER_GROUPS` mitigation is dead —
  its only reader (`api/system/health.py`) is never registered.
- Duplicated service domains: catalog extraction ×3 (one with a live
  `TypeError` — see bugs), CDS service CRUD ×5, audit ×2, notification ×3,
  terminology ×3, WebSocket connection manager ×2.

### F5 — Where registries exist, they work

The tab registry (`clinicalTabRegistry.js`) genuinely drives 5 consumers;
adding a built-in CDS service is 3 edits in one file with fully derived
discovery. The codebase knows the pattern — it just wasn't applied to
resource types, routes, or data access. Extension cost today: new workspace
tab = 4 files (registry + 3 stale keyboard lists); new FHIR resource type =
25–30+ files; new CDS *hook type* = 11 lists; new data importer = from
scratch (the two existing importers share zero code).

---

## Live bugs found by the surveys

| # | Bug | Where |
|---|-----|-------|
| B1 | ~~`DynamicCatalogService(db)` called with a session its `__init__` doesn't accept → `TypeError` at request time on `/api/clinical/lab-catalog` and `/api/clinical/condition-catalog`~~ **Fixed** — argless construction, unused db dependency dropped, 3 regression tests | `api/clinical/cds_clinical_data.py`, `tests/api/clinical/test_cds_clinical_data_catalogs.py` |
| B2 | Keyboard tab lists have 10 entries vs registry's 12 — Administration and Inbox have no shortcut, and ctrl+Tab from either jumps to Summary (`indexOf → -1`) | `hooks/ui/useKeyboardNavigation.js:14-62`, `KeyboardShortcutsDialog.js:49-58` |
| B3 | ~~`GET /api/health` in `main.py` is shadowed by the CDS Hooks router's `/health`~~ **Fixed** — CDS diagnostics moved to `/api/cds-hooks/health`; `/api/health` is main.py's and reports `FAILED_ROUTERS` | `main.py`, `cds_hooks_router.py`, `tests/api/test_router_registration.py` |
| B4 | ~~5 of 11 backend CDS hook types are invisible/uncreatable in every frontend surface~~ **Fixed** — one frontend source (`constants/cdsHookTypes.js`, all 11) drives the context enum, both service dialogs, both pickers, and the wizard (which offered 3); twin parity tests pin frontend↔backend lockstep | `constants/cdsHookTypes.js`, `tests/api/cds_hooks/test_hook_type_parity.py` |
| B5 | ~~`REFERENCE_FIELDS` drift: 12 resource types advertised by `/fhir-relationships/schema` are untraversable by the relationship cache~~ **Fixed** — both derive from `api/fhir/reference_fields.py` (25 types / 152 fields); traversal follows everything the schema advertises; 4 parity tests | `api/fhir/reference_fields.py` |
| B6 | ~~`nginx-default.conf` proxies `/ws` → backend `/ws`, but the WS router resolves to `/api/ws`~~ **Fixed** in the proxy reconciliation — all four configs now agree; dead `/ws` and `/dicom` special-cases removed | `nginx-default.conf`, `nginx-ssl.conf`, `vite.config.js`, `deploy/nginx-prod.conf.template` |
| B7 | ~~`notifications_helper.py` documented as live in two CLAUDE.md files; it has zero importers~~ **Fixed in the purge** — file deleted, both CLAUDE.md files corrected | `api/CLAUDE.md`, `api/clinical/CLAUDE.md` |

---

## Ranked opportunity map

| # | Opportunity | Status |
|---|-------------|--------|
| **1** | **Dead-code purge.** Delete the 283 unreachable frontend files (~98k LOC) and ~10 dead backend modules, each triple-verified (import graph + path-reference grep + build/tests/lint). | **DONE** — frontend: 276 files deleted at `609841e6` (resurrect from parent `f4afc884`); backend: 10 modules + 2 empty subpackages in the follow-up commit. 9 files preserved deliberately (see below). |
| **2** | **One frontend data-access path.** Migrate callers to the existing context/fhirClient stack — not a new layer (two previous new-layer attempts died unadopted). Port the 4 raw-transport services, export the context's bundle normalization, collapse caches onto fhirClient LRU + `intelligentCache` TTLs. Tab-by-tab, behind the truthful-display test suite. | pending |
| **3** | **Resource-type registry.** One frontend module (icon, color, label, priority tier, sort params, export columns per type) and one backend `REFERENCE_FIELDS` source of truth; point the 14 catalogs and 7 priority lists at it. Drops "add a resource type" from 25–30 touch points to a handful. | **in progress** — `core/fhir/resourceRegistry.js` owns tiers/membership/labels/HAPI-sort-names; all surviving priority lists + sort maps migrated (2dd9f23a); hook-type lists unified (B4). **Remaining**: display metadata (icons/colors/export columns → migrate `categoricalAccents`, `fhirRelationshipService` maps, explorer catalogs, `dialogHelpers`, `exportUtils`, timeline eventTypes), and B5 (backend `REFERENCE_FIELDS` unification). |
| **4** | **Backend registration/routing hardening.** Per-router try/except; health endpoint reporting failures; one prefix convention; reconcile the three proxy configs. | **DONE** — flat per-router `ROUTERS` list (one failure = one router down, not twelve), `/api/health` reports `FAILED_ROUTERS` (B3 fixed), dead `api/system/health.py` removed; prefix convention normalized to full-prefix-in-file (OpenAPI-diff-proven neutral), escapees folded in (`/api/dicom` — fixing DICOM viewer calls that were broken per-environment — and `/api/clinical/notes`, zero live callers); proxy configs reconciled: `/dicom` and bare-`/ws` special-cases removed everywhere, `/api/ws` fixed in nginx-default (B6). Deliberate non-`/api` survivors: `/fhir`, SMART spec paths. |
| **5** | **Service extraction for the four god routers** (pharmacy, orders, cds_hooks, visual_builder — ~6,400 lines of inline logic). After #4, one router at a time, adding tests per extracted service. | pending |
| **6** | **Importer toolkit.** Extract the shared concerns both existing importers solved independently (NDJSON reading, dependency ordering, transaction chunking, reference-cycle closure, idempotent PUT, provenance tagging) into `backend/scripts/lib/`; make the Synthea pipeline and the MIMIC notebook thin consumers. | pending |

Live bugs B1–B7 are small; fold each into whichever slice touches its area,
or batch as a standalone fix PR.

---

## Preserved future development (deliberately NOT deleted)

Unreachable code that was adjudicated as *unfinished features worth
finishing* rather than abandoned. Kept in the tree and documented here so
the intent survives; wire these in rather than rebuilding:

| Feature | Files kept | Evidence of intent |
|---|---|---|
| **SMART app launcher UI** | `frontend/src/components/smart/` (`SMARTAppLauncher`, `AppCard`, `index`) | Backend SMART OAuth2/PKCE stack is live (`api/smart/`), `SMARTContext` is live, apps are seeded (`seed_smart_apps.py`). The launcher was wired into `ClinicalSidebar`, which was orphaned by a later layout change (Feb 2026). Finish = render `SMARTAppLauncher` from a live surface. |
| **Medication reconciliation** | `MedicationListManager.js`, `hooks/medication/useMedicationLists.js` (+ flat shim), `MedicationCRUDService.js`, `MedicationWorkflowService.js`, their tests | PR #264 explicitly adjudicated these canonical and repaired the analysis pipeline (`getMedicationReconciliation` → categorize → analyze) with regression tests. Finish = route `MedicationListManager` into a live surface (e.g. Pharmacy tab or a workspace dialog). |
| **CDS Hooks compliance test + model** | `services/__tests__/cdsHooksCompliance.test.js`, `models/cdsService.js` | The test validates the LIVE `cdsHooksService` against the CDS Hooks 2.0 spec; the model is its validation helper (and one of the 11 hook-type lists — F5/B4). |

Deleted-but-noteworthy (resurrect from git history at the pre-purge SHA if
the workflow gets built):

- **Result acknowledgment UI** — backend endpoints are live
  (`results_router.py` `/acknowledge`, Provenance-based) with zero frontend
  consumers; the old panel (`ResultAcknowledgmentPanel`,
  `resultsManagementService`) was a year stale and pattern-drifted.
- **CPOE order field components** (`components/clinical/orders/fields/`,
  Feb 2026) — a half-landed order-dialog revamp; live order dialogs exist.
- **Six standalone medication services** (search / discontinuation /
  effectiveness / reconciliation / status / validator) — no reachable
  consumers; the reconciliation concept lives on in
  `MedicationWorkflowService` (kept above).
- **Clinical scenario engine** (`api/services/data/scenario_engine.py`) —
  guided educational scenarios (diabetes management, hypertensive crisis,
  acute MI) is a genuinely good idea for this platform, but the deleted
  implementation was built on the pre-HAPI custom-table architecture
  (`from models.models import Patient…`) and cannot run against the current
  system. Rebuild on HAPI if the idea is picked up; don't resurrect.

Related hygiene noted during the purge, not yet fixed: UI Composer's backend
prompt templates (`claude_cli_service.py`, `claude_integration_service.py`,
`ui_composer_service.py`, `simplified_agents.py`) instruct generated code to
import the now-deleted `hooks/useFHIRResources` — harmless today because
generated code is display-only (`ComponentGenerator.createComponentFactory`
is a placeholder that never executes it), but the prompts should reference
the live data-access API when opportunity #2 lands. Several
`src/test/debug*.js` files are also *reachable from live code* and ship in
the bundle — untangle when their importers are next touched.

---

## Method / provenance

Produced 2026-07-26 by four parallel read-only survey agents over commit
`cec2d9d8`, cross-checked by an independent reachability analyzer
(`frontend/scripts/find-dead-code.mjs`). Dead-list validation: every file is
(a) unreachable in the static import graph from `src/index.js` (lazy chunk
imports followed), and (b) free of path-based references from live code —
each grep hit was individually adjudicated (all were substring collisions
with live files, e.g. `LabTrends` vs `LabTrendsChart`, or comments). Tests
that import dead modules are deleted with their modules.
