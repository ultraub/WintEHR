# Frontend `src/` — implementation reference

The React source tree: clinical workspace components, contexts, the FHIR
client, hooks, and services.

**Inherits** root `CLAUDE.md` + `frontend/CLAUDE.md`. The parent owns the shared
frontend rules — canonical FHIR client, relative imports (no `@` alias), context
composition, URL resolution, clinical events, the tab registry. **Those are not
restated here.** This file carries only deeper implementation deltas.

---

## Layer map

| Layer | Lives in | Notes |
|---|---|---|
| Entry | `index.js`, `App.js` | `App.js` builds theme, mounts `AppProviders` + router |
| Pages / routes | `pages/`, `router/router.js` | clinical workspace lazy-loaded; see `pages/CLAUDE.md` |
| Components | `components/clinical/` | the bulk of the UI |
| Hooks | `hooks/`, `contexts/` | `hooks/cds/` and others have their own CLAUDE.md |
| Contexts | `contexts/` | state + cross-module events |
| Services | `services/`, `core/fhir/services/` | see `services/CLAUDE.md` |
| Core / utils | `core/`, `utils/`, `constants/`, `themes/` | `core/fhir/` is the FHIR layer |

Imports flow upward only (utils → services → contexts → hooks → components →
pages). No circular dependency between contexts and services has been observed.

---

## FHIR client API (`core/fhir/services/fhirClient.ts`)

Named export `fhirClient` is the singleton. Core CRUD: `read`, `search`,
`create`, `update`, `delete`. Plus ~21 resource-specific convenience methods —
`getPatient`, `getObservations`, `getConditions`, `getMedications`,
`getEncounters`, `getProcedures`, `searchCriticalLabValues`,
`getPatientBundleOptimized`, `getPatientTimelineOptimized`,
`warmCacheForPatient`, etc.

`search` accepts FHIR reference formats transparently: `Patient/123`,
`urn:uuid:...` (Synthea data), or a bare id. The client layers caching
(memory + session), request dedup, and retry — call it directly; do not
hand-roll an `axios` wrapper around `/fhir`.

There is a second contexts package at `contexts/fhir/`
(`FHIRCacheContext`, `FHIRDataContext`, `FHIROperationsContext`,
`PatientContext`) — a finer-grained decomposition. Most app code uses the
single `FHIRResourceContext` below; prefer it unless you are specifically
working inside `contexts/fhir/`.

---

## `useFHIRResource` (`contexts/FHIRResourceContext.js`)

The central patient-data context. Public surface includes: `currentPatient`,
`setCurrentPatient`, `getResource`, `getResourcesByType`, `getPatientResources`,
`searchResources`, `fetchPatientBundle`, `isResourceLoading`. Convenience hooks
`usePatient(id)` and `usePatientResources(id, type)` are exported from the same
file.

This is the largest file in the tree (~2000 lines) — it caches resources by
patient compartment and standardises search results. When debugging stale or
duplicated patient data, this is the first place to look.

---

## Patient-data loading pattern

The repo loads **critical data first, then enriches**. A patient selection:

1. `fhirClient.getPatient(id)` → `setCurrentPatient` immediately.
2. `fhirClient.warmCacheForPatient(id)` in the background.
3. Tabs read from `FHIRResourceContext` (cache-warmed) rather than each
   issuing cold fetches.

Hooks that encode this: `hooks/useProgressiveLoading.js`,
`hooks/useOptimizedPatientData.js`, `hooks/useChartReviewResources.js`. Reuse
these for new patient-scoped surfaces instead of writing a fresh fetch loop.

Every `fhirClient` call in a component must handle loading / error / empty /
success — silent `catch` blocks are a review failure.

---

## Workspace structure

`components/clinical/ClinicalWorkspaceWrapper.js` (~98 lines) — auth + layout,
delegates to `EnhancedClinicalLayout` and `ClinicalWorkspaceEnhanced.js`
(~363 lines). Tabs live in `components/clinical/workspace/tabs/`, registered via
`clinicalTabRegistry.js` (parent doc). Clinical dialogs are in
`components/clinical/workspace/dialogs/` — many ship in a plain + `*Enhanced`
pair (`MedicationDialog.js` / `MedicationDialogEnhanced.js`); the `Enhanced`
variant is the current one.

Resource dialogs extend `components/base/BaseResourceDialog.js` (or
`EnhancedBaseResourceDialog.js`) — follow that base, do not build a bare MUI
`<Dialog>`.

---

## Out of scope / corrections to prior doc

- **No `@` webpack alias.** Prior doc told you to "always use `@` imports" — that
  is wrong; the alias is editor-only. Use relative imports. (See parent doc.)
- **`services/fhirService.js` and `services/fhirClient.js` are deleted.** Prior
  doc marked `services/fhirClient.js` as "DEPRECATED – use core/..." — it is not
  deprecated, it is **gone**, and importing it fails the build. Canonical client
  is `core/fhir/services/fhirClient.ts`.
- **Context names.** Prior doc referenced `CDSContext` / `CDSProvider`. The
  actual context is `CDSHooksContext.js` / `CDSHooksProvider` with hooks
  `useCDS` / `usePatientCDSAlerts`.
- Specific line-count / bundle-size / cache-hit-rate / provider-nesting
  percentage figures from the prior doc were unverifiable or stale (e.g.
  `FHIRResourceContext` is ~2000 lines, not 1,773; `fhirClient` ~1815, not
  1,542; `ClinicalWorkspaceEnhanced` ~363, not 1,245) and have been removed
  rather than re-measured — file sizes drift; do not reintroduce hard numbers.
- Generic React / MUI / accessibility / virtualization / testing-library
  scaffolding is assumed known and is not documented here.

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| `Cannot find module .../services/fhirClient` | Stale import of deleted client — repoint to `core/fhir/services/fhirClient` |
| Stale / duplicated patient resources | `FHIRResourceContext.js` compartment cache; check `fetchPatientBundle` invalidation |
| Patient data never loads on selection | Progressive-loading hook (`useProgressiveLoading` / `useOptimizedPatientData`) not wired, or `setCurrentPatient` not called |
| Dialog behaves oddly | Confirm it extends `BaseResourceDialog`, and you are using the `*Enhanced` variant |
| CDS cards missing | Wrong CDS pattern — see `hooks/cds/CLAUDE.md` |
| Event published but no subscriber fires | Event key typo — verify against `constants/clinicalEvents.js` |
