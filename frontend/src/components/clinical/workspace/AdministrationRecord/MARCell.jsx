/**
 * MARCell — one grid cell representing one scheduled dose
 * (#116 Phase 5.1).
 *
 * Pure presentational. Reads the scheduled-task row from the backend
 * (which already pre-joined the matching MedicationAdministration when
 * one exists), classifies the cell state, and renders a status glyph
 * with severity-tinted color. Click handler is owned by the parent —
 * MARCell just announces intent.
 *
 * Cell state grammar:
 *   given         ✓  green static
 *   late-given    ✓  green static with dashed border
 *   held          —  grey
 *   refused       R  dark red with diagonal stripe (handled via CSS)
 *   missed        ✕  red static (>2h past, no record)
 *   past-due      ●  orange pulsing (1s)
 *   due-now       ●  amber pulsing (2s, calmer)
 *   future        ○  outline, no animation
 *   pending       ●  grey + opacity pulse (200ms optimistic flash)
 *
 * The pulse animation reuses the keyframes from DrugSafetyIndicator
 * (kept inline here so the cell can tune duration per state) rather
 * than adding another global keyframe definition.
 */

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  CheckCircle as GivenIcon,
  Circle as DotIcon,
  RadioButtonUnchecked as ScheduledIcon,
  Cancel as MissedIcon,
  PauseCircle as HeldIcon,
  Block as RefusedIcon,
} from '@mui/icons-material';

import { getSeverityColor } from '../../../../themes/clinicalThemeUtils';

/**
 * Classify a scheduled-task row + current wall-clock time into one of the
 * cell states above. Pulled to module scope so the table can sort/filter
 * by state without re-rendering cells.
 */
export function classifyCell(scheduledRow, now = new Date()) {
  if (!scheduledRow) return 'empty';

  const admin = scheduledRow.administration;
  if (admin) {
    if (admin.status === 'completed') {
      // Determine if late-charted via the extension we wrote on the server side
      // — but the GET payload doesn't currently surface extensions, so for 5.1
      // we approximate: if effective_datetime is >60min after scheduled, treat
      // as late-given for the dashed-border visual cue.
      const eff = new Date(admin.effective_datetime);
      const sched = new Date(scheduledRow.scheduled_time);
      const diffMinutes = Math.abs(eff - sched) / 60_000;
      return diffMinutes > 60 ? 'late-given' : 'given';
    }
    if (admin.status === 'on-hold') return 'held';
    if (admin.status === 'not-done') return 'refused';
    return 'given'; // in-progress, etc. — fall through to "looks done"
  }

  const sched = new Date(scheduledRow.scheduled_time);
  const deltaMin = (sched - now) / 60_000;
  if (deltaMin > 30) return 'future';
  if (deltaMin >= -30) return 'due-now';     // ±30min window = "right now"
  if (deltaMin >= -120) return 'past-due';   // up to 2h past
  return 'missed';                            // >2h past with no record
}

const STATE_CONFIG = {
  empty:       { Icon: null,           severity: null,       pulse: null, label: '' },
  given:       { Icon: GivenIcon,      severity: 'low',      pulse: null, label: 'Given' },
  'late-given':{ Icon: GivenIcon,      severity: 'low',      pulse: null, label: 'Late-charted', dashedBorder: true },
  held:        { Icon: HeldIcon,       severity: 'normal',   pulse: null, label: 'Held' },
  refused:     { Icon: RefusedIcon,    severity: 'critical', pulse: null, label: 'Refused', stripe: true },
  missed:      { Icon: MissedIcon,     severity: 'critical', pulse: null, label: 'Missed' },
  'past-due':  { Icon: DotIcon,        severity: 'high',     pulse: 1.0,  label: 'Past due' },
  'due-now':   { Icon: DotIcon,        severity: 'moderate', pulse: 2.0,  label: 'Due now' },
  future:      { Icon: ScheduledIcon,  severity: 'normal',   pulse: null, label: 'Scheduled' },
  pending:     { Icon: DotIcon,        severity: 'normal',   pulse: 0.3,  label: 'Saving…' },
};

// Pixel sizes per density token. Match the convention in TimelineVisualization
// so a future density-toggle on the MAR honours the same scale.
const DENSITY = {
  compact:     { w: 32, h: 24, fontSize: '0.65rem', iconSize: 14 },
  comfortable: { w: 48, h: 36, fontSize: '0.7rem',  iconSize: 18 },
  spacious:    { w: 64, h: 48, fontSize: '0.75rem', iconSize: 22 },
};

const MARCell = ({
  scheduledRow,
  density = 'comfortable',
  isPending = false,
  onClick,
  tick, // re-render trigger from the parent's auto-tick
}) => {
  const theme = useTheme();
  const dims = DENSITY[density] || DENSITY.comfortable;

  // tick is unused here intentionally — its presence in props triggers
  // re-renders via React's prop-diff, which lets classifyCell pick up
  // the new wall-clock time without us threading `now` through every layer.
  void tick;

  const state = isPending ? 'pending' : classifyCell(scheduledRow, new Date());
  const cfg = STATE_CONFIG[state];

  if (state === 'empty') {
    return (
      <Box
        sx={{
          width: dims.w,
          height: dims.h,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        }}
      />
    );
  }

  const color = cfg.severity
    ? getSeverityColor(theme, cfg.severity)
    : theme.palette.text.primary;

  const tooltip = (
    <Box>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
        {cfg.label}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {scheduledRow.medication_display}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        Scheduled {new Date(scheduledRow.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Typography>
      {scheduledRow.administration && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          Given {new Date(scheduledRow.administration.effective_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      )}
      {scheduledRow.administration?.status_reason && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          Reason: {scheduledRow.administration.status_reason}
        </Typography>
      )}
    </Box>
  );

  const Icon = cfg.Icon;

  return (
    <Tooltip title={tooltip} placement="top" enterDelay={350}>
      <Box
        role="button"
        tabIndex={0}
        aria-label={`${scheduledRow.medication_display}, ${cfg.label}, scheduled ${scheduledRow.scheduled_time}`}
        onClick={() => onClick?.(scheduledRow, state)}
        onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(scheduledRow, state); }}
        sx={{
          width: dims.w,
          height: dims.h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          backgroundColor: alpha(color, 0.08),
          ...(cfg.dashedBorder && {
            outline: `1px dashed ${color}`,
            outlineOffset: -2,
          }),
          ...(cfg.stripe && {
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${alpha(color, 0.18)} 4px, ${alpha(color, 0.18)} 8px)`,
          }),
          ...(cfg.pulse && {
            animation: `mar-pulse-${state} ${cfg.pulse}s ease-in-out infinite`,
            [`@keyframes mar-pulse-${state}`]: {
              '0%, 100%': { backgroundColor: alpha(color, 0.08) },
              '50%':      { backgroundColor: alpha(color, 0.28) },
            },
          }),
          transition: 'background-color 0.2s, transform 0.2s',
          '&:hover': {
            backgroundColor: alpha(color, 0.18),
          },
          '&:focus-visible': {
            outline: `2px solid ${color}`,
            outlineOffset: -2,
          },
        }}
      >
        {Icon && <Icon sx={{ fontSize: dims.iconSize, color }} />}
      </Box>
    </Tooltip>
  );
};

export default MARCell;
