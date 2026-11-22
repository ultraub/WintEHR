import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import StatTile from '../StatTile';
import StatusChip from '../../clinical/shared/display/StatusChip';

const renderWithTheme = (ui) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('StatTile', () => {
  test('a zero value never carries an alarm tone', () => {
    const { container } = renderWithTheme(<StatTile label="Out of stock" value={0} tone="critical" />);
    expect(container.querySelector('[data-tone]').dataset.tone).toBe('neutral');
  });

  test('a non-zero value shows its tone', () => {
    const { container } = renderWithTheme(<StatTile label="Out of stock" value={3} tone="critical" />);
    expect(container.querySelector('[data-tone]').dataset.tone).toBe('critical');
  });

  test('toneWhenZero keeps the tone for tiles where zero is the problem', () => {
    const { container } = renderWithTheme(
      <StatTile label="Staff on shift" value={0} tone="critical" toneWhenZero />
    );
    expect(container.querySelector('[data-tone]').dataset.tone).toBe('critical');
  });

  test('renders value, unit, caption and chips; missing value is a dash', () => {
    renderWithTheme(
      <StatTile label="Recent labs" value={5} unit="results" caption="Last 7 days" chips={[{ label: 'abnormal', count: 2 }]} />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('results')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('2 abnormal')).toBeInTheDocument();

    renderWithTheme(<StatTile label="Empty" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('is a button only when clickable', () => {
    const onClick = vi.fn();
    renderWithTheme(<StatTile label="Orders" value={4} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('StatusChip', () => {
  test('tone and label come from the shared vocabulary', () => {
    const { container } = renderWithTheme(
      <>
        <StatusChip status="active" />
        <StatusChip status="entered-in-error" />
        <StatusChip status="made-up" />
      </>
    );
    const tones = [...container.querySelectorAll('[data-tone]')].map((n) => n.dataset.tone);
    expect(tones).toEqual(['positive', 'critical', 'muted']);
    expect(screen.getByText('Entered in error')).toBeInTheDocument();
    expect(screen.getByText('Made up')).toBeInTheDocument();
  });
});
