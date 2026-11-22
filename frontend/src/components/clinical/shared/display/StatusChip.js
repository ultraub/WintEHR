/**
 * StatusChip
 * The one way to draw a status. Colour comes from the status's tone
 * (utils/statusDisplay.js), never from the call site, so "Active" looks the
 * same on a condition, a prescription, an order and an appointment.
 *
 * Quiet by design: a soft tint and a small dot, no solid fills, no pulsing.
 *
 * Props: `status` (any FHIR or app status string), `label` (override the
 * humanised text), `tone` (override the mapped tone — rarely right),
 * `size` ('small' | 'medium'), `showDot`.
 * `variant`, `showIcon`, `urgency`, `clinicalContext` and `department` from
 * the previous implementation are accepted and ignored.
 */
import React from 'react';
import { Box, useTheme } from '@mui/material';
import { getStatusLabel, getStatusTone, getToneColors } from '../../../../utils/statusDisplay';

const StatusChip = ({
  status,
  label,
  tone,
  size = 'small',
  showDot = true,
  sx,
  // legacy props, intentionally unused
  variant: _variant,
  showIcon: _showIcon,
  urgency: _urgency,
  clinicalContext: _clinicalContext,
  department: _department,
  ...props
}) => {
  const theme = useTheme();
  const resolvedTone = tone || getStatusTone(status);
  const colors = getToneColors(theme, resolvedTone);
  const small = size === 'small';

  return (
    <Box
      component="span"
      data-tone={resolvedTone}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        height: small ? 22 : 26,
        px: small ? 1 : 1.25,
        borderRadius: 1,
        backgroundColor: colors.bg,
        color: colors.fg,
        fontSize: small ? '0.75rem' : '0.8125rem',
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...sx,
      }}
      {...props}
    >
      {showDot && (
        <Box
          component="span"
          aria-hidden
          sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.dot, flexShrink: 0 }}
        />
      )}
      {label || getStatusLabel(status)}
    </Box>
  );
};

export default React.memo(StatusChip);
