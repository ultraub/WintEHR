/**
 * CDS hook types — the ONE frontend list, mirroring the backend's
 * authoritative HookType enum (backend/api/cds_hooks/models.py).
 *
 * Before this file, 11 separate hook-type lists existed with memberships
 * ranging from 3 to 11 entries — a CDS service registered on any of the 5
 * non-standard hooks was invisible and uncreatable in every frontend
 * surface (bug B4, docs/ARCHITECTURE_DEBT.md). Keep this file in lockstep
 * with the backend enum; cdsHooksCompliance.test.js pins the parity.
 */

export const CDS_HOOK_TYPE_OPTIONS = [
  // The six CDS Hooks 1.0/2.0 standard hooks
  { value: 'patient-view',            label: 'Patient View' },
  { value: 'medication-prescribe',    label: 'Medication Prescribe' },
  { value: 'order-sign',              label: 'Order Sign' },
  { value: 'order-select',            label: 'Order Select' },
  { value: 'encounter-start',         label: 'Encounter Start' },
  { value: 'encounter-discharge',     label: 'Encounter Discharge' },
  // Additional hooks the backend engine supports
  { value: 'allergyintolerance-create', label: 'Allergy Create' },
  { value: 'appointment-book',          label: 'Appointment Book' },
  { value: 'medication-refill',         label: 'Medication Refill' },
  { value: 'order-dispatch',            label: 'Order Dispatch' },
  { value: 'problem-list-item-create',  label: 'Problem List Item Create' },
];

/** Enum-style map: CDS_HOOK_TYPES.PATIENT_VIEW === 'patient-view'. */
export const CDS_HOOK_TYPES = Object.fromEntries(
  CDS_HOOK_TYPE_OPTIONS.map(({ value }) => [value.replace(/-/g, '_').toUpperCase(), value])
);

/** Bare value list for validation. */
export const CDS_HOOK_TYPE_VALUES = CDS_HOOK_TYPE_OPTIONS.map(({ value }) => value);
