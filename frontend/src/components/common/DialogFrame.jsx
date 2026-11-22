/**
 * DialogFrame
 * The one frame for dialogs: same header, same three widths, same footer
 * order everywhere. Build the form inside it; do not restyle the frame.
 *
 * Props
 *   open, onClose
 *   title          plain text; no icons, no coloured band
 *   subtitle       optional one line under the title (e.g. the patient)
 *   size           'sm' (480) forms with a few fields · 'md' (720) default ·
 *                  'lg' (960) two-column or table content
 *   primaryAction  { label, onClick, disabled, loading, color } — the one
 *                  filled button, always last
 *   secondaryAction { label, onClick } — defaults to "Cancel" → onClose;
 *                  pass `null` for a dialog with nothing to cancel
 *   footerStart    optional node at the footer's leading edge (e.g. Delete)
 *   busy           blocks closing and shows progress while a save is running
 *   dividers       rule between header/body/footer for long scrolling bodies
 */
import React from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  IconButton, LinearProgress, Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const WIDTHS = { sm: 480, md: 720, lg: 960 };

const DialogFrame = ({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  primaryAction,
  secondaryAction,
  footerStart,
  busy = false,
  dividers = false,
  contentSx,
  ...dialogProps
}) => {
  const titleId = React.useId();
  const handleClose = (event, reason) => {
    if (busy) return;
    onClose?.(event, reason);
  };
  const cancel = secondaryAction === null
    ? null
    : { label: 'Cancel', onClick: handleClose, ...secondaryAction };
  const showFooter = Boolean(primaryAction || cancel || footerStart);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby={titleId}
      fullWidth
      maxWidth={false}
      PaperProps={{ sx: { width: '100%', maxWidth: WIDTHS[size] || WIDTHS.md, borderRadius: 1.5 } }}
      {...dialogProps}
    >
      {busy && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          px: 3,
          pt: 2.5,
          pb: 1.5,
          borderBottom: dividers ? 1 : 0,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={titleId} component="h2" variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton aria-label="Close" onClick={handleClose} disabled={busy} size="small" sx={{ mt: -0.5, mr: -1 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pt: dividers ? 2.5 : 1, pb: 2.5, ...contentSx }}>
        {children}
      </DialogContent>

      {showFooter && (
        <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: dividers ? 1 : 0, borderColor: 'divider' }}>
          {footerStart && <Box sx={{ mr: 'auto' }}>{footerStart}</Box>}
          {cancel && (
            <Button onClick={cancel.onClick} disabled={busy} color="inherit">
              {cancel.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              variant="contained"
              color={primaryAction.color || 'primary'}
              onClick={primaryAction.onClick}
              disabled={busy || primaryAction.disabled || primaryAction.loading}
              startIcon={primaryAction.loading ? <CircularProgress size={16} color="inherit" /> : undefined}
              disableElevation
            >
              {primaryAction.label}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default DialogFrame;
