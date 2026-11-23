/**
 * RangeBar
 * Where a value sits against its reference range: a short track with the
 * normal band marked and a tick at the value, so "inside or outside, and by
 * how much" is read before the number is. The numbers stay beside it; the
 * bar never stands alone.
 *
 * Props: `value`, `low`, `high` (numbers; either bound may be missing),
 * `tone` (the value's status tone: 'neutral' inside the range), `width`.
 */
import React from 'react';
import { Box, useTheme } from '@mui/material';
import { getToneColors } from '../../utils/statusDisplay';

const RangeBar = ({ value, low, high, tone = 'neutral', width = 72 }) => {
  const theme = useTheme();
  const hasLow = Number.isFinite(low);
  const hasHigh = Number.isFinite(high);
  if (!Number.isFinite(value) || (!hasLow && !hasHigh)) return null;

  // The band takes the middle half of the track; a one-sided range borrows
  // a span from the bound it has.
  const span = hasLow && hasHigh ? high - low : Math.abs(hasLow ? low : high) || 1;
  const bandLow = hasLow ? low : high - span;
  const bandHigh = hasHigh ? high : low + span;
  const min = bandLow - span / 2;
  const max = bandHigh + span / 2;
  const at = (n) => `${Math.max(0, Math.min(100, ((n - min) / (max - min)) * 100))}%`;
  const marker = tone === 'neutral' ? theme.palette.text.primary : getToneColors(theme, tone).border;

  return (
    <Box
      role="img"
      aria-label={`Value ${value} against a reference range of ${hasLow ? low : 'no lower bound'} to ${hasHigh ? high : 'no upper bound'}`}
      sx={{ position: 'relative', width, height: 10, flexShrink: 0 }}
    >
      <Box sx={{ position: 'absolute', left: 0, right: 0, top: 4, height: 2, borderRadius: 1, backgroundColor: 'divider' }} />
      <Box
        sx={{
          position: 'absolute',
          top: 2,
          height: 6,
          borderRadius: 1,
          left: hasLow ? at(bandLow) : 0,
          right: hasHigh ? `calc(100% - ${at(bandHigh)})` : 0,
          backgroundColor: 'action.selected',
        }}
      />
      <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: 3, ml: '-1.5px', borderRadius: 1, left: at(value), backgroundColor: marker }} />
    </Box>
  );
};

export default RangeBar;
