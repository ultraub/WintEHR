/**
 * PRNPane — PRN medications panel below the MAR grid (#116 Phase 5.1).
 *
 * PRN orders don't have a schedule, so they don't fit the grid model. They
 * live in their own collapsible panel: one card per PRN order with the
 * dose-range, PRN reason, last-given timestamp, and "doses in last 24h"
 * count (max-dose ceiling guard).
 *
 * Click "Give now" → opens the same quick-doc popover the grid cells use.
 * The popover knows it's a PRN dose because `prnReason` is passed through.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  ReportProblemOutlined as HighAlertIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

import { formatRelativeDate } from '../../../../core/fhir/utils/dateFormatUtils';

const PRNPane = ({ prnOrders = [], onGiveNow }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(true);

  if (prnOrders.length === 0) return null;

  return (
    <Box
      sx={{
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.default, 0.4),
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 2,
          py: 0.75,
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) },
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
          PRN Medications · {prnOrders.length}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small">
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 2, pb: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {prnOrders.map((prn) => {
              const last = prn.last_given ? new Date(prn.last_given) : null;
              const dosesLabel = prn.doses_in_last_24h
                ? `${prn.doses_in_last_24h} dose${prn.doses_in_last_24h === 1 ? '' : 's'} / 24h`
                : 'None in 24h';
              return (
                <Card
                  key={prn.medication_request_id}
                  variant="outlined"
                  sx={{ minWidth: 260, maxWidth: 320, flex: '0 0 auto' }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                      {prn.high_alert && (
                        <HighAlertIcon fontSize="inherit" sx={{ fontSize: 14, color: theme.palette.error.main }} />
                      )}
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
                        {prn.medication_display}
                      </Typography>
                    </Stack>
                    {prn.dose_text && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {prn.dose_text}
                      </Typography>
                    )}
                    {prn.prn_reason && (
                      <Chip
                        label={`PRN ${prn.prn_reason}`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.65rem', mt: 0.5 }}
                      />
                    )}
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75 }}>
                      <Typography variant="caption" color="text.disabled" sx={{ flex: 1 }}>
                        {last
                          ? `Last ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${formatRelativeDate(last)})`
                          : 'Never given'}
                      </Typography>
                      <Chip label={dosesLabel} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                    </Stack>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      sx={{ mt: 1, textTransform: 'none' }}
                      onClick={() => onGiveNow?.(prn)}
                    >
                      Give now
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
};

export default PRNPane;
