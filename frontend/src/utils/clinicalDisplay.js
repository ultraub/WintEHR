/**
 * Display formatters: turn stored FHIR/Synthea values into what a person
 * should read. One place, so every screen agrees.
 *
 * These change presentation only. Never write a formatted value back to a
 * resource, and never use one as an identifier or search key.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------------------------------------------------------------- names */

/** Synthea appends digits to every name part ("Laurena366"). Drop them. */
export const cleanNamePart = (part) =>
  typeof part === 'string' ? part.replace(/(\p{L})\d+/gu, '$1').trim() : '';

const pickName = (nameOrPatient) => {
  const names = nameOrPatient?.resourceType === 'Patient' ? nameOrPatient.name : nameOrPatient;
  if (!names) return null;
  if (!Array.isArray(names)) return names;
  return names.find((n) => n.use === 'official') || names[0] || null;
};

/**
 * @param nameOrPatient a Patient, a HumanName, or HumanName[]
 * @param order 'given-first' ("Laurena Rogahn") or 'family-first' ("Rogahn, Laurena")
 */
export const formatPersonName = (nameOrPatient, order = 'given-first') => {
  const name = pickName(nameOrPatient);
  if (!name) return 'Unknown';
  const given = (name.given || []).map(cleanNamePart).filter(Boolean).join(' ');
  const family = cleanNamePart(name.family);
  if (!given && !family) return cleanNamePart(name.text) || 'Unknown';
  if (order === 'family-first') return [family, given].filter(Boolean).join(', ');
  return [given, family].filter(Boolean).join(' ');
};

/* ------------------------------------------------------------------ MRN */

/**
 * Synthea's medical record number is a UUID. Show its first block, upper-cased
 * ("55A86FFA"); real-looking MRNs pass through untouched.
 */
export const formatMrn = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value);
  return UUID_RE.test(text) ? text.slice(0, 8).toUpperCase() : text;
};

/** The patient's MRN identifier value (unformatted), falling back to the id. */
export const getPatientMrnValue = (patient) => {
  if (!patient) return '';
  const identifiers = patient.identifier || [];
  const mr = identifiers.find(
    (id) => id.type?.coding?.some((c) => c.code === 'MR') || /mrn/i.test(id.system || '')
  );
  return mr?.value || patient.id || '';
};

export const formatPatientMrn = (patient) => formatMrn(getPatientMrnValue(patient));

/* ---------------------------------------------------------------- units */

const UNIT_MAP = {
  'mm[Hg]': 'mmHg',
  Cel: '°C',
  '[degF]': '°F',
  'kg/m2': 'kg/m²',
  '[in_i]': 'in',
  '[ft_i]': 'ft',
  '[lb_av]': 'lb',
  '[oz_av]': 'oz',
  '[pH]': '',
  '[IU]/L': 'IU/L',
  '[iU]/L': 'IU/L',
  'm[IU]/L': 'mIU/L',
  'u[IU]/mL': 'µIU/mL',
  'mL/min/{1.73_m2}': 'mL/min/1.73 m²',
  'mL/min/1.73m2': 'mL/min/1.73 m²',
  '/min': '/min',
  '1': '',
};

const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/**
 * UCUM code → readable unit. "10*3/uL" → "×10³/µL", "mm[Hg]" → "mmHg",
 * "{score}" → "". Unknown units pass through with only the safe generic
 * cleanups, so an unfamiliar unit is never silently changed in meaning.
 */
export const formatUnit = (unit) => {
  if (unit === null || unit === undefined) return '';
  const raw = String(unit).trim();
  if (raw in UNIT_MAP) return UNIT_MAP[raw];
  return raw
    // curly-brace annotations carry no dimension: {score}, {beats}/min
    .replace(/\{[^}]*\}/g, '')
    // powers of ten: 10*3 → ×10³
    .replace(/10\*(\d+)/g, (_, exp) => `×10${[...exp].map((d) => SUPERSCRIPT[d]).join('')}`)
    // micro prefix
    .replace(/(^|\/)u(L|g|mol|m|s|IU)\b/g, '$1µ$2')
    .replace(/^\/+$/, '')
    .trim();
};

/* --------------------------------------------------------------- values */

/**
 * Numbers at the precision a reader can use: 5.4976 → 5.5, 138.59 → 139,
 * 0.8734 → 0.87. Integers and non-numbers pass through. Display only.
 */
