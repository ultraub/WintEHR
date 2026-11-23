/**
 * TabPolicyPanel — matrix editing, org-over-role locking, preview, save and
 * reset, and the system-permission gate. SDK mocked at the boundary.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

const CATALOG = [
  { id: 'summary', label: 'Summary', color: '#111' },
  { id: 'orders', label: 'Orders', color: '#222' },
  { id: 'administration', label: 'Administration', color: '#333' },
  { id: 'inbox', label: 'Inbox', color: '#444' },
];

const NAV = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', section: 'clinical', sectionTitle: 'Clinical Workflows' },
  { id: 'patients', label: 'Patients', path: '/patients', section: 'clinical', sectionTitle: 'Clinical Workflows' },
  { id: 'analytics', label: 'Analytics', path: '/analytics', section: 'analytics', sectionTitle: 'Population Health' },
  { id: 'command-center', label: 'Command Center', path: '/command-center', section: 'admin', sectionTitle: 'Administration' },
];

const SECTIONS = [
  { id: 'order-history', label: 'Order history', host: 'orders', builtin: true, hostable: false },
  { id: 'order-sets', label: 'Order sets', host: 'orders', builtin: true, hostable: false },
  { id: 'flowsheet', label: 'Flowsheet', host: 'administration', builtin: false, hostable: true },
];

vi.mock('../../sdk', async () => {
  const policy = await vi.importActual('../../../components/clinical/workspace/tabPolicy');
  return {
    api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    useAuth: vi.fn(),
    loadClinicalTabCatalog: vi.fn(() => Promise.resolve(CATALOG)),
    loadClinicalSectionCatalog: vi.fn(() => Promise.resolve(SECTIONS)),
    loadNavigationCatalog: vi.fn(() => Promise.resolve(NAV)),
    refreshTabPolicy: vi.fn(() => Promise.resolve()),
    resolveEffectiveTabs: policy.resolveEffectiveTabs,
    resolveEffectiveSections: policy.resolveEffectiveSections,
    resolveEffectiveNav: policy.resolveEffectiveNav,
    ALWAYS_VISIBLE_TABS: policy.ALWAYS_VISIBLE,
    ALWAYS_VISIBLE_NAV: policy.ALWAYS_VISIBLE_NAV,
    EMPTY_TAB_POLICY: policy.EMPTY_TAB_POLICY,
  };
});

import { api, useAuth, refreshTabPolicy } from '../../sdk';
import TabPolicyPanel from '../TabPolicyPanel';

const policyResponse = (policy, extra = {}) => ({
  data: { policy, roles: ['nurse', 'physician'], contexts: [], always_visible: ['summary'], source: 'default', ...extra },
});

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
  refreshTabPolicy.mockClear();
});

it('renders the matrix with Summary locked and lets a system user hide a tab for a role', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue(policyResponse({}));
  api.put.mockImplementation((_url, body) => Promise.resolve({ data: { value: body.value, source: 'database', updated_by: 'demo-admin' } }));

  render(<TabPolicyPanel />);
  await screen.findByLabelText('Orders visible for nurse');

  expect(screen.getByLabelText('Summary visible for nurse')).toBeDisabled();
  const ordersForNurse = screen.getByLabelText('Orders visible for nurse');
  expect(ordersForNurse).toBeChecked();
  fireEvent.click(ordersForNurse);
  expect(ordersForNurse).not.toBeChecked();

  // Preview for nurse drops Orders; organization keeps it.
  expect(within(screen.getByTestId('preview-nurse')).queryByText('Orders')).not.toBeInTheDocument();
  expect(within(screen.getByTestId('preview-__org__')).getByText('Orders')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
  const [url, body] = api.put.mock.calls[0];
  expect(url).toBe('/api/command-center/settings/ui.tabs.policy');
  expect(body.value.roles.nurse.hidden).toEqual(['orders']);
  expect(body.value.org.hidden).toEqual([]);
  await waitFor(() => expect(screen.getByText(/Saved\./)).toBeInTheDocument());
  expect(refreshTabPolicy).toHaveBeenCalled();
  expect(screen.getByText(/Custom policy by demo-admin/)).toBeInTheDocument();
});

it('a tab hidden for the organization is locked off in every role column', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue(policyResponse({ org: { hidden: ['inbox'] } }, { source: 'database' }));
  render(<TabPolicyPanel />);
  await screen.findByLabelText('Inbox visible for nurse');
  const inboxForNurse = screen.getByLabelText('Inbox visible for nurse');
  expect(inboxForNurse).not.toBeChecked();
  expect(inboxForNurse).toBeDisabled();
  expect(screen.getByLabelText('Inbox visible for Organization')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Reset to show everything' })).toBeInTheDocument();
});

it('reset deletes the override and refreshes the policy', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue(policyResponse({ org: { hidden: ['inbox'] } }, { source: 'database' }));
  api.delete.mockResolvedValue({ data: { value: { org: { hidden: [] }, roles: {}, contexts: {} }, source: 'default' } });
  render(<TabPolicyPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reset to show everything' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/command-center/settings/ui.tabs.policy'));
  await waitFor(() => expect(screen.getByText(/Policy reset/)).toBeInTheDocument());
  expect(screen.getByLabelText('Inbox visible for nurse')).toBeChecked();
  expect(refreshTabPolicy).toHaveBeenCalled();
});

it('is read-only without the system permission', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockResolvedValue(policyResponse({}));
  render(<TabPolicyPanel />);
  await screen.findByLabelText('Orders visible for nurse');
  expect(screen.getByText(/needs the/)).toBeInTheDocument();
  expect(screen.getByLabelText('Orders visible for nurse')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

// --- sections (slice 7b) ----------------------------------------------------------

it('expands a tab to its sections, hides one for a role, and adds a hostable section for the organization', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue(policyResponse({}));
  api.put.mockImplementation((_url, body) => Promise.resolve({ data: { value: body.value, source: 'database', updated_by: 'demo-admin' } }));

  render(<TabPolicyPanel />);
  await screen.findByLabelText('Orders visible for nurse');
  fireEvent.click(screen.getByRole('button', { name: 'Expand Orders sections' }));

  const docsForNurse = screen.getByLabelText('Order history on Orders for nurse');
  expect(docsForNurse).toBeChecked();
  fireEvent.click(docsForNurse);
  expect(docsForNurse).not.toBeChecked();
  expect(within(screen.getByTestId('preview-nurse-orders')).queryByText('Order history')).not.toBeInTheDocument();
  expect(within(screen.getByTestId('preview-__org__-orders')).getByText('Order history')).toBeInTheDocument();

  // Add the hostable Flowsheet section to Orders for everyone.
  fireEvent.mouseDown(screen.getByLabelText('Add a section to Orders'));
  fireEvent.click(await screen.findByRole('option', { name: /Flowsheet/ }));
  expect(screen.getByLabelText('Flowsheet on Orders for Organization')).toBeChecked();
  expect(screen.getByLabelText('Flowsheet on Orders for nurse')).toBeDisabled();
  expect(within(screen.getByTestId('preview-nurse-orders')).getByText('Flowsheet')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
  const body = api.put.mock.calls[0][1].value;
  expect(body.roles.nurse.sections.orders.hidden).toEqual(['order-history']);
  expect(body.org.sections.orders.added).toEqual(['flowsheet']);
});


it('adds a workflow context column, narrows a tab in it, previews it, and removes it', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue(policyResponse({ org: { hidden: [] }, roles: {}, contexts: {} }));
  api.put.mockImplementation((_url, body) => Promise.resolve({ data: { value: body.value, source: 'database', updated_by: 'demo-admin' } }));
  render(<TabPolicyPanel />);
  expect(await screen.findByText(/None defined yet/)).toBeInTheDocument();
  const addButton = screen.getByRole('button', { name: 'Add context' });
  expect(addButton).toBeDisabled();
  fireEvent.change(screen.getByLabelText('New context'), { target: { value: 'Surgical' } });
  fireEvent.click(addButton);
  expect(await screen.findByLabelText('Remove context surgical')).toBeInTheDocument();
  expect(screen.getByTestId('preview-ctx:surgical')).toHaveTextContent('context surgical');
  fireEvent.click(screen.getByLabelText('Inbox visible for surgical'));
  expect(screen.getByTestId('preview-ctx:surgical')).not.toHaveTextContent('Inbox');
  expect(screen.getByTestId('preview-__org__')).toHaveTextContent('Inbox');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  const saved = api.put.mock.calls[0][1].value;
  expect(saved.contexts.surgical.hidden).toEqual(['inbox']);
  fireEvent.click(screen.getByLabelText('Remove context surgical'));
  expect(screen.queryByTestId('preview-ctx:surgical')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

it('hides a primary navigation page per role or for everyone, with Patients and the Command Center locked', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue(policyResponse({ roles: { nurse: { nav: { hidden: ['analytics'] } } } }));
  api.put.mockImplementation((_url, body) => Promise.resolve({ data: { value: body.value, source: 'database', updated_by: 'demo-admin' } }));

  render(<TabPolicyPanel />);
  await screen.findByLabelText('Dashboard page visible for nurse');

  expect(screen.getByLabelText('Patients page visible for Organization')).toBeDisabled();
  expect(screen.getByLabelText('Command Center page visible for nurse')).toBeDisabled();
  expect(screen.getByLabelText('Analytics page visible for nurse')).not.toBeChecked();
  expect(within(screen.getByTestId('preview-nurse-nav')).queryByText('Analytics')).not.toBeInTheDocument();
  expect(within(screen.getByTestId('preview-physician-nav')).getByText('Analytics')).toBeInTheDocument();

  // Hiding Dashboard for the organization locks the role cells under it.
  fireEvent.click(screen.getByLabelText('Dashboard page visible for Organization'));
  expect(screen.getByLabelText('Dashboard page visible for nurse')).toBeDisabled();
  expect(within(screen.getByTestId('preview-physician-nav')).queryByText('Dashboard')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
  const body = api.put.mock.calls[0][1];
  expect(body.value.org.nav).toEqual({ hidden: ['dashboard'] });
  expect(body.value.roles.nurse.nav).toEqual({ hidden: ['analytics'] });
  expect(body.value.roles.physician).toBeUndefined();
});
