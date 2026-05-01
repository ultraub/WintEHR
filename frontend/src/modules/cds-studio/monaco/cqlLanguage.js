/**
 * Monaco CQL language definition.
 *
 * Registers a "cql" language with syntax highlighting (Monarch tokenizer),
 * comment / bracket configuration, and a small set of completion suggestions
 * for keywords + WintEHR-specific defines (`Applicability`, `CardSummary`,
 * `CardDetail`).
 *
 * Call `registerCQLLanguage(monaco)` once on Monaco load — usually from
 * `<Editor onMount={registerCQLLanguage}>`. Repeat calls are no-ops because
 * Monaco indexes languages by id.
 *
 * Spec reference: https://cql.hl7.org/2024May/19-l-cqlsyntaxdiagrams.html
 *
 * Scope: this is a "good enough" highlighter for student authoring, not a
 * full CQL parser. Heavy lifting (compile errors, type checking) happens
 * server-side via `POST /api/cds-visual-builder/cql/validate`.
 */

const LANGUAGE_ID = 'cql';

// Top-level CQL keywords. Sourced from the CQL grammar; deliberately broad
// so the highlighter feels alive even when students type unusual constructs.
const KEYWORDS = [
  'library', 'using', 'include', 'called',
  'public', 'private', 'parameter', 'codesystem', 'valueset', 'concept', 'code',
  'context', 'define', 'function',
  'if', 'then', 'else', 'case', 'when', 'where', 'with', 'without',
  'from', 'sort', 'asc', 'ascending', 'desc', 'descending',
  'return', 'all', 'distinct',
  'and', 'or', 'xor', 'not', 'implies',
  'true', 'false', 'null',
  'is', 'as', 'cast',
  'between', 'in', 'contains', 'properly',
  'starts', 'ends', 'occurs', 'overlaps',
  'before', 'after', 'on', 'or before', 'or after',
  'same', 'year', 'month', 'week', 'day', 'hour', 'minute', 'second',
  'years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds',
  'exists', 'singleton', 'flatten', 'expand', 'collapse',
  'union', 'intersect', 'except',
  'minimum', 'maximum',
  'difference', 'duration', 'point',
];

// Built-in CQL functions students will use. Tokenized as `predefined` so
// they get a different color than user-defined identifiers.
const BUILTIN_FUNCTIONS = [
  'AgeInYears', 'AgeInMonths', 'AgeInDays',
  'AgeInYearsAt', 'AgeInMonthsAt', 'AgeInDaysAt',
  'CalculateAgeInYears', 'CalculateAgeInMonths',
  'Now', 'Today', 'TimeOfDay',
  'First', 'Last', 'Length', 'Count',
  'Coalesce', 'IsNull', 'ToString', 'ToInteger', 'ToDecimal', 'ToDate', 'ToDateTime',
  'Combine', 'Split', 'Replace', 'Substring', 'Upper', 'Lower',
  'Patient', 'Encounter', 'Practitioner', 'Condition', 'Observation',
  'MedicationRequest', 'MedicationStatement', 'Procedure', 'AllergyIntolerance',
  'DiagnosticReport', 'ServiceRequest', 'CarePlan', 'Goal', 'Immunization',
];

// CQL convention defines that the WintEHR runtime wires into PlanDefinition
// action.condition / dynamicValue. Surfaced separately so they show up in
// completion with helpful documentation.
const CONVENTION_DEFINES = [
  { name: 'Applicability', doc: 'Boolean expression that gates whether the card fires. REQUIRED in every CQL service.' },
  { name: 'CardSummary', doc: 'String. If defined, replaces the card summary at runtime via PlanDefinition.action.dynamicValue.' },
  { name: 'CardDetail', doc: 'String. If defined, replaces the card detail at runtime via PlanDefinition.action.dynamicValue.' },
];

/**
 * Monarch tokenizer — Monaco's built-in highlighting language.
 * https://microsoft.github.io/monaco-editor/monarch.html
 */
const monarch = {
  defaultToken: '',
  tokenPostfix: '.cql',
  ignoreCase: true,

  keywords: KEYWORDS,
  builtinFunctions: BUILTIN_FUNCTIONS,

  symbols: /[=><!~?:&|+\-*/^%]+/, // eslint-disable-line no-useless-escape

  tokenizer: {
    root: [
      // Library/version directive — visually distinct
      [/\b(library)\s+([A-Za-z][A-Za-z0-9_]*)\s+(version)\s+('[^']*')/,
        ['keyword', 'type.identifier', 'keyword', 'string']],

      // Define names — capture and highlight
      [/\b(define)\s+([A-Za-z][A-Za-z0-9_]*)\s*:/,
        ['keyword', 'type.identifier']],

      // Valueset declaration
      [/\b(valueset)\s+("[^"]*")\s*:\s*('[^']*')/,
        ['keyword', 'string', 'string']],

      // Identifiers + keywords
      [/[A-Za-z_$][\w$]*/, {
        cases: {
          '@keywords': 'keyword',
          '@builtinFunctions': 'predefined',
          '@default': 'identifier',
        },
      }],

      // Whitespace + comments
      { include: '@whitespace' },

      // Strings
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/'/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      [/"/, { token: 'string.quote', bracket: '@open', next: '@dstring' }],

      // Numbers
      [/\d+\.\d+([eE][+-]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],

      // Brackets / delimiters
      // eslint-disable-next-line no-useless-escape
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [/@symbols/, 'operator'],
      [/[;,.]/, 'delimiter'],
    ],

    string: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],

    dstring: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],

    whitespace: [
      [/[ \t\r\n]+/, ''],
      [/\/\*/, 'comment', '@comment'], // eslint-disable-line no-useless-escape
      [/\/\/.*$/, 'comment'], // eslint-disable-line no-useless-escape
    ],

    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'], // eslint-disable-line no-useless-escape
      [/[/*]/, 'comment'],
    ],
  },
};

const languageConfig = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [['{', '}'], ['[', ']'], ['(', ')']],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
  ],
};

/**
 * Register the CQL language with the given Monaco instance.
 *
 * Idempotent — Monaco indexes languages by id. Subsequent calls are no-ops
 * (cheap), so this is safe to invoke from every CQLEditor mount.
 */
export function registerCQLLanguage(monaco) {
  if (!monaco || !monaco.languages) return;
  const existing = monaco.languages.getLanguages().find((l) => l.id === LANGUAGE_ID);
  if (existing) return; // already registered

  monaco.languages.register({ id: LANGUAGE_ID, aliases: ['CQL', 'cql'], extensions: ['.cql'] });
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, monarch);
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, languageConfig);

  // Lightweight completion provider — keywords + WintEHR convention defines.
  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions = [
        ...KEYWORDS.map((k) => ({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: k,
          range,
        })),
        ...BUILTIN_FUNCTIONS.map((f) => ({
          label: f,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: f,
          range,
        })),
        ...CONVENTION_DEFINES.map((d) => ({
          label: d.name,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: d.name,
          documentation: { value: d.doc },
          range,
        })),
      ];
      return { suggestions };
    },
  });
}

export const CQL_LANGUAGE_ID = LANGUAGE_ID;
