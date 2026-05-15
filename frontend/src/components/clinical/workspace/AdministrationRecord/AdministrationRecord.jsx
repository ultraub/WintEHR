/**
 * AdministrationRecord — the MAR tab shell (#116 Phase 5.1).
 *
 * Wires together the data hook, filter bar, time grid, PRN pane, and
 * quick-doc popover. Owns:
 *   - window picker state (which preset is active)
 *   - status filter (Due Now / Past Due / Given / All)
 *   - density toggle
 *   - popover anchor + target tracking
 *   - the "now" tick used by FilterBar and propagated through the grid
 *
 * The tab is the nurse's primary workflow surface — keep it readable.
 * Each interactive sub-component is its own file; this shell stays
 * thin and orchestral.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';

import FilterBar, { WINDOW_PRESETS } from './FilterBar';
import MARGrid from './MARGrid';
import PRNPane from './PRNPane';
import QuickAdminPopover from './QuickAdminPopover';
import { classifyCell } from './MARCell';
import { useScheduledTasks } from './useScheduledTasks';

const PRESET_BY_ID = Object.fromEntries(WINDOW_PRESETS.map((p) => [p.id, p]));

const AdministrationRecord = ({ patientId, currentPatient }) => {
  const effectivePatientId = patientId || currentPatient?.id;

  const [now, setNow] = useState(() => new Date());
  const [windowPresetId, setWindowPresetId] = useState('shift');
  // Default to "All" — the grid should show the whole shift on open, the
  // way a paper/eMAR does. "Due Now" is a focus tool the nurse reaches
  // for, not the landing view: defaulting to it makes the grid look empty
  // on every patient whose next dose isn't within the ±30-min due window.
  const [statusFilter, setStatusFilter] = useState('all');
  const [density, setDensity] = useState('comfortable');
  const [popover, setPopover] = useState({ anchorEl: null, row: null, prn: null });
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  // Auto-tick — the FilterBar's "now" + the grid's cell classification both
  // depend on wall-clock minute granularity.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const preset = PRESET_BY_ID[windowPresetId] || PRESET_BY_ID.shift;
  const windowStart = useMemo(
    () => new Date(now.getTime() - preset.backHours * 3600_000),
    [now, preset],
  );
  const windowEnd = useMemo(
    () => new Date(now.getTime() + preset.forwardHours * 3600_000),
    [now, preset],
  );

  const { data, loading, error, refetch, tick, markPending, pendingRequestIds } =
    useScheduledTasks({ patientId: effectivePatientId, windowStart, windowEnd });

  useEffect(() => {
    if (data) setLastUpdatedAt(new Date());
  }, [data]);

  // Pre-compute "due in next hour" for the FilterBar chip.
  const dueSoonCount = useMemo(() => {
    if (!data?.scheduled) return 0;
    const inOneHour = new Date(now.getTime() + 3600_000);
    return data.scheduled.filter((row) => {
      if (row.administration) return false;
      const t = new Date(row.scheduled_time);
      return t >= now && t <= inOneHour;
    }).length;
  }, [data, now]);

  // Apply the status filter to the scheduled rows the grid sees.
  const filteredScheduled = useMemo(() => {
    if (!data?.scheduled) return [];
    if (statusFilter === 'all') return data.scheduled;
    return data.scheduled.filter((row) => {
      const state = classifyCell(row, now);
      if (statusFilter === 'due') return state === 'due-now';
      if (statusFilter === 'past-due') return state === 'past-due' || state === 'missed';
      if (statusFilter === 'given') return state === 'given' || state === 'late-given';
      return true;
    });
  }, [data, statusFilter, now]);

  const handleCellClick = useCallback((row) => {
    // Anchor the popover to the clicked cell's element. We don't have a
    // direct ref; MARCell forwards its onClick with the row, so use the
    // active element which is the cell that just received focus.
    setPopover({
      anchorEl: document.activeElement,
      row,
      prn: null,
    });
  }, []);

  const handlePrnGive = useCallback((prn) => {
    setPopover({
      anchorEl: document.activeElement,
      row: null,
      prn,
    });
  }, []);

  const handlePopoverClose = () => setPopover({ anchorEl: null, row: null, prn: null });

  return (
    <Box>
      <FilterBar
        now={now}
        dueSoonCount={dueSoonCount}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        windowPreset={windowPresetId}
        onWindowPreset={setWindowPresetId}
        density={density}
        onDensity={setDensity}
        lastUpdatedAt={lastUpdatedAt}
        isLoading={loading}
        onRefresh={refetch}
      />

      {!effectivePatientId && (
        <Alert severity="info" sx={{ m: 2 }}>
          Pick a patient to load the Administration Record.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          Failed to load administration data: {error.message}
        </Alert>
      )}

      {loading && !data && (
        <Stack direction="row" alignItems="center" justifyContent="center" sx={{ py: 6, gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Loading administration record…</Typography>
        </Stack>
      )}

      {data && (
        <>
          <MARGrid
            scheduledRows={filteredScheduled}
            windowStart={windowStart}
            windowEnd={windowEnd}
            density={density}
            onCellClick={handleCellClick}
            pendingRequestIds={pendingRequestIds}
            tick={tick}
            /* When the status filter hid everything but the window does
               have doses, MARGrid should say "filter hides them", not
               "none scheduled" — pass the hint so its empty state is
               accurate. */
            filterHidEverything={
              statusFilter !== 'all'
              && (data.scheduled || []).length > 0
              && filteredScheduled.length === 0
            }
            activeFilterLabel={statusFilter}
          />
          <PRNPane prnOrders={data.prn_orders || []} onGiveNow={handlePrnGive} />
        </>
      )}

      <QuickAdminPopover
        anchorEl={popover.anchorEl}
        scheduledRow={popover.row}
        prnOrder={popover.prn}
        onClose={handlePopoverClose}
        onSubmitStart={(rxId) => markPending(rxId)}
        onSubmitDone={refetch}
      />
    </Box>
  );
};

export default AdministrationRecord;
