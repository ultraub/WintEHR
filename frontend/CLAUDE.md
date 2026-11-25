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

`vite.config.js` defines **no `@` resolve alias**. The `@/*` entries in
`tsconfig.json` are editor-only (IntelliSense); they do **not** resolve at build
or test time. Real code uses relative paths
(`../../../../core/fhir/services/fhirClient`) — ~116 files do. Only ~15 stray
files use `@/` and they rely on the path happening to also work; do not add
more. Match the relative-import style of the file you are editing.

(If you want a real alias, that is a `vite.config.js` `resolve.alias` change —
not a doc fix. Until then: relative imports.)

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
config uses **empty/relative** URLs so the Vite dev proxy (`server.proxy` in
`vite.config.js`) and nginx route requests — a baked-in `localhost` breaks every
non-localhost build (`REACT_APP_*` is frozen at build time). See root
`CLAUDE.md` for the why.

Source code reads these as **`import.meta.env.REACT_APP_*`** (not
`process.env.*`). The names are unchanged — Docker still passes
`ARG REACT_APP_* → ENV REACT_APP_*` and `envPrefix: 'REACT_APP_'` bakes them in.
`process.env.NODE_ENV` still works everywhere via a Vite `define`.

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

**Live updates from other sessions.** The server broadcasts every FHIR write
as `resource.created` / `resource.updated` / `resource.deleted`
(`{ patientId, resourceType, resourceId, resource }`; a delete carries a
`{resourceType, id}` stub). The bridge applies each one to
`FHIRResourceContext` (`applyRemoteChange`) before forwarding it, so views
that read from the store update in place with no refetch. A view holding its
own fetched list listens for `RESOURCE_EVENTS` and filters with
`isRelevantEvent` (`src/utils/resourceEvents.js`). `subscribeToPatient` /
`subscribeToRoom` may be called before the socket is open — do not guard
them with `websocketService.isConnected`.

---

## Workspace tabs — one registry

