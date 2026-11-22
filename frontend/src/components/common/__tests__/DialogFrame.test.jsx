import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import DialogFrame from '../DialogFrame';
import PageHeader from '../PageHeader';

const wrap = (ui) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('DialogFrame', () => {
  test('labels the dialog by its title and orders Cancel before the primary action', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    wrap(
      <DialogFrame open onClose={onClose} title="New patient" subtitle="Demographics" primaryAction={{ label: 'Create', onClick: onSave }}>
        body
      </DialogFrame>
    );
    expect(screen.getByRole('dialog', { name: 'New patient' })).toBeInTheDocument();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent || b.getAttribute('aria-label'));
    expect(buttons.slice(-2)).toEqual(['Cancel', 'Create']);
    fireEvent.click(screen.getByText('Create'));
    expect(onSave).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  test('cannot be closed or resubmitted while busy', () => {
    const onClose = vi.fn();
    wrap(
      <DialogFrame open busy onClose={onClose} title="Saving" primaryAction={{ label: 'Save', onClick: vi.fn() }}>
        body
      </DialogFrame>
    );
    expect(screen.getByText('Save').closest('button')).toBeDisabled();
    expect(screen.getByLabelText('Close')).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('secondaryAction={null} drops Cancel', () => {
    wrap(
      <DialogFrame open onClose={vi.fn()} title="Details" secondaryAction={null} primaryAction={{ label: 'Done', onClick: vi.fn() }}>
        body
      </DialogFrame>
    );
    expect(screen.queryByText('Cancel')).toBeNull();
  });
});

describe('PageHeader', () => {
  test('renders one h1 with subtitle and actions', () => {
    wrap(<PageHeader title="Pharmacy" subtitle="Dispensing queue" actions={<button>Refresh</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Pharmacy' })).toBeInTheDocument();
    expect(screen.getByText('Dispensing queue')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });
});
