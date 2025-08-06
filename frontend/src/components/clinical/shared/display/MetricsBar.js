import React, { memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  LinearProgress,
  Tooltip,
  Skeleton,
  useTheme,
  alpha,
  Divider
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { severity as severityTokens } from '../../../../themes/clinicalTheme';

// Trend arrow mapping
const trendArrows = {
  up: <ArrowUpwardIcon fontSize="inherit" />,
  down: <ArrowDownwardIcon fontSize="inherit" />,
  stable: <RemoveIcon fontSize="inherit" />
};

// Severity icon mapping
const severityIcons = {
  critical: <ErrorIcon fontSize="small" />,
  high: <WarningIcon fontSize="small" />,
  moderate: <InfoIcon fontSize="small" />,
  low: <CheckCircleIcon fontSize="small" />,
  normal: null
};

// Metric status colors
const getMetricColor = (metric, theme) => {
  if (metric.severity) {
    return severityTokens[metric.severity]?.color || theme.palette.text.primary;
  }
  if (metric.status === 'good') return theme.palette.success.main;
  if (metric.status === 'warning') return theme.palette.warning.main;
  if (metric.status === 'error') return theme.palette.error.main;
  return theme.palette.text.primary;
};

const MetricItem = memo(({ metric, index, density = 'comfortable', animate = true }) => {
  const theme = useTheme();
  const color = getMetricColor(metric, theme);
  
  // Calculate progress if total is provided
  const progress = metric.total ? (metric.value / metric.total) * 100 : null;
  
  // Density-based sizing
  const densityConfig = {
    compact: { height: 56, valueFontSize: '1.25rem', padding: 1 },
    comfortable: { height: 72, valueFontSize: '1.5rem', padding: 1.5 },
    spacious: { height: 88, valueFontSize: '1.75rem', padding: 2 }
  };
  
  const config = densityConfig[density];

  const variants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        delay: index * 0.05,
        duration: 0.3
      }
    },
    hover: { 
      scale: 1.02,
      transition: { duration: 0.2 }
    }
  };

  return (
    <motion.div
      variants={animate ? variants : {}}
      initial="initial"
      animate="animate"
      whileHover="hover"
      style={{ flex: 1, minWidth: 0 }}
    >
      <Paper
        elevation={0}
        sx={{
          height: config.height,
          p: config.padding,
          backgroundColor: metric.severity 
            ? theme.palette.mode === 'dark' 
              ? alpha(color, 0.1)  // Dark mode: use transparent color overlay
              : severityTokens[metric.severity]?.bg 
            : theme.palette.background.paper,
          border: `1px solid ${alpha(color, 0.2)}`,
          borderRadius: 2,
          cursor: metric.onClick ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': metric.onClick ? {
            borderColor: alpha(color, 0.4),
            backgroundColor: metric.severity 
              ? theme.palette.mode === 'dark'
                ? alpha(color, 0.15)  // Dark mode hover: slightly more opacity
                : severityTokens[metric.severity]?.hoverBg
              : theme.palette.action.hover,
            transform: 'translateY(-1px)',
            boxShadow: theme.shadows[2]
          } : {}
        }}
        onClick={metric.onClick}
      >
        <Stack height="100%" justifyContent="center" spacing={0.5}>
          {/* Label row */}
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                fontSize: density === 'compact' ? '0.625rem' : '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                lineHeight: 1
              }}
              noWrap
            >
              {metric.label}
            </Typography>
            
            {metric.info && (
              <Tooltip title={metric.info}>
                <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              </Tooltip>
            )}
            
            {metric.severity && severityIcons[metric.severity] && (
              <Box sx={{ color, ml: 'auto' }}>
                {severityIcons[metric.severity]}
              </Box>
            )}
          </Stack>

          {/* Value row */}
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontSize: config.valueFontSize,
                fontWeight: 700,
                color,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {metric.value}
            </Typography>
            
            {metric.unit && (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ fontSize: density === 'compact' ? '0.75rem' : '0.875rem' }}
              >
                {metric.unit}
              </Typography>
            )}
            
            {metric.trend && (
              <Box 
                sx={{ 
                  color: metric.trend === 'up' 
                    ? theme.palette.success.main 
                    : metric.trend === 'down' 
                      ? theme.palette.error.main 
                      : theme.palette.text.secondary,
                  display: 'flex',
                  alignItems: 'center',
                  ml: 'auto'
                }}
              >
                {trendArrows[metric.trend]}
              </Box>
            )}
            
            {metric.change && (
              <Chip
                size="small"
                label={metric.change}
                sx={{
                  height: 16,
                  fontSize: '0.625rem',
                  backgroundColor: metric.changeType === 'positive' 
                    ? alpha(theme.palette.success.main, 0.1)
                    : metric.changeType === 'negative'
                      ? alpha(theme.palette.error.main, 0.1)
                      : alpha(theme.palette.text.primary, 0.1),
                  color: metric.changeType === 'positive' 
                    ? theme.palette.success.main
                    : metric.changeType === 'negative'
                      ? theme.palette.error.main
                      : theme.palette.text.secondary,
                  '& .MuiChip-label': {
                    px: 1
                  }
                }}
              />
            )}
          </Stack>

          {/* Progress bar (if total is provided) */}
          {progress !== null && (
            <Box sx={{ mt: 0.5 }}>
              <LinearProgress 
                variant="determinate" 
                value={progress}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: alpha(color, 0.1),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: color,
                    borderRadius: 2
                  }
                }}
              />
            </Box>
          )}
        </Stack>

        {/* Optional badge */}
        {metric.badge && (
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              backgroundColor: metric.badgeColor || theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              borderRadius: 0.5,
              px: 0.5,
              py: 0.25,
              fontSize: '0.625rem',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}
          >
            {metric.badge}
          </Box>
        )}
      </Paper>
    </motion.div>
  );
});

