/**
 * WorkflowContextPicker — hidden without contexts, lists them, stores the choice.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: { role: 'nurse' } })) }));

import WorkflowContextPicker from '../WorkflowContextPicker';
import { __setTabPolicyForTests, getActiveContext, setWorkflowContext } from '../tabPolicyStore';

beforeEach(() => {
  act(() => setWorkflowContext(null));
});

it('renders nothing when the policy defines no contexts', () => {
  __setTabPolicyForTests({ contexts: [] });
  render(<WorkflowContextPicker />);
  expect(screen.queryByTestId('workflow-context')).not.toBeInTheDocument();
});

it('lists the contexts and stores the choice', async () => {
  __setTabPolicyForTests({ policy: { org: { hidden: [] }, roles: {}, contexts: { inpatient: { hidden: [] }, surgical: { hidden: [] } } }, contexts: ['inpatient', 'surgical'] });
  render(<WorkflowContextPicker />);
  expect(screen.getByTestId('workflow-context')).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: 'surgical' }));
  expect(getActiveContext()).toBe('surgical');
  expect(screen.getByRole('combobox')).toHaveTextContent('surgical');
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: 'None' }));
  expect(getActiveContext()).toBeNull();
});
