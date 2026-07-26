/**
 * Contracts for the canonical bundle normalization (opportunity #2).
 */

import { extractBundleResources } from '../bundleUtils';

const obs = { resourceType: 'Observation', id: 'o1' };
const med = { resourceType: 'Medication', id: 'm1' };
const req = { resourceType: 'MedicationRequest', id: 'r1' };

describe('extractBundleResources', () => {
  it('maps a raw Bundle', () => {
    expect(extractBundleResources({ entry: [{ resource: obs }, { resource: med }] }))
      .toEqual([obs, med]);
  });

  it('passes through a fhirClient SearchResult', () => {
    expect(extractBundleResources({ resources: [obs], total: 1 })).toEqual([obs]);
  });

  it('unwraps a result carrying its raw bundle', () => {
    expect(extractBundleResources({ bundle: { entry: [{ resource: obs }] } }))
      .toEqual([obs]);
  });

  it('tolerates null, empty, and holey inputs', () => {
    expect(extractBundleResources(null)).toEqual([]);
    expect(extractBundleResources({})).toEqual([]);
    expect(extractBundleResources({ entry: [{}, { resource: obs }, null] })).toEqual([obs]);
  });

  it('resourceType filter separates search matches from _include entries (PR #281 class)', () => {
    const bundle = { entry: [{ resource: req }, { resource: med }] };
    expect(extractBundleResources(bundle, 'MedicationRequest')).toEqual([req]);
    expect(extractBundleResources(bundle, 'Medication')).toEqual([med]);
  });
});
