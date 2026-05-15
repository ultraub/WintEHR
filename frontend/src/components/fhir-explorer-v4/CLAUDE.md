# FHIR Explorer v4 — module reference

Interactive FHIR R4 browser: build queries, browse the resource catalog, map
relationships, inspect schemas, and visualize patient data. Reached at the
`/fhir-explorer` route (and `/fhir-explorer/query-studio-enhanced` standalone).

**Inherits** root + `frontend/CLAUDE.md` + `frontend/src/CLAUDE.md` patterns
(`fhirClient` is the FHIR client, contexts for shared state, relative imports,
handle loading/error/empty, env-agnostic URLs). Only module-specific deltas are
below.

---

## Start here

- `core/FHIRExplorerApp.jsx` — the app shell. Owns `currentMode` / `currentView`
  state, runs initial-data load, and routes each mode to a feature component.
  This is the entry the router renders.
- `core/UnifiedLayout.jsx` — navigation chrome (mode/view switcher).
- `core/DashboardHome.jsx` — landing view.
- `constants/appConstants.js` — `APP_MODES` and the per-mode view enums. This is
  the contract `FHIRExplorerApp` switches on.

---

## Mode / view structure

The app is organized as four modes, each with its own views — defined in
`constants/appConstants.js`, not derivable from anything else:

| `APP_MODES` | Views (`*_VIEWS`) | Feature components |
|---|---|---|
| `DASHBOARD` | — | `core/DashboardHome.jsx` |
| `DISCOVERY` | `CATALOG`, `SCHEMA`, `RELATIONSHIPS` | `discovery/ResourceCatalog`, `SchemaExplorer`, `RelationshipMapper` |
| `QUERY_BUILDING` | `STUDIO`, `NATURAL_LANGUAGE`, `WORKSPACE` | `query-building/QueryStudioEnhanced`, `NaturalLanguageInterface`, `workspace/QueryWorkspace` |
| `VISUALIZATION` | `CHARTS`, `TIMELINE`, `NETWORK` | `visualization/DataCharts`, `PatientTimeline`, `NetworkDiagram` |

Adding a feature means: add the view to the right `*_VIEWS` enum, then wire it
into `FHIRExplorerApp`'s render switch. Nothing is auto-discovered.

---

## Live components vs. orphaned code

`FHIRExplorerApp` is the only consumer. Verify a component is actually mounted
before editing it — several files in `query-building/` are **orphaned** (not
imported anywhere in `src`):

- **Live query interface**: `query-building/QueryStudioEnhanced.jsx`. Used by
  `FHIRExplorerApp` (the `STUDIO` view) and by the standalone route
  `/fhir-explorer/query-studio-enhanced`.
- **Orphaned** — imported nowhere, do not extend: `query-building/QueryStudio.jsx`,
  `query-building/VisualQueryBuilder.jsx`, `query-building/QueryPlayground.jsx`.
  They are earlier iterations superseded by `QueryStudioEnhanced`.

---

## How queries actually execute (two paths)

There are two distinct FHIR-fetch paths in this module — know which one a
component is on:

1. **`fhirClient.search()` directly** — `QueryStudioEnhanced.jsx` and the
   orphaned `QueryStudio.jsx` import the `fhirClient` singleton (named export)
   from `core/fhir/services/fhirClient` and call `.search(resourceType,
   params)`. This is the live path.
2. **`useFHIRData` → context** — `hooks/useFHIRData.js` wraps `FHIRResourceContext`
   and exposes `searchResources`; the orphaned `VisualQueryBuilder.jsx` /
   `QueryPlayground.jsx` and `NaturalLanguageInterface.jsx` use it.

`FHIRExplorerApp` itself loads initial data through `useFHIRResource()`
(`FHIRResourceContext`), not `fhirClient`. **No component here fetches FHIR with
raw `fetch` against a hardcoded `http://localhost:8888/fhir` URL** — the prior
doc's `executeFHIRQuery` example was wrong. Hardcoding the HAPI URL breaks every
non-localhost deployment; always go through `fhirClient` or the context.

---

## Directory structure (verified)

```
fhir-explorer-v4/
├── core/          FHIRExplorerApp · UnifiedLayout · DashboardHome
├── discovery/     ResourceCatalog · ResourceDetailsPanel · SchemaExplorer
│                  RelationshipMapper (+ FilterPanel, ErrorBoundary)
├── query-building/  QueryStudioEnhanced (live) · NaturalLanguageInterface
│                    QueryStudio · VisualQueryBuilder · QueryPlayground (orphaned)
│                    components/  ChainedParameterBuilder · CompositeParameterBuilder
│                                 ModifierSelector · QuerySuggestions
│                                 QueryTemplates · QueryValidator
│                    utils/naturalLanguageProcessor.js
│                    __tests__/QueryStudioEnhanced.test.js
├── visualization/   DataCharts · PatientTimeline · NetworkDiagram
│                    components/  ChartTypeSelector · NetworkControls
│                                 TimelineControls · VitalSignsChart
│                    utils/  forceNetwork.js · timelineExport.js
├── hooks/         useFHIRData · useFHIRExplorerTheme · useQueryHistory
│                  useUserPreferences
├── workspace/     QueryWorkspace.jsx
├── components/    ErrorBoundary.jsx
└── constants/     appConstants.js · fhirResources.js
```

Names the prior doc claimed that **do not exist**: `hooks/useFHIRQuery.js`,
`useResourceSearch.js`, `useQueryBuilder.js` (actual hooks are the four above);
`constants/fhirResourceTypes.js`, `searchParameters.js`, `queryTemplates.js`
(actual: `appConstants.js`, `fhirResources.js`); `workspace/WorkspaceManager.jsx`
(actual: `QueryWorkspace.jsx`); `components/ResourceCard.jsx` (actual:
`ErrorBoundary.jsx`). There are no `README.md` files in the subdirectories.

---

## Conventions

- Components are `.jsx`; hooks/utils/constants are `.js`.
- `useQueryHistory` persists recent queries (used by `FHIRExplorerApp`);
  `useUserPreferences` persists UI prefs. Both are local-storage backed.
- `RelationshipMapper` uses a force-directed graph (`visualization/utils/
  forceNetwork.js`) and is wrapped in `RelationshipMapperErrorBoundary` because
  graph rendering can throw on malformed reference data.

## Out of scope here

- The FHIR client itself, caching, retry → `core/fhir/services/fhirClient`.
- FHIR storage / HAPI → root `CLAUDE.md` (HAPI owns FHIR storage).
- The dead `pages/FHIRExplorerEnhanced.js` — unrelated older page, not this
  module; see `pages/CLAUDE.md`.

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Edited a query builder, nothing changed | Likely edited an orphaned file — live one is `QueryStudioEnhanced.jsx`. |
| New view not appearing | View not added to its `*_VIEWS` enum or not wired into `FHIRExplorerApp`'s switch. |
| Query returns nothing | Check which path the component is on — `fhirClient.search` vs `useFHIRData.searchResources`. |
| Relationship graph crashes | `RelationshipMapper` malformed-reference handling; error caught by `RelationshipMapperErrorBoundary`. |
| Explorer loads no initial data | `FHIRExplorerApp` `loadInitialData` effect — depends on `FHIRResourceContext` being mounted (route wraps it in `AppProviders`). |
