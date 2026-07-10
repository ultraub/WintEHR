/**
 * ClinicalDialogHeader — shared colored-banner dialog title.
 *
 * Extracted from the best of the hand-rolled colored-banner DialogTitles
 * (ConditionDialogEnhanced was the reference): a solid accent banner with an
 * optional avatar icon, title + optional subtitle, an optional right-side
 * action slot (e.g. a status Chip), and a close X affordance.
 *
 * Color resolution, in priority order:
 *   1. `color`    — explicit accent (hex or any CSS color)
 *   2. `severity` — clinical severity level, resolved via the severity
 *                   palette in `themes/clinicalThemeUtils`
 *   3. default    — `theme.palette.primary.main`
 *
 * Usage:
 *   <Dialog ...>
 *     <ClinicalDialogHeader
 *       title="Sign Orders (3)"
 *       subtitle="Digital signature required"
 *       icon={<SignatureIcon />}
 *       onClose={handleClose}
 *     />
 *     <DialogContent>...</DialogContent>
 *   </Dialog>
 */
import React from 'react';
import PropTypes from 'prop-types';
import {
  DialogTitle,
  Stack,
  Box,
  Avatar,
  Typography,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { getSeverityColor } from '../../../../themes/clinicalThemeUtils';

const ClinicalDialogHeader = ({
  title,
  subtitle,
  icon,
  severity,
  color,
  action,
  onClose,
  closeDisabled = false,
}) => {
  const theme = useTheme();

  const bannerColor =
    color ||
    (severity ? getSeverityColor(theme, severity) : theme.palette.primary.main);
  const contrastColor = theme.palette.getContrastText(bannerColor);

  return (
    <DialogTitle
      sx={{
        bgcolor: bannerColor,
        color: contrastColor,
        py: 2,
        borderRadius: 0, // sharp corners — clinical UI convention
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ minWidth: 0 }}>
          {icon && (
            <Avatar
              sx={{
                bgcolor: alpha(theme.palette.common.white, 0.2),
                color: 'inherit',
              }}
            >
              {icon}
            </Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="span" sx={{ display: 'block' }} noWrap>
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                component="span"
                sx={{ display: 'block', color: alpha(contrastColor, 0.8) }}
                noWrap
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          {action}
          {onClose && (
            <IconButton
              aria-label="close"
              edge="end"
              color="inherit"
              onClick={onClose}
              disabled={closeDisabled}
              sx={{
                '&:hover': {
                  bgcolor: alpha(theme.palette.common.white, 0.1),
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Stack>
      </Stack>
    </DialogTitle>
  );
};

ClinicalDialogHeader.propTypes = {
  /** Banner title text (required). */
  title: PropTypes.node.isRequired,
  /** Optional secondary line under the title. */
  subtitle: PropTypes.node,
  /** Optional icon element, rendered inside a translucent avatar. */
  icon: PropTypes.node,
  /** Clinical severity level — resolved through the severity palette. */
  severity: PropTypes.oneOf(['critical', 'severe', 'moderate', 'mild', 'normal']),
  /** Explicit accent color; overrides `severity`. */
  color: PropTypes.string,
  /** Optional right-side slot (e.g. a status Chip), rendered before the X. */
  action: PropTypes.node,
  /** When provided, renders the close X affordance. */
  onClose: PropTypes.func,
  /** Disables the close X (e.g. while saving). */
  closeDisabled: PropTypes.bool,
};

export default ClinicalDialogHeader;
