/**
 * Loading States and Graceful Fallbacks for CDS Studio
 * Provides consistent loading indicators and fallback content
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  LinearProgress,
  Skeleton,
  Alert,
  Button,
  Stack,
  Card,
  CardContent,
  Backdrop
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CloudOff as OfflineIcon,
  Build as BuildIcon,
  Save as SaveIcon
} from '@mui/icons-material';

// Full page loading overlay
export const CDSLoadingOverlay = ({ open, message = 'Loading...', onCancel }) => {
  return (
    <Backdrop
      sx={{ 
        color: '#fff', 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        flexDirection: 'column',
        gap: 2
      }}
      open={open}
    >
      <CircularProgress color="inherit" size={60} />
      <Typography variant="h6" color="inherit">
        {message}
      </Typography>
      {onCancel && (
        <Button
          variant="outlined"
          color="inherit"
          onClick={onCancel}
          sx={{ mt: 2 }}
        >
          Cancel
        </Button>
      )}
    </Backdrop>
  );
};

// Save operation loading state
export const CDSSaveLoading = ({ isVisible, progress, message = 'Saving hook...' }) => {
  if (!isVisible) return null;

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        top: 16, 
        right: 16, 
        p: 2, 
        zIndex: 1300,
        minWidth: 300,
        borderLeft: 4,
        borderColor: 'primary.main'
      }}
      elevation={6}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <SaveIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {message}
          </Typography>
          {progress !== undefined && (
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ mt: 1 }}
            />
          )}
          {progress === undefined && (
            <LinearProgress sx={{ mt: 1 }} />
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

// Hook list loading skeleton
export const CDSHookListSkeleton = ({ count = 5 }) => {
  return (
    <Stack spacing={2}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent>
            <Stack spacing={1}>
              <Skeleton variant="text" width="40%" height={28} />
              <Skeleton variant="text" width="80%" height={20} />
              <Skeleton variant="text" width="60%" height={20} />
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Skeleton variant="rectangular" width={80} height={32} />
                <Skeleton variant="rectangular" width={80} height={32} />
                <Skeleton variant="rectangular" width={80} height={32} />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

// Form loading skeleton
export const CDSFormSkeleton = () => {
  return (
    <Stack spacing={3}>
      {/* Basic Info Section */}
      <Paper sx={{ p: 3 }}>
        <Skeleton variant="text" width="30%" height={32} sx={{ mb: 2 }} />
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={56} />
          <Skeleton variant="rectangular" height={56} />
          <Skeleton variant="rectangular" height={100} />
        </Stack>
      </Paper>

      {/* Conditions Section */}
      <Paper sx={{ p: 3 }}>
        <Skeleton variant="text" width="25%" height={32} sx={{ mb: 2 }} />
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={120} />
          <Skeleton variant="rectangular" height={120} />
        </Stack>
      </Paper>

      {/* Cards Section */}
      <Paper sx={{ p: 3 }}>
        <Skeleton variant="text" width="20%" height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} />
      </Paper>
    </Stack>
  );
};

// Network error fallback
export const CDSNetworkError = ({ onRetry, title = 'Connection Problem' }) => {
  return (
    <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400, mx: 'auto', mt: 4 }}>
      <OfflineIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Unable to connect to the server. Please check your internet connection and try again.
      </Typography>
      <Button
        variant="contained"
        startIcon={<RefreshIcon />}
        onClick={onRetry}
      >
        Try Again
      </Button>
    </Paper>
  );
};

// Empty state fallback
export const CDSEmptyState = ({ 
  title = 'No hooks created yet',
  description = 'Create your first CDS hook to get started with clinical decision support.',
  actionText = 'Create Hook',
  onAction,
  icon: Icon = BuildIcon
}) => {
  return (
    <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Icon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {description}
      </Typography>
      {onAction && (
        <Button
          variant="contained"
          onClick={onAction}
        >
          {actionText}
        </Button>
      )}
    </Paper>
  );
};

// Generic loading state
export const CDSLoading = ({ 
  message = 'Loading...', 
  size = 'medium',
  variant = 'circular',
  showMessage = true 
}) => {
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 60
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        p: 4,
        minHeight: 200
      }}
    >
      {variant === 'circular' && (
        <CircularProgress size={sizeMap[size]} />
      )}
      {variant === 'linear' && (
        <Box sx={{ width: '100%', maxWidth: 300 }}>
          <LinearProgress />
        </Box>
      )}
      {showMessage && (
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ mt: 2 }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

// Progress indicator for multi-step operations
export const CDSProgressIndicator = ({ 
  steps, 
  currentStep, 
  title = 'Processing...',
  onCancel 
}) => {
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">{title}</Typography>
        
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Step {currentStep} of {steps.length}: {steps[currentStep - 1]}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {onCancel && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="outlined" size="small" onClick={onCancel}>
              Cancel
            </Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

// Fallback for failed operations with recovery options
export const CDSOperationFallback = ({ 
  title = 'Operation Failed',
  error,
  onRetry,
  onReset,
  onReportIssue
}) => {
  return (
    <Alert 
      severity="error" 
      sx={{ mb: 2 }}
      action={
        <Stack direction="row" spacing={1}>
          {onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          )}
          {onReset && (
            <Button color="inherit" size="small" onClick={onReset}>
              Reset
            </Button>
          )}
          {onReportIssue && (
            <Button color="inherit" size="small" onClick={onReportIssue}>
              Report
            </Button>
          )}
        </Stack>
      }
    >
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      {error && (
        <Typography variant="body2">
          {error.message || error.toString()}
        </Typography>
      )}
    </Alert>
  );
};

export default {
  CDSLoadingOverlay,
  CDSSaveLoading,
  CDSHookListSkeleton,
  CDSFormSkeleton,
  CDSNetworkError,
  CDSEmptyState,
  CDSLoading,
  CDSProgressIndicator,
  CDSOperationFallback
};