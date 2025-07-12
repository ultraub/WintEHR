/**
 * Result Trend Analysis Component
 * Advanced visualization and analysis of lab result trends
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  Grid,
  Divider,
  Button
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  ShowChart as ChartIcon,
  TableChart as TableIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as NormalIcon,
  ZoomIn,
  ZoomOut
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Brush,
  Dot
} from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { resultsManagementService } from '../../../services/resultsManagementService';
import { REFERENCE_RANGES } from '../../../utils/labReferenceRanges';

// Common lab tests for trending
const TRENDING_TESTS = [
  { code: '2339-0', name: 'Glucose', unit: 'mg/dL' },
  { code: '4548-4', name: 'Hemoglobin A1c', unit: '%' },
  { code: '38483-4', name: 'Creatinine', unit: 'mg/dL' },
  { code: '2947-0', name: 'Sodium', unit: 'mmol/L' },
  { code: '6298-4', name: 'Potassium', unit: 'mmol/L' },
  { code: '718-7', name: 'Hemoglobin', unit: 'g/dL' },
  { code: '777-3', name: 'Platelets', unit: '10^3/uL' },
  { code: '6690-2', name: 'White Blood Cells', unit: '10^3/uL' },
  { code: '2093-3', name: 'Total Cholesterol', unit: 'mg/dL' },
  { code: '2085-9', name: 'HDL Cholesterol', unit: 'mg/dL' },
  { code: '2089-1', name: 'LDL Cholesterol', unit: 'mg/dL' },
  { code: '2571-8', name: 'Triglycerides', unit: 'mg/dL' }
];

const ResultTrendAnalysis = ({ patientId, initialTestCode = null }) => {
  const [selectedTest, setSelectedTest] = useState(initialTestCode || '2339-0');
  const [timeRange, setTimeRange] = useState(12); // months
  const [viewMode, setViewMode] = useState('chart'); // chart or table
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [showReferenceRange, setShowReferenceRange] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    if (patientId && selectedTest) {
      loadTrendData();
    }
  }, [patientId, selectedTest, timeRange]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const trends = await resultsManagementService.getResultTrends(
        patientId,
        selectedTest,
        timeRange
      );

      // Format data for chart
      const formattedData = trends.map(point => ({
        date: format(parseISO(point.date), 'MM/dd/yy'),
        fullDate: point.date,
        value: point.value,
        unit: point.unit,
        interpretation: point.interpretation,
        referenceRange: point.referenceRange,
        id: point.id
      }));

      setTrendData(formattedData);
      calculateStatistics(formattedData);
    } catch (error) {
      console.error('Failed to load trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data) => {
    if (!data || data.length === 0) {
      setStatistics(null);
      return;
    }

    const values = data.map(d => d.value);
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate statistics
    const stats = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: sortedValues[Math.floor(sortedValues.length / 2)],
      latest: values[values.length - 1],
      first: values[0],
      trend: calculateTrend(data),
      normalCount: data.filter(d => d.interpretation === 'N').length,
      abnormalCount: data.filter(d => ['L', 'H', 'LL', 'HH'].includes(d.interpretation)).length
    };

    // Calculate standard deviation
    const squaredDiffs = values.map(v => Math.pow(v - stats.mean, 2));
    stats.stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);

    setStatistics(stats);
  };

  const calculateTrend = (data) => {
    if (data.length < 2) return 'insufficient';

    // Simple linear regression for trend
    const n = data.length;
    const indices = data.map((_, i) => i);
    const values = data.map(d => d.value);

    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (Math.abs(slope) < 0.01) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  };

  const getTrendIcon = () => {
    if (!statistics) return null;
    
    switch (statistics.trend) {
      case 'increasing':
        return <TrendingUp color="error" />;
      case 'decreasing':
        return <TrendingDown color="primary" />;
      case 'stable':
        return <TrendingFlat color="success" />;
      default:
        return null;
    }
  };

  const selectedTestInfo = TRENDING_TESTS.find(t => t.code === selectedTest);
  const referenceRange = REFERENCE_RANGES[selectedTest];

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    
    // Determine dot color based on interpretation
    let fill = '#4caf50'; // Normal (green)
    if (['H', 'HH'].includes(payload.interpretation)) {
      fill = '#f44336'; // High (red)
    } else if (['L', 'LL'].includes(payload.interpretation)) {
      fill = '#ff9800'; // Low (orange)
    }

    return (
      <Dot cx={cx} cy={cy} r={4} fill={fill} />
    );
  };

  const exportData = () => {
    const csvContent = [
      ['Date', 'Value', 'Unit', 'Interpretation', 'Reference Low', 'Reference High'],
      ...trendData.map(d => [
        d.fullDate,
        d.value,
        d.unit,
        d.interpretation || '',
        d.referenceRange?.low?.value || '',
        d.referenceRange?.high?.value || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTestInfo.name}_trends_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header Controls */}
      <Stack direction="row" spacing={2} alignItems="center" mb={3}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Lab Test</InputLabel>
          <Select
            value={selectedTest}
            onChange={(e) => setSelectedTest(e.target.value)}
            label="Lab Test"
          >
            {TRENDING_TESTS.map(test => (
              <MenuItem key={test.code} value={test.code}>
                {test.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            label="Time Range"
          >
            <MenuItem value={3}>3 Months</MenuItem>
            <MenuItem value={6}>6 Months</MenuItem>
            <MenuItem value={12}>1 Year</MenuItem>
            <MenuItem value={24}>2 Years</MenuItem>
            <MenuItem value={60}>5 Years</MenuItem>
          </Select>
        </FormControl>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="small"
        >
          <ToggleButton value="chart">
            <ChartIcon />
          </ToggleButton>
          <ToggleButton value="table">
            <TableIcon />
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flexGrow: 1 }} />

        <IconButton onClick={exportData} size="small">
          <DownloadIcon />
        </IconButton>
        <IconButton onClick={() => window.print()} size="small">
          <PrintIcon />
        </IconButton>
      </Stack>

      {/* Statistics Summary */}
      {statistics && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {getTrendIcon()}
                  <Typography variant="h6">
                    {statistics.latest} {selectedTestInfo?.unit}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Latest Result
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6">
                  {statistics.mean.toFixed(1)} ± {statistics.stdDev.toFixed(1)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Mean ± SD
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1}>
                  <Chip 
                    label={`${statistics.normalCount} Normal`} 
                    size="small" 
                    color="success" 
                  />
                  <Chip 
                    label={`${statistics.abnormalCount} Abnormal`} 
                    size="small" 
                    color="warning" 
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Result Distribution
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6">
                  {statistics.min} - {statistics.max}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Range
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Chart/Table View */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      ) : trendData.length === 0 ? (
        <Alert severity="info">
          No trend data available for the selected test and time range
        </Alert>
      ) : viewMode === 'chart' ? (
        <Box sx={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                label={{ 
                  value: selectedTestInfo?.unit || '', 
                  angle: -90, 
                  position: 'insideLeft' 
                }}
              />
              <ChartTooltip 
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const data = payload[0].payload;
                  return (
                    <Paper sx={{ p: 1 }}>
                      <Typography variant="caption">
                        {format(parseISO(data.fullDate), 'MMM dd, yyyy HH:mm')}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {data.value} {data.unit}
                      </Typography>
                    </Paper>
                  );
                }}
              />
              <Legend />
              
              {/* Reference Range */}
              {showReferenceRange && referenceRange && (
                <>
                  <ReferenceArea 
                    y1={referenceRange.low} 
                    y2={referenceRange.high} 
                    strokeOpacity={0.3}
                    fillOpacity={0.1}
                    fill="#4caf50"
                  />
                  <ReferenceLine 
                    y={referenceRange.low} 
                    stroke="#4caf50" 
                    strokeDasharray="3 3"
                    label="Low Normal"
                  />
                  <ReferenceLine 
                    y={referenceRange.high} 
                    stroke="#4caf50" 
                    strokeDasharray="3 3"
                    label="High Normal"
                  />
                </>
              )}
              
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#2196f3" 
                strokeWidth={2}
                dot={<CustomDot />}
                name={selectedTestInfo?.name}
              />
              
              <Brush dataKey="date" height={30} stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        // Table View
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Date</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Value</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Status</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Reference Range</th>
              </tr>
            </thead>
            <tbody>
              {trendData.map((row, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: 8 }}>
                    {format(parseISO(row.fullDate), 'MMM dd, yyyy HH:mm')}
                  </td>
                  <td style={{ padding: 8 }}>
                    <strong>{row.value}</strong> {row.unit}
                  </td>
                  <td style={{ padding: 8 }}>
                    {row.interpretation === 'N' ? (
                      <Chip label="Normal" size="small" color="success" />
                    ) : ['H', 'HH'].includes(row.interpretation) ? (
                      <Chip label="High" size="small" color="error" />
                    ) : ['L', 'LL'].includes(row.interpretation) ? (
                      <Chip label="Low" size="small" color="warning" />
                    ) : (
                      <Chip label="Unknown" size="small" />
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {row.referenceRange ? 
                      `${row.referenceRange.low?.value || ''} - ${row.referenceRange.high?.value || ''}` :
                      'N/A'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      {/* Clinical Interpretation */}
      {statistics && statistics.trend !== 'insufficient' && (
        <Alert 
          severity={statistics.abnormalCount > statistics.normalCount ? 'warning' : 'info'}
          sx={{ mt: 2 }}
          icon={<InfoIcon />}
        >
          <Typography variant="body2">
            <strong>Trend Analysis:</strong> {selectedTestInfo?.name} values show a{' '}
            <strong>{statistics.trend}</strong> trend over the past {timeRange} months.
            {statistics.abnormalCount > 0 && (
              <> {statistics.abnormalCount} out of {statistics.count} results were outside normal range.</>
            )}
          </Typography>
        </Alert>
      )}
    </Paper>
  );
};

export default ResultTrendAnalysis;