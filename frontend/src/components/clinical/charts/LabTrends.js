/**
 * Lab Trends Component
 * Displays laboratory test trends over time with filtering
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { fhirClient } from '../../../services/fhirClient';

const LabTrends = ({ patientId, height = 300 }) => {
  const [allLabData, setAllLabData] = useState([]);
  const [labData, setLabData] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testInfo, setTestInfo] = useState(null);
  const [timeRange, setTimeRange] = useState(1095); // days - default to 3 years

  useEffect(() => {
    fetchAllLabData();
  }, [patientId, timeRange]);

  useEffect(() => {
    if (selectedTest && allLabData.length > 0) {
      filterLabDataByTest();
    }
  }, [selectedTest, allLabData]);

  const fetchAllLabData = async () => {
    if (!patientId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch ALL lab observations using FHIR (now defaults to 1000 count)
      const result = await fhirClient.getLabResults(patientId);
      
      // Transform FHIR observations to expected format
      const transformedData = result.resources.map(obs => ({
        id: obs.id,
        patient_id: patientId,
        observation_date: obs.effectiveDateTime || obs.issued,
        display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
        loinc_code: obs.code?.coding?.find(c => c.system?.includes('loinc'))?.code || obs.code?.coding?.[0]?.code,
        value: obs.valueQuantity?.value || obs.valueString || '',
        value_unit: obs.valueQuantity?.unit || '',
        unit: obs.valueQuantity?.unit || '',
        status: obs.status,
        reference_range: obs.referenceRange?.[0]?.text
      }));

      // Filter by time range on frontend
      const cutoffDate = timeRange === 'all' ? new Date(0) : subDays(new Date(), timeRange);
      const filteredByTime = transformedData.filter(obs => {
        const obsDate = parseISO(obs.observation_date);
        return obsDate >= cutoffDate;
      });

      setAllLabData(filteredByTime);

      // Extract unique test types from filtered data
      const testMap = new Map();
      filteredByTime.forEach(obs => {
        if (obs.loinc_code && obs.display) {
          testMap.set(obs.loinc_code, {
            code: obs.loinc_code,
            name: obs.display,
            unit: obs.value_unit || obs.unit || '',
            count: (testMap.get(obs.loinc_code)?.count || 0) + 1
          });
        }
      });

      const tests = Array.from(testMap.values())
        .sort((a, b) => b.count - a.count); // Sort by frequency
      
      setAvailableTests(tests);
      
      // Auto-select the most frequent test
      if (tests.length > 0 && !selectedTest) {
        setSelectedTest(tests[0].code);
      }
    } catch (err) {
      
      setError('Failed to load laboratory tests');
    } finally {
      setLoading(false);
    }
  };

  const filterLabDataByTest = () => {
    if (!selectedTest || !allLabData.length) return;
    
    // Filter data for the selected test
    const filteredData = allLabData
      .filter(obs => obs.loinc_code === selectedTest)
      .filter(obs => {
        // Only include observations with numeric values
        const numericValue = obs.value_quantity || parseFloat(obs.value);
        return !isNaN(numericValue) && numericValue !== null && numericValue !== undefined;
      })
      .map(obs => ({
        date: obs.observation_date, // Keep as ISO string for proper sorting
        displayDate: format(parseISO(obs.observation_date), 'yyyy-MM-dd'),
        value: obs.value_quantity || parseFloat(obs.value),
        unit: obs.value_unit || obs.unit,
        isAbnormal: obs.interpretation === 'High' || obs.interpretation === 'Low',
        interpretation: obs.interpretation,
        referenceRangeLow: obs.reference_range_low,
        referenceRangeHigh: obs.reference_range_high
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by actual date

    setLabData(filteredData);
    
    // Set test info including reference ranges
    if (filteredData.length > 0) {
      const latestResult = filteredData[filteredData.length - 1];
      setTestInfo({
        name: availableTests.find(t => t.code === selectedTest)?.name,
        unit: latestResult.unit,
        refLow: latestResult.referenceRangeLow,
        refHigh: latestResult.referenceRangeHigh
      });
    }
  };

  const formatXAxisDate = (dateStr) => {
    return format(parseISO(dateStr), 'MM/dd');
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 1 }}>
          <Typography variant="body2">
            {format(parseISO(data.date), 'MMM dd, yyyy')}
          </Typography>
          <Typography variant="body2" color={data.isAbnormal ? 'error' : 'primary'}>
            {payload[0].value} {testInfo?.unit}
            {data.interpretation && ` (${data.interpretation})`}
          </Typography>
          {testInfo?.refLow && testInfo?.refHigh && (
            <Typography variant="caption" color="text.secondary">
              Ref: {testInfo.refLow} - {testInfo.refHigh}
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (labData.length === 0) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height={height}>
          <Typography color="text.secondary">No results available for the selected test</Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Box mb={2}>
          <Typography variant="h6" gutterBottom>
            {testInfo?.name}
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip 
              label={`${labData.length} results`} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
            {testInfo?.refLow && testInfo?.refHigh && (
              <Chip 
                label={`Reference: ${testInfo.refLow} - ${testInfo.refHigh} ${testInfo.unit}`} 
                size="small" 
                variant="outlined" 
              />
            )}
          </Box>
        </Box>

        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={labData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="displayDate" 
              tickFormatter={formatXAxisDate}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              label={{ 
                value: testInfo?.unit || '', 
                angle: -90, 
                position: 'insideLeft' 
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference range lines */}
            {testInfo?.refLow && (
              <ReferenceLine 
                y={testInfo.refLow} 
                stroke="green" 
                strokeDasharray="3 3" 
                label={{ value: "Lower limit", position: "right" }}
              />
            )}
            {testInfo?.refHigh && (
              <ReferenceLine 
                y={testInfo.refHigh} 
                stroke="red" 
                strokeDasharray="3 3" 
                label={{ value: "Upper limit", position: "right" }}
              />
            )}
            
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#8884d8" 
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return (
                  <circle 
                    cx={cx} 
                    cy={cy} 
                    r={4} 
                    fill={payload.isAbnormal ? '#f44336' : '#8884d8'}
                  />
                );
              }}
              name={testInfo?.name}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  if (loading && availableTests.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Grid container spacing={2} alignItems="center" mb={2}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Select Lab Test</InputLabel>
            <Select
              value={selectedTest}
              label="Select Lab Test"
              onChange={(e) => setSelectedTest(e.target.value)}
            >
              {availableTests.map(test => (
                <MenuItem key={test.code} value={test.code}>
                  {test.name} ({test.count} results)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box display="flex" justifyContent="flex-end">
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
        </Grid>
      </Grid>
      
      {selectedTest && renderChart()}
    </Box>
  );
};

export default LabTrends;