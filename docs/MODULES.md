# WintEHR Clinical Modules — the pluggable-module platform

A **module** is a self-contained clinical capability that plugs into the
platform through explicit registration points and can be switched off per
deployment without deleting code. Modules are how new domains (flowsheets,
inpatient, oncology, …) get added to WintEHR — and how third parties are
meant to build on it.

The platform grew out of the 2026-07 architecture cleanup
(`ARCHITECTURE_DEBT.md`): every extension seam here was extracted from a
working consumer, never designed speculatively. The pilot module is
**flowsheets** — read it as the living template.

---

## Anatomy of a module

```
backend/api/<key>/                 frontend/src/modules/<key>/
├── models.py    Pydantic models   ├── index.js      the MANIFEST
├── service.py   logic; injected   └── <X>Tab.jsx    lazy-loaded surfaces
│                HAPI client
├── router.py    thin Depends()    backend/tests/api/<key>/
│                stubs, full       └── test_<key>_service.py
│                /api/... prefix
└── __init__.py
```

One module key names both halves. `flowsheets` in a disable list switches
off the backend routers **and** the frontend tabs.

Manifests may contribute (all optional):

- **`tabs`** — patient-chart workspace tabs. `insertAfter: '<tab-id>'`
  places a tab where it clinically belongs (Flowsheet sits beside the MAR);
  omitted or unknown anchors append at the end — a tab never silently
  disappears over a placement typo.
- **`pages`** — top-level routed pages: `{ id, path, label, icon, color,
  description, nav: { section, order }, loader }`. ONE entry yields the
  route (router/router.js) and the app-shell menu item
  (components/navigationRegistry.js) — they cannot drift. Omit `nav` for a
  routed page with no menu presence. Valid `nav.section` keys: `clinical`,
  `analytics`, `tools`, `admin`; a section with no items is dropped from
  the nav entirely.

Scaffold a new module with:

```bash
python3 scripts/new-module.py referrals "Referrals"
```

## Registration — three explicit edits

Registration is deliberately explicit, not auto-discovered. An explicit
list is reviewable, gives Vite a static import to code-split, and preserves
registration order (FastAPI route matching and tab order both depend on
order). This mirrors the backend's `ROUTERS` list and the tab registry —
the two extension seams that have proven themselves.

1. **Backend** — `backend/api/routers/__init__.py`, `MODULE_ROUTERS`:
   ```python
   "flowsheets": [
       ("Flowsheets", "api.clinical.flowsheets.router", "router",
        {"tags": ["Flowsheets"]}),
   ],
   ```
   Same entry shape as `ROUTERS`; same per-router failure isolation — a
   broken module degrades to *its own* routers failing, named in
   `/api/health`, never taking anything else down.

2. **Frontend** — `frontend/src/modules/index.js`: import the manifest, add
   it to `ALL_MODULES`. Module tabs append to the workspace tab registry and
   become ordinary entries: the strip, keyboard shortcuts, URL routing, and
   the registry coverage tests all pick them up with zero further edits.

3. **Hue** — `frontend/src/themes/categoricalAccents.js`: one accent per
   module in the pluggable-module section (the one-hue-per-domain rule; the
   coverage tests enforce membership).

## Disabling a module per deployment

| Side | Mechanism | When it applies |
|---|---|---|
| Backend | `WINTEHR_DISABLED_MODULES=flowsheets,other` env var | at startup (runtime) |
| Frontend | `REACT_APP_DISABLED_MODULES=flowsheets,other` build arg | baked at build time |

A disabled module is reported by `GET /api/health` under
`routers.disabled_modules` — deliberately absent, distinct from failed.
Unknown keys in the env var are warned about loudly (a typo must not look
like it worked).

## The rules modules inherit

Modules are not exempt from the platform invariants (root `CLAUDE.md`):

- **FHIR data lives in HAPI** — reached through `HAPIFHIRClient` (backend)
  or `fhirClient`/contexts (frontend). No custom FHIR tables, ever.
  Flowsheet values are plain `Observation`s; the module owns zero tables.
- Non-FHIR state (configs, logs) goes in a **module-owned Postgres schema**
  (the way `cds_hooks.*` and `smart_auth.*` do it).
- Services take an **injected HAPI client** (`hapi_client=None` default) so
  tests construct them with a fake — no `patch()` chains.
- Async everywhere; env-driven URLs; educational platform — synthetic data
  only.
- Frontend surfaces handle all four states (loading / error / empty /
  success) and read tolerantly: real data writes the same concept in
  several shapes (see the flowsheet service's panel-component handling —
  Synthea writes BP as an `85354-9` panel, not standalone observations).

## Other extension mechanisms (often the better fit)

A workspace module is not always the right tool. In order of preference:

- **External CDS service** — register by URL at runtime, zero code in this
  repo. The strongest plugin surface WintEHR has.
- **SMART on FHIR app** — a separate codebase entirely, sharing only FHIR.
  Backend OAuth2/PKCE stack is live (`api/smart/`).
- **Visual-builder CDS service / CQL** — built from the UI, stored as data.
- **Clinical module** (this document) — when the capability needs its own
  workspace surface or server-side workflow logic.

## Module inventory

| Key | What it is | Frontend surface | Status |
|---|---|---|---|
| `flowsheets` | Nursing vitals flowsheet (time × vital grid over Observations) | Flowsheet tab | pilot — live |
| `imaging` | DICOM services + imaging studies (needs a dcm4chee VNA) | Imaging tab (core, for now) | converted from core |
| `ai-tools` | UI Composer + Clinical Canvas (need LLM API keys) | — | converted from core |
| `quality-analytics` | Quality measures + analytics reporting | Population Health nav section (Analytics / Quality / Care Gaps pages) | full module (backend + pages) |
| `scheduling` | Scheduling | Schedule page + nav item | full module (backend + pages) |
| `questionnaires` | Questionnaires | — | converted from core |

`scheduling` and `quality-analytics` are fully coherent since Phase 1 of
the platform roadmap: one key removes their backend routers, routes, and
nav items together (page components stay in `src/pages/` — Phase 1 moved
ownership, not files). `imaging` and `ai-tools` remain backend-only keys:
ai-tools has no dedicated frontend surface, and the Imaging tab stays core
until a concrete need moves it (tab placement via `insertAfter` now exists,
so the old end-of-strip objection is gone — it is simply not yet worth the
churn).

## Roadmap seams (grown one concrete module at a time)

Deliberately NOT built yet — each gets extracted when its first real
consumer arrives, never speculatively (two pre-platform "unifying layers"
died unadopted; see `ARCHITECTURE_DEBT.md` §F2):

- **Slot registry** (patient-header chips, summary cards) — first needed by
  bed/unit display.
- **Order-type registry + safety-rule providers** — first needed by an
  oncology/chemo module; the largest lift, touching CPOE.
- **Conditional tab visibility** (predicate on patient context) — specialty
  modules whose tabs only apply to some patients.
