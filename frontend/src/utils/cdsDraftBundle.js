/**
 * Build a CDS Hooks 2.0 — compliant draftOrders Bundle and matching
 * `selections` reference strings from a flat array of FHIR resources.
 *
 * The CDS Hooks 2.0 spec (https://cds-hooks.org/hooks/order-select/)
 * requires the order-select context to carry:
 *
 *   - `draftOrders`: a Bundle (type=collection) of in-progress order
 *     resources (ServiceRequest, MedicationRequest, Immunization, …)
 *   - `selections`: a list of references INTO that Bundle, identifying
 *     which entries the clinician is currently focused on. The
 *     reference format is `Bundle/<bundle-id>#<resourceType>/<draft-id>`.
 *
 * For the typical single-pick flow today, `selections` and
 * `draftOrders` are 1:1. The `focusedResources` parameter is provided
 * for future multi-order composition where `selections` is a subset of
 * `draftOrders` — see issue #116 (unified CPOE refactor).
 *
 * @param {Array<object>} resources - FHIR resources to wrap. Each gets
 *   a temporary id assigned (`draft-N`) if one isn't already set.
 * @param {object} [options]
 * @param {Array<object>} [options.focusedResources] - Subset of
 *   `resources` that should appear in `selections`. Defaults to all.
 * @returns {{ draftOrders: object|null, selections: string[] }}
 */
import { v4 as uuidv4 } from 'uuid';

export function buildDraftOrderBundle(resources, { focusedResources } = {}) {
  if (!resources?.length) {
    return { draftOrders: null, selections: [] };
  }

  const bundleId = `cds-draft-${uuidv4()}`;
  const indexed = resources.map((resource, i) => ({
    resource: { ...resource, id: resource.id || `draft-${i + 1}` },
  }));

  const focused = focusedResources || resources;
  const focusedIds = new Set(focused.map((r) => r.id).filter(Boolean));
  const selections = indexed
    .filter(({ resource }, i) => {
      // Match either by reference identity (the original resource
      // object) or by id (in case the caller passed a copy).
      const original = resources[i];
      return focused.includes(original) || focusedIds.has(resource.id);
    })
    .map(({ resource }) =>
      `Bundle/${bundleId}#${resource.resourceType}/${resource.id}`
    );

  return {
    draftOrders: {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'collection',
      entry: indexed,
    },
    selections,
  };
}
