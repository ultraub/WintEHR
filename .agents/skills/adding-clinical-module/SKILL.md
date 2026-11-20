---
name: adding-clinical-module
description: Adds a new pluggable clinical module to WintEHR (a new domain with its own backend routers and a workspace tab, page or slot) using the module scaffold and registration contract. Use when asked to add a new clinical domain, feature area, workspace tab, top-level page or specialty (referrals, oncology, a new board or dashboard), to scaffold or register a module, to make a feature switchable per deployment, or to build an external or standalone module, even when the request does not use the word "module".
---

# Adding a clinical module

A module is one key that names a backend half (`MODULE_ROUTERS`) and a
frontend half (a manifest under `frontend/src/modules/<key>/`), switchable per
deployment. `docs/MODULES.md` is the contract; read it once before a first
module. This skill is the procedure and the decisions the scaffold cannot make
for you.

## 1. Check that a module is the right tool

WintEHR is a teaching platform with four extension mechanisms, and the module
is the heaviest. `docs/MODULES.md` ("Other extension mechanisms") lists them in
preferred order: external CDS service, SMART on FHIR app, visual-builder or CQL
CDS service, then clinical module. Pick a module only when the capability needs
its own workspace surface or server-side workflow logic. If a lighter mechanism
fits, tell the user which and why before writing code, because a module that
should have been a CDS service is code the project has to maintain forever.

## 2. Scaffold

```bash
python3 scripts/new-module.py <key> "<Label>"       # key is kebab-case
```

Read what it prints. **The printed registration edits are the source of
truth**: make exactly those edits, in that order. If a registration point
exists that the script does not print, fix the script in the same change
(see step 7) so the next person is not relying on memory.

The scaffold creates both halves. Delete the half a module does not need: a
backend-only module has no frontend directory, and the reverse.

For a module that lives in its own repository, use `--standalone` and follow
"External modules" in `docs/MODULES.md` instead of the registration edits.

## 3. Decide what the scaffold leaves open

The scaffold produces a working skeleton with deliberately unanswered
questions. Answer each one explicitly; ask the user when the answer is a
product decision.

- **Who may call it.** The generated route has no auth. Decide per endpoint
  and add `Depends(get_current_user)`, with an explicit
  `"<permission>" in current_user.permissions` check where a role gate is
  needed. Details in `backend/api/auth/CLAUDE.md`. Auth here shapes roles for
  teaching; it is not a security control, so do not describe it as one.
- **Where the data lives.** FHIR data goes in HAPI through the injected
  `HAPIFHIRClient`, never in a custom table. Prefer an existing FHIR resource
  over inventing storage (flowsheet values are plain `Observation`s; the
  module owns no tables).
- **Non-FHIR state.** Settings, logs and job records go in a Postgres schema
  the module owns. Adding a table is its own procedure: check how
  `postgres-init/` is applied before assuming a new SQL file reaches an
  existing deployment, and raise it with the user if the module needs one.
- **Which surface.** A manifest can contribute `tabs` (patient chart),
  `pages` (routed page plus nav item from one entry) and `slots` (UI inside
  a core component at a published outlet). Use the smallest one that fits. A
  new slot name is added only together with its outlet and a real consumer.
- **New configuration.** A new env var must be forwarded to the backend by
  compose for both the dev and prod services, or the container never sees it.
  See `deploy/CLAUDE.md`.

## 4. Build it the way the platform expects

- **Imports**: module frontend code imports platform APIs from
  `frontend/src/modules/sdk.js` only (`'../sdk'`). Lint enforces this for
  every directory under `frontend/src/modules/`. If the SDK lacks something, do not
  deep-import around it: adding an SDK export is an API decision that every
  external module then depends on, so propose it to the user.
- **Services** take the HAPI client as a constructor argument with a `None`
  default, so tests pass a fake and never need `patch()`.
- **Routers** carry their full `/api/...` prefix and stay thin: parse, call
  the service, map errors.
- **Every surface handles four states**: loading, error, empty, success. An
  unhandled state renders as a blank, which a learner reads as "broken".
- **Read real data tolerantly.** Synthea writes one concept in several
  shapes (blood pressure arrives as a panel with components, not as two
  standalone observations). Look at real resources in HAPI before fixing a
  parser to one shape.
- **Show only what the data says.** This platform teaches from what it
  displays. Leave an unknown value empty or labelled unknown rather than
  filling in a plausible default, and carry a code's real system through
  instead of assuming one.

## 5. Verify

Run the commands the scaffold printed. They cover the three checks that hold
the registrations together:

- `backend/tests/api/test_module_registration.py`: every module key
  registers, disabling drops its routes, and its expected prefix is listed.
- `frontend/src/modules/__tests__/moduleLoader.test.js`: manifest shape, and
  the tab or page color is a registered accent. A failure here straight after
  scaffolding means the hue edit is missing, which is intended.
- `npm run lint`: the SDK import boundary.

Then test the off switch, since it is the point of a module: the registration
test's disable case must cover the new key, and `GET /api/health` must list it
under `routers.disabled_modules` when `WINTEHR_DISABLED_MODULES=<key>` is set.

Passing tests show the wiring is right, not that the endpoints work against
real HAPI. Use the `verifying-live-endpoints` skill before calling the module
done.

## 6. Document

- Add a row to the module inventory table in `docs/MODULES.md`.
- If the module has non-obvious rules, add a short `CLAUDE.md` in its backend
  directory and list it in the map in the root `CLAUDE.md`.
- A new env var goes in `docs/CONFIGURATION.md` and `.env.example`.

## 7. Keep the scaffold honest

If you had to do anything by hand that every future module will also need (a
new registration point, a new test list, a new lint entry), put it in
`scripts/new-module.py`: generate it, or add it to the printed edits. This
skill should stay a description of decisions, with the mechanical steps living
in the script where a test run exercises them.
