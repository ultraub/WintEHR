/**
 * StatTile
 * The one way to show a headline number ("Active problems 9").
 *
 * Quiet by default: label, number, optional caption, on a plain surface.
 * Colour is earned: a `tone` only shows when the value is non-zero, so
 * "Out of stock 0" looks like every other calm tile instead of an alarm.
 *
 * Props
 *   label      what the number counts
 *   value      number or short string; null/undefined renders an em dash
 *   unit       small text after the value
 *   caption    one line under the value (string or node)
 *   icon       optional, in a small tinted tile at the top right
 *   tone       'neutral' (default) | 'positive' | 'info' | 'attention' | 'critical'
 *   toneWhenZero  set true for the rare tile where 0 is itself the problem
 *   chips      [{ label, count?, tone? }] small secondary facts
 *   progress   0–100 with optional `progressLabel`
 *   loading    skeleton in place of the value
 *   onClick    makes the whole tile a button
 */
import React from 'react';
import { Box, ButtonBase, LinearProgress, Skeleton, Stack, Typography, alpha, useTheme } from '@mui/material';
import { getToneColors } from '../../utils/statusDisplay';

const isZeroValue = (value) => value === 0 || value === '0' || value === null || value === undefined || value === '';

const StatTile = ({
  label,
  value,
  unit,
  caption,
  icon,
  tone = 'neutral',
  toneWhenZero = false,
  chips = [],
  progress,
  progressLabel,
  loading = false,
  onClick,
  sx,
  ...props
}) => {
  const theme = useTheme();
  const activeTone = tone !== 'neutral' && (toneWhenZero || !isZeroValue(value)) ? tone : 'neutral';
  const colors = getToneColors(theme, activeTone);
  const toned = activeTone !== 'neutral';
  const hasValue = value !== null && value !== undefined && value !== '';
  // The numeral face is for figures. A value with words in it ("1 of 4")
  // stays in the text face, where its spacing is right.
  const numeric = typeof value === 'number' || /^[\d.,%\s/+×–-]+$/.test(String(value ?? ''));

  const body = (
    <Box
      data-tone={activeTone}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        textAlign: 'left',
        p: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        // a toned tile gets a 3px rule on its leading edge, nothing more
        boxShadow: toned ? `inset 3px 0 0 ${colors.border}` : 'none',
        ...sx,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, letterSpacing: 0.2 }}>
          {label}
        </Typography>
        {icon && (
          <Box
            aria-hidden
            sx={{
              flex: '0 0 28px',
              height: 28,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'primary.main',
              backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
              '& svg': { fontSize: 16 },
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>

      <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mt: 0.5 }}>
        {loading ? (
          <Skeleton variant="text" width={56} sx={{ fontSize: '1.75rem' }} />
        ) : (
          <Typography
            component="span"
            sx={{
              fontFamily: numeric ? theme.typography.fontFamilyMonospace : undefined,
              fontSize: '1.75rem',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: numeric ? '-0.04em' : '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              color: toned ? colors.fg : 'text.primary',
            }}
          >
            {hasValue ? value : '—'}
          </Typography>
        )}
        {unit && !loading && (
          <Typography component="span" variant="body2" color="text.secondary">
            {unit}
          </Typography>
        )}
      </Stack>

      {caption && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
          {caption}
        </Typography>
      )}

      {chips.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
          {chips.map((chip, index) => {
            const chipColors = getToneColors(theme, chip.tone || 'muted');
            return (
              <Box
                key={index}
                component="span"
                sx={{
                  px: 0.75,
                  height: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 0.5,
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: chipColors.fg,
                  backgroundColor: chipColors.bg,
                }}
              >
                {chip.count !== undefined && chip.count !== null ? `${chip.count} ${chip.label}` : chip.label}
              </Box>
            );
          })}
        </Stack>
      )}

      {progress !== undefined && progress !== null && (
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">{progressLabel}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(progress)}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, progress))}
            sx={{ height: 4, borderRadius: 2, mt: 0.25 }}
          />
        </Box>
      )}
    </Box>
  );

  if (!onClick) return React.cloneElement(body, props);

  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        display: 'block',
        width: '100%',
        height: '100%',
        borderRadius: 1,
        '&:hover > div': { borderColor: 'text.disabled' },
        '&.Mui-focusVisible > div': { borderColor: 'primary.main' },
      }}
      {...props}
    >
      {body}
    </ButtonBase>
  );
};

export default StatTile;
