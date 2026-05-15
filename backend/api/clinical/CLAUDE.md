# Clinical Workflows — module reference

Backend clinical workflows: CPOE ordering, medication safety, pharmacy
dispensing, the nurse-side administration record (MAR), results, tasks,
alerts, inbox, and clinical documentation.

**Inherits** root + `backend/CLAUDE.md` + `backend/api/CLAUDE.md` patterns
(HAPI-FHIR-is-the-store, backend-as-proxy, async everywhere, env-driven URLs,
service-layer separation, educational / no-PHI). Only module-specific deltas
are below.

> **Safety-critical module.** Medication ordering, drug-interaction checking,
> and dispensing gates here are real patient-safety logic. Do not weaken a
> status gate or a safety check to make a workflow "flow better" — the gates
> exist on purpose. When in doubt, fail safe (block + warn).

---

## Routers and their real prefixes

Prefixes are inconsistent across this module — some routers carry the full
`/api/clinical/...` prefix themselves, others carry a short prefix and get
`/api` prepended at registration in `api/routers/__init__.py`. **Always
confirm the resolved path before wiring a frontend call.**

| File | Router prefix | Registered with | Resolved base |
|---|---|---|---|
| `orders/orders_router.py` | `/clinical/orders` | `prefix="/api"` | `/api/clinical/orders` |
| `pharmacy/pharmacy_router.py` | `/api/clinical/pharmacy` | (none) | `/api/clinical/pharmacy` |
| `administration/router.py` | `/api/clinical/administration` | (none) | `/api/clinical/administration` |
| `results/results_router.py` | `/api/clinical/results` | (none) | `/api/clinical/results` |
| `tasks/router.py` | `/api/clinical/tasks` | (none) | `/api/clinical/tasks` |
| `alerts/router.py` | `/api/clinical/alerts` | (none) | `/api/clinical/alerts` |
| `inbox/router.py` | `/api/clinical/inbox` | (none) | `/api/clinical/inbox` |
| `documentation/notes_router.py` | `/clinical/notes` | (none) | `/clinical/notes` *(no `/api`)* |
| `medication_lists_router.py` | `/api/clinical/medication-lists` | (none) | `/api/clinical/medication-lists` |
| `cds_clinical_data.py` | `/api/clinical` | (none) | `/api/clinical` (lab/vital/condition catalogs) |
| `drug_safety_router.py` | `/drug-safety` | `prefix="/api/clinical"` | `/api/clinical/drug-safety` |
| `provider_directory_router.py` | `/api/provider-directory` | (none) | `/api/provider-directory` |

`drug_interactions.py` defines a prefix-less router that is **mounted inside
`drug_safety_router.py`** (`router.include_router(...)`) — it is not
registered independently. Its endpoints resolve under `/api/clinical/drug-safety`
(e.g. `POST /api/clinical/drug-safety/comprehensive-safety-check`).

---

## The three medication resources — don't conflate them

The medication workflow spans three distinct FHIR resources, each owned by a
different surface:

- **`MedicationRequest`** — the *order*. Created by `orders/orders_router.py`
  (`POST /api/clinical/orders/medications`).
- **`MedicationDispense`** — the *pharmacy fill*. Created by
  `pharmacy/pharmacy_router.py` (`POST .../pharmacy/dispense`).
- **`MedicationAdministration`** — the *dose actually given*. Created by
  `administration/router.py` (`POST .../administration/record`).

### Status gates (patient-safety logic — never weaken)

