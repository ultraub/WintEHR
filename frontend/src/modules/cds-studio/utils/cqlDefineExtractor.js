/**
 * Extract `define CardSummary: 'literal'` and `define CardDetail: 'literal'`
 * from a CQL source. Returns `{ summary?: string, detail?: string }`.
 *
 * The platform's CQL artifact builder (cql_artifact_builder.py) wires
 * CardSummary/CardDetail defines into PlanDefinition.action.dynamicValue
 * so they override the static action.title/description at $apply time.
 * That means a student who defines CardSummary in CQL doesn't also need
 * to type a static summary into the Card Designer — the CQL value wins
 * at runtime regardless. The wizard uses this extractor to recognize
 * that case and show the CQL value as a read-only preview instead of
 * an empty input.
 *
 * Only matches simple string-literal defines. Complex expressions
 * (concatenation, `if/then/else`, `ToString(...)` calls) are evaluated
 * at $apply time and aren't visible to the wizard preview — that's
 * honest, since the rendered card text depends on patient data the
 * preview doesn't have. Students see the dynamic value in the Test
 * step.
 */

// `define\s+(CardSummary|CardDetail)\s*:\s*'<single-quoted body>'`
// followed by optional whitespace and then either the next `define` keyword
// or end-of-source. The trailing lookahead is what makes "just a string
// literal" meaningfully different from "string-literal followed by
// concatenation/conditional/etc": if there's any non-whitespace token
// after the closing quote (a `+`, `if`, `(`, comment, etc.), the value
// is a complex expression and the wizard preview can't faithfully render
// it — so we don't match. The body permits escaped single quotes (`\'`).
const STRING_LITERAL_DEFINE = /define\s+(CardSummary|CardDetail)\s*:\s*'((?:[^'\\]|\\.)*)'\s*(?=\bdefine\b|$)/g;

export function extractCardDefinesFromCQL(cqlSource) {
  if (!cqlSource) return {};
  const out = {};
  let match;
  // Reset regex state — global regexes carry lastIndex across invocations.
  STRING_LITERAL_DEFINE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((match = STRING_LITERAL_DEFINE.exec(cqlSource)) !== null) {
    const key = match[1] === 'CardSummary' ? 'summary' : 'detail';
    out[key] = match[2].replace(/\\'/g, "'");
  }
  return out;
}
