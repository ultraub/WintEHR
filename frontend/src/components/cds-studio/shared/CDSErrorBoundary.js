/**
 * Error Boundary for CDS Studio Components
 * Provides graceful error handling and recovery for the CDS Hooks Builder
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  BugReport as BugIcon,
  ExpandMore as ExpandMoreIcon,
  Home as HomeIcon
} from '@mui/icons-material';

class CDSErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      errorId: `cds-error-${Date.now()}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('CDS Studio Error Boundary caught an error:', {
      error,
      errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    this.setState({
      error,
      errorInfo
    });

    // Log to external error tracking service if available
    if (window.errorTracker) {
      window.errorTracker.captureException(error, {
        tags: {
          component: 'CDS-Studio',
          boundary: this.props.componentName || 'Unknown'
        },
        extra: {
          errorInfo,
          props: this.props
        }
      });
    }
  }

  handleRetry = () => {
    // Reset error state and attempt to recover
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });

    // Call optional retry callback
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleReset = () => {
    // Reset to initial state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });

    // Call optional reset callback
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  getErrorSeverity() {
    const { error } = this.state;
    
    if (!error) return 'error';
    
    // Categorize errors by type
    if (error.name === 'ValidationError' || error.message?.includes('Validation')) {
      return 'warning';
    }
    
    if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
      return 'info';
    }
    
    return 'error';
  }

  getErrorCategory() {
    const { error } = this.state;
    
    if (!error) return 'Unknown Error';
    
    if (error.name === 'ValidationError' || error.message?.includes('Validation')) {
      return 'Data Validation';
    }
    
    if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
      return 'Network';
    }
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'Application Logic';
    }
    
    return 'System Error';
  }

  renderErrorDetails() {
    const { error, errorInfo, errorId } = this.state;
    
    return (
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">
            <BugIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            Technical Details
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Error ID: {errorId}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Error Message:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace', 
                  backgroundColor: 'grey.100',
                  p: 1,
                  borderRadius: 1,
                  fontSize: '0.75rem'
                }}
              >
                {error?.toString()}
              </Typography>
            </Box>
            
            {errorInfo?.componentStack && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Component Stack:
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    backgroundColor: 'grey.100',
                    p: 1,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {errorInfo.componentStack}
                </Typography>
              </Box>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    );
  }

  render() {
    if (this.state.hasError) {
      const errorSeverity = this.getErrorSeverity();
      const errorCategory = this.getErrorCategory();
      const componentName = this.props.componentName || 'CDS Studio';

      return (
        <Paper sx={{ p: 3, m: 2, textAlign: 'center' }}>
          <Alert severity={errorSeverity} sx={{ textAlign: 'left', mb: 3 }}>
            <AlertTitle>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6">
                  {componentName} Error
                </Typography>
                <Chip 
                  label={errorCategory} 
                  size="small" 
                  color={errorSeverity === 'error' ? 'error' : 'warning'}
                />
              </Stack>
            </AlertTitle>
            
            <Typography variant="body2" gutterBottom>
              Something went wrong in the {componentName.toLowerCase()}. This error has been logged and 
              our team has been notified.
            </Typography>
            
            {errorSeverity === 'warning' && (
              <Typography variant="body2" color="warning.dark">
                This appears to be a validation error. Please check your input data and try again.
              </Typography>
            )}
            
            {errorSeverity === 'info' && (
              <Typography variant="body2" color="info.dark">
                This appears to be a network-related issue. Please check your connection and try again.
              </Typography>
            )}
          </Alert>

          <Stack spacing={2} alignItems="center">
            <Box>
              <ErrorIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
            </Box>
            
            <Typography variant="h5" gutterBottom>
              Oops! Something went wrong
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
              Don't worry - your work is likely still saved. You can try refreshing this component 
              or return to the main studio to continue working.
            </Typography>
            
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
                size="large"
              >
                Try Again
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleReset}
                size="large"
              >
                Reset Component
              </Button>
              
              {this.props.onBackToStudio && (
                <Button
                  variant="text"
                  onClick={this.props.onBackToStudio}
                  size="large"
                >
                  Back to Studio
                </Button>
              )}
            </Stack>
            
            <Box sx={{ mt: 3, width: '100%' }}>
              {this.renderErrorDetails()}
            </Box>
          </Stack>
        </Paper>
      );
    }

    return this.props.children;
  }
}

export default CDSErrorBoundary;