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
  Chip,
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
} from '../../../themes/clinicalThemeUtils';

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
  ...props
}) => {
  const theme = useTheme();
  
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

  // Determine card surface color based on variant and context
  const getSurfaceColor = () => {
    if (variant === 'clinical') {
      // Use department-specific surface if available
      if (enhancedContext.department !== 'general' && theme.clinical?.departments?.[enhancedContext.department]) {
        return theme.clinical.departments[enhancedContext.department].surface;
      }
      return theme.clinical?.surfaces?.primary || alpha(cardColor, 0.05);
    }
    return theme.palette.background.paper;
  };
  
  // Get clinical spacing
  const spacing = getClinicalSpacing(theme, enhancedContext, 'comfortable');
  
  // Get clinical animation
  const hoverAnimation = getClinicalAnimation(theme, 'hover', enhancedContext);

  const cardSx = {
    height: '100%',
    cursor: onClick ? 'pointer' : 'default',
    background: variant === 'gradient' 
      ? `linear-gradient(135deg, ${cardColor} 0%, ${alpha(cardColor, 0.8)} 100%)`
      : getSurfaceColor(),
    color: variant === 'gradient' ? 'white' : 'inherit',
    border: variant === 'clinical' ? 1 : 0,
    borderColor: variant === 'clinical' ? alpha(cardColor, 0.2) : 'transparent',
    borderRadius: theme.shape.borderRadius,
    transition: `all ${hoverAnimation.duration}ms ${hoverAnimation.easing}`,
    '&:hover': onClick ? {
      transform: hoverAnimation.transform,
      boxShadow: `0 8px 24px ${alpha(cardColor, 0.15)}`,
      borderColor: variant === 'clinical' ? alpha(cardColor, 0.4) : 'transparent'
    } : {},
    // Add urgency styling for critical situations
    ...(urgency === 'urgent' && {
      borderLeft: `4px solid ${cardColor}`,
      borderLeftColor: cardColor
    }),
    // Add subtle glow for severity indicators
    ...(severity && ['severe', 'critical'].includes(severity) && {
      boxShadow: `0 0 0 1px ${alpha(cardColor, 0.2)}, 0 2px 4px ${alpha(cardColor, 0.1)}`
    }),
    ...props.sx
  };

  if (loading) {
    return (
      <Card sx={cardSx} {...props}>
        <CardContent sx={{ p: spacing }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing / 4 }}>
            <Skeleton variant="text" width={120} height={20} />
            <Skeleton variant="circular" width={40} height={40} />
          </Box>
          <Skeleton variant="text" width={80} height={32} />
          <Skeleton variant="text" width={100} height={16} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={cardSx} onClick={onClick} {...props}>
      <CardContent sx={{ p: spacing }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing / 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: variant === 'gradient' ? 'rgba(255, 255, 255, 0.9)' : 'text.secondary',
                fontWeight: 500
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
                  bgcolor: variant === 'gradient' 
                    ? alpha(theme.palette.common.white, 0.2)
                    : alpha(cardColor, 0.1),
                  color: variant === 'gradient' ? 'white' : cardColor,
                  width: 40,
                  height: 40
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

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700, 
              color: variant === 'gradient' ? 'white' : cardColor,
              lineHeight: 1.2
            }}
          >
            {value?.toLocaleString() || '0'}
          </Typography>
          {unit && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: variant === 'gradient' ? 'rgba(255, 255, 255, 0.8)' : 'text.secondary',
                fontWeight: 500
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

export default MetricCard;