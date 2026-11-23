import { ageInYears, orderConditionsForChart, splitConditionName } from '../clinicalDisplay';

const condition = (display) => ({ code: { coding: [{ display }] } });

describe('splitConditionName', () => {
  it('drops the SNOMED tag and tells a diagnosis from social context', () => {
    expect(splitConditionName('Essential hypertension (disorder)')).toEqual({ name: 'Essential hypertension', kind: 'diagnosis' });
    expect(splitConditionName('Full-time employment (finding)')).toEqual({ name: 'Full-time employment', kind: 'context' });
    expect(splitConditionName('Prediabetes')).toEqual({ name: 'Prediabetes', kind: 'diagnosis' });
    expect(splitConditionName(undefined).name).toBe('Unknown condition');
  });
});

describe('orderConditionsForChart', () => {
  it('puts diagnoses first and reports where the findings begin', () => {
    const { ordered, firstContextIndex } = orderConditionsForChart([
      condition('Stress (finding)'),
      condition('Anemia (disorder)'),
      condition('Limited social contact (finding)'),
      condition('Prediabetes'),
    ]);
    expect(ordered.map((c) => c.code.coding[0].display)).toEqual([
      'Anemia (disorder)', 'Prediabetes', 'Stress (finding)', 'Limited social contact (finding)',
    ]);
    expect(firstContextIndex).toBe(2);
  });

  it('reports -1 when there are no findings', () => {
    expect(orderConditionsForChart([condition('Anemia (disorder)')]).firstContextIndex).toBe(-1);
  });
});

describe('ageInYears', () => {
  const now = new Date('2026-11-23T12:00:00Z');

  it('counts to today for a living patient', () => {
    expect(ageInYears({ birthDate: '1993-11-21' }, now)).toBe(33);
    expect(ageInYears({ birthDate: '1993-11-24' }, now)).toBe(32);
  });

  it('stops at the date of death', () => {
    expect(ageInYears({ birthDate: '1966-03-21', deceasedDateTime: '1997-06-09T10:00:00Z' }, now)).toBe(31);
  });

  it('returns null without a usable birth date', () => {
    expect(ageInYears({}, now)).toBeNull();
    expect(ageInYears({ birthDate: 'not-a-date' }, now)).toBeNull();
  });
});
