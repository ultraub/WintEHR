# AdministrationRecord (MAR) — module reference

The Medication Administration Record. Nurse-side surface for charting
"I gave the 0800 metformin", complementing the Order Composer's CPOE
side. #116 Phase 5.1 (medication grid) + 5.2 (non-medication Tasks pane).

**Inherits** root + `frontend/CLAUDE.md` + `frontend/src/CLAUDE.md` patterns.

## Architecture at a glance

```
AdministrationRecord.jsx  ──┐    (tab shell — wires data + UI)
                            │    2-column: grid (left) + Tasks pane (right)
                            ├─ FilterBar.jsx       (status / window / density)
                            ├─ MARGrid.jsx         (time-axis CSS grid)
                            │   ├─ MedRowHeader.jsx   (left rail, 200px)
                            │   └─ MARCell.jsx        (per-cell state machine)
                            ├─ PRNPane.jsx         (PRN cards below grid)
                            ├─ QuickAdminPopover.jsx (click-to-document)
                            └─ TaskPane.jsx        (Phase 5.2 — right column)
                                └─ dialogs/        (Immunization / Specimen /
                                                    Procedure recording dialogs)

useScheduledTasks.js     ── grid data hook (fetch, WebSocket updates, tick)
useAdministrationTasks.js ─ Tasks-pane data hook (fetch + WebSocket refresh)
```

## Tasks pane — non-medication recording (Phase 5.2)

Where the grid charts medication doses, `TaskPane` charts the other
shift work: immunizations, specimen collections, procedures. It reads
`GET /api/clinical/administration/tasks`, which returns active
ServiceRequest orders bucketed by category coding (immunization
`33879002`, lab `108252007`, procedure `387713003`), each flagged
`fulfilled` when a recording resource (`Immunization`/`Specimen`/
`Procedure`) already links back to the order.

Each pending order is a tappable card → a recording dialog under
`dialogs/`. The dialog POSTs to `POST .../administration/record/{type}`,
which builds the FHIR resource linked back to the order and enforces the
same `ADMINISTRABLE_STATUSES` gate. Order links: Procedure uses native
`basedOn`, Specimen uses native `request`; **R4 Immunization has no order
element** (added in R5), so it carries the link on a custom
`immunization-order` extension.

`ImmunizationAdminDialog` is dual-mode (Phase 5.3): the `task` prop drives
**record mode** (Tasks pane, POSTs to the backend); the `immunization`
prop drives **edit mode** (Chart Review's edit-an-existing path, hands a
merged resource to an `onSave` callback). It replaced the retired
1,569-line `ImmunizationDialogEnhanced` — immunization *ordering* moved to
the Order Composer, so that dialog's CDS / forecast machinery was dead
weight. Edit mode spreads the original resource so fields the lean form
doesn't manage (`performer`, `location`, `protocolApplied`, `reaction`)
survive an edit.

## Cell state grammar (the visual language)

The grid speaks in nine cell states. Each maps to a severity token from
`clinicalThemeUtils.getSeverityColor()` and an optional pulse animation.
`classifyCell(scheduledRow, now)` is the single source of truth — pure
function exported from `MARCell.jsx`, tested in `__tests__/MARCell.test.jsx`.

| State | Glyph | Severity | Pulse | Meaning |
|---|---|---|---|---|
| `empty` | — | none | none | No dose scheduled in this column |
| `future` | ○ | normal | none | Scheduled, >30 min away |
| `due-now` | ● | moderate | 2s (calm) | Within ±30 min of now |
| `past-due` | ● | high | 1s (urgent) | 30 min – 2 h late, no record |
| `missed` | ✕ | critical | none | >2 h past, never recorded |
| `given` | ✓ | low | none | Admin recorded ≤60 min from scheduled |
| `late-given` | ✓ + dashed | low | none | Admin recorded >60 min from scheduled |
| `held` | — | normal | none | Admin status=on-hold |
| `refused` | R + stripe | critical | none | Admin status=not-done |
| `pending` | ● | normal | 0.3s | Optimistic "saving" flash (200ms lifetime) |

## Data flow

1. `useScheduledTasks` fetches `GET /api/clinical/administration/scheduled-tasks`
   with the current `{ patient_id, window_start, window_end }`.
2. The backend (`backend/api/clinical/administration/service.py`) runs
   `dose_scheduler.compute_due_times` on every active MedicationRequest,
   matches each dose against existing MedicationAdministrations, and
   returns a flat list of "scheduled rows" + a separate PRN list +
   unscheduled admins.
3. The grid groups scheduled rows by `medication_request_id` and buckets
   doses into columns derived from the window duration (1h / 2h / 4h).
4. Each `MARCell` independently classifies its state from the row.

## WebSocket live updates

The hook subscribes to `CLINICAL_EVENTS.MEDICATION_ADMINISTERED`. When a
peer nurse records a dose on the same patient, the hook triggers a quiet
refetch — the server is the source of truth for "did this match a
scheduled dose?" so we don't try to mutate local state.

## Submitting an administration

`QuickAdminPopover` posts to `POST /api/clinical/administration/record`.
The endpoint refuses orders where `MedicationRequest.status` is not in
`ADMINISTRABLE_STATUSES` (`{"active", "completed"}`) — same gate
philosophy as the pharmacy dispense endpoint from PR #139.

Action types and the FHIR statuses they map to:

| `action` | `MedicationAdministration.status` | Extras |
|---|---|---|
| `given` | `completed` | dosage + scheduled-time extension |
| `late-given` | `completed` | + `late-charted: true` extension |
| `held` | `on-hold` | `statusReason` (required) |
| `refused` | `not-done` | `statusReason` (required) |

## What's deliberately out of scope

- **Ad-hoc recording with no order** — every Tasks-pane card has a
  ServiceRequest. Chart Review's "add immunization" routes to the Order
  Composer; only its *edit* path uses `ImmunizationAdminDialog` directly.
- **Drag-to-reschedule** — out of scope, app is modal-first.
- **Advanced `Timing.repeat` shapes**: `dayOfWeek`, `timeOfDay`,
  `when` event-coded timing (mealtime-relative), taper schedules across
  multiple dosageInstruction entries. The scheduler logs + skips these.
- **Facility-specific default anchor times** — BID/TID/QID anchors are
  hard-coded in `dose_scheduler._DAILY_ANCHORS`. Later sub-phases will
  pull from `Encounter.location` policy when that's modelled.

## Files to look at when debugging

- "Grid is empty for a patient with active meds" → `dose_scheduler.py`
  log entries (`MedicationRequest/X timing.repeat ... — schedule omitted`)
- "Cell is past-due but I just gave it" → `service._match_dose`,
  `ADMIN_MATCH_WINDOW` (currently ±60 min)
- "I see two cells for the same dose" → bucketing bug in `MARGrid.bucketByColumn`
  (only the first matching column wins; check column step granularity)
- "Pulse is too aggressive / too calm" → tune `STATE_CONFIG[*].pulse` in `MARCell.jsx`
