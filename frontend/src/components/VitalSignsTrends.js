import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
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
import { format, subDays, parseISO } from 'date-fns';

const VitalSignsTrends = ({ vitals, patientId }) => {
  const [selectedVital, setSelectedVital] = useState('blood_pressure');
  const [timeRange, setTimeRange] = useState(1095); // days - default to 3 years
  const [chartData, setChartData] = useState([]);

  // Vital sign configurations with normal ranges
  const vitalConfigs = {
    blood_pressure: {
      name: 'Blood Pressure',
      lines: [
        { key: 'systolic', name: 'Systolic', color: '#ff4444', normalMin: 90, normalMax: 140 },
        { key: 'diastolic', name: 'Diastolic', color: '#4444ff', normalMin: 60, normalMax: 90 }
      ],
      unit: 'mmHg'
    },
    heart_rate: {
      name: 'Heart Rate',
      lines: [
        { key: 'value', name: 'Heart Rate', color: '#ff9800', normalMin: 60, normalMax: 100 }
      ],
      unit: 'bpm'
    },
    temperature: {
      name: 'Temperature',
      lines: [
        { key: 'value', name: 'Temperature', color: '#4caf50', normalMin: 97.0, normalMax: 99.0 }
      ],
      unit: '°F'
    },
    oxygen_saturation: {
      name: 'Oxygen Saturation',
      lines: [
        { key: 'value', name: 'SpO2', color: '#2196f3', normalMin: 95, normalMax: 100 }
      ],
      unit: '%'
    },
    respiratory_rate: {
      name: 'Respiratory Rate',
      lines: [
        { key: 'value', name: 'Resp Rate', color: '#9c27b0', normalMin: 12, normalMax: 20 }
      ],
      unit: 'breaths/min'
    }
  };

  useEffect(() => {
    processVitalData();
  }, [vitals, selectedVital, timeRange]);

  const processVitalData = () => {
    const cutoffDate = timeRange === 'all' ? new Date(0) : subDays(new Date(), timeRange);
    
    // Filter vitals by type and date range
    const filteredVitals = vitals.filter(vital => {
      const vitalDate = parseISO(vital.observation_date);
      return vitalDate >= cutoffDate && vital.code === selectedVital;
    });

    // Group by date and sort chronologically
    const dataByDate = {};
    
    filteredVitals.forEach(vital => {
      const date = format(parseISO(vital.observation_date), 'yyyy-MM-dd');
      
      if (!dataByDate[date]) {
        dataByDate[date] = {
          date,
          displayDate: format(parseISO(vital.observation_date), 'MMM dd')
        };
      }

      // Handle blood pressure specially (split systolic/diastolic)
      if (selectedVital === 'blood_pressure' && vital.value) {
        const [systolic, diastolic] = vital.value.split('/').map(v => parseFloat(v));
        dataByDate[date].systolic = systolic;
        dataByDate[date].diastolic = diastolic;
      } else {
        dataByDate[date].value = parseFloat(vital.value);
      }
    });

    // Convert to array and sort by date
    const sortedData = Object.values(dataByDate).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    setChartData(sortedData);
  };

  const handleVitalChange = (event) => {
    setSelectedVital(event.target.value);
  };

  const handleTimeRangeChange = (event, newRange) => {
    if (newRange !== null) {
      setTimeRange(newRange);
    }
  };

  const config = vitalConfigs[selectedVital];

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Vital Signs Trends</Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selectedVital}
              onChange={handleVitalChange}
            >
              {Object.entries(vitalConfigs).map(([key, config]) => (
                <MenuItem key={key} value={key}>{config.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={handleTimeRangeChange}
            size="small"
          >
            <ToggleButton value={90}>90 Days</ToggleButton>
            <ToggleButton value={365}>1 Year</ToggleButton>
            <ToggleButton value={1095}>3 Years</ToggleButton>
            <ToggleButton value="all">All Time</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              label={{ 
                value: config.unit, 
                angle: -90, 
                position: 'insideLeft' 
              }}
            />
            <Tooltip 
              formatter={(value) => [`${value} ${config.unit}`, '']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            
            {/* Reference lines for normal ranges */}
            {config.lines.map(line => (
              <React.Fragment key={line.key}>
                {line.normalMin && (
                  <ReferenceLine 
                    y={line.normalMin} 
                    stroke="#ccc" 
                    strokeDasharray="3 3"
                    label={`Min Normal (${line.normalMin})`}
                  />
                )}
                {line.normalMax && (
                  <ReferenceLine 
                    y={line.normalMax} 
                    stroke="#ccc" 
                    strokeDasharray="3 3"
                    label={`Max Normal (${line.normalMax})`}
                  />
                )}
              </React.Fragment>
            ))}
            
            {/* Data lines */}
            {config.lines.map(line => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={2}
                dot={{ fill: line.color, r: 4 }}
                activeDot={{ r: 6 }}
                name={line.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">
            No {config.name.toLowerCase()} data available for the selected time range
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default VitalSignsTrends;