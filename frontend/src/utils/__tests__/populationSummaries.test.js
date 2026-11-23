import {
  describeAgeStructure,
  describeCohort,
  describeCohortBySex,
  describeConditions,
  describeMedicationBurden,
} from '../populationSummaries';

describe('population summaries', () => {
  it('names the median age and the largest age-sex group', () => {
    expect(describeAgeStructure({
      total: 30,
      median_age: 38,
      pyramid: [{ band: '0-9', female: 6, male: 10 }, { band: '50-59', female: 7, male: 11 }],
    })).toBe('Half of the patients are 38 or younger. The largest group is men aged 50-59 (11).');
  });

  it('says nothing about an empty population', () => {
    expect(describeAgeStructure({ total: 0, pyramid: [] })).toBeNull();
    expect(describeConditions({ patients_with_diagnosis: 0, median_diagnoses_per_patient: 0 }, 0)).toBeNull();
  });

  it('counts patients with a diagnosis against the whole population', () => {
    expect(describeConditions({ patients_with_diagnosis: 83, median_diagnoses_per_patient: 2 }, 112))
      .toBe('83 of 112 patients have at least one active diagnosis; the typical patient has 2.');
  });

  it('compares polypharmacy either side of 60 from the band counts', () => {
    expect(describeMedicationBurden({
      threshold: 5,
      polypharmacy: { patients: 4 },
      burden: [{ bucket: '0', patients: 1 }],
      polypharmacy_by_band: [
        { band: '50-59', patients: 1, of: 10 },
        { band: '60-69', patients: 2, of: 4 },
        { band: '80+', patients: 1, of: 1 },
      ],
    })).toBe('1 patient takes no medication; 4 take 5 or more. That is 60% of patients aged 60 and over, against 10% of those under 60.');
  });

  it('describes a cohort and its split by sex', () => {
    const cohort = {
      patients: 41, share: 36.6, median_age: 59,
      by_gender: [{ gender: 'female', share: 30.2 }, { gender: 'male', share: 42.4 }],
    };
    expect(describeCohort(cohort)).toBe('41 patients · 37% of the population · median age 59');
    expect(describeCohortBySex(cohort)).toBe('30% of women and 42% of men');
    expect(describeCohortBySex({ by_gender: [{ gender: 'male', share: 10 }] })).toBeNull();
  });
});
