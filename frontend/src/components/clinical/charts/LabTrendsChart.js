/**
 * LabTrendsChart Component
 * Displays trending laboratory results with normal ranges
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Stack,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  Grid,
  Card,
  CardContent,
  CardActionArea
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
  Legend,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
import { format, parseISO, subDays, isWithinInterval } from 'date-fns';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  Science as LabIcon
} from '@mui/icons-material';

// Common lab test configurations - Updated with actual Synthea LOINC codes
const LAB_PROFILES = {
  'basic-metabolic': {
    name: 'Basic Metabolic Panel',
    tests: [
      { code: '2339-0', name: 'Glucose', unit: 'mg/dL', normalRange: [70, 100], color: '#ff6b6b' },
      { code: '38483-4', name: 'Creatinine', unit: 'mg/dL', normalRange: [0.6, 1.2], color: '#4ecdc4' },
      { code: '2947-0', name: 'Sodium', unit: 'mmol/L', normalRange: [136, 145], color: '#45b7d1' },
      { code: '6298-4', name: 'Potassium', unit: 'mmol/L', normalRange: [3.5, 5.0], color: '#f7b731' },
      { code: '2069-3', name: 'Chloride', unit: 'mmol/L', normalRange: [98, 107], color: '#5f27cd' },
      { code: '20565-8', name: 'CO2', unit: 'mmol/L', normalRange: [22, 29], color: '#00d2d3' }
    ]
  },
  'liver-function': {
    name: 'Liver Function Tests',
    tests: [
      { code: '1742-6', name: 'ALT', unit: 'U/L', normalRange: [7, 55], color: '#ff6b6b' },
      { code: '1920-8', name: 'AST', unit: 'U/L', normalRange: [8, 48], color: '#4ecdc4' },
      { code: '1975-2', name: 'Bilirubin Total', unit: 'mg/dL', normalRange: [0.1, 1.2], color: '#f7b731' },
      { code: '1968-7', name: 'Bilirubin Direct', unit: 'mg/dL', normalRange: [0, 0.3], color: '#45b7d1' },
      { code: '6768-6', name: 'Alkaline Phosphatase', unit: 'U/L', normalRange: [45, 115], color: '#5f27cd' },
      { code: '1751-7', name: 'Albumin', unit: 'g/dL', normalRange: [3.5, 5.0], color: '#00d2d3' }
    ]
  },
  'lipid-panel': {
    name: 'Lipid Panel',
    tests: [
      { code: '2093-3', name: 'Total Cholesterol', unit: 'mg/dL', normalRange: [0, 200], color: '#ff6b6b' },
      { code: '2085-9', name: 'HDL Cholesterol', unit: 'mg/dL', normalRange: [40, 999], color: '#4ecdc4' },
      { code: '2089-1', name: 'LDL Cholesterol', unit: 'mg/dL', normalRange: [0, 100], color: '#45b7d1' },
      { code: '2571-8', name: 'Triglycerides', unit: 'mg/dL', normalRange: [0, 150], color: '#f7b731' }
    ]
  },
  'complete-blood-count': {
    name: 'Complete Blood Count',
    tests: [
      { code: '6690-2', name: 'WBC', unit: '10*3/uL', normalRange: [4.5, 11.0], color: '#ff6b6b' },
      { code: '789-8', name: 'RBC', unit: '10*6/uL', normalRange: [4.2, 5.4], color: '#4ecdc4' },
      { code: '718-7', name: 'Hemoglobin', unit: 'g/dL', normalRange: [12.0, 16.0], color: '#45b7d1' },
      { code: '4544-3', name: 'Hematocrit', unit: '%', normalRange: [36, 46], color: '#f7b731' },
      { code: '777-3', name: 'Platelets', unit: '10*3/uL', normalRange: [150, 400], color: '#5f27cd' }
    ]
  },
  'thyroid-function': {
    name: 'Thyroid Function',
    tests: [
      { code: '3051-0', name: 'TSH', unit: 'mIU/L', normalRange: [0.4, 4.0], color: '#ff6b6b' },
      { code: '3053-6', name: 'T4 Free', unit: 'ng/dL', normalRange: [0.9, 1.7], color: '#4ecdc4' },
      { code: '3052-8', name: 'T3 Free', unit: 'pg/mL', normalRange: [2.3, 4.2], color: '#45b7d1' }
    ]
  },
  'synthea-available': {
    name: 'Available Lab Tests',
    tests: [
      { code: '2339-0', name: 'Glucose', unit: 'mg/dL', normalRange: [70, 100], color: '#ff6b6b' },
      { code: '38483-4', name: 'Creatinine', unit: 'mg/dL', normalRange: [0.6, 1.2], color: '#4ecdc4' },
      { code: '2947-0', name: 'Sodium', unit: 'mmol/L', normalRange: [136, 145], color: '#45b7d1' },
      { code: '6298-4', name: 'Potassium', unit: 'mmol/L', normalRange: [3.5, 5.0], color: '#f7b731' },
      { code: '2069-3', name: 'Chloride', unit: 'mmol/L', normalRange: [98, 107], color: '#5f27cd' },
      { code: '20565-8', name: 'CO2', unit: 'mmol/L', normalRange: [22, 29], color: '#00d2d3' },
      { code: '4548-4', name: 'Hemoglobin A1c', unit: '%', normalRange: [4.0, 5.6], color: '#e17055' },
      { code: '49765-1', name: 'Calcium', unit: 'mg/dL', normalRange: [8.5, 10.5], color: '#6c5ce7' },
      { code: '6299-2', name: 'Urea Nitrogen', unit: 'mg/dL', normalRange: [7, 20], color: '#a29bfe' }
    ]
  }
};

const LabTrendsChart = ({ patientId, observations, selectedProfile = 'synthea-available', height = 400 }) => {
  const theme = useTheme();
  const [profile, setProfile] = useState(selectedProfile);
  const [selectedTest, setSelectedTest] = useState(null);
  const [timeRange, setTimeRange] = useState(90); // days
  
  const currentProfile = LAB_PROFILES[profile];
  
  // Process observations for the selected profile
  const processedData = useMemo(() => {
    const cutoffDate = subDays(new Date(), timeRange);
    
    // Filter observations for tests in current profile
    const relevantObs = observations.filter(obs => {
      const obsCode = obs.code?.coding?.[0]?.code;
      const obsDate = obs.effectiveDateTime || obs.issued;
      
      if (!obsDate) return false;
      
      const inProfile = currentProfile.tests.some(test => test.code === obsCode);
      const inTimeRange = isWithinInterval(parseISO(obsDate), {
        start: cutoffDate,
        end: new Date()
      });
      
      return inProfile && inTimeRange;
    });
    
    // Group by date
    const dataByDate = {};
    relevantObs.forEach(obs => {
      const date = format(parseISO(obs.effectiveDateTime || obs.issued), 'yyyy-MM-dd');
      if (!dataByDate[date]) {
        dataByDate[date] = { date };
      }
      
      const testConfig = currentProfile.tests.find(t => t.code === obs.code?.coding?.[0]?.code);
      if (testConfig && obs.valueQuantity?.value !== undefined) {
        dataByDate[date][testConfig.name] = obs.valueQuantity.value;
      }
    });
    
    // Convert to array and sort by date
    return Object.values(dataByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [observations, profile, currentProfile, timeRange]);
  
  // Calculate trends for each test
  const testTrends = useMemo(() => {
    const trends = {};
    currentProfile.tests.forEach(test => {
      const values = processedData
        .map(d => d[test.name])
        .filter(v => v !== undefined);
      
      if (values.length >= 2) {
        const recent = values[values.length - 1];
        const previous = values[values.length - 2];
        const change = ((recent - previous) / previous) * 100;
        
        trends[test.name] = {
          current: recent,
          change: change,
          trend: change > 0 ? 'up' : 'down',
          abnormal: recent < test.normalRange[0] || recent > test.normalRange[1]
        };
      }
    });
    return trends;
  }, [processedData, currentProfile]);
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" display="block" gutterBottom>
            {format(new Date(label), 'MMM d, yyyy')}
          </Typography>
          {payload.map((entry, index) => {
            const test = currentProfile.tests.find(t => t.name === entry.name);
            const isAbnormal = test && (entry.value < test.normalRange[0] || entry.value > test.normalRange[1]);
            
            return (
              <Typography 
                key={index} 
                variant="body2" 
                sx={{ 
                  color: isAbnormal ? 'error.main' : entry.color,
                  fontWeight: isAbnormal ? 'bold' : 'normal'
                }}
              >
                {entry.name}: {entry.value} {test?.unit}
                {isAbnormal && ' ⚠️'}
              </Typography>
            );
          })}
        </Paper>
      );
    }
    return null;
  };
  
  const testsToShow = selectedTest 
    ? currentProfile.tests.filter(t => t.name === selectedTest)
    : currentProfile.tests;
  
  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={profile}
              onChange={(e) => {
                setProfile(e.target.value);
                setSelectedTest(null);
              }}
            >
              {Object.entries(LAB_PROFILES).map(([key, config]) => (
                <MenuItem key={key} value={key}>{config.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={(e, newRange) => newRange && setTimeRange(newRange)}
            size="small"
          >
            <ToggleButton value={30}>30d</ToggleButton>
            <ToggleButton value={90}>90d</ToggleButton>
            <ToggleButton value={180}>6mo</ToggleButton>
            <ToggleButton value={365}>1yr</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>
      
      {/* Test Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {currentProfile.tests.map((test) => {
          const trend = testTrends[test.name];
          const hasData = processedData.some(d => d[test.name] !== undefined);
          
          return (
            <Grid item xs={12} sm={6} md={4} key={test.code}>
              <Card 
                sx={{ 
                  cursor: hasData ? 'pointer' : 'default',
                  opacity: hasData ? 1 : 0.5,
                  border: selectedTest === test.name ? 2 : 0,
                  borderColor: 'primary.main'
                }}
              >
                <CardActionArea 
                  onClick={() => hasData && setSelectedTest(selectedTest === test.name ? null : test.name)}
                  disabled={!hasData}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          {test.name}
                        </Typography>
                        {trend ? (
                          <>
                            <Typography variant="h6">
                              {trend.current} {test.unit}
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              {trend.trend === 'up' ? (
                                <TrendingUpIcon fontSize="small" color={trend.abnormal ? 'error' : 'success'} />
                              ) : (
                                <TrendingDownIcon fontSize="small" color={trend.abnormal ? 'error' : 'info'} />
                              )}
                              <Typography variant="caption" color={trend.abnormal ? 'error' : 'text.secondary'}>
                                {Math.abs(trend.change).toFixed(1)}%
                              </Typography>
                            </Stack>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {hasData ? 'Single value' : 'No data'}
                          </Typography>
                        )}
                      </Box>
                      {trend?.abnormal && <WarningIcon color="error" />}
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      
      {/* Chart */}
      <Paper sx={{ p: 2 }}>
        {processedData.length === 0 ? (
          <Box 
            sx={{ 
              height: height, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.action.hover, 0.05),
              borderRadius: 1
            }}
          >
            <Stack alignItems="center" spacing={2}>
              <LabIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography variant="body1" color="text.secondary">
                No lab results in the selected time range
              </Typography>
            </Stack>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                tick={{ fontSize: 12 }}
                stroke={theme.palette.text.secondary}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke={theme.palette.text.secondary}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {testsToShow.map((test) => (
                <React.Fragment key={test.code}>
                  {/* Normal range area */}
                  <ReferenceLine 
                    y={test.normalRange[0]} 
                    stroke={alpha(test.color, 0.3)} 
                    strokeDasharray="5 5" 
                  />
                  <ReferenceLine 
                    y={test.normalRange[1]} 
                    stroke={alpha(test.color, 0.3)} 
                    strokeDasharray="5 5" 
                  />
                  
                  {/* Test value line */}
                  <Line 
                    type="monotone" 
                    dataKey={test.name} 
                    stroke={test.color} 
                    name={`${test.name} (${test.unit})`}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                </React.Fragment>
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Paper>
    </Box>
  );
};

export default LabTrendsChart;