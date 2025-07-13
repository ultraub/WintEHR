/**
 * CDS Error Boundary Component
 * Prevents CDS errors from crashing the entire application
 */
import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { Warning as WarningIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { cdsLogger } from '../../../config/logging';

class CDSErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to CDS logger
    cdsLogger.error('CDS Component Error:', {
      error: error.toString(),
      errorInfo: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    this.setState({
      error,
      errorInfo
    });

    // Optional: Send error to monitoring service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <Box sx={{ p: 2 }}>
          <Alert 
            severity="warning" 
            icon={<WarningIcon />}
            action={
              this.state.retryCount < 3 && (
                <Button 
                  color="inherit" 
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleRetry}
                >
                  Retry CDS
                </Button>
              )
            }
          >
            <Typography variant="subtitle2" gutterBottom>
              Clinical Decision Support Temporarily Unavailable
            </Typography>
            <Typography variant="body2">
              {this.props.showDetails && this.state.retryCount >= 3 ? 
                'CDS services are experiencing issues. Clinical workflows will continue without decision support.' :
                'Unable to load clinical decision support. You can continue with clinical workflows.'
              }
            </Typography>
            {this.props.showDetails && this.state.retryCount >= 3 && (
              <Typography variant="caption" sx={{ mt: 1, display: 'block', fontFamily: 'monospace' }}>
                Error: {this.state.error?.message}
              </Typography>
            )}
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default CDSErrorBoundary;