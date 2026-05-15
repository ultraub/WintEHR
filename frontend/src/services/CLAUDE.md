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
| Backend `/api/...` calls | `HttpClientFactory.createApiClient()` or `api.js` (`apiClient`) | axios instance, auth header injected |
| CDS Hooks calls | `cdsHooksClient.js` | Own axios client, base URL via `apiConfig` |

`HttpClientFactory.js` exposes static factories: `createApiClient`,
`createFhirClient`, `createEmrClient`, `createCdsClient`. All resolve their
base URL through `config/apiConfig` (`getBackendApiUrl`, `getCdsHooksUrl`) —
**never hardcode a host or pass a literal `baseURL`.** `api.js` is the older
plain axios singleton; new code should prefer `HttpClientFactory`.

---

## Facade vs. direct imports — known inconsistency

Two subdirectories provide *facade* modules that wrap a family of services:

- `services/cds/` — `cdsService` facade over `cdsHooksClient`,
  `cdsHooksService`, `cdsClinicalDataService`, `cdsActionExecutor`,
  `cdsFeedbackService`.
- `services/medication/` — `medicationService` facade over
  `MedicationCRUDService`, `MedicationWorkflowService`,
  `medicationAdministrationService`, `medicationDispenseService`, and others.

Each facade's `index.js` documents the intended pattern
(`import { cdsService } from '@/services/cds'`). **But adoption is thin** —
each facade currently has ~2 importers, while the underlying services are
imported directly ~10+ places (`cdsHooksService` especially). Both styles
work. When touching existing code, match what that file already does; do not
mass-migrate to the facade as a side effect of an unrelated change.

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

`cds/CDSService.js` is the facade tying these together.

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

`searchService.js` (cross-resource), `enhancedImagingSearch.js`,
`medicationSearchService.js`, and `resultsManagementService.js` are the other
search/results entry points.

---

## Start here

- `core/fhir/services/fhirClient` — not in this dir, but read it first; most
  services depend on it.
- `HttpClientFactory.js` — how non-FHIR HTTP clients are constructed.
- `cds/index.js` and `medication/index.js` — facade entry points + the
  full list of underlying services they wrap.
- `MedicationWorkflowService.js` — largest workflow service; the model for
  multi-step clinical orchestration on the frontend.
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
| Service call 404s in prod but works in dev | Hardcoded host or literal `baseURL` — route through `HttpClientFactory` / `apiConfig` |
| Order search returns unsorted or empty results | `enhancedOrderSearch.js` `searchParamMappings` — wrong/missing HAPI sort param for the resource |
| CDS cards never appear | Trace `cdsHooksClient.js` dispatch first; then the firing layer in `hooks/cds/` |
| WebSocket events stop after a drop | `websocket.js` reconnect/backoff logic; consumers should subscribe via `ClinicalWorkflowContext` |
| Two ways to call the same CDS/medication op | Facade (`services/cds`, `services/medication`) vs. direct import — both valid; match the file you're editing |
