import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, CircularProgress, IconButton, Tooltip, Tab, Tabs, Divider, Button, Stack, Avatar, AvatarGroup, Badge, LinearProgress, Skeleton } from '@mui/material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, AreaChart, Area } from 'recharts';
import { format, parseISO, differenceInYears, differenceInDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { TrendingUp, TrendingDown, Warning, CheckCircle, Error as ErrorIcon, LocalHospital, Favorite, Medication, Science, Timeline as TimelineIcon, Assessment } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { useFHIRClient } from '../../../contexts/FHIRClientContext';
import { useMedicationResolver } from '../../../hooks/useMedicationResolver';
import { useWebSocket } from '../../../contexts/WebSocketContext';


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


const HypertensionManagementDashboard = ({ patientId }) => {
  // FHIR data hooks
  const { resources: medicationrequests, loading: loadingMedicationRequest, error: errorMedicationRequest, refetch: refetchMedicationRequest } = usePatientResources(patientId, 'MedicationRequest');
  const { resources: conditions, loading: loadingCondition, error: errorCondition, refetch: refetchCondition } = usePatientResources(patientId, 'Condition');
  const { resources: observations, loading: loadingObservation, error: errorObservation, refetch: refetchObservation } = usePatientResources(patientId, 'Observation');
  const { resources: patients, loading: loadingPatient, error: errorPatient, refetch: refetchPatient } = usePatientResources(patientId, 'Patient');

  // Local state
  const [selectedTimeRange, setSelectedTimeRange] = useState('6months');
  const [selectedMetric, setSelectedMetric] = useState('all');
  const [expandedSections, setExpandedSections] = useState({});
  const [realTimeData, setRealTimeData] = useState({});

  // Real-time updates
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (patientId) {
      const subscription = subscribe('patient-updates', (data) => {
        if (data.patientId === patientId) {
          setRealTimeData(prev => ({ ...prev, [data.resourceType]: data }));
          if (data.resourceType === 'MedicationRequest') refetchMedicationRequest();
          if (data.resourceType === 'Condition') refetchCondition();
          if (data.resourceType === 'Observation') refetchObservation();
          if (data.resourceType === 'Patient') refetchPatient();
        }
      });
      return () => unsubscribe(subscription);
    }
  }, [patientId]);

  const isLoading = loadingMedicationRequest || loadingCondition || loadingObservation || loadingPatient;
  const hasError = errorMedicationRequest || errorCondition || errorObservation || errorPatient;

  // Process aggregated data
  const aggregatedMetrics = useMemo(() => {
    const metrics = {};
    metrics['stage3'] = {"latest_per_patient": true};
    metrics['stage5'] = {"latest_per_patient": true};
    metrics['stage6'] = {"latest_per_patient": true};
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
                159
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
                1
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {{/* No data available for table */}}
      {/* distribution_charts section */}
    </Box>
  );
};

export default HypertensionManagementDashboard;