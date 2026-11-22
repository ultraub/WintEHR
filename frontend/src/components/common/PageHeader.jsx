/**
 * PageHeader
 * The one page title block: same size, weight and colour on every route.
 * Text only — no emoji, no icon beside the title, no accent-coloured heading.
 *
 * Props: `title`, `subtitle` (one line of context), `meta` (small node after
 * the title, e.g. a count or StatusChip), `actions` (buttons, trailing edge).
 */
import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

const PageHeader = ({ title, subtitle, meta, actions, sx }) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    alignItems={{ xs: 'flex-start', sm: 'center' }}
    justifyContent="space-between"
    spacing={2}
    sx={{ mb: 3, ...sx }}
  >
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography component="h1" variant="h5" color="text.primary" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
          {title}
        </Typography>
        {meta}
      </Stack>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    {actions && (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
        {actions}
      </Stack>
    )}
  </Stack>
);

export default PageHeader;
