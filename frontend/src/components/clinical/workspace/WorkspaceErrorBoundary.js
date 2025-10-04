/**
 * Workspace Error Boundary Component
 * Comprehensive error handling for the entire clinical workspace
 * Provides recovery options and detailed error reporting
 */
import React from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  Typography,
  Paper,
  Collapse,
  IconButton,
  Stack,
  Divider
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Home as HomeIcon,
  BugReport as BugReportIcon
} from '@mui/icons-material';

class WorkspaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      showDetails: false,
      lastErrorTime: null
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      lastErrorTime: new Date().toISOString()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console with full details
    console.error('=== WORKSPACE ERROR BOUNDARY CAUGHT ERROR ===');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Time:', new Date().toISOString());
    
    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
    
    // Report to error tracking service if available
    if (window.errorReporter) {
      window.errorReporter.logError(error, {
        ...errorInfo,
        component: 'WorkspaceErrorBoundary',
        errorCount: this.state.errorCount + 1
      });
    }
    
    // Store error in session storage for debugging
    try {
      const errorData = {
        message: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        errorCount: this.state.errorCount + 1
      };
      sessionStorage.setItem('lastWorkspaceError', JSON.stringify(errorData));
    } catch (e) {
      console.error('Failed to store error data:', e);
    }
  }

  handleReset = () => {
    // Clear error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    
    // Call parent reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    // Force page reload
    window.location.reload();
  };

  handleGoHome = () => {
    // Navigate to home/patient list
    window.location.href = '/';
  };

  handleReportBug = () => {
    // Open bug report dialog or navigate to bug report page
    if (this.props.onReportBug) {
      this.props.onReportBug(this.state.error, this.state.errorInfo);
    } else {
      // Default: copy error details to clipboard
      const errorDetails = `
Error: ${this.state.error?.toString()}
Time: ${this.state.lastErrorTime}
Stack: ${this.state.error?.stack}
Component Stack: ${this.state.errorInfo?.componentStack}
      `.trim();
      
      navigator.clipboard.writeText(errorDetails).then(() => {
        alert('Error details copied to clipboard. Please include them in your bug report.');
      });
    }
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const isRecurringError = this.state.errorCount > 2;
      
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            p: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              maxWidth: 800,
              width: '100%',
              p: 4
            }}
          >
            <Alert
              severity="error"
              icon={<ErrorIcon sx={{ fontSize: 40 }} />}
              sx={{ mb: 3 }}
            >
              <AlertTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                Clinical Workspace Error
              </AlertTitle>
              <Typography variant="body1" sx={{ mt: 1 }}>
                An unexpected error occurred in the clinical workspace.
                {isRecurringError && (
                  <Box component="span" sx={{ color: 'error.dark', fontWeight: 'bold' }}>
                    {' '}This error has occurred {this.state.errorCount} times.
                  </Box>
                )}
              </Typography>
            </Alert>

            <Stack spacing={2} sx={{ mb: 3 }}>
              <Typography variant="h6">
                What would you like to do?
              </Typography>
              
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReset}
                  disabled={isRecurringError}
                >
                  Try Again
                </Button>
                
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReload}
                >
                  Reload Page
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                >
                  Go to Home
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<BugReportIcon />}
                  onClick={this.handleReportBug}
                >
                  Report Bug
                </Button>
              </Stack>
            </Stack>

            {isRecurringError && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <AlertTitle>Recurring Error Detected</AlertTitle>
                This error keeps happening. Consider:
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  <li>Reloading the page</li>
                  <li>Clearing your browser cache</li>
                  <li>Reporting this issue to support</li>
                </ul>
              </Alert>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Error Details Section */}
            <Box>
              <Button
                onClick={this.toggleDetails}
                endIcon={
                  <ExpandMoreIcon
                    sx={{
                      transform: this.state.showDetails ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.3s'
                    }}
                  />
                }
                sx={{ mb: 1 }}
              >
                {this.state.showDetails ? 'Hide' : 'Show'} Error Details
              </Button>
              
              <Collapse in={this.state.showDetails}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: 'grey.50',
                    maxHeight: 400,
                    overflow: 'auto'
                  }}
                >
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Error Message:
                      </Typography>
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {this.state.error?.toString()}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Time:
                      </Typography>
                      <Typography variant="body2">
                        {this.state.lastErrorTime}
                      </Typography>
                    </Box>
                    
                    {isDevelopment && this.state.error?.stack && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Stack Trace:
                        </Typography>
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}
                        >
                          {this.state.error.stack}
                        </Typography>
                      </Box>
                    )}
                    
                    {isDevelopment && this.state.errorInfo?.componentStack && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Component Stack:
                        </Typography>
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}
                        >
                          {this.state.errorInfo.componentStack}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              </Collapse>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default WorkspaceErrorBoundary;