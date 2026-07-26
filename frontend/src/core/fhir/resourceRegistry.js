/**
 * Resource-type registry — the ONE place per-resource-type knowledge lives.
 *
 * Before this file, "which resources do we load for a patient, at what
 * priority" existed in 7 hand-maintained copies that had measurably drifted
 * (AllergyIntolerance was critical in one and important in another;
 * Procedure and ImagingStudy silently fell out of one load path entirely),
 * and HAPI's per-resource sort-parameter names were inlined at ~15 call
 * sites (the '-authored-on' vs 'authoredon' class of bug — PR #234 family).
 * See docs/ARCHITECTURE_DEBT.md §F3.
 *
 * Adding a resource type to the platform starts HERE: one entry, and every
 * derived list (patient-bundle tiers, summary set, cache invalidation,
 * websocket subscriptions, sort params) picks it up. Do not add a new
 * hardcoded resource-type array elsewhere — derive from this registry.
 *
 * Fields:
 *   label     human-readable singular display name
 *   tier      patient-bundle load priority: 'critical' | 'important' |
 *             'optional' | null (null = not part of the patient bundle)
 *   summary   included in the Summary-tab batch fetch
 *   sortParam HAPI's REAL search-parameter name for "most recent first".
 *             These are load-bearing: HAPI 400s on invented names
 *             ('-authored-on' is a 400; 'authoredon' is correct).
 */

export const RESOURCE_REGISTRY = {
  // -- critical: first paint of a patient chart ------------------------
  Patient:            { label: 'Patient',            tier: 'critical',  summary: true,  sortParam: null },
  Encounter:          { label: 'Encounter',          tier: 'critical',  summary: true,  sortParam: '-date' },
  Condition:          { label: 'Condition',          tier: 'critical',  summary: true,  sortParam: '-recorded-date' },
  MedicationRequest:  { label: 'Medication Request', tier: 'critical',  summary: true,  sortParam: '-authoredon' },
  AllergyIntolerance: { label: 'Allergy',            tier: 'critical',  summary: true,  sortParam: '-date' },

  // -- important: enrich shortly after first paint ----------------------
  Observation:        { label: 'Observation',        tier: 'important', summary: true,  sortParam: '-date' },
  Procedure:          { label: 'Procedure',          tier: 'important', summary: true,  sortParam: '-date' },
  DiagnosticReport:   { label: 'Diagnostic Report',  tier: 'important', summary: true,  sortParam: '-date' },
  Coverage:           { label: 'Coverage',           tier: 'important', summary: false, sortParam: null },
  DocumentReference:  { label: 'Document',           tier: 'important', summary: false, sortParam: '-date' },

  // -- optional: background fill ----------------------------------------
  Immunization:       { label: 'Immunization',       tier: 'optional',  summary: true,  sortParam: '-date' },
  CarePlan:           { label: 'Care Plan',          tier: 'optional',  summary: false, sortParam: null },
  CareTeam:           { label: 'Care Team',          tier: 'optional',  summary: false, sortParam: null },
  Goal:               { label: 'Goal',               tier: 'optional',  summary: false, sortParam: null },
  ImagingStudy:       { label: 'Imaging Study',      tier: 'optional',  summary: false, sortParam: '-started' },

  // -- not part of the patient bundle, but sort names matter -------------
  ServiceRequest:          { label: 'Order',                     tier: null, summary: false, sortParam: '-authored' },
  MedicationDispense:      { label: 'Dispense',                  tier: null, summary: false, sortParam: '-whenhandedover' },
  MedicationAdministration:{ label: 'Medication Administration', tier: null, summary: false, sortParam: null },
  MedicationStatement:     { label: 'Medication Statement',      tier: null, summary: false, sortParam: null },
};

const entries = Object.entries(RESOURCE_REGISTRY);

/** { critical: [...], important: [...], optional: [...] } — registry order. */
export const TIERED_TYPES = {
  critical:  entries.filter(([, m]) => m.tier === 'critical').map(([t]) => t),
  important: entries.filter(([, m]) => m.tier === 'important').map(([t]) => t),
  optional:  entries.filter(([, m]) => m.tier === 'optional').map(([t]) => t),
};

/**
 * Cumulative type list for a patient-bundle fetch at the given priority —
 * 'critical' loads critical only; 'important' loads critical+important;
 * anything else loads all tiers.
 */
export const typesForPriority = (priority) => {
  if (priority === 'critical') return [...TIERED_TYPES.critical];
  if (priority === 'important') return [...TIERED_TYPES.critical, ...TIERED_TYPES.important];
  return [...TIERED_TYPES.critical, ...TIERED_TYPES.important, ...TIERED_TYPES.optional];
};

/**
 * Every patient-scoped clinical type (all tiers, minus Patient itself).
 * One list for the concerns that used to keep three drifting copies:
 * $everything ownership attribution, per-patient cache invalidation, and
 * websocket update subscriptions.
 */
export const PATIENT_CLINICAL_TYPES = typesForPriority('all').filter((t) => t !== 'Patient');

/** Types the Summary tab's batch fetch loads. */
export const SUMMARY_TYPES = entries.filter(([, m]) => m.summary).map(([t]) => t);

/**
 * HAPI's real "most recent first" sort parameter for a type ('-date'
 * default — correct for most clinical resources).
 */
export const getSortParam = (resourceType) =>
  RESOURCE_REGISTRY[resourceType]?.sortParam ?? '-date';

/** Human-readable label ('Diagnostic Report'), falling back to the type. */
export const getResourceLabel = (resourceType) =>
  RESOURCE_REGISTRY[resourceType]?.label ?? resourceType;
