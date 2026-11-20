/**
 * Section registry coverage: ids unique, every host is a real tab, Chart
 * Review's builtin sections match the panels its component renders, the
 * strip tabs' sections match their sub-tabs in strip order, and module
 * sections (flowsheets) are first-class entries.
 */

import { CLINICAL_SECTIONS, hostableSections, sectionsForTab } from '../sectionRegistry';
import { TAB_ID_LIST } from '../clinicalTabRegistry';

it('section ids are unique and every host is a registered tab', () => {
  const ids = CLINICAL_SECTIONS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const s of CLINICAL_SECTIONS) expect(TAB_ID_LIST).toContain(s.host);
});

it('Chart Review owns eight builtin sections in render order', () => {
  expect(sectionsForTab('chart-review').map((s) => s.id)).toEqual([
    'conditions', 'medications', 'allergies', 'immunizations', 'procedures', 'care-plans', 'documents', 'encounters',
  ]);
  for (const s of sectionsForTab('chart-review')) expect(s.builtin).toBe(true);
});

it('hostable sections have loaders and include imaging and the flowsheet module', () => {
  const hostable = hostableSections();
  expect(hostable.map((s) => s.id)).toEqual(expect.arrayContaining(['imaging-studies', 'flowsheet']));
  for (const s of hostable) expect(typeof s.loader).toBe('function');
  expect(hostable.find((s) => s.id === 'flowsheet').moduleId).toBe('flowsheets');
  expect(hostable.find((s) => s.id === 'imaging-studies').defaultCollapsed).toBe(true);
});

it('Results, Pharmacy and Care Plan own their sub-tabs as builtin sections in strip order', () => {
  // These lists are the *_VIEWS constants in the tab components: index order
  // is what their tabValue logic keys on, so a change here needs one there.
  expect(sectionsForTab('results').map((s) => s.id)).toEqual(['lab-results', 'vital-signs', 'diagnostic-reports']);
  expect(sectionsForTab('pharmacy').map((s) => s.id)).toEqual([
    'all-medications', 'pending-review', 'ready-to-dispense', 'dispensed', 'refills',
  ]);
  expect(sectionsForTab('care-plan').map((s) => s.id)).toEqual(['care-plan-list', 'care-team', 'goals', 'care-timeline']);
  for (const tab of ['results', 'pharmacy', 'care-plan']) {
    for (const s of sectionsForTab(tab)) expect(s.builtin).toBe(true);
  }
});
