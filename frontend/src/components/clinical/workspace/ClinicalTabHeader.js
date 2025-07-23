/**
 * Clinical Tab Header Component
 * Standardized header for all clinical tabs to ensure consistency
 * Part of the UI Optimization Initiative
 */
import React from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Button,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Print as PrintIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

const ClinicalTabHeader = ({
  title,
  subtitle,
  icon,
  metricsBar,
  actions = [],
  onPrint,
  onExport,
  onRefresh,
  onCreate,
  onSettings,
  dense = false,
  children
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ mb: dense ? 2 : 3 }}>
      {/* Main Header Row */}
      <Stack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="flex-start" 
        sx={{ mb: dense ? 1 : 2 }}
      >
        {/* Title Section */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {icon && (
              <Box sx={{ color: theme.palette.primary.main }}>
                {icon}
              </Box>
            )}
            <Typography 
              variant={dense ? "h6" : "h5"} 
              fontWeight="bold"
              sx={{ 
                color: theme.palette.text.primary,
                letterSpacing: '-0.01em'
              }}
            >
              {title}
            </Typography>
          </Stack>
          {subtitle && (
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                display: 'block',
                mt: 0.5,
                ml: icon ? 4.5 : 0 
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* Action Buttons */}
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Custom actions */}
          {actions.map((action, index) => (
            <React.Fragment key={index}>
              {action}
            </React.Fragment>
          ))}

          {/* Standard actions */}
          {onRefresh && (
            <Tooltip title="Refresh data">
              <IconButton 
                size={dense ? "small" : "medium"} 
                onClick={onRefresh}
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': { 
                    backgroundColor: alpha(theme.palette.primary.main, 0.08) 
                  }
                }}
              >
                <RefreshIcon fontSize={dense ? "small" : "default"} />
              </IconButton>
            </Tooltip>
          )}

          {onPrint && (
            <Button
              variant="outlined"
              size={dense ? "small" : "medium"}
              startIcon={<PrintIcon />}
              onClick={onPrint}
              sx={{ 
                borderColor: theme.palette.divider,
                '&:hover': { 
                  borderColor: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, 0.04)
                }
              }}
            >
              Print
            </Button>
          )}

          {onExport && (
            <Button
              variant="outlined"
              size={dense ? "small" : "medium"}
              startIcon={<DownloadIcon />}
              onClick={onExport}
              sx={{ 
                borderColor: theme.palette.divider,
                '&:hover': { 
                  borderColor: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, 0.04)
                }
              }}
            >
              Export
            </Button>
          )}

          {onCreate && (
            <Button
              variant="contained"
              size={dense ? "small" : "medium"}
              startIcon={<AddIcon />}
              onClick={onCreate}
              sx={{ 
                boxShadow: 'none',
                '&:hover': { 
                  boxShadow: theme.shadows[2]
                }
              }}
            >
              {typeof onCreate === 'object' ? onCreate.label : 'New'}
            </Button>
          )}

          {onSettings && (
            <Tooltip title="Settings">
              <IconButton 
                size={dense ? "small" : "medium"} 
                onClick={onSettings}
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': { 
                    backgroundColor: alpha(theme.palette.primary.main, 0.08) 
                  }
                }}
              >
                <SettingsIcon fontSize={dense ? "small" : "default"} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {/* Metrics Bar */}
      {metricsBar && (
        <Box sx={{ mb: dense ? 1.5 : 2 }}>
          {metricsBar}
        </Box>
      )}

      {/* Additional Content */}
      {children}
    </Box>
  );
};

export default ClinicalTabHeader;