import React from 'react';
import { Box, Alert, Button, Typography, Paper } from '@mui/material';
import { ErrorOutline as ErrorIcon } from '@mui/icons-material';

class RelationshipMapperErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('RelationshipMapper Error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optionally reload the component
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Paper elevation={3} sx={{ p: 4, m: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 2
          }}>
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} />
            <Typography variant="h5" color="error">
              Relationship Visualization Error
            </Typography>
            
            <Alert severity="error" sx={{ width: '100%', maxWidth: 600 }}>
              <Typography variant="body2" paragraph>
                The relationship mapper encountered an unexpected error. This might be due to:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Invalid or corrupted FHIR data</li>
                <li>Network connectivity issues</li>
                <li>Browser compatibility problems</li>
                <li>Insufficient memory for large datasets</li>
              </ul>
            </Alert>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                bgcolor: 'grey.100', 
                borderRadius: 1,
                width: '100%',
                maxWidth: 600,
                overflow: 'auto'
              }}>
                <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button 
                variant="contained" 
                onClick={this.handleReset}
                startIcon={<ErrorIcon />}
              >
                Try Again
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
              If this problem persists, please contact support or check the browser console for more details.
            </Typography>
          </Box>
        </Paper>
      );
    }

    return this.props.children;
  }
}

export default RelationshipMapperErrorBoundary;