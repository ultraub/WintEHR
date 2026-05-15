/**
 * MARGrid — the time-axis grid that is the visual centerpiece of the MAR
 * (#116 Phase 5.1).
 *
 * Layout strategy: CSS Grid. Each row is a `MedRowHeader` (sticky on the
 * left) followed by N `MARCell`s, one per time column. The whole grid
 * scrolls horizontally if the window exceeds the available width; the
 * row header stays pinned so the nurse never loses track of which med
 * a cell belongs to.
 *
 * The grid is rendered as one big flex container of rows, not a `<table>`,
 * because tables make sticky-cell + scroll-shadow effects much harder to
 * reason about in MUI. The accessibility story is preserved via aria-role
 * on the wrapping container and per-cell aria-labels (handled inside MARCell).
 *
 * The data model coming in is a flat list of scheduled-task rows
 * (one per dose) from the backend. We group by `medication_request_id`
 * here — the grouping logic lives in the parent so callers can pre-filter
 * (e.g. show-only-due-now) without re-grouping every render.
 */

import React, { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

import MARCell from './MARCell';
import MedRowHeader, { ROW_HEADER_WIDTH } from './MedRowHeader';

/**
 * Build the column headers (time labels) from the requested window. We pick
 * a column granularity based on the window duration:
 * - <= 6h  → 1h columns
 * - <= 24h → 2h columns (default)
 * - >  24h → 4h columns
 */
function buildColumns(windowStart, windowEnd) {
  const ms = windowEnd - windowStart;
  let stepMin;
  if (ms <= 6 * 3600_000) stepMin = 60;
  else if (ms <= 24 * 3600_000) stepMin = 120;
  else stepMin = 240;

  // Align column starts to the wall-clock hour so the grid reads naturally
  // ("starts at 06:00") rather than at an arbitrary offset.
  const start = new Date(windowStart);
  start.setMinutes(0, 0, 0);

  const cols = [];
  let cursor = new Date(start);
  while (cursor < windowEnd) {
    cols.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + stepMin * 60_000);
  }
  return { columns: cols, stepMin };
}

/**
 * Each scheduled dose belongs to exactly one column — the column whose
 * start time is the largest <= the dose's scheduled_time.
 */
function bucketByColumn(scheduledRows, columns) {
  // Returns Map<rxId, Map<columnIndex, scheduledRow>>
  const byRxAndCol = new Map();
  for (const row of scheduledRows) {
    const t = new Date(row.scheduled_time);
    let colIdx = -1;
    for (let i = 0; i < columns.length; i += 1) {
      const next = columns[i + 1];
      if (t >= columns[i] && (next === undefined || t < next)) {
        colIdx = i;
        break;
      }
    }
    if (colIdx < 0) continue;
    if (!byRxAndCol.has(row.medication_request_id)) {
      byRxAndCol.set(row.medication_request_id, new Map());
    }
    byRxAndCol.get(row.medication_request_id).set(colIdx, row);
  }
  return byRxAndCol;
}

const MARGrid = ({
  scheduledRows,
  windowStart,
  windowEnd,
  density = 'comfortable',
  onCellClick,
  pendingRequestIds,
  tick,
}) => {
  const theme = useTheme();

  const { columns, stepMin } = useMemo(
    () => buildColumns(windowStart, windowEnd),
    [windowStart, windowEnd],
  );

  // Group scheduled rows by medication. Each "row" object carries the
  // full list of its scheduledRows so MedRowHeader can compute things
  // like "last given" from it.
  const rows = useMemo(() => {
    const byRx = new Map();
    for (const r of scheduledRows) {
      if (!byRx.has(r.medication_request_id)) {
        byRx.set(r.medication_request_id, []);
      }
      byRx.get(r.medication_request_id).push(r);
    }
    return Array.from(byRx.entries()).map(([rxId, list]) => ({
      medicationRequestId: rxId,
      scheduledRows: list,
    }));
  }, [scheduledRows]);

  const cellsByRow = useMemo(() => bucketByColumn(scheduledRows, columns), [scheduledRows, columns]);

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No scheduled medication doses in this window.</Typography>
        <Typography variant="caption">
          PRN orders appear in the panel below. Try a wider window to see scheduled doses.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', overflow: 'auto', maxHeight: 'calc(100vh - 360px)' }}>
      {/* Column header row */}
      <Box
        sx={{
          display: 'flex',
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 2,
          borderBottom: `2px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            width: ROW_HEADER_WIDTH,
            position: 'sticky',
            left: 0,
            bgcolor: 'background.paper',
            zIndex: 3,
            borderRight: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1, py: 0.5, display: 'block', fontWeight: 600 }}
          >
            Medication
          </Typography>
        </Box>
        {columns.map((c, i) => (
          <Box
            key={i}
            sx={{
              flex: '0 0 auto',
              width: density === 'compact' ? 32 : density === 'spacious' ? 64 : 48,
              borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              px: 0.5,
              py: 0.5,
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 500 }}>
              {c.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Body */}
      <Stack>
        {rows.map((row) => {
          const colMap = cellsByRow.get(row.medicationRequestId) || new Map();
          const isPending = pendingRequestIds?.has(row.medicationRequestId);
          return (
            <Box key={row.medicationRequestId} sx={{ display: 'flex' }}>
              <MedRowHeader row={row} density={density} />
              {columns.map((_, i) => (
                <MARCell
                  key={i}
                  scheduledRow={colMap.get(i)}
                  density={density}
                  isPending={isPending && colMap.has(i)}
                  onClick={onCellClick}
                  tick={tick}
                />
              ))}
            </Box>
          );
        })}
      </Stack>

      {/* Hidden helper so screen readers can announce the granularity */}
      <Box sx={{ position: 'absolute', left: -9999 }} aria-live="polite">
        Time grid showing {columns.length} columns at {stepMin}-minute intervals
      </Box>
    </Box>
  );
};

export default MARGrid;
