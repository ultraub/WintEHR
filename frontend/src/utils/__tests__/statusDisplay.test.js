import { getStatusTone, getStatusLabel, STATUS_TONES } from '../statusDisplay';

describe('status vocabulary', () => {
  test('the normal state is never an alarm colour', () => {
    expect(getStatusTone('active')).toBe('positive');
    expect(getStatusTone('Active')).toBe('positive');
    expect(getStatusTone('ok')).toBe('positive');
    expect(getStatusTone('completed')).toBe('neutral');
    expect(getStatusTone('final')).toBe('neutral');
    expect(getStatusTone('resolved')).toBe('neutral');
  });

  test('ended states are muted; only real problems are critical', () => {
    expect(getStatusTone('stopped')).toBe('muted');
    expect(getStatusTone('cancelled')).toBe('muted');
    expect(getStatusTone('noshow')).toBe('muted');
    expect(getStatusTone('entered-in-error')).toBe('critical');
    expect(getStatusTone('failed')).toBe('critical');
    expect(getStatusTone('on-hold')).toBe('attention');
    expect(getStatusTone('degraded')).toBe('attention');
    expect(getStatusTone('in-progress')).toBe('info');
  });

  test('normalises separators and falls back to muted', () => {
    expect(getStatusTone('in_progress')).toBe('info');
    expect(getStatusTone('On Hold')).toBe('attention');
    expect(getStatusTone('something-new')).toBe('muted');
    expect(getStatusTone(undefined)).toBe('muted');
    expect(STATUS_TONES).toContain(getStatusTone('anything'));
  });

  test('labels are humanised', () => {
    expect(getStatusLabel('entered-in-error')).toBe('Entered in error');
    expect(getStatusLabel('in-progress')).toBe('In progress');
    expect(getStatusLabel('noshow')).toBe('No show');
    expect(getStatusLabel('ok')).toBe('OK');
    expect(getStatusLabel('active')).toBe('Active');
    expect(getStatusLabel('')).toBe('Unknown');
  });
});
