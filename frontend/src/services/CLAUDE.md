# Frontend Services — module reference

The non-FHIR-client business-logic layer that sits between React components
and the backend: CDS Hooks HTTP plumbing, medication workflows, clinical
catalogs, search, documentation, provider resolution, and the WebSocket
client.

**Inherits** root + `frontend/CLAUDE.md` + `frontend/src/CLAUDE.md` patterns
(fhirClient is the FHIR client, contexts for shared state, `@/` imports,
URLs via `apiConfig`, handle all UI states, educational / no-PHI). Only
module-specific deltas are below.

---

## The single most important fact

**`services/fhirService.js` no longer exists.** Earlier docs presented it as
"the primary interface for FHIR operations" with `fhirService.getPatient(...)`
examples. It is deleted. There is also **no `fhirClient.js` in this directory**.

The canonical FHIR client is:

```js
import fhirClient from '@/core/fhir/services/fhirClient';
const patient = await fhirClient.read('Patient', id);
```

Services in *this* directory are for **business logic that is not raw FHIR
CRUD** — workflows, validation, search orchestration, catalog extraction.
A service that just needs a resource imports `fhirClient` like everyone else.

---

## How HTTP actually leaves this layer

Three escape hatches — pick the one that already fits, do not invent a fourth.

| Need | Use | Notes |
|---|---|---|
| Raw FHIR CRUD/search | `@/core/fhir/services/fhirClient` | Not in this dir; caching + batching live there |
| Backend `/api/...` calls | `api.js` (`apiClient`) | axios singleton, auth header injected |
| CDS Hooks calls | `cdsHooksClient.js` | Own axios client, base URL via `apiConfig` |

