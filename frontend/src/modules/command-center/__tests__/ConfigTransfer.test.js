/**
 * ConfigTransfer — export saves a file, import previews a plan before applying,
 * replace re-plans, apply reports and refreshes, bad files are refused.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '../../sdk';
import ConfigTransfer from '../ConfigTransfer';

const DOC = { wintehr_config: 1, exported_at: '2026-11-21T10:00:00+00:00', source: { git_commit: 'feedface12', environment: 'production' },
  settings: { 'system.patient_count_cap': 300, 'ui.tabs.policy': { org: { hidden: ['imaging'] } } }, secrets_set: ['system.umls_api_key'] };

const PLAN = (overrides = {}) => ({
  replace: false, applied: false, restart_required: false, rebuild_required: false,
  secrets_set: ['system.umls_api_key'], source: DOC.source, exported_at: DOC.exported_at,
  counts: { set: 2, reset: 0, unchanged: 0, skip: 1 },
  items: [
    { key: 'system.patient_count_cap', action: 'set', current: 250, incoming: 300, tier: 'live', current_source: 'database' },
    { key: 'ui.tabs.policy', action: 'set', current: null, incoming: { org: { hidden: ['imaging'] } }, tier: 'live', current_source: 'default' },
    { key: 'module.gone.flag', action: 'skip', incoming: true, reason: 'unknown setting on this deployment' },
  ],
  ...overrides,
});

const chooseFile = (text, name = 'config.json') => {
  const file = new File([text], name, { type: 'application/json' });
  file.text = () => Promise.resolve(text);
  fireEvent.change(screen.getByTestId('config-file'), { target: { files: [file] } });
};

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  global.URL.createObjectURL = vi.fn(() => 'blob:config');
  global.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

it('exports the document as a file and says what it held', async () => {
  api.get.mockResolvedValue({ data: DOC });
  render(<ConfigTransfer canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Export configuration' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/command-center/config/export'));
  expect(await screen.findByText(/Exported 2 overrides \(1 secret listed by name only\)/)).toBeInTheDocument();
  expect(URL.createObjectURL).toHaveBeenCalled();
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
});

it('previews a plan, re-plans on replace, and applies on confirmation', async () => {
  const onImported = vi.fn();
  api.post.mockImplementation((_url, body) => {
    if (body.apply) return Promise.resolve({ data: PLAN({ applied: true, restart_required: true, items: PLAN().items.map((i) => ({ ...i, applied: i.action === 'set' ? true : null })) }) });
    if (body.replace) return Promise.resolve({ data: PLAN({ replace: true, counts: { set: 2, reset: 1, unchanged: 0, skip: 1 }, items: [...PLAN().items, { key: 'auth.roles', action: 'reset', current: { nurse: {} }, tier: 'live', reason: 'not in the file (replace mode)' }] }) });
    return Promise.resolve({ data: PLAN() });
  });
  render(<ConfigTransfer canEdit onImported={onImported} />);
  chooseFile(JSON.stringify(DOC));
  const table = await screen.findByTestId('import-plan');
  expect(api.post).toHaveBeenCalledWith('/api/command-center/config/import', { document: DOC, replace: false, apply: false });
  expect(within(table).getByTestId('plan-system.patient_count_cap')).toHaveTextContent('300');
  expect(within(table).getByTestId('plan-module.gone.flag')).toHaveTextContent('unknown setting on this deployment');
  expect(screen.getByText(/2 changes would be made/)).toBeInTheDocument();
  expect(screen.getByText(/enter them by hand after importing: system.umls_api_key/)).toBeInTheDocument();
  expect(screen.getByText(/from commit/)).toHaveTextContent('feedface');

  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/command-center/config/import', { document: DOC, replace: true, apply: false }));
  expect(await screen.findByTestId('plan-auth.roles')).toHaveTextContent('reset');
  expect(screen.getByText(/3 changes would be made/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Apply 3 changes/ }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/command-center/config/import', { document: DOC, replace: true, apply: true }));
  expect(await screen.findByText(/Imported 2 changes\. A restart-tier setting changed/)).toBeInTheDocument();
  expect(onImported).toHaveBeenCalled();
  expect(screen.queryByTestId('import-plan')).not.toBeInTheDocument();
});

it('disables apply when nothing would change and refuses a file the backend cannot read', async () => {
  api.post.mockResolvedValueOnce({ data: PLAN({ counts: { set: 0, reset: 0, unchanged: 2, skip: 0 }, items: PLAN().items.slice(0, 2).map((i) => ({ ...i, action: 'unchanged' })) }) });
  render(<ConfigTransfer canEdit />);
  chooseFile(JSON.stringify(DOC));
  await screen.findByTestId('import-plan');
  expect(screen.getByText(/Nothing would change/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Apply/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  api.post.mockRejectedValueOnce({ response: { data: { detail: 'config document: expected wintehr_config 1, got None' } } });
  chooseFile('{"settings": {}}');
  expect(await screen.findByText(/expected wintehr_config 1/)).toBeInTheDocument();

  chooseFile('not json', 'notes.json');
  expect(await screen.findByText('notes.json is not valid JSON')).toBeInTheDocument();
});

it('hides import without the system permission', () => {
  render(<ConfigTransfer canEdit={false} />);
  expect(screen.getByRole('button', { name: 'Export configuration' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Import configuration/ })).not.toBeInTheDocument();
});