Order-creation dialogs land orders as `draft`; the encounter signing dialog
(PR #85) flips them to `active`. Downstream actions refuse unsigned orders:

| Action | Gate constant | Allowed `MedicationRequest.status` |
|---|---|---|
| Dispense (`pharmacy_router.py:142`) | `DISPENSABLE_STATUSES` | `active`, `on-hold`, `completed` |
| Record administration (`administration/service.py:32`) | `ADMINISTRABLE_STATUSES` | `active`, `completed` |

Dispensing or administering a `draft` order bypasses the prescriber's
signature — it is a real safety risk and the endpoints return `409 Conflict`.

---

## Drug safety — two parallel checkers (know which you're calling)

There are **two independent safety paths**. They are not the same engine.

1. **Order-time inline check** — `check_medication_alerts_fhir()` in
   `orders_router.py`. Runs automatically inside `POST .../orders/medications`.
   Queries HAPI for active `AllergyIntolerance` + `MedicationRequest`, does
   substring allergy matching and a small hard-coded `interaction_pairs` dict
   (~5 pairs). A `high`-severity alert blocks the order unless
   `override_alerts=true`. On exception it appends a `warning` alert and
   continues (fail-safe).

2. **Standalone comprehensive check** — `comprehensive_safety_check()` in
   `drug_interactions.py`, exposed at
   `POST /api/clinical/drug-safety/comprehensive-safety-check`. Covers
   drug-drug, drug-allergy, drug-disease contraindication, duplicate therapy,
   and dosage-range checks, and returns a `SafetyCheckResult` with a numeric
   risk score. This is the richer checker but **the order endpoint does not
   call it** — it uses checker #1.

Both use **hard-coded reference data**, not a live drug database. Treat
interaction coverage as illustrative, not exhaustive. If you extend coverage,
extend `drug_interactions.py` (the comprehensive one), not the inline dict.

---

## What this module does NOT do (corrections to prior doc)

- **No event bus / WebSocket broadcasting here.** `orders`, `pharmacy`, and
  `administration` routers do not publish clinical events or broadcast over
  WebSocket. There is no `CLINICAL_EVENTS` dict and no `publish_event()` in
  this module. Real-time event plumbing lives in `api/websocket/`.
- **`notifications_helper.py`** is a thin wrapper over
  `api/services/notification_service.py` (critical-value, task-assignment,
  appointment, and medication-interaction notifications). Currently imported
  only by `results/results_router.py`.
- **Catalogs are not owned here.** The unified catalog service is
  `api/catalogs/` at `/api/catalogs/...`. `cds_clinical_data.py` is a separate,
  narrower service exposing lab / vital-reference / condition catalogs under
  `/api/clinical/lab-catalog`, `/vital-references`, `/condition-catalog`.
  There is no `dynamic_catalog_router.py` (deleted) and no
  `/api/clinical/cds-data/{patient_id}` endpoint.

---

## MAR — two overlapping surfaces

Medication-administration data is reachable two ways, and this is a known
wart:

- **`administration/`** module — the current MAR surface. `GET .../scheduled-tasks`
  computes due times via `services/dose_scheduler.py` (`compute_due_times`)
  and matches them against existing `MedicationAdministration` resources
  within `ADMIN_MATCH_WINDOW` (±60 min). `POST .../record` writes the admin.
  This is what the frontend MAR grid (#116 Phase 5.1) uses.
- **`pharmacy/pharmacy_router.py`** also exposes legacy `/mar/{patient_id}`,
  `/mar/administer`, `/mar/schedule/{patient_id}` endpoints.

For new MAR work use the `administration/` module. Do not add to the pharmacy
`/mar/*` endpoints.

---

## Start here

- `orders/orders_router.py` — CPOE: `POST /medications` is the canonical
  example of the safety-check-then-create-FHIR pattern (lines ~194–290).
- `pharmacy/pharmacy_router.py` — `POST /dispense` (the dispense gate, ~113–150).
- `administration/service.py` — dose matching, status gate, `_match_dose`.
- `drug_interactions.py` — `comprehensive_safety_check` + the reference data.

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Medication order silently not saved | `orders_router.py` — `order_saved: false` is returned (not an error) when a `high` alert fires and `override_alerts` is false |
| Dispense returns `409` | `MedicationRequest.status` not in `DISPENSABLE_STATUSES` — order was never signed (still `draft`) |
| Record-administration returns `409` | Order not in `ADMINISTRABLE_STATUSES` (`active`/`completed`) |
| Frontend call 404s | Prefix mismatch — re-check the resolved-base table above; `notes_router` notably has **no** `/api` |
| Drug interaction not flagged on order | Order endpoint uses the small inline dict, not the comprehensive checker — expected; verify via `/drug-safety/comprehensive-safety-check` |
| MAR grid empty for a patient with active meds | `dose_scheduler.py` skips unsupported `Timing.repeat` shapes — check its logs |
| FHIR resource counts wrong | Query HAPI tables: `SELECT res_type, COUNT(*) FROM hfj_resource WHERE res_deleted_at IS NULL GROUP BY res_type;` — there is **no** `fhir.resources` table |

## Out of scope here

- FHIR storage internals → HAPI (`hfj_*` tables); see root `CLAUDE.md`.
- CDS Hooks service execution → `api/cds_hooks/` (CDS Hooks 2.0, module v3.1).
- Real-time event broadcasting → `api/websocket/`.
- Unified clinical catalogs → `api/catalogs/`.
