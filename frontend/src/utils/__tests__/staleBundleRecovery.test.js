/**
 * Tests for the stale-bundle recovery kill-switch — the fix for browsers
 * pinned to a pre-deploy service worker whose cached index.html references
 * chunks that no longer exist (blank lazy tabs, e.g. the Summary tab after
 * the CRA→Vite cutover).
 */
import { isChunkLoadError, recoverFromStaleBundle } from '../staleBundleRecovery';

const makeDeps = (overrides = {}) => {
  const store = new Map();
  const registration = { unregister: vi.fn().mockResolvedValue(true) };
  return {
    storage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    },
    sw: { getRegistrations: vi.fn().mockResolvedValue([registration]) },
    cacheStore: {
      keys: vi.fn().mockResolvedValue(['medgen-emr-old', 'medgen-static-old']),
      delete: vi.fn().mockResolvedValue(true),
    },
    reload: vi.fn(),
    registration,
    ...overrides,
  };
};

describe('isChunkLoadError', () => {
  it.each([
    ['Vite', new TypeError('Failed to fetch dynamically imported module: http://x/static/js/SummaryTab.abc.js')],
    ['webpack (old bundle)', new Error('Loading chunk 4154 failed.')],
    ['Firefox', new Error('error loading dynamically imported module')],
    ['Safari', new Error('Importing a module script failed.')],
  ])('recognizes %s chunk failures', (_name, err) => {
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isChunkLoadError(new Error('Network Error'))).toBe(false);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'matches')"))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('recoverFromStaleBundle', () => {
  it('unregisters workers, purges caches, and reloads once', async () => {
    const deps = makeDeps();

    const acted = await recoverFromStaleBundle(deps);

    expect(acted).toBe(true);
    expect(deps.registration.unregister).toHaveBeenCalled();
    expect(deps.cacheStore.delete).toHaveBeenCalledTimes(2);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('never loops: the second attempt in a session is a no-op', async () => {
    const deps = makeDeps();

    await recoverFromStaleBundle(deps);
    const second = await recoverFromStaleBundle(deps);

    expect(second).toBe(false);
    expect(deps.reload).toHaveBeenCalledTimes(1); // still just the one reload
  });

  it('still reloads when cleanup partially fails — a broken purge must not strand the user', async () => {
    const deps = makeDeps({
      cacheStore: {
        keys: vi.fn().mockRejectedValue(new Error('cache API unavailable')),
        delete: vi.fn(),
      },
    });

    const acted = await recoverFromStaleBundle(deps);

    expect(acted).toBe(true);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('works without a service worker API (older/locked-down browsers)', async () => {
    const deps = makeDeps({ sw: null, cacheStore: null });

    const acted = await recoverFromStaleBundle(deps);

    expect(acted).toBe(true);
    expect(deps.reload).toHaveBeenCalled();
  });
});
