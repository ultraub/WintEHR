/**
 * SimplifiedClinicalDialog Component
 * 
 * A cleaner, less icon-intensive dialog component that maintains functionality
 * while improving visual hierarchy and reducing clutter.
 * 
 * Key improvements:
 * - Minimal icon usage (only where essential)
 * - Clear visual hierarchy with typography
 * - Grouped actions with better spacing
 * - Color-coded sections instead of icon overload
 * 
 * @since 2025-01-21
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
  Chip,
  Alert,
  Stack,
  useTheme,
  alpha,
  Slide
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';

// Slide transition for smoother dialog appearance
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface SimplifiedClinicalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  category?: 'medication' | 'condition' | 'order' | 'allergy' | 'result';
  priority?: 'routine' | 'urgent' | 'stat';
  children: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'text' | 'outlined' | 'contained';
    color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    startIcon?: React.ReactNode;
    disabled?: boolean;
  }>;
  alerts?: Array<{
    severity: 'error' | 'warning' | 'info' | 'success';
    message: string;
  }>;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  showCloseButton?: boolean;
}

const SimplifiedClinicalDialog: React.FC<SimplifiedClinicalDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  category,
  priority,
  children,
  actions = [],
  alerts = [],
  maxWidth = 'md',
  fullWidth = true,
  loading = false,
  showCloseButton = true
}) => {
  const theme = useTheme();

  // Get category color based on type
  const getCategoryColor = () => {
    switch (category) {
      case 'medication':
        return theme.palette.primary.main;
      case 'condition':
        return theme.palette.info.main;
      case 'order':
        return theme.palette.secondary.main;
      case 'allergy':
        return theme.palette.warning.main;
      case 'result':
        return theme.palette.success.main;
      default:
        return theme.palette.primary.main;
    }
  };

  // Get priority styling
  const getPriorityStyle = () => {
    switch (priority) {
      case 'stat':
        return {
          color: theme.palette.error.main,
          label: 'STAT'
        };
      case 'urgent':
        return {
          color: theme.palette.warning.main,
          label: 'Urgent'
        };
      default:
        return null;
    }
  };

  const categoryColor = getCategoryColor();
  const priorityStyle = getPriorityStyle();

  // Default actions if none provided
  const defaultActions = actions.length === 0 ? [
    {
      label: 'Cancel',
      onClick: onClose,
      variant: 'outlined' as const
    },
    {
      label: 'Save',
      onClick: onClose,
      variant: 'contained' as const,
      color: 'primary' as const,
      startIcon: <SaveIcon />
    }
  ] : actions;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      TransitionComponent={Transition}
      aria-labelledby="clinical-dialog-title"
      aria-describedby="clinical-dialog-description"
    >
      {/* Header with colored accent line */}
      <Box
        sx={{
          borderTop: `4px solid ${categoryColor}`,
          pb: 0
        }}
      >
        <DialogTitle
          id="clinical-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1
          }}
        >
          <Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="h6" component="span">
                {title}
              </Typography>
              {priorityStyle && (
                <Chip
                  label={priorityStyle.label}
                  size="small"
                  sx={{
                    backgroundColor: alpha(priorityStyle.color, 0.1),
                    color: priorityStyle.color,
                    fontWeight: 'bold'
                  }}
                />
              )}
            </Stack>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {showCloseButton && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                color: theme.palette.grey[500],
                '&:hover': {
                  color: theme.palette.grey[700]
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      </Box>

      <Divider />

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Stack spacing={1}>
            {alerts.map((alert, index) => (
              <Alert
                key={index}
                severity={alert.severity}
                sx={{
                  '& .MuiAlert-icon': {
                    fontSize: '1.25rem'
                  }
                }}
              >
                {alert.message}
              </Alert>
            ))}
          </Stack>
        </Box>
      )}

      {/* Main Content */}
      <DialogContent
        id="clinical-dialog-description"
        sx={{
          pt: alerts.length > 0 ? 2 : 3,
          pb: 3
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 200
            }}
          >
            <Typography color="text.secondary">Loading...</Typography>
          </Box>
        ) : (
          children
        )}
      </DialogContent>

      {/* Actions */}
      {defaultActions.length > 0 && (
        <>
          <Divider />
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              gap: 1
            }}
          >
            {defaultActions.map((action, index) => (
              <Button
                key={index}
                onClick={action.onClick}
                variant={action.variant || 'text'}
                color={action.color || 'primary'}
                startIcon={action.startIcon}
                disabled={action.disabled || loading}
              >
                {action.label}
              </Button>
            ))}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default SimplifiedClinicalDialog;