/**
 * Chunk-load resilience for lazy workspace tabs.
 *
 * The failure this guards: a tab's dynamic import fails (server restarting,
 * or the app was redeployed and this session's hashed chunk names are stale).
 * Before this existed, the ONLY outcome was a dead "Error Loading Tab" — the
 * global kill-switch never fired because React error boundaries swallow the
 * lazy rejection, so unhandledrejection never happens.
 */
import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { retryOnce } from '../clinicalTabRegistry';
import TabErrorBoundary from '../TabErrorBoundary';
import * as recovery from '../../../../utils/staleBundleRecovery';

describe('retryOnce (transient-failure absorption)', () => {
  it('resolves without retry when the loader succeeds', async () => {
    const loader = vi.fn().mockResolvedValue('module');
    await expect(retryOnce(loader, 1)).resolves.toBe('module');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once and succeeds when the first fetch fails (server blip)', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce('module');
    await expect(retryOnce(loader, 1)).resolves.toBe('module');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('rejects after the second failure so the boundary can classify it', async () => {
    const loader = vi.fn().mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
    await expect(retryOnce(loader, 1)).rejects.toThrow(/dynamically imported module/);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('TabErrorBoundary chunk-error classification', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  afterAll(() => consoleError.mockRestore());

  const Thrower = ({ error }) => { throw error; };

  it('treats a failed dynamic import as an app update, not a tab error', async () => {
    const attempt = vi.spyOn(recovery, 'attemptStaleBundleRecovery').mockResolvedValue(true);

    render(
      <TabErrorBoundary>
        <Thrower error={new TypeError('Failed to fetch dynamically imported module: /static/js/CarePlanTabEnhanced.OLD.js')} />
      </TabErrorBoundary>
    );

    expect(screen.getByText('Updating WintEHR')).toBeInTheDocument();
    expect(screen.getByText(/newer version of WintEHR was detected/i)).toBeInTheDocument();
    expect(screen.queryByText('Error Loading Tab')).not.toBeInTheDocument();
    expect(attempt).toHaveBeenCalled();
    attempt.mockRestore();
  });

  it('offers a manual reload when the one auto-recovery is already spent', async () => {
    const attempt = vi.spyOn(recovery, 'attemptStaleBundleRecovery').mockResolvedValue(false);

    render(
      <TabErrorBoundary>
        <Thrower error={new TypeError('Importing a module script failed.')} />
      </TabErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/server may be restarting/i)).toBeInTheDocument();
    attempt.mockRestore();
  });

  it('keeps the generic error UI for real render errors', () => {
    const attempt = vi.spyOn(recovery, 'attemptStaleBundleRecovery').mockResolvedValue(true);

    render(
      <TabErrorBoundary>
        <Thrower error={new TypeError("Cannot read properties of undefined (reading 'foo')")} />
      </TabErrorBoundary>
    );

    expect(screen.getByText('Error Loading Tab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(attempt).not.toHaveBeenCalled();
    attempt.mockRestore();
  });

  it('renders a failing-once lazy tab through Suspense after the retry succeeds', async () => {
    const Tab = () => <div>care plan content</div>;
    const loader = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: Tab });
    const LazyTab = React.lazy(() => retryOnce(loader, 1));

    render(
      <TabErrorBoundary>
        <Suspense fallback={<div>loading…</div>}>
          <LazyTab />
        </Suspense>
      </TabErrorBoundary>
    );

    expect(await screen.findByText('care plan content')).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
