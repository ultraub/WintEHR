/**
 * ClinicalLoadingState Component
 * Consistent skeleton loaders for clinical components
 * Prevents layout shift and provides visual feedback during data loading
 */
import React from 'react';
import {
  Box,
  Skeleton,
  Stack,
  Card,
  CardContent,
  useTheme,
  alpha
} from '@mui/material';

/**
 * Resource card skeleton loader
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to show
 * @param {boolean} props.showIcon - Show icon skeleton
 */
const ResourceCardSkeleton = ({ count = 1, showIcon = true }) => {
  const theme = useTheme();
  
  return (
    <Stack spacing={1}>
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          sx={{
            p: 2,
            borderRadius: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300],
            backgroundColor: index % 2 === 1 
              ? theme.palette.mode === 'dark'
                ? alpha(theme.palette.action.hover, 0.08)
                : alpha(theme.palette.action.hover, 0.04) 
              : theme.palette.background.paper
          }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            {showIcon && (
              <Skeleton variant="circular" width={24} height={24} />
            )}
            <Box flex={1}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Skeleton variant="text" width={200} height={24} />
                <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: '4px' }} />
              </Stack>
              <Stack spacing={0.5}>
                <Skeleton variant="text" width="60%" height={16} />
                <Skeleton variant="text" width="40%" height={16} />
              </Stack>
            </Box>
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

/**
 * Summary card skeleton loader
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to show
 */
const SummaryCardSkeleton = ({ count = 1 }) => {
  const theme = useTheme();
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          sx={{
            height: '100%',
            borderRadius: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300]
          }}
        >
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box flex={1}>
                <Skeleton variant="text" width={80} height={16} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={60} height={48} />
                <Skeleton variant="rectangular" width={80} height={20} sx={{ mt: 1, borderRadius: '4px' }} />
              </Box>
              <Skeleton variant="circular" width={48} height={48} />
            </Stack>
          </CardContent>
        </Card>
      ))}
    </>
  );
};

/**
 * Data table skeleton loader
 * @param {Object} props
 * @param {number} props.rows - Number of rows
 * @param {number} props.columns - Number of columns
 * @param {boolean} props.showHeader - Show header row
 */
const TableSkeleton = ({ rows = 5, columns = 4, showHeader = true }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ width: '100%' }}>
      {showHeader && (
        <Stack 
          direction="row" 
          spacing={2} 
          sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton 
              key={index} 
              variant="text" 
              width={index === 0 ? 200 : 100} 
              height={20} 
            />
          ))}
        </Stack>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Stack 
          key={rowIndex}
          direction="row" 
          spacing={2} 
          sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            backgroundColor: rowIndex % 2 === 1 
              ? theme.palette.mode === 'dark'
                ? alpha(theme.palette.action.hover, 0.08)
                : alpha('#000', 0.02) 
              : theme.palette.background.paper
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              variant="text" 
              width={colIndex === 0 ? 200 : 100} 
              height={20} 
            />
          ))}
        </Stack>
      ))}
    </Box>
  );
};

/**
 * Filter panel skeleton loader
 */
const FilterPanelSkeleton = () => {
  return (
    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2}>
          <Skeleton variant="rectangular" height={40} sx={{ flex: 1, borderRadius: 0 }} />
          <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 0 }} />
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
        </Stack>
        <Stack direction="row" spacing={1}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton 
              key={index}
              variant="rectangular" 
              width={100} 
              height={32} 
              sx={{ borderRadius: 0 }} 
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};

/**
 * Timeline skeleton loader
 * @param {Object} props
 * @param {number} props.events - Number of timeline events
 */
const TimelineSkeleton = ({ events = 5 }) => {
  return (
    <Stack spacing={2}>
      {Array.from({ length: events }).map((_, index) => (
        <Stack key={index} direction="row" spacing={2} alignItems="flex-start">
          <Stack alignItems="center">
            <Skeleton variant="circular" width={40} height={40} />
            {index < events - 1 && (
              <Skeleton variant="rectangular" width={2} height={60} sx={{ mt: 1 }} />
            )}
          </Stack>
          <Box flex={1}>
            <Skeleton variant="text" width={120} height={16} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: 0 }} />
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

/**
 * Full page skeleton loader
 * Combines multiple skeleton components for complete page loading state
 */
const PageSkeleton = () => {
  return (
    <Stack spacing={3}>
      <FilterPanelSkeleton />
      <Box sx={{ px: 3 }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={3}>
            <Box flex={1}><SummaryCardSkeleton /></Box>
            <Box flex={1}><SummaryCardSkeleton /></Box>
            <Box flex={1}><SummaryCardSkeleton /></Box>
            <Box flex={1}><SummaryCardSkeleton /></Box>
          </Stack>
          <ResourceCardSkeleton count={5} />
        </Stack>
      </Box>
    </Stack>
  );
};

// Export all skeleton components
const ClinicalLoadingState = {
  ResourceCard: ResourceCardSkeleton,
  SummaryCard: SummaryCardSkeleton,
  Table: TableSkeleton,
  FilterPanel: FilterPanelSkeleton,
  Timeline: TimelineSkeleton,
  Page: PageSkeleton
};

export default ClinicalLoadingState;