All base URLs resolve through `config/apiConfig` (`getBackendApiUrl`,
`getCdsHooksUrl`) — **never hardcode a host or pass a literal `baseURL`.**
(`HttpClientFactory.js`, a factory layer nothing ever imported, was deleted
in the dead-code purge — see `docs/ARCHITECTURE_DEBT.md`. Transport
consolidation is opportunity #2 there; don't hand-roll new axios clients.)

## Caching rules

- **Raw FHIR responses are cached by `fhirClient` ONLY** (LRU + per-type
  TTLs + request dedup). Never put a cache in front of it — and NEVER a
  module-level `Map` of FHIR data: those never evict, so the UI shows
  stale clinical data forever (the `useMedicationResolver` /
  `DiagnosisPicker` bugs, fixed in the opportunity-#2 cache collapse).
- Services on the `api.js` transport MAY keep a short-TTL cache — it is
  the only caching layer for backend endpoints (e.g. the 10-minute catalog
  cache in `cdsClinicalDataService`).
- Component-lifetime memoization (`useRef`/`useState` maps that die on
  unmount) and derived-value memoization (e.g. `dashboardDataService`'s
  computed aggregates) are fine — bounded staleness, different concern.

---

## Import services directly — the facades are gone

`services/cds/` and `services/medication/` used to hold facade modules
wrapping the service families. Both were circular barrels with **zero live
importers** and were deleted in the dead-code purge. Import the underlying
service directly (`cdsHooksService`, `medicationListManagementService`, …);
do not recreate a facade layer.

### Medication services — the adjudicated layering

The **live standalone services are canonical**:
`medicationListManagementService`, `prescriptionRefillService`,
`medicationDispenseService`, `medicationAdministrationService`. The UI uses
them directly (e.g. PharmacyTab →
`medicationListManagementService.handlePrescriptionStatusUpdate`).

Six further standalone services (`medicationSearchService`,
`medicationDiscontinuationService`, `medicationEffectivenessService`,
`medicationReconciliationService`, `prescriptionStatusService`,
`medicationWorkflowValidator`) had no reachable consumers and were deleted
in the dead-code purge — resurrect from git history if their workflow gets
built out, but check `docs/ARCHITECTURE_DEBT.md` first.

`MedicationCRUDService` and `MedicationWorkflowService` began as a
consolidation of those services but were never finished or adopted; the
unfinished paths (discontinuation, effectiveness monitoring, refills, status
tracking, list synchronization) were **removed** — they called methods that
were never written, behind a feature flag that defaulted off, with zero
callers. What remains is their real, deliberately narrow surface:

| File | Kept surface | Real consumers |
|---|---|---|
| `MedicationCRUDService.js` | local catalog (search/dosing/interaction/allergy) + patient medication-List management | `MedicationListManager`, `useMedicationLists` |
| `MedicationWorkflowService.js` | reconciliation analysis: `getMedicationReconciliation` → `categorizeMedicationsBySource` → `analyzeReconciliationNeeds` | same two |

These two files, `MedicationListManager`, and `useMedicationLists` are the
**medication-reconciliation feature** — adjudicated worth finishing (#264)
but not yet routed into any live surface. They are deliberately preserved
future development (see `docs/ARCHITECTURE_DEBT.md`); wire them in rather
than rebuilding. Do not re-grow the two services toward general medication
workflows — extend the live standalone services instead.

---

## CDS service files in this directory (don't confuse them)

The React-side CDS *firing/state* plumbing (`useCDSHooks`, `CDSHooksContext`)
is documented in `frontend/src/hooks/cds/CLAUDE.md` — read that for which
pattern to use. The files *here* are the lower layers those hooks call:

| File | Role |
|---|---|
| `cdsHooksClient.js` | HTTP client — discovery + parallel service dispatch (`Promise.allSettled`, PR #113) |
| `cdsHooksService.js` | Higher-level CDS Hooks orchestration (largest CDS file) |
| `cdsClinicalDataService.js` | Pulls lab / vital / condition catalogs from patient data |
| `cdsActionExecutor.js` | Executes CDS card `suggestions` / `actions` |
| `cdsDisplayBehaviorService.js` | Decorates cards with `displayBehavior` |
| `cdsFeedbackService.js` / `cdsAlertPersistenceService.js` | Feedback + alert dismissal persistence |

---

## Search services and HAPI parameter mapping

HAPI FHIR uses resource-specific search parameter names. `enhancedOrderSearch.js`
holds an explicit mapping table (`searchParamMappings`) because the sort
parameter differs per resource:

- `ServiceRequest` → `authored`
- `MedicationRequest` → `authoredon`

Callers pass a generic `-authored` sort; the service maps it to the
resource-specific HAPI field. If you add order search for another resource
type, extend that table — don't assume one sort name works everywhere.

`searchService.js` (cross-resource) is the other search entry point.

---

## Start here

- `core/fhir/services/fhirClient` — not in this dir, but read it first; most
  services depend on it.
- `api.js` — the axios singleton for backend `/api/...` calls.
- `MedicationWorkflowService.js` — the medication-reconciliation analysis
  pipeline (see the medication layering table above).
- `websocket.js` — `websocketService` singleton; `getWebSocketConnection()`.
  Auto-reconnect lives here; consumers usually go through
  `ClinicalWorkflowContext` rather than importing this directly.

---

## Out of scope here

- Raw FHIR CRUD/search → `core/fhir/services/fhirClient`.
- CDS firing patterns / card state (`useCDSHooks`, `CDSHooksContext`) →
  `frontend/src/hooks/cds/CLAUDE.md`.
- Shared React state → contexts (`FHIRResourceContext`,
  `ClinicalWorkflowContext`); see `frontend/src/CLAUDE.md`.
- Backend clinical-workflow endpoints these services call →
  `backend/api/clinical/CLAUDE.md` (resolved route prefixes are listed there).
- UI components → `components/clinical/`.

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| `fhirService is not defined` / import resolves to nothing | Module is deleted — switch to `@/core/fhir/services/fhirClient` |
| Service call 404s in prod but works in dev | Hardcoded host or literal `baseURL` — route through `apiConfig` |
| Order search returns unsorted or empty results | `enhancedOrderSearch.js` `searchParamMappings` — wrong/missing HAPI sort param for the resource |
| CDS cards never appear | Trace `cdsHooksClient.js` dispatch first; then the firing layer in `hooks/cds/` |
| WebSocket events stop after a drop | `websocket.js` reconnect/backoff logic; consumers should subscribe via `ClinicalWorkflowContext` |
| Two ways to call the same CDS/medication op | Facade (`services/cds`, `services/medication`) vs. direct import — both valid; match the file you're editing |
