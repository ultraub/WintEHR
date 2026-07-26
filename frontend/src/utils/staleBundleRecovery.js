/**
 * Stale-bundle recovery — the service-worker kill-switch.
 *
 * Failure mode this ends: a browser whose service worker predates the current
 * deploy serves a cached index.html whose hashed chunks no longer exist on the
 * server. Lazy route/tab chunks then 404 and render nothing (observed on
 * wintehrdev after the CRA→Vite cutover: Chart Review worked from SW cache
 * while the Summary tab's uncached chunk 404'd as
 * /static/js/4154.984aa094.chunk.js — a webpack-era filename).
 *
 * Strategy: the moment a dynamic import fails, assume the bundle is stale —
 * unregister every service worker, delete every cache, and reload ONCE.
 * The sessionStorage guard stops a reload loop when the failure has a
 * different cause (e.g. the server is actually down).
 */

const RECOVERY_FLAG = 'wintehr-sw-recovery-attempted';

const CHUNK_FAILURE_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Vite
  /error loading dynamically imported module/i,   // Firefox wording
  /loading chunk [\w-]+ failed/i,                 // webpack (old bundles)
  /importing a module script failed/i,            // Safari wording
];

export function isChunkLoadError(reason) {
  const message = String((reason && (reason.message || reason)) || '');
  return CHUNK_FAILURE_PATTERNS.some((re) => re.test(message));
}

export async function recoverFromStaleBundle({ storage, sw, cacheStore, reload }) {
  if (storage.getItem(RECOVERY_FLAG)) {
    return false; // already tried this session — don't loop
  }
  storage.setItem(RECOVERY_FLAG, String(Date.now()));

  try {
    if (sw) {
      const registrations = await sw.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if (cacheStore) {
      const keys = await cacheStore.keys();
      await Promise.all(keys.map((k) => cacheStore.delete(k)));
    }
  } catch (error) {
    // Even a partial cleanup is worth the reload — the SW is unregistered
    // or the caches are gone, either breaks the stale pin.
    console.warn('[staleBundleRecovery] cleanup incomplete:', error);
  }

  reload();
  return true;
}

/** Wire the kill-switch to the global chunk-failure signals. */
export function installStaleBundleRecovery({
  storage = window.sessionStorage,
  sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null,
  cacheStore = 'caches' in window ? window.caches : null,
  reload = () => window.location.reload(),
} = {}) {
  const handler = (reason) => {
    if (isChunkLoadError(reason)) {
      recoverFromStaleBundle({ storage, sw, cacheStore, reload });
    }
  };
  window.addEventListener('unhandledrejection', (e) => handler(e.reason));
  // <script>/module-load failures surface as error events, not rejections
  window.addEventListener('error', (e) => handler(e.error || e.message), true);
}
