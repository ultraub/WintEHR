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
  const [selectedTest, setSelectedTest] = useState('');
  const [timeRange, setTimeRange] = useState(365); // days - default to 1 year for better trend visibility
  
  // Dynamically extract available tests from observations
  const availableTests = useMemo(() => {
    const testMap = new Map();
    
    observations.forEach(obs => {
      const code = obs.code?.coding?.[0]?.code;
      const name = obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown';
      const unit = obs.valueQuantity?.unit || '';
      
      if (code && !testMap.has(code)) {
        // Try to find reference range from existing configs or the observation itself
        let normalRange = [null, null];
        const configTest = Object.values(LAB_PROFILES).flatMap(p => p.tests).find(t => t.code === code);
        
        if (configTest) {
          normalRange = configTest.normalRange;
        } else if (obs.referenceRange?.[0]) {
          normalRange = [
            obs.referenceRange[0].low?.value || null,
            obs.referenceRange[0].high?.value || null
          ];
        }
        
        testMap.set(code, {
          code,
          name,
          unit,
          normalRange,
          color: configTest?.color || `#${Math.floor(Math.random()*16777215).toString(16)}` // Random color if not predefined
        });
      }
    });
    
    return Array.from(testMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [observations]);
  
  // Process observations for the selected test or all tests
  const processedData = useMemo(() => {
    const cutoffDate = subDays(new Date(), timeRange);
    
    // Filter observations
    const relevantObs = observations.filter(obs => {
      const obsDate = obs.effectiveDateTime || obs.issued;
      if (!obsDate) return false;
      
      const inTimeRange = isWithinInterval(parseISO(obsDate), {
        start: cutoffDate,
        end: new Date()
      });
      
      if (selectedTest) {
        const obsCode = obs.code?.coding?.[0]?.code;
        return obsCode === selectedTest && inTimeRange;
      }
      
      return inTimeRange;
    });
    
    // Group by date
    const dataByDate = {};
    relevantObs.forEach(obs => {
      const date = format(parseISO(obs.effectiveDateTime || obs.issued), 'yyyy-MM-dd');
      if (!dataByDate[date]) {
        dataByDate[date] = { date, dateObj: parseISO(obs.effectiveDateTime || obs.issued) };
      }
      
      const testName = obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown';
      if (obs.valueQuantity?.value !== undefined) {
        dataByDate[date][testName] = obs.valueQuantity.value;
      }
    });
    
    // Convert to array and sort by date
    return Object.values(dataByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [observations, selectedTest, timeRange]);
  
  // Calculate trends for each test
  const testTrends = useMemo(() => {
    const trends = {};
    availableTests.forEach(test => {
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
          abnormal: test.normalRange[0] !== null && test.normalRange[1] !== null && 
                   (recent < test.normalRange[0] || recent > test.normalRange[1])
        };
      }
    });
    return trends;
  }, [processedData, availableTests]);
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" display="block" gutterBottom>
            {format(new Date(label), 'MMM d, yyyy')}
          </Typography>
          {payload.map((entry, index) => {
            const test = availableTests.find(t => t.name === entry.name);
            const isAbnormal = test && test.normalRange[0] !== null && test.normalRange[1] !== null &&
                             (entry.value < test.normalRange[0] || entry.value > test.normalRange[1]);
            
            return (
              <Typography 
                key={`${entry.name}-${entry.value}-${label}-${index}`} 
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
    ? availableTests.filter(t => t.code === selectedTest)
    : availableTests.slice(0, 5); // Show top 5 tests if none selected to avoid clutter
  
  // Check if we have any lab data at all
  if (availableTests.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: 300,
            gap: 2
          }}
        >
          <LabIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary">
            No Lab Results Available
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Lab test results will appear here once they are recorded in the system.
          </Typography>
        </Box>
      </Paper>
    );
  }
  
  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <Select
              value={selectedTest}
              onChange={(e) => setSelectedTest(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <em>All Tests (Top 5)</em>
              </MenuItem>
              {availableTests.map((test) => (
                <MenuItem key={test.code} value={test.code}>
                  {test.name} {test.unit && `(${test.unit})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={(e, newRange) => newRange && setTimeRange(newRange)}
            size="small"
          >
            <ToggleButton value={90}>3mo</ToggleButton>
            <ToggleButton value={180}>6mo</ToggleButton>
            <ToggleButton value={365}>1yr</ToggleButton>
            <ToggleButton value={730}>2yr</ToggleButton>
            <ToggleButton value={1825}>5yr</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>
      
      {/* Test Summary Cards - Show selected test or top tests with data */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {(selectedTest ? availableTests.filter(t => t.code === selectedTest) : availableTests.slice(0, 6))
          .filter(test => processedData.some(d => d[test.name] !== undefined))
          .map((test) => {
            const trend = testTrends[test.name];
            const hasData = processedData.some(d => d[test.name] !== undefined);
            
            return (
              <Grid item xs={12} sm={6} md={4} key={test.code}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    border: selectedTest === test.code ? 2 : 0,
                    borderColor: 'primary.main',
                    '&:hover': { boxShadow: 3 }
                  }}
                >
                  <CardActionArea 
                    onClick={() => setSelectedTest(selectedTest === test.code ? '' : test.code)}
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
                              Single value
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
              <Typography variant="caption" color="text.secondary">
                Try selecting a longer time range or different test
              </Typography>
            </Stack>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => {
                  const d = new Date(date);
                  // Show year for better long-term trends
                  if (timeRange >= 365) {
                    return format(d, 'MMM yyyy');
                  }
                  return format(d, 'MMM d');
                }}
                tick={{ fontSize: 12 }}
                stroke={theme.palette.text.secondary}
                interval={timeRange >= 730 ? 'preserveStartEnd' : 'preserveEnd'}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke={theme.palette.text.secondary}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {testsToShow.map((test) => (
                <React.Fragment key={test.code}>
                  {/* Normal range area - only show if we have valid ranges */}
                  {test.normalRange[0] !== null && (
                    <ReferenceLine 
                      y={test.normalRange[0]} 
                      stroke={alpha(test.color, 0.3)} 
                      strokeDasharray="5 5" 
                      label={{ value: `Lower: ${test.normalRange[0]}`, position: 'left', fontSize: 10 }}
                    />
                  )}
                  {test.normalRange[1] !== null && (
                    <ReferenceLine 
                      y={test.normalRange[1]} 
                      stroke={alpha(test.color, 0.3)} 
                      strokeDasharray="5 5" 
                      label={{ value: `Upper: ${test.normalRange[1]}`, position: 'left', fontSize: 10 }}
                    />
                  )}
                  
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