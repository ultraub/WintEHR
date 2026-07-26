#!/usr/bin/env node
/**
 * find-dead-code.mjs — reachability analyzer for frontend/src.
 *
 * Builds the static import graph over every .js/.jsx/.ts/.tsx file under
 * src/ and reports which files are NOT reachable from the app entry point
 * (src/index.js). Lazy `import('...')` literals count as edges, so the
 * clinicalTabRegistry / router lazy chunks are followed.
 *
 * A file is "dead" when no import chain from the entry point reaches it.
 * Test files never confer liveness (a test of dead code is dead weight, not
 * a consumer) — but tests that import dead modules are listed, because they
 * must be deleted in the same change as the module or vitest will fail on
 * the unresolved import.
 *
 * Safety nets this script provides on top of the graph:
 *  - non-literal dynamic imports (`import(someVar)`) are reported so a human
 *    can rule out string-built module paths before trusting the dead list;
 *  - `--grep-check` additionally scans all LIVE files + html/config for each
 *    dead file's basename, catching string-based references the import
 *    parser can't see (registry keys, eval'd component names, etc.).
 *
 * Usage:
 *   node scripts/find-dead-code.mjs              # summary + dead list
 *   node scripts/find-dead-code.mjs --grep-check # + basename scan (slower)
 *   node scripts/find-dead-code.mjs --json       # machine-readable output
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(FRONTEND, 'src');
const EXTS = ['.js', '.jsx', '.ts', '.tsx'];
const ENTRY = join(SRC, 'index.js');

const argv = process.argv.slice(2);
const GREP_CHECK = argv.includes('--grep-check');
const AS_JSON = argv.includes('--json');

// Unreachable-by-design files adjudicated as preserved future development —
// see docs/ARCHITECTURE_DEBT.md § "Preserved future development". They are
// reported separately so genuine regressions stand out. Remove entries here
// when the feature is wired in (or finally deleted).
const PRESERVED = new Set([
  'src/components/smart/AppCard.js',
  'src/components/smart/SMARTAppLauncher.js',
  'src/components/smart/index.js',
  'src/components/clinical/medications/MedicationListManager.js',
  'src/hooks/medication/useMedicationLists.js',
  'src/hooks/useMedicationLists.js',
  'src/services/MedicationCRUDService.js',
  'src/services/MedicationWorkflowService.js',
  'src/models/cdsService.js', // validation helper for cdsHooksCompliance.test.js
]);

// ---------------------------------------------------------------- collect
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

const allFiles = walk(SRC);
const fileSet = new Set(allFiles);

const isTest = (p) =>
  /(^|\/)__tests__\//.test(p) ||
  /\.(test|spec)\.(js|jsx|ts|tsx)$/.test(p) ||
  p === join(SRC, 'setupTests.js') ||
  p.startsWith(join(SRC, 'test-utils') + sep);

// ---------------------------------------------------------------- parse
// Import specifier forms: static import/export-from, dynamic import('...'),
// require('...'), vi.mock/jest.mock('...').
const SPEC_RE =
  /(?:import|export)\s+[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*(?:\/\*[^*]*\*\/\s*)?['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
const DYNAMIC_NONLITERAL_RE = /import\s*\(\s*(?!['"]|\/\*)/g;

function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else if (spec.startsWith('src/')) base = join(FRONTEND, spec);
  else if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else return null; // bare package import
  if (fileSet.has(base)) return base;
  for (const e of EXTS) if (fileSet.has(base + e)) return base + e;
  for (const e of EXTS) {
    const idx = join(base, 'index' + e);
    if (fileSet.has(idx)) return idx;
  }
  return null; // asset (css/svg/json) or unresolved
}

const edges = new Map(); // file -> Set of imported files
const nonLiteralDynamic = [];
for (const f of allFiles) {
  const src = readFileSync(f, 'utf8');
  const deps = new Set();
  for (const m of src.matchAll(SPEC_RE)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
    const target = resolveSpec(spec, f);
    if (target) deps.add(target);
  }
  if (DYNAMIC_NONLITERAL_RE.test(src)) nonLiteralDynamic.push(f);
  edges.set(f, deps);
}

// ---------------------------------------------------------------- reach
const live = new Set();
const queue = [ENTRY];
if (!existsSync(ENTRY)) throw new Error(`entry not found: ${ENTRY}`);
while (queue.length) {
  const f = queue.pop();
  if (live.has(f)) continue;
  live.add(f);
  for (const dep of edges.get(f) ?? []) if (!live.has(dep)) queue.push(dep);
}

const rel = (p) => relative(FRONTEND, p);
const nonTest = allFiles.filter((f) => !isTest(f));
const unreachable = nonTest.filter((f) => !live.has(f)).sort();
const preserved = unreachable.filter((f) => PRESERVED.has(rel(f)));
const dead = unreachable.filter((f) => !PRESERVED.has(rel(f)));
const deadSet = new Set(dead);

// tests that import dead (or already-deleted) modules must go with them
const orphanTests = allFiles
  .filter(isTest)
  .filter((t) => [...(edges.get(t) ?? [])].some((d) => deadSet.has(d)))
  .sort();

const loc = (p) => readFileSync(p, 'utf8').split('\n').length;
const deadLoc = dead.reduce((n, f) => n + loc(f), 0);

// ---------------------------------------------------------------- grep net
// String-reference scan: a dead file whose basename appears in any live
// file (or html/config) may be referenced dynamically — flag, don't trust.
let flagged = [];
if (GREP_CHECK) {
  const haystacks = [
    ...nonTest.filter((f) => live.has(f)),
    join(FRONTEND, 'index.html'),
    join(FRONTEND, 'vite.config.js'),
    join(FRONTEND, 'package.json'),
  ].filter(existsSync);
  const bodies = haystacks.map((f) => readFileSync(f, 'utf8'));
  for (const d of dead) {
    const name = basename(d).replace(/\.(js|jsx|ts|tsx)$/, '');
    if (name === 'index') continue; // covered by directory-path review
    const needle = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (bodies.some((b) => needle.test(b))) flagged.push(d);
  }
}

// ---------------------------------------------------------------- output
if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        totalNonTest: nonTest.length,
        live: nonTest.length - unreachable.length,
        dead: dead.map(rel),
        preserved: preserved.map(rel),
        deadLoc,
        orphanTests: orphanTests.map(rel),
        nonLiteralDynamicImports: nonLiteralDynamic.map(rel),
        flaggedByGrep: flagged.map(rel),
      },
      null,
      2
    )
  );
} else {
  console.log(`non-test source files : ${nonTest.length}`);
  console.log(`reachable from entry  : ${nonTest.length - unreachable.length}`);
  console.log(`preserved future-dev  : ${preserved.length}  (documented in docs/ARCHITECTURE_DEBT.md)`);
  console.log(`DEAD (unreachable)    : ${dead.length}  (~${deadLoc} LOC)`);
  console.log(`tests importing dead  : ${orphanTests.length}`);
  if (nonLiteralDynamic.length) {
    console.log(`\nfiles with NON-LITERAL dynamic import() — review before trusting:`);
    for (const f of nonLiteralDynamic) console.log(`  ${rel(f)}`);
  }
  if (GREP_CHECK) {
    console.log(`\ndead files whose basename appears in LIVE code (manual review):`);
    for (const f of flagged) console.log(`  ${rel(f)}`);
    if (!flagged.length) console.log('  (none)');
  }
  console.log('\n--- dead files ---');
  for (const f of dead) console.log(rel(f));
  console.log('\n--- orphan tests (delete with their modules) ---');
  for (const f of orphanTests) console.log(rel(f));
}
