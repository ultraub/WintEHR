/**
 * Vital Signs Chart Component
 * Displays time-series data for patient vital signs
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Brush
} from 'recharts';
import {
  MonitorHeart as VitalsIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Vital sign configurations with normal ranges
const VITAL_SIGNS = {
  bloodPressure: {
    label: 'Blood Pressure',
    unit: 'mmHg',
    colors: { systolic: '#d32f2f', diastolic: '#1976d2' },
    normalRange: { systolic: [90, 140], diastolic: [60, 90] }
  },
  heartRate: {
    label: 'Heart Rate',
    unit: 'bpm',
    color: '#e91e63',
    normalRange: [60, 100]
  },
  temperature: {
    label: 'Temperature',
    unit: '°F',
    color: '#ff9800',
    normalRange: [97.0, 99.5]
  },
  respiratoryRate: {
    label: 'Respiratory Rate',
    unit: 'breaths/min',
    color: '#00bcd4',
    normalRange: [12, 20]
  },
  oxygenSaturation: {
    label: 'Oxygen Saturation',
    unit: '%',
    color: '#4caf50',
    normalRange: [95, 100]
  }
};

const VitalSignsChart = ({ observations, patientId, timeRange = '7d' }) => {
  const [selectedVital, setSelectedVital] = useState('bloodPressure');
  const [chartType, setChartType] = useState('line');

  // Process observations into chart data
  const chartData = useMemo(() => {
    if (!observations || observations.length === 0) return [];

    // Filter observations by selected vital sign
    const vitalObservations = observations.filter(obs => {
      const code = obs.code?.coding?.[0]?.code;
      switch (selectedVital) {
        case 'bloodPressure':
          return code === '85354-9' || code === '8480-6' || code === '8462-4';
        case 'heartRate':
          return code === '8867-4';
        case 'temperature':
          return code === '8310-5';
        case 'respiratoryRate':
          return code === '9279-1';
        case 'oxygenSaturation':
          return code === '2708-6';
        default:
          return false;
      }
    });

    // Sort by date and format for chart
    const formattedData = vitalObservations
      .map(obs => {
        const date = new Date(obs.effectiveDateTime || obs.meta?.lastUpdated);
        let dataPoint = {
          date: date.toLocaleDateString(),
          timestamp: date.getTime()
        };

        if (selectedVital === 'bloodPressure') {
          // Handle blood pressure components
          if (obs.component) {
            obs.component.forEach(comp => {
              const code = comp.code?.coding?.[0]?.code;
              if (code === '8480-6') {
                dataPoint.systolic = comp.valueQuantity?.value;
              } else if (code === '8462-4') {
                dataPoint.diastolic = comp.valueQuantity?.value;
              }
            });
          }
        } else {
          // Handle single value observations
          dataPoint.value = obs.valueQuantity?.value;
        }

        return dataPoint;
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    return formattedData;
  }, [observations, selectedVital]);

  const vitalConfig = VITAL_SIGNS[selectedVital];

  return (
    <Card>
      <CardHeader
        avatar={<VitalsIcon color="primary" />}
        title="Vital Signs Trends"
        subheader={`Patient: ${patientId || 'Unknown'}`}
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Vital Sign</InputLabel>
              <Select
                value={selectedVital}
                onChange={(e) => setSelectedVital(e.target.value)}
                label="Vital Sign"
              >
                {Object.entries(VITAL_SIGNS).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Normal ranges">
              <IconButton size="small">
                <InfoIcon />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />
      <CardContent>
        {chartData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No vital sign data available for the selected time range
            </Typography>
          </Box>
        ) : (
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  
                  {selectedVital === 'bloodPressure' ? (
                    <>
                      <Area
                        type="monotone"
                        dataKey="systolic"
                        stroke={vitalConfig.colors.systolic}
                        fill={vitalConfig.colors.systolic}
                        fillOpacity={0.3}
                        name="Systolic"
                      />
                      <Area
                        type="monotone"
                        dataKey="diastolic"
                        stroke={vitalConfig.colors.diastolic}
                        fill={vitalConfig.colors.diastolic}
                        fillOpacity={0.3}
                        name="Diastolic"
                      />
                      <ReferenceLine
                        y={vitalConfig.normalRange.systolic[0]}
                        stroke="#ccc"
                        strokeDasharray="3 3"
                      />
                      <ReferenceLine
                        y={vitalConfig.normalRange.systolic[1]}
                        stroke="#ccc"
                        strokeDasharray="3 3"
                      />
                    </>
                  ) : (
                    <>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={vitalConfig.color}
                        fill={vitalConfig.color}
                        fillOpacity={0.3}
                        name={vitalConfig.label}
                      />
                      <ReferenceLine
                        y={vitalConfig.normalRange[0]}
                        stroke="#ccc"
                        strokeDasharray="3 3"
                        label="Lower Normal"
                      />
                      <ReferenceLine
                        y={vitalConfig.normalRange[1]}
                        stroke="#ccc"
                        strokeDasharray="3 3"
                        label="Upper Normal"
                      />
                    </>
                  )}
                  
                  <Brush dataKey="date" height={30} stroke="#8884d8" />
                </AreaChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  
                  {selectedVital === 'bloodPressure' ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="systolic"
                        stroke={vitalConfig.colors.systolic}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Systolic"
                      />
                      <Line
                        type="monotone"
                        dataKey="diastolic"
                        stroke={vitalConfig.colors.diastolic}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Diastolic"
                      />
                    </>
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={vitalConfig.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name={vitalConfig.label}
                    />
                  )}
                  
                  <Brush dataKey="date" height={30} stroke="#8884d8" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </Box>
        )}

        {/* Normal Range Display */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`Normal Range: ${
              selectedVital === 'bloodPressure'
                ? `Systolic ${vitalConfig.normalRange.systolic.join('-')} / Diastolic ${vitalConfig.normalRange.diastolic.join('-')}`
                : vitalConfig.normalRange.join('-')
            } ${vitalConfig.unit}`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`${chartData.length} readings`}
            size="small"
            variant="outlined"
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default VitalSignsChart;