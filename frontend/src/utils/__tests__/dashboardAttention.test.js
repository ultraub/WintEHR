import { buildAttentionItems, describeToday, findFrequentVisitors, greetingFor } from '../dashboardAttention';

const gaps = { gaps: [
  { measure: 'Mammography', percentage: 7, completed: 2, eligible: 30 },
  { measure: 'Flu Vaccination', percentage: 58, completed: 84, eligible: 145 },
  { measure: 'Colonoscopy', percentage: 85, completed: 17, eligible: 20 },
  { measure: 'Diabetes A1C', percentage: 0, completed: 0, eligible: 0 },
] };

const visit = (patientId, patientName, date, classCode = 'AMB') => ({ patientId, patientName, date, classCode });
const recent = { encounters: [
  visit('p1', 'Mauro Hodkiewicz', '2026-11-14T10:00:00Z'),
  visit('p1', 'Mauro Hodkiewicz', '2026-11-07T10:00:00Z'),
  visit('p1', 'Mauro Hodkiewicz', '2026-10-31T10:00:00Z', 'EMER'),
  visit('p2', 'Noel Eichmann', '2026-10-25T10:00:00Z'),
] };

describe('findFrequentVisitors', () => {
  it('keeps patients with three or more visits and measures the span inclusively', () => {
    expect(findFrequentVisitors(recent.encounters)).toEqual([
      { patientId: 'p1', name: 'Mauro Hodkiewicz', visits: 3, emergency: 1, spanDays: 15 },
    ]);
  });

  it('ignores encounters with no patient', () => {
    expect(findFrequentVisitors([visit(null, 'x', '2026-11-01'), visit(null, 'x', '2026-11-02'), visit(null, 'x', '2026-11-03')])).toEqual([]);
  });
});

describe('buildAttentionItems', () => {
  it('lists only measures far below target; the rest are drawn, not listed', () => {
    const items = buildAttentionItems({ careGaps: gaps });
    expect(items.map((item) => [item.title, item.tone, item.badge])).toEqual([
      ['Mammography at 7%', 'critical', '7%'],
    ]);
    expect(items[0].detail).toBe('28 of 30 eligible patients outstanding');
  });

  it('adds a frequent visitor with a link to that patient', () => {
    const [item] = buildAttentionItems({ recentEncounters: recent });
    expect(item).toMatchObject({
      badge: '3×',
      title: 'Mauro Hodkiewicz',
      detail: '3 visits in 15 days, including 1 emergency admission',
      to: '/patients/p1',
    });
  });

  it('adds polypharmacy only when someone is affected', () => {
    expect(buildAttentionItems({ medicationSafety: { polypharmacy: { count: 0, threshold: 5 } } })).toEqual([]);
    const [item] = buildAttentionItems({ medicationSafety: { polypharmacy: { count: 1, threshold: 5 } } });
    expect(item.title).toBe('1 patient on 5 or more medications');
  });

  it('returns nothing when no data has loaded', () => {
    expect(buildAttentionItems()).toEqual([]);
  });
});

describe('describeToday', () => {
  it('counts every measure under target and names a single frequent visitor', () => {
    expect(describeToday({ careGaps: gaps, recentEncounters: recent }))
      .toBe('2 care measures are below target, and 1 patient has been seen 3 times in 15 days.');
  });

  it('says so when everything is on target', () => {
    expect(describeToday({ careGaps: { gaps: [gaps.gaps[2]] } }))
      .toBe('Every care measure is on target and nothing else needs attention.');
    expect(describeToday()).toBe('Nothing needs attention right now.');
  });
});

describe('greetingFor', () => {
  it('follows the clock', () => {
    expect(greetingFor(new Date(2026, 0, 1, 8))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 0, 1, 12))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 0, 1, 18))).toBe('Good evening');
  });
});
