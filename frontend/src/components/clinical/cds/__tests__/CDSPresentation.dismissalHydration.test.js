/**
 * Dismissal-hydration regression tests for CDSPresentation.
 *
 * The bug: dismissed/snoozed sets hydrated from localStorage in a
 * useEffect keyed on patientId. When the component mounted before the
 * patient resolved, already-acknowledged cards rendered for a frame and
 * then vanished once the effect ran — "cards appear and immediately
 * disappear". Hydration now happens during render (derived-state
 * pattern), so the dismissal filter is correct from the first painted
 * frame. These tests pin the observable contract around that.
 */

import { render, screen } from '@testing-library/react';
import CDSPresentation from '../CDSPresentation';
import { cdsAlertPersistence } from '../../../../services/cdsAlertPersistenceService';

vi.mock('../../../../services/cdsAlertPersistenceService', () => ({
  cdsAlertPersistence: {
    getDismissedAlerts: vi.fn(() => new Set()),
    getSnoozedAlerts: vi.fn(() => new Map()),
    dismissAlert: vi.fn(),
    snoozeAlert: vi.fn(),
  },
}));

const alert = {
  uuid: 'a-1',
  serviceId: 'patient-greeter',
  summary: 'Viewing chart for Test Patient',
  indicator: 'info',
  source: { label: 'Patient Greeter' },
};
const DISMISSED_KEY = 'patient-greeter-Viewing chart for Test Patient';

beforeEach(() => {
  vi.clearAllMocks();
});

it('an alert dismissed for this patient never renders, even when patientId arrives after mount', () => {
  cdsAlertPersistence.getDismissedAlerts.mockImplementation((pid) =>
    pid === 'p1' ? new Set([DISMISSED_KEY]) : new Set()
  );

  // Mount the way the workspace does on a cold load: alerts present,
  // patient not yet resolved.
  const { rerender } = render(
    <CDSPresentation alerts={[alert]} mode="inline" patientId={null} />
  );

  // Patient resolves — render-phase hydration must filter the dismissed
  // card in the SAME render pass (the old effect-based version painted it
  // first and hid it after).
  rerender(<CDSPresentation alerts={[alert]} mode="inline" patientId="p1" />);

  expect(screen.queryByText(/Viewing chart for Test Patient/)).toBeNull();
});

it('non-dismissed alerts stay visible after the patient resolves', () => {
  const { rerender } = render(
    <CDSPresentation alerts={[alert]} mode="inline" patientId={null} />
  );
  rerender(<CDSPresentation alerts={[alert]} mode="inline" patientId="p2" />);

  expect(screen.getByText(/Viewing chart for Test Patient/)).toBeTruthy();
});

it('without a patient (cds-studio preview), alerts render unfiltered', () => {
  render(<CDSPresentation alerts={[alert]} mode="inline" patientId={null} />);
  expect(screen.getByText(/Viewing chart for Test Patient/)).toBeTruthy();
});

it('switching patients swaps in the new patient dismissal set', () => {
  cdsAlertPersistence.getDismissedAlerts.mockImplementation((pid) =>
    pid === 'p1' ? new Set([DISMISSED_KEY]) : new Set()
  );

  const { rerender } = render(
    <CDSPresentation alerts={[alert]} mode="inline" patientId="p1" />
  );
  expect(screen.queryByText(/Viewing chart for Test Patient/)).toBeNull();

  rerender(<CDSPresentation alerts={[alert]} mode="inline" patientId="p3" />);
  expect(screen.getByText(/Viewing chart for Test Patient/)).toBeTruthy();
});
