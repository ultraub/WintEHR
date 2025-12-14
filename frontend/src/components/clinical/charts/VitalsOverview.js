/**
 * Vitals Overview Component
 * Displays all vital signs in separate charts with abnormal indicators
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Alert,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  useTheme
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as NormalIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { getChartColors, getReferenceColors } from '../../../themes/chartColors';

const VitalsOverview = ({ patientId, vitalsData = null, compact = false }) => {
  const theme = useTheme();
  const chartColors = getChartColors(theme);
  const refColors = getReferenceColors(theme);
  
  const [allVitalsData, setAllVitalsData] = useState([]);
  const [timeRange, setTimeRange] = useState(1095); // 3 years default
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vital sign configurations with normal ranges
  const vitalConfigs = {
    'Blood pressure panel with all children optional': {
      name: 'Blood Pressure',
      unit: 'mmHg',
      normalRanges: { systolic: [90, 140], diastolic: [60, 90] },
      color: chartColors.vitals.bloodPressureSystolic,
      hasMultipleValues: true
    },
    'Heart rate': {
      name: 'Heart Rate',
      unit: 'bpm',
      normalRanges: { value: [60, 100] },
      color: chartColors.vitals.heartRate
    },
    'Body temperature': {
      name: 'Temperature',
      unit: '°F',
      normalRanges: { value: [97.0, 99.5] },
      color: chartColors.vitals.temperature
    },
    'Oxygen Saturation': {
      name: 'Oxygen Saturation',
      unit: '%',
      normalRanges: { value: [95, 100] },
      color: chartColors.vitals.respiratoryRate
    },
    'Respiratory rate': {
      name: 'Respiratory Rate',
      unit: 'breaths/min',
      normalRanges: { value: [12, 20] },
      color: chartColors.vitals.oxygenSaturation
    },
    'Body Weight': {
      name: 'Body Weight',
      unit: 'kg',
      normalRanges: { value: [45, 100] },
      color: chartColors.vitals.weight
    },
    'Body mass index (BMI) [Ratio]': {
      name: 'BMI',
      unit: 'kg/m²',
      normalRanges: { value: [18.5, 25] },
      color: chartColors.vitals.height
    },
    'Body Height': {
      name: 'Height',
      unit: 'cm',
      normalRanges: { value: [150, 200] },
      color: chartColors.vitals.bmi
    },
    'Pain severity - 0-10 verbal numeric rating [Score] - Reported': {
      name: 'Pain Score',
      unit: 'score',
      normalRanges: { value: [0, 3] },
      color: theme.palette.secondary.main
    },
    // Common alternative names for vital signs
    'Blood Pressure': {
      name: 'Blood Pressure',
      unit: 'mmHg',
      normalRanges: { systolic: [90, 140], diastolic: [60, 90] },
      color: chartColors.vitals.bloodPressureSystolic,
      hasMultipleValues: true
    },
    'Temperature': {
      name: 'Temperature',
      unit: '°F',
      normalRanges: { value: [97.0, 99.5] },
      color: chartColors.vitals.temperature
    },
    // 'Body temperature' already defined above
    // 'Oxygen Saturation' already defined above
    'Pulse Oximetry': {
      name: 'O2 Saturation (Pulse)',
      unit: '%',
      normalRanges: { value: [95, 100] },
      color: chartColors.vitals.respiratoryRate
    }
  };

  useEffect(() => {
    if (vitalsData) {
      // Transform FHIR observations to expected format
      const transformedVitals = vitalsData.map(obs => {
        const value = obs.valueQuantity?.value || obs.valueString || '';
        const unit = obs.valueQuantity?.unit || '';
        
        // Handle blood pressure component observations
        if (obs.component && obs.component.length > 0) {
          // Look for systolic and diastolic components
          const systolic = obs.component.find(c => 
            c.code?.coding?.some(coding => 
              coding.code === '8480-6' || coding.display?.toLowerCase().includes('systolic')
            )
          )?.valueQuantity?.value;
          
          const diastolic = obs.component.find(c => 
            c.code?.coding?.some(coding => 
              coding.code === '8462-4' || coding.display?.toLowerCase().includes('diastolic')
            )
          )?.valueQuantity?.value;
          
          if (systolic && diastolic) {
            return {
              id: obs.id,
              patient_id: patientId,
              observation_date: obs.effectiveDateTime || obs.issued,
              display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Blood Pressure',
              value: `${systolic}/${diastolic}`,
              value_quantity: null,
              value_unit: 'mmHg',
              unit: 'mmHg',
              status: obs.status
            };
          }
        }
        
        return {
          id: obs.id,
          patient_id: patientId,
          observation_date: obs.effectiveDateTime || obs.issued,
          display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
          value: value.toString(),
          value_quantity: typeof value === 'number' ? value : parseFloat(value),
          value_unit: unit,
          unit: unit,
          status: obs.status
        };
      });
      
      setAllVitalsData(transformedVitals);
      setLoading(false);
    } else if (patientId) {
      fetchVitalsData();
    }
  }, [patientId, vitalsData, timeRange]);

  const fetchVitalsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch ALL vital signs using FHIR (now defaults to 1000 count)
      const result = await fhirClient.getVitalSigns(patientId);
      
      // Transform FHIR observations to expected format
      const transformedVitals = result.resources.map(obs => {
        let value = obs.valueQuantity?.value || obs.valueString || '';
        let unit = obs.valueQuantity?.unit || '';
        
        // Convert temperature from Celsius to Fahrenheit
        if (obs.code?.text === 'Body temperature' && unit === 'Cel') {
          value = (value * 9/5) + 32;
          unit = '°F';
        }
        
        // Handle blood pressure component observations
        if (obs.component && obs.component.length > 0) {
          // Look for systolic and diastolic components
          const systolic = obs.component.find(c => 
            c.code?.coding?.some(coding => 
              coding.code === '8480-6' || coding.display?.toLowerCase().includes('systolic')
            )
          )?.valueQuantity?.value;
          
          const diastolic = obs.component.find(c => 
            c.code?.coding?.some(coding => 
              coding.code === '8462-4' || coding.display?.toLowerCase().includes('diastolic')
            )
          )?.valueQuantity?.value;
          
          if (systolic && diastolic) {
            return {
              id: obs.id,
              patient_id: patientId,
              observation_date: obs.effectiveDateTime || obs.issued,
              display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Blood Pressure',
              value: `${systolic}/${diastolic}`,
              value_quantity: null,
              value_unit: 'mmHg',
              unit: 'mmHg',
              status: obs.status
            };
          }
        }
        
        return {
          id: obs.id,
          patient_id: patientId,
          observation_date: obs.effectiveDateTime || obs.issued,
          display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
          value: value.toString(),
          value_quantity: typeof value === 'number' ? value : parseFloat(value),
          value_unit: unit,
          unit: unit,
          status: obs.status
        };
      });
      
      setAllVitalsData(transformedVitals);
    } catch (err) {
      
      setError('Failed to load vital signs data');
    } finally {
      setLoading(false);
    }
  }, [patientId, timeRange]);

  const processVitalData = (vitalType) => {
    const cutoffDate = timeRange === 'all' ? new Date(0) : subDays(new Date(), timeRange);
    
    // Filter vitals by type and date range
    const filteredVitals = allVitalsData.filter(vital => {
      const vitalDate = parseISO(vital.observation_date);
      return vitalDate >= cutoffDate && vital.display === vitalType;
    });

    // Don't group by date - use each measurement as a separate point
    const dataPoints = filteredVitals
      .map(vital => {
        const baseData = {
          date: vital.observation_date,
          displayDate: format(parseISO(vital.observation_date), 'MMM yyyy')
        };

        // Handle blood pressure specially (split systolic/diastolic)
        if ((vitalType === 'Blood pressure panel with all children optional' || vitalType === 'Blood Pressure') && vital.value) {
          const [systolic, diastolic] = vital.value.split('/').map(v => parseFloat(v));
          if (!isNaN(systolic) && !isNaN(diastolic)) {
            return {
              ...baseData,
              systolic,
              diastolic
            };
          }
        } else if (vital.value_quantity) {
          // Use value_quantity for numeric values when available
          return {
            ...baseData,
            value: vital.value_quantity
          };
        } else if (vital.value) {
          const numericValue = parseFloat(vital.value);
          if (!isNaN(numericValue)) {
            return {
              ...baseData,
              value: numericValue
            };
          }
        }
        return null;
      })
      .filter(item => item && (item.value !== undefined || (item.systolic !== undefined && item.diastolic !== undefined)))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return dataPoints;
  };

  const getLatestValue = (vitalType) => {
    const data = processVitalData(vitalType);
    if (data.length === 0) return null;
    
    const latest = data[data.length - 1];
    const config = vitalConfigs[vitalType];
    
    if (vitalType === 'Blood pressure panel with all children optional' || vitalType === 'Blood Pressure') {
      return {
        value: `${latest.systolic}/${latest.diastolic}`,
        isAbnormal: latest.systolic > config.normalRanges.systolic[1] || 
                   latest.systolic < config.normalRanges.systolic[0] ||
                   latest.diastolic > config.normalRanges.diastolic[1] ||
                   latest.diastolic < config.normalRanges.diastolic[0],
        date: latest.date
      };
    } else {
      return {
        value: `${latest.value} ${config.unit}`,
        isAbnormal: latest.value > config.normalRanges.value[1] || 
                   latest.value < config.normalRanges.value[0],
        date: latest.date
      };
    }
  };

  const renderVitalChart = (vitalType) => {
    const data = processVitalData(vitalType);
    const config = vitalConfigs[vitalType];
    const latest = getLatestValue(vitalType);
    
    if (data.length === 0) {
      return (
        <Paper sx={{ p: 2, height: compact ? 250 : 300 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant={compact ? 'subtitle1' : 'h6'}>{config.name}</Typography>
            <Chip label="No Data" size="small" color="default" />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%' }}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        </Paper>
      );
    }

    return (
      <Paper sx={{ p: 2, height: compact ? 250 : 300 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant={compact ? 'subtitle1' : 'h6'}>{config.name}</Typography>
          {latest && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {latest.isAbnormal ? (
                <WarningIcon color="warning" fontSize="small" />
              ) : (
                <NormalIcon color="success" fontSize="small" />
              )}
              <Chip 
                label={latest.value}
                size="small"
                color={latest.isAbnormal ? 'warning' : 'success'}
                variant={latest.isAbnormal ? 'filled' : 'outlined'}
              />
            </Box>
          )}
        </Box>
        
        <ResponsiveContainer width="100%" height={compact ? 180 : 220}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="displayDate"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              tick={{ fontSize: 10 }}
              label={{ 
                value: config.unit, 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: '10px' }
              }}
            />
            <Tooltip 
              formatter={(value, name) => [`${value} ${config.unit}`, name]}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return format(parseISO(payload[0].payload.date), 'MMM dd, yyyy');
                }
                return label;
              }}
            />
            
            {/* Reference lines for normal ranges */}
            {config.normalRanges.value && (
              <>
                <ReferenceLine 
                  y={config.normalRanges.value[0]} 
                  stroke={refColors.grid} 
                  strokeDasharray="3 3"
                />
                <ReferenceLine 
                  y={config.normalRanges.value[1]} 
                  stroke={refColors.grid} 
                  strokeDasharray="3 3"
                />
              </>
            )}
            
            {/* Data lines */}
            {(vitalType === 'Blood pressure panel with all children optional' || vitalType === 'Blood Pressure') ? (
              <>
                <ReferenceLine y={config.normalRanges.systolic[0]} stroke={refColors.grid} strokeDasharray="3 3" />
                <ReferenceLine y={config.normalRanges.systolic[1]} stroke={refColors.grid} strokeDasharray="3 3" />
                <ReferenceLine y={config.normalRanges.diastolic[0]} stroke={refColors.grid} strokeDasharray="3 3" />
                <ReferenceLine y={config.normalRanges.diastolic[1]} stroke={refColors.grid} strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  stroke={chartColors.vitals.bloodPressureSystolic}
                  strokeWidth={2}
                  dot={{ fill: chartColors.vitals.bloodPressureSystolic, r: 3 }}
                  name="Systolic"
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  stroke={chartColors.vitals.bloodPressureDiastolic}
                  strokeWidth={2}
                  dot={{ fill: chartColors.vitals.bloodPressureDiastolic, r: 3 }}
                  name="Diastolic"
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={2}
                dot={{ fill: config.color, r: 3 }}
                name={config.name}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Paper>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant={compact ? 'h6' : 'h5'}>
          Vital Signs Overview
        </Typography>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(e, value) => value && setTimeRange(value)}
          size="small"
        >
          <ToggleButton value={90}>90 Days</ToggleButton>
          <ToggleButton value={365}>1 Year</ToggleButton>
          <ToggleButton value={1095}>3 Years</ToggleButton>
          <ToggleButton value="all">All Time</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
      <Grid container spacing={compact ? 2 : 3}>
        {Object.keys(vitalConfigs)
          .filter(vitalType => {
            // Only show charts for vitals that exist in the data
            const hasData = allVitalsData.some(vital => vital.display === vitalType);
            return hasData;
          })
          .map((vitalType) => (
            <Grid item xs={12} md={compact ? 4 : 6} key={vitalType}>
              {renderVitalChart(vitalType)}
            </Grid>
          ))}
      </Grid>
    </Box>
  );
};

export default VitalsOverview;