# WintEHR Frontend — module reference

React 18 + MUI 5 clinical workspace. Talks to the FastAPI backend and (for
FHIR reads/writes) to HAPI FHIR through the backend proxy.

**Inherits** root `CLAUDE.md` (HAPI FHIR is the FHIR store, backend is a proxy,
env-driven URLs, educational / no-PHI). Those rules are not restated here. This
file owns the **shared frontend rules**; `src/CLAUDE.md` carries only deeper
deltas and links up.

---

## Start here

- `src/App.js` — root: builds the MUI theme, wraps `<AppProviders>` then
  `<RouterProvider>`. Exports `MedicalThemeContext`.
- `src/providers/AppProviders.js` — context composition (see below).
- `src/router/router.js` — route table; clinical workspace is lazy-loaded.
- `src/core/fhir/services/fhirClient.ts` — the canonical FHIR client.
- `src/config/apiConfig.js` — every backend URL resolves here.

---

## The canonical FHIR client — and the deleted one

**Use `src/core/fhir/services/fhirClient.ts`.** It is a TypeScript singleton
with caching, request dedup, batching, and retry.

```javascript
// fhirClient is a NAMED export (the singleton). Not default.
import { fhirClient } from '<relative-path>/core/fhir/services/fhirClient';

const patient = await fhirClient.read('Patient', patientId);
const result  = await fhirClient.search('Condition', {
  patient: `Patient/${patientId}`, 'clinical-status': 'active', _sort: '-recorded-date',
});
```

> `src/services/fhirService.js` **and** `src/services/fhirClient.js` are both
> **deleted**. Never import either — the stale imports that once pointed at
> them have all been repointed to `core/fhir/services/fhirClient`. Do not copy
> the dead path into new code.

---

## Imports are RELATIVE, not aliased

`craco.config.js` defines **no `@` webpack alias**. The `@/*` entries in
`tsconfig.json` are editor-only (IntelliSense); they do **not** resolve at build
or test time. Real code uses relative paths
(`../../../../core/fhir/services/fhirClient`) — ~116 files do. Only ~15 stray
files use `@/` and they rely on the path happening to also work; do not add
more. Match the relative-import style of the file you are editing.

(If you want a real alias, that is a `craco.config.js` + jest `moduleNameMapper`
change — not a doc fix. Until then: relative imports.)

---

## Context composition (`providers/AppProviders.js`)

Providers are grouped into compound providers via `createCompoundProvider` to
cut re-render cascades. Nesting order, outermost first:

`CoreDataProvider` (Auth, FHIRResource, ProviderDirectory, SMART) →
`WorkflowProvider` → `ClinicalDomainProvider` (Clinical, **CDSHooks**,
Documentation, Order, Task) → `CommunicationProvider` (Inbox, Appointment) →
`ClinicalWorkflowProvider`.

| Context (file in `src/contexts/`) | Hook | Purpose |
|---|---|---|
| `FHIRResourceContext.js` | `useFHIRResource` | Central FHIR data cache; `currentPatient`, `getPatientResources`, `fetchPatientBundle` |
| `ClinicalWorkflowContext.js` | `useClinicalWorkflow` | Event pub/sub (`publish`/`subscribe`) + WebSocket bridge |
| `CDSHooksContext.js` | `useCDS`, `usePatientCDSAlerts` | CDS Hooks 2.0 cards — see `src/hooks/cds/CLAUDE.md` |
| `AuthContext.js` | `useAuth` | Auth / session |
| `OrderContext.js` | `useOrders` | CPOE order state |

There is **no `CDSContext.js`** and no `CDSProvider` — the CDS context is
`CDSHooksContext.js` / `CDSHooksProvider`. Two CDS-card patterns exist; the
rules live in `src/hooks/cds/CLAUDE.md`, do not reinvent a third.

---

## URL resolution — never hardcode a host

