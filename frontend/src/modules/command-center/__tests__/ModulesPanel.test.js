/**
 * ModulesPanel — joins the backend inventory and the frontend manifests by key.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn() },
  useAuth: vi.fn(),
  loadModuleSummaries: vi.fn(),
}));

import { api, useAuth, loadModuleSummaries } from '../../sdk';
import ModulesPanel from '../ModulesPanel';

beforeEach(() => {
  api.get.mockReset();
  loadModuleSummaries.mockReset();
});

const BACKEND = {
  modules: [
    { key: 'flowsheets', source: 'builtin', backend_routers: ['Flowsheets'], disabled: false, registered: true, failed: [], settings: ['module.flowsheets.window_hours'] },
    { key: 'imaging', source: 'builtin', backend_routers: ['DICOM', 'Imaging studies'], disabled: true, registered: false, failed: [], settings: [] },
    { key: 'oncology', source: 'external', backend_routers: ['Oncology'], disabled: false, registered: false, failed: [{ router: 'Oncology', error: 'ImportError: nope' }], settings: [] },
  ],
  disabled_backend: ['imaging'],
  how_to: { backend: 'Set WINTEHR_DISABLED_MODULES…', frontend: 'Set REACT_APP_DISABLED_MODULES…', external: 'List the module in wintehr.modules.json…' },
};
const FRONTEND = [
  { id: 'flowsheets', enabled: true, external: false, tabs: [{ id: 'flowsheet', label: 'Flowsheet' }], pages: [], sections: [{ id: 'flowsheet', label: 'Flowsheet', hostable: true }], slots: [], permissions: ['read', 'write'], settings: [] },
  { id: 'inpatient', enabled: false, external: false, tabs: [], pages: [{ id: 'census', path: '/census', label: 'Unit Census' }], sections: [], slots: ['patient-header.chips'], permissions: [], settings: [] },
];

it('shows each module with backend status, frontend contributions, permissions and settings', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockResolvedValue({ data: BACKEND });
  loadModuleSummaries.mockResolvedValue(FRONTEND);
  render(<ModulesPanel />);

  const flow = await screen.findByTestId('module-flowsheets');
  expect(within(flow).getByText('registered')).toBeInTheDocument();
  expect(within(flow).getByText('enabled')).toBeInTheDocument();
  expect(within(flow).getByText('1 tab')).toBeInTheDocument();
  expect(within(flow).getByText('1 section')).toBeInTheDocument();
  expect(within(flow).getByText('write')).toBeInTheDocument();
  expect(within(flow).getByText('module.flowsheets.window_hours')).toBeInTheDocument();

  const imaging = screen.getByTestId('module-imaging');
  expect(within(imaging).getByText('disabled')).toBeInTheDocument();
  expect(within(imaging).getByText('no frontend half')).toBeInTheDocument();

  const onc = screen.getByTestId('module-oncology');
  expect(within(onc).getByText('external')).toBeInTheDocument();
  expect(within(onc).getByText('failed')).toBeInTheDocument();
  expect(within(onc).getByText(/ImportError: nope/)).toBeInTheDocument();

  const inpatient = screen.getByTestId('module-inpatient');
  expect(within(inpatient).getByText('disabled in this build')).toBeInTheDocument();
  expect(within(inpatient).getByText('no backend half')).toBeInTheDocument();
  expect(within(inpatient).getByText('1 slot')).toBeInTheDocument();

  expect(screen.getByText(/Backend disabled on this deployment: imaging/)).toBeInTheDocument();
});

it('needs the admin permission', () => {
  useAuth.mockReturnValue({ user: { permissions: ['read'] } });
  render(<ModulesPanel />);
  expect(screen.getByText(/needs the/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});
