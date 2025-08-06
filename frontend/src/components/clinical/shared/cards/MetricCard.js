/**
 * MetricCard Component
 * Reusable metric display card with theme-aware styling and trend indicators
 */
import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  useTheme,
  Skeleton,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  MoreVert as MoreVertIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { 
  getClinicalContext, 
  getSeverityColor, 
  getClinicalAnimation,
  getClinicalSpacing 
} from '../../../../themes/clinicalThemeUtils';
import { useResponsive } from '../../../../hooks/useResponsive';

const MetricCard = ({
  title,
  value,
  unit,
  trend,
  trendValue,
  icon,
  color = 'primary',
  loading = false,
  subtitle,
  onClick,
  onMenuClick,
  showInfo = false,
  infoTooltip,
  variant = 'default',
  severity,
  clinicalContext,
  department,
  urgency = 'normal',
  expandable, // Extract but don't use
  ...props
}) => {
  const theme = useTheme();
  const { isMobile, getResponsiveValue } = useResponsive();
  
  // Get clinical context for enhanced theming
  const context = clinicalContext || getClinicalContext(
    window.location.pathname,
    new Date().getHours(),
    department
  );
  
  // Enhanced clinical context with urgency
  const enhancedContext = {
    ...context,
    urgency
  };

  // Get color from theme with clinical context
  const getColor = () => {
    // Use severity-based color if severity is provided
    if (severity) {
      return getSeverityColor(theme, severity, enhancedContext);
    }
    
    // Check for clinical status colors
    if (theme.clinical?.status?.[color]) {
      return theme.clinical.status[color];
    }
    
    // Use department-specific colors if available
    if (enhancedContext.department !== 'general' && theme.clinical?.departments?.[enhancedContext.department]) {
      return theme.clinical.departments[enhancedContext.department].primary;
    }
    
    // Fall back to standard palette colors
    if (theme.palette[color]?.main) {
      return theme.palette[color].main;
    }
    
    return theme.palette.primary?.main || '#1976D2';
  };

  const cardColor = getColor();

  // Get trend icon and color
  const getTrendConfig = () => {
    if (!trend) return null;
    
    const trendConfigs = {
      up: {
        icon: <TrendingUpIcon fontSize="small" />,
        color: theme.palette.success?.main || '#4caf50',
        label: 'Trending up'
      },
      down: {
        icon: <TrendingDownIcon fontSize="small" />,
        color: theme.palette.error?.main || '#f44336',
        label: 'Trending down'
      },
      flat: {
        icon: <TrendingFlatIcon fontSize="small" />,
        color: theme.palette.grey?.[600] || '#757575',
        label: 'Stable'
      }
    };

    return trendConfigs[trend] || null;
  };

  const trendConfig = getTrendConfig();
  
  // Get clinical spacing - use compact version for metric cards
  const spacing = variant === 'clinical' ? 2 : getClinicalSpacing(theme, enhancedContext, 'compact');

  const cardSx = {
    height: '100%',
    cursor: onClick ? 'pointer' : 'default',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '4px',  // Sharp corners
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',  // Minimal shadow
    transition: 'all 200ms ease-in-out',
    '&:hover': onClick ? {
      backgroundColor: theme.palette.action.hover,
      borderColor: theme.palette.action.focus
    } : {},
    // Add urgency styling for critical situations
    ...(urgency === 'urgent' && {
      borderLeft: `4px solid ${cardColor}`,
      borderLeftColor: cardColor
    }),
    ...props.sx
  };

  if (loading) {
    return (
      <Card sx={cardSx} {...props}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2, md: spacing } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.5, sm: spacing / 4 } }}>
            <Skeleton variant="text" width={isMobile ? 80 : 120} height={20} />
            <Skeleton variant="circular" width={isMobile ? 32 : 40} height={isMobile ? 32 : 40} />
          </Box>
          <Skeleton variant="text" width={isMobile ? 60 : 80} height={isMobile ? 24 : 32} />
          <Skeleton variant="text" width={isMobile ? 80 : 100} height={16} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={cardSx} onClick={onClick} {...props}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2, md: spacing } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.5, sm: spacing / 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 600,
                textTransform: 'uppercase',
                fontSize: { xs: '0.625rem', sm: '0.75rem' },
                letterSpacing: '0.5px'
              }}
            >
              {title}
            </Typography>
            {showInfo && infoTooltip && (
              <Tooltip title={infoTooltip} arrow>
                <InfoIcon 
                  fontSize="small" 
                  sx={{ 
                    color: variant === 'gradient' ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                    cursor: 'help'
                  }} 
                />
              </Tooltip>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon && (
              <Avatar 
                sx={{ 
                  bgcolor: alpha(cardColor, 0.1),
                  color: cardColor,
                  width: { xs: 32, sm: 40 },
                  height: { xs: 32, sm: 40 },
                  '& svg': {
                    fontSize: { xs: '1rem', sm: '1.25rem' }
                  }
                }}
              >
                {icon}
              </Avatar>
            )}
            {onMenuClick && (
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuClick(e);
                }}
                sx={{ 
                  color: variant === 'gradient' ? 'white' : 'inherit'
                }}
              >
                <MoreVertIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: { xs: 0.25, sm: 0.5 } }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700, 
              color: cardColor,
              lineHeight: 1.2,
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
            }}
          >
            {value?.toLocaleString() || '0'}
          </Typography>
          {unit && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 500,
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }}
            >
              {unit}
            </Typography>
          )}
        </Box>

        {subtitle && (
          <Typography 
            variant="body2" 
            sx={{ 
              color: variant === 'gradient' ? 'rgba(255, 255, 255, 0.9)' : 'text.secondary',
              mb: 1
            }}
          >
            {subtitle}
          </Typography>
        )}

        {trendConfig && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ 
              color: variant === 'gradient' ? 'white' : trendConfig.color,
              display: 'flex',
              alignItems: 'center'
            }}>
              {trendConfig.icon}
            </Box>
            <Typography 
              variant="caption" 
              sx={{ 
                color: variant === 'gradient' ? 'rgba(255, 255, 255, 0.9)' : trendConfig.color,
                fontWeight: 500
              }}
            >
              {trendValue && `${trendValue > 0 ? '+' : ''}${trendValue}${unit ? ` ${unit}` : ''}`}
              {trendConfig.label && !trendValue && trendConfig.label}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(MetricCard);