All backend/FHIR/WS URLs resolve through `src/config/apiConfig.js`. Default
config uses **empty/relative** URLs so the CRA dev proxy (`setupProxy.js`) and
nginx route requests — a baked-in `localhost` breaks every non-localhost build
(`REACT_APP_*` is frozen at build time). See root `CLAUDE.md` for the why.

Exported helpers (note the exact names):
`getBackendUrl`, `getBackendApiUrl`, `getFhirUrl`, `getCdsHooksUrl`,
`getCdsHooksServicesUrl`, `getWebSocketUrl`, `getEmrUrl`, `buildUrl`.
There is **no `getApiUrl`** — use `getBackendApiUrl`. A bare relative
`fetch('/api/...')` is also fine; the proxy handles it.

---

## Clinical events

`CLINICAL_EVENTS` is exported from **`src/constants/clinicalEvents.js`** (and
re-exported by `ClinicalWorkflowContext.js`). It is a large catalog (~70 event
keys grouped by domain: patient, condition, medication, order, encounter,
results, etc.) — read the file, do not assume a short list. Publish/subscribe
via `useClinicalWorkflow()`; the context bridges events onto the WebSocket
(`src/services/websocket.js`, default export `websocketService`).

---

## Workspace tabs — one registry

Adding a clinical-workspace tab means appending **one entry** to
`src/components/clinical/workspace/clinicalTabRegistry.js` — the single source
of truth (#150). Before it, five hardcoded lists had to agree and silently
drifted. Tab components are `React.lazy()`-loaded from the registry. Do not
re-add a parallel tab list anywhere.

---

## Conventions for new clinical components

- Handle **all four states**: loading, error, empty, success. A `fhirClient`
  call with no loading indicator or `catch` is a review failure.
- Get data via contexts (`useFHIRResource`) or `fhirClient` directly — not via
  raw `axios`/`fetch` to `/fhir/...`.
- Clinical UI uses **sharp corners** (`borderRadius` 0–4) and the severity
  palette from `src/themes/clinicalThemeUtils.js` — that file is the token
  source of truth.
- Generic React/MUI/hooks patterns are assumed known — not documented here.

---

## Commands

```bash
./deploy.sh dev                    # full stack via Docker; frontend :3000
cd frontend && npm start           # direct dev (needs backend running)
npm test -- --watchAll=false       # CI test run
npm run lint                       # ESLint
npm run build                      # production build (CRACO)
```

Demo logins: `demo/password` (clinician), `nurse/password`, `pharmacist/password`,
`admin/password`.

Tests: `src/test-utils/test-utils.js` exports a custom `render` (re-exported as
`render`) plus `generateMockPatient` / `generateMockCondition` /
`generateMockMedicationRequest`. There is **no `TestProviders` export** — use
the custom `render`.

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Build/compile error `Cannot find module .../services/fhirClient` | Stale import of the deleted client — repoint to `core/fhir/services/fhirClient` |
| `useFHIRResource must be used within a FHIRResourceProvider` | Component rendered outside `<AppProviders>` |
| `@/...` import unresolved | No webpack `@` alias — use a relative path |
| FHIR call 404s | Backend prefix mismatch — see `backend/api/CLAUDE.md` resolved-path table |
| New tab missing from the strip | Not added to `clinicalTabRegistry.js` |
| App reads `localhost` on a deployed host | A URL bypassed `apiConfig` or a `REACT_APP_*` localhost fallback got baked in |

---

## Out of scope here

- FHIR storage / backend proxy / async / env-URL rationale → root `CLAUDE.md`.
- Detailed FHIR-client API, data-loading patterns → `src/CLAUDE.md`.
- CDS card patterns → `src/hooks/cds/CLAUDE.md`.
- MAR grid → `src/components/clinical/workspace/AdministrationRecord/CLAUDE.md`.
- Services layer → `src/services/CLAUDE.md`; pages → `src/pages/CLAUDE.md`.
