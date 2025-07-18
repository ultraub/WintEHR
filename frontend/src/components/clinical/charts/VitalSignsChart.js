/**
 * VitalSignsChart Component
 * Reusable vital signs chart for displaying trends
 */
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Stack,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';

const VITAL_TYPES = {
  bloodPressure: {
    label: 'Blood Pressure',
    codes: ['85354-9', '55284-4'],
    unit: 'mmHg',
    normalRanges: { systolic: [90, 140], diastolic: [60, 90] },
    colors: { systolic: '#ff4444', diastolic: '#ff9999' }
  },
  heartRate: {
    label: 'Heart Rate',
    codes: ['8867-4'],
    unit: 'bpm',
    normalRange: [60, 100],
    color: '#ff9800'
  },
  temperature: {
    label: 'Temperature',
    codes: ['8310-5'],
    unit: '°F',
    normalRange: [97.0, 99.5],
    color: '#4caf50'
  },
  oxygenSaturation: {
    label: 'Oxygen Saturation',
    codes: ['2708-6', '59408-5'],
    unit: '%',
    normalRange: [95, 100],
    color: '#2196f3'
  },
  respiratoryRate: {
    label: 'Respiratory Rate',
    codes: ['9279-1'],
    unit: 'breaths/min',
    normalRange: [12, 20],
    color: '#9c27b0'
  },
  weight: {
    label: 'Weight',
    codes: ['29463-7', '3141-9'],
    unit: 'kg',
    color: '#607d8b'
  },
  bmi: {
    label: 'BMI',
    codes: ['39156-5'],
    unit: 'kg/m²',
    normalRange: [18.5, 25],
    color: '#795548'
  }
};

const VitalSignsChart = ({ patientId, vitalSigns, selectedVitalType = 'bloodPressure', height = 300 }) => {
  const theme = useTheme();
  const [vitalType, setVitalType] = useState(selectedVitalType);
  
  const vitalConfig = VITAL_TYPES[vitalType];
  
  // Filter and process vital signs based on selected type
  const processVitalSigns = () => {
    const filtered = vitalSigns.filter(obs => {
      const code = obs.code?.coding?.[0]?.code;
      return vitalConfig.codes.includes(code);
    });
    
    // Sort by date
    const sorted = filtered.sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.issued || 0);
      const dateB = new Date(b.effectiveDateTime || b.issued || 0);
      return dateA - dateB;
    });
    
    // Format for chart
    return sorted.map(obs => {
      const date = obs.effectiveDateTime || obs.issued;
      const baseData = {
        date: date ? format(parseISO(date), 'MMM d, yyyy') : 'Unknown',
        fullDate: date,
        id: obs.id
      };
      
      if (vitalType === 'bloodPressure' && obs.component) {
        // Handle blood pressure with systolic and diastolic
        const systolic = obs.component.find(c => c.code?.coding?.[0]?.code === '8480-6');
        const diastolic = obs.component.find(c => c.code?.coding?.[0]?.code === '8462-4');
        return {
          ...baseData,
          systolic: systolic?.valueQuantity?.value,
          diastolic: diastolic?.valueQuantity?.value
        };
      } else {
        // Handle single value vitals
        return {
          ...baseData,
          value: obs.valueQuantity?.value
        };
      }
    });
  };
  
  const chartData = processVitalSigns();
  
  // Check if values are out of normal range
  const hasAbnormalValues = () => {
    if (vitalType === 'bloodPressure') {
      return chartData.some(d => 
        (d.systolic && (d.systolic < vitalConfig.normalRanges.systolic[0] || d.systolic > vitalConfig.normalRanges.systolic[1])) ||
        (d.diastolic && (d.diastolic < vitalConfig.normalRanges.diastolic[0] || d.diastolic > vitalConfig.normalRanges.diastolic[1]))
      );
    } else if (vitalConfig.normalRange) {
      return chartData.some(d => 
        d.value && (d.value < vitalConfig.normalRange[0] || d.value > vitalConfig.normalRange[1])
      );
    }
    return false;
  };
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" display="block" gutterBottom>
            {label}
          </Typography>
          {payload.map((entry, index) => (
            <Typography key={`${entry.name}-${entry.value}-${index}`} variant="body2" sx={{ color: entry.color }}>
              {entry.name}: {entry.value} {vitalConfig.unit}
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };
  
  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={vitalType}
            onChange={(e) => setVitalType(e.target.value)}
          >
            {Object.entries(VITAL_TYPES).map(([key, config]) => (
              <MenuItem key={key} value={key}>{config.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {hasAbnormalValues() && (
          <Chip 
            label="Contains abnormal values" 
            color="warning" 
            size="small" 
          />
        )}
      </Stack>
      
      {chartData.length === 0 ? (
        <Box sx={{ 
          height: height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: alpha(theme.palette.action.hover, 0.05),
          borderRadius: 1
        }}>
          <Typography variant="body2" color="text.secondary">
            No {vitalConfig.label.toLowerCase()} data available
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              stroke={theme.palette.text.secondary}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke={theme.palette.text.secondary}
              label={{ 
                value: vitalConfig.unit, 
                angle: -90, 
                position: 'insideLeft',
                style: { fill: theme.palette.text.secondary }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {vitalType === 'bloodPressure' ? (
              <>
                <ReferenceLine 
                  y={vitalConfig.normalRanges.systolic[0]} 
                  stroke={alpha(theme.palette.error.main, 0.3)} 
                  strokeDasharray="5 5" 
                />
                <ReferenceLine 
                  y={vitalConfig.normalRanges.systolic[1]} 
                  stroke={alpha(theme.palette.error.main, 0.3)} 
                  strokeDasharray="5 5" 
                />
                <ReferenceLine 
                  y={vitalConfig.normalRanges.diastolic[0]} 
                  stroke={alpha(theme.palette.error.main, 0.3)} 
                  strokeDasharray="5 5" 
                />
                <ReferenceLine 
                  y={vitalConfig.normalRanges.diastolic[1]} 
                  stroke={alpha(theme.palette.error.main, 0.3)} 
                  strokeDasharray="5 5" 
                />
                <Line 
                  type="monotone" 
                  dataKey="systolic" 
                  stroke={vitalConfig.colors.systolic} 
                  name="Systolic"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="diastolic" 
                  stroke={vitalConfig.colors.diastolic} 
                  name="Diastolic"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Legend />
              </>
            ) : (
              <>
                {vitalConfig.normalRange && (
                  <>
                    <ReferenceLine 
                      y={vitalConfig.normalRange[0]} 
                      stroke={alpha(theme.palette.warning.main, 0.3)} 
                      strokeDasharray="5 5" 
                      label={{ value: "Lower Normal", fontSize: 10 }}
                    />
                    <ReferenceLine 
                      y={vitalConfig.normalRange[1]} 
                      stroke={alpha(theme.palette.warning.main, 0.3)} 
                      strokeDasharray="5 5" 
                      label={{ value: "Upper Normal", fontSize: 10 }}
                    />
                  </>
                )}
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={vitalConfig.color} 
                  name={vitalConfig.label}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};

export default VitalSignsChart;