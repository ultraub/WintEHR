/**
 * MedRowHeader — left rail of one MAR row (#116 Phase 5.1).
 *
 * Compresses the order's identity into 160 px:
 *   ⚠ {Med name} {dose route}     [STAT chip when applicable]
 *   {indication chip}
 *   Last {time} ({ago})
 *
 * Pulled into its own file because it has enough conditional bits
 * (high-alert badge, indication chip, last-given clock) that inlining
 * would make MARGrid hard to scan.
 */

import React, { useMemo } from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { ReportProblemOutlined as HighAlertIcon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

import { formatRelativeDate } from '../../../../core/fhir/utils/dateFormatUtils';

const ROW_WIDTH = 200;

const MedRowHeader = ({ row, density = 'comfortable', onClickMedication }) => {
  const theme = useTheme();

  // Find the most recent admin across all scheduled rows for this med. The
  // scheduled-tasks payload doesn't bundle "last given" per med, so we
  // synthesize it from whichever scheduled row carries an admin record.
  const lastGiven = useMemo(() => {
    const admins = row.scheduledRows
      .map((r) => r.administration)
      .filter((a) => a && a.status === 'completed');
    if (!admins.length) return null;
    admins.sort((a, b) => new Date(b.effective_datetime) - new Date(a.effective_datetime));
    return new Date(admins[0].effective_datetime);
  }, [row.scheduledRows]);

  const rowHeight = density === 'compact' ? 24 : density === 'spacious' ? 48 : 36;

  const sample = row.scheduledRows[0] || {};
  return (
    <Box
      sx={{
        width: ROW_WIDTH,
        height: rowHeight,
        px: 1,
        py: 0.25,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        // The row is a fixed-height lane in a grid; anything the 200px rail
        // can't fit must clip, not bleed over neighboring rows (long
        // dose_text like "100 mg · PO (by mouth) · Twice daily" used to
        // wrap and garble the whole rail).
        overflow: 'hidden',
        borderRight: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        bgcolor: 'background.paper',
        position: 'sticky',
        left: 0,
        zIndex: 1,
        cursor: onClickMedication ? 'pointer' : 'default',
        '&:hover': onClickMedication ? { bgcolor: alpha(theme.palette.action.hover, 0.5) } : undefined,
      }}
      onClick={() => onClickMedication?.(row)}
    >
      <Stack direction="row" alignItems="center" spacing={0.5}>
        {sample.high_alert && (
          <Tooltip title="High-alert medication">
            <HighAlertIcon fontSize="inherit" sx={{ fontSize: 14, color: theme.palette.error.main }} />
          </Tooltip>
        )}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: density === 'compact' ? '0.72rem' : '0.8rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {sample.medication_display}
        </Typography>
      </Stack>
      {density !== 'compact' && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, minWidth: 0 }}>
          {sample.dose_text && (
            <Tooltip title={sample.dose_text} enterDelay={500}>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ fontSize: '0.65rem', minWidth: 0, flexShrink: 1 }}
              >
                {sample.dose_text}
              </Typography>
            </Tooltip>
          )}
          {sample.indication && (
            <Tooltip title={sample.indication} enterDelay={500}>
              <Chip
                label={sample.indication}
                size="small"
                variant="outlined"
                sx={{
                  height: 14,
                  fontSize: '0.6rem',
                  flexShrink: 0,
                  maxWidth: 96,
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            </Tooltip>
          )}
        </Stack>
      )}
      {density === 'spacious' && lastGiven && (
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
          Last {lastGiven.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {' '}({formatRelativeDate(lastGiven)})
        </Typography>
      )}
    </Box>
  );
};

export default MedRowHeader;
export const ROW_HEADER_WIDTH = ROW_WIDTH;
