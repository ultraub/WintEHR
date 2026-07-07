/**
 * Critical Value Service (R33)
 *
 * The ONE frontend source for lab critical-value thresholds. The table is
 * static reference data served by the backend at
 * GET /api/clinical/critical-values (single source:
 * backend/api/clinical/critical_values.py) and cached here for the lifetime
 * of the page.
 *
 * Every consumer classifies through this service — do not add another
 * hardcoded threshold table. Fail-safe rule: when the table has no entry for
 * a code, or units do not match, classification is null (unknown). Callers
 * must treat null as "no threshold verdict" and fall back to
 * interpretation codes / reference-range display — never invent "critical".
 */

import api from './api';

const CRITICAL_VALUES_URL = '/api/clinical/critical-values';

// Module-level promise cache: one fetch per page load, retried on failure.
let tablePromise = null;
// Synchronous view of the table once loaded (Map keyed by LOINC code).
let tableByLoinc = null;

// Unit spellings that are exactly equivalent — NOT unit conversions.
// (mEq/L === mmol/L only for monovalent ions, which is what the electrolyte
// entries in the table are.)
const UNIT_SYNONYMS = {
  'meq/l': 'mmol/l',
  '10^3/ul': '10*3/ul',
  '10e3/ul': '10*3/ul',
  'k/ul': '10*3/ul',
  'thousand/ul': '10*3/ul',
  'mm[hg]': 'mmhg',
  sec: 's',
};

function normalizeUnit(unit) {
  if (unit === undefined || unit === null) return '';
  const key = String(unit).trim().toLowerCase();
  return UNIT_SYNONYMS[key] || key;
}

/**
 * Strict unit gate — NEVER guess across units.
 * A unitless table entry (INR, pH) accepts a missing unit, UCUM unity ('1'),
 * or a pure annotation like '{INR}'.
 */
function unitsMatch(observationUnit, tableUnit) {
  const table = normalizeUnit(tableUnit);
  const obs = normalizeUnit(observationUnit);
  if (table === '') {
    return obs === '' || obs === '1' || /^\{.*\}$/.test(obs);
  }
  return obs === table;
}

/**
 * Fetch (once) the threshold table from the backend.
 * Resolves to a Map<loinc, entry> where entry is
 * { loinc, label, unit, criticalLow, criticalHigh, low, high }.
 */
export function getCriticalValueTable() {
  if (!tablePromise) {
    tablePromise = api
      .get(CRITICAL_VALUES_URL)
      .then((response) => {
        const entries = response.data?.criticalValues || [];
        tableByLoinc = new Map(entries.map((entry) => [entry.loinc, entry]));
        return tableByLoinc;
      })
      .catch((error) => {
        // Allow a retry on the next call instead of caching the failure
        tablePromise = null;
        throw error;
      });
  }
  return tablePromise;
}

/**
 * Synchronous table lookup. Returns null (and kicks off the fetch in the
 * background) when the table has not loaded yet.
 */
export function getCriticalValueEntrySync(loinc) {
  if (!tableByLoinc) {
    getCriticalValueTable().catch(() => {});
    return null;
  }
  return tableByLoinc.get(loinc) || null;
}

/** Synchronous view of the whole table (Map), or null if not loaded yet. */
export function getCriticalValueTableSync() {
  return tableByLoinc;
}

function classifyAgainstEntry(entry, value, unit) {
  if (!entry) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (!unitsMatch(unit, entry.unit)) return null;

  if (entry.criticalLow !== undefined && entry.criticalLow !== null && value < entry.criticalLow) {
    return 'critical-low';
  }
  if (entry.criticalHigh !== undefined && entry.criticalHigh !== null && value > entry.criticalHigh) {
    return 'critical-high';
  }
  if (entry.low !== undefined && entry.low !== null && value < entry.low) {
    return 'low';
  }
  if (entry.high !== undefined && entry.high !== null && value > entry.high) {
    return 'high';
  }
  return 'normal';
}

/**
 * Classify a lab value against the shared threshold table.
 *
 * @param {string} loinc LOINC code of the test
 * @param {number} value numeric value
 * @param {string} [unit] reported unit — must match the table entry's unit
 * @returns {Promise<'critical-high'|'critical-low'|'high'|'low'|'normal'|null>}
 *          null when the code is unknown or the unit does not match.
 */
export async function classifyValue(loinc, value, unit) {
  const table = await getCriticalValueTable();
  return classifyAgainstEntry(table.get(loinc) || null, value, unit);
}

/**
 * Synchronous variant for render paths. Returns null until the table has
 * loaded (triggering the load in the background) — callers must fall back to
 * reference-range/interpretation display, never assume critical.
 */
export function classifyValueSync(loinc, value, unit) {
  return classifyAgainstEntry(getCriticalValueEntrySync(loinc), value, unit);
}

/** True for the two critical classifications. */
export function isCriticalClassification(classification) {
  return classification === 'critical-low' || classification === 'critical-high';
}

/** Test-only: reset the module-level cache. */
export function __resetCriticalValueTableCache() {
  tablePromise = null;
  tableByLoinc = null;
}