Adding a clinical-workspace tab means appending **one entry** to
`src/components/clinical/workspace/clinicalTabRegistry.js` — the single source
of truth (#150). Before it, five hardcoded lists had to agree and silently
drifted. Tab components are `React.lazy()`-loaded from the registry. Do not
re-add a parallel tab list anywhere.

The registry is what EXISTS; what a user SEES is `useEffectiveTabs()`
(`workspace/useEffectiveTabs.js`), which applies the Command Center tab
policy (organization / role / context layers, `ui.tabs.policy`). Anything
that renders or navigates the strip — `ClinicalTabs`, `useKeyboardNavigation`,
`KeyboardShortcutsDialog`, the workspace's hidden-tab fallback — uses the
hook, never `CLINICAL_TABS` directly. Summary can never be hidden. The
policy's third layer, the workflow context, is chosen by the user in the
tab strip (`workspace/WorkflowContextPicker.jsx`, shown only when the
policy defines contexts) and kept in `tabPolicyStore` (localStorage); both
hooks apply it unless the caller passes `{ context }` explicitly.

One level down, `workspace/sectionRegistry.js` lists the panels INSIDE tabs
(Chart Review's eight panels and the sub-tabs of Results, Pharmacy and Care
Plan are builtin sections; Imaging studies and the Flowsheet module are
`hostable`), `useEffectiveSections(tabId)` applies the policy's per-tab
`sections` layer, and `HostedSectionPanel` renders a section placed on a
foreign tab (lazy, own data by `patientId`, heavy ones start collapsed).
Chart Review stacks `chartSections` as panels; the strip tabs drive their
`<Tabs>` from `useSectionStrip(tabId, defaultId)` (hidden sub-tabs leave,
policy order holds, a hosted section becomes a sub-tab whose body is
`HostedSectionBody`) and keep an index into their `*_VIEWS` list for the
existing per-view logic. The remaining tabs (Orders, Documentation,
Encounters, Timeline, Imaging, Summary) have no sections yet.

Pluggable modules (`src/modules/` — see `docs/MODULES.md`) contribute tabs
through their manifests (placed via `insertAfter`, else appended) and
top-level **pages**: one `pages` entry yields the route in
`router/router.js` AND the app-shell menu item
(`components/navigationRegistry.js` — LayoutV3's old hardcoded
`navigationConfig` is now the derived output of core seed + module
contributions). Disable per build with `REACT_APP_DISABLED_MODULES`
(keys match the backend's `WINTEHR_DISABLED_MODULES`); disabling removes
tabs, routes, and nav items together.

The shell's **primary navigation** has the same split: `navigationRegistry`
is what exists (every item has a stable `id`; module pages use their page
id), `useEffectiveNavigation()` (`components/useEffectiveNavigation.js`) is
what this user sees after the Command Center's policy (`nav.hidden` per
organization / role / context layer in `ui.tabs.policy`). LayoutV3 renders
sidebar, icon rail and command palette from its `config` and redirects a
hidden page's URL to `landingPath`. Patients and the Command Center can
never be hidden. Never import `buildNavigationConfig` from a component.

---

## Conventions for new clinical components

- Handle **all four states**: loading, error, empty, success. A `fhirClient`
  call with no loading indicator or `catch` is a review failure.
- Get data via contexts (`useFHIRResource`) or `fhirClient` directly — not via
  raw `axios`/`fetch` to `/fhir/...`.
- **Colour comes from the theme, never a hex literal** outside `src/themes/`
  (`src/themes/README.md` says what lives where). `npm run lint:design` is a
  ratchet run in CI: it counts hex literals and hand-built `<Dialog>`s and
  fails when either count rises. When you remove some, run it with
  `-- --update` and commit the lower baseline.
- **Display values go through `src/utils/clinicalDisplay.js`** — `formatPersonName`
  / `cleanNamePart` (drops Synthea digit suffixes), `formatMrn` (UUID → short
  form), `formatUnit` / `formatQuantity` (UCUM → readable, sensible rounding),
  `formatLabName` (LOINC long name → short). Display only: never write a
  formatted value back to a resource or search with one.
- **Shared UI primitives live in `components/common/`** — use them, do not
  hand-roll another: `StatTile` (headline numbers; a `tone` only shows when
  the value is non-zero), `DialogFrame` (one header, three widths, Cancel
  then primary), `PageHeader` (text-only page title + actions), and
  `components/clinical/shared/display/StatusChip` for every status. Status →
  tone → colour is decided once in `utils/statusDisplay.js`: "active" is
  never red. `MetricCard` / `ClinicalSummaryCard` are adapters over
  `StatTile` kept for old call sites.
- **One shell.** `LayoutV3` wraps every authenticated route; full-width
  workspaces use its `rail` + `flush` mode (see `src/pages/CLAUDE.md`). The
  app bar owns search, the command palette (`components/common/CommandPalette`,
  Cmd/Ctrl+K — pages come from the navigation config, so module pages appear
  automatically), theme, connection status, notifications
  (`WorkflowNotificationsButton`, fed by `ClinicalWorkflowContext`) and
  account. Do not add a second app bar or bell inside a page.
- **Charts.** Counts by named category use `components/common/BarList`
  (ranked horizontal bars, one hue, every row labelled) — not a pie or donut,
  and never when categories overlap. An ordered set of groups (age bands,
  count buckets) uses `ColumnBars`; age by sex uses `PopulationPyramid`.
  Two-series colours come from `theme.palette.chart.series`, never a literal.
  Whole-number counts over time are bars, not a smoothed area. No trend
  figure without history behind it.
- **Population figures count living patients, once each.** The Analytics
  page and the dashboard's diagnosis and polypharmacy figures all read one
  snapshot, `GET /api/analytics/population` (`backend/api/analytics/service.py`),
  so they agree. Do not add a second population aggregate computed another
  way; extend the snapshot.
- **The deep ground.** A route can opt in to the aurora ground with
  `page(el, { ground: 'deep' })` (`router/router.js` → `LayoutV3`): the
  shell's navy with faint waves, cards on top. `/dashboard` is the first.
  On such a page, anything set directly on the ground (tabs, loose text,
  icon buttons) takes its colour from `useAuroraPalette()`
  (`themes/auroraPalette.js`, `onGround*`), never from `text.primary`,
  which is chosen for cards. Open the page with
  `components/common/AuroraHero` and frame each section with
  `components/common/SectionCard`. Converting another page means checking
  every element that is not inside a card.
- **The day has four phases.** Sunrise, daytime, sunset and night
  (`themes/auroraPalette.js`). `App.js` picks one from the clock (5-8, 8-17,
  17-20, then night) or the user pins one from the theme menu; the header
  button steps through auto, daytime and night. Daytime is the only light
  phase, so `theme.palette.mode` still answers "light or dark", and
  `theme.phase` names the phase. Every shell surface takes part: ground,
  app bar, navigation gradient, hero scene, card outline or shadow, and (on
  the Standard theme) paper, divider and, in daytime, the primary colour.
  A new shell-level surface must define all four, or a phase falls back to
  another's look (`themes/__tests__/auroraPalette.test.js` checks the keys).
  A phase change cross-fades via the `theme-switching` class.
- **The app bar is always dark.** `LayoutV3` renders it under a dark theme
  (`barTheme`), so anything placed in it gets light-on-dark colours for
  free. Do not hand-colour app bar controls. It wears the aurora ground
  colour, a step lighter than the navigation, so the two read as separate
  surfaces. The bar's own theme has no phase, so inside it
  `useAuroraPalette()` returns night; take the palette from `LayoutV3`.
- **Small details that are decided once.** Numerals for counts and clinical
  values use `theme.typography.fontFamilyMonospace` (StatTile and
  ProgressRing already do). Initials avatars take their fill from
  `utils/avatarColor.js` so a person keeps one colour. A handful of measures
  against one target is `components/common/ProgressRing`. Selection, caret
  and focus-ring colours are set in the theme's `MuiCssBaseline`. The
  display face (Bricolage Grotesque) is for a page's opening line only.
- **Themes.** Two are offered (`themePresets` in `themes/medicalTheme.js`):
  Standard and High contrast, each in light and dark. Do not add a theme to
  the picker without committing to keep every screen checked in it.
- **Markdown text** (CDS card `detail`, note bodies) renders through
  `components/common/Markdown.jsx`; clamped previews use `stripMarkdown` from
  `utils/markdownText.js`. Do not print it raw in a `Typography`.
- **Numbers on screen are never animated.** `AnimatedCounter`
  renders the true value immediately; a count-up showed false counts.
- **Unconfigured CDS cards**: only `critical` opens a dialog; `warning` is a
  banner, `info` a toast (`defaultModeForIndicator` in
  `contexts/CDSHooksContext.js`). A toast shows the summary and opens in
  place to the whole card (detail, source, suggestions, links, acknowledge,
  snooze); after the hide delay the stack minimizes to a "Decision support"
  button. Auto-hide must never dismiss a card: that discarded content the
  service sent.
- **A 401 does not log the user out by itself.** `services/api.js` confirms
  with `/api/auth/me` first, then fires `AUTH_UNAUTHORIZED_EVENT`
  (`constants/authEvents.js`); `AuthContext` clears the user and the router
  redirects. Never `window.location.href = '/login'`.
- Generic React/MUI/hooks patterns are assumed known — not documented here.

---

## Commands

```bash
./deploy.sh dev                    # full stack via Docker; frontend :3000
cd frontend && npm start           # Vite dev server (needs backend running)
npm test                           # vitest run (single pass)
npm run test:watch                 # vitest watch
npm run lint                       # ESLint
npm run build                      # vite build -> build/ + postbuild-sw.js
```

Demo logins: `demo/password` (clinician), `nurse/password`, `pharmacist/password`,
`admin/password`.

Tests: **Vitest** with `globals: true`, so `describe/it/expect` work unchanged;
the mock API is `vi.*`, not `jest.*`. `src/test-utils/test-utils.js` exports a
custom `render` (re-exported as `render`) plus `generateMockPatient` /
`generateMockCondition` / `generateMockMedicationRequest`. There is **no
`TestProviders` export** — use the custom `render`. Do not use `require()` in a
test file; it bypasses `vi.mock` and Vite's transform.

---

## Build toolchain (`vite.config.js`)

Vite 7 replaced CRA/CRACO. Three things there are load-bearing for deployment
and must not drift: `build.outDir: 'build'` (Dockerfile copies `/app/build`),
`envPrefix: 'REACT_APP_'`, and the `static/js|css|media` asset layout.

`src/**/*.js` files are transformed by a custom pre-plugin using esbuild's
**`tsx`** loader — 320+ `.js` files contain JSX and 7 carry Flow/TS-style type
annotations that CRA's babel preset used to accept. Do not rename them; do not
narrow that plugin to the plain `jsx` loader.

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Build/compile error `Cannot find module .../services/fhirClient` | Stale import of the deleted client — repoint to `core/fhir/services/fhirClient` |
| `useFHIRResource must be used within a FHIRResourceProvider` | Component rendered outside `<AppProviders>` |
| `@/...` import unresolved | No `@` resolve alias — use a relative path |
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
