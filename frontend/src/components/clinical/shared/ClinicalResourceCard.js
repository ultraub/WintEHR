/**
 * ClinicalResourceCard Component
 * Standardized card component for displaying FHIR resources with clinical severity indicators
 * Based on Chart Review Tab gold standard design
 */
import React from 'react';
import {
  Paper,
  Box,
  Stack,
  Typography,
  IconButton,
  Chip,
  useTheme,
  alpha,
  Tooltip
} from '@mui/material';
import { Edit as EditIcon, MoreVert as MoreIcon } from '@mui/icons-material';
import { clinicalTokens } from '../../../themes/clinicalTheme';

/**
 * Standardized clinical resource card with consistent styling
 * @param {Object} props
 * @param {string} props.title - Main title of the resource
 * @param {string} props.subtitle - Secondary information
 * @param {React.ReactNode} props.icon - Icon to display
 * @param {string} props.severity - Severity level: 'critical', 'high', 'moderate', 'low', 'normal'
 * @param {string} props.status - Status chip text
 * @param {string} props.statusColor - MUI color for status chip
 * @param {Array} props.details - Array of detail objects with label and value
 * @param {Function} props.onEdit - Edit click handler
 * @param {Function} props.onMore - More menu click handler
 * @param {boolean} props.isAlternate - Alternate row background
 * @param {React.ReactNode} props.actions - Custom action buttons
 * @param {React.ReactNode} props.children - Additional content
 */
const ClinicalResourceCard = ({
  title,
  subtitle,
  icon,
  severity = 'normal',
  status,
  statusColor = 'default',
  details = [],
  onEdit,
  onMore,
  isAlternate = false,
  actions,
  children,
  ...props
}) => {
  const theme = useTheme();
  
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
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0, // Sharp corners per gold standard
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: borderColor,
        backgroundColor: isAlternate ? alpha(theme.palette.action.hover, 0.04) : theme.palette.background.paper,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.action.hover, 0.08),
          transform: 'translateX(2px)',
          boxShadow: theme.shadows[1]
        },
        ...props.sx
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1}>
          {/* Header */}
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            {icon && (
              <Box sx={{ color: borderColor, display: 'flex', alignItems: 'center' }}>
                {icon}
              </Box>
            )}
            <Typography variant="body1" fontWeight={600}>
              {title}
            </Typography>
            {status && (
              <Chip 
                label={status} 
                size="small" 
                color={statusColor}
                sx={{
                  borderRadius: '4px', // Slightly rounded for chips
                  fontWeight: 600,
                  height: 24
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
          
          {/* Details */}
          {details.length > 0 && (
            <Stack spacing={0.5}>
              {details.map((detail, index) => (
                <Typography key={index} variant="caption" color="text.secondary">
                  {detail.label && <strong>{detail.label}: </strong>}
                  {detail.value}
                </Typography>
              ))}
            </Stack>
          )}
          
          {/* Additional content */}
          {children && (
            <Box mt={1}>
              {children}
            </Box>
          )}
        </Box>
        
        {/* Actions */}
        <Stack direction="row" spacing={0.5}>
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
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ClinicalResourceCard;