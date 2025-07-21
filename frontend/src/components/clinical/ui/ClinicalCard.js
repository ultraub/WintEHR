import React, { useState, memo } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  IconButton,
  Chip,
  Collapse,
  Stack,
  Tooltip,
  Divider,
  Skeleton,
  alpha,
  useTheme,
  Fade,
  Zoom
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  MoreVert as MoreVertIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getClinicalCardStyles, 
  getHoverEffect, 
  getElevationShadow,
  getSeverityGradient,
  getSpacing,
  getBorderRadius,
  getSmoothTransition
} from '../../../themes/clinicalThemeUtils';
import { clinicalTokens } from '../../../themes/clinicalTheme';

// Severity icon mapping
const severityIcons = {
  critical: <ErrorIcon fontSize="small" />,
  high: <WarningIcon fontSize="small" />,
  moderate: <InfoIcon fontSize="small" />,
  low: <CheckCircleIcon fontSize="small" />,
  normal: <CheckCircleIcon fontSize="small" />
};

// Trend icon mapping
const trendIcons = {
  improving: <TrendingUpIcon fontSize="small" color="success" />,
  worsening: <TrendingDownIcon fontSize="small" color="error" />,
  stable: <TrendingFlatIcon fontSize="small" color="primary" />,
  variable: <TrendingFlatIcon fontSize="small" color="warning" />
};

// Status color mapping
const statusColors = {
  active: 'primary',
  inactive: 'default',
  resolved: 'success',
  pending: 'warning',
  draft: 'default'
};

// Severity token mapping
const severityTokens = {
  critical: { color: 'error.main' },
  high: { color: 'warning.main' },
  moderate: { color: 'info.main' },
  low: { color: 'success.main' },
  normal: { color: 'text.secondary' }
};

