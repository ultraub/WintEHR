/**
 * ProgressRing
 * "How much of this is done" as a ring: the share completed, its percentage
 * in the middle, and under it the name, the count and a plain-word status.
 * Used where a handful of measures are compared against one target.
 *
 * The status is decided by the caller (`tone` + `status` text), so the
 * colour always has a word beside it. The ring draws in once on mount; the
 * number does not animate.
 *
 * Props: `value` (0-100), `label`, `caption` ("84 of 145"), `status`
 * ("Below target"), `tone` ('positive' | 'attention' | 'critical' |
 * 'neutral'), `size` (px, default 124), `onClick`.
 */
import React from 'react';
import { Box, ButtonBase, Typography, useTheme } from '@mui/material';
import { keyframes } from '@mui/system';
import { getToneColors } from '../../utils/statusDisplay';

const STROKE = 13;

const ProgressRing = ({ value, label, caption, status, tone = 'neutral', size = 124, onClick }) => {
  const theme = useTheme();
  const colors = getToneColors(theme, tone);
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = (size - STROKE) / 2 - 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  // Rounded ends add half a stroke each: on a short arc they turn it into a
  // blob, so a small value gets square ends and reads as a slice.
  const arcLength = circumference - offset;
  const draw = keyframes`from { stroke-dashoffset: ${circumference}; } to { stroke-dashoffset: ${offset}; }`;
  const fill = tone === 'neutral' ? theme.palette.primary.main : colors.border;

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, width: '100%' }}>
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <Box
          component="svg"
          role="img"
          aria-label={`${label}: ${Math.round(percent)}%${status ? `, ${status.toLowerCase()}` : ''}`}
          viewBox={`0 0 ${size} ${size}`}
          sx={{ width: size, height: size, transform: 'rotate(-90deg)' }}
        >
          {/* a thin outer echo in the status tint */}
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="none" stroke={tone === 'neutral' ? theme.palette.divider : colors.bg} strokeWidth="2" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.palette.action.hover} strokeWidth={STROKE} />
          {percent > 0 && (
            <Box
              component="circle"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={fill}
              strokeWidth={STROKE}
              strokeLinecap={arcLength > STROKE * 2 ? 'round' : 'butt'}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              sx={{
                animation: `${draw} 700ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
          )}
        </Box>
        <Typography
          component="span"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.typography.fontFamilyMonospace,
            fontWeight: 700,
            fontSize: '1.3rem',
            letterSpacing: '-0.04em',
            color: 'text.primary',
          }}
        >
          {Math.round(percent)}%
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9375rem' }}>{label}</Typography>
        {caption && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ fontFamily: theme.typography.fontFamilyMonospace, fontWeight: 600 }}>
            {caption}
          </Typography>
        )}
        {status && (
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              mt: 0.75,
              px: 1.25,
              py: '2px',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: colors.fg,
              backgroundColor: colors.bg,
            }}
          >
            {status}
          </Box>
        )}
      </Box>
    </Box>
  );

  if (!onClick) return body;
  return (
    <ButtonBase onClick={onClick} focusRipple sx={{ display: 'block', width: '100%', borderRadius: 2, py: 0.5, color: 'inherit' }}>
      {body}
    </ButtonBase>
  );
};

export default ProgressRing;
