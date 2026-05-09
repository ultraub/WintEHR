/**
 * Extract `define CardSummary:` / `define CardDetail:` info from a CQL
 * source. Two related functions:
 *
 *   extractCardDefinesFromCQL(cql) → { summary?: string, detail?: string }
 *     Only literal-string defines. Returns the unquoted body. Used to
 *     show the CQL value as a read-only preview when the value is
 *     statically knowable.
 *
 *   detectCardDefines(cql) → { summary?: 'literal'|'expression',
 *                              detail?:  'literal'|'expression' }
 *     Detects whether each define exists at all and what kind it is.
 *     Used to lock the corresponding form field even for expression
 *     defines — those still override the static card_config at $apply
 *     time, so a student typing a static summary while the CQL has a
 *     CardSummary expression sees their text silently ignored at
 *     runtime. The form should make that visible (read-only with a
 *     "computed by CQL — edit there" hint) instead of pretending the
 *     input is meaningful.
 *
 * The platform's CQL artifact builder (cql_artifact_builder.py) wires
 * CardSummary/CardDetail defines into PlanDefinition.action.dynamicValue
 * so the CQL value always wins over card_config at $apply time.
 */

// `define\s+(CardSummary|CardDetail)\s*:\s*'<single-quoted body>'`
// followed by optional whitespace and then either the next `define` keyword
// or end-of-source. The trailing lookahead is what makes "just a string
// literal" meaningfully different from "string-literal followed by
// concatenation/conditional/etc": if there's any non-whitespace token
// after the closing quote (a `+`, `if`, `(`, comment, etc.), the value
// is a complex expression and the wizard preview can't faithfully render
// it — so we don't match here. The body permits escaped single quotes (`\'`).
const STRING_LITERAL_DEFINE = /define\s+(CardSummary|CardDetail)\s*:\s*'((?:[^'\\]|\\.)*)'\s*(?=\bdefine\b|$)/g;

// Looser pattern that just detects whether a `define CardSummary` /
// `define CardDetail` exists at all, regardless of body shape. Used in
// combination with the literal extractor: literal → show value;
// matched here but not by literal extractor → expression.
const ANY_CARD_DEFINE = /define\s+(CardSummary|CardDetail)\s*:/g;

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

export function detectCardDefines(cqlSource) {
  if (!cqlSource) return {};
  const literals = extractCardDefinesFromCQL(cqlSource);
  const out = {};
  let match;
  ANY_CARD_DEFINE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((match = ANY_CARD_DEFINE.exec(cqlSource)) !== null) {
    const key = match[1] === 'CardSummary' ? 'summary' : 'detail';
    if (out[key]) continue; // first definition wins (CQL itself rejects duplicates)
    out[key] = literals[key] !== undefined ? 'literal' : 'expression';
  }
  return out;
}
