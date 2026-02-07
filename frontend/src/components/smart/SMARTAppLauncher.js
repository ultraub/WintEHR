/**
 * SMART App Launcher Drawer
 *
 * A slide-out drawer that displays registered SMART apps
 * and allows launching them within patient context.
 *
 * Educational Purpose:
 * Demonstrates how an EHR integrates SMART app launching:
 * - Lists available apps based on user/patient context
 * - Shows app permissions (scopes) before launch
 * - Initiates EHR Launch flow with current patient
 *
 * @module SMARTAppLauncher
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Grid,
  Button,
  Alert,
  Chip,
  Divider,
  Skeleton,
  Badge,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Apps as AppsIcon,
  LocalHospital as ClinicalIcon,
  Assessment as AnalyticsIcon,
  School as EducationalIcon,
  MoreHoriz as OtherIcon,
  OpenInNew as OpenInNewIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import AppCard, { AppCardSkeleton } from './AppCard';
import { useSMART, useSMARTApps, useSMARTLaunch } from '../../contexts/SMARTContext';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';

// ============================================================================
// Constants
// ============================================================================

const DRAWER_WIDTH = 480;

const CATEGORY_TABS = [
  { value: 'all', label: 'All Apps', icon: <AppsIcon /> },
  { value: 'clinical', label: 'Clinical', icon: <ClinicalIcon /> },
  { value: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
  { value: 'educational', label: 'Educational', icon: <EducationalIcon /> },
  { value: 'other', label: 'Other', icon: <OtherIcon /> }
];

// ============================================================================
// Helper Components
// ============================================================================

const PatientContextBar = ({ patient }) => {
  if (!patient) {
    return (
      <Alert severity="warning" sx={{ mb: 2, borderRadius: 0 }}>
        <Typography variant="body2">
          <strong>No patient selected.</strong> Select a patient to launch apps in patient context.
        </Typography>
      </Alert>
    );
  }

  const patientName = patient.name?.[0]
    ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
    : 'Unknown Patient';

  return (
    <Box
      sx={{
        p: 1.5,
        mb: 2,
        bgcolor: 'primary.50',
        borderLeft: '4px solid',
        borderColor: 'primary.main',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}
    >
      <ClinicalIcon color="primary" fontSize="small" />
      <Box>
        <Typography variant="caption" color="text.secondary">
          Launching for patient:
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {patientName}
        </Typography>
      </Box>
      <Chip
        label={patient.id}
        size="small"
        variant="outlined"
        sx={{ ml: 'auto', borderRadius: 0, fontSize: '0.7rem' }}
      />
    </Box>
  );
};

const EmptyState = ({ category, hasSearch }) => (
  <Box
    sx={{
      textAlign: 'center',
      py: 6,
      px: 3
    }}
  >
    <AppsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
    <Typography variant="h6" color="text.secondary" gutterBottom>
      No apps found
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {hasSearch
        ? 'Try adjusting your search terms'
        : category === 'all'
          ? 'No SMART apps are currently registered'
          : `No ${category} apps are available`
      }
    </Typography>
  </Box>
);

// ============================================================================
// Main Component
// ============================================================================

const SMARTAppLauncher = ({
  open,
  onClose,
  anchor = 'right'
}) => {
  // State
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [launchingAppId, setLaunchingAppId] = useState(null);

  // Context hooks
  const { currentPatient } = useFHIRResource();
  const { apps, loading, error, refresh } = useSMARTApps();
  const { isAppRunning, runningAppCount } = useSMART();
  const { launch, state: launchState, error: launchError, reset: resetLaunch } = useSMARTLaunch();

  // -------------------------------------------------------------------------
  // App Filtering & Categorization
  // -------------------------------------------------------------------------

  /**
   * Categorize an app based on its scopes and name
   */
  const categorizeApp = useCallback((app) => {
    if (!app) return 'other';

    // Check scopes for patient data access
    const hasPatientScopes = app.scopes?.some(s => s.includes('patient/'));
    if (hasPatientScopes) return 'clinical';

    // Check name patterns
    const nameLower = (app.name || '').toLowerCase();
    if (nameLower.includes('chart') || nameLower.includes('view')) return 'analytics';
    if (nameLower.includes('learn') || nameLower.includes('education')) return 'educational';

    return 'other';
  }, []);

  /**
   * Apps with categories attached
   */
  const categorizedApps = useMemo(() => {
    return apps.map(app => ({
      ...app,
      category: categorizeApp(app)
    }));
  }, [apps, categorizeApp]);

  /**
   * Filtered apps based on tab and search
   */
  const filteredApps = useMemo(() => {
    let result = categorizedApps;

    // Filter by category
    if (selectedTab !== 'all') {
      result = result.filter(app => app.category === selectedTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(app =>
        app.name?.toLowerCase().includes(query) ||
        app.description?.toLowerCase().includes(query) ||
        app.client_id?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [categorizedApps, selectedTab, searchQuery]);

  /**
   * Count apps per category for tab badges
   */
  const categoryCounts = useMemo(() => {
    const counts = { all: categorizedApps.length };
    CATEGORY_TABS.slice(1).forEach(tab => {
      counts[tab.value] = categorizedApps.filter(app => app.category === tab.value).length;
    });
    return counts;
  }, [categorizedApps]);

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleRefresh = () => {
    refresh(true);
  };

  const handleLaunchApp = async (app) => {
    if (!currentPatient?.id) {
      // Could show a patient picker here
      return;
    }

    setLaunchingAppId(app.client_id);
    resetLaunch();

    try {
      await launch(app.client_id);
    } catch (err) {
      console.error('Failed to launch app:', err);
    } finally {
      setLaunchingAppId(null);
    }
  };

  const handleAppInfo = (app) => {
    // TODO: Show app details dialog with full scope breakdown
    console.log('Show app info:', app);
  };

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setLaunchingAppId(null);
    }
  }, [open]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: DRAWER_WIDTH,
          maxWidth: '100vw',
          borderRadius: 0 // Clinical sharp corners
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 1
        }}
      >
        <AppsIcon color="primary" sx={{ mr: 1.5 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="h2">
            SMART Apps
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Launch third-party applications
          </Typography>
        </Box>

        {runningAppCount > 0 && (
          <Tooltip title={`${runningAppCount} app${runningAppCount > 1 ? 's' : ''} running`}>
            <Chip
              label={runningAppCount}
              size="small"
              color="success"
              sx={{ mr: 1, borderRadius: 0 }}
            />
          </Tooltip>
        )}

        <Tooltip title="Refresh apps">
          <IconButton onClick={handleRefresh} disabled={loading} size="small" sx={{ mr: 1 }}>
            {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>

        <IconButton onClick={onClose} edge="end">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Patient Context */}
      <Box sx={{ px: 2, pt: 2 }}>
        <PatientContextBar patient={currentPatient} />
      </Box>

      {/* Search */}
      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search apps..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
            sx: { borderRadius: 0 }
          }}
        />
      </Box>

      {/* Category Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              textTransform: 'none'
            }
          }}
        >
          {CATEGORY_TABS.map(({ value, label, icon }) => (
            <Tab
              key={value}
              value={value}
              label={
                <Badge
                  badgeContent={categoryCounts[value]}
                  color="primary"
                  max={99}
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pr: 1.5 }}>
                    {icon}
                    <span>{label}</span>
                  </Box>
                </Badge>
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2, borderRadius: 0 }}>
          {error}
        </Alert>
      )}

      {/* Launch Error Display */}
      {launchError && (
        <Alert severity="error" sx={{ m: 2, borderRadius: 0 }} onClose={resetLaunch}>
          {launchError}
        </Alert>
      )}

      {/* App Grid */}
      <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
        {loading && apps.length === 0 ? (
          // Loading skeletons
          <Grid container spacing={2}>
            {[1, 2, 3].map(i => (
              <Grid item xs={12} key={i}>
                <AppCardSkeleton />
              </Grid>
            ))}
          </Grid>
        ) : filteredApps.length === 0 ? (
          <EmptyState category={selectedTab} hasSearch={!!searchQuery} />
        ) : (
          <Grid container spacing={2}>
            {filteredApps.map(app => (
              <Grid item xs={12} key={app.client_id}>
                <AppCard
                  app={app}
                  category={app.category}
                  onLaunch={handleLaunchApp}
                  onInfo={handleAppInfo}
                  isLaunching={launchingAppId === app.client_id}
                  isRunning={isAppRunning(app.client_id)}
                  disabled={!currentPatient?.id}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Footer with Educational Info */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'grey.50'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <InfoIcon fontSize="small" color="info" />
          <Typography variant="caption" fontWeight={600}>
            Educational Notes
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" component="p">
          SMART apps use OAuth2 to securely access patient data. When you launch an app,
          it receives a token that grants access only to the scopes you approved.
        </Typography>
        <Button
          size="small"
          startIcon={<OpenInNewIcon />}
          sx={{ mt: 1, textTransform: 'none', borderRadius: 0 }}
          onClick={() => window.open('https://hl7.org/fhir/smart-app-launch/', '_blank')}
        >
          Learn about SMART on FHIR
        </Button>
      </Box>
    </Drawer>
  );
};

SMARTAppLauncher.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  anchor: PropTypes.oneOf(['left', 'right', 'top', 'bottom'])
};

export default SMARTAppLauncher;
