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
  ...props
}) => {
  const theme = useTheme();

  // Get color from theme
  const getColor = () => {
    if (theme.palette[color]) {
      return theme.palette[color].main;
    }
    if (theme.clinical?.status?.[color]) {
      return theme.clinical.status[color];
    }
    return theme.palette.primary.main;
  };

  const cardColor = getColor();

  // Get trend icon and color
  const getTrendConfig = () => {
    if (!trend) return null;
    
    const trendConfigs = {
      up: {
        icon: <TrendingUpIcon fontSize="small" />,
        color: theme.palette.success.main,
        label: 'Trending up'
      },
      down: {
        icon: <TrendingDownIcon fontSize="small" />,
        color: theme.palette.error.main,
        label: 'Trending down'
      },
      flat: {
        icon: <TrendingFlatIcon fontSize="small" />,
        color: theme.palette.grey[600],
        label: 'Stable'
      }
    };

    return trendConfigs[trend] || null;
  };

  const trendConfig = getTrendConfig();

  // Determine card surface color based on variant
  const getSurfaceColor = () => {
    if (variant === 'clinical') {
      return theme.clinical?.surfaces?.primary || alpha(cardColor, 0.05);
    }
    return theme.palette.background.paper;
  };

  const cardSx = {
    height: '100%',
    cursor: onClick ? 'pointer' : 'default',
    background: variant === 'gradient' 
      ? `linear-gradient(135deg, ${cardColor} 0%, ${alpha(cardColor, 0.8)} 100%)`
      : getSurfaceColor(),
    color: variant === 'gradient' ? 'white' : 'inherit',
    border: variant === 'clinical' ? 1 : 0,
    borderColor: variant === 'clinical' ? alpha(cardColor, 0.2) : 'transparent',
    transition: theme.animations?.duration?.standard ? 
      `all ${theme.animations.duration.standard}ms ${theme.animations.easing.easeInOut}` : 
      'all 0.3s ease-in-out',
    '&:hover': onClick ? {
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 24px ${alpha(cardColor, 0.15)}`,
      borderColor: variant === 'clinical' ? alpha(cardColor, 0.4) : 'transparent'
    } : {},
    ...props.sx
  };

  if (loading) {
    return (
      <Card sx={cardSx} {...props}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
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
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
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