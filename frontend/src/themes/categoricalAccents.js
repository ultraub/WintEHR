/**
 * Categorical accent scale — ONE hue per clinical domain, everywhere.
 *
 * Replaces three competing accent systems that had drifted apart:
 *   1. the 12 raw-hex nav icon colors in `components/LayoutV3.js`,
 *   2. the per-tab accents in `workspace/clinicalTabRegistry.js`,
 *   3. the Timeline event-type map in `workspace/tabs/TimelineTabModern.js`,
 *      which mixed two palette generations (Tailwind-500s and old
 *      Material Design hexes) in a single map.
 *
 * The hue choices keep the tab-registry values — the most curated set — so
 * the app does not change character. The rule: the same clinical domain or
 * FHIR resource type gets the same hue in the global nav, the workspace tab
 * strip, and the Timeline.
 *
 * Scope: categorical (domain identity) color only. Severity color comes from
 * `clinicalThemeUtils.js`; the dark shell chrome from `shellPalette.js`.
 */

export const categoricalAccents = {
  // --- Workspace tab domains (hues taken verbatim from clinicalTabRegistry) ---
  summary: '#6366F1', // indigo
  chartReview: '#10B981', // emerald
  encounters: '#3B82F6', // blue
  results: '#F59E0B', // amber
  orders: '#8B5CF6', // violet
  administration: '#0EA5E9', // sky
  pharmacy: '#14B8A6', // teal
  imaging: '#EF4444', // red
  documentation: '#78716C', // stone
  carePlan: '#EC4899', // pink
  timeline: '#06B6D4', // cyan
  inbox: '#8B5CF6', // violet (shares the orders hue, as the registry always did)

  // --- App-level nav domains (no workspace tab; hues kept from LayoutV3) ---
  schedule: '#8B5CF6', // violet
  patients: '#06B6D4', // cyan
  analytics: '#EC4899', // pink
  quality: '#F97316', // orange
  careGaps: '#14B8A6', // teal
  fhirExplorer: '#3B82F6', // blue
  cdsStudio: '#A855F7', // purple
  audit: '#EF4444', // red
  settings: '#9CA3AF', // gray

  // --- Resource families without a dedicated tab of their own ---
  // (Chart Review is a composite tab; giving all of its resource types the
  // same emerald would make the Timeline unreadable. These stay in the same
  // Tailwind-500 generation as the registry hues.)
  allergies: '#F43F5E', // rose — alarm character, distinct from imaging red
  immunizations: '#84CC16', // lime — prevention green, distinct from chartReview emerald
  procedures: '#6366F1', // indigo — treatment events (shares the summary hue)
  goals: '#D946EF', // fuchsia — care-planning family, next to carePlan pink
  careTeam: '#A855F7', // purple — care-planning family
  coverage: '#64748B', // slate — administrative
};

/**
 * FHIR resource type → categorical accent.
 *
 * Where a resource type has a dedicated workspace tab, its hue IS that tab's
 * accent (Encounter = Encounters blue, Observation = Results amber, ...).
 * Composite-tab residents (Condition, AllergyIntolerance, Immunization,
 * Procedure) and tab-less types (Coverage) use the resource-family hues above.
 */
export const resourceTypeAccents = {
  Encounter: categoricalAccents.encounters,
  Appointment: categoricalAccents.encounters,
  Observation: categoricalAccents.results,
  DiagnosticReport: categoricalAccents.results,
  MedicationRequest: categoricalAccents.pharmacy,
  MedicationStatement: categoricalAccents.pharmacy,
  MedicationDispense: categoricalAccents.pharmacy,
  MedicationAdministration: categoricalAccents.administration,
  ServiceRequest: categoricalAccents.orders,
  ImagingStudy: categoricalAccents.imaging,
  Media: categoricalAccents.imaging,
  DocumentReference: categoricalAccents.documentation,
  ClinicalImpression: categoricalAccents.documentation,
  CarePlan: categoricalAccents.carePlan,
  Goal: categoricalAccents.goals,
  CareTeam: categoricalAccents.careTeam,
  Condition: categoricalAccents.chartReview,
  AllergyIntolerance: categoricalAccents.allergies,
  Immunization: categoricalAccents.immunizations,
  Procedure: categoricalAccents.procedures,
  Coverage: categoricalAccents.coverage,
};

/** Accent for a FHIR resource type, with a stable indigo fallback. */
export const getResourceTypeAccent = (resourceType) =>
  resourceTypeAccents[resourceType] || categoricalAccents.summary;

export default categoricalAccents;
