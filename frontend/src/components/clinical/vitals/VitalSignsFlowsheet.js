import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Card,
  CardContent
} from '@mui/material';
import {
  MonitorHeart as VitalsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  TableChart as TableIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Print as PrintIcon,
  GetApp as ExportIcon,
  Warning as WarningIcon,
  CheckCircle as NormalIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { format, parseISO, subDays, isAfter, startOfDay, endOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fhirClient } from '../../../core/fhir/services/fhirClient';

// Vital signs configuration with normal ranges
const VITAL_SIGNS_CONFIG = {
  'body-temperature': {
    name: 'Temperature',
    unit: '°F',
    normalRange: { min: 97.0, max: 99.5 },
    color: '#e91e63',
    loincCodes: ['8310-5', '8331-1']
  },
  'heart-rate': {
    name: 'Heart Rate',
    unit: 'bpm',
    normalRange: { min: 60, max: 100 },
    color: '#f44336',
    loincCodes: ['8867-4']
  },
  'respiratory-rate': {
    name: 'Respiratory Rate',
    unit: '/min',
    normalRange: { min: 12, max: 20 },
    color: '#2196f3',
    loincCodes: ['9279-1']
  },
  'systolic-bp': {
    name: 'Systolic BP',
    unit: 'mmHg',
    normalRange: { min: 90, max: 140 },
    color: '#ff9800',
    loincCodes: ['8480-6']
  },
  'diastolic-bp': {
    name: 'Diastolic BP',
    unit: 'mmHg',
    normalRange: { min: 60, max: 90 },
    color: '#ff5722',
    loincCodes: ['8462-4']
  },
  'body-weight': {
    name: 'Weight',
    unit: 'kg',
    normalRange: null, // Weight varies too much by individual
    color: '#4caf50',
    loincCodes: ['29463-7', '3141-9']
  },
  'body-height': {
    name: 'Height',
    unit: 'cm',
    normalRange: null,
    color: '#9c27b0',
    loincCodes: ['8302-2', '3137-7']
  },
  'oxygen-saturation': {
    name: 'O2 Saturation',
    unit: '%',
    normalRange: { min: 95, max: 100 },
    color: '#00bcd4',
    loincCodes: ['2708-6', '59408-5']
  },
  'bmi': {
    name: 'BMI',
    unit: 'kg/m²',
    normalRange: { min: 18.5, max: 24.9 },
    color: '#795548',
    loincCodes: ['39156-5']
  }
};

// Chart View Component
const VitalsChart = ({ vitalType, data, config }) => {
  const chartData = data.map(obs => ({
    date: format(parseISO(obs.effectiveDateTime), 'MM/dd'),
    value: parseFloat(obs.valueQuantity?.value || 0),
    fullDate: obs.effectiveDateTime
  })).sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {config.name} Trend
        </Typography>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <ChartTooltip />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={config.color} 
              strokeWidth={2}
              dot={{ fill: config.color, strokeWidth: 2 }}
            />
            {config.normalRange && (
              <>
                <ReferenceLine 
                  y={config.normalRange.min} 
                  stroke="#4caf50" 
                  strokeDasharray="3 3"
                  label="Normal Min"
                />
                <ReferenceLine 
                  y={config.normalRange.max} 
                  stroke="#4caf50" 
                  strokeDasharray="3 3"
                  label="Normal Max"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Main VitalSignsFlowsheet Component
const VitalSignsFlowsheet = ({ patientId, height = '600px' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [observations, setObservations] = useState([]);
  const [viewMode, setViewMode] = useState('table');
  const [dateRange, setDateRange] = useState('30');
  const [selectedVital, setSelectedVital] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch vital signs observations
  useEffect(() => {
    if (!patientId) return;
    fetchVitalSigns();
  }, [patientId]);

  const fetchVitalSigns = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch observations with vital-signs category
      const result = await fhirClient.search('Observation', {
        patient: patientId,
        category: 'vital-signs',
        _sort: '-date',
        _count: 200
      });

      setObservations(result.resources || []);
    } catch (err) {
      
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Process and categorize vital signs
  const processedVitals = useMemo(() => {
    const filtered = observations.filter(obs => {
      // Apply date range filter
      if (dateRange !== 'all') {
        const obsDate = parseISO(obs.effectiveDateTime || obs.issued);
        const cutoffDate = subDays(new Date(), parseInt(dateRange));
        if (!isAfter(obsDate, cutoffDate)) return false;
      }
      return true;
    });

    // Group by vital sign type using LOINC codes
    const grouped = {};
    filtered.forEach(obs => {
      const loincCode = obs.code?.coding?.find(c => c.system?.includes('loinc'))?.code;
      if (!loincCode) return;

      // Find which vital sign this LOINC code belongs to
      const vitalType = Object.entries(VITAL_SIGNS_CONFIG).find(([key, config]) =>
        config.loincCodes.includes(loincCode)
      )?.[0];

      if (vitalType) {
        if (!grouped[vitalType]) grouped[vitalType] = [];
        grouped[vitalType].push(obs);
      }
    });

    // Sort each group by date
    Object.keys(grouped).forEach(vitalType => {
      grouped[vitalType].sort((a, b) => 
        new Date(b.effectiveDateTime || b.issued) - new Date(a.effectiveDateTime || a.issued)
      );
    });

    return grouped;
  }, [observations, dateRange]);

  // Create table data for flowsheet view
  const tableData = useMemo(() => {
    const allDates = new Set();
    Object.values(processedVitals).forEach(vitals => {
      vitals.forEach(obs => {
        const date = startOfDay(parseISO(obs.effectiveDateTime || obs.issued));
        allDates.add(date.toISOString());
      });
    });

    const sortedDates = Array.from(allDates)
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => b - a)
      .slice(0, 20); // Limit to 20 most recent dates

    return sortedDates.map(date => {
      const row = { date };
      
      Object.entries(VITAL_SIGNS_CONFIG).forEach(([vitalType, config]) => {
        const vitalsForType = processedVitals[vitalType] || [];
        const vitalsForDate = vitalsForType.filter(obs => {
          const obsDate = startOfDay(parseISO(obs.effectiveDateTime || obs.issued));
          return obsDate.getTime() === date.getTime();
        });

        // Get the most recent value for this date
        const latestVital = vitalsForDate[0];
        row[vitalType] = latestVital ? {
          value: latestVital.valueQuantity?.value,
          unit: latestVital.valueQuantity?.unit,
          time: latestVital.effectiveDateTime || latestVital.issued,
          interpretation: latestVital.interpretation?.[0]?.coding?.[0]?.code,
          observation: latestVital
        } : null;
      });

      return row;
    });
  }, [processedVitals]);

  const getValueStatus = (vital, config) => {
    if (!vital || !config.normalRange) return 'normal';
    
    const value = parseFloat(vital.value);
    if (isNaN(value)) return 'normal';
    
    if (value < config.normalRange.min) return 'low';
    if (value > config.normalRange.max) return 'high';
    return 'normal';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'high': return 'error';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'high':
      case 'low':
        return <WarningIcon fontSize="small" />;
      default:
        return <NormalIcon fontSize="small" />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading vital signs: {error}
      </Alert>
    );
  }

  return (
    <Paper sx={{ height, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Vital Signs Flowsheet</Typography>
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="table">
                <TableIcon />
              </ToggleButton>
              <ToggleButton value="chart">
                <TimelineIcon />
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton 
              size="small" 
              onClick={() => setShowFilters(!showFilters)}
              color={showFilters ? 'primary' : 'default'}
            >
              <FilterIcon />
            </IconButton>
            <Tooltip title="Add Vital Signs">
              <IconButton size="small" color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print">
              <IconButton size="small">
                <PrintIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {/* Filters */}
      <Collapse in={showFilters}>
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                label="Date Range"
              >
                <MenuItem value="7">Last 7 days</MenuItem>
                <MenuItem value="30">Last 30 days</MenuItem>
                <MenuItem value="90">Last 90 days</MenuItem>
                <MenuItem value="all">All time</MenuItem>
              </Select>
            </FormControl>
            {viewMode === 'chart' && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Vital Sign</InputLabel>
                <Select
                  value={selectedVital}
                  onChange={(e) => setSelectedVital(e.target.value)}
                  label="Vital Sign"
                >
                  <MenuItem value="all">All Vital Signs</MenuItem>
                  {Object.entries(VITAL_SIGNS_CONFIG).map(([key, config]) => (
                    <MenuItem key={key} value={key}>
                      {config.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </Box>
      </Collapse>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {viewMode === 'table' ? (
          // Table View
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Date/Time</TableCell>
                  {Object.entries(VITAL_SIGNS_CONFIG).map(([vitalType, config]) => (
                    <TableCell key={vitalType} sx={{ fontWeight: 'bold', minWidth: 100 }}>
                      {config.name}
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        ({config.unit})
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableData.map((row, index) => (
                  <TableRow key={`row-${row.date.toISOString()}-${index}`}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {format(row.date, 'MM/dd/yyyy')}
                      </Typography>
                    </TableCell>
                    {Object.entries(VITAL_SIGNS_CONFIG).map(([vitalType, config]) => {
                      const vital = row[vitalType];
                      const status = vital ? getValueStatus(vital, config) : null;

                      return (
                        <TableCell key={vitalType}>
                          {vital ? (
                            <Stack spacing={0.5} alignItems="center">
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Typography variant="body2">
                                  {vital.value} {vital.unit}
                                </Typography>
                                {status !== 'normal' && (
                                  <Chip
                                    size="small"
                                    label={status}
                                    color={getStatusColor(status)}
                                    sx={{ height: 16 }}
                                  />
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {format(parseISO(vital.time), 'HH:mm')}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          // Chart View
          <Box>
            {selectedVital === 'all' ? (
              Object.entries(processedVitals).map(([vitalType, data]) => (
                <VitalsChart
                  key={vitalType}
                  vitalType={vitalType}
                  data={data}
                  config={VITAL_SIGNS_CONFIG[vitalType]}
                />
              ))
            ) : (
              processedVitals[selectedVital] && (
                <VitalsChart
                  vitalType={selectedVital}
                  data={processedVitals[selectedVital]}
                  config={VITAL_SIGNS_CONFIG[selectedVital]}
                />
              )
            )}
          </Box>
        )}

        {Object.keys(processedVitals).length === 0 && (
          <Alert severity="info">
            No vital signs found for the selected criteria
          </Alert>
        )}
      </Box>
    </Paper>
  );
};

export default VitalSignsFlowsheet;