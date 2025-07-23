/**
 * ClinicalEmptyState Component
 * Standardized empty state display for clinical data
 * Provides helpful context and actions when no data is available
 */
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  useTheme,
  alpha
} from '@mui/material';
import {
  FolderOpen as EmptyIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';

/**
 * Empty state component for clinical data displays
 * @param {Object} props
 * @param {string} props.title - Main message title
 * @param {string} props.message - Descriptive message
 * @param {React.ReactNode} props.icon - Custom icon (defaults to EmptyIcon)
 * @param {string} props.iconColor - Icon color
 * @param {Array} props.actions - Array of action objects {label, onClick, icon, variant}
 * @param {boolean} props.showBorder - Show border styling
 * @param {string} props.severity - Visual severity level
 * @param {React.ReactNode} props.children - Additional content
 */
const ClinicalEmptyState = ({
  title = 'No data available',
  message,
  icon,
  iconColor = 'action',
  actions = [],
  showBorder = true,
  severity = 'normal',
  children,
  ...props
}) => {
  const theme = useTheme();
  
  // Default icon based on common empty state reasons
  const getDefaultIcon = () => {
    if (title.toLowerCase().includes('search')) return <SearchIcon />;
    if (title.toLowerCase().includes('filter')) return <FilterIcon />;
    return <EmptyIcon />;
  };
  
  const displayIcon = icon || getDefaultIcon();
  
  // Map severity to colors
  const severityColors = {
    info: theme.palette.info.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
    normal: theme.palette.action.disabled
  };
  
  const borderColor = severityColors[severity] || severityColors.normal;
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        textAlign: 'center',
        backgroundColor: theme.palette.background.paper,
        ...(showBorder && {
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          borderLeft: '4px solid',
          borderLeftColor: borderColor
        }),
        ...props.sx
      }}
    >
      <Stack spacing={2} alignItems="center">
        {/* Icon */}
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: alpha(
              iconColor === 'action' ? theme.palette.action.disabled : theme.palette[iconColor].main,
              0.1
            ),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {React.cloneElement(displayIcon, {
            fontSize: 'large',
            color: iconColor,
            sx: { fontSize: 32 }
          })}
        </Box>
        
        {/* Title */}
        <Typography variant="h6" color="text.primary" fontWeight={500}>
          {title}
        </Typography>
        
        {/* Message */}
        {message && (
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ maxWidth: 400, mx: 'auto' }}
          >
            {message}
          </Typography>
        )}
        
        {/* Actions */}
        {actions.length > 0 && (
          <Stack direction="row" spacing={2} mt={1}>
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || (index === 0 ? 'contained' : 'outlined')}
                size="small"
                startIcon={action.icon}
                onClick={action.onClick}
                sx={{
                  borderRadius: 0,
                  textTransform: 'none'
                }}
              >
                {action.label}
              </Button>
            ))}
          </Stack>
        )}
        
        {/* Additional content */}
        {children && (
          <Box mt={2}>
            {children}
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

// Common empty state presets
ClinicalEmptyState.presets = {
  noData: {
    title: 'No data available',
    message: 'There are no records to display at this time.',
    actions: [
      { label: 'Add New', icon: <AddIcon /> },
      { label: 'Refresh', icon: <RefreshIcon /> }
    ]
  },
  noSearchResults: {
    title: 'No results found',
    message: 'Try adjusting your search criteria or clearing filters.',
    icon: <SearchIcon />,
    actions: [
      { label: 'Clear Search' },
      { label: 'Show All' }
    ]
  },
  noFilterResults: {
    title: 'No matching records',
    message: 'No records match the current filter criteria.',
    icon: <FilterIcon />,
    actions: [
      { label: 'Clear Filters' },
      { label: 'Adjust Filters' }
    ]
  },
  error: {
    title: 'Unable to load data',
    message: 'An error occurred while loading the data. Please try again.',
    severity: 'error',
    actions: [
      { label: 'Retry', icon: <RefreshIcon /> }
    ]
  },
  noPermission: {
    title: 'Access restricted',
    message: 'You do not have permission to view this data.',
    severity: 'warning'
  }
};

export default ClinicalEmptyState;