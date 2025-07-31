import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Stack,
  Alert,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

class ErrorBoundary extends React.Component {
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
    // Log error to error reporting service
    this.logErrorToService(error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });
  }

  logErrorToService = (error, errorInfo) => {
    // In production, this would send to error tracking service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // Example: window.Sentry?.captureException(error, { extra: errorInfo });
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }
  };

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false 
    });
    
    // Optionally reload the page
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            bgcolor: 'background.default',
            p: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 600,
              width: '100%',
              textAlign: 'center'
            }}
          >
            <ErrorIcon 
              sx={{ 
                fontSize: 64, 
                color: 'error.main',
                mb: 2
              }} 
            />
            
            <Typography variant="h4" gutterBottom>
              Oops! Something went wrong
            </Typography>
            
            <Typography variant="body1" color="text.secondary" paragraph>
              We encountered an unexpected error. The error has been logged and our team will look into it.
            </Typography>

            {/* Error message for development */}
            {isDevelopment && error && (
              <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Error: {error.toString()}
                </Typography>
              </Alert>
            )}

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
            </Stack>

            {/* Expandable error details for development */}
            {isDevelopment && errorInfo && (
              <>
                <Button
                  endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={this.toggleDetails}
                  sx={{ mb: 2 }}
                >
                  {showDetails ? 'Hide' : 'Show'} Error Details
                </Button>
                
                <Collapse in={showDetails}>
                  <Box
                    sx={{
                      bgcolor: 'grey.100',
                      p: 2,
                      borderRadius: 1,
                      textAlign: 'left',
                      overflow: 'auto',
                      maxHeight: 400,
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Component Stack:
                    </Typography>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {errorInfo.componentStack}
                    </pre>
                    
                    {error?.stack && (
                      <>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                          Error Stack:
                        </Typography>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {error.stack}
                        </pre>
                      </>
                    )}
                  </Box>
                </Collapse>
              </>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Specific error boundary for smaller components
export class ComponentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log only in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error in ${this.props.name || 'Component'}:`, error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error">
          {this.props.fallbackMessage || 'This component encountered an error.'}
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;