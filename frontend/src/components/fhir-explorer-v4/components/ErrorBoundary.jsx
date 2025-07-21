/**
 * Error Boundary Component for FHIR Explorer v4
 * 
 * Catches JavaScript errors anywhere in the component tree,
 * logs errors, and displays a fallback UI
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
  Collapse
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  BugReport as BugIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

class FHIRExplorerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console and error reporting service
    console.error('[FHIR Explorer Error]:', error, errorInfo);
    
    // Store error details
    this.setState({
      error,
      errorInfo
    });

    // Could also log to an error reporting service here
    if (window.errorReporting) {
      window.errorReporting.logError(error, {
        component: 'FHIRExplorer',
        componentStack: errorInfo.componentStack
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
  };

  handleToggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Alert 
              severity="error" 
              icon={<ErrorIcon fontSize="large" />}
              sx={{ mb: 3 }}
            >
              <AlertTitle sx={{ fontSize: '1.2rem', fontWeight: 600 }}>
                Something went wrong in FHIR Explorer
              </AlertTitle>
              <Typography variant="body2" sx={{ mt: 1 }}>
                An unexpected error occurred while rendering this component. 
                You can try refreshing the page or resetting the component.
              </Typography>
            </Alert>

            {/* Error Message */}
            {this.state.error && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Error Message:
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography 
                    variant="body2" 
                    sx={{ fontFamily: 'monospace', color: 'error.main' }}
                  >
                    {this.state.error.toString()}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Actions */}
            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleReset}
              >
                Reset Component
              </Button>
              <Button
                variant="outlined"
                startIcon={<BugIcon />}
                endIcon={<ExpandMoreIcon 
                  sx={{ 
                    transform: this.state.showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }} 
                />}
                onClick={this.handleToggleDetails}
              >
                {this.state.showDetails ? 'Hide' : 'Show'} Details
              </Button>
            </Stack>

            {/* Technical Details */}
            <Collapse in={this.state.showDetails}>
              <Paper 
                variant="outlined" 
                sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100' }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Stack Trace:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    maxHeight: 300,
                    m: 0
                  }}
                >
                  {this.state.errorInfo?.componentStack}
                </Box>
              </Paper>
            </Collapse>

            {/* Help Text */}
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                If this error persists, please try:
              </Typography>
              <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                <li>Clearing your browser cache</li>
                <li>Checking for any browser extensions that might interfere</li>
                <li>Contacting support with the error details above</li>
              </Box>
            </Alert>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default FHIRExplorerErrorBoundary;