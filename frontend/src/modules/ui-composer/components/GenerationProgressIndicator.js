/**
 * Generation Progress Indicator
 * Shows detailed progress during long-running generations
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Alert,
  Chip,
  Stack,
  Paper,
  Fade
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Timer as TimerIcon,
  Memory as MemoryIcon
} from '@mui/icons-material';

const GenerationProgressIndicator = ({ 
  phase, 
  progress, 
  message, 
  isLoading,
  selectedMethod,
  selectedModel,
  generationMode 
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTotal, setEstimatedTotal] = useState(120); // Default 2 minutes
  
  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      return;
    }
    
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isLoading]);
  
  useEffect(() => {
    // Estimate total time based on method and generation mode
    let estimate = 60; // Base 1 minute
    
    if (selectedMethod === 'cli') {
      estimate = generationMode === 'full' ? 240 : generationMode === 'mixed' ? 180 : 120;
    } else if (selectedMethod === 'sdk') {
      estimate = generationMode === 'full' ? 180 : generationMode === 'mixed' ? 120 : 90;
    } else {
      estimate = 30; // Development mode
    }
    
    // Opus models take longer
    if (selectedModel?.includes('opus')) {
      estimate *= 1.5;
    }
    
    setEstimatedTotal(estimate);
  }, [selectedMethod, selectedModel, generationMode]);
  
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  const getProgressColor = () => {
    if (elapsedTime > estimatedTotal * 1.5) return 'warning';
    if (elapsedTime > estimatedTotal) return 'info';
    return 'primary';
  };
  
  const getProgressValue = () => {
    if (progress > 0) return progress;
    
    // Estimate progress based on elapsed time
    const estimatedProgress = Math.min((elapsedTime / estimatedTotal) * 100, 95);
    return estimatedProgress;
  };
  
  const getStatusMessage = () => {
    if (elapsedTime > estimatedTotal * 2) {
      return "Generation is taking longer than expected. Complex requests may need extra time.";
    }
    if (elapsedTime > estimatedTotal) {
      return "Almost done! Large components may take a bit longer.";
    }
    return message || 'Generating your UI components...';
  };
  
  const getPhaseDescription = (currentPhase) => {
    switch (currentPhase) {
      case 'analyzing':
        return 'Analyzing your request and planning the UI structure';
      case 'generating':
        return 'Creating React components with FHIR integration';
      case 'registering':
        return 'Preparing components for preview';
      case 'complete':
        return 'Generation complete!';
      default:
        return 'Processing your request...';
    }
  };

  if (!isLoading) return null;

  return (
    <Fade in={isLoading}>
      <Paper elevation={2} sx={{ p: 3, m: 2 }}>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <AutoAwesomeIcon color="primary" />
            <Typography variant="h6">
              Generating UI Components
            </Typography>
          </Stack>
          
          {/* Progress Bar */}
          <Box>
            <LinearProgress 
              variant="determinate" 
              value={getProgressValue()} 
              color={getProgressColor()}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {Math.round(getProgressValue())}% complete
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatTime(elapsedTime)} / ~{formatTime(estimatedTotal)}
              </Typography>
            </Box>
          </Box>
          
          {/* Status */}
          <Alert 
            severity={elapsedTime > estimatedTotal ? "warning" : "info"}
            icon={<TimerIcon />}
          >
            <Typography variant="subtitle2">
              {phase && `${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`}
            </Typography>
            <Typography variant="body2">
              {getStatusMessage()}
            </Typography>
          </Alert>
          
          {/* Configuration Info */}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip 
              label={selectedMethod === 'cli' ? 'Claude Max' : selectedMethod.toUpperCase()}
              size="small" 
              color="primary"
              variant="outlined"
            />
            <Chip 
              label={selectedModel?.includes('sonnet') ? 'Sonnet' : 'Opus'}
              size="small" 
              color="secondary"
              variant="outlined"
            />
            <Chip 
              label={generationMode}
              size="small" 
              color="default"
              variant="outlined"
            />
          </Stack>
          
          {/* Extended Time Warning */}
          {elapsedTime > estimatedTotal * 1.5 && (
            <Alert severity="warning" icon={<MemoryIcon />}>
              <Typography variant="body2">
                <strong>Extended Generation Time:</strong> Your request is complex and may take up to 5 minutes. 
                The system is still working - please be patient.
              </Typography>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Fade>
  );
};

export default GenerationProgressIndicator;