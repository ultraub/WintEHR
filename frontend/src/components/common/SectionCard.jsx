/**
 * SectionCard
 * A complete card for one section of an overview page: a header (icon,
 * title, a short note, and a link to the full page), the content, and an
 * optional footer line that sums the content up. The frame gives a section
 * a top, a middle and a bottom, so it reads as finished at any content
 * height.
 *
 * Props
 *   title, icon (node), note (right of the title),
 *   action { label, onClick } (header link),
 *   footer (node or string; drawn under a divider),
 *   lead (bool; the page's one leading card gets a block shadow),
 *   children
 */
import React from 'react';
import { Box, Button, Paper, Stack, Typography, alpha, useTheme } from '@mui/material';
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { useAuroraPalette } from '../../themes/auroraPalette';

/** The small tinted tile that carries a section's icon. */
export const SectionIconTile = ({ children, size = 36 }) => {
  const theme = useTheme();
  return (
    <Box
      aria-hidden
      sx={{
        flex: `0 0 ${size}px`,
        height: size,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'primary.main',
        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
        '& svg': { fontSize: Math.round(size * 0.55) },
      }}
    >
      {children}
    </Box>
  );
};

const SectionCard = ({ title, icon, note, action, footer, lead = false, children, sx }) => {
  const theme = useTheme();
  const aurora = useAuroraPalette();
  const id = `section-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <Paper
      component="section"
      aria-labelledby={id}
      elevation={0}
      sx={{
        // the leading card's block shadow is drawn inside its grid cell
        height: lead ? 'calc(100% - 6px)' : '100%',
        width: lead ? 'calc(100% - 6px)' : '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2.25,
        backgroundImage: 'none',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: aurora.cardBorder,
        boxShadow: lead ? `6px 6px 0 ${aurora.leadShadow}` : aurora.cardShadow,
        ...sx,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ px: 3, pt: 2.5, pb: 2 }}
      >
        {icon && <SectionIconTile>{icon}</SectionIconTile>}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography id={id} component="h2" sx={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
            {title}
          </Typography>
          {note && <Typography variant="caption" color="text.secondary" component="div">{note}</Typography>}
        </Box>
        {action && (
          <Button size="small" endIcon={<ChevronRightIcon />} onClick={action.onClick} sx={{ flexShrink: 0, mr: -1 }}>
            {action.label}
          </Button>
        )}
      </Stack>

      <Box sx={{ px: 3, pb: footer ? 2 : 2.5, flexGrow: 1 }}>{children}</Box>

      {footer && (
        <Box
          sx={{
            px: 3,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'action.hover',
          }}
        >
          <Typography variant="body2" color="text.secondary" component="div">{footer}</Typography>
        </Box>
      )}
    </Paper>
  );
};

export default SectionCard;