MetricItem.displayName = 'MetricItem';

const MetricsBar = memo(({
  metrics = [],
  density = 'comfortable',
  loading = false,
  animate = true,
  showDividers = false,
  orientation = 'horizontal',
  maxItems = null,
  sx = {},
  ...otherProps
}) => {
  const theme = useTheme();
  
  // Limit metrics if maxItems is set
  const displayMetrics = maxItems ? metrics.slice(0, maxItems) : metrics;
  const hasMore = maxItems && metrics.length > maxItems;

  if (loading) {
    return (
      <Box sx={{ width: '100%', ...sx }} {...otherProps}>
        <Stack 
          direction={orientation === 'horizontal' ? 'row' : 'column'} 
          spacing={2}
          divider={showDividers ? <Divider orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'} flexItem /> : null}
        >
          {[...Array(maxItems || 4)].map((_, index) => (
            <Box key={index} flex={1}>
              <Skeleton variant="rectangular" height={density === 'compact' ? 56 : 72} />
            </Box>
          ))}
        </Stack>
      </Box>
    );
  }

  if (displayMetrics.length === 0) {
    return null;
  }

  return (
    <Box sx={{ width: '100%', ...sx }} {...otherProps}>
      <Stack 
        direction={orientation === 'horizontal' ? 'row' : 'column'} 
        spacing={2}
        divider={showDividers ? <Divider orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'} flexItem /> : null}
        sx={{
          '& > *': {
            minWidth: orientation === 'horizontal' ? 0 : 'auto',
            flex: orientation === 'horizontal' ? 1 : 'none'
          }
        }}
      >
        {displayMetrics.map((metric, index) => (
          <MetricItem
            key={metric.key || index}
            metric={metric}
            index={index}
            density={density}
            animate={animate}
          />
        ))}
        
        {hasMore && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 80
            }}
          >
            <Typography variant="body2" color="text.secondary">
              +{metrics.length - maxItems} more
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
});

MetricsBar.displayName = 'MetricsBar';

// Preset metric configurations for common use cases
export const metricPresets = {
  patientVitals: (vitals) => [
    {
      label: 'Heart Rate',
      value: vitals.heartRate,
      unit: 'bpm',
      severity: vitals.heartRate > 100 ? 'moderate' : 'normal',
      trend: vitals.heartRateTrend
    },
    {
      label: 'Blood Pressure',
      value: vitals.bloodPressure,
      severity: vitals.bpHigh ? 'high' : 'normal',
      trend: vitals.bpTrend
    },
    {
      label: 'Temperature',
      value: vitals.temperature,
      unit: '°F',
      severity: vitals.temperature > 100.4 ? 'moderate' : 'normal'
    },
    {
      label: 'O2 Sat',
      value: vitals.oxygenSaturation,
      unit: '%',
      severity: vitals.oxygenSaturation < 95 ? 'high' : 'normal',
      trend: vitals.o2Trend
    }
  ],
  
  clinicalSummary: (data) => [
    {
      label: 'Active Problems',
      value: data.activeProblems,
      total: data.totalProblems,
      severity: data.criticalProblems > 0 ? 'high' : 'normal',
      badge: data.newProblems > 0 ? 'NEW' : null
    },
    {
      label: 'Medications',
      value: data.activeMedications,
      trend: data.medicationTrend,
      info: 'Active prescriptions'
    },
    {
      label: 'Alerts',
      value: data.alerts,
      severity: data.criticalAlerts > 0 ? 'critical' : 'moderate',
      badge: data.unreadAlerts > 0 ? data.unreadAlerts : null,
      badgeColor: '#f44336'
    },
    {
      label: 'Adherence',
      value: `${data.adherence}%`,
      status: data.adherence >= 80 ? 'good' : 'warning',
      trend: data.adherenceTrend
    }
  ]
};

export default MetricsBar;