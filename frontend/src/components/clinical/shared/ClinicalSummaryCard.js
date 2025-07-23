/**
 * ClinicalSummaryCard Component
 * Summary statistics card with icons and metrics display
 * Based on Chart Review Tab summary cards design
 */
import React from 'react';
import {
  Card,
  CardContent,
  Stack,
  Box,
  Typography,
  Avatar,
  Chip,
  useTheme,
  alpha,
  LinearProgress
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { clinicalTokens } from '../../../themes/clinicalTheme';

/**
 * Summary card for displaying clinical metrics and statistics
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {number|string} props.value - Main metric value
 * @param {string} props.unit - Unit of measurement
 * @param {React.ReactNode} props.icon - Icon to display
 * @param {string} props.severity - Severity level for coloring
 * @param {Array} props.chips - Array of chip data {label, count, color}
 * @param {Object} props.trend - Trend data {direction: 'up'|'down', value, label}
 * @param {number} props.progress - Progress value (0-100)
 * @param {string} props.progressLabel - Progress bar label
 * @param {Function} props.onClick - Click handler
 * @param {string} props.accentColor - Custom accent color
 */
const ClinicalSummaryCard = ({
  title,
  value,
  unit,
  icon,
  severity = 'normal',
  chips = [],
  trend,
  progress,
  progressLabel,
  onClick,
  accentColor,
  ...props
}) => {
  const theme = useTheme();
  
  // Map severity to colors
  const severityColors = {
    critical: theme.palette.error.main,
    high: theme.palette.error.main,
    moderate: theme.palette.warning.main,
    low: theme.palette.success.main,
    normal: theme.palette.primary.main,
    info: theme.palette.info.main
  };
  
  const primaryColor = accentColor || severityColors[severity] || theme.palette.primary.main;
  const backgroundColor = severity === 'critical' 
    ? clinicalTokens.severity.high.bg 
    : severity === 'moderate'
    ? clinicalTokens.severity.moderate.bg
    : severity === 'low'
    ? clinicalTokens.severity.low.bg
    : alpha(primaryColor, 0.04);
  
  return (
    <Card 
      sx={{ 
        height: '100%',
        backgroundColor,
        borderRadius: 0, // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: primaryColor,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onClick ? {
          boxShadow: theme.shadows[1],
          transform: 'translateY(-2px)'
        } : {},
        ...props.sx
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {/* Main Content */}
          <Box flex={1}>
            {/* Title */}
            <Typography color="text.secondary" variant="caption" fontWeight={500}>
              {title}
            </Typography>
            
            {/* Value with Unit */}
            <Stack direction="row" alignItems="baseline" spacing={0.5}>
              <Typography variant="h3" fontWeight="bold" color="text.primary">
                {value}
              </Typography>
              {unit && (
                <Typography variant="body2" color="text.secondary">
                  {unit}
                </Typography>
              )}
            </Stack>
            
            {/* Chips */}
            {chips.length > 0 && (
              <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap">
                {chips.map((chip, index) => (
                  <Chip 
                    key={index}
                    label={chip.label}
                    size="small"
                    color={chip.color || 'default'}
                    sx={{
                      borderRadius: '4px',
                      fontWeight: 600,
                      height: 22,
                      fontSize: '0.75rem',
                      ...(chip.count && {
                        label: `${chip.count} ${chip.label}`
                      })
                    }}
                  />
                ))}
              </Stack>
            )}
            
            {/* Trend Indicator */}
            {trend && (
              <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
                {trend.direction === 'up' ? (
                  <TrendingUp color="success" fontSize="small" />
                ) : (
                  <TrendingDown color="error" fontSize="small" />
                )}
                <Typography variant="caption" color="text.secondary">
                  {trend.value && `${trend.value} `}
                  {trend.label}
                </Typography>
              </Stack>
            )}
          </Box>
          
          {/* Icon */}
          {icon && (
            <Avatar 
              sx={{ 
                bgcolor: alpha(primaryColor, 0.1),
                width: 48,
                height: 48
              }}
            >
              <Box sx={{ color: primaryColor, display: 'flex' }}>
                {React.cloneElement(icon, { fontSize: 'medium' })}
              </Box>
            </Avatar>
          )}
        </Stack>
        
        {/* Progress Bar */}
        {progress !== undefined && (
          <Box mt={2}>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                {progressLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {progress}%
              </Typography>
            </Stack>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{
                height: 6,
                borderRadius: 0,
                backgroundColor: alpha(primaryColor, 0.1),
                '& .MuiLinearProgress-bar': {
                  backgroundColor: primaryColor,
                  borderRadius: 0
                }
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ClinicalSummaryCard;