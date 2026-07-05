/**
 * Tests for the single pharmacy-status classifier.
 * Pins the precedence: terminal order state > recorded extension >
 * dispense trail > pending (never time-based).
 */

import {
  derivePharmacyStatus,
  readPharmacyStatusExtension,
  PHARMACY_WORKFLOW_STATUSES,
} from '../pharmacyStatus';
import { EXTENSION_URLS } from '../../../constants/fhirExtensions';

const withExtension = (status) => ({
  resourceType: 'MedicationRequest',
  status: 'active',
  extension: [{
    url: EXTENSION_URLS.PHARMACY_STATUS,
    extension: [
      { url: 'status', valueString: status },
      { url: 'lastUpdated', valueDateTime: '2026-07-01T00:00:00Z' },
    ],
  }],
});

describe('readPharmacyStatusExtension', () => {
  it('reads the nested status sub-extension', () => {
    expect(readPharmacyStatusExtension(withExtension('verified'))).toBe('verified');
  });

  it('returns null when absent, on wrong URL, or on empty input', () => {
    expect(readPharmacyStatusExtension({ status: 'active' })).toBeNull();
    expect(readPharmacyStatusExtension({
      extension: [{ url: 'http://example.org/other', extension: [{ url: 'status', valueString: 'x' }] }],
    })).toBeNull();
    expect(readPharmacyStatusExtension(null)).toBeNull();
  });
});

describe('derivePharmacyStatus', () => {
  it('terminal order states always win', () => {
    for (const s of ['completed', 'cancelled', 'stopped', 'entered-in-error']) {
      expect(derivePharmacyStatus({ status: s })).toBe('completed');
      // ...even over a recorded extension
      expect(derivePharmacyStatus({ ...withExtension('verified'), status: s })).toBe('completed');
    }
  });

  it('a recorded extension beats the dispense trail', () => {
    const dispenses = [{ status: 'completed' }];
    expect(derivePharmacyStatus(withExtension('verified'), dispenses)).toBe('verified');
  });

  it('normalizes legacy kanban column ids written as statuses', () => {
    expect(derivePharmacyStatus(withExtension('verification'))).toBe('verified');
    expect(derivePharmacyStatus(withExtension('dispensing'))).toBe('dispensed');
    expect(derivePharmacyStatus(withExtension('newOrders'))).toBe('pending');
  });

  it('ignores unrecognized extension values and falls through', () => {
    expect(derivePharmacyStatus(withExtension('garbage-status'), [{ status: 'in-progress' }]))
      .toBe('verified');
  });

  it('derives from the dispense trail when nothing is recorded', () => {
    const active = { status: 'active' };
    expect(derivePharmacyStatus(active, [{ status: 'completed' }])).toBe('dispensed');
    expect(derivePharmacyStatus(active, [{ status: 'in-progress' }])).toBe('verified');
  });

  it('is pending when nothing is recorded — regardless of order age', () => {
    // The old heuristics auto-"verified" orders after 1h/1d. Age is not
    // evidence of review.
    expect(derivePharmacyStatus({ status: 'active', authoredOn: '2020-01-01T00:00:00Z' })).toBe('pending');
    expect(derivePharmacyStatus({ status: 'active' }, [])).toBe('pending');
  });

  it('only ever returns canonical statuses', () => {
    const cases = [
      derivePharmacyStatus({ status: 'completed' }),
      derivePharmacyStatus(withExtension('dispensing')),
      derivePharmacyStatus({ status: 'active' }, [{ status: 'completed' }]),
      derivePharmacyStatus({ status: 'active' }),
    ];
    for (const result of cases) {
      expect(PHARMACY_WORKFLOW_STATUSES).toContain(result);
    }
  });
});
