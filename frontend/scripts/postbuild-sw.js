#!/usr/bin/env node
/**
 * Postbuild step: stamp the service worker with a per-build hash so its
 * cache names change on every deploy.
 *
 * Why this exists: `public/sw.js` ships hardcoded CACHE_NAME values that
 * never change between deploys. Since the SW `activate` handler only
 * deletes caches NOT in {STATIC_CACHE_NAME, API_CACHE_NAME, CACHE_NAME},
 * stale `/static/*.js` entries from prior deploys survive forever and
 * pin the browser to the old bundle (we saw `main.913afc27.js` keep
 * serving after `main.c5926f3a.js` had shipped — required a manual
 * `serviceWorker.getRegistrations().unregister()` to fix).
 *
 * Replacing `__BUILD_HASH__` with an actual per-build value forces all
 * three cache names to change → activate deletes the old caches →
 * next request goes to the network → fresh bundle gets cached.
 *
 * Strategy notes:
 * - Use `git rev-parse --short HEAD` when available (deterministic for a
 *   given commit; useful for CDN debugging).
 * - Fall back to a timestamp if we're not in a git checkout (e.g.
 *   building from a tarball in CI). Still unique-per-build, just less
 *   debuggable.
 * - Always overwrite both build/sw.js (what CRA emits) and we leave
 *   public/sw.js untouched (source-of-truth contains the placeholder).
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const SW_PATH = path.resolve(__dirname, '..', 'build', 'sw.js');
const PLACEHOLDER = '__BUILD_HASH__';

function resolveBuildHash() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (sha) return sha;
  } catch (_e) {
    // Not in a git checkout, or git unavailable — fall back to timestamp.
  }
  return `t${Date.now().toString(36)}`;
}

function main() {
  if (!fs.existsSync(SW_PATH)) {
    console.warn(`[postbuild-sw] ${SW_PATH} not found — skipping. (Did the build run?)`);
    process.exitCode = 0;
    return;
  }

  const source = fs.readFileSync(SW_PATH, 'utf8');
  if (!source.includes(PLACEHOLDER)) {
    console.warn(`[postbuild-sw] no ${PLACEHOLDER} token in build/sw.js — nothing to stamp.`);
    return;
  }

  const hash = resolveBuildHash();
  const stamped = source.replaceAll(PLACEHOLDER, hash);
  fs.writeFileSync(SW_PATH, stamped, 'utf8');
  console.log(`[postbuild-sw] stamped sw.js with build hash ${hash}`);
}

main();
