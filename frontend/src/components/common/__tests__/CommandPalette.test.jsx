import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

vi.mock('../../../core/fhir/services/fhirClient', () => ({
  fhirClient: { searchPatients: vi.fn() },
}));

import { fhirClient } from '../../../core/fhir/services/fhirClient';
import CommandPalette, { isPaletteShortcut } from '../CommandPalette';

const nav = {
  clinical: {
    title: 'Clinical Workflows',
    items: [
      { text: 'Dashboard', path: '/dashboard', description: 'Overview' },
      { text: 'Pharmacy', path: '/pharmacy', description: 'Dispensing' },
    ],
  },
};

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const setup = (onClose = vi.fn()) => {
  render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter initialEntries={['/start']}>
        <CommandPalette open onClose={onClose} navigationConfig={nav} />
        <Routes><Route path="*" element={<Where />} /></Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
  return { onClose, input: screen.getByRole('combobox') };
};

describe('CommandPalette', () => {
  beforeEach(() => fhirClient.searchPatients.mockReset());

  test('shortcut is Cmd/Ctrl+K only', () => {
    expect(isPaletteShortcut({ key: 'k', metaKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: 'K', ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: 'k' })).toBeFalsy();
    expect(isPaletteShortcut({ key: 'k', ctrlKey: true, shiftKey: true })).toBe(false);
  });

  test('filters pages and navigates with the keyboard', () => {
    const { onClose, input } = setup();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(input, { target: { value: 'p' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/pharmacy');
  });

  test('finds patients by name and opens the chart', async () => {
    fhirClient.searchPatients.mockResolvedValue({
      resources: [{ resourceType: 'Patient', id: 'abc-1', name: [{ family: 'Rogahn59', given: ['Laurena366'] }], birthDate: '1993-11-21' }],
    });
    const { input } = setup();
    fireEvent.change(input, { target: { value: 'rog' } });
    await waitFor(() => expect(screen.getByText('Rogahn, Laurena')).toBeInTheDocument());
    expect(fhirClient.searchPatients).toHaveBeenCalledWith({ name: 'rog', _count: 6 });
    fireEvent.click(screen.getByText('Rogahn, Laurena'));
    expect(screen.getByTestId('where').textContent).toBe('/patients/abc-1/clinical');
  });

  test('says so when nothing matches', async () => {
    fhirClient.searchPatients.mockResolvedValue({ resources: [] });
    const { input } = setup();
    fireEvent.change(input, { target: { value: 'zzzz' } });
    await waitFor(() => expect(screen.getByText('Nothing matches "zzzz"')).toBeInTheDocument());
  });
});
