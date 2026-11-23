import { buildAttentionItems, greetingFor } from '../dashboardAttention';

describe('buildAttentionItems', () => {
  it('lists measures under target, worst first, and skips those on target or with nobody eligible', () => {
    const items = buildAttentionItems({
      careGaps: { gaps: [
        { measure: 'Mammography', percentage: 60, completed: 6, eligible: 10 },
        { measure: 'Flu Vaccination', percentage: 12, completed: 12, eligible: 100 },
        { measure: 'Colonoscopy', percentage: 85, completed: 17, eligible: 20 },
        { measure: 'Diabetes A1C', percentage: 0, completed: 0, eligible: 0 },
      ] },
    });
    expect(items.map((item) => [item.title, item.tone])).toEqual([
      ['Flu Vaccination at 12%', 'critical'],
      ['Mammography at 60%', 'attention'],
    ]);
    expect(items[0].detail).toBe('88 of 100 eligible patients outstanding · target 80%');
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

describe('greetingFor', () => {
  it('follows the clock', () => {
    expect(greetingFor(new Date(2026, 0, 1, 8))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 0, 1, 12))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 0, 1, 18))).toBe('Good evening');
  });
});
