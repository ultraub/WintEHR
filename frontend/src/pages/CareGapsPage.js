import React, { useState, useEffect } from 'react';
import StatTile from '../components/common/StatTile';
import PageHeader from '../components/common/PageHeader';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Stack,
  Grid,
  Chip,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import ClinicalLoadingState from '../components/clinical/shared/ClinicalLoadingState';
import ClinicalEmptyState from '../components/clinical/shared/ClinicalEmptyState';
import dashboardDataService from '../services/dashboard/dashboardDataService';

const CareGapsPage = () => {
  const [careGapsData, setCareGapsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCareGaps = async () => {
    try {
      setLoading(true);
      setError(null);
      // Clear the cache so we get fresh data
      dashboardDataService.clearCache();
      const data = await dashboardDataService.getCareGaps();
      if (data.error) {
        throw new Error('Failed to fetch care gaps from FHIR server');
      }
      setCareGapsData(data);
    } catch (err) {
      console.error('Error fetching care gaps:', err);
      setError(err.message || 'Failed to load care gap data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCareGaps();
  }, []);

  const gaps = careGapsData?.gaps || [];
  const totalPatients = careGapsData?.totalPatients || 0;

  // Compute summary stats from real data
  const highPriorityGaps = gaps.filter(g => g.percentage < 50).length;
  const mediumPriorityGaps = gaps.filter(g => g.percentage >= 50 && g.percentage < 75).length;
  const lowPriorityGaps = gaps.filter(g => g.percentage >= 75).length;

  const getPriorityFromPercentage = (percentage) => {
    if (percentage < 50) return { label: 'High', color: 'error' };
    if (percentage < 75) return { label: 'Medium', color: 'warning' };
    return { label: 'Low', color: 'success' };
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 75) return 'success';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 400, p: 3 }}>
        <ClinicalLoadingState.Page />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <ClinicalEmptyState
          title="Unable to load care gaps"
          message={`Failed to load care gaps: ${error}`}
          severity="error"
          actions={[
            { label: 'Retry', icon: <RefreshIcon />, onClick: fetchCareGaps }
          ]}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <PageHeader
          title="Care Gaps"
          subtitle={highPriorityGaps > 0 ? `${highPriorityGaps} high-priority gap${highPriorityGaps === 1 ? '' : 's'}` : undefined}
          sx={{ mb: 0, flexGrow: 1 }}
        />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchCareGaps}>
          Refresh
        </Button>
      </Stack>

      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
        Care gaps are calculated in real-time from Synthea synthetic patient data stored in HAPI FHIR.
        Completion percentages reflect actual FHIR resource queries for immunizations, observations, and procedures.
      </Alert>

      {/* Summary tiles */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatTile label="Total patients" value={totalPatients} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatTile label="High priority" value={highPriorityGaps} tone="critical" caption="Under 50% complete" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatTile label="Medium priority" value={mediumPriorityGaps} tone="attention" caption="50–75% complete" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatTile label="On track" value={lowPriorityGaps} caption="Over 75% complete" />
        </Grid>
      </Grid>

      {/* Care Gap Details */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preventive Care Measures
              </Typography>

              {gaps.length === 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  No care gap data available. Ensure HAPI FHIR has patient data loaded.
                </Alert>
              )}

              <Stack spacing={3} sx={{ mt: 2 }}>
                {gaps.map((gap, index) => {
                  const priority = getPriorityFromPercentage(gap.percentage);
                  const openGapCount = Math.max(0, gap.eligible - gap.completed);
                  return (
                    <Box key={index}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="h5" sx={{ minWidth: 32 }}>
                          {gap.icon}
                        </Typography>
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" fontWeight="bold">
                              {gap.measure}
                            </Typography>
                            <Chip
                              label={priority.label}
                              color={priority.color}
                              size="small"
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {gap.description}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', minWidth: 100 }}>
                          <Typography variant="h5" color="primary">
                            {gap.percentage}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            compliance
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          Completed: <strong>{gap.completed}</strong> / {gap.eligible} eligible
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Open gaps: <strong>{openGapCount}</strong>
                        </Typography>
                      </Stack>

                      <LinearProgress
                        variant="determinate"
                        value={gap.percentage}
                        color={getProgressColor(gap.percentage)}
                        sx={{ height: 10, borderRadius: 5 }}
                      />

                      {index < gaps.length - 1 && <Divider sx={{ mt: 2 }} />}
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Gap Summary
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>High Priority (&lt;50%)</Typography>
                    <Chip label={highPriorityGaps} color="error" size="small" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Medium Priority (50-75%)</Typography>
                    <Chip label={mediumPriorityGaps} color="warning" size="small" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>On Track (&gt;75%)</Typography>
                    <Chip label={lowPriorityGaps} color="success" size="small" />
                  </Stack>
                  <Divider />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight="bold">Total Measures</Typography>
                    <Chip label={gaps.length} color="primary" size="small" />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  About Care Gaps
                </Typography>
                <Typography variant="body2" component="div">
                  Care gaps are calculated from FHIR resources in real-time:
                  <br /><br />
                  &bull; <strong>Flu Vaccination</strong> &mdash; Checks Immunization resources for influenza vaccines in the past year<br />
                  &bull; <strong>Diabetes A1C</strong> &mdash; Searches Observation resources for HbA1c tests (LOINC 4548-4) in the last 6 months among diabetic patients<br />
                  &bull; <strong>Mammography</strong> &mdash; Checks Procedure resources for breast cancer screening in women 40+ within the last 2 years<br />
                  &bull; <strong>Colonoscopy</strong> &mdash; Searches Procedure resources for colorectal screening in adults 50+ within the last 10 years<br />
                  <br />
                  In a production system, these would use CQL (Clinical Quality Language) and FHIR Measure/MeasureReport resources.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CareGapsPage;