export const formatNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Number.isInteger(n)) return String(n);
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  return String(Number(n.toFixed(digits)));
};

/** FHIR Quantity → "5.5 ×10³/µL". Empty string when there is no value. */
export const formatQuantity = (quantity) => {
  if (!quantity || quantity.value === undefined || quantity.value === null) return '';
  const unit = formatUnit(quantity.unit ?? quantity.code);
  const value = formatNumericValue(quantity.value);
  return unit ? `${value} ${unit}` : value;
};

/* ------------------------------------------------------------ lab names */

const DEFAULT_SPECIMENS = /^(serum or plasma|serum, plasma or blood|serum|plasma|blood|arterial blood|venous blood|capillary blood)$/i;

/**
 * LOINC long name → the short name a clinician says.
 * "Cholesterol [Mass/volume] in Serum or Plasma" → "Cholesterol";
 * "Glucose [Mass/volume] in Urine by Test strip" → "Glucose, urine".
 * Blood-family specimens are dropped as the default; anything else is kept
 * because it changes what the test means.
 */
export const formatLabName = (display) => {
  if (typeof display !== 'string' || !display.trim()) return '';
  const text = display.trim();
  // LOINC long names put the property in brackets, then the specimen, then
  // the method: "<analyte> [<property>] in <specimen> by <method>". Names
  // without the bracket are not LOINC long names and are left alone, because
  // an "in" there belongs to the analyte itself.
  const match = text.match(/^(.*?)\s*\[[^\]]*\]\s*(?:in\s+(.+?))?(?:\s+by\s+.+)?$/i);
  if (!match) return text;
  const analyte = match[1].trim();
  const specimen = (match[2] || '').trim();
  const name = !specimen || DEFAULT_SPECIMENS.test(specimen)
    ? analyte
    : `${analyte}, ${specimen.toLowerCase()}`;
  return name.replace(/\s{2,}/g, ' ').trim() || text;
};

/* ------------------------------------------------------------ Conditions */

// SNOMED display names end with a semantic tag: "Stress (finding)".
const SEMANTIC_TAG = /\s*\(([a-z /]+)\)\s*$/;
// Tags that describe circumstances rather than a diagnosis. Synthea records
// employment, education and housing as Conditions.
const CONTEXT_TAGS = new Set(['finding', 'situation', 'person', 'social concept', 'event', 'observable entity']);

/**
 * "Essential hypertension (disorder)" -> { name: "Essential hypertension", kind: "diagnosis" }
 * "Full-time employment (finding)"    -> { name: "Full-time employment", kind: "context" }
 * Mirrors backend/api/analytics/service.py `split_condition_name`.
 */
export const splitConditionName = (display) => {
  const text = (display || '').trim();
  const match = SEMANTIC_TAG.exec(text);
  if (!match) return { name: text || 'Unknown condition', kind: 'diagnosis' };
  const name = text.slice(0, match.index).trim() || text;
  return { name, kind: CONTEXT_TAGS.has(match[1]) ? 'context' : 'diagnosis' };
};

/** Diagnoses first, then social and other findings; order is otherwise kept. */
export const orderConditionsForChart = (conditions = []) => {
  const displayOf = (c) => c?.code?.text || c?.code?.coding?.[0]?.display;
  const diagnoses = [];
  const context = [];
  conditions.forEach((condition) => {
    (splitConditionName(displayOf(condition)).kind === 'context' ? context : diagnoses).push(condition);
  });
  return { ordered: [...diagnoses, ...context], firstContextIndex: context.length ? diagnoses.length : -1 };
};

/* ------------------------------------------------------------------- Age */

/**
 * A patient's age in whole years: to today for the living, to the date of
 * death for the deceased (a patient who died at 31 is not 60).
 * Returns null when the birth date is missing or unreadable.
 */
export const ageInYears = (patient, now = new Date()) => {
  const birth = patient?.birthDate ? new Date(patient.birthDate) : null;
  if (!birth || Number.isNaN(birth.getTime())) return null;
  const died = patient?.deceasedDateTime ? new Date(patient.deceasedDateTime) : null;
  const until = died && !Number.isNaN(died.getTime()) ? died : now;
  let years = until.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = until.getUTCMonth() < birth.getUTCMonth()
    || (until.getUTCMonth() === birth.getUTCMonth() && until.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years -= 1;
  return Math.max(0, years);
};
