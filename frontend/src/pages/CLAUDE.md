# Pages — module reference

Top-level route components for WintEHR. Each file here is the element behind a
route in `src/router/router.js`. Pages are thin: they own routing params, page
layout, and data fetching, then delegate to clinical components and contexts.

**Inherits** root + `frontend/CLAUDE.md` + `frontend/src/CLAUDE.md` patterns
(`fhirClient` is the FHIR client, contexts for shared state, relative imports,
handle loading/error/empty, env-agnostic URLs, sharp-corner clinical UI).
Only page-layer deltas are below.

---

## Routing is the source of truth — `src/router/router.js`

A file in `pages/` is "live" only if `router.js` imports it. **Several pages in
this directory are not the live implementation** — verify against `router.js`
before editing, or you will fix a screen nobody sees.

- `FHIRExplorerEnhanced.js` (~2,600 lines) is **dead code** — imported nowhere.
  The live FHIR Explorer route (`/fhir-explorer`) renders
  `components/fhir-explorer-v4/core/FHIRExplorerApp` (see that module's
  `CLAUDE.md`). Do not extend `FHIRExplorerEnhanced.js`; it is a candidate for
  deletion.
- There is **no** `CDSHooksStudio.js`, `CDSHooksPage.js`, `PharmacyDashboard.js`,
  `ClinicalWorkspace.js`, or `PatientSearch.js` here. The prior doc invented
  them. CDS Studio lives at `src/modules/cds-studio` (`CDSStudioPage`); the
  patient list page is `PatientList.js`.

### Layout wrapping (a route-level decision)

Most authenticated pages are wrapped by `LayoutV3` (app chrome) inside
`ProtectedRoute`. Three routes deliberately skip `LayoutV3` because they own
their full-viewport shell: `/patients/:id/clinical` (`ClinicalWorkspaceWrapper`),
`/fhir-explorer` (wrapped in its own `AppProviders`), and `/ui-composer`.
`/smart-demo` is unauthenticated (no `ProtectedRoute`). When adding a route,
decide layout wrapping at `router.js` — pages do not render `LayoutV3`
themselves.

---

## Page → route → what it renders

| Route | Page file | Notes |
|---|---|---|
| `/login` | `Login.js` | Unauthenticated. Provider dropdown from `GET /api/auth/config`. |
| `/patients` | `PatientList.js` | Patient search/list. |
| `/patients/:id` | `PatientDashboardV2Page.js` | Thin — renders `PatientSummaryV4`. Decodes id via `decodeFhirId`. |
| `/patients/:id/clinical` | (`ClinicalWorkspaceWrapper`, not in `pages/`) | The clinical workspace. |
| `/patients/:id/timeline` | `PatientTimelinePage.js` | Thin wrapper over `FHIRResourceTimeline`. |
| `/patients/:id/medication-reconciliation` | `MedicationReconciliationPage.js` | Thin wrapper over `MedicationReconciliation`. |
| `/dashboard` | `Dashboard.js` | Clinical dashboard. `/clinical` redirects here. |
| `/encounters` | `EncountersPage.js` | |
| `/pharmacy` | `PharmacyPage.js` | Standalone pharmacy queue (kanban). |
| `/inventory` | `InventoryManagementPage.js` | Medication inventory. |
| `/analytics` | `Analytics.js` | Charts via `recharts`. |
| `/quality` | `QualityMeasuresPage.js` | |
| `/care-gaps` | `CareGapsPage.js` | |
| `/schedule` | `Schedule.js` | |
| `/audit-trail` | `AuditTrailPage.js` | Event-trail viewer (synthetic data — not HIPAA auditing). |
| `/settings` | `Settings.js` | |
| `/performance-test` | `PerformanceTestPage.js` | Dev/diagnostic page. |
| `/smart-callback` | `SMARTCallbackPage.js` | SMART-on-FHIR OAuth2 redirect target. |
| `/smart-demo` | `SMARTDemoApp.js` | Built-in SMART app demo. Unauthenticated. |
| `*` | `NotFound.js` | |

Routes whose element is **not** in `pages/`: `/cds-studio` (`modules/cds-studio`),
`/fhir-explorer` (`components/fhir-explorer-v4`),
`/fhir-explorer/query-studio-enhanced` (`fhir-explorer-v4` `QueryStudioEnhanced`),
`/ui-composer` (`modules/ui-composer`), `/cds-presentation-test`.

---

## Two data-access paths — pick by data kind

Pages reach the backend two ways, and the choice is not arbitrary:

- **FHIR resources** → the `fhirClient` singleton (named export) from
  `core/fhir/services/fhirClient`, or the `FHIRResourceContext` hooks. Imported
  relatively (`../core/fhir/services/fhirClient`). Used by `PatientList`,
  `EncountersPage`,
  `PharmacyPage`, `Schedule`. This is the canonical path for any FHIR data.
- **Non-FHIR backend APIs** (analytics, audit, quality, auth config, SMART
  token) → the axios instance `src/services/api.js` (`import api from
  '../services/api'`). It attaches the auth token and uses a relative base URL.
  Used by `Analytics`, `AuditTrailPage`, `Settings`, `Login`.

Do not hit FHIR through `services/api.js` raw `fetch`, and do not invent a third
client. Raw `fetch` exists in a few pages (`PharmacyPage`, `QualityMeasuresPage`,
the SMART pages) for non-FHIR backend calls — keep new FHIR access on
`fhirClient`.

Backend endpoints these pages call resolve under `/api/...` and `/fhir/...` —
prefixes are inconsistent backend-side, so confirm the resolved path against
`backend/api/routers/__init__.py` before wiring a new call.

---

## Patient-id handling

Routes carry the patient id as a URL param that is **URL-encoded**. Pages that
take `:id` decode it with `decodeFhirId` from `core/navigation/navigationUtils`
and lower-case it for consistency (see `PatientDashboardV2Page.js`,
`PatientTimelinePage.js`). Do not pass the raw `useParams()` id straight into a
FHIR query.

---

## Out of scope here

- FHIR Explorer internals → `components/fhir-explorer-v4/CLAUDE.md`.
- CDS Studio → `src/modules/cds-studio`.
- Clinical workspace tabs/dialogs → `components/clinical/`.
- Reusable clinical UI → `components/clinical/shared/`.
- Generic React routing / MUI layout — the model knows these; not documented.

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Edited a FHIR Explorer screen, nothing changed | You edited `FHIRExplorerEnhanced.js` (dead). Live code is `components/fhir-explorer-v4/`. |
| New page renders without app chrome | Route in `router.js` missing the `LayoutV3` wrapper. |
| Page reachable without login | Route missing `ProtectedRoute` wrapper in `router.js`. |
| FHIR call from a page 404s | Backend prefix mismatch — re-derive from `backend/api/routers/__init__.py`. |
| Patient query returns nothing for a valid id | Raw `useParams()` id used un-decoded — run it through `decodeFhirId`. |
| Auth token not attached to a request | Used raw `fetch` instead of the `services/api.js` axios instance. |
