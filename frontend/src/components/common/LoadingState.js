/**
 * Standardized Loading State Component
 * Provides consistent loading experiences with skeleton and spinner options
 */
import React from 'react';
import {
  Box,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';

const LoadingState = ({ 
  variant = 'spinner', // 'spinner', 'skeleton', 'linear'
  message = 'Loading...',
  fullHeight = true,
  skeletonRows = 3,
  showMessage = true
}) => {
  // Spinner variant
  if (variant === 'spinner') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: fullHeight ? '400px' : 'auto',
          p: 3
        }}
      >
        <CircularProgress size={48} thickness={4} />
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
  }

  // Linear progress variant
  if (variant === 'linear') {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        {showMessage && (
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mt: 1 }}
          >
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  // Skeleton variant
  return (
    <Stack spacing={2}>
      {Array.from({ length: skeletonRows }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </Stack>
  );
};

// Reusable skeleton card component
const SkeletonCard = () => (
  <Card>
    <CardContent>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="rectangular" width={80} height={24} />
        </Stack>
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="75%" height={20} />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Skeleton variant="rectangular" width={60} height={32} />
          <Skeleton variant="rectangular" width={60} height={32} />
        </Stack>
      </Stack>
    </CardContent>
  </Card>
);

// Table skeleton variant
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <Box>
    <Stack spacing={1}>
      {/* Header */}
      <Stack direction="row" spacing={2} sx={{ p: 2 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton 
            key={i} 
            variant="rectangular" 
            height={24} 
            sx={{ flex: i === 0 ? 2 : 1 }}
          />
        ))}
      </Stack>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Stack 
          key={rowIndex} 
          direction="row" 
          spacing={2} 
          sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              variant="text" 
              height={20} 
              sx={{ flex: colIndex === 0 ? 2 : 1 }}
            />
          ))}
        </Stack>
      ))}
    </Stack>
  </Box>
);

// Form skeleton variant
export const FormSkeleton = ({ fields = 4 }) => (
  <Stack spacing={3}>
    {Array.from({ length: fields }).map((_, index) => (
      <Box key={index}>
        <Skeleton variant="text" width="30%" height={16} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" width="100%" height={56} />
      </Box>
    ))}
    <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 2 }}>
      <Skeleton variant="rectangular" width={100} height={36} />
      <Skeleton variant="rectangular" width={100} height={36} />
    </Stack>
  </Stack>
);

export default LoadingState;