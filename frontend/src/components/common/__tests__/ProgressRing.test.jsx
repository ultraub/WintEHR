import React from 'react';
import { render, screen, fireEvent } from '../../../test-utils/test-utils';
import ProgressRing from '../ProgressRing';

describe('ProgressRing', () => {
  it('shows the true percentage at once and names its status for screen readers', () => {
    render(<ProgressRing value={58} label="Flu Vaccination" caption="84 of 145" status="Below target" tone="attention" />);
    expect(screen.getByText('58%')).toBeInTheDocument();
    expect(screen.getByText('84 of 145')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Flu Vaccination: 58%, below target' })).toBeInTheDocument();
  });

  it('clamps out-of-range values', () => {
    render(<ProgressRing value={140} label="A1C" />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('is a button only when it has somewhere to go', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ProgressRing value={7} label="Mammography" />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<ProgressRing value={7} label="Mammography" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
