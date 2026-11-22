#!/usr/bin/env node
/**
 * Design ratchet.
 *
 * The codebase still carries hundreds of hardcoded colours and hand-built
 * dialogs from before the shared primitives existed (see frontend/CLAUDE.md,
 * "Shared UI primitives"). They cannot all be fixed at once, and an ESLint
 * rule at error level would fail on every one of them. So instead of a rule,
 * this counts them and fails only when a count goes UP: new code must use
 * theme tokens and DialogFrame, old code can be migrated a file at a time.
 *
 *   node scripts/check-design-ratchet.mjs            check against the baseline
 *   node scripts/check-design-ratchet.mjs --update   write the current counts
 *
 * When you remove some, run --update and commit the lower baseline so the
 * gain cannot be lost again.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');
const baselinePath = join(here, 'design-ratchet.json');

const SOURCE = /\.(js|jsx|ts|tsx)$/;
const SKIP_DIR = /(^|\/)(__tests__|__mocks__|test-utils)(\/|$)/;
const SKIP_FILE = /\.(test|spec)\.(js|jsx|ts|tsx)$/;

const METRICS = {
  // A colour written as a hex literal instead of a theme token. src/themes/
  // is where tokens are defined, so it is the one place they belong.
  hardcodedHexColors: {
    describe: 'hex colour literals outside src/themes/',
    fix: 'use a theme token (theme.palette.*, or a tone from utils/statusDisplay.js)',
    applies: (file) => !file.startsWith('themes/'),
    count: (text) => (text.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![\w-])/g) || []).length,
  },
  // A dialog built directly on MUI's <Dialog> instead of DialogFrame.
  rawDialogFiles: {
    describe: 'files that render MUI <Dialog> directly',
    fix: 'build on components/common/DialogFrame',
    applies: (file) => file !== 'components/common/DialogFrame.jsx',
    count: (text) => (/<Dialog[\s>]/.test(text) ? 1 : 0),
  },
};

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(srcDir, full);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIR.test(`${rel}/`)) walk(full, out);
    } else if (SOURCE.test(name) && !SKIP_FILE.test(name)) {
      out.push(rel);
    }
  }
  return out;
};

const measure = () => {
  const totals = Object.fromEntries(Object.keys(METRICS).map((key) => [key, 0]));
  for (const file of walk(srcDir)) {
    const text = readFileSync(join(srcDir, file), 'utf8');
    for (const [key, metric] of Object.entries(METRICS)) {
      if (metric.applies(file)) totals[key] += metric.count(text);
    }
  }
  return totals;
};

const current = measure();

if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log('design ratchet: baseline written', current);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
} catch (error) {
  console.error(`design ratchet: cannot read ${baselinePath} — run with --update to create it`);
  process.exit(2);
}

let failed = false;
for (const [key, metric] of Object.entries(METRICS)) {
  const now = current[key];
  const was = baseline[key];
  if (typeof was !== 'number') {
    console.error(`design ratchet: baseline has no "${key}" — run with --update`);
    failed = true;
  } else if (now > was) {
    console.error(`design ratchet: ${metric.describe} rose from ${was} to ${now}. New code should ${metric.fix}.`);
    failed = true;
  } else if (now < was) {
    console.log(`design ratchet: ${metric.describe} fell from ${was} to ${now}. Run "npm run lint:design -- --update" and commit the lower baseline.`);
  } else {
    console.log(`design ratchet: ${metric.describe}: ${now} (unchanged)`);
  }
}
process.exit(failed ? 1 : 0);
