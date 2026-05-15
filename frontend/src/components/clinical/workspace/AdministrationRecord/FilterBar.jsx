/**
 * FilterBar — header strip for the MAR tab (#116 Phase 5.1).
 *
 * Five regions, left to right:
 *   • Now bar (current time, count chip "12 due in next hour")
 *   • Status pills (Due Now / Past Due / Given / All)
 *   • Window picker (Last 4h / Shift / Today)
 *   • Density toggle
 *   • Refresh indicator + manual refresh
 *
 * The intent is "answer 'what's due in the next hour?' in <2 seconds."
 * The count chip on the Now bar earns the most of that — it summarizes
 * the grid before the nurse scans it.
 */

import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ViewAgenda as CompactIcon,
  ViewStream as ComfortableIcon,
  ViewModule as SpaciousIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

export const STATUS_FILTERS = [
  { id: 'due', label: 'Due Now' },
  { id: 'past-due', label: 'Past Due' },
  { id: 'given', label: 'Given' },
  { id: 'all', label: 'All' },
];

export const WINDOW_PRESETS = [
  { id: '4h-back', label: 'Last 4h', backHours: 4, forwardHours: 0 },
  { id: 'shift', label: 'Shift (±6h)', backHours: 6, forwardHours: 6 },
  { id: 'today', label: 'Today (24h)', backHours: 12, forwardHours: 12 },
];

const FilterBar = ({
  now,
  dueSoonCount,
  statusFilter,
  onStatusFilter,
  windowPreset,
  onWindowPreset,
  density,
  onDensity,
  lastUpdatedAt,
  isLoading,
  onRefresh,
}) => {
  const theme = useTheme();
  const lastFmt = lastUpdatedAt
    ? `Last updated ${Math.max(1, Math.round((now - lastUpdatedAt) / 1000))}s ago`
    : 'Never updated';

  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{
        px: 2,
        py: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        flexWrap: 'wrap',
      }}
    >
      {/* Now bar */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 200 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </Typography>
        {dueSoonCount > 0 && (
          <Chip
            label={`${dueSoonCount} due next hour`}
            size="small"
            color="warning"
            sx={{ height: 22, fontWeight: 500 }}
          />
        )}
      </Stack>

      {/* Status pills */}
      <ToggleButtonGroup
        value={statusFilter}
        exclusive
        onChange={(_e, v) => v && onStatusFilter(v)}
        size="small"
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 0.25, px: 1 } }}
      >
        {STATUS_FILTERS.map((f) => (
          <ToggleButton key={f.id} value={f.id}>{f.label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Window preset */}
      <ToggleButtonGroup
        value={windowPreset}
        exclusive
        onChange={(_e, v) => v && onWindowPreset(v)}
        size="small"
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 0.25, px: 1 } }}
      >
        {WINDOW_PRESETS.map((w) => (
          <ToggleButton key={w.id} value={w.id}>{w.label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ flex: 1 }} />

      {/* Density */}
      <ToggleButtonGroup
        value={density}
        exclusive
        onChange={(_e, v) => v && onDensity(v)}
        size="small"
      >
        <Tooltip title="Compact"><ToggleButton value="compact"><CompactIcon fontSize="small" /></ToggleButton></Tooltip>
        <Tooltip title="Comfortable"><ToggleButton value="comfortable"><ComfortableIcon fontSize="small" /></ToggleButton></Tooltip>
        <Tooltip title="Spacious"><ToggleButton value="spacious"><SpaciousIcon fontSize="small" /></ToggleButton></Tooltip>
      </ToggleButtonGroup>

      {/* Refresh status */}
      <Tooltip title={lastFmt}>
        <IconButton size="small" onClick={onRefresh} disabled={isLoading}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

export default FilterBar;
