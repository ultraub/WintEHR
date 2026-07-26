/**
 * Tab Error Boundary Component
 * Catches errors in clinical workspace tabs and provides fallback UI.
 *
 * Two distinct failures land here, and they get DIFFERENT treatment:
 *
 * 1. Chunk-load failures — the tab's lazy `import()` failed because the app
 *    was redeployed since this session loaded (its hashed chunk is gone) or
 *    the server was briefly unreachable. React catches the lazy rejection
 *    here, which means the global unhandledrejection kill-switch never sees
 *    it — so THIS boundary must hand the error to staleBundleRecovery, which
 *    unregisters stale service workers, purges caches, and reloads once.
 *    A state-reset "Try Again" is useless for this case: it re-requests the
 *    exact same dead URL.
 *
 * 2. Real render errors in tab code — keep the generic error UI + reset.
 */
import React from 'react';
import { Box, Alert, AlertTitle, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { Error as ErrorIcon, SystemUpdateAlt as UpdateIcon } from '@mui/icons-material';
import { isChunkLoadError, attemptStaleBundleRecovery } from '../../../utils/staleBundleRecovery';

class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
      recoveryExhausted: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Tab Error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ error, errorInfo });

    if (isChunkLoadError(error)) {
      attemptStaleBundleRecovery(error).then((attempted) => {
        if (!attempted) {
          // This session already spent its one auto-recovery — the server is
          // probably down. Hand control to the user instead of reload-looping.
          this.setState({ recoveryExhausted: true });
        }
        // else: the page is about to reload; keep the updating state visible.
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isChunkError: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.isChunkError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert
            severity="info"
            icon={<UpdateIcon />}
            action={
              this.state.recoveryExhausted ? (
                <Button color="inherit" size="small" onClick={this.handleReload}>
                  Reload Page
                </Button>
              ) : null
            }
          >
            <AlertTitle>Updating WintEHR</AlertTitle>
            {this.state.recoveryExhausted ? (
              <Typography variant="body2">
                This part of the app could not be downloaded — the server may be
                restarting. Reload the page to try again.
              </Typography>
            ) : (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={16} color="inherit" />
                <Typography variant="body2">
                  A newer version of WintEHR was detected. Reloading…
                </Typography>
              </Stack>
            )}
          </Alert>
        </Box>
      );
    }

    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert
            severity="error"
            icon={<ErrorIcon />}
            action={
              <Button color="inherit" size="small" onClick={this.handleReset}>
                Try Again
              </Button>
            }
          >
            <AlertTitle>Error Loading Tab</AlertTitle>
            <Typography variant="body2">
              There was an error loading this tab. Please try again or contact support if the problem persists.
            </Typography>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </Typography>
              </Box>
            )}
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default TabErrorBoundary;
