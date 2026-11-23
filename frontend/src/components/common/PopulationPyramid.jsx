/**
 * PopulationPyramid
 * Age bands down the middle, one group's bars growing left and the other's
 * growing right, on a shared scale, oldest at the top. The standard picture
 * of a population's age structure: its outline shows at a glance whether
 * the population is young, old, or uneven between the two groups.
 *
 * Two series, so two colours (theme.palette.chart.series) plus a legend and
 * a count on every bar: identity never rests on colour alone.
 *
 * Props
 *   rows    [{ band, left, right }] youngest first (drawn oldest at the top)
 *   leftLabel / rightLabel   series names
 */
import React from 'react';
import { Box, Stack, Tooltip, Typography, useTheme } from '@mui/material';

const Swatch = ({ color, label }) => (
  <Stack direction="row" spacing={0.75} alignItems="center">
    <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: 0.5, backgroundColor: color }} />
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Stack>
);

const PopulationPyramid = ({ rows = [], leftLabel = 'Female', rightLabel = 'Male' }) => {
  const theme = useTheme();
  const [leftColor, rightColor] = theme.palette.chart?.series
    || [theme.palette.primary.main, theme.palette.secondary.main];
  const scaleMax = Math.max(1, ...rows.map((row) => Math.max(row.left || 0, row.right || 0)));
  const ordered = [...rows].reverse();

  const bar = (value, color, side) => (
    <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: side === 'left' ? 'row-reverse' : 'row', gap: 0.75, minWidth: 0 }}>
      <Box
        sx={{
          height: 16,
          width: `calc((100% - 28px) * ${value / scaleMax})`,
          minWidth: value > 0 ? 3 : 0,
          backgroundColor: color,
          borderRadius: side === 'left' ? '4px 0 0 4px' : '0 4px 4px 0',
        }}
      />
      <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', color: value > 0 ? 'text.primary' : 'text.disabled', minWidth: 20, textAlign: side === 'left' ? 'right' : 'left' }}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <Box>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 1.5 }}>
        <Swatch color={leftColor} label={leftLabel} />
        <Swatch color={rightColor} label={rightLabel} />
      </Stack>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', rowGap: '2px' }}>
        {ordered.map((row) => (
          <Tooltip
            key={row.band}
            title={`Age ${row.band}: ${row.left || 0} ${leftLabel.toLowerCase()}, ${row.right || 0} ${rightLabel.toLowerCase()}`}
            placement="top"
            enterDelay={200}
          >
            <Box
              component="li"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 52px minmax(0, 1fr)',
                alignItems: 'center',
                py: 0.25,
                borderRadius: 0.5,
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              {bar(row.left || 0, leftColor, 'left')}
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {row.band}
              </Typography>
              {bar(row.right || 0, rightColor, 'right')}
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Typography variant="caption" color="text.disabled" component="div" sx={{ textAlign: 'center', mt: 0.5 }}>
        Age in years
      </Typography>
    </Box>
  );
};

export default PopulationPyramid;
