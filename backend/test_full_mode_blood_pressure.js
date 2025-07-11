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


const BloodPressureTrends = ({ patientId }) => {
  // FHIR data hooks
  const { resources: observations, loading: loadingObservation, error: errorObservation, refetch: refetchObservation } = usePatientResources(patientId, 'Observation');
  const { resources: conditions, loading: loadingCondition, error: errorCondition, refetch: refetchCondition } = usePatientResources(patientId, 'Condition');
  const { resources: medicationrequests, loading: loadingMedicationRequest, error: errorMedicationRequest, refetch: refetchMedicationRequest } = usePatientResources(patientId, 'MedicationRequest');

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
          if (data.resourceType === 'Observation') refetchObservation();
          if (data.resourceType === 'Condition') refetchCondition();
          if (data.resourceType === 'MedicationRequest') refetchMedicationRequest();
        }
      });
      return () => unsubscribe(subscription);
    }
  }, [patientId]);

  const isLoading = loadingObservation || loadingCondition || loadingMedicationRequest;
  const hasError = errorObservation || errorCondition || errorMedicationRequest;



  return (
    <Box sx={{ p: 3 }}>
      {{/* No data available for table */}}
    </Box>
  );
};

export default BloodPressureTrends;