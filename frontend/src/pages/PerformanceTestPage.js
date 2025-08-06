import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Storage as DataIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import PerformanceTest from '../utils/performanceTest';

const PerformanceTestPage = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const runTests = async () => {
    setTesting(true);
    setError(null);
    setResults(null);
    setProgress(0);

    try {
      const tester = new PerformanceTest();
      
      // Mock progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      await tester.runAllTests();
      
      clearInterval(progressInterval);
      setProgress(100);
      
      // Format results for display
      const formattedResults = {
        tests: tester.results,
        summary: {
          totalTests: tester.results.length,
          successfulTests: tester.results.filter(r => r.success).length,
          failedTests: tester.results.filter(r => !r.success).length,
          avgDuration: Math.round(
            tester.results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / 
            tester.results.filter(r => r.success).length
          ),
          totalDataKB: tester.results.filter(r => r.success).reduce((sum, r) => sum + r.dataSizeKB, 0)
        }
      };

      // Calculate improvements
      const oldObs = tester.results.find(r => r.name.includes('OLD: Observations'));
      const newObs = tester.results.find(r => r.name.includes('NEW: Observations'));
      
      if (oldObs && newObs && oldObs.success && newObs.success) {
        formattedResults.improvements = {
          timeSaving: Math.round(((oldObs.duration - newObs.duration) / oldObs.duration) * 100),
          dataSaving: Math.round(((oldObs.dataSizeKB - newObs.dataSizeKB) / oldObs.dataSizeKB) * 100),
          oldDuration: oldObs.duration,
          newDuration: newObs.duration,
          oldDataSize: oldObs.dataSizeKB,
          newDataSize: newObs.dataSizeKB
        };
      }

      setResults(formattedResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
      setProgress(100);
    }
  };

  const getStatusChip = (success) => {
    return success ? (
      <Chip 
        icon={<SuccessIcon />} 
        label="Success" 
        color="success" 
        size="small" 
      />
    ) : (
      <Chip 
        icon={<ErrorIcon />} 
        label="Failed" 
        color="error" 
        size="small" 
      />
    );
  };

  const getDurationColor = (duration) => {
    if (duration < 200) return 'success.main';
    if (duration < 500) return 'warning.main';
    return 'error.main';
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" gutterBottom>
              🧪 FHIR API Performance Testing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Test the performance improvements made to FHIR API calls
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={testing ? <CircularProgress size={20} color="inherit" /> : <RunIcon />}
            onClick={runTests}
            disabled={testing}
            size="large"
          >
            {testing ? 'Running Tests...' : 'Run Tests'}
          </Button>
        </Box>

        {testing && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Testing in progress... {progress}%
            </Typography>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {results && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <SpeedIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Average Duration</Typography>
                  </Box>
                  <Typography variant="h3" color="primary">
                    {results.summary.avgDuration}ms
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <DataIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Total Data</Typography>
                  </Box>
                  <Typography variant="h3" color="primary">
                    {results.summary.totalDataKB}KB
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <SuccessIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="h6">Success Rate</Typography>
                  </Box>
                  <Typography variant="h3" color="success.main">
                    {Math.round((results.summary.successfulTests / results.summary.totalTests) * 100)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <ErrorIcon color="error" sx={{ mr: 1 }} />
                    <Typography variant="h6">Failed Tests</Typography>
                  </Box>
                  <Typography variant="h3" color="error.main">
                    {results.summary.failedTests}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Improvements */}
          {results.improvements && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.light', color: 'success.contrastText' }}>
              <Typography variant="h5" gutterBottom>
                🎯 Performance Improvements Achieved
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6">Response Time</Typography>
                  <Typography variant="h3">
                    {results.improvements.timeSaving}% faster
                  </Typography>
                  <Typography variant="body2">
                    {results.improvements.oldDuration}ms → {results.improvements.newDuration}ms
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6">Data Transfer</Typography>
                  <Typography variant="h3">
                    {results.improvements.dataSaving}% less
                  </Typography>
                  <Typography variant="body2">
                    {results.improvements.oldDataSize}KB → {results.improvements.newDataSize}KB
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Detailed Results Table */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Detailed Test Results
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Test Name</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Duration (ms)</TableCell>
                    <TableCell align="right">Resources</TableCell>
                    <TableCell align="right">Data Size (KB)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.tests.map((test, index) => (
                    <TableRow key={index}>
                      <TableCell>{test.name}</TableCell>
                      <TableCell align="center">
                        {getStatusChip(test.success)}
                      </TableCell>
                      <TableCell align="right">
                        {test.success && (
                          <Typography 
                            variant="body2" 
                            color={getDurationColor(test.duration)}
                            fontWeight="bold"
                          >
                            {test.duration}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {test.success ? test.resourceCount : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {test.success ? test.dataSizeKB : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default PerformanceTestPage;