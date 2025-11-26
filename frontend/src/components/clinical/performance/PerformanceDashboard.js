/**
 * Performance Dashboard Component
 * 
 * Provides real-time visualization of application performance metrics
 * Only available in development mode
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Collapse,
  Alert,
  Button,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  CloudQueue as ApiIcon,
  Layers as LayersIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import performanceMonitor from '../../../utils/performanceMonitor';
import performanceVerification from '../../../utils/performanceVerification';

const PerformanceDashboard = () => {
  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [verification, setVerification] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshMetrics = useCallback(() => {
    setRefreshing(true);
    
    // Get performance summary
    const summary = performanceMonitor.getSummary();
    setMetrics(summary);
    
    // Get verification results
    const verificationResults = performanceVerification.runAllVerifications();
    setVerification(verificationResults);
    
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  useEffect(() => {
    // Initial load
    refreshMetrics();
    
    // Auto-refresh every 5 seconds when expanded
    const interval = expanded ? setInterval(refreshMetrics, 5000) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [expanded, refreshMetrics]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'optimized':
      case 'healthy':
        return 'success';
      case 'warning':
      case 'needs-improvement':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        maxWidth: expanded ? 800 : 300
      }}
    >
      <Card elevation={4}>
        <CardContent sx={{ p: 1.5 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <SpeedIcon color="primary" />
              <Typography variant="subtitle2">
                Performance Monitor
              </Typography>
              {verification && (
                <Chip
                  label={`Score: ${verification.overallScore}`}
                  size="small"
                  color={
                    parseInt(verification.overallScore) >= 80 ? 'success' :
                    parseInt(verification.overallScore) >= 60 ? 'warning' : 'error'
                  }
                />
              )}
            </Box>
            <Box>
              <IconButton
                size="small"
                onClick={refreshMetrics}
                disabled={refreshing}
              >
                <RefreshIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          {!expanded && metrics && (
            <Box mt={1}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">
                    Uptime
                  </Typography>
                  <Typography variant="body2">
                    {metrics.uptime}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">
                    Warnings
                  </Typography>
                  <Typography variant="body2" color={metrics.warnings.totalWarnings > 0 ? 'error' : 'success'}>
                    {metrics.warnings.totalWarnings}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          <Collapse in={expanded}>
            <Box mt={2}>
              {verification && verification.details && (
                <Grid container spacing={2}>
                  {/* Provider Optimization */}
                  <Grid item xs={12} md={6}>
                    <Alert
                      severity={getStatusColor(verification.details.providerOptimization?.status)}
                      icon={<LayersIcon />}
                    >
                      <Typography variant="subtitle2">
                        Provider Optimization
                      </Typography>
                      <Typography variant="caption">
                        Depth: {verification.details.providerOptimization?.currentDepth || 'N/A'} / 
                        {verification.details.providerOptimization?.targetDepth || 'N/A'}
                      </Typography>
                    </Alert>
                  </Grid>

                  {/* Cache Effectiveness */}
                  <Grid item xs={12} md={6}>
                    <Alert
                      severity={getStatusColor(verification.details.cacheEffectiveness?.status)}
                      icon={<ApiIcon />}
                    >
                      <Typography variant="subtitle2">
                        Cache Effectiveness
                      </Typography>
                      <Typography variant="caption">
                        Avg Response: {verification.details.cacheEffectiveness?.avgResponseTime || 'N/A'}
                      </Typography>
                    </Alert>
                  </Grid>

                  {/* Memory Usage */}
                  <Grid item xs={12} md={6}>
                    <Alert
                      severity={getStatusColor(verification.details.memoryUsage?.status)}
                      icon={<MemoryIcon />}
                    >
                      <Typography variant="subtitle2">
                        Memory Usage
                      </Typography>
                      <Typography variant="caption">
                        {verification.details.memoryUsage?.percentUsed || 'N/A'} 
                        ({verification.details.memoryUsage?.used || 'N/A'})
                      </Typography>
                    </Alert>
                  </Grid>

                  {/* Render Performance */}
                  <Grid item xs={12} md={6}>
                    <Alert
                      severity={getStatusColor(verification.details.renderPerformance?.status)}
                      icon={<SpeedIcon />}
                    >
                      <Typography variant="subtitle2">
                        Render Performance
                      </Typography>
                      <Typography variant="caption">
                        {verification.details.renderPerformance?.totalComponents || 0} components tracked
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              )}

              {/* API Calls Table */}
              {metrics && metrics.apiCalls && Object.keys(metrics.apiCalls).length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    API Performance
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Endpoint</TableCell>
                          <TableCell align="right">Calls</TableCell>
                          <TableCell align="right">Avg</TableCell>
                          <TableCell align="right">Max</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(metrics.apiCalls).slice(0, 5).map(([endpoint, stats]) => (
                          <TableRow key={endpoint}>
                            <TableCell>
                              <Tooltip title={endpoint}>
                                <Typography variant="caption" noWrap sx={{ maxWidth: 200 }}>
                                  {endpoint}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right">{stats.calls}</TableCell>
                            <TableCell align="right">{stats.avgDuration}</TableCell>
                            <TableCell align="right">{stats.maxDuration}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Recommendations */}
              {verification && (
                <Box mt={2}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const recommendations = performanceVerification.getRecommendations();
                      if (recommendations.length > 0) {
                        console.group('⚡ Performance Recommendations');
                        recommendations.forEach(rec => {
                          console.warn(`[${rec.area}] ${rec.issue}`);
                          console.log(`Recommendation: ${rec.recommendation}`);
                        });
                        console.groupEnd();
                      } else {
                        console.log('✅ No performance issues detected!');
                      }
                    }}
                  >
                    View Recommendations in Console
                  </Button>
                </Box>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </Box>
  );
};

export default React.memo(PerformanceDashboard);