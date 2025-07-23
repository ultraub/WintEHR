/**
 * Timeline Skeleton Loading Component
 * Provides a realistic loading state for the timeline visualization
 */

import React from 'react';
import {
  Box,
  Skeleton,
  Stack,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material';

const TimelineSkeleton = ({ density = 'comfortable' }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const trackHeight = density === 'compact' ? 40 : density === 'comfortable' ? 60 : 80;
  
  if (isMobile) {
    // Mobile skeleton - vertical layout
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ mb: 3 }}>
            <Skeleton variant="text" width="40%" height={24} sx={{ mb: 1 }} />
            <Stack spacing={1}>
              {[1, 2, 3].map((j) => (
                <Paper key={j} sx={{ p: 1.5 }}>
                  <Skeleton variant="text" width="60%" height={20} />
                  <Skeleton variant="text" width="30%" height={16} />
                </Paper>
              ))}
            </Stack>
          </Box>
        ))}
      </Box>
    );
  }
  
  // Desktop skeleton - horizontal timeline
  return (
    <Box sx={{ height: '100%', p: 2 }}>
      <Paper sx={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* Controls skeleton */}
        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <Skeleton variant="rectangular" width={120} height={32} />
        </Box>
        
        {/* Timeline header */}
        <Box sx={{ height: 40, borderBottom: 1, borderColor: 'divider', px: 2, display: 'flex', alignItems: 'center' }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="text" width={80} height={20} sx={{ mx: 2 }} />
          ))}
        </Box>
        
        {/* Timeline tracks */}
        {[1, 2, 3, 4, 5].map((trackIndex) => (
          <Box
            key={trackIndex}
            sx={{
              height: trackHeight,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            {/* Track label */}
            <Box sx={{ width: 150, px: 2, borderRight: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Skeleton variant="text" width={80} height={20} />
                <Skeleton variant="circular" width={24} height={24} />
              </Stack>
            </Box>
            
            {/* Events */}
            <Box sx={{ flex: 1, position: 'relative', px: 2 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton
                  key={i}
                  variant="circular"
                  width={density === 'compact' ? 24 : 32}
                  height={density === 'compact' ? 24 : 32}
                  sx={{
                    position: 'absolute',
                    left: `${i * 20}%`,
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Paper>
    </Box>
  );
};

export default TimelineSkeleton;