/**
 * Regression test for the patient-summary CDS latency bug.
 *
 * Before the fix, `firePatientView` (and its medication-prescribe /
 * order-sign siblings) iterated services with `for ... of` + `await`
 * inside, serializing N CDS service calls into wall = sum(durations).
 * On a chart with 12 patient-view services that turned a ~3s slowest
 * CQL evaluation into a ~20s user-visible delay before all alerts
 * landed.
 *
 * These tests pin the parallel behavior: services are dispatched
 * concurrently, one slow/failing service doesn't starve the rest, and
 * card ordering still matches the input service list so on-screen
 * placement is stable.
 */
// axios v1.x ships ESM and isn't transformed by the project's jest
// config; mock it before the cdsHooksClient module loads. The tests
// stub `executeHook` directly via spyOn, so the underlying HTTP client
// is never exercised — the mock just needs to satisfy the import +
// `axios.create({...})` call at module load.
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    }),
  },
  create: () => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  }),
}));

jest.mock('../cdsPrefetchResolver', () => ({
  cdsPrefetchResolver: {
    resolvePrefetchTemplates: jest.fn().mockResolvedValue(null),
    buildCommonPrefetch: jest.fn().mockResolvedValue(null),
  },
}));

const CDSHooksClient = require('../cdsHooksClient').default;

const makeService = (id, opts = {}) => ({
  id,
  hook: opts.hook || 'patient-view',
  title: `Service ${id}`,
  prefetch: {},
  ...opts,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CDSHooksClient — parallel hook dispatch', () => {
  let client;

  beforeEach(() => {
    client = new CDSHooksClient();
    jest.useRealTimers();
  });

  describe('firePatientView', () => {
    it('dispatches all services in parallel (wall ≈ max, not sum)', async () => {
      const services = [
        makeService('slow-a'),
        makeService('slow-b'),
        makeService('slow-c'),
      ];
      jest.spyOn(client, 'discoverServices').mockResolvedValue(services);

      const PER_CALL_MS = 120;
      jest.spyOn(client, 'executeHook').mockImplementation(async (serviceId) => {
        await sleep(PER_CALL_MS);
        return { cards: [{ summary: `card-${serviceId}` }] };
      });

      const t0 = Date.now();
      const cards = await client.firePatientView('p1', 'u1');
      const elapsed = Date.now() - t0;

      expect(cards).toHaveLength(3);
      // Sequential would be ≥ N * PER_CALL_MS = 360ms. Parallel should
      // finish near PER_CALL_MS (give generous slack for slow CI / Node
      // event loop noise — anything well under sum-of-durations proves
      // concurrency).
      expect(elapsed).toBeLessThan(PER_CALL_MS * services.length - 50);
    });

    it('returns cards from successful services even if others reject', async () => {
      const services = [
        makeService('ok-1'),
        makeService('rejecting'),
        makeService('ok-2'),
      ];
      jest.spyOn(client, 'discoverServices').mockResolvedValue(services);
      jest.spyOn(client, 'executeHook').mockImplementation(async (serviceId) => {
        if (serviceId === 'rejecting') {
          throw new Error('boom');
        }
        return { cards: [{ summary: `card-${serviceId}` }] };
      });

      const cards = await client.firePatientView('p1', 'u1');

      expect(cards.map((c) => c.serviceId).sort()).toEqual(['ok-1', 'ok-2']);
    });

    it('preserves input service order in the returned card list', async () => {
      const services = [
        makeService('alpha'),
        makeService('bravo'),
        makeService('charlie'),
      ];
      jest.spyOn(client, 'discoverServices').mockResolvedValue(services);

      // Resolve out of order: charlie first, then alpha, then bravo.
      const order = { alpha: 60, bravo: 90, charlie: 10 };
      jest.spyOn(client, 'executeHook').mockImplementation(async (serviceId) => {
        await sleep(order[serviceId]);
        return { cards: [{ summary: `card-${serviceId}` }] };
      });

      const cards = await client.firePatientView('p1', 'u1');

      expect(cards.map((c) => c.serviceId)).toEqual(['alpha', 'bravo', 'charlie']);
    });

    it('returns an empty list (no throw) when no services are registered', async () => {
      jest.spyOn(client, 'discoverServices').mockResolvedValue([]);
      const exec = jest.spyOn(client, 'executeHook');

      const cards = await client.firePatientView('p1', 'u1');

      expect(cards).toEqual([]);
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('fireMedicationPrescribe', () => {
    it('dispatches medication-prescribe services in parallel', async () => {
      const services = [
        makeService('mp-1', { hook: 'medication-prescribe' }),
        makeService('mp-2', { hook: 'medication-prescribe' }),
        makeService('mp-3', { hook: 'medication-prescribe' }),
      ];
      jest.spyOn(client, 'discoverServices').mockResolvedValue(services);

      const PER_CALL_MS = 100;
      jest.spyOn(client, 'executeHook').mockImplementation(async (serviceId) => {
        await sleep(PER_CALL_MS);
        return { cards: [{ summary: `mp-${serviceId}` }] };
      });

      const t0 = Date.now();
      const cards = await client.fireMedicationPrescribe('p1', 'u1', []);
      const elapsed = Date.now() - t0;

      expect(cards).toHaveLength(3);
      expect(elapsed).toBeLessThan(PER_CALL_MS * services.length - 50);
    });
  });

  describe('fireOrderSign', () => {
    it('dispatches order-sign services in parallel', async () => {
      const services = [
        makeService('os-1', { hook: 'order-sign' }),
        makeService('os-2', { hook: 'order-sign' }),
        makeService('os-3', { hook: 'order-sign' }),
      ];
      jest.spyOn(client, 'discoverServices').mockResolvedValue(services);

      const PER_CALL_MS = 100;
      jest.spyOn(client, 'executeHook').mockImplementation(async (serviceId) => {
        await sleep(PER_CALL_MS);
        return { cards: [{ summary: `os-${serviceId}` }] };
      });

      const t0 = Date.now();
      const cards = await client.fireOrderSign('p1', 'u1', []);
      const elapsed = Date.now() - t0;

      expect(cards).toHaveLength(3);
      expect(elapsed).toBeLessThan(PER_CALL_MS * services.length - 50);
    });
  });
});
