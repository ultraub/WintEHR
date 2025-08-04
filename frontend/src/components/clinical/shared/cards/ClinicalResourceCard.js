/**
 * ClinicalResourceCard Component
 * Unified card component combining features from all previous versions
 * Standardized for displaying FHIR resources with clinical severity indicators
 */
import React, { useState } from 'react';
import {
  Paper,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Box,
  Stack,
  Typography,
  IconButton,
  Button,
  Chip,
  Collapse,
  Divider,
  useTheme,
  alpha,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  MoreVert as MoreIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

/**
 * Unified clinical resource card with features from all versions
 * @param {Object} props
 * @param {string} props.title - Main title of the resource
 * @param {string} props.subtitle - Secondary information
 * @param {React.ReactNode} props.icon - Icon to display
 * @param {string} props.severity - Severity level: 'critical', 'high', 'moderate', 'low', 'normal'
 * @param {string} props.priority - Priority level: 'urgent', 'high', 'normal', 'low'
 * @param {string} props.status - Status chip text
 * @param {string} props.statusColor - MUI color for status chip
 * @param {Array} props.details - Array of detail objects with label and value
 * @param {Function} props.onEdit - Edit click handler
 * @param {Function} props.onMore - More menu click handler
 * @param {boolean} props.isAlternate - Alternate row background
 * @param {React.ReactNode} props.actions - Custom action buttons or array of action objects
 * @param {React.ReactNode} props.children - Additional content
 * @param {boolean} props.expandable - Whether card can be expanded
 * @param {boolean} props.expanded - Controlled expanded state
 * @param {Function} props.onExpandChange - Expansion change handler
 * @param {React.ReactNode} props.expandedContent - Content to show when expanded
 * @param {boolean} props.urgent - Whether the card represents urgent content
 * @param {string} props.variant - Card variant: 'default', 'clinical', 'paper', 'metric'
 * @param {Function} props.onClick - Card click handler
 * @param {React.ReactNode} props.headerAction - Custom header action component
 * @param {boolean} props.useCard - Use Card component instead of Paper (for expandable)
 */
const ClinicalResourceCard = ({
  title,
  subtitle,
  icon,
  severity = 'normal',
  priority = 'normal',
  status,
  statusColor = 'default',
  details = [],
  onEdit,
  onMore,
  isAlternate = false,
  actions,
  children,
  expandable = false,
  expanded: controlledExpanded,
  onExpandChange,
  expandedContent,
  urgent = false,
  variant = 'default',
  onClick,
  headerAction,
  useCard = false,
  ...props
}) => {
  const theme = useTheme();
  const [internalExpanded, setInternalExpanded] = useState(false);
  
  // Use controlled or internal expansion state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setExpanded = onExpandChange || setInternalExpanded;
  
  // Determine if we should use Card (for expandable) or Paper
  const shouldUseCard = useCard || expandable;
  
  // Map severity to color
  const severityColors = {
    critical: theme.palette.error.main,
    high: theme.palette.error.main,
    moderate: theme.palette.warning.main,
    low: theme.palette.success.main,
    normal: theme.palette.primary.main,
    default: theme.palette.grey[400]
  };
  
  const borderColor = severityColors[severity] || severityColors.default;
  
  // Get priority color
  const getPriorityColor = () => {
    const priorityColors = {
      low: theme.palette.success?.main || '#4caf50',
      normal: theme.palette.info?.main || '#2196f3',
      high: theme.palette.warning?.main || '#ff9800',
      urgent: theme.palette.error?.main || '#f44336'
    };
    return priorityColors[priority] || priorityColors.normal;
  };
  
  const handleExpandClick = () => {
    setExpanded(!isExpanded);
  };
  
  // Base styles
  const baseStyles = {
    p: 2,
    borderRadius: variant === 'clinical' ? '4px' : 0, // Sharp corners per default, rounded for clinical
    border: '1px solid',
    borderColor: 'divider',
    borderLeft: '4px solid',
    borderLeftColor: borderColor,
    backgroundColor: isAlternate ? alpha(theme.palette.action.hover, 0.04) : theme.palette.background.paper,
    transition: 'all 0.2s ease',
    cursor: onClick ? 'pointer' : 'default',
    '&:hover': {
      backgroundColor: alpha(theme.palette.action.hover, 0.08),
      transform: 'translateX(2px)',
      boxShadow: theme.shadows[1]
    },
    // Add urgency indicator
    ...(urgent && {
      borderColor: theme.palette.error?.main || '#f44336',
      backgroundColor: alpha(theme.palette.error?.main || '#f44336', 0.02)
    }),
    // Clean styling for metric variant
    ...(variant === 'metric' && {
      textAlign: 'center',
      minHeight: 120,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: theme.spacing(2),
      borderLeft: 'none'
    }),
    ...props.sx
  };
  
  // Render header content
  const renderHeader = () => (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
      <Box flex={1}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap">
          {icon && (
            <Box sx={{ 
              color: urgent ? getPriorityColor() : borderColor, 
              display: 'flex', 
              alignItems: 'center' 
            }}>
              {icon}
            </Box>
          )}
          <Typography variant="body1" fontWeight={600}>
            {title}
          </Typography>
          {urgent && (
            <Chip
              size="small"
              label="URGENT"
              color="error"
              sx={{
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                  '100%': { opacity: 1 }
                }
              }}
            />
          )}
          {status && (
            <Chip 
              label={status} 
              size="small" 
              color={statusColor}
              sx={{
                borderRadius: 0,
                fontWeight: 600,
                height: 24,
                ml: 'auto'
              }}
            />
          )}
        </Stack>
        
        {/* Subtitle */}
        {subtitle && (
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            {subtitle}
          </Typography>
        )}
        
        {/* Details - only show if not using Card or not expandable */}
        {!shouldUseCard && details.length > 0 && (
          <Stack spacing={0.5}>
            {details.map((detail, index) => (
              <Typography key={index} variant="caption" color="text.secondary">
                {detail.label && <strong>{detail.label}: </strong>}
                {detail.value}
              </Typography>
            ))}
          </Stack>
        )}
      </Box>
      
      {/* Actions */}
      <Stack direction="row" spacing={0.5}>
        {headerAction}
        {Array.isArray(actions) && actions.map((action, index) => 
          action && (
            <Tooltip key={index} title={action.label || ''}>
              <IconButton 
                size="small" 
                onClick={action.onClick}
                disabled={action.disabled}
                color={action.color || 'default'}
              >
                {action.icon}
              </IconButton>
            </Tooltip>
          )
        )}
        {onEdit && (
          <IconButton size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        )}
        {onMore && (
          <IconButton size="small" onClick={onMore}>
            <MoreIcon fontSize="small" />
          </IconButton>
        )}
        {expandable && (
          <IconButton
            size="small"
            onClick={handleExpandClick}
            sx={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    </Stack>
  );
  
  // Render content section
  const renderContent = () => (
    <>
      {/* Details for Card variant */}
      {shouldUseCard && details.length > 0 && (
        <Stack spacing={0.5} mb={1}>
          {details.map((detail, index) => (
            <Typography key={index} variant="caption" color="text.secondary">
              {detail.label && <strong>{detail.label}: </strong>}
              {detail.value}
            </Typography>
          ))}
        </Stack>
      )}
      
      {/* Children content */}
      {children && (
        <Box mt={shouldUseCard ? 0 : 1}>
          {children}
        </Box>
      )}
      
      {/* Expandable content */}
      {expandable && expandedContent && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 1 }} />
          <Box>
            {expandedContent}
          </Box>
        </Collapse>
      )}
    </>
  );
  
  // Render card actions if provided
  const renderActions = () => {
    if (!actions || !Array.isArray(actions)) return null;
    
    const buttonActions = actions.filter(action => action && action.type === 'button');
    if (buttonActions.length === 0) return null;
    
    return (
      <CardActions sx={{ px: 2, py: 1 }}>
        <Stack direction="row" spacing={1}>
          {buttonActions.map((action, index) => (
            <Button
              key={index}
              size="small"
              variant={action.variant || 'text'}
              color={action.color || 'primary'}
              onClick={action.onClick}
              disabled={action.disabled}
              startIcon={action.icon}
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      </CardActions>
    );
  };
  
  // Use Card component for expandable content
  if (shouldUseCard) {
    return (
      <Card sx={baseStyles} onClick={onClick}>
        <CardHeader
          title={renderHeader()}
          sx={{ p: 2, pb: 1 }}
        />
        <CardContent sx={{ p: 2, pt: 0, '&:last-child': { pb: 2 } }}>
          {renderContent()}
        </CardContent>
        {renderActions()}
      </Card>
    );
  }
  
  // Use Paper component for simple cards
  return (
    <Paper elevation={0} sx={baseStyles} onClick={onClick}>
      {renderHeader()}
      {renderContent()}
    </Paper>
  );
};

export default ClinicalResourceCard;