import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  Button,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  Close as CloseIcon,
  Code as CodeIcon,
  Cloud as CloudIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import cdsStudioApi from '../services/cdsStudioApi';
import ConfigurationViewer from './ConfigurationViewer';
import ServiceTestRunner from './ServiceTestRunner';
import VersionHistory from './VersionHistory';

const ServiceDetailPanel = ({ service, open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [configuration, setConfiguration] = useState(null);
  const [configView, setConfigView] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (service && open) {
      loadServiceData();
    }
  }, [service, open]);

  const loadServiceData = async () => {
    if (!service) return;

    try {
      setLoading(true);
      setError(null);

      // Load configuration and metrics in parallel
      const [configData, viewData] = await Promise.all([
        cdsStudioApi.getServiceConfiguration(service.service_id),
        cdsStudioApi.getConfigurationView(service.service_id)
      ]);

      setConfiguration(configData);
      setConfigView(viewData);

      // Try to load metrics (may not exist yet)
      try {
        const metricsData = await cdsStudioApi.getServiceMetrics(service.service_id);
        setMetrics(metricsData);
      } catch (err) {
        // Metrics may not exist for new services
        console.log('No metrics available:', err);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (!service) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: '80%', md: '70%', lg: '60%' } }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Box display="flex" alignItems="center" gap={1}>
              {service.origin === 'built-in' ? (
                <CodeIcon color="primary" />
              ) : (
                <CloudIcon color="warning" />
              )}
              <Typography variant="h6">{service.title}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" fontFamily="monospace">
              {service.service_id}
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <IconButton size="small" onClick={loadServiceData}>
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Overview" />
          <Tab label="Configuration" />
          <Tab label="Monitor" />
          <Tab label="Test" />
          <Tab label="Versions" />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Overview Tab */}
              {tabValue === 0 && (
                <OverviewTab
                  service={service}
                  configuration={configuration}
                  metrics={metrics}
                />
              )}

              {/* Configuration Tab */}
              {tabValue === 1 && configView && (
                <ConfigurationViewer configView={configView} />
              )}

              {/* Monitor Tab */}
              {tabValue === 2 && (
                <MonitorTab service={service} metrics={metrics} />
              )}

              {/* Test Tab */}
              {tabValue === 3 && (
                <ServiceTestRunner serviceId={service.service_id} />
              )}

              {/* Versions Tab */}
              {tabValue === 4 && (
                <VersionHistory serviceId={service.service_id} />
              )}
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

// Overview Tab Component
const OverviewTab = ({ service, configuration, metrics }) => (
  <Box>
    <Grid container spacing={3}>
      {/* Service Metadata */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Service Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Service ID
                </Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {service.service_id}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Version
                </Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {service.version}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Hook Type
                </Typography>
                <Chip label={service.hook_type} size="small" />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Origin
                </Typography>
                <Chip
                  label={service.origin}
                  size="small"
                  color={service.origin === 'built-in' ? 'primary' : 'warning'}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={service.status}
                  size="small"
                  color={service.status === 'active' ? 'success' : 'default'}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Quick Stats */}
      {metrics && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Stats (24 hours)
                </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Executions
                  </Typography>
                  <Typography variant="h4">
                    {metrics.executions_24h || 0}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Success Rate
                  </Typography>
                  <Typography
                    variant="h4"
                    color={metrics.success_rate >= 95 ? 'success.main' : 'warning.main'}
                  >
                    {metrics.success_rate?.toFixed(1) || 0}%
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Avg Response Time
                  </Typography>
                  <Typography variant="h4">
                    {metrics.avg_response_time_ms || 0}ms
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Cards Shown
                  </Typography>
                  <Typography variant="h4">
                    {metrics.cards_shown || 0}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Description */}
      {configuration?.metadata?.description && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Description
              </Typography>
              <Typography variant="body1">
                {configuration.metadata.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  </Box>
);

// Monitor Tab Component
const MonitorTab = ({ service, metrics }) => (
  <Box>
    {metrics ? (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total Executions
                  </Typography>
                  <Typography variant="h5">{metrics.total_executions}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Success Rate
                  </Typography>
                  <Typography variant="h5">{metrics.success_rate}%</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">
                    Avg Response Time
                  </Typography>
                  <Typography variant="h6">{metrics.avg_response_time_ms}ms</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">
                    P95 Response Time
                  </Typography>
                  <Typography variant="h6">{metrics.p95_response_time_ms}ms</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">
                    P99 Response Time
                  </Typography>
                  <Typography variant="h6">{metrics.p99_response_time_ms}ms</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Card Metrics */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Card Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Cards Shown
                  </Typography>
                  <Typography variant="h6">{metrics.cards_shown}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Accepted
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {metrics.cards_accepted}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Overridden
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {metrics.cards_overridden}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Ignored
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    {metrics.cards_ignored}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    ) : (
      <Alert severity="info">
        No metrics available for this service yet. Metrics will appear after the service has been executed.
      </Alert>
    )}
  </Box>
);

export default ServiceDetailPanel;
