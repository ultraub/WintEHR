/**
 * Tests for MARCell — the cell-state classifier that drives the entire
 * grid's visual language (#116 Phase 5.1).
 *
 * The classifier is pure (input: scheduledRow + now → output: state string),
 * so we test it without rendering. The render path is exercised lightly via
 * a smoke test to confirm the component mounts with each state.
 */

import { classifyCell } from '../MARCell';

const NOW = new Date('2026-05-14T12:00:00Z');

const baseRow = {
  medication_request_id: 'rx-1',
  scheduled_time: '2026-05-14T12:00:00Z',
  medication_display: 'Metformin 500 mg',
  dose_text: '500 mg',
  route_text: 'PO',
  high_alert: false,
  administration: null,
};

describe('classifyCell', () => {
  test('returns "empty" for null/undefined input', () => {
    expect(classifyCell(null, NOW)).toBe('empty');
    expect(classifyCell(undefined, NOW)).toBe('empty');
  });

  test('returns "due-now" when scheduled within ±30 min of now', () => {
    expect(classifyCell({ ...baseRow, scheduled_time: '2026-05-14T12:00:00Z' }, NOW))
      .toBe('due-now');
    expect(classifyCell({ ...baseRow, scheduled_time: '2026-05-14T11:45:00Z' }, NOW))
      .toBe('due-now');
    expect(classifyCell({ ...baseRow, scheduled_time: '2026-05-14T12:25:00Z' }, NOW))
      .toBe('due-now');
  });

  test('returns "future" when scheduled >30 min in the future', () => {
    expect(classifyCell({ ...baseRow, scheduled_time: '2026-05-14T13:00:00Z' }, NOW))
      .toBe('future');
  });

  test('returns "past-due" when scheduled 30 min to 2 h in the past', () => {
    expect(classifyCell({ ...baseRow, scheduled_time: '2026-05-14T11:00:00Z' }, NOW))
      .toBe('past-due');
    expect(classifyCell({ ...baseRow, scheduled_time: '2026-05-14T10:15:00Z' }, NOW))
      .toBe('past-due');
  });

  test('returns "missed" when scheduled >2 h in the past with no admin', () => {
    expect(classifyCell({ ...baseRow, scheduled_time: '2026-05-14T09:00:00Z' }, NOW))
      .toBe('missed');
  });

  test('returns "given" when an admin record is matched with status=completed and ≤60min from scheduled', () => {
    const row = {
      ...baseRow,
      administration: {
        id: 'adm-1',
        status: 'completed',
        effective_datetime: '2026-05-14T12:07:00Z', // 7 min late
      },
    };
    expect(classifyCell(row, NOW)).toBe('given');
  });

  test('returns "late-given" when a completed admin is >60min from the scheduled time', () => {
    const row = {
      ...baseRow,
      administration: {
        id: 'adm-2',
        status: 'completed',
        effective_datetime: '2026-05-14T13:30:00Z', // 90 min late
      },
    };
    expect(classifyCell(row, NOW)).toBe('late-given');
  });

  test('returns "held" for an admin with status=on-hold', () => {
    const row = {
      ...baseRow,
      administration: {
        id: 'adm-3',
        status: 'on-hold',
        effective_datetime: '2026-05-14T12:00:00Z',
      },
    };
    expect(classifyCell(row, NOW)).toBe('held');
  });

  test('returns "refused" for an admin with status=not-done', () => {
    const row = {
      ...baseRow,
      administration: {
        id: 'adm-4',
        status: 'not-done',
        effective_datetime: '2026-05-14T12:00:00Z',
        status_reason: 'Patient refused',
      },
    };
    expect(classifyCell(row, NOW)).toBe('refused');
  });

  test('admin record dominates time-based classification', () => {
    // Even though scheduled was 5 hours ago (would otherwise be "missed"),
    // a completed admin means the cell is "given" / "late-given".
    const row = {
      ...baseRow,
      scheduled_time: '2026-05-14T07:00:00Z',
      administration: {
        id: 'adm-5',
        status: 'completed',
        effective_datetime: '2026-05-14T07:15:00Z',
      },
    };
    expect(classifyCell(row, NOW)).toBe('given');
  });
});
