/**
 * Standardized Error State Component
 * Provides consistent error handling with retry capabilities across the application
 */
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Stack,
  Card,
  CardContent,
  useTheme
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ErrorState = ({ 
  error, 
  onRetry, 
  title = "Something went wrong",
  message,
  showHomeButton = false,
  compact = false,
  actionLabel = "Try Again",
  fullHeight = true
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Extract error message
  const errorMessage = message || 
    (typeof error === 'string' ? error : 
     error?.message || 
     error?.response?.data?.message || 
     error?.response?.data?.detail || 
     'An unexpected error occurred');

  // Determine error type for appropriate messaging
  const isNetworkError = error?.code === 'ECONNABORTED' || 
                        error?.response?.status === 0 ||
                        error?.message?.includes('Network');
  
  const isNotFoundError = error?.response?.status === 404;
  const isAuthError = error?.response?.status === 401 || error?.response?.status === 403;

  // Get contextual title based on error type
  const getContextualTitle = () => {
    if (isNetworkError) return "Connection Problem";
    if (isNotFoundError) return "Not Found";
    if (isAuthError) return "Access Denied";
    return title;
  };

  // Get contextual message
  const getContextualMessage = () => {
    if (isNetworkError) {
      return "Please check your internet connection and try again.";
    }
    if (isNotFoundError) {
      return "The requested resource could not be found.";
    }
    if (isAuthError) {
      return "You don't have permission to access this resource.";
    }
    return errorMessage;
  };

  if (compact) {
    return (
      <Alert 
        severity="error" 
        action={
          onRetry && (
            <Button 
              color="inherit" 
              size="small" 
              onClick={onRetry}
              startIcon={<RefreshIcon />}
              aria-label="Retry loading"
            >
              Retry
            </Button>
          )
        }
      >
        {getContextualMessage()}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullHeight ? '400px' : 'auto',
        p: 3
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent>
          <Stack spacing={3} alignItems="center" textAlign="center">
            <ErrorIcon 
              sx={{ 
                fontSize: 64, 
                color: theme.palette.error.main,
                opacity: 0.8
              }} 
            />
            
            <Stack spacing={1}>
              <Typography variant="h5" component="h2" gutterBottom>
                {getContextualTitle()}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {getContextualMessage()}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={2}>
              {onRetry && (
                <Button
                  variant="contained"
                  onClick={onRetry}
                  startIcon={<RefreshIcon />}
                  aria-label={actionLabel}
                >
                  {actionLabel}
                </Button>
              )}
              
              {showHomeButton && (
                <Button
                  variant="outlined"
                  onClick={() => navigate('/')}
                  startIcon={<HomeIcon />}
                  aria-label="Go to home page"
                >
                  Go Home
                </Button>
              )}
            </Stack>

            {/* Additional error details for development */}
            {process.env.NODE_ENV === 'development' && error?.stack && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  width: '100%'
                }}
              >
                <Typography variant="caption" component="pre" sx={{ 
                  textAlign: 'left',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {error.stack}
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ErrorState;