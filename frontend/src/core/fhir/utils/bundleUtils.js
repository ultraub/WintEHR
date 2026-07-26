/**
 * Bundle normalization — the ONE `entry → resource` mapping.
 *
 * Before this util, ~24 live files each hand-rolled some variant of
 * `result.entry?.map(e => e.resource) || []`, and the variants disagreed
 * about which shapes they tolerated (fhirClient's standardized
 * SearchResult, a raw Bundle, a SearchResult carrying its raw bundle,
 * null). See docs/ARCHITECTURE_DEBT.md opportunity #2.
 *
 * Accepts any of the shapes that circulate in this codebase:
 *   - fhirClient SearchResult: { resources: [...], total, bundle? }
 *   - raw FHIR Bundle:         { entry: [{ resource }, ...] }
 *   - a result wrapping one:   { bundle: { entry: [...] } }
 *   - null / undefined         → []
 *
 * The optional resourceType filter exists because HAPI puts `_include`d
 * resources in the same entry list as the search matches — mapping
 * entries without filtering is how included Medications got filed as
 * MedicationRequests (PR #281). Pass the type you searched for whenever
 * the query had an _include.
 */

export const extractBundleResources = (result, resourceType = null) => {
  if (!result) return [];

  let resources;
  if (Array.isArray(result.resources)) {
    resources = result.resources.filter(Boolean);
  } else {
    const entry = result.entry ?? result.bundle?.entry ?? [];
    resources = entry.map((e) => e?.resource).filter(Boolean);
  }

  return resourceType
    ? resources.filter((r) => r.resourceType === resourceType)
    : resources;
};
