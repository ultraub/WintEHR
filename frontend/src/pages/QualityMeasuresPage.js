import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Stack,
  Grid,
  LinearProgress,
  Chip,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Assessment as QualityIcon,
  TrendingUp as TrendIcon,
  GetApp as ExportIcon,
  CheckCircle as MetIcon,
  Cancel as NotMetIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const QualityMeasuresPage = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQualityMeasures = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/quality/measures/summary');
        if (!response.ok) {
          throw new Error(`Failed to fetch quality measures: ${response.status}`);
        }
        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error('Error fetching quality measures:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQualityMeasures();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'met': return 'success';
      case 'not-met': return 'error';
      case 'not-applicable': return 'default';
      default: return 'warning';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'met': return 'Met';
      case 'not-met': return 'Not Met';
      case 'not-applicable': return 'N/A';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Calculating quality measures from FHIR data...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load quality measures: {error}
        </Alert>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  const measures = summary?.top_measures || [];

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <QualityIcon color="primary" />
        <Typography variant="h4" component="h1">
          Quality Measures
        </Typography>
        <Button variant="contained" startIcon={<ExportIcon />} disabled>
          Export Report
        </Button>
        <Button variant="outlined" startIcon={<TrendIcon />} disabled>
          View Trends
        </Button>
      </Stack>

      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
        Quality measures are calculated in real-time from Synthea synthetic patient data stored in HAPI FHIR.
        Numerator and denominator values reflect actual FHIR resource queries.
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {summary?.overall_score?.toFixed(1) || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overall Quality Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                <MetIcon color="success" />
                <Typography variant="h3" color="success.main">
                  {summary?.measures_met || 0}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Measures Met
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                <NotMetIcon color="error" />
                <Typography variant="h3" color="error.main">
                  {summary?.measures_not_met || 0}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Measures Not Met
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Individual Measures */}
      <Grid container spacing={3}>
        {measures.map((measure) => (
          <Grid item xs={12} md={6} lg={4} key={measure.id}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" noWrap title={measure.name}>
                    {measure.name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {measure.description}
                  </Typography>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h4" color="primary">
                      {measure.score}%
                    </Typography>
                    <Chip
                      label={getStatusLabel(measure.status)}
                      color={getStatusColor(measure.status)}
                      size="small"
                    />
                  </Stack>

                  <Divider />

                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Numerator: <strong>{measure.numerator}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Denominator: <strong>{measure.denominator}</strong>
                    </Typography>
                  </Stack>

                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="body2">Progress to Target</Typography>
                      <Typography variant="body2">{measure.target}% target</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((measure.score / measure.target) * 100, 100)}
                      color={measure.score >= measure.target ? 'success' : 'primary'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Chip
                    label={measure.category?.replace('-', ' ')}
                    size="small"
                    variant="outlined"
                    sx={{ alignSelf: 'flex-start', textTransform: 'capitalize' }}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {measures.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No quality measures available. Ensure HAPI FHIR has patient data loaded.
        </Alert>
      )}

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            About Quality Measures
          </Typography>
          <Typography variant="body2" component="div">
            Quality measures are calculated from FHIR resources in real-time:
            <br/><br/>
            &bull; <strong>Diabetes HbA1c Testing</strong> — Searches Condition resources for diabetes codes, then checks for HbA1c Observations (LOINC 4548-4) in the last 6 months<br/>
            &bull; <strong>Breast Cancer Screening</strong> — Identifies women 50-74, checks for mammography Observations (LOINC 24606-6) in the last 2 years<br/>
            &bull; <strong>Medication Adherence</strong> — Counts active MedicationRequest resources and estimates adherence rates<br/>
            <br/>
            In a production system, these would use CQL (Clinical Quality Language) and FHIR Measure/MeasureReport resources
            via HAPI FHIR&apos;s Clinical Reasoning module.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default QualityMeasuresPage;
