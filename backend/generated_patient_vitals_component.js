import React, { useState, useEffect, useMemo } from 'react';
import { Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, CircularProgress, IconButton, Tooltip, Tab, Tabs, Divider } from '@mui/material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, differenceInYears } from 'date-fns';
import { TrendingUp, TrendingDown, Warning, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';


// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm');
  } catch {
    return dateString;
  }
};

const getValueWithUnit = (valueQuantity) => {
  if (!valueQuantity) return 'N/A';
  const value = valueQuantity.value || '';
  const unit = valueQuantity.unit || valueQuantity.code || '';
  return `${value} ${unit}`.trim();
};

const getCodingDisplay = (coding) => {
  if (!coding || !Array.isArray(coding)) return 'Unknown';
  const primaryCoding = coding.find(c => c.display) || coding[0];
  return primaryCoding?.display || primaryCoding?.code || 'Unknown';
};

const getResourceReference = (reference) => {
  if (!reference || !reference.reference) return null;
  const parts = reference.reference.split('/');
  return parts.length === 2 ? { type: parts[0], id: parts[1] } : null;
};

const getStatusColor = (status) => {
  const statusColors = {
    active: 'success',
    completed: 'default',
    error: 'error',
    stopped: 'warning',
    'entered-in-error': 'error',
    draft: 'info',
    unknown: 'default'
  };
  return statusColors[status?.toLowerCase()] || 'default';
};

const getRiskLevel = (value, thresholds) => {
  if (!value || !thresholds) return { level: 'normal', color: 'inherit' };
  
  if (value >= thresholds.critical) {
    return { level: 'critical', color: 'error' };
  } else if (value >= thresholds.high) {
    return { level: 'high', color: 'warning' };
  } else if (value <= thresholds.low) {
    return { level: 'low', color: 'info' };
  }
  return { level: 'normal', color: 'success' };
};


const GeneratedComponent = ({ patientId }) => {
  const [stage1Data, setStage1Data] = useState(null);
  const [stage2Data, setStage2Data] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    // In production, fetch from FHIR API
    const loadData = async () => {
      try {
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    loadData();
  }, [patientId]);

  // Process aggregated data
  const aggregatedMetrics = useMemo(() => {
    const metrics = {};
    metrics['stage1'] = {"latest_per_patient": true};
    metrics['stage2'] = {"latest_per_patient": true};
    return metrics;
  }, []);


  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Records
              </Typography>
              <Typography variant="h4">
                0
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Resource Types
              </Typography>
              <Typography variant="h4">
                0
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Stage1
              </Typography>
              <Typography variant="h5">
                {"latest_per_patient": true}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Stage2
              </Typography>
              <Typography variant="h5">
                {"latest_per_patient": true}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Grid container spacing={3}>
      </Grid>
    </Box>
  );
};

export default GeneratedComponent;