/**
 * Tests for ImmunizationAdminDialog edit mode (#116 Phase 5.3).
 *
 * Record mode is exercised via TaskPane.test.jsx; this covers the edit
 * mode added when ImmunizationDialogEnhanced was retired — in particular
 * that the merged resource preserves fields the lean form does not manage.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '../../../../../test-utils/test-utils';
import ImmunizationAdminDialog from '../dialogs/ImmunizationAdminDialog';

const existing = {
  resourceType: 'Immunization',
  id: 'imm-1',
  status: 'completed',
  vaccineCode: { text: 'Influenza vaccine' },
  patient: { reference: 'Patient/p1' },
  occurrenceDateTime: '2026-05-10T08:00:00Z',
  lotNumber: 'OLD-LOT',
  route: { text: 'IM' },
  site: { text: 'Left deltoid' },
  doseQuantity: { value: 0.5, unit: 'mL' },
  // Fields the lean form does NOT manage — must survive an edit.
  performer: [{ actor: { reference: 'Practitioner/x' } }],
  location: { display: 'Clinic A' },
  protocolApplied: [{ series: 'Influenza 2026', doseNumberPositiveInt: 1 }],
};

test('edit mode pre-fills the form from the existing resource', async () => {
  render(
    <ImmunizationAdminDialog
      open
      immunization={existing}
      patientId="p1"
      onClose={() => {}}
      onSave={jest.fn().mockResolvedValue({})}
    />,
  );
  expect(screen.getByText('Edit immunization')).toBeInTheDocument();
  expect(screen.getByText('Influenza vaccine')).toBeInTheDocument();
  expect(screen.getByDisplayValue('OLD-LOT')).toBeInTheDocument();
});

test('saving an edit hands onSave a merged resource that preserves untouched fields', async () => {
  const onSave = jest.fn().mockResolvedValue({});
  const onClose = jest.fn();
  render(
    <ImmunizationAdminDialog
      open
      immunization={existing}
      patientId="p1"
      onClose={onClose}
      onSave={onSave}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  // onClose runs a microtask after onSave resolves.
  await waitFor(() => expect(onClose).toHaveBeenCalled());

  const saved = onSave.mock.calls[0][0];
  expect(saved.id).toBe('imm-1');
  expect(saved.resourceType).toBe('Immunization');
  // Untouched fields the lean form has no inputs for must survive the merge.
  expect(saved.performer).toEqual(existing.performer);
  expect(saved.location).toEqual(existing.location);
  expect(saved.protocolApplied).toEqual(existing.protocolApplied);
  // Managed fields are still present.
  expect(saved.lotNumber).toBe('OLD-LOT');
  expect(saved.status).toBe('completed');
  expect(saved.doseQuantity.value).toBe(0.5);
});

test('editing the lot number flows into the saved resource', async () => {
  const onSave = jest.fn().mockResolvedValue({});
  render(
    <ImmunizationAdminDialog
      open
      immunization={existing}
      patientId="p1"
      onClose={() => {}}
      onSave={onSave}
    />,
  );

  fireEvent.change(screen.getByDisplayValue('OLD-LOT'), { target: { value: 'NEW-LOT' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].lotNumber).toBe('NEW-LOT');
});
