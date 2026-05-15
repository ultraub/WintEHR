# CDS Hooks — Frontend Plumbing

**Last Updated**: 2026-05-13
**Purpose**: How CDS Hooks 2.0 firing, card storage, and reads are wired on the React side.

**Inherits** root + `frontend/CLAUDE.md` + `frontend/src/CLAUDE.md` patterns.

---

## The two patterns (and when to use which)

There are exactly two supported patterns. Don't invent a third.

### Pattern A — Shared, global cards via `CDSHooksContext`

**File**: `frontend/src/contexts/CDSHooksContext.js`
**Provider**: `<CDSHooksProvider>` — lifted in `providers/AppProviders.js`
**Consumer hook**: `useCDS()` (returns `services`, `getCards`, `fireHook`, `firePatientView`, etc.)
**Convenience**: `usePatientCDSAlerts(patientId)` — fires patient-view on patient change and returns the resulting cards

Use this when the cards need to be **visible across the app** — patient-view alerts in the chart header, the alert pill row, the summary tab. Cards land in `cardsByHookType[hookType]` and are decorated with `displayBehavior` based on each service's configuration.

```jsx
// Read patient-view cards anywhere in the clinical tree
import { useCDS, CDS_HOOK_TYPES } from '@/contexts/CDSHooksContext';

const Header = () => {
  const { getCards } = useCDS();
  const alerts = getCards(CDS_HOOK_TYPES.PATIENT_VIEW);
  return <Badge count={alerts.length} />;
};

// Fire and read in the same place
import { useCDS, CDS_HOOK_TYPES } from '@/contexts/CDSHooksContext';

const MedicationDialog = ({ patientId, selectedMedication, userId }) => {
  const { fireHook, getCards } = useCDS();
  const cards = getCards(CDS_HOOK_TYPES.MEDICATION_PRESCRIBE);

  const onNext = async () => {
    await fireHook(CDS_HOOK_TYPES.MEDICATION_PRESCRIBE, {
      patientId, userId, medications: [selectedMedication],
    });
    // cards is now populated via the shared store
  };
};
```

Patient-view fires automatically on patient change via `usePatientCDSAlerts(patientId)`. Don't call `fireHook('patient-view', …)` directly unless you need to refire for a special reason — the convenience hook handles dedup.

### Pattern B — Dialog-scoped local cards via `useCDSHooks`

**File**: `frontend/src/hooks/cds/useCDSHooks.js`
**Hooks**: `useCDSHooks()`, `useOrderSelectHook(patientId, userId, draftResources, encounterId)`, `useMedicationPrescribeHook(...)`, `usePatientViewHook(...)`

Use this when the cards are **local to a UI surface** — order-select cards in the medication composition wizard, order-sign cards in the signing dialog. Each call to `useCDSHooks()` creates its own state; cards stay scoped to the calling component.

```jsx
import { useOrderSelectHook } from '@/hooks/cds/useCDSHooks';

const MedicationStep = ({ patientId, userId, selectedMedication }) => {
  const draftResources = useMemo(() => [{
    resourceType: 'MedicationRequest',
    status: 'draft',
    medicationCodeableConcept: {/* ... */},
    subject: { reference: `Patient/${patientId}` },
  }], [patientId, selectedMedication]);

  const { cards } = useOrderSelectHook(patientId, userId, draftResources) || {};
  // cards here are LOCAL — they don't show up in the global header badge
};
```

The `use*Hook` wrappers JSON-key on the draft shape so a parent re-render won't re-fire — fire happens on actual identity changes only.

---

## Which pattern do I pick?

| Question | Use… |
|---|---|
| Does this card need to show up in the global header / sidebar / patient summary? | Pattern A |
| Is this card produced and consumed in the same dialog and dies when the dialog closes? | Pattern B |
| Patient-view alerts for chart load? | Pattern A (via `usePatientCDSAlerts`) |
| Order-select / order-sign / medication-prescribe alerts in a workflow dialog? | Pattern B (dialog-scoped) OR Pattern A (if a global badge needs to see them) |

Right now the only globally-aggregated hook type is **patient-view**. Other hook types fire through Pattern B because their cards are dialog-scoped. If you find yourself wanting to surface order-select cards in the chart header, lift that firing to Pattern A (`fireHook('order-select', …)`) so the shared store sees it.

---

## What changed in #123 (and why)

Before this change, two parallel paths existed:

- `CDSContext.js` — owned an `alerts: { [hookType]: Card[] }` store and an `executeCDSHooks(hookType, context)` method. Service discovery, displayBehavior decoration, and dedup all lived inside this context. Read via `useCDS().getAlerts(hookType)` or `useCDS().alerts['patient-view']`.
- `hooks/cds/useCDSHooks.js` — a hook-shaped path that owned a flat `cards` array per instance, with its own discovery. PR #117 wired dialog-scoped order-select through this.

Both paths had their own state, their own discovery, and didn't see each other's cards. `MedicationDialogEnhanced` had to read from both: `useCDS().getAlerts(MEDICATION_PRESCRIBE)` for the global-fired medication-prescribe cards AND `useOrderSelectHook(...)` for the dialog-local order-select cards. Cards produced by Pattern B were never visible to global readers, and Pattern A wasn't getting the type-safe parallelism Pattern B had.

Now there is **one shared store** (`CDSHooksContext`) for global-visible cards, plus **per-instance state** (`useCDSHooks()`) for dialog-scoped ones. They share the same underlying HTTP client (`services/cdsHooksClient.js`) and the same parallel-dispatch pattern from PR #113.

Dead code removed:
- `evaluateCDS(…)` calls in `ConditionDialogEnhanced` / `AllergyDialogEnhanced` — the method never existed on the context; the calls always threw and were swallowed by a try/catch. The render sections gated on `cdsAlerts.length > 0` were always false.
- `getAlerts(ORDER_SIGN)` / `getAlerts(ORDER_SELECT)` reads in `EnhancedOrdersTab` — nothing ever called `executeCDSHooks` for those types, so those slots in the store were always empty. The notification callback was firing with `[]`.

---

## Testing

- `frontend/src/hooks/cds/__tests__/useOrderSelectHook.test.js` — PR #117 spec compliance for dialog-scoped order-select. Still green; this PR didn't touch the hook.
- `frontend/src/services/__tests__/cdsHooksClient.parallel.test.js` — PR #113 perf regression test for parallel dispatch. Still green; both patterns dispatch services via `Promise.allSettled`.

When adding new CDS-aware UI:
1. If it's a global reader, render a quick sanity check that `getCards(hookType)` returns an array after `usePatientCDSAlerts(patientId)` fires.
2. If it's a dialog firing, write or extend a test in `useOrderSelectHook.test.js` style — assert that re-renders with the same draft shape don't refire.