const ClinicalCard = memo(({
  // Core props
  severity = 'normal',
  title,
  subtitle,
  status,
  trend,
  
  // Content props
  children,
  metrics = [],
  tags = [],
  
  // Action props
  actions = [],
  primaryAction,
  menuItems = [],
  
  // Feature flags
  expandable = false,
  hoverable = true,
  loading = false,
  dense = false,
  
  // Style props
  elevation = 1,
  sx = {},
  
  // Event handlers
  onClick,
  onExpand,
  
  // FHIR resource reference
  resourceType,
  resourceId,
  lastUpdated,
  
  ...otherProps
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Get modern clinical card styles
  const cardStyles = getClinicalCardStyles(severity, elevation, hoverable);
  const hoverStyles = hoverable ? getHoverEffect('lift', theme) : {};

  // Handle expansion
  const handleExpand = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (onExpand) {
      onExpand(newExpanded);
    }
  };

  // Enhanced animation variants
  const cardVariants = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    hover: hoverable ? { 
      y: -2, 
      scale: 1.01,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }
    } : {},
    tap: { scale: 0.98 }
  };

  const contentVariants = {
    collapsed: { height: 0, opacity: 0 },
    expanded: { 
      height: 'auto', 
      opacity: 1,
      transition: {
        height: {
          duration: 0.3
        },
        opacity: {
          duration: 0.2,
          delay: 0.1
        }
      }
    }
  };

  if (loading) {
    return (
      <Card elevation={elevation} sx={{ ...sx }}>
        <CardContent>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="40%" height={24} />
          <Box mt={2}>
            <Skeleton variant="rectangular" height={60} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
    >
      <Card 
        elevation={elevation}
        onClick={onClick}
        className={`ClinicalCard-severity-${severity}`}
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: getBorderRadius('lg'),
          ...cardStyles,
          ...hoverStyles,
          ...sx
        }}
        {...otherProps}
      >
        {/* Modern gradient background */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: getSeverityGradient(severity),
            opacity: theme.palette.mode === 'dark' ? 0.08 : 0.03,
            pointerEvents: 'none'
          }}
        />
        
        {/* Severity indicator bar with gradient */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: clinicalTokens.severity[severity]?.gradient || clinicalTokens.severity[severity]?.color,
            boxShadow: theme.palette.mode === 'dark' 
              ? `2px 0 12px ${alpha(clinicalTokens.severity[severity]?.color || '#fff', 0.3)}`
              : `2px 0 8px ${alpha(clinicalTokens.severity[severity]?.color || '#000', 0.1)}`,
            borderTopLeftRadius: getBorderRadius('lg'),
            borderBottomLeftRadius: getBorderRadius('lg')
          }}
        />

        <CardContent sx={{ 
          pl: 3,
          pb: dense ? 1 : 2,
          pt: dense ? 1 : 2
        }}>
          {/* Header section */}
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Box flex={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                {severity !== 'normal' && (
                  <Tooltip title={`${severity} severity`}>
                    <Box color={severityTokens[severity]?.color}>
                      {severityIcons[severity]}
                    </Box>
                  </Tooltip>
                )}
                
                <Typography 
                  variant={dense ? "subtitle1" : "h6"} 
                  component="h3"
                  sx={{ fontWeight: 600 }}
                >
                  {title}
                </Typography>

                {trend && (
                  <Tooltip title={`Trend: ${trend}`}>
                    <Box>{trendIcons[trend]}</Box>
                  </Tooltip>
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

              {/* Tags and status with enhanced styling */}
              {(tags.length > 0 || status) && (
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                  {status && (
                    <Zoom in={true} style={{ transitionDelay: '100ms' }}>
                      <Chip
                        size="small"
                        label={status}
                        color={statusColors[status] || 'default'}
                        sx={{ 
                          height: 24,
                          borderRadius: '12px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          boxShadow: `0 2px 4px ${alpha(theme.palette[statusColors[status] || 'grey'].main, 0.2)}`,
                          ...getSmoothTransition(['all'])
                        }}
                      />
                    </Zoom>
                  )}
                  {tags.map((tag, index) => (
                    <Zoom key={index} in={true} style={{ transitionDelay: `${150 + index * 50}ms` }}>
                      <Chip
                        size="small"
                        label={tag}
                        variant="outlined"
                        sx={{ 
                          height: 24,
                          borderRadius: '12px',
                          borderWidth: 1.5,
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            borderColor: theme.palette.primary.main
                          },
                          ...getSmoothTransition(['all'])
                        }}
                      />
                    </Zoom>
                  ))}
                </Stack>
              )}

              {/* Metrics display */}
              {metrics.length > 0 && (
                <Stack direction="row" spacing={2} mt={1.5}>
                  {metrics.map((metric, index) => (
                    <Box key={index}>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ 
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontSize: '0.625rem'
                        }}
                      >
                        {metric.label}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 600,
                          color: metric.color || 'text.primary'
                        }}
                      >
                        {metric.value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            {/* Action buttons */}
            <Stack direction="row" spacing={0.5}>
              {actions.map((action, index) => (
                <Tooltip key={index} title={action.tooltip || ''}>
                  <IconButton 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(e);
                    }}
                    sx={{ 
                      color: action.color || 'default',
                      '&:hover': {
                        backgroundColor: alpha(
                          theme.palette[action.color || 'primary'].main,
                          0.08
                        )
                      }
                    }}
                  >
                    {action.icon}
                  </IconButton>
                </Tooltip>
              ))}
              
              {menuItems.length > 0 && (
                <IconButton 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuAnchor(e.currentTarget);
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              )}

              {expandable && (
                <IconButton 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExpand();
                  }}
                >
                  {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              )}
            </Stack>
          </Stack>

          {/* Main content - always visible */}
          {children && !expandable && (
            <Box mt={dense ? 1 : 2}>
              {children}
            </Box>
          )}

          {/* Expandable content */}
          <AnimatePresence>
            {expandable && expanded && (
              <motion.div
                variants={contentVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                transition={{ duration: 0.3 }}
              >
                <Divider sx={{ my: 2 }} />
                <Box>{children}</Box>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        {/* Card actions */}
        {primaryAction && (
          <CardActions sx={{ 
            px: 3, 
            pb: 2,
            pt: 0
          }}>
            {primaryAction}
          </CardActions>
        )}

        {/* Resource metadata */}
        {(resourceType || lastUpdated) && (
          <Box 
            sx={{ 
              px: 3, 
              pb: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            {resourceType && (
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ fontSize: '0.625rem' }}
              >
                {resourceType}/{resourceId}
              </Typography>
            )}
            {lastUpdated && (
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ fontSize: '0.625rem' }}
              >
                Updated: {new Date(lastUpdated).toLocaleDateString()}
              </Typography>
            )}
          </Box>
        )}

        {/* Menu - implement if needed */}
        {/* TODO: Add Menu component for menuItems */}
      </Card>
    </motion.div>
  );
});

ClinicalCard.displayName = 'ClinicalCard';

// Export variants for specific use cases
export const ConditionCard = (props) => (
  <ClinicalCard 
    resourceType="Condition"
    {...props} 
  />
);

export const MedicationCard = (props) => (
  <ClinicalCard 
    resourceType="MedicationRequest"
    {...props} 
  />
);

export const ObservationCard = (props) => (
  <ClinicalCard 
    resourceType="Observation"
    {...props} 
  />
);

export default ClinicalCard;