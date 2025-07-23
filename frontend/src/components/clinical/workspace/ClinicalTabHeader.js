/**
 * ClinicalTabHeader Component
 * Standardized header for all clinical tabs with consistent spacing and metrics
 * Reduces code duplication and ensures uniform appearance
 */
import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  IconButton,
  Button,
  Tooltip,
  useTheme,
  alpha,
  Skeleton
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon
} from '@mui/icons-material';

const ClinicalTabHeader = ({
  // Core props
  title,
  subtitle,
  icon: Icon,
  loading = false,
  
  // Metrics props
  metrics = [],
  // Example metrics:
  // [
  //   { label: 'Total', value: 42, trend: 'up', change: '+5' },
  //   { label: 'Critical', value: 3, color: 'error' }
  // ]
  
  // Action props
  onRefresh,
  onPrint,
  onExport,
  onAdd,
  additionalActions = [],
  // Example actions:
  // [
  //   { icon: SettingsIcon, label: 'Settings', onClick: handleSettings },
  //   { icon: FilterIcon, label: 'Filters', onClick: handleFilters }
  // ]
  
  // Customization
  showDivider = false,
  compact = false,
  elevation = 0,
  sx = {}
}) => {
  const theme = useTheme();
  
  // Get trend icon
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon sx={{ fontSize: 16 }} />;
      case 'down':
        return <TrendingDownIcon sx={{ fontSize: 16 }} />;
      default:
        return <TrendingFlatIcon sx={{ fontSize: 16 }} />;
    }
  };
  
  // Get trend color
  const getTrendColor = (trend) => {
    switch (trend) {
      case 'up':
        return 'success.main';
      case 'down':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };
  
  // Render loading state
  if (loading) {
    return (
      <Box sx={{ p: compact ? 1.5 : 2, ...sx }}>
        <Stack spacing={1}>
          <Skeleton variant="text" width="30%" height={32} />
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="rounded" width={80} height={24} />
          </Stack>
        </Stack>
      </Box>
    );
  }
  
  return (
    <Box
      sx={{
        backgroundColor: elevation > 0 ? 'background.paper' : 'transparent',
        borderRadius: elevation > 0 ? 1 : 0,
        boxShadow: elevation,
        borderBottom: showDivider ? `1px solid ${theme.palette.divider}` : 'none',
        ...sx
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          p: compact ? 1.5 : 2,
          minHeight: compact ? 48 : 64
        }}
      >
        {/* Left side - Title and metrics */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          {/* Icon and Title */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            {Icon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: compact ? 32 : 40,
                  height: compact ? 32 : 40,
                  borderRadius: 1,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main'
                }}
              >
                <Icon sx={{ fontSize: compact ? 20 : 24 }} />
              </Box>
            )}
            
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant={compact ? 'subtitle1' : 'h6'}
                sx={{
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {title}
              </Typography>
              {subtitle && !compact && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
          
          {/* Metrics */}
          {metrics.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
              {metrics.map((metric, index) => (
                <Chip
                  key={index}
                  size="small"
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        {metric.label}:
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {metric.value}
                      </Typography>
                      {metric.trend && (
                        <>
                          <Box sx={{ color: getTrendColor(metric.trend) }}>
                            {getTrendIcon(metric.trend)}
                          </Box>
                          {metric.change && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: getTrendColor(metric.trend),
                                fontWeight: 500
                              }}
                            >
                              {metric.change}
                            </Typography>
                          )}
                        </>
                      )}
                    </Stack>
                  }
                  color={metric.color || 'default'}
                  variant={metric.variant || 'outlined'}
                  sx={{
                    height: compact ? 24 : 28,
                    '& .MuiChip-label': {
                      px: 1
                    }
                  }}
                />
              ))}
            </Stack>
          )}
        </Stack>
        
        {/* Right side - Actions */}
        <Stack direction="row" spacing={0.5} alignItems="center">
          {/* Primary action button */}
          {onAdd && (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAdd}
              sx={{ mr: 1 }}
            >
              Add New
            </Button>
          )}
          
          {/* Icon actions */}
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={onRefresh}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {onPrint && (
            <Tooltip title="Print">
              <IconButton size="small" onClick={onPrint}>
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {onExport && (
            <Tooltip title="Export">
              <IconButton size="small" onClick={onExport}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {/* Additional actions */}
          {additionalActions.map((action, index) => (
            <Tooltip key={index} title={action.label}>
              <IconButton
                size="small"
                onClick={action.onClick}
                disabled={action.disabled}
                color={action.color || 'default'}
              >
                <action.icon fontSize="small" />
              </IconButton>
            </Tooltip>
          ))}
          
          {/* More menu if many actions */}
          {additionalActions.length > 3 && (
            <Tooltip title="More actions">
              <IconButton size="small">
                <MoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default ClinicalTabHeader;