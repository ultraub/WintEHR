/**
 * Timeline Performance Test Utility
 * Tests the timeline visualization with various data loads
 * 
 * @module TimelinePerformanceTest
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  useTheme
} from '@mui/material';
import { PlayArrow as RunIcon, Stop as StopIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { performanceMonitor } from '../performance/optimizations';

const TimelinePerformanceTest = ({ events, renderTimeline }) => {
  const theme = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const frameCountRef = useRef(0);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // Test configurations
  const testConfigs = [
    { name: '100 Events', count: 100 },
    { name: '500 Events', count: 500 },
    { name: '1000 Events', count: 1000 },
    { name: '2000 Events', count: 2000 },
    { name: '5000 Events', count: 5000 }
  ];
  
  // Measure FPS
  const measureFPS = (callback) => {
    let lastTime = performance.now();
    frameCountRef.current = 0;
    
    const checkFPS = () => {
      const currentTime = performance.now();
      const delta = currentTime - lastTime;
      frameCountRef.current++;
      
      if (delta >= 1000) {
        const fps = (frameCountRef.current * 1000) / delta;
        callback(fps);
        frameCountRef.current = 0;
        lastTime = currentTime;
      }
      
      if (isRunning) {
        animationFrameRef.current = requestAnimationFrame(checkFPS);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(checkFPS);
  };
  
  // Run performance tests
  const runTests = async () => {
    setIsRunning(true);
    setResults([]);
    
    for (const config of testConfigs) {
      if (!isRunning) break;
      
      setCurrentTest(config.name);
      const testEvents = events.slice(0, config.count);
      const result = await runSingleTest(config, testEvents);
      
      setResults(prev => [...prev, result]);
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setIsRunning(false);
    setCurrentTest(null);
  };
  
  // Run single test
  const runSingleTest = async (config, testEvents) => {
    const result = {
      name: config.name,
      eventCount: config.count,
      renderTime: 0,
      fps: [],
      memoryUsed: 0,
      passed: true
    };
    
    // Clear performance marks
    performanceMonitor.clear();
    
    // Measure initial memory
    const initialMemory = performance.memory?.usedJSHeapSize || 0;
    
    // Start render timing
    performanceMonitor.mark('render-start');
    startTimeRef.current = performance.now();
    
    // Render timeline
    await renderTimeline(testEvents);
    
    // End render timing
    performanceMonitor.mark('render-end');
    result.renderTime = performance.now() - startTimeRef.current;
    
    // Measure FPS for 3 seconds
    return new Promise((resolve) => {
      let fpsReadings = [];
      
      measureFPS((fps) => {
        fpsReadings.push(fps);
        
        if (fpsReadings.length >= 3) {
          // Calculate average FPS
          result.fps = fpsReadings.reduce((a, b) => a + b) / fpsReadings.length;
          
          // Measure memory usage
          const finalMemory = performance.memory?.usedJSHeapSize || 0;
          result.memoryUsed = (finalMemory - initialMemory) / (1024 * 1024); // MB
          
          // Check if test passed
          result.passed = result.renderTime < 100 && result.fps >= 30;
          
          resolve(result);
        }
      });
    });
  };
  
  // Stop tests
  const stopTests = () => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
  
  // Calculate summary statistics
  const summary = {
    totalTests: results.length,
    passed: results.filter(r => r.passed).length,
    avgRenderTime: results.length > 0 
      ? results.reduce((sum, r) => sum + r.renderTime, 0) / results.length 
      : 0,
    avgFPS: results.length > 0 
      ? results.reduce((sum, r) => sum + r.fps, 0) / results.length 
      : 0
  };
  
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Timeline Performance Test</Typography>
          <Button
            variant="contained"
            startIcon={isRunning ? <StopIcon /> : <RunIcon />}
            onClick={isRunning ? stopTests : runTests}
            color={isRunning ? 'error' : 'primary'}
          >
            {isRunning ? 'Stop Tests' : 'Run Tests'}
          </Button>
        </Stack>
        
        {/* Current test progress */}
        {currentTest && (
          <Box>
            <Typography variant="body2" gutterBottom>
              Running: {currentTest}
            </Typography>
            <LinearProgress />
          </Box>
        )}
        
        {/* Test results */}
        {results.length > 0 && (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Test</TableCell>
                    <TableCell align="right">Events</TableCell>
                    <TableCell align="right">Render Time</TableCell>
                    <TableCell align="right">Avg FPS</TableCell>
                    <TableCell align="right">Memory (MB)</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>{result.name}</TableCell>
                      <TableCell align="right">{result.eventCount}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={result.renderTime < 100 ? 'success.main' : 'error.main'}
                        >
                          {result.renderTime.toFixed(0)}ms
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={result.fps >= 30 ? 'success.main' : 'error.main'}
                        >
                          {result.fps.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {result.memoryUsed.toFixed(1)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={result.passed ? 'PASS' : 'FAIL'}
                          color={result.passed ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Summary */}
            <Alert 
              severity={summary.passed === summary.totalTests ? 'success' : 'warning'}
            >
              <Typography variant="subtitle2" gutterBottom>
                Performance Summary
              </Typography>
              <Typography variant="body2">
                {summary.passed} of {summary.totalTests} tests passed • 
                Avg render: {summary.avgRenderTime.toFixed(0)}ms • 
                Avg FPS: {summary.avgFPS.toFixed(1)}
              </Typography>
            </Alert>
          </>
        )}
        
        {/* Performance targets */}
        <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Performance Targets
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              • Render time: &lt;100ms for 1000 events
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Frame rate: ≥30 FPS during interactions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Memory usage: &lt;50MB for 1000 events
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Smooth zoom/pan at 60 FPS
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

export default TimelinePerformanceTest;