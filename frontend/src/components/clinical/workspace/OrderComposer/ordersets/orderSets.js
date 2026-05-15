/**
 * Pre-defined order-set templates for the Order Composer (#116, Phase 4.3).
 *
 * Each order set is a curated bundle of drafts that gets pushed into
 * the composer's draft list in one click. Real EHRs build hundreds of
 * these (sepsis bundles, admission orders, post-op recipes, condition-
 * specific protocols). Students see the *pattern*: how a clinical
 * protocol decomposes into a coherent bundle of FHIR resources that
 * can fire together through the cross-order CDS pipeline.
 *
 * Structure: each set has metadata + a `build(patientId)` function
 * that returns an array of FHIR resource templates. Templates omit
 * `subject`/`patient` — those are filled by `OrderSetSelector.applyOrderSet`
 * so the templates stay patient-agnostic and reusable.
 *
 * What's intentionally NOT here:
 * - Conditional logic (e.g. "skip ceftriaxone if PCN allergic"). Real
 *   order sets carry conditional templates; teaching that pattern
 *   requires the PlanDefinition resource and is out of scope for
 *   Phase 4.3.
 * - Patient-specific dosing (e.g. weight-based fluid resuscitation).
 *   Students adjust dose/duration in the right pane before signing.
 */

const RXNORM = 'http://www.nlm.nih.gov/research/umls/rxnorm';
const LOINC = 'http://loinc.org';
const SNOMED = 'http://snomed.info/sct';

const LAB_CATEGORY = { system: SNOMED, code: '108252007', display: 'Laboratory procedure' };
const IMAGING_CATEGORY = { system: SNOMED, code: '363679005', display: 'Imaging' };
const NURSING_CATEGORY = { system: SNOMED, code: '103735009', display: 'Nursing diagnostic procedure' };

function sr({ code, display, codeSystem = LOINC, category, indication, priority = 'routine' }) {
  return {
    resourceType: 'ServiceRequest',
    status: 'draft',
    intent: 'order',
    priority,
    authoredOn: new Date().toISOString(),
    category: [{ coding: [category] }],
    code: {
      coding: [{ system: codeSystem, code, display }],
      text: display,
    },
    ...(indication ? { reasonCode: [{ text: indication }] } : {}),
  };
}

function med({ code, display, doseQty, doseUnit = 'mg', route = 'IV', frequencyText = 'once', indication, priority = 'routine' }) {
  return {
    resourceType: 'MedicationRequest',
    status: 'draft',
    intent: 'order',
    priority,
    authoredOn: new Date().toISOString(),
    medicationCodeableConcept: {
      coding: [{ system: RXNORM, code, display }],
      text: display,
    },
    dosageInstruction: [{
      text: `${doseQty} ${doseUnit} ${route} ${frequencyText}`,
      route: { text: route },
      doseAndRate: [{ doseQuantity: { value: parseFloat(doseQty), unit: doseUnit } }],
    }],
    ...(indication ? { reasonCode: [{ text: indication }] } : {}),
  };
}

function nursing({ instruction, frequencyLabel = '', priority = 'routine' }) {
  return {
    resourceType: 'ServiceRequest',
    status: 'draft',
    intent: 'order',
    priority,
    authoredOn: new Date().toISOString(),
    category: [{ coding: [NURSING_CATEGORY] }],
    code: { text: instruction },
    ...(frequencyLabel ? { patientInstruction: frequencyLabel } : {}),
  };
}

export const ORDER_SETS = [
  {
    id: 'sepsis-early',
    name: 'Sepsis — Early Resuscitation Bundle',
    description:
      'Within-hour-1 bundle: cultures before antibiotics, broad-spectrum coverage, '
      + 'lactate trend, and aggressive crystalloid resuscitation.',
    tags: ['emergency', 'icu', 'critical-care'],
    build: () => [
      sr({ code: '600-7', display: 'Bacterial culture, blood (set #1)', category: LAB_CATEGORY,
        indication: 'Suspected sepsis', priority: 'stat' }),
      sr({ code: '600-7', display: 'Bacterial culture, blood (set #2)', category: LAB_CATEGORY,
        indication: 'Suspected sepsis', priority: 'stat' }),
      sr({ code: '2524-7', display: 'Lactate, plasma', category: LAB_CATEGORY,
        indication: 'Suspected sepsis — perfusion assessment', priority: 'stat' }),
      sr({ code: '58410-2', display: 'Complete blood count with differential', category: LAB_CATEGORY,
        indication: 'Suspected sepsis', priority: 'stat' }),
      sr({ code: '24323-8', display: 'Comprehensive metabolic panel', category: LAB_CATEGORY,
        indication: 'Suspected sepsis — organ function', priority: 'stat' }),
      med({ code: '197517', display: 'Ceftriaxone 2000 MG Injection', doseQty: '2', doseUnit: 'g',
        route: 'IV', frequencyText: 'q24h', indication: 'Empiric broad-spectrum coverage for sepsis',
        priority: 'stat' }),
      med({ code: '313002', display: '0.9% Sodium Chloride 1000 ML Injection', doseQty: '30',
        doseUnit: 'mL/kg', route: 'IV', frequencyText: 'bolus over 30 min',
        indication: 'Septic shock resuscitation', priority: 'stat' }),
      nursing({ instruction: 'Vital signs every 15 minutes', frequencyLabel: 'q15min x 2h, then q30min',
        priority: 'stat' }),
      nursing({ instruction: 'Strict intake and output', frequencyLabel: 'Track hourly UOP',
        priority: 'urgent' }),
    ],
  },
  {
    id: 'admission-dm',
    name: 'Diabetes Admission Orders',
    description:
      'Standard admission set for a patient with type 2 diabetes: glucose surveillance, '
      + 'A1C trend, basal-correctional insulin pattern, and diabetic diet.',
    tags: ['admission', 'medicine', 'endocrine'],
    build: () => [
      sr({ code: '4548-4', display: 'Hemoglobin A1c [%]', category: LAB_CATEGORY,
        indication: 'DM control assessment' }),
      sr({ code: '24323-8', display: 'Comprehensive metabolic panel', category: LAB_CATEGORY,
        indication: 'Baseline metabolic state' }),
      sr({ code: '14959-1', display: 'Urine microalbumin/creatinine ratio', category: LAB_CATEGORY,
        indication: 'Diabetic nephropathy screening' }),
      med({ code: '5856', display: 'Insulin glargine 100 UNT/ML Injection', doseQty: '20',
        doseUnit: 'units', route: 'SC', frequencyText: 'qHS',
        indication: 'Basal insulin coverage' }),
      med({ code: '253182', display: 'Insulin lispro 100 UNT/ML Injection', doseQty: '4',
        doseUnit: 'units', route: 'SC', frequencyText: 'AC and correctional per sliding scale',
        indication: 'Prandial + correctional insulin' }),
      nursing({ instruction: 'Glucose checks AC + HS', frequencyLabel: 'Fingerstick before meals and at bedtime' }),
      nursing({ instruction: 'Daily weights', frequencyLabel: 'Same time, same scale' }),
    ],
  },
  {
    id: 'chest-pain-acs-rule-out',
    name: 'Chest Pain — ACS Rule-Out',
    description:
      'Working up undifferentiated chest pain: serial troponins, ECG, CXR, '
      + 'baseline labs, and ASA/heparin if appropriate.',
    tags: ['emergency', 'cardiology'],
    build: () => [
      sr({ code: '67151-1', display: 'Troponin I, high-sensitivity', category: LAB_CATEGORY,
        indication: 'ACS rule-out — baseline', priority: 'stat' }),
      sr({ code: '67151-1', display: 'Troponin I, high-sensitivity (3h repeat)', category: LAB_CATEGORY,
        indication: 'ACS rule-out — 3h repeat', priority: 'urgent' }),
      sr({ code: '34534-8', display: '12-lead ECG', category: LAB_CATEGORY,
        indication: 'ACS rule-out', priority: 'stat' }),
      sr({ code: '71020', display: 'Chest X-ray, 2 views', codeSystem: LOINC,
        category: IMAGING_CATEGORY, indication: 'Evaluate for alternative chest pain etiology',
        priority: 'urgent' }),
      sr({ code: '58410-2', display: 'Complete blood count with differential', category: LAB_CATEGORY,
        indication: 'Baseline labs' }),
      sr({ code: '24323-8', display: 'Comprehensive metabolic panel', category: LAB_CATEGORY,
        indication: 'Baseline labs' }),
      med({ code: '1191', display: 'Aspirin 325 MG Oral Tablet', doseQty: '325',
        doseUnit: 'mg', route: 'PO', frequencyText: 'once now (chew)',
        indication: 'Empiric ASA for possible ACS', priority: 'stat' }),
      nursing({ instruction: 'Continuous cardiac telemetry',
        frequencyLabel: 'Continuous ECG, document rhythm q shift', priority: 'urgent' }),
    ],
  },
];

/**
 * Look up an order set by id.
 */
export function getOrderSet(id) {
  return ORDER_SETS.find((s) => s.id === id) || null;
}
