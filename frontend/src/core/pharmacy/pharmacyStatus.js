/**
 * Pharmacy workflow status — the single classifier.
 *
 * Three contradictory time-based heuristics used to live in PharmacyTab,
 * PharmacyPage and the backend queue endpoint, silently auto-"verifying"
 * orders nobody had looked at (1h / 1d / 4h rules). This module replaces
 * them with one pure, tested function:
 *
 *   1. Terminal order states win (completed / cancelled / stopped).
 *   2. The pharmacy-status extension (written by
 *      PUT /api/clinical/pharmacy/status/{id}) is the recorded truth.
 *   3. Otherwise the MedicationDispense trail decides.
 *   4. Otherwise the order is 'pending' — deliberately NOT time-based.
 *
 * Modeled on the MAR's `classifyCell` (pure + unit-tested).
 */

import { EXTENSION_URLS } from '../../constants/fhirExtensions';

/** Canonical workflow statuses (in rough lifecycle order). */
export const PHARMACY_WORKFLOW_STATUSES = ['pending', 'verified', 'dispensed', 'ready', 'completed'];

/**
 * Aliases seen in stored extensions (the kanban board historically wrote its
 * own column ids as status strings). Normalized to canonical vocabulary.
 */
const STATUS_ALIASES = {
  verification: 'verified',
  dispensing: 'dispensed',
  neworders: 'pending',
  new: 'pending',
};

/**
 * Read the raw pharmacy-status extension value from a MedicationRequest.
 * Shape (written by the backend): a nested extension under
 * EXTENSION_URLS.PHARMACY_STATUS with a sub-extension {url:'status', valueString}.
 *
 * Returns the raw string (unnormalized) or null.
 */
export function readPharmacyStatusExtension(medicationRequest) {
  for (const ext of medicationRequest?.extension || []) {
    if (ext.url === EXTENSION_URLS.PHARMACY_STATUS) {
      for (const subExt of ext.extension || []) {
        if (subExt.url === 'status' && subExt.valueString) {
          return subExt.valueString;
        }
      }
    }
  }
  return null;
}

/**
 * Derive the canonical pharmacy workflow status for a medication order.
 *
 * @param {object} medicationRequest - FHIR MedicationRequest
 * @param {Array}  dispenses - related FHIR MedicationDispense resources
 * @returns {'pending'|'verified'|'dispensed'|'ready'|'completed'}
 */
export function derivePharmacyStatus(medicationRequest, dispenses = []) {
  const orderStatus = medicationRequest?.status;

  // 1. Terminal order states — nothing left for the pharmacy to do
  if (['completed', 'cancelled', 'stopped', 'entered-in-error'].includes(orderStatus)) {
    return 'completed';
  }

  // 2. Explicitly recorded pharmacy status wins
  const raw = readPharmacyStatusExtension(medicationRequest);
  if (raw) {
    const normalized = STATUS_ALIASES[raw.toLowerCase()] || raw;
    if (PHARMACY_WORKFLOW_STATUSES.includes(normalized)) {
      return normalized;
    }
  }

  // 3. Dispense trail
  if (dispenses.some(d => d.status === 'completed')) {
    return 'dispensed';
  }
  if (dispenses.some(d => d.status === 'in-progress')) {
    return 'verified';
  }

  // 4. Nothing recorded — awaiting pharmacist review. Deliberately not
  //    time-based: elapsed time is not evidence that anyone verified it.
  return 'pending';
}
