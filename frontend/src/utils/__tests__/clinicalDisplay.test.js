import {
  cleanNamePart, formatPersonName, formatMrn, formatPatientMrn, getPatientMrnValue,
  formatUnit, formatNumericValue, formatQuantity, formatLabName,
} from '../clinicalDisplay';

describe('names', () => {
  test('strips Synthea digits, keeps real characters', () => {
    expect(cleanNamePart('Laurena366')).toBe('Laurena');
    expect(cleanNamePart("O'Keefe54")).toBe("O'Keefe");
    expect(cleanNamePart('Menéndez746')).toBe('Menéndez');
    expect(cleanNamePart(undefined)).toBe('');
  });

  test('formats from a Patient, a name array or a single name', () => {
    const name = [{ use: 'official', family: 'Rogahn59', given: ['Laurena366', 'Dee1'] }];
    expect(formatPersonName(name)).toBe('Laurena Dee Rogahn');
    expect(formatPersonName(name, 'family-first')).toBe('Rogahn, Laurena Dee');
    expect(formatPersonName({ resourceType: 'Patient', name })).toBe('Laurena Dee Rogahn');
    expect(formatPersonName({ text: 'Dr. Eleni953 Franecki195' })).toBe('Dr. Eleni Franecki');
    expect(formatPersonName(null)).toBe('Unknown');
  });
});

describe('MRN', () => {
  const uuid = '55a86ffa-6273-9cdc-029a-e72c46d5d8fc';
  test('shortens a UUID and leaves a real MRN alone', () => {
    expect(formatMrn(uuid)).toBe('55A86FFA');
    expect(formatMrn('MRN-004512')).toBe('MRN-004512');
    expect(formatMrn(null)).toBe('');
  });
  test('reads the MR identifier, falling back to the id', () => {
    const patient = {
      id: 'abc',
      identifier: [
        { system: 'urn:x:ssn', value: '999-12-3456' },
        { type: { coding: [{ code: 'MR' }] }, value: uuid },
      ],
    };
    expect(getPatientMrnValue(patient)).toBe(uuid);
    expect(formatPatientMrn(patient)).toBe('55A86FFA');
    expect(getPatientMrnValue({ id: 'abc' })).toBe('abc');
  });
});

describe('units and values', () => {
  test('UCUM codes become readable units', () => {
    expect(formatUnit('10*3/uL')).toBe('×10³/µL');
    expect(formatUnit('10*6/uL')).toBe('×10⁶/µL');
    expect(formatUnit('mm[Hg]')).toBe('mmHg');
    expect(formatUnit('Cel')).toBe('°C');
    expect(formatUnit('{score}')).toBe('');
    expect(formatUnit('{beats}/min')).toBe('/min');
    expect(formatUnit('kg/m2')).toBe('kg/m²');
    expect(formatUnit('mg/dL')).toBe('mg/dL');
    expect(formatUnit('ug/mL')).toBe('µg/mL');
    expect(formatUnit(undefined)).toBe('');
  });

  test('numbers are rounded to a usable precision', () => {
    expect(formatNumericValue(5.4976)).toBe('5.5');
    expect(formatNumericValue(138.59)).toBe('139');
    expect(formatNumericValue(22.66)).toBe('22.7');
    expect(formatNumericValue(0.8734)).toBe('0.873');
    expect(formatNumericValue(120)).toBe('120');
    expect(formatNumericValue('n/a')).toBe('n/a');
  });

  test('quantities combine both', () => {
    expect(formatQuantity({ value: 5.4976, unit: '10*3/uL' })).toBe('5.5 ×10³/µL');
    expect(formatQuantity({ value: 3, unit: '{score}' })).toBe('3');
    expect(formatQuantity({ value: 0, unit: 'mg/dL' })).toBe('0 mg/dL');
    expect(formatQuantity(undefined)).toBe('');
  });
});

describe('lab names', () => {
  test('LOINC long names shorten; non-blood specimens are kept', () => {
    expect(formatLabName('Cholesterol [Mass/volume] in Serum or Plasma')).toBe('Cholesterol');
    expect(formatLabName('Carbon dioxide, total [Moles/volume] in Blood')).toBe('Carbon dioxide, total');
    expect(formatLabName('Cholesterol in HDL [Mass/volume] in Serum or Plasma')).toBe('Cholesterol in HDL');
    expect(formatLabName('Glucose [Mass/volume] in Urine by Test strip')).toBe('Glucose, urine');
    expect(formatLabName('Leukocytes [#/volume] in Blood by Automated count')).toBe('Leukocytes');
    expect(formatLabName('Body Weight')).toBe('Body Weight');
    expect(formatLabName('')).toBe('');
  });
});
