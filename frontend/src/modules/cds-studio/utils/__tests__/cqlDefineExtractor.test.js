import { extractCardDefinesFromCQL, detectCardDefines } from '../cqlDefineExtractor';

describe('extractCardDefinesFromCQL', () => {
  test('extracts simple string-literal CardSummary and CardDetail', () => {
    const cql = `
      library Foo version '1.0.0'
      using FHIR version '4.0.1'

      define CardSummary:
        'Diabetic retinopathy screening due'

      define CardDetail:
        'Patient is overdue for annual exam'
    `;
    expect(extractCardDefinesFromCQL(cql)).toEqual({
      summary: 'Diabetic retinopathy screening due',
      detail: 'Patient is overdue for annual exam',
    });
  });

  test('returns empty object when neither define is present', () => {
    const cql = `
      library Foo version '1.0.0'
      define Applicability: true
    `;
    expect(extractCardDefinesFromCQL(cql)).toEqual({});
  });

  test('returns only the defines that match', () => {
    const cql = `define CardSummary: 'Just summary'`;
    expect(extractCardDefinesFromCQL(cql)).toEqual({ summary: 'Just summary' });
  });

  test('handles escaped single quotes', () => {
    const cql = `define CardSummary: 'Patient\\'s overdue'`;
    expect(extractCardDefinesFromCQL(cql)).toEqual({ summary: "Patient's overdue" });
  });

  test('skips defines with non-string-literal expressions', () => {
    // Concatenation, conditionals — runtime evaluates these, wizard shouldn't
    // pretend to know the value.
    const cql = `
      define CardSummary:
        'Patient last A1c was ' + ToString(LastA1cValue) + '%'
      define CardDetail:
        if HasSevereDiabetes then 'urgent' else 'routine'
    `;
    expect(extractCardDefinesFromCQL(cql)).toEqual({});
  });

  test('handles empty input gracefully', () => {
    expect(extractCardDefinesFromCQL('')).toEqual({});
    expect(extractCardDefinesFromCQL(null)).toEqual({});
    expect(extractCardDefinesFromCQL(undefined)).toEqual({});
  });

  test('regex state is reset between invocations', () => {
    // Global regex flags carry lastIndex across exec() calls. The extractor
    // must reset it or the second call may miss matches.
    const cql = `define CardSummary: 'X'`;
    expect(extractCardDefinesFromCQL(cql)).toEqual({ summary: 'X' });
    expect(extractCardDefinesFromCQL(cql)).toEqual({ summary: 'X' });
  });
});

describe('detectCardDefines', () => {
  test('tags string-literal defines as literal', () => {
    const cql = `
      define CardSummary: 'fixed text'
      define CardDetail: 'more fixed text'
    `;
    expect(detectCardDefines(cql)).toEqual({
      summary: 'literal',
      detail: 'literal',
    });
  });

  test('tags expression defines as expression', () => {
    // Concatenation, conditionals, function calls — all expressions.
    const cql = `
      define CardSummary:
        'Patient last A1c was ' + ToString(LastA1cValue) + '%'
      define CardDetail:
        if HasSevereDiabetes then 'urgent' else 'routine'
    `;
    expect(detectCardDefines(cql)).toEqual({
      summary: 'expression',
      detail: 'expression',
    });
  });

  test('mix of literal and expression', () => {
    const cql = `
      define CardSummary: 'simple'
      define CardDetail: 'a' + 'b'
    `;
    expect(detectCardDefines(cql)).toEqual({
      summary: 'literal',
      detail: 'expression',
    });
  });

  test('returns empty object when neither define is present', () => {
    const cql = `define Applicability: true`;
    expect(detectCardDefines(cql)).toEqual({});
  });

  test('handles empty input gracefully', () => {
    expect(detectCardDefines('')).toEqual({});
    expect(detectCardDefines(null)).toEqual({});
    expect(detectCardDefines(undefined)).toEqual({});
  });
});
