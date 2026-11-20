/**
 * Section registry coverage: ids unique, every host is a real tab, Chart
 * Review's builtin sections match the panels its component renders, and
 * module sections (flowsheets) are first-class entries.
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
