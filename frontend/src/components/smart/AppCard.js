/**
 * SMART App Card Component
 *
 * Displays a registered SMART app in a card format with:
 * - App icon/logo
 * - Name and description
 * - Scope indicators
 * - Launch button
 *
 * Educational Purpose:
 * Shows how an EHR displays SMART app metadata including
 * permissions (scopes) that will be requested.
 *
 * @module AppCard
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  CircularProgress,
  Skeleton
} from '@mui/material';
import {
  Launch as LaunchIcon,
  Info as InfoIcon,
  OpenInNew as OpenInNewIcon,
  Security as SecurityIcon,
  LocalHospital as ClinicalIcon,
  Assessment as AnalyticsIcon,
  School as EducationalIcon,
  Apps as OtherIcon
} from '@mui/icons-material';

// ============================================================================
// Scope Display Configuration
// ============================================================================

const SCOPE_CATEGORIES = {
  read: { label: 'Read', color: 'info', icon: '👁️' },
  write: { label: 'Write', color: 'warning', icon: '✏️' },
  launch: { label: 'Launch', color: 'success', icon: '🚀' },
  identity: { label: 'Identity', color: 'secondary', icon: '👤' }
};

/**
 * Categorize a scope for display
 */
const categorizeScope = (scope) => {
  if (scope.includes('write')) return 'write';
  if (scope.includes('read')) return 'read';
  if (scope.startsWith('launch')) return 'launch';
  if (['openid', 'fhirUser', 'profile'].includes(scope)) return 'identity';
  return 'read';
};

/**
 * Get app category icon
 */
const getCategoryIcon = (category) => {
  switch (category) {
    case 'clinical':
      return <ClinicalIcon fontSize="small" />;
    case 'analytics':
      return <AnalyticsIcon fontSize="small" />;
    case 'educational':
      return <EducationalIcon fontSize="small" />;
    default:
      return <OtherIcon fontSize="small" />;
  }
};

// ============================================================================
// Loading Skeleton
// ============================================================================

export const AppCardSkeleton = () => (
  <Card
    sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 0 // Clinical sharp corners
    }}
  >
    <CardContent sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Skeleton variant="circular" width={48} height={48} />
        <Box sx={{ ml: 2, flexGrow: 1 }}>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="40%" height={16} />
        </Box>
      </Box>
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="80%" />
      <Box sx={{ mt: 2, display: 'flex', gap: 0.5 }}>
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="rounded" width={60} height={24} />
      </Box>
    </CardContent>
    <CardActions>
      <Skeleton variant="rounded" width={100} height={36} />
    </CardActions>
  </Card>
);

// ============================================================================
// Main Component
// ============================================================================

const AppCard = ({
  app,
  onLaunch,
  onInfo,
  isLaunching = false,
  isRunning = false,
  disabled = false,
  compact = false,
  showScopes = true,
  category = 'other'
}) => {
  // Parse scopes for display
  const scopeSummary = useMemo(() => {
    if (!app?.scopes?.length) return [];

    const categories = app.scopes.reduce((acc, scope) => {
      const cat = categorizeScope(scope);
      if (!acc[cat]) {
        acc[cat] = { ...SCOPE_CATEGORIES[cat], count: 0 };
      }
      acc[cat].count++;
      return acc;
    }, {});

    return Object.entries(categories).map(([key, value]) => ({
      key,
      ...value
    }));
  }, [app?.scopes]);

  // Count resource types accessed
  const resourceCount = useMemo(() => {
    if (!app?.scopes?.length) return 0;
    const resources = new Set();
    app.scopes.forEach(scope => {
      const match = scope.match(/patient\/(\w+)/);
      if (match) resources.add(match[1]);
    });
    return resources.size;
  }, [app?.scopes]);

  if (!app) return null;

  const handleLaunch = (e) => {
    e.stopPropagation();
    if (onLaunch && !disabled && !isLaunching) {
      onLaunch(app);
    }
  };

  const handleInfo = (e) => {
    e.stopPropagation();
    if (onInfo) {
      onInfo(app);
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0, // Clinical sharp corners
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 3
        },
        ...(isRunning && {
          borderLeft: '4px solid',
          borderLeftColor: 'success.main'
        }),
        ...(disabled && {
          opacity: 0.6
        })
      }}
      elevation={1}
    >
      <CardContent sx={{ flexGrow: 1, p: compact ? 1.5 : 2 }}>
        {/* Header with logo and name */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: compact ? 1 : 2 }}>
          <Avatar
            src={app.logo_uri}
            alt={app.name}
            sx={{
              width: compact ? 40 : 48,
              height: compact ? 40 : 48,
              bgcolor: 'primary.light',
              borderRadius: 0 // Sharp corners
            }}
          >
            {app.name?.charAt(0) || 'A'}
          </Avatar>

          <Box sx={{ ml: 2, flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant={compact ? 'subtitle1' : 'h6'}
                component="h3"
                sx={{
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {app.name}
              </Typography>

              {isRunning && (
                <Chip
                  label="Running"
                  size="small"
                  color="success"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>

            {/* Category indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              {getCategoryIcon(category)}
              <Typography variant="caption" color="text.secondary">
                {category.charAt(0).toUpperCase() + category.slice(1)} App
              </Typography>
            </Box>
          </Box>

          {/* Info button */}
          <Tooltip title="App details">
            <IconButton
              size="small"
              onClick={handleInfo}
              sx={{ ml: 1 }}
            >
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Description */}
        {!compact && app.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {app.description}
          </Typography>
        )}

        {/* Scope summary */}
        {showScopes && scopeSummary.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {scopeSummary.map(({ key, label, color, count, icon }) => (
              <Tooltip
                key={key}
                title={`${count} ${label.toLowerCase()} permission${count > 1 ? 's' : ''}`}
              >
                <Chip
                  label={`${icon} ${label}`}
                  size="small"
                  color={color}
                  variant="outlined"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    borderRadius: 0 // Sharp corners
                  }}
                />
              </Tooltip>
            ))}

            {resourceCount > 0 && (
              <Tooltip title={`Accesses ${resourceCount} resource type${resourceCount > 1 ? 's' : ''}`}>
                <Chip
                  icon={<SecurityIcon sx={{ fontSize: 14 }} />}
                  label={`${resourceCount} types`}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    borderRadius: 0
                  }}
                />
              </Tooltip>
            )}
          </Box>
        )}
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ p: compact ? 1.5 : 2, pt: 0 }}>
        <Button
          variant="contained"
          color="primary"
          size={compact ? 'small' : 'medium'}
          startIcon={
            isLaunching ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <LaunchIcon />
            )
          }
          endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
          onClick={handleLaunch}
          disabled={disabled || isLaunching}
          sx={{
            borderRadius: 0, // Sharp corners
            textTransform: 'none',
            flexGrow: 1
          }}
        >
          {isLaunching ? 'Launching...' : isRunning ? 'Open Again' : 'Launch'}
        </Button>
      </CardActions>
    </Card>
  );
};

AppCard.propTypes = {
  app: PropTypes.shape({
    client_id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    logo_uri: PropTypes.string,
    scopes: PropTypes.arrayOf(PropTypes.string)
  }),
  onLaunch: PropTypes.func,
  onInfo: PropTypes.func,
  isLaunching: PropTypes.bool,
  isRunning: PropTypes.bool,
  disabled: PropTypes.bool,
  compact: PropTypes.bool,
  showScopes: PropTypes.bool,
  category: PropTypes.oneOf(['clinical', 'analytics', 'educational', 'other'])
};

export default AppCard